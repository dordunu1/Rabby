import type { ConfidentialTokenDefinition } from './registry';

/**
 * Origin of your deployed `relayer-web-proxy` (no trailing slash).
 * Set `ZAMA_RELAYER_WEB_ORIGIN` at build time, or run the proxy locally on :3001.
 *
 * @see Cusdt/relayer-web-proxy — same stack as Confidential-safe `createZamaRelayer.ts`
 */
export function getZamaRelayerWebOrigin(): string {
  const fromEnv =
    typeof process !== 'undefined' &&
    typeof process.env?.ZAMA_RELAYER_WEB_ORIGIN === 'string'
      ? process.env.ZAMA_RELAYER_WEB_ORIGIN.trim()
      : '';
  if (fromEnv) return fromEnv.replace(/\/+$/, '');
  return 'http://localhost:3001';
}

/** Config object expected by `@zama-fhe/react-sdk` shield / unshield / transfer hooks. */
export function zamaShieldConfigFor(token: ConfidentialTokenDefinition) {
  return {
    tokenAddress: token.address,
    wrapperAddress: token.address,
  };
}
