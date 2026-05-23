import type { ReactNode } from 'react';
import React, { useMemo } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  ZamaProvider,
  IndexedDBStorage,
  indexedDBStorage,
  ViemSigner,
} from '@/utils/zamaShield/zamaImports';
import { useWallet } from '@/ui/utils';
import { useCurrentAccount } from '@/ui/hooks/backgroundState/useAccount';
import { createZamaRelayer } from '@/utils/zamaShield/createZamaRelayer';
import { checksumAddress } from '@/utils/zamaShield/checksumAddress';
import { getReadClient } from '@/utils/zamaShield/rpc';
import {
  createRabbyViemSignerPair,
  getEthereumProvider,
} from '@/utils/zamaShield/rabbyViemClients';
import type { ZamaShieldChainId } from '@/utils/zamaShield/zamaShieldChain';

/** Match Confidential-safe: session TTL must not exceed keypair TTL (SDK rejects stale keypairs). */
const ZAMA_KEYPAIR_TTL_SEC = 86_400;
const ZAMA_SESSION_TTL_SEC = ZAMA_KEYPAIR_TTL_SEC;

const zamaWalletSessionStorage =
  typeof indexedDB !== 'undefined'
    ? new IndexedDBStorage('zama-fhe-wallet-session-rabby', 1, 'session')
    : indexedDBStorage;

let sharedQueryClient: QueryClient | null = null;

function getQueryClient() {
  if (!sharedQueryClient) {
    sharedQueryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: 1, refetchOnWindowFocus: false },
      },
    });
  }
  return sharedQueryClient;
}

type Props = {
  chainId: ZamaShieldChainId;
  children: ReactNode;
};

/**
 * ZamaProvider + RelayerWeb + ViemSigner + react-sdk hooks.
 * `chainId` comes from the Shield page’s Ethereum / Sepolia tab (not Rabby’s global network).
 */
export const ZamaSdkScope: React.FC<Props> = ({ chainId, children }) => {
  const wallet = useWallet();
  const account = useCurrentAccount();
  const queryClient = useMemo(() => getQueryClient(), []);

  const init = useMemo(() => {
    const addr = account?.address;
    if (!addr) {
      return {
        signer: null as InstanceType<typeof ViemSigner> | null,
        relayer: null as ReturnType<typeof createZamaRelayer> | null,
        error: null as string | null,
      };
    }
    try {
      const publicClient = getReadClient(chainId);
      const bridge = {
        sendRequest: <T,>(args: { method: string; params?: unknown }) =>
          wallet.sendRequest(args, {
            account: account ?? undefined,
          }) as Promise<T>,
      };
      const walletAddr = checksumAddress(addr);
      const { walletClient } = createRabbyViemSignerPair(
        bridge,
        walletAddr,
        chainId,
        publicClient
      );
      const ethereum = getEthereumProvider(bridge, chainId);
      const viemSigner = new ViemSigner({
        walletClient,
        publicClient,
        ethereum,
      } as never);
      const relayerInstance = createZamaRelayer(() => chainId);
      return { signer: viemSigner, relayer: relayerInstance, error: null };
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Zama SDK failed to initialize';
      return { signer: null, relayer: null, error: message };
    }
  }, [wallet, account, chainId]);

  if (!account?.address) {
    return (
      <div className="text-r-neutral-foot text-[13px] py-[12px]">
        Connect a Rabby account to use Shielded balances.
      </div>
    );
  }

  if (init.error || !init.signer || !init.relayer) {
    return (
      <div className="text-r-red-default text-[13px] py-[12px]">
        {init.error ?? 'Zama SDK is not ready. Reload the extension and retry.'}
      </div>
    );
  }

  const { signer, relayer } = init;

  return (
    <QueryClientProvider client={queryClient}>
      <ZamaProvider
        relayer={relayer}
        signer={signer}
        storage={indexedDBStorage}
        sessionStorage={zamaWalletSessionStorage}
        sessionTTL={ZAMA_SESSION_TTL_SEC}
        keypairTTL={ZAMA_KEYPAIR_TTL_SEC}
      >
        {children}
      </ZamaProvider>
    </QueryClientProvider>
  );
};

export default ZamaSdkScope;
