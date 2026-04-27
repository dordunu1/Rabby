// Minimal ERC-20 + ERC-7984 fragments — matches metamask-extension/shared/lib/confidential-erc7984/abi.ts.

import { slice, toFunctionSelector } from 'viem';

export const ERC20_ABI = [
  {
    type: 'function',
    name: 'balanceOf',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'allowance',
    stateMutability: 'view',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'approve',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    type: 'function',
    name: 'decimals',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint8' }],
  },
] as const;

export const CONFIDENTIAL_BALANCE_OF_ABI = [
  {
    type: 'function',
    name: 'confidentialBalanceOf',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'bytes32' }],
  },
] as const;

export const WRAP_ABI = [
  {
    type: 'function',
    name: 'wrap',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [],
  },
] as const;

export const UNWRAP_ABI = [
  {
    type: 'function',
    name: 'unwrap',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'from', type: 'address' },
      { name: 'to', type: 'address' },
      { name: 'encryptedAmount', type: 'bytes32' },
      { name: 'inputProof', type: 'bytes' },
    ],
    outputs: [],
  },
] as const;

export const FINALIZE_UNWRAP_ABI = [
  {
    type: 'function',
    name: 'finalizeUnwrap',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'burntAmount', type: 'bytes32' },
      { name: 'burntAmountCleartext', type: 'uint64' },
      { name: 'decryptionProof', type: 'bytes' },
    ],
    outputs: [],
  },
] as const;

export const CONFIDENTIAL_TRANSFER_ABI = [
  {
    type: 'function',
    name: 'confidentialTransfer',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'encryptedAmount', type: 'bytes32' },
      { name: 'inputProof', type: 'bytes' },
    ],
    outputs: [],
  },
] as const;

export const UNWRAP_REQUESTED_EVENT_ABI = [
  {
    type: 'event',
    name: 'UnwrapRequested',
    inputs: [
      { indexed: true, name: 'receiver', type: 'address' },
      { indexed: false, name: 'amount', type: 'bytes32' },
    ],
  },
] as const;

// --- Transaction history (TxInterAddressExplain): map calldata → method id ---
// Rabby’s list view title usually comes from Debank (`cate_item` / `tx.name`).
// Zama wrappers are often missing there; we match the same ABIs above via
// selector so the history row shows Wrap / Unwrap / etc. instead of “Unknown”.

export type ZamaTxMethodKey =
  | 'wrap'
  | 'unwrap'
  | 'finalizeUnwrap'
  | 'confidentialTransfer';

const ZAMA_SELECTOR_TO_METHOD: Record<string, ZamaTxMethodKey> = (() => {
  const pairs: [string, ZamaTxMethodKey][] = [
    [toFunctionSelector('wrap(address,uint256)'), 'wrap'],
    [toFunctionSelector('unwrap(address,address,bytes32,bytes)'), 'unwrap'],
    [
      toFunctionSelector('finalizeUnwrap(bytes32,uint64,bytes)'),
      'finalizeUnwrap',
    ],
    [
      toFunctionSelector('confidentialTransfer(address,bytes32,bytes)'),
      'confidentialTransfer',
    ],
  ];
  const out: Record<string, ZamaTxMethodKey> = {};
  for (const [sel, key] of pairs) {
    out[sel.toLowerCase()] = key;
  }
  return out;
})();

/** First 4 bytes of calldata → method key for i18n (`page.zamaShield.txHistory.*`). */
export function getZamaMethodKeyFromInput(
  input: string | null | undefined
): ZamaTxMethodKey | null {
  if (
    typeof input !== 'string' ||
    !input.startsWith('0x') ||
    input.length < 10
  ) {
    return null;
  }
  try {
    const sel = slice(input as `0x${string}`, 0, 4).toLowerCase();
    return ZAMA_SELECTOR_TO_METHOD[sel] ?? null;
  } catch {
    return null;
  }
}
