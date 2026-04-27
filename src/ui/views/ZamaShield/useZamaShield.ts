import { useCallback, useEffect, useRef, useState } from 'react';
import {
  encodeFunctionData,
  formatUnits,
  parseUnits,
  maxUint256,
  Hex,
} from 'viem';
import { useWallet } from '@/ui/utils';
import { useCurrentAccount } from '@/ui/hooks/backgroundState/useAccount';
import {
  ERC20_ABI,
  CONFIDENTIAL_BALANCE_OF_ABI,
  WRAP_ABI,
  UNWRAP_ABI,
  FINALIZE_UNWRAP_ABI,
  CONFIDENTIAL_TRANSFER_ABI,
} from '@/utils/zamaShield/abi';
import {
  ConfidentialTokenDefinition,
  relayerEncryptDecimalsForToken,
} from '@/utils/zamaShield/registry';
import { CONFIDENTIAL_ZERO_HANDLE } from '@/utils/zamaShield/constants';
import {
  relayerEncryptAmount,
  relayerUserDecryptPrepare,
  relayerUserDecryptComplete,
  cleartextFromUserDecryptResult,
  relayerPublicDecryptProofWithRetry,
} from '@/utils/zamaShield/relayer';
import { getReadClient } from '@/utils/zamaShield/rpc';
import { parseBurntHandleFromReceiptLogs } from '@/utils/zamaShield/unwrapReceipt';

// Read public ERC-20 balance + allowance against the confidential wrapper.
export function usePublicBalance(
  token: ConfidentialTokenDefinition,
  chainId: number
) {
  const account = useCurrentAccount();
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
            address: token.underlyingAddress,
            abi: ERC20_ABI,
            functionName: 'balanceOf',
            args: [account.address as `0x${string}`],
          })
          .catch(() => 0n),
        client
          .readContract({
            address: token.underlyingAddress,
            abi: ERC20_ABI,
            functionName: 'allowance',
            args: [account.address as `0x${string}`, token.address],
          })
          .catch(() => 0n),
      ]);
      setBalance(bal as bigint);
      setAllowance(allow as bigint);
    } finally {
      setLoading(false);
    }
  }, [account?.address, chainId, token.address, token.underlyingAddress]);

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

// Read the encrypted balance handle from the confidential wrapper.
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

// User-decrypt: relayer prepare → wallet signs EIP-712 → relayer completes.
export function useFhevmDecrypt(chainId: number) {
  const wallet = useWallet();
  const account = useCurrentAccount();
  const [decrypting, setDecrypting] = useState(false);

  const decryptHandle = useCallback(
    async (handle: string, contractAddress: string): Promise<bigint | null> => {
      if (!account?.address) return null;
      if (!handle || handle === CONFIDENTIAL_ZERO_HANDLE) return 0n;
      setDecrypting(true);
      try {
        const prepare = await relayerUserDecryptPrepare(
          {
            handles: [handle],
            contractAddresses: [contractAddress],
          },
          chainId
        );
        const { requestId, eip712 } = prepare;
        const typedData = {
          domain: eip712.domain,
          types: eip712.types,
          primaryType: 'UserDecryptRequestVerification',
          message: eip712.message,
        };
        const signature = (await wallet.sendRequest<string>({
          method: 'eth_signTypedData_v4',
          params: [account.address, JSON.stringify(typedData)],
        })) as string;
        const result = await relayerUserDecryptComplete(
          {
            requestId,
            signature,
            userAddress: account.address,
          },
          chainId
        );
        return cleartextFromUserDecryptResult(result, handle);
      } finally {
        setDecrypting(false);
      }
    },
    [account?.address, chainId, wallet]
  );

  return { decryptHandle, decrypting };
}

