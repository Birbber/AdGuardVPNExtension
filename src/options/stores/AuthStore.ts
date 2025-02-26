import {
    action,
    observable,
    runInAction,
} from 'mobx';

import type { RootStore } from './RootStore';
import { messenger } from '../../lib/messenger';
import { RequestStatus } from './consts';

export class AuthStore {
    @observable authenticated = false;

    @observable requestProcessState = RequestStatus.Done;

    @observable maxDevicesCount = 0;

    private rootStore: RootStore;

    constructor(rootStore: RootStore) {
        this.rootStore = rootStore;
    }

    @action setIsAuthenticated = (value: boolean) => {
        this.authenticated = value;
    };

    @action deauthenticate = async () => {
        await messenger.deauthenticateUser();
        await this.rootStore.settingsStore.disableProxy();
        runInAction(() => {
            this.authenticated = false;
        });
    };

    @action setMaxDevicesCount = (value: number) => {
        this.maxDevicesCount = value;
    };
}
