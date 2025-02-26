import { createMachine, interpret, assign } from 'xstate';
import { notifier } from '../../../lib/notifier';
import { STATE, EVENT } from './connectivityConstants';
import { log } from '../../../lib/logger';
// eslint-disable-next-line import/no-cycle
import { switcher } from '../switcher';

const MIN_RECONNECTION_DELAY_MS = 1000; // 1 second
const MAX_RECONNECTION_DELAY_MS = 1000 * 60 * 3; // 3 minutes
const RECONNECTION_DELAY_GROW_FACTOR = 1.3;
const RETRY_CONNECTION_TIME_MS = 70000; // 70 seconds

const actions = {
    turnOnProxy: async () => {
        try {
            await switcher.turnOn();
        } catch (e) {
            log.debug(e);
        }
    },
    turnOffProxy: async () => {
        try {
            await switcher.turnOff();
        } catch (e) {
            log.debug(e);
        }
    },
    /**
     * After 70 seconds of fruitless reconnection attempts to previously selected endpoint we
     *      1. re-fetch tokens, vpn info and locations list from the backend
     *      2. choose endpoint once again (it's possible that the one that previously failed
     *          is already excluded from the list)
     *      3. retrying connection attempts (probably to another endpoint)

     * Why 70 seconds:
     * There are 2 possible kinds of failures:
     *      1. short term (OOM & restart, deployment of a new version)
     *      2. long term (server dead or brought down intentionally)
     * We don't want our users rambling between endpoints and overloading them when (1) occurs,
     * so we bring in 70 seconds threshold after which we treat the unavailability as (2)
     * and try find another one (backend probably has alternatives in this case).
     */
    retryConnection: async (context) => {
        if (context.timeSinceLastRetryWithRefreshMs > RETRY_CONNECTION_TIME_MS) {
            // eslint-disable-next-line no-param-reassign
            context.timeSinceLastRetryWithRefreshMs = 0;
            // retry to connect after tokens, VPN info and locations refresh
            await switcher.retryTurnOn(true);
        } else {
            // Retries to connect to ws without cache refresh
            await switcher.retryTurnOn();
        }
    },

    setDesktopVpnEnabled: assign((_ctx, event) => ({
        desktopVpnEnabled: event.data,
    })),
};

/**
 * Resets context information
 * Description of every property could be found in the context section description
 */
const resetOnSuccessfulConnection = assign({
    currentReconnectionDelayMs: MIN_RECONNECTION_DELAY_MS,
    retryCount: 0,
    retriedConnectToOtherEndpoint: false,
    timeSinceLastRetryWithRefreshMs: 0,
    desktopVpnEnabled: false,
});

/**
 * Action, which increments count of connection retries and time passed since first retry
 */
const incrementRetryCount = assign({
    retryCount: (context) => {
        return context.retryCount + 1;
    },
    timeSinceLastRetryWithRefreshMs: (context) => {
        return context.timeSinceLastRetryWithRefreshMs + context.currentReconnectionDelayMs;
    },
});

/**
 * Action, which increases delay between reconnection
 */
const incrementDelay = assign({
    currentReconnectionDelayMs: (context) => {
        let delayMs = context.currentReconnectionDelayMs * RECONNECTION_DELAY_GROW_FACTOR;
        if (delayMs > MAX_RECONNECTION_DELAY_MS) {
            delayMs = MAX_RECONNECTION_DELAY_MS;
        }
        return delayMs;
    },
});

const delays = {
    RETRY_DELAY: (context) => {
        return context.currentReconnectionDelayMs;
    },
};

/**
 * Finite state machine used to manage websocket connectivity states
 * Transitions react only to the described events, all other events are ignored
 */