// Batch user-decrypt: one relayer `prepare` + one EIP-712 + one `complete` for
// all tokens on the same chain (mirrors MetaMask `private-balance-tab` batch
// flow; relayer expects parallel `handles` / `contractAddresses` arrays).
export function useBatchDecryptAllConfidential(chainId: number) {
  const wallet = useWallet();
  const account = useCurrentAccount();
  const [decryptingAll, setDecryptingAll] = useState(false);

  const decryptAllTokens = useCallback(
    async (
      tokens: ConfidentialTokenDefinition[],
      alreadyRevealedTokenIds: Set<string>
    ): Promise<Record<string, bigint>> => {
      if (!account?.address) {
        return {};
      }
      const client = getReadClient(chainId);
      const toDecrypt: {
        token: ConfidentialTokenDefinition;
        handle: string;
      }[] = [];
      for (const token of tokens) {
        if (alreadyRevealedTokenIds.has(token.id)) {
          continue;
        }
        const h = await client
          .readContract({
            address: token.address,
            abi: CONFIDENTIAL_BALANCE_OF_ABI,
            functionName: 'confidentialBalanceOf',
            args: [account.address as `0x${string}`],
          })
          .catch(() => null);
        if (!h || h === CONFIDENTIAL_ZERO_HANDLE) {
          continue;
        }
        toDecrypt.push({ token, handle: h as string });
      }
      if (toDecrypt.length === 0) {
        return {};
      }
      setDecryptingAll(true);
      try {
        const prepare = await relayerUserDecryptPrepare(
          {
            handles: toDecrypt.map((x) => x.handle),
            contractAddresses: toDecrypt.map((x) => x.token.address),
          },
          chainId
        );
        const { requestId, eip712 } = prepare;
        const typedData = {
          domain: eip712.domain,
          types: eip712.types,
          primaryType: 'UserDecryptRequestVerification',
          message: eip712.message,
        };
        const signature = (await wallet.sendRequest<string>({
          method: 'eth_signTypedData_v4',
          params: [account.address, JSON.stringify(typedData)],
        })) as string;
        const result = await relayerUserDecryptComplete(
          {
            requestId,
            signature,
            userAddress: account.address,
          },
          chainId
        );
        const out: Record<string, bigint> = {};
        for (const { token, handle } of toDecrypt) {
          try {
            out[token.id] = cleartextFromUserDecryptResult(result, handle);
          } catch {
            // skip one row, others may still be valid
          }
        }
        return out;
      } finally {
        setDecryptingAll(false);
      }
    },
    [account?.address, chainId, wallet]
  );

  return { decryptAllTokens, decryptingAll };
}

// Trigger an `eth_sendTransaction` via Rabby's normal approval flow and
// resolve once the tx is broadcast (returns the tx hash).
async function sendTx(
  wallet: ReturnType<typeof useWallet>,
  params: {
    from: `0x${string}`;
    to: `0x${string}`;
    data: `0x${string}`;
    value?: `0x${string}`;
    chainId: number;
  }
): Promise<Hex> {
  const tx: Record<string, unknown> = {
    chainId: params.chainId,
    from: params.from,
    to: params.to,
    value: params.value ?? '0x0',
    data: params.data,
  };
  const hash = (await wallet.sendRequest<Hex>({
    method: 'eth_sendTransaction',
    params: [tx],
  })) as Hex;
  return hash;
}

