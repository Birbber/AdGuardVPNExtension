import throttle from 'lodash/throttle';
import { notifier } from '../lib/notifier';
import { actions } from './actions';
import { exclusions } from './exclusions';
import { tabs } from './tabs';
import { isHttp } from '../lib/string-utils';
import auth from './auth';
import { locationsService } from './endpoints/locationsService';
import { isVPNConnected } from './connectivity/connectivityService/connectivityFSM';

class BrowserActionIcon {
    isVpnEnabledForUrl = (id, url) => {
        if (id && url && isHttp(url)) {
            return exclusions.isVpnEnabledByUrl(url);
        }
        if (!isHttp(url)) {
            // disable icon in tabs with no url only for selective mode
            return !exclusions.isInverted();
        }

        return true;
    };

    async updateIcon(tab) {
        const { id = null, url = null } = tab;

        const isUserAuthenticated = await auth.isAuthenticated(false);
        if (!isUserAuthenticated) {
            await actions.setIconDisabled(id);
            await actions.clearBadgeText(id);
            return;
        }

        if (!isVPNConnected()) {
            await actions.setIconDisabled(id);
            await actions.clearBadgeText(id);
            return;
        }

        if (!this.isVpnEnabledForUrl(id, url)) {
            await actions.setIconDisabled(id);
            await actions.clearBadgeText(id);
            return;
        }

        await actions.setIconEnabled(id);
        // Set badge text
        const selectedLocation = await locationsService.getSelectedLocation();
        const countryCode = selectedLocation?.countryCode;
        if (countryCode) {
            await actions.setBadgeText(id, countryCode);
        } else {
            await actions.clearBadgeText(id);
        }
    }

    init = () => {
        const throttleTimeoutMs = 100;
        const throttledUpdateIcon = throttle(async (tab) => {
            if (tab) {
                this.updateIcon(tab);
            } else {
                // get all active tabs, because tabs api sometimes doesn't return right active tab
                const activeTabs = await tabs.getActive();
                activeTabs.forEach((tab) => {
                    this.updateIcon(tab);
                });
            }
        }, throttleTimeoutMs, { leading: false });

        notifier.addSpecifiedListener(notifier.types.TAB_ACTIVATED, throttledUpdateIcon);
        notifier.addSpecifiedListener(notifier.types.TAB_UPDATED, throttledUpdateIcon);
        notifier.addSpecifiedListener(
            notifier.types.EXCLUSIONS_UPDATED_BACK_MESSAGE,
            throttledUpdateIcon,
        );
        notifier.addSpecifiedListener(
            notifier.types.UPDATE_BROWSER_ACTION_ICON,
            throttledUpdateIcon,
        );
        notifier.addSpecifiedListener(
            notifier.types.CONNECTIVITY_STATE_CHANGED,
            () => throttledUpdateIcon(),
        );

        // Run after init in order to update browser action icon state
        throttledUpdateIcon();
    };
}

export default new BrowserActionIcon();
