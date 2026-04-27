import { getAddress } from 'viem';
import { RELAYER_ENDPOINTS, getRelayerBaseUrlForChainId } from './constants';

function checksum(addr: string): string {
  try {
    return getAddress(addr as `0x${string}`);
  } catch {
    return addr;
  }
}

function url(baseUrl: string, path: string) {
  return `${baseUrl.replace(/\/$/, '')}${path}`;
}

export type EncryptAmountResult = {
  handle: `0x${string}`;
  inputProof: `0x${string}`;
};

export async function relayerEncryptAmount(
  params: {
    contractAddress: string;
    userAddress: string;
    amount: string;
    decimals: number;
  },
  chainId: number
): Promise<EncryptAmountResult> {
  const base = getRelayerBaseUrlForChainId(chainId);
  const res = await fetch(url(base, RELAYER_ENDPOINTS.encryptAmount), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contractAddress: checksum(params.contractAddress),
      userAddress: checksum(params.userAddress),
      amount: params.amount,
      decimals: params.decimals,
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`relayer encrypt-amount ${res.status}: ${body}`);
  }
  const data = (await res.json()) as {
    handle?: string;
    inputProof?: string;
  };
  if (!data.handle || !data.inputProof) {
    throw new Error('relayer encrypt-amount: missing handle/inputProof');
  }
  const hx = (s: string): `0x${string}` =>
    (s.startsWith('0x') ? s : `0x${s}`) as `0x${string}`;
  return { handle: hx(data.handle), inputProof: hx(data.inputProof) };
}

export type UserDecryptPrepareResult = {
  requestId: string;
  eip712: {
    domain: Record<string, unknown>;
    types: Record<string, unknown>;
    message: Record<string, unknown>;
    primaryType?: string;
  };
};

export async function relayerUserDecryptPrepare(
  params: { handles: string[]; contractAddresses: string[] },
  chainId: number
): Promise<UserDecryptPrepareResult> {
  const base = getRelayerBaseUrlForChainId(chainId);
  const res = await fetch(url(base, RELAYER_ENDPOINTS.userDecryptPrepare), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      handles: params.handles,
      contractAddresses: params.contractAddresses.map(checksum),
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`relayer user-decrypt/prepare ${res.status}: ${body}`);
  }
  return (await res.json()) as UserDecryptPrepareResult;
}

export async function relayerUserDecryptComplete(
  params: { requestId: string; signature: string; userAddress: string },
  chainId: number
): Promise<Record<string, unknown>> {
  const base = getRelayerBaseUrlForChainId(chainId);
  const res = await fetch(url(base, RELAYER_ENDPOINTS.userDecryptComplete), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      requestId: params.requestId,
      signature: params.signature,
      userAddress: checksum(params.userAddress),
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`relayer user-decrypt/complete ${res.status}: ${body}`);
  }
  return (await res.json()) as Record<string, unknown>;
}

export type PublicDecryptResult = {
  decryptionProof?: string;
  clearValues?: Record<string, bigint | number | string>;
};

export async function relayerPublicDecrypt(
  handles: string[],
  chainId: number
): Promise<PublicDecryptResult> {
  const base = getRelayerBaseUrlForChainId(chainId);
  const res = await fetch(url(base, RELAYER_ENDPOINTS.publicDecrypt), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ handles }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`relayer public-decrypt ${res.status}: ${body}`);
  }
  return (await res.json()) as PublicDecryptResult;
}

// `result[handle]` first, then `result[handle.toLowerCase()]`, then first
// cleartext-like value (single-handle case). Mirrors zWallet/MetaMask semantics.
export function cleartextFromUserDecryptResult(
  result: Record<string, unknown>,
  handle: string
): bigint {
  const maps: Record<string, unknown>[] = [result];
  const inner = (result as { result?: unknown }).result;
  if (inner && typeof inner === 'object' && !Array.isArray(inner)) {
    maps.push(inner as Record<string, unknown>);
  }
  for (const map of maps) {
    let value: unknown = map[handle];
    if (value === undefined || value === null) {
      value = map[handle.toLowerCase()];
    }
    if (value === undefined || value === null) {
      value = Object.values(map).find(
        (v) =>
          v !== null &&
          v !== undefined &&
          (typeof v === 'bigint' ||
            typeof v === 'number' ||
            typeof v === 'string')
      );
    }
    if (value !== undefined && value !== null) {
      if (typeof value === 'bigint') return value;
      if (typeof value === 'number') return BigInt(Math.floor(value));
      return BigInt(String(value));
    }
  }
  throw new Error('user-decrypt returned no value for handle');
}

export function cleartextAndProofFromPublicDecrypt(
  result: PublicDecryptResult,
  handle: string
): { cleartext: bigint; decryptionProof: `0x${string}` } | null {
  const { decryptionProof, clearValues } = result;
  if (!decryptionProof || !clearValues) return null;
  let val: bigint | number | string | undefined = clearValues[handle];
  if (val === undefined) val = clearValues[handle.toLowerCase()];
  if (val === undefined) {
    const keys = Object.keys(clearValues);
    if (keys.length > 0) val = clearValues[keys[0]];
  }
  if (val === undefined) return null;
  const cleartext = typeof val === 'bigint' ? val : BigInt(String(Number(val)));
  const proofHex = (decryptionProof.startsWith('0x')
    ? decryptionProof
    : `0x${decryptionProof}`) as `0x${string}`;
  return { cleartext, decryptionProof: proofHex };
}

const PUBLIC_DECRYPT_MAX_ATTEMPTS = 8;
const PUBLIC_DECRYPT_RETRY_MS = 2000;

export async function relayerPublicDecryptProofWithRetry(
  handle: string,
  chainId: number
): Promise<{ cleartext: bigint; decryptionProof: `0x${string}` } | null> {
  for (let i = 0; i < PUBLIC_DECRYPT_MAX_ATTEMPTS; i++) {
    try {
      const raw = await relayerPublicDecrypt([handle], chainId);
      const parsed = cleartextAndProofFromPublicDecrypt(raw, handle);
      if (parsed) return parsed;
    } catch {
      // gateway not ready — retry
    }
    if (i < PUBLIC_DECRYPT_MAX_ATTEMPTS - 1) {
      await new Promise((r) => setTimeout(r, PUBLIC_DECRYPT_RETRY_MS));
    }
  }
  return null;
}
