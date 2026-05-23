import React from 'react';
import { useTranslation } from 'react-i18next';
import { SEPOLIA_CHAIN_ID } from '@/utils/zamaShield/constants';
import type { ZamaShieldChainId } from '@/utils/zamaShield/zamaShieldChain';

type Props = {
  chainId: ZamaShieldChainId;
  chainName: string;
};

/**
 * Shown when the user picks a Shield tab (e.g. Sepolia) but that chain is not
 * registered in Rabby yet (integrated or custom testnet).
 */
export const ZamaShieldNetworkHint: React.FC<Props> = ({
  chainId,
  chainName,
}) => {
  const { t } = useTranslation();
  const isSepolia = chainId === SEPOLIA_CHAIN_ID;

  return (
    <div className="text-center text-r-neutral-foot text-[13px] py-[32px] px-[12px]">
      {isSepolia
        ? t('page.zamaShield.sepoliaNotInWallet', {
            defaultValue:
              '{{name}} is not in Rabby yet. Add Sepolia under Settings → Custom networks, then switch back to the Sepolia tab here.',
            name: chainName,
          })
        : t('page.zamaShield.chainNotInWallet', {
            defaultValue:
              '{{name}} is not available in Rabby. Check your network list and try again.',
            name: chainName,
          })}
    </div>
  );
};

export default ZamaShieldNetworkHint;
