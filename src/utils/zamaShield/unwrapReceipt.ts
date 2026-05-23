import { decodeEventLog, Hex } from 'viem';
import { UNWRAP_REQUESTED_EVENT_ABI } from './abi';

export type UnwrapReceiptLog = {
  address?: string;
  topics?: readonly string[];
  data: string;
};

// Parses the burnt confidential-balance handle from the `UnwrapRequested` event
// in the unshield transaction receipt.
export function parseBurntHandleFromReceiptLogs(
  logs: readonly UnwrapReceiptLog[],
  confidentialTokenAddress: string
): Hex | null {
  const tokenLower = confidentialTokenAddress.toLowerCase();
  for (const log of logs) {
    if (!log.address || log.address.toLowerCase() !== tokenLower) continue;
    if (!log.topics || log.topics.length < 2) continue;
    try {
      const decoded = decodeEventLog({
        abi: UNWRAP_REQUESTED_EVENT_ABI,
        data: log.data as Hex,
        topics: log.topics as [Hex, ...Hex[]],
      });
      if (
        decoded.eventName === 'UnwrapRequested' &&
        decoded.args &&
        'amount' in decoded.args
      ) {
        const amount = decoded.args.amount as string;
        if (
          typeof amount === 'string' &&
          amount.startsWith('0x') &&
          amount.length === 66
        ) {
          return amount as Hex;
        }
      }
    } catch {
      // ignore decode errors
    }
  }
  return null;
}
