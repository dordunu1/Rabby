import {
  ApprovalFailedError,
  EncryptionFailedError,
  matchZamaError,
} from '@/utils/zamaShield/zamaImports';
import type {
  ConfigurationError,
  InsufficientConfidentialBalanceError,
  InsufficientERC20BalanceError,
  RelayerRequestFailedError,
  TransactionRevertedError,
  ZamaError,
} from '@/utils/zamaShield/zamaImports';

function messageFromPortBridge(err: unknown): string | null {
  if (err instanceof Error) return err.message;
  if (err && typeof err === 'object') {
    const o = err as { message?: unknown; data?: { message?: unknown } };
    if (typeof o.message === 'string' && o.message) return o.message;
    if (typeof o.data?.message === 'string' && o.data.message) {
      return o.data.message;
    }
  }
  return null;
}

export function humanizeZamaError(err: unknown): string {
  if (err instanceof ApprovalFailedError) {
    return 'ERC-20 approval failed. Confirm the transaction in Rabby and ensure you are on the correct network.';
  }
  if (err instanceof EncryptionFailedError) {
    return 'Encryption failed — please retry.';
  }
  if (!(err instanceof Error)) {
    return messageFromPortBridge(err) ?? 'Something went wrong.';
  }
  const cause =
    err.cause instanceof Error
      ? err.cause.message
      : typeof err.cause === 'string'
      ? err.cause
      : null;

  const mapped = matchZamaError(err, {
    SIGNING_REJECTED: () => 'You rejected the wallet request.',
    ENCRYPTION_FAILED: () => 'Encryption failed — please retry.',
    INSUFFICIENT_ERC20_BALANCE: (e: ZamaError) => {
      const x = e as InsufficientERC20BalanceError;
      return `Not enough public tokens (have ${x.available}, need ${x.requested}).`;
    },
    INSUFFICIENT_CONFIDENTIAL_BALANCE: (e: ZamaError) => {
      const x = e as InsufficientConfidentialBalanceError;
      return `Not enough confidential balance (have ${x.available}, need ${x.requested}).`;
    },
    RELAYER_REQUEST_FAILED: (e: ZamaError) => {
      const x = e as RelayerRequestFailedError;
      const code = x.statusCode != null ? ` (${String(x.statusCode)})` : '';
      return `Relayer request failed${code}. Check network and API key.`;
    },
    TRANSACTION_REVERTED: (e: ZamaError) =>
      `Transaction reverted: ${(e as TransactionRevertedError).message}`,
    CONFIGURATION: (e: ZamaError) =>
      `Configuration error: ${(e as ConfigurationError).message}`,
    _: () => cause || err.message,
  });
  return mapped ?? cause ?? err.message;
}