export function useWrap(token: ConfidentialTokenDefinition, chainId: number) {
  const wallet = useWallet();
  const account = useCurrentAccount();
  const [pending, setPending] = useState(false);

  const approveIfNeeded = useCallback(
    async (amountWei: bigint, currentAllowance: bigint) => {
      if (!account?.address) return null;
      if (currentAllowance >= amountWei) return null;
      const data = encodeFunctionData({
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [token.address, maxUint256],
      });
      return sendTx(wallet, {
        from: account.address as `0x${string}`,
        to: token.underlyingAddress,
        data,
        chainId,
      });
    },
    [account?.address, chainId, token.address, token.underlyingAddress, wallet]
  );

  const wrap = useCallback(
    async (amountHuman: string, currentAllowance: bigint) => {
      if (!account?.address) return null;
      const amountWei = parseUnits(amountHuman, token.decimals);
      if (amountWei <= 0n) return null;
      setPending(true);
      try {
        await approveIfNeeded(amountWei, currentAllowance);
        const data = encodeFunctionData({
          abi: WRAP_ABI,
          functionName: 'wrap',
          args: [account.address as `0x${string}`, amountWei],
        });
        return sendTx(wallet, {
          from: account.address as `0x${string}`,
          to: token.address,
          data,
          chainId,
        });
      } finally {
        setPending(false);
      }
    },
    [
      account?.address,
      approveIfNeeded,
      chainId,
      token.address,
      token.decimals,
      wallet,
    ]
  );

  return { wrap, pending };
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
  const wallet = useWallet();
  const account = useCurrentAccount();
  const [state, setState] = useState<UnwrapState>({ step: 'idle' });
  const cancelRef = useRef(false);

  const reset = useCallback(() => {
    cancelRef.current = false;
    setState({ step: 'idle' });
  }, []);

  const unwrap = useCallback(
    async (amountHuman: string) => {
      if (!account?.address) return;
      cancelRef.current = false;
      setState({ step: 'encrypting' });
      try {
        const encDecimals = relayerEncryptDecimalsForToken(
          token.decimals,
          chainId
        );
        const enc = await relayerEncryptAmount(
          {
            contractAddress: token.address,
            userAddress: account.address,
            amount: amountHuman,
            decimals: encDecimals,
          },
          chainId
        );
        if (cancelRef.current) return;
        setState({ step: 'submitting' });
        const unwrapData = encodeFunctionData({
          abi: UNWRAP_ABI,
          functionName: 'unwrap',
          args: [
            account.address as `0x${string}`,
            account.address as `0x${string}`,
            enc.handle,
            enc.inputProof,
          ],
        });
        const unwrapHash = await sendTx(wallet, {
          from: account.address as `0x${string}`,
          to: token.address,
          data: unwrapData,
          chainId,
        });
        if (cancelRef.current) return;
        setState({ step: 'confirming', unwrapTxHash: unwrapHash });
        const client = getReadClient(chainId);
        const receipt = await client.waitForTransactionReceipt({
          hash: unwrapHash,
        });
        if (receipt.status !== 'success') {
          throw new Error('Unwrap transaction reverted');
        }
        const burntHandle =
          parseBurntHandleFromReceiptLogs(
            receipt.logs.map((l) => ({
              address: l.address,
              topics: l.topics as readonly string[],
              data: l.data,
            })),
            token.address
          ) ?? enc.handle;
        if (cancelRef.current) return;
        setState({ step: 'getting_proof', unwrapTxHash: unwrapHash });
        const proof = await relayerPublicDecryptProofWithRetry(
          burntHandle,
          chainId
        );
        if (!proof) {
          throw new Error(
            'Decryption proof not ready. Try again in a few seconds.'
          );
        }
        if (cancelRef.current) return;
        setState({ step: 'finalizing', unwrapTxHash: unwrapHash });
        const cleartextU64 =
          proof.cleartext <= 0xffff_ffff_ffff_ffffn ? proof.cleartext : 0n;
        const finalizeData = encodeFunctionData({
          abi: FINALIZE_UNWRAP_ABI,
          functionName: 'finalizeUnwrap',
          args: [burntHandle, cleartextU64, proof.decryptionProof],
        });
        const finalizeHash = await sendTx(wallet, {
          from: account.address as `0x${string}`,
          to: token.address,
          data: finalizeData,
          chainId,
        });
        if (cancelRef.current) return;
        setState({
          step: 'finalizing',
          unwrapTxHash: unwrapHash,
          finalizeTxHash: finalizeHash,
        });
        await client.waitForTransactionReceipt({ hash: finalizeHash });
        if (cancelRef.current) return;
        setState({
          step: 'done',
          unwrapTxHash: unwrapHash,
          finalizeTxHash: finalizeHash,
        });
      } catch (err) {
        if (cancelRef.current) return;
        setState((prev) => ({
          ...prev,
          step: 'failed',
          error: err instanceof Error ? err.message : 'Unwrap failed',
        }));
      }
    },
    [account?.address, chainId, token.address, token.decimals, wallet]
  );

  return { state, unwrap, reset };
}

export function useConfidentialTransfer(
  token: ConfidentialTokenDefinition,
  chainId: number
) {
  const wallet = useWallet();
  const account = useCurrentAccount();
  const [pending, setPending] = useState(false);

  const transfer = useCallback(
    async (toAddress: `0x${string}`, amountHuman: string) => {
      if (!account?.address) return null;
      if (!toAddress || toAddress.length !== 42) return null;
      setPending(true);
      try {
        const encDecimals = relayerEncryptDecimalsForToken(
          token.decimals,
          chainId
        );
        const enc = await relayerEncryptAmount(
          {
            contractAddress: token.address,
            userAddress: account.address,
            amount: amountHuman,
            decimals: encDecimals,
          },
          chainId
        );
        const data = encodeFunctionData({
          abi: CONFIDENTIAL_TRANSFER_ABI,
          functionName: 'confidentialTransfer',
          args: [toAddress, enc.handle, enc.inputProof],
        });
        return sendTx(wallet, {
          from: account.address as `0x${string}`,
          to: token.address,
          data,
          chainId,
        });
      } finally {
        setPending(false);
      }
    },
    [account?.address, chainId, token.address, token.decimals, wallet]
  );

  return { transfer, pending };
}
