import { SettingsService } from './SettingsService';
import { browserApi } from '../browserApi';
import { log } from '../../lib/logger';
import { notifier } from '../../lib/notifier';
import { SETTINGS_IDS, APPEARANCE_THEME_DEFAULT } from '../../lib/constants';
import { dns } from '../dns';
import { DEFAULT_DNS_SERVER } from '../dns/dnsConstants';
import webrtc from '../browserApi/webrtc';
import { connectivityService } from '../connectivity/connectivityService/connectivityFSM';
import { EVENT } from '../connectivity/connectivityService/connectivityConstants';

const DEFAULT_SETTINGS = {
    [SETTINGS_IDS.PROXY_ENABLED]: false,
    [SETTINGS_IDS.RATE_SHOW]: true,
    [SETTINGS_IDS.PREMIUM_FEATURES_SHOW]: true,
    [SETTINGS_IDS.EXCLUSIONS]: {},
    [SETTINGS_IDS.HANDLE_WEBRTC_ENABLED]: true,
    [SETTINGS_IDS.SELECTED_DNS_SERVER]: DEFAULT_DNS_SERVER.id,
    [SETTINGS_IDS.CONTEXT_MENU_ENABLED]: true,
    [SETTINGS_IDS.POLICY_AGREEMENT]: false,
    [SETTINGS_IDS.HELP_US_IMPROVE]: false,
    [SETTINGS_IDS.APPEARANCE_THEME]: APPEARANCE_THEME_DEFAULT,
    [SETTINGS_IDS.CUSTOM_DNS_SERVERS]: [],
};

const settingsService = new SettingsService(browserApi.storage, DEFAULT_SETTINGS);

/**
 * Returns proxy settings enabled status
 * @returns {boolean}
 */
const isProxyEnabled = () => {
    const setting = settingsService.getSetting(SETTINGS_IDS.PROXY_ENABLED);
    return setting === true;
};

const setSetting = async (id, value, force) => {
    const setting = settingsService.getSetting(id);

    // No need to change same value unless is not force set
    if (setting === value && !force) {
        return false;
    }

    switch (id) {
        case SETTINGS_IDS.HANDLE_WEBRTC_ENABLED: {
            webrtc.setWebRTCHandlingAllowed(value, isProxyEnabled());
            break;
        }
        case SETTINGS_IDS.SELECTED_DNS_SERVER: {
            dns.setDnsServer(value);
            break;
        }
        default: {
            break;
        }
    }

    notifier.notifyListeners(notifier.types.SETTING_UPDATED, id, value);
    settingsService.setSetting(id, value);
    log.debug(`Setting with id: "${id}" was set to:`, value);
    return true;
};

const disableProxy = async (force) => {
    const shouldApply = await setSetting(SETTINGS_IDS.PROXY_ENABLED, false, force);

    if (!shouldApply) {
        return;
    }

    connectivityService.send(EVENT.DISCONNECT_BTN_PRESSED);
};

const enableProxy = async (force) => {
    const shouldApply = await setSetting(SETTINGS_IDS.PROXY_ENABLED, true, force);

    if (!shouldApply) {
        return;
    }

    connectivityService.send(EVENT.CONNECT_BTN_PRESSED);
};

/**
 * Checks if setting is enabled
 * @param settingId
 * @returns {boolean}
 */
const isSettingEnabled = (settingId) => {
    const enabledSettingValue = true;
    const settingValue = settingsService.getSetting(settingId);
    return settingValue === enabledSettingValue;
};

const applySettings = () => {
    const proxyEnabled = isProxyEnabled();

    // Set WebRTC
    webrtc.setWebRTCHandlingAllowed(
        isSettingEnabled(SETTINGS_IDS.HANDLE_WEBRTC_ENABLED),
        proxyEnabled,
    );

    // Set DNS server
    dns.setDnsServer(settingsService.getSetting(SETTINGS_IDS.SELECTED_DNS_SERVER));

    // Connect proxy
    if (proxyEnabled) {
        connectivityService.send(EVENT.EXTENSION_LAUNCHED);
    }

    log.info('Settings were applied');
};

const getSetting = (id) => {
    return settingsService.getSetting(id);
};

const getExclusions = () => {
    return settingsService.getSetting(SETTINGS_IDS.EXCLUSIONS) || {};
};

const setExclusions = (exclusions) => {
    settingsService.setSetting(SETTINGS_IDS.EXCLUSIONS, exclusions);
};

const isContextMenuEnabled = () => {
    return settingsService.getSetting(SETTINGS_IDS.CONTEXT_MENU_ENABLED);
};

const getCustomDnsServers = () => {
    return settingsService.getSetting(SETTINGS_IDS.CUSTOM_DNS_SERVERS);
};

const setCustomDnsServers = (dnsServersData) => {
    return settingsService.setSetting(SETTINGS_IDS.CUSTOM_DNS_SERVERS, dnsServersData);
};

const getSelectedDnsServer = () => {
    return settingsService.getSetting(SETTINGS_IDS.SELECTED_DNS_SERVER);
};

const init = async () => {
    await settingsService.init();
    dns.init();
    log.info('Settings module is ready');
};

export const settings = {
    init,
    getSetting,
    setSetting,
    disableProxy,
    enableProxy,
    isProxyEnabled,
    SETTINGS_IDS,
    settingsService,
    applySettings,
    getExclusions,
    setExclusions,
    isContextMenuEnabled,
    getCustomDnsServers,
    setCustomDnsServers,
    getSelectedDnsServer,
};
