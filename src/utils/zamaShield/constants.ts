/** Zama fhEVM — supported chains and RPC defaults for on-chain reads. */

export const MAINNET_CHAIN_ID = 1;
export const SEPOLIA_CHAIN_ID = 11155111;

export const ZAMA_SUPPORTED_CHAIN_IDS: number[] = [
  MAINNET_CHAIN_ID,
  SEPOLIA_CHAIN_ID,
];

/** Default origin for `relayer-web-proxy` (see `createZamaRelayer.ts`). */
export const DEFAULT_RELAYER_WEB_ORIGIN = 'http://localhost:3001';

/** RelayerWeb bases when the proxy is on the default origin (append `/v2` in code). */
export const RELAYER_PROXY_SEPOLIA_BASE = `${DEFAULT_RELAYER_WEB_ORIGIN}/api/relayer/${SEPOLIA_CHAIN_ID}`;
export const RELAYER_PROXY_MAINNET_BASE = `${DEFAULT_RELAYER_WEB_ORIGIN}/api/relayer/${MAINNET_CHAIN_ID}`;

export const CONFIDENTIAL_ZERO_HANDLE: `0x${string}` = `0x${'0'.repeat(64)}`;
