import browser from 'webextension-polyfill';

const asyncProvideBg = func => async (...args) => {
    const { background } = await browser.runtime.getBackgroundPage();
    return func(...args, background);
};

const wrapMethods = (obj, wrapper) => {
    Object.keys(obj).forEach((key) => {
        const property = obj[key];
        if (typeof property === 'function') {
            // eslint-disable-next-line no-param-reassign
            obj[key] = wrapper(property);
        }
    });
    return obj;
};

const provider = {
    getEndpoints: background => background.provider.getEndpoints(),
    getStats: background => background.provider.getStats(),
};

const settings = {
    getSetting: (id, background) => background.settings.getSetting(id),
    setSetting: (id, value, background) => background.settings.setSetting(id, value),
};

const proxy = {
    canControlProxy: background => background.proxy.canControlProxy(),
    setCurrentEndpoint: (endpoint, background) => background.proxy.setCurrentEndpoint(endpoint),
    getCurrentEndpoint: background => background.proxy.getCurrentEndpoint(),
};

const whitelist = {
    addToWhitelist: (url, background) => background.whitelist.addToWhitelist(url),
    removeFromWhitelist: (url, background) => background.whitelist.removeFromWhitelist(url),
    isWhitelisted: (url, background) => background.whitelist.isWhitelisted(url),
};

const tabs = {
    getCurrentTabUrl: background => background.tabs.getCurrentTabUrl(),
    closePopup: background => background.tabs.closePopup(),
    openRecovery: background => background.tabs.openRecovery(),
};

const auth = {
    authenticate: (credentials, background) => background.auth.authenticate(credentials),
    authenticateSocial: (querystring, background) => background.auth.authenticateSocial(),
    isAuthenticated: background => background.auth.isAuthenticated(),
    deauthenticate: background => background.auth.deauthenticate(),
    // eslint-disable-next-line max-len
    startSocialAuth: (socialProvider, background) => background.auth.startSocialAuth(socialProvider),
    register: (socialProvider, background) => background.auth.register(socialProvider),
};

const actions = {
    openOptionsPage: background => background.actions.openOptionsPage(),
};

const stats = {
    setPingCallback: (pingCallback, background) => background.stats.setPingCallback(pingCallback),
};

const bgProvider = {
    provider: wrapMethods(provider, asyncProvideBg),
    settings: wrapMethods(settings, asyncProvideBg),
    proxy: wrapMethods(proxy, asyncProvideBg),
    whitelist: wrapMethods(whitelist, asyncProvideBg),
    tabs: wrapMethods(tabs, asyncProvideBg),
    actions: wrapMethods(actions, asyncProvideBg),
    auth: wrapMethods(auth, asyncProvideBg),
    stats: wrapMethods(stats, asyncProvideBg),
};

export default bgProvider;
