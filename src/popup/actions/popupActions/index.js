import { tabs } from '../../../background/tabs';
import { messenger } from '../../../lib/messenger';

class PopupActions {
    openRecovery = async () => {
        await tabs.openRecovery();
        window.close();
    };

    openTab = async (url) => {
        await tabs.openTab(url);
        window.close();
    };

    openVpnFailurePage = async () => {
        const vpnFailurePage = await messenger.getVpnFailurePage();
        await this.openTab(vpnFailurePage);
    };

    openFreeGbsPage = async () => {
        await messenger.openFreeGbsPage();
        window.close();
    };
}

export const popupActions = new PopupActions();
