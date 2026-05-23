import {
  MainnetConfig,
  RelayerWeb,
  SepoliaConfig,
} from '@/utils/zamaShield/zamaImports';
import { getZamaRelayerWebOrigin } from './zamaShieldConfig';
import { MAINNET_RPC, SEPOLIA_RPC } from './rpc';

function relayOrigin(): string {
  return getZamaRelayerWebOrigin();
}

function normalizeRelayerWebHttpBase(raw: string): string {
  const trimmed = raw.trim().replace(/\/+$/, '');
  if (!trimmed) return trimmed;
  if (trimmed.endsWith('/v2')) return trimmed;
  return `${trimmed}/v2`;
}

/** Zama-compatible HTTP API base for `RelayerWeb` via `relayer-web-proxy`. */
function relayerWebBaseForChainId(chainId: number): string {
  const root = `${relayOrigin()}/api/relayer/${chainId}`;
  return normalizeRelayerWebHttpBase(root);
}

/** `RelayerWeb` + per-chain `/v2` transports (Zama SDK 3.x). */
export function createZamaRelayer(getChainId: () => number | Promise<number>) {
  return new RelayerWeb({
    getChainId: () => Promise.resolve(getChainId()),
    // MV3: no COOP/COEP — force single-threaded WASM (avoids /workerHelpers.js rayon pool).
    threads: 1,
    // MV3 cannot load https://cdn.zama.org in script-src; UMD is bundled under _raw/zama-fhe/.
    security: { integrityCheck: false },
    transports: {
      [SepoliaConfig.chainId]: {
        ...SepoliaConfig,
        relayerUrl: relayerWebBaseForChainId(SepoliaConfig.chainId),
        network: SEPOLIA_RPC,
      },
      [MainnetConfig.chainId]: {
        ...MainnetConfig,
        relayerUrl: relayerWebBaseForChainId(MainnetConfig.chainId),
        network: MAINNET_RPC,
      },
    },
  });
}
