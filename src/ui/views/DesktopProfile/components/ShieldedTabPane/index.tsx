import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useHistory } from 'react-router-dom';
import { Button } from 'antd';
import {
  MAINNET_CHAIN_ID,
  SEPOLIA_CHAIN_ID,
  ZAMA_SUPPORTED_CHAIN_IDS,
} from '@/utils/zamaShield/constants';
import { ChainSwitcher, ShieldList } from '@/ui/views/ZamaShield/ShieldList';

type ChainTab = typeof MAINNET_CHAIN_ID | typeof SEPOLIA_CHAIN_ID;

type Props = {
  // Numeric chain id from the desktop chain selector (`chainInfo.id`). When
  // the user picks a non-Zama chain we fall back to letting them switch
  // between the two supported networks via an inline tab bar.
  selectChainId?: number;
};

// "Shielded" tab inside the expanded-account (open-tab) profile view. It
// exposes the same Wrap / Unwrap / Send / Decrypt activities that live in
// the popup `/zama-shield` route, so power users can do everything from the
// full-tab UI without bouncing back into the popup.
export const ShieldedTabPane: React.FC<Props> = ({ selectChainId }) => {
  const { t } = useTranslation();
  const history = useHistory();

  const externalSupported = useMemo(
    () =>
      typeof selectChainId === 'number' &&
      ZAMA_SUPPORTED_CHAIN_IDS.includes(selectChainId),
    [selectChainId]
  );

  const [internalChain, setInternalChain] = useState<ChainTab>(
    MAINNET_CHAIN_ID
  );

  useEffect(() => {
    if (
      typeof selectChainId === 'number' &&
      ZAMA_SUPPORTED_CHAIN_IDS.includes(selectChainId) &&
      selectChainId !== internalChain
    ) {
      setInternalChain(selectChainId as ChainTab);
    }
  }, [selectChainId, internalChain]);

  const activeChain: ChainTab = externalSupported
    ? (selectChainId as ChainTab)
    : internalChain;

  return (
    <div className="px-[16px] py-[16px] max-w-[520px] w-full mx-auto box-border">
      <div className="flex items-center justify-between mb-[12px] gap-[12px] flex-wrap">
        <div className="flex flex-col">
          <span className="text-r-neutral-title1 text-[16px] font-medium">
            {t('page.zamaShield.tabTitle', {
              defaultValue: 'Shielded balances',
            })}
          </span>
          <span className="text-r-neutral-foot text-[12px] mt-[2px]">
            {t('page.zamaShield.subtitle', {
              defaultValue: 'Confidential ERC-7984 by Zama',
            })}
          </span>
        </div>
        <Button
          type="primary"
          ghost
          size="small"
          onClick={() => history.push('/zama-shield')}
        >
          {t('page.zamaShield.openPopup', {
            defaultValue: 'Open in popup',
          })}
        </Button>
      </div>

      {!externalSupported && (
        <div className="mb-[12px]">
          <ChainSwitcher
            value={internalChain}
            onChange={(c) => setInternalChain(c)}
          />
        </div>
      )}

      <ShieldList chainId={activeChain} layout="desktop" />
    </div>
  );
};

export default ShieldedTabPane;
