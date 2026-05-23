import { findChain } from '@/utils/chain';
import {
  MAINNET_CHAIN_ID,
  SEPOLIA_CHAIN_ID,
  ZAMA_SUPPORTED_CHAIN_IDS,
} from './constants';

export type ZamaShieldChainId =
  | typeof MAINNET_CHAIN_ID
  | typeof SEPOLIA_CHAIN_ID;

export function isZamaSupportedChainId(
  chainId?: number | null
): chainId is ZamaShieldChainId {
  return (
    typeof chainId === 'number' && ZAMA_SUPPORTED_CHAIN_IDS.includes(chainId)
  );
}

/**
 * Whether Rabby knows this chain (integrated or custom testnet). Shield tabs use
 * numeric chain ids directly; txs only need `findChain({ id })` to succeed.
 */
export function isZamaChainRegisteredInRabby(
  chainId: ZamaShieldChainId
): boolean {
  return !!findChain({ id: chainId });
}

export function getZamaChainDisplayName(chainId: ZamaShieldChainId): string {
  return (
    findChain({ id: chainId })?.name ??
    (chainId === MAINNET_CHAIN_ID ? 'Ethereum' : 'Sepolia')
  );
}
