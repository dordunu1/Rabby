import { createPublicClient, http, PublicClient } from 'viem';
import { mainnet, sepolia } from 'viem/chains';
import { MAINNET_CHAIN_ID, SEPOLIA_CHAIN_ID } from './constants';

const MAINNET_RPC =
  (process.env.ZAMA_MAINNET_RPC as string | undefined) ||
  'https://ethereum-rpc.publicnode.com';
const SEPOLIA_RPC =
  (process.env.ZAMA_SEPOLIA_RPC as string | undefined) ||
  'https://ethereum-sepolia-rpc.publicnode.com';

const clients = new Map<number, PublicClient>();

export function getReadClient(chainId: number): PublicClient {
  const cached = clients.get(chainId);
  if (cached) return cached;
  let client: PublicClient;
  if (chainId === SEPOLIA_CHAIN_ID) {
    client = createPublicClient({
      chain: sepolia,
      transport: http(SEPOLIA_RPC, { retryCount: 3, timeout: 12_000 }),
    });
  } else if (chainId === MAINNET_CHAIN_ID) {
    client = createPublicClient({
      chain: mainnet,
      transport: http(MAINNET_RPC, { retryCount: 3, timeout: 12_000 }),
    });
  } else {
    throw new Error(`unsupported chainId for Zama Shield: ${chainId}`);
  }
  clients.set(chainId, client);
  return client;
}
