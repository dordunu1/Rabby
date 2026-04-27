import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '@/ui/component';
import {
  MAINNET_CHAIN_ID,
  SEPOLIA_CHAIN_ID,
} from '@/utils/zamaShield/constants';
import { ChainSwitcher, ShieldList } from './ShieldList';

type ChainTab = typeof MAINNET_CHAIN_ID | typeof SEPOLIA_CHAIN_ID;

export const ZamaShield: React.FC = () => {
  const { t } = useTranslation();
  const [chain, setChain] = useState<ChainTab>(MAINNET_CHAIN_ID);

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
        <ShieldList chainId={chain} layout="popup" />
      </div>
    </div>
  );
};

export default ZamaShield;
