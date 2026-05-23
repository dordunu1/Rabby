import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { Hex } from 'viem';
import { formatUnits, parseUnits, zeroAddress } from 'viem';
import {
  useAllow,
  useApproveUnderlying,
  useConfidentialTransfer as useSdkConfidentialTransfer,
  useIsAllowed,
  useShield,
  useUnderlyingAllowance,
  useUnshield,
  useWrapperDiscovery,
  useZamaSDK,
  useResumeUnshield,
  zamaQueryKeys,
  clearPendingUnshield,
  loadPendingUnshield,
  savePendingUnshield,
} from '@/utils/zamaShield/zamaImports';
import { useCurrentAccount } from '@/ui/hooks/backgroundState/useAccount';
import { ERC20_ABI, CONFIDENTIAL_BALANCE_OF_ABI } from '@/utils/zamaShield/abi';
import { ConfidentialTokenDefinition } from '@/utils/zamaShield/registry';
import { CONFIDENTIAL_ZERO_HANDLE } from '@/utils/zamaShield/constants';
import { getReadClient } from '@/utils/zamaShield/rpc';
import { humanizeZamaError } from '@/utils/zamaShield/zamaErrors';
import { checksumAddress } from '@/utils/zamaShield/checksumAddress';

export function useZamaShieldTokenSetup(token: ConfidentialTokenDefinition) {
  const {
    data: wrapperFromRegistry,
    isPending: wrapperDiscoveryPending,
  } = useWrapperDiscovery({
    tokenAddress: checksumAddress(token.address),
    erc20Address: checksumAddress(token.underlyingAddress),
  });

  return useMemo(() => {
    const tokenAddress = checksumAddress(token.address);
    const underlyingAddress = checksumAddress(token.underlyingAddress);
    const wrapper =
      wrapperFromRegistry != null && wrapperFromRegistry !== zeroAddress
        ? checksumAddress(wrapperFromRegistry)
        : null;

    const wrapperForAllowance = wrapper ?? tokenAddress;

    const shieldConfig =
      wrapper != null && wrapper !== tokenAddress
        ? { tokenAddress, wrapperAddress: wrapper }
        : { tokenAddress };

    return {
      shieldConfig,
      wrapperForAllowance,
      underlyingAddress,
      tokenAddress,
      wrapperDiscoveryPending,
      configReady: !wrapperDiscoveryPending,
    };
  }, [
    token.address,
    token.underlyingAddress,
    wrapperFromRegistry,
    wrapperDiscoveryPending,
  ]);
}

export function useZamaShieldConfig(token: ConfidentialTokenDefinition) {
  return useZamaShieldTokenSetup(token).shieldConfig;
}

