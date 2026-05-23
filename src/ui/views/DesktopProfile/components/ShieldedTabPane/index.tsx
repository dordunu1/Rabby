import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useHistory } from 'react-router-dom';
import { Button } from 'antd';
import { MAINNET_CHAIN_ID } from '@/utils/zamaShield/constants';
import type { ZamaShieldChainId } from '@/utils/zamaShield/zamaShieldChain';
import {
  getZamaChainDisplayName,
  isZamaChainRegisteredInRabby,
} from '@/utils/zamaShield/zamaShieldChain';
import { ChainSwitcher, ShieldList } from '@/ui/views/ZamaShield/ShieldList';
import { ZamaSdkScope } from '@/ui/views/ZamaShield/ZamaSdkScope';
import { ZamaShieldNetworkHint } from '@/ui/views/ZamaShield/ZamaShieldNetworkHint';

export const ShieldedTabPane: React.FC = () => {
  const { t } = useTranslation();
  const history = useHistory();
  const [chain, setChain] = useState<ZamaShieldChainId>(MAINNET_CHAIN_ID);
  const chainRegistered = isZamaChainRegisteredInRabby(chain);

  return (
    <div className="px-[16px] py-[16px] max-w-[520px] w-full mx-auto box-border">
      <div className="flex items-center justify-between mb-[12px] gap-[12px] flex-wrap">
        <div className="flex flex-col min-w-0 flex-1">
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

      <div className="flex flex-col gap-[12px]">
        <ChainSwitcher value={chain} onChange={setChain} />

        {!chainRegistered ? (
          <ZamaShieldNetworkHint
            chainId={chain}
            chainName={getZamaChainDisplayName(chain)}
          />
        ) : (
          <ZamaSdkScope key={chain} chainId={chain}>
            <ShieldList chainId={chain} layout="desktop" />
          </ZamaSdkScope>
        )}
      </div>
    </div>
  );
};

export default ShieldedTabPane;
