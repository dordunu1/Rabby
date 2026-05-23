import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '@/ui/component';
import { MAINNET_CHAIN_ID } from '@/utils/zamaShield/constants';
import type { ZamaShieldChainId } from '@/utils/zamaShield/zamaShieldChain';
import {
  getZamaChainDisplayName,
  isZamaChainRegisteredInRabby,
} from '@/utils/zamaShield/zamaShieldChain';
import { ChainSwitcher, ShieldList } from './ShieldList';
import { ZamaSdkScope } from './ZamaSdkScope';
import { ZamaShieldNetworkHint } from './ZamaShieldNetworkHint';

/**
 * Shield page chain = in-page Ethereum / Sepolia tabs (same as legacy `Rabby/`).
 * Does not require Sepolia to be Rabby’s global “active” network — only that the
 * chain exists in Rabby (integrated mainnet or custom Sepolia).
 */
export const ZamaShield: React.FC = () => {
  const { t } = useTranslation();
  const [chain, setChain] = useState<ZamaShieldChainId>(MAINNET_CHAIN_ID);
  const chainRegistered = isZamaChainRegisteredInRabby(chain);

  return (
    <div className="min-h-full bg-r-neutral-bg2 flex flex-col">
      <PageHeader fixed canBack>
        <div className="flex flex-col items-center">
          <span className="text-r-neutral-title1 text-[16px] font-medium">
            {t('page.zamaShield.title', { defaultValue: 'Shield' })}
          </span>
          <span className="text-r-neutral-foot text-[11px]">
            {t('page.zamaShield.subtitle', {
              defaultValue: 'Confidential ERC-7984 by Zama',
            })}
          </span>
        </div>
      </PageHeader>

      <div className="px-[16px] pt-[8px] pb-[24px] flex flex-col gap-[12px]">
        <ChainSwitcher value={chain} onChange={setChain} />

        {!chainRegistered ? (
          <ZamaShieldNetworkHint
            chainId={chain}
            chainName={getZamaChainDisplayName(chain)}
          />
        ) : (
          <ZamaSdkScope key={chain} chainId={chain}>
            <ShieldList chainId={chain} layout="popup" />
          </ZamaSdkScope>
        )}
      </div>
    </div>
  );
};

export default ZamaShield;