export function usePublicBalance(
  token: ConfidentialTokenDefinition,
  chainId: number
) {
  const account = useCurrentAccount();
  const { wrapperForAllowance, underlyingAddress } = useZamaShieldTokenSetup(
    token
  );
  const [balance, setBalance] = useState<bigint>(0n);
  const [allowance, setAllowance] = useState<bigint>(0n);
  const [loading, setLoading] = useState(false);

  const refetch = useCallback(async () => {
    if (!account?.address) return;
    setLoading(true);
    try {
      const client = getReadClient(chainId);
      const [bal, allow] = await Promise.all([
        client
          .readContract({
            address: underlyingAddress,
            abi: ERC20_ABI,
            functionName: 'balanceOf',
            args: [checksumAddress(account.address)],
          })
          .catch(() => 0n),
        client
          .readContract({
            address: underlyingAddress,
            abi: ERC20_ABI,
            functionName: 'allowance',
            args: [checksumAddress(account.address), wrapperForAllowance],
          })
          .catch(() => 0n),
      ]);
      setBalance(bal as bigint);
      setAllowance(allow as bigint);
    } finally {
      setLoading(false);
    }
  }, [account?.address, chainId, underlyingAddress, wrapperForAllowance]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return {
    balance,
    balanceFormatted: formatUnits(balance, token.decimals),
    allowance,
    needsApproval: (amountHuman: string) => {
      try {
        return allowance < parseUnits(amountHuman, token.decimals);
      } catch {
        return true;
      }
    },
    loading,
    refetch,
  };
}

export function useConfidentialBalanceHandle(
  token: ConfidentialTokenDefinition,
  chainId: number
) {
  const account = useCurrentAccount();
  const [handle, setHandle] = useState<Hex | null>(null);
  const [loading, setLoading] = useState(false);

  const refetch = useCallback(async (): Promise<Hex | null> => {
    if (!account?.address) {
      setHandle(null);
      return null;
    }
    setLoading(true);
    try {
      const client = getReadClient(chainId);
      const result = await client.readContract({
        address: token.address,
        abi: CONFIDENTIAL_BALANCE_OF_ABI,
        functionName: 'confidentialBalanceOf',
        args: [account.address as `0x${string}`],
      });
      const h = result as Hex;
      const next = h && h !== CONFIDENTIAL_ZERO_HANDLE ? h : null;
      setHandle(next);
      return next;
    } catch {
      setHandle(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, [account?.address, chainId, token.address]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return {
    handle,
    hasBalance: !!handle,
    loading,
    refetch,
  };
}

export function useBatchDecryptAllConfidential(
  chainId: number,
  tokens: ConfidentialTokenDefinition[]
) {
  const queryClient = useQueryClient();
  const sdk = useZamaSDK();
  const account = useCurrentAccount();
  const { mutateAsync: allowContracts } = useAllow();
  const tokenAddresses = useMemo(() => tokens.map((t) => t.address), [tokens]);
  const allowCheckContracts = useMemo((): [
    `0x${string}`,
    ...`0x${string}`[]
  ] => {
    if (tokenAddresses.length === 0) {
      return ['0x0000000000000000000000000000000000000000'];
    }
    return tokenAddresses as [`0x${string}`, ...`0x${string}`[]];
  }, [tokenAddresses]);
  const { data: allowed, isLoading: isAllowCheckLoading } = useIsAllowed({
    contractAddresses: allowCheckContracts,
  });
  const [decryptingAll, setDecryptingAll] = useState(false);

  const decryptAllTokens = useCallback(
    async (
      _tokens: ConfidentialTokenDefinition[],
      alreadyRevealedTokenIds: Set<string>
    ): Promise<Record<string, bigint>> => {
      if (!sdk || !account?.address) {
        throw new Error('Zama SDK is not ready. Reload and try again.');
      }

      const toFetch = tokens.filter((t) => !alreadyRevealedTokenIds.has(t.id));
      if (toFetch.length === 0) {
        return {};
      }
      if (isAllowCheckLoading) {
        throw new Error(
          'Checking decryption session. Wait a moment and tap Decrypt all again.'
        );
      }

      setDecryptingAll(true);
      try {
        const owner = account.address as `0x${string}`;
        const client = getReadClient(chainId);
        const handlesByToken = new Map<ConfidentialTokenDefinition, Hex>();

        for (const token of toFetch) {
          const result = await client.readContract({
            address: token.address,
            abi: CONFIDENTIAL_BALANCE_OF_ABI,
            functionName: 'confidentialBalanceOf',
            args: [owner],
          });
          const h = result as Hex;
          if (h && h !== CONFIDENTIAL_ZERO_HANDLE) {
            handlesByToken.set(token, h);
          }
        }

        if (handlesByToken.size === 0) {
          throw new Error(
            'No confidential balance on chain for these tokens (shield first, or switch network).'
          );
        }

        const addrs = [...handlesByToken.keys()].map((t) =>
          checksumAddress(t.address)
        );
        if (allowed !== true) {
          await allowContracts(addrs);
        }

        const out: Record<string, bigint> = {};
        const failures: string[] = [];

        for (const token of handlesByToken.keys()) {
          try {
            const tokenAddress = checksumAddress(token.address);
            let wrapper: `0x${string}` | undefined;
            try {
              const reg = await sdk.registry.getConfidentialToken(
                checksumAddress(token.underlyingAddress)
              );
              if (
                reg?.confidentialTokenAddress &&
                reg.confidentialTokenAddress !== zeroAddress &&
                checksumAddress(reg.confidentialTokenAddress).toLowerCase() !==
                  tokenAddress.toLowerCase()
              ) {
                wrapper = checksumAddress(reg.confidentialTokenAddress);
              }
            } catch {
              /* registry optional */
            }

            const tokenApi = wrapper
              ? sdk.createToken(tokenAddress, wrapper)
              : sdk.createToken(tokenAddress);
            out[token.id] = await tokenApi.balanceOf(owner);
          } catch (err) {
            failures.push(`${token.symbol}: ${humanizeZamaError(err)}`);
          }
        }

        await queryClient.invalidateQueries({
          queryKey: zamaQueryKeys.confidentialBalance.all,
        });
        await queryClient.invalidateQueries({
          queryKey: zamaQueryKeys.confidentialBalances.all,
        });

        if (Object.keys(out).length === 0) {
          throw new Error(
            failures.length > 0
              ? failures.join(' ')
              : 'Decrypt failed — relayer returned no cleartext.'
          );
        }

        return out;
      } finally {
        setDecryptingAll(false);
      }
    },
    [
      account?.address,
      allowContracts,
      allowed,
      chainId,
      isAllowCheckLoading,
      queryClient,
      sdk,
      tokens,
    ]
  );

  return { decryptAllTokens, decryptingAll };
}

export function useWrap(token: ConfidentialTokenDefinition, chainId: number) {
  const account = useCurrentAccount();
  const publicClient = getReadClient(chainId);
  const {
    shieldConfig,
    wrapperForAllowance,
    underlyingAddress,
    tokenAddress,
    configReady,
  } = useZamaShieldTokenSetup(token);
  const { mutateAsync: shield, isPending: shielding } = useShield(shieldConfig);
  const {
    mutateAsync: approveUnderlying,
    isPending: approving,
  } = useApproveUnderlying(shieldConfig);
  const {
    data: underlyingAllowance,
    refetch: refetchAllowance,
  } = useUnderlyingAllowance({
    tokenAddress,
    wrapperAddress: wrapperForAllowance,
  });

  const wrap = useCallback(
    async (amountHuman: string) => {
      if (!configReady) {
        throw new Error('Resolving confidential token wrapper…');
      }
      if (!account?.address) {
        throw new Error('No Rabby account selected.');
      }
      const amount = parseUnits(amountHuman, token.decimals);
      if (amount <= 0n) return null;

      const owner = checksumAddress(account.address);

      const readAllowance = async () =>
        (await publicClient
          .readContract({
            address: underlyingAddress,
            abi: ERC20_ABI,
            functionName: 'allowance',
            args: [owner, wrapperForAllowance],
          })
          .catch(() => 0n)) as bigint;

      let allowanceNow = (await readAllowance()) ?? underlyingAllowance ?? 0n;

      if (allowanceNow < amount) {
        const approveResult = await approveUnderlying({ amount });
        const approveTx = (approveResult as { txHash?: Hex })?.txHash;
        if (approveTx) {
          await publicClient.waitForTransactionReceipt({ hash: approveTx });
        }

        let sufficient = false;
        for (let i = 0; i < 30; i++) {
          allowanceNow = await readAllowance();
          if (allowanceNow >= amount) {
            sufficient = true;
            break;
          }
          const { data: next } = await refetchAllowance();
          if ((next ?? 0n) >= amount) {
            sufficient = true;
            break;
          }
          await new Promise((r) => setTimeout(r, 250));
        }
        if (!sufficient) {
          throw new Error(
            'Allowance still below shield amount after approve. Retry or check explorer.'
          );
        }
      }

      const { txHash } = await shield({
        amount,
        approvalStrategy: 'skip',
      });
      return txHash;
    },
    [
      account?.address,
      approveUnderlying,
      configReady,
      publicClient,
      refetchAllowance,
      shield,
      token.decimals,
      underlyingAddress,
      underlyingAllowance,
      wrapperForAllowance,
    ]
  );

  return { wrap, pending: shielding || approving || !configReady };
}

export type UnwrapStep =
  | 'idle'
  | 'encrypting'
  | 'submitting'
  | 'confirming'
  | 'getting_proof'
  | 'finalizing'
  | 'done'
  | 'failed';

export type UnwrapState = {
  step: UnwrapStep;
  message?: string;
  error?: string;
  unwrapTxHash?: Hex;
  finalizeTxHash?: Hex;
};

export function useUnwrap(token: ConfidentialTokenDefinition, chainId: number) {
  const sdk = useZamaSDK();
  const { mutateAsync: allowContracts } = useAllow();
  const {
    shieldConfig: config,
    configReady,
    tokenAddress,
    wrapperForAllowance,
  } = useZamaShieldTokenSetup(token);
  const pendingStorageKey = wrapperForAllowance;
  const { data: allowed } = useIsAllowed({
    contractAddresses: [tokenAddress],
  });
  const { mutateAsync: unshield, isPending } = useUnshield(config);
  const { mutateAsync: resumeUnshield } = useResumeUnshield(config);
  const [state, setState] = useState<UnwrapState>({ step: 'idle' });
  const cancelRef = useRef(false);

  useEffect(() => {
    if (!sdk) return;
    let cancelled = false;
    void (async () => {
      try {
        const pending = await loadPendingUnshield(
          sdk.storage,
          pendingStorageKey
        );
        if (!pending || cancelled) return;
        setState({ step: 'getting_proof', unwrapTxHash: pending });
        await resumeUnshield({ unwrapTxHash: pending });
        await clearPendingUnshield(sdk.storage, pendingStorageKey);
        if (!cancelled) setState({ step: 'done', unwrapTxHash: pending });
      } catch {
        /* ignore stale resume */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pendingStorageKey, resumeUnshield, sdk]);

  const reset = useCallback(() => {
    cancelRef.current = false;
    setState({ step: 'idle' });
  }, []);

  const unwrap = useCallback(
    async (amountHuman: string) => {
      cancelRef.current = false;
      setState({ step: 'encrypting' });
      try {
        if (!configReady) {
          throw new Error('Resolving confidential token wrapper…');
        }
        if (allowed !== true) {
          await allowContracts([tokenAddress]);
        }

        const amount = parseUnits(amountHuman.trim(), token.decimals);
        if (amount <= 0n) return;

        setState({ step: 'submitting' });
        let unwrapTx: Hex | undefined;

        const runUnshield = () =>
          unshield({
            amount,
            skipBalanceCheck: true,
            onUnwrapSubmitted: (txHash) => {
              if (cancelRef.current) return;
              unwrapTx = txHash;
              void savePendingUnshield(sdk!.storage, pendingStorageKey, txHash);
              setState({ step: 'confirming', unwrapTxHash: txHash });
            },
            onFinalizing: () => {
              if (cancelRef.current) return;
              setState((prev) => ({
                ...prev,
                step: 'getting_proof',
                unwrapTxHash: prev.unwrapTxHash ?? unwrapTx,
              }));
            },
            onFinalizeSubmitted: (txHash) => {
              if (cancelRef.current) return;
              setState((prev) => ({
                ...prev,
                step: 'finalizing',
                unwrapTxHash: prev.unwrapTxHash ?? unwrapTx,
                finalizeTxHash: txHash,
              }));
            },
          });

        let result: { txHash: Hex };
        try {
          result = await runUnshield();
        } catch (firstErr) {
          const msg =
            firstErr instanceof Error ? firstErr.message : String(firstErr);
          if (unwrapTx && /UnwrapRequested|unwrap request/i.test(msg)) {
            result = await resumeUnshield({ unwrapTxHash: unwrapTx });
          } else {
            throw firstErr;
          }
        }

        await clearPendingUnshield(sdk.storage, pendingStorageKey);
        if (cancelRef.current) return;
        setState({
          step: 'done',
          unwrapTxHash: result.txHash,
        });
      } catch (err) {
        if (cancelRef.current) return;
        setState({
          step: 'failed',
          error: humanizeZamaError(err),
        });
      }
    },
    [
      allowContracts,
      allowed,
      configReady,
      token.decimals,
      pendingStorageKey,
      sdk,
      tokenAddress,
      unshield,
      resumeUnshield,
    ]
  );

  return {
    state,
    unwrap,
    reset,
    pending: isPending,
  };
}

export function useConfidentialTransfer(
  token: ConfidentialTokenDefinition,
  chainId: number
) {
  const { mutateAsync: allowContracts } = useAllow();
  const {
    shieldConfig: config,
    tokenAddress,
    configReady,
  } = useZamaShieldTokenSetup(token);
  const { data: allowed, isLoading: isAllowCheckLoading } = useIsAllowed({
    contractAddresses: [tokenAddress],
  });
  const { mutateAsync: transfer, isPending } = useSdkConfidentialTransfer(
    config
  );

  const send = useCallback(
    async (toAddress: `0x${string}`, amountHuman: string) => {
      if (!configReady) {
        throw new Error('Resolving confidential token wrapper…');
      }
      if (isAllowCheckLoading) {
        throw new Error('Checking decryption session. Try again in a moment.');
      }
      if (allowed !== true) {
        await allowContracts([tokenAddress]);
      }
      const amount = parseUnits(amountHuman, token.decimals);
      if (amount <= 0n) return null;
      const { txHash } = await transfer({
        to: checksumAddress(toAddress),
        amount,
      });
      return txHash;
    },
    [
      allowContracts,
      allowed,
      configReady,
      isAllowCheckLoading,
      token.decimals,
      tokenAddress,
      transfer,
    ]
  );

  return { transfer: send, pending: isPending };
}
