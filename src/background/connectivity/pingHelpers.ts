import { nanoid } from 'nanoid';
import { WsConnectivityMsg, WsPingMsg } from './protobufCompiled';
import { stringToUint8Array } from '../../lib/string-utils';
import { log } from '../../lib/logger';
import { sleep } from '../../lib/helpers';

/**
 * Prepares ping message before sending to the endpoint via websocket
 * @param {number} currentTime
 * @param {string} vpnToken
 * @param {string} appId
 * @returns {Uint8Array}
 */
const preparePingMessage = (currentTime: number, vpnToken: string, appId: string) => {
    const pingMsg = WsPingMsg.create({
        requestTime: currentTime,
        token: stringToUint8Array(vpnToken),
        applicationId: stringToUint8Array(appId),
        ignoredHandshake: false, // previously was used to ignore handshakes for measuring pings
    });
    const protocolMsg = WsConnectivityMsg.create({ pingMsg });
    return WsConnectivityMsg.encode(protocolMsg).finish();
};

const decodeMessage = (arrBufMessage: ArrayBuffer) => {
    const message = WsConnectivityMsg.decode(new Uint8Array(arrBufMessage));
    return WsConnectivityMsg.toObject(message);
};

/**
 * Sends ping message and returns latency
 * @param websocket
 * @param {string} vpnToken
 * @param {string} appId
 * @returns {Promise<number>}
 */
export const sendPingMessage = (websocket: WebSocket, vpnToken: string, appId: string) => {
    const PING_TIMEOUT_MS = 3000;
    const arrBufMessage = preparePingMessage(Date.now(), vpnToken, appId);

    return new Promise((resolve, reject) => {
        if (!websocket || websocket.readyState !== websocket.OPEN) {
            reject(new Error('WS is already closed'));
            return;
        }

        websocket.send(arrBufMessage);

        const timeoutId = setTimeout(() => {
            reject(new Error('Ping poll timeout'));
        }, PING_TIMEOUT_MS);

        const messageHandler = (event: MessageEvent) => {
            const receivedTime = Date.now();
            const { pingMsg } = decodeMessage(event.data);
            if (pingMsg) {
                const { requestTime } = pingMsg;
                const ping = receivedTime - requestTime;
                if (ping > PING_TIMEOUT_MS) {
                    // ping over 3s should be ignored,
                    // because the websocket response seems to be too old
                    reject(new Error('Ping is too long'));
                }
                websocket.removeEventListener('message', messageHandler);
                clearTimeout(timeoutId);
                resolve(ping);
            }
        };

        websocket.addEventListener('message', messageHandler);
    });
};

/**
 * Makes fetch request with timeout and aborts it in the case of timeout
 * @param requestUrl
 * @param fetchTimeout
 */
const fetchWithTimeout = (requestUrl: string, fetchTimeout: number) => {
    const RANDOM_PARAM_LENGTH = 6;
    // we add random search param to avoid caching
    const requestUrlWithRandomParams = `${requestUrl}?r=${nanoid(RANDOM_PARAM_LENGTH)}`;

    // used to abort going fetch requests
    const controller = new AbortController();

    // used in order to clear timeout
    let timeoutId: number;

    const fetchHandler = async () => {
        try {
            const headers = new Headers();
            headers.append('Cache-Control', 'no-cache');
            const request = new Request(
                requestUrlWithRandomParams,
                {
                    redirect: 'manual',
                    cache: 'no-cache',
                    headers,
                },
            );

            const response = await fetch(request, { signal: controller.signal });
            if (timeoutId) {
                clearTimeout(timeoutId);
            }
            // if request is blocked with adblocker, it returns 500 error for the first request,
            // so we additionally check if response status is ok
            if (!response.ok) {
                throw new Error('Server response is not ok');
            }
            return response;
        } catch (e) {
            if (timeoutId) {
                clearTimeout(timeoutId);
            }
            throw e;
        }
    };

    // Promise race fulfils when first of the promises fulfils
    return Promise.race([
        fetchHandler(),
        new Promise((_, reject) => {
            timeoutId = window.setTimeout(() => {
                controller.abort();
                reject(new Error(`Request to ${requestUrlWithRandomParams} stopped by timeout`));
            }, fetchTimeout);
        }),
    ]);
};

/**
 * Determines ping to the endpoint
 * @param domainName
 */
export const measurePingToEndpointViaFetch = async (domainName: string): Promise<number | null> => {
    const FETCH_TIMEOUT_MS = 3000;
    const requestUrl = `https://ping.${domainName}/`;

    let ping = null;
    const POLLS_NUMBER = 3;

    for (let i = 0; i < POLLS_NUMBER; i += 1) {
        const start = Date.now();
        try {
            // eslint-disable-next-line no-await-in-loop
            await fetchWithTimeout(requestUrl, FETCH_TIMEOUT_MS);
            const fetchPing = Date.now() - start;
            if (!ping || fetchPing < ping) {
                ping = fetchPing;
            }
        } catch (e) {
            log.error(`Was unable to get ping to ${requestUrl} due to ${e}`);
        }
    }

    return ping;
};

/**
 * Max simultaneous connections for determining ping
 */
const MAX_SIMULTANEOUS_CONNECTIONS = 10;

/**
 * Pool of available connections
 */
const connectionsPool: string[] = [];

/**
 * Determines ping to the endpoint using maximum of simultaneous connections
 * It checks if there is space in the pool and if there is, it creates new connection
 */
export const measurePingWithinLimits = async (
    domainName: string,
    maxConnections = MAX_SIMULTANEOUS_CONNECTIONS,
): Promise<number | null> => {
    if (connectionsPool.length >= maxConnections) {
        await sleep(10);
        return measurePingWithinLimits(domainName, maxConnections);
    }

    connectionsPool.push(domainName);
    const ping = await measurePingToEndpointViaFetch(domainName);
    connectionsPool.shift();

    return ping;
};
