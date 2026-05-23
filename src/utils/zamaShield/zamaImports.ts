/**
 * Single import surface for Zama in Rabby (webpack must resolve one @zama-fhe/sdk copy).
 * App code should import from here, not mix paths that webpack can duplicate.
 */
export {
  ZamaProvider,
  IndexedDBStorage,
  indexedDBStorage,
  chromeSessionStorage,
  RelayerWeb,
  MainnetConfig,
  SepoliaConfig,
  useAllow,
  useApproveUnderlying,
  useConfidentialBalance,
  useConfidentialBalances,
  useConfidentialTransfer,
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
  ApprovalFailedError,
  EncryptionFailedError,
  matchZamaError,
} from '@zama-fhe/react-sdk';
export type {
  ConfigurationError,
  InsufficientConfidentialBalanceError,
  InsufficientERC20BalanceError,
  RelayerRequestFailedError,
  TransactionRevertedError,
  ZamaError,
} from '@zama-fhe/react-sdk';
export { ViemSigner } from '@zama-fhe/sdk/viem';
