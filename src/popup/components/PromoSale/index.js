import React, { useContext } from 'react';
import { observer } from 'mobx-react';

import { reactTranslator } from '../../../reactCommon/reactTranslator';
import rootStore from '../../stores';
import './promo-sale.pcss';
import { PROMO_SCREEN_STATES } from '../../../lib/constants';

const PromoSale = observer(() => {
    const { vpnStore, settingsStore, uiStore } = useContext(rootStore);

    const upgradeClickHandler = async (e) => {
        e.preventDefault();
        settingsStore.setPremiumLocationClickedByFreeUser(false);
        uiStore.closeEndpointsSearch();
        await settingsStore.setSalePromoStatus(PROMO_SCREEN_STATES.DO_NOT_DISPLAY);
        await vpnStore.openPremiumPromoPage();
    };

    const hideSaleClickHandler = async () => {
        settingsStore.setPremiumLocationClickedByFreeUser(false);
        uiStore.closeEndpointsSearch();
        await settingsStore.setSalePromoStatus(PROMO_SCREEN_STATES.DO_NOT_DISPLAY);
    };

    const features = [
        { id: 1, text: 'upgrade_features_all_locations' },
        { id: 2, text: 'upgrade_features_data' },
        { id: 3, text: 'upgrade_features_speed' },
        { id: 4, text: 'upgrade_features_no_log' },
    ];

    return (
        <>
            <div className="promo-sale">
                <div className="promo-sale__content">
                    <div className="promo-sale__icon" />
                    <div className="promo-sale__price-label">
                        {reactTranslator.translate('settings_run_upgrade_early_bird')}
                    </div>
                    <div className="promo-sale__title">
                        {reactTranslator.translate('sale_title')}
                    </div>
                    <div className="promo-sale__features-list">
                        {features.map((item) => {
                            return (
                                <div className="promo-sale__features-item" key={item.id}>
                                    {reactTranslator.translate(item.text)}
                                </div>
                            );
                        })}
                    </div>
                </div>
                <div className="promo-sale__actions">
                    <a
                        className="button button--medium button--green promo-sale__button"
                        onClick={upgradeClickHandler}
                    >
                        {reactTranslator.translate('premium_upgrade')}
                    </a>
                    <a
                        className="promo-sale__continue-button"
                        onClick={hideSaleClickHandler}
                    >
                        {reactTranslator.translate('continue_us_free_button')}
                    </a>
                </div>
            </div>
        </>
    );
});

export default PromoSale;