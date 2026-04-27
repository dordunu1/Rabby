// Zama relayer REST — mirrors metamask-extension shared/lib/confidential-erc7984/constants.ts
// (same proxy URLs the user already deploys for Mainnet & Sepolia).

export const MAINNET_RELAYER_BASE_URL =
  'https://mainnet-relyer-proxy-production.up.railway.app';

export const SEPOLIA_RELAYER_BASE_URL =
  'https://sepolia-relayer-sdk-production.up.railway.app';

export const RELAYER_ENDPOINTS = {
  encryptAmount: '/api/encrypt-amount',
  publicDecrypt: '/api/public-decrypt',
  userDecryptPrepare: '/api/user-decrypt/prepare',
  userDecryptComplete: '/api/user-decrypt/complete',
} as const;

export const MAINNET_CHAIN_ID = 1;
export const SEPOLIA_CHAIN_ID = 11155111;

export const ZAMA_SUPPORTED_CHAIN_IDS: number[] = [
  MAINNET_CHAIN_ID,
  SEPOLIA_CHAIN_ID,
];

export function getRelayerBaseUrlForChainId(chainId: number): string {
  return chainId === SEPOLIA_CHAIN_ID
    ? SEPOLIA_RELAYER_BASE_URL
    : MAINNET_RELAYER_BASE_URL;
}

export const CONFIDENTIAL_ZERO_HANDLE: `0x${string}` = `0x${'0'.repeat(64)}`;