const connectivityFSM = createMachine({
    id: 'connectivity',
    context: {
        /**
         * Count of connections retries
         */
        retryCount: 0,
        /**
         * Time in ms passed since last retry with tokens and locations list refresh
         */
        timeSinceLastRetryWithRefreshMs: 0,
        /**
         * Property used to keep growing delay between reconnections
         */
        currentReconnectionDelayMs: MIN_RECONNECTION_DELAY_MS,
        /**
         * Flag used to reconnect to another endpoint of current location
         */
        retriedConnectToOtherEndpoint: false,
        /**
         * Flag used to keep actual desktop vpn connection status
         */
        desktopVpnEnabled: false,

    },
    initial: STATE.DISCONNECTED_IDLE,
    states: {
        [STATE.DISCONNECTED_IDLE]: {
            entry: ['turnOffProxy'],
            on: {
                [EVENT.CONNECT_BTN_PRESSED]: STATE.CONNECTING_IDLE,
                [EVENT.EXTENSION_LAUNCHED]: STATE.CONNECTING_IDLE,
                [EVENT.DESKTOP_VPN_ENABLED]: {
                    actions: ['setDesktopVpnEnabled'],
                },
            },
        },
        [STATE.DISCONNECTED_RETRYING]: {
            on: {
                [EVENT.CONNECT_BTN_PRESSED]: STATE.CONNECTING_RETRYING,
                [EVENT.NETWORK_ONLINE]: STATE.CONNECTING_RETRYING,
                // this event can occur when user signs out,
                // so we have to stop trying to connect to WS
                [EVENT.DISCONNECT_BTN_PRESSED]: STATE.DISCONNECTED_IDLE,
                // this event fires when user has too many devises connected
                [EVENT.TOO_MANY_DEVICES_CONNECTED]: STATE.DISCONNECTED_IDLE,
                // if vpn enabled in desktop app
                [EVENT.DESKTOP_VPN_ENABLED]: {
                    target: STATE.DISCONNECTED_IDLE,
                    actions: ['setDesktopVpnEnabled'],
                },
            },
            after: {
                RETRY_DELAY: STATE.CONNECTING_RETRYING,
            },
            entry: [incrementDelay],
        },
        [STATE.CONNECTING_IDLE]: {
            entry: ['turnOnProxy'],
            on: {
                [EVENT.CONNECTION_SUCCESS]: STATE.CONNECTED,
                [EVENT.CONNECTION_FAIL]: STATE.DISCONNECTED_RETRYING,
                // If ws connection didn't get handshake response
                [EVENT.WS_CLOSE]: STATE.DISCONNECTED_RETRYING,
                [EVENT.WS_ERROR]: STATE.DISCONNECTED_RETRYING,
                [EVENT.PROXY_CONNECTION_ERROR]: STATE.DISCONNECTED_IDLE,
                // if user decided to connect to another location
                [EVENT.DISCONNECT_BTN_PRESSED]: STATE.DISCONNECTED_IDLE,
                // if user has too many devises connected
                [EVENT.TOO_MANY_DEVICES_CONNECTED]: STATE.DISCONNECTED_IDLE,
                // if vpn enabled in desktop app
                [EVENT.DESKTOP_VPN_ENABLED]: {
                    target: STATE.DISCONNECTED_IDLE,
                    actions: ['setDesktopVpnEnabled'],
                },
            },
        },
        [STATE.CONNECTING_RETRYING]: {
            entry: [incrementRetryCount, 'retryConnection'],
            on: {
                [EVENT.CONNECTION_SUCCESS]: STATE.CONNECTED,
                [EVENT.CONNECTION_FAIL]: STATE.DISCONNECTED_RETRYING,
                [EVENT.WS_CLOSE]: STATE.DISCONNECTED_RETRYING,
                [EVENT.WS_ERROR]: STATE.DISCONNECTED_RETRYING,
                [EVENT.PROXY_CONNECTION_ERROR]: STATE.DISCONNECTED_IDLE,
                // if user decided to connect to another location
                [EVENT.DISCONNECT_BTN_PRESSED]: STATE.DISCONNECTED_IDLE,
                // this event fires when user has too many devises connected
                [EVENT.TOO_MANY_DEVICES_CONNECTED]: STATE.DISCONNECTED_IDLE,
                // if vpn enabled in desktop app
                [EVENT.DESKTOP_VPN_ENABLED]: {
                    target: STATE.DISCONNECTED_IDLE,
                    actions: ['setDesktopVpnEnabled'],
                },
            },
        },
        [STATE.CONNECTED]: {
            on: {
                [EVENT.WS_ERROR]: STATE.DISCONNECTED_RETRYING,
                [EVENT.WS_CLOSE]: STATE.DISCONNECTED_RETRYING,
                [EVENT.DISCONNECT_BTN_PRESSED]: STATE.DISCONNECTED_IDLE,
                // this event fires when user has too many devises connected
                [EVENT.TOO_MANY_DEVICES_CONNECTED]: STATE.DISCONNECTED_IDLE,
                // if vpn enabled in desktop app
                [EVENT.DESKTOP_VPN_ENABLED]: {
                    target: STATE.DISCONNECTED_IDLE,
                    actions: ['setDesktopVpnEnabled'],
                },
            },
            entry: [resetOnSuccessfulConnection],
        },
    },
}, { actions, delays });

export const connectivityService = interpret(connectivityFSM)
    .start()
    .onEvent((event) => {
        log.debug(event);
        if (event.type === EVENT.DESKTOP_VPN_ENABLED) {
            notifier.notifyListeners(
                notifier.types.CONNECTIVITY_DESKTOP_VPN_STATUS_CHANGED,
                event.data,
            );
        }
    })
    .onTransition((state) => {
        log.debug({ currentState: state.value });
        notifier.notifyListeners(notifier.types.CONNECTIVITY_STATE_CHANGED, { value: state.value });
    });

connectivityService.start();

export const isVPNConnected = () => {
    return connectivityService.getSnapshot().matches(STATE.CONNECTED);
};

export const isVPNDisconnectedIdle = () => {
    return connectivityService.getSnapshot().matches(STATE.DISCONNECTED_IDLE);
};

export const setDesktopVpnEnabled = (data) => {
    connectivityService.send(EVENT.DESKTOP_VPN_ENABLED, { data });
};
