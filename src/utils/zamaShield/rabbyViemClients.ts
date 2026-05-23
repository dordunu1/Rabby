export type RabbyWalletBridge = {
  sendRequest: <T = unknown>(args: {
    method: string;
    params?: unknown;
  }) => Promise<T>;
};
import type { EIP1193Provider, Hex, PublicClient, WalletClient } from 'viem';
import { createWalletClient, custom, toHex } from 'viem';
import { mainnet, sepolia } from 'viem/chains';
import { MAINNET_CHAIN_ID } from './constants';
import type { ZamaShieldChainId } from './zamaShieldChain';

/** Viem `chain` for the Shield tab (Ethereum mainnet or Sepolia). */
export function getViemChainForShieldTab(chainId: ZamaShieldChainId) {
  return chainId === MAINNET_CHAIN_ID ? mainnet : sepolia;
}

function injectShieldChainIdOnTx(
  tx: Record<string, unknown>,
  chainId: number
): Record<string, unknown> {
  return {
    ...tx,
    chainId,
  };
}

/**
 * EIP-1193 provider for `ViemSigner`. Reports the Shield tab’s chain id so Zama
 * encryption / EIP-712 use Sepolia when the Sepolia tab is selected — not Rabby’s
 * global “active” network (often mainnet).
 */
export function createRabbyEip1193Provider(
  wallet: RabbyWalletBridge,
  chainId: number
): EIP1193Provider {
  const chainIdHex = toHex(chainId);

  return {
    request: async (args) => {
      const method = args.method;
      if (method === 'eth_chainId') {
        return chainIdHex;
      }
      if (method === 'net_version') {
        return String(chainId);
      }

      let params = args.params;
      if (
        method === 'eth_sendTransaction' &&
        Array.isArray(params) &&
        params[0] &&
        typeof params[0] === 'object'
      ) {
        params = [
          injectShieldChainIdOnTx(
            params[0] as Record<string, unknown>,
            chainId
          ),
        ];
      }

      return wallet.sendRequest({
        method,
        params,
      });
    },
    on: () => undefined,
    removeListener: () => undefined,
  } as EIP1193Provider;
}

/** Rabby `wallet.sendRequest` as a viem transport for `ViemSigner`. */
export function createRabbyWalletClient(
  wallet: RabbyWalletBridge,
  address: Hex,
  chainId: ZamaShieldChainId
): WalletClient {
  const chain = getViemChainForShieldTab(chainId);
  return createWalletClient({
    account: { address, type: 'json-rpc' },
    chain,
    transport: custom({
      async request({ method, params }) {
        const args = [...((params ?? []) as unknown[])];
        if (
          method === 'eth_sendTransaction' &&
          args[0] &&
          typeof args[0] === 'object' &&
          args[0] !== null
        ) {
          args[0] = injectShieldChainIdOnTx(
            args[0] as Record<string, unknown>,
            chainId
          );
        }
        if (method === 'eth_chainId') {
          return toHex(chainId);
        }
        return wallet.sendRequest({
          method,
          params: args,
        });
      },
    }),
  });
}

/**
 * EIP-1193 provider for `ViemSigner` (`ethereum` option).
 * Always scoped to the Shield tab chain id.
 */
export function getEthereumProvider(
  wallet: RabbyWalletBridge,
  chainId: ZamaShieldChainId
): EIP1193Provider {
  return createRabbyEip1193Provider(wallet, chainId);
}

export function createRabbyViemSignerPair(
  wallet: RabbyWalletBridge,
  address: Hex,
  chainId: ZamaShieldChainId,
  publicClient: PublicClient
): { walletClient: WalletClient; publicClient: PublicClient } {
  const walletClient = createRabbyWalletClient(wallet, address, chainId);
  return { walletClient, publicClient };
}
