import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, message } from 'antd';
import clsx from 'clsx';
import { useTranslation } from 'react-i18next';
import { formatUnits } from 'viem';
import {
  MAINNET_CHAIN_ID,
  SEPOLIA_CHAIN_ID,
} from '@/utils/zamaShield/constants';
import type { ZamaShieldChainId } from '@/utils/zamaShield/zamaShieldChain';
import {
  ConfidentialTokenDefinition,
  getConfidentialTokensForChain,
  getUnderlyingPublicSymbol,
} from '@/utils/zamaShield/registry';
import {
  useBatchDecryptAllConfidential,
  useConfidentialBalanceHandle,
  usePublicBalance,
} from './useZamaShield';
import { WrapModal } from './WrapModal';
import { UnwrapModal } from './UnwrapModal';
import { SendModal } from './SendModal';
import { TokenLogo } from './TokenLogo';
import { useTokenLogo } from './useTokenLogo';

const TokenRow: React.FC<{
  token: ConfidentialTokenDefinition;
  chainId: number;
  layout: 'popup' | 'desktop';
  /** Cleartext once decrypted via “Decrypt all”; `undefined` means not revealed yet. */
  revealedCleartext: bigint | undefined;
  onWrap: () => void;
  onUnwrap: () => void;
  onSend: () => void;
}> = ({
  token,
  chainId,
  layout,
  revealedCleartext,
  onWrap,
  onUnwrap,
  onSend,
}) => {
  const { t } = useTranslation();
  const publicSymbol = getUnderlyingPublicSymbol(token);
  const logoSize = 32;
  const logoUrl = useTokenLogo(token);

  const { balanceFormatted, loading: pubLoading } = usePublicBalance(
    token,
    chainId
  );
  const { hasBalance } = useConfidentialBalanceHandle(token, chainId);

  const hasRevealed = revealedCleartext !== undefined;

  const confidentialDisplay = hasRevealed
    ? `${formatUnits(revealedCleartext, token.decimals)} ${token.symbol}`
    : '••••••';

  return (
    <div
      className={clsx(
        'bg-r-neutral-card1 rounded-[8px] flex flex-col',
        layout === 'desktop'
          ? 'p-[14px] gap-[10px] max-w-full'
          : 'p-[16px] gap-[12px]'
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-[12px] min-w-0">
          <TokenLogo
            src={logoUrl ?? undefined}
            alt={token.symbol}
            size={logoSize}
          />
          <div className="flex flex-col min-w-0">
            <span
              className={clsx(
                'text-r-neutral-title1 font-medium leading-[18px]',
                layout === 'desktop' ? 'text-[14px]' : 'text-[15px]'
              )}
            >
              {publicSymbol}
            </span>
            <span className="text-r-neutral-foot text-[11px] truncate">
              {token.address.slice(0, 6)}…{token.address.slice(-4)}
            </span>
          </div>
        </div>
        <div className="flex flex-col items-end">
          <span className="text-r-neutral-title1 text-[14px] font-medium">
            {pubLoading ? '…' : `${balanceFormatted} ${publicSymbol}`}
          </span>
          <span className="text-r-neutral-foot text-[11px]">
            {t('page.zamaShield.publicBalance', {
              defaultValue: 'Public balance',
            })}
          </span>
        </div>
      </div>

      <div
        className={clsx(
          'rounded-[6px] px-[10px] py-[8px] flex items-center',
          'bg-r-blue-light1 border border-r-blue-light2'
        )}
      >
        <div className="flex flex-col">
          <span className="text-r-blue-default text-[11px] uppercase tracking-wide">
            {t('page.zamaShield.confidentialBalance', {
              defaultValue: 'Confidential',
            })}
          </span>
          <span className="text-r-neutral-title1 text-[14px] font-medium font-mono">
            {hasBalance || hasRevealed
              ? confidentialDisplay
              : t('page.zamaShield.empty', { defaultValue: 'Empty' })}
          </span>
        </div>
      </div>

      <div
        className={clsx(
          'grid grid-cols-3',
          layout === 'desktop' ? 'gap-[6px]' : 'gap-[8px]'
        )}
      >
        <Button
          type="primary"
          ghost
          block
          size={layout === 'desktop' ? 'small' : 'middle'}
          onClick={onWrap}
        >
          {t('page.zamaShield.actions.wrap', { defaultValue: 'Shield' })}
        </Button>
        <Button
          type="primary"
          ghost
          block
          size={layout === 'desktop' ? 'small' : 'middle'}
          onClick={onUnwrap}
          disabled={!hasBalance}
        >
          {t('page.zamaShield.actions.unwrap', { defaultValue: 'Unshield' })}
        </Button>
        <Button
          type="primary"
          ghost
          block
          size={layout === 'desktop' ? 'small' : 'middle'}
          onClick={onSend}
          disabled={!hasBalance}
        >
          {t('page.zamaShield.actions.send', { defaultValue: 'Send' })}
        </Button>
      </div>
    </div>
  );
};

/** In-page Mainnet / Sepolia tabs — chain comes from tab state, not Rabby’s global network. */
export const ChainSwitcher: React.FC<{
  value: ZamaShieldChainId;
  onChange: (chain: ZamaShieldChainId) => void;
}> = ({ value, onChange }) => {
  const { t } = useTranslation();
  const tabs: { id: ZamaShieldChainId; label: string }[] = [
    {
      id: MAINNET_CHAIN_ID,
      label: t('page.zamaShield.chains.mainnet', { defaultValue: 'Ethereum' }),
    },
    {
      id: SEPOLIA_CHAIN_ID,
      label: t('page.zamaShield.chains.sepolia', { defaultValue: 'Sepolia' }),
    },
  ];
  return (
    <div className="bg-r-neutral-card2 rounded-[8px] p-[2px] flex">
      {tabs.map((tab) => (
        <div
          key={tab.id}
          role="button"
          tabIndex={0}
          onClick={() => onChange(tab.id)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') onChange(tab.id);
          }}
          className={clsx(
            'flex-1 py-[6px] px-[12px] rounded-[6px] text-center text-[13px] cursor-pointer transition-colors',
            value === tab.id
              ? 'bg-r-neutral-card1 text-r-neutral-title1 font-medium shadow-sm'
              : 'text-r-neutral-foot'
          )}
        >
          {tab.label}
        </div>
      ))}
    </div>
  );
};

type ShieldListProps = {
  chainId: ZamaShieldChainId;
  layout?: 'popup' | 'desktop';
};

// Shared list of confidential tokens + their wrap/unwrap/send modals. Reused
// by both the popup `/zama-shield` route and the desktop "Shielded" tab so
// behaviour stays consistent across surfaces.
export const ShieldList: React.FC<ShieldListProps> = ({
  chainId,
  layout = 'popup',
}) => {
  const { t } = useTranslation();
  const tokens = useMemo(() => getConfidentialTokensForChain(chainId), [
    chainId,
  ]);

  const [cleartextById, setCleartextById] = useState<Record<string, bigint>>(
    {}
  );
  const { decryptAllTokens, decryptingAll } = useBatchDecryptAllConfidential(
    chainId,
    tokens
  );

  useEffect(() => {
    setCleartextById({});
  }, [chainId]);

  const onDecryptAll = useCallback(async () => {
    const already = new Set(Object.keys(cleartextById));
    try {
      const next = await decryptAllTokens(tokens, already);
      if (Object.keys(next).length === 0) {
        message.info(
          t('page.zamaShield.decryptAllAlreadyShown', {
            defaultValue:
              'All confidential balances on this network are already shown.',
          })
        );
        return;
      }
      setCleartextById((prev) => ({ ...prev, ...next }));
    } catch (err) {
      message.error(
        err instanceof Error
          ? err.message
          : t('page.zamaShield.decryptAllFailed', {
              defaultValue: 'Batch decrypt failed',
            })
      );
    }
  }, [cleartextById, decryptAllTokens, t, tokens]);

  const [
    wrapToken,
    setWrapToken,
  ] = useState<ConfidentialTokenDefinition | null>(null);
  const [
    unwrapToken,
    setUnwrapToken,
  ] = useState<ConfidentialTokenDefinition | null>(null);
  const [
    sendToken,
    setSendToken,
  ] = useState<ConfidentialTokenDefinition | null>(null);

  return (
    <>
      {tokens.length === 0 ? (
        <div className="text-center text-r-neutral-foot text-[13px] py-[40px]">
          {t('page.zamaShield.emptyChain', {
            defaultValue:
              'No confidential tokens registered for this chain yet.',
          })}
        </div>
      ) : (
        <div
          className={clsx(
            'flex flex-col',
            layout === 'desktop' ? 'gap-[12px]' : 'gap-[10px]'
          )}
        >
          <div
            className={clsx(
              'flex justify-end',
              layout === 'desktop' ? 'mb-[2px]' : 'mb-[4px]'
            )}
          >
            <Button
              type="primary"
              size={layout === 'desktop' ? 'small' : 'middle'}
              loading={decryptingAll}
              onClick={() => void onDecryptAll()}
            >
              {decryptingAll
                ? t('page.zamaShield.decryptAllBusy', {
                    defaultValue: 'Decrypting…',
                  })
                : t('page.zamaShield.decryptAll', {
                    defaultValue: 'Decrypt all',
                  })}
            </Button>
          </div>
          {tokens.map((token) => (
            <TokenRow
              key={`${chainId}:${token.id}`}
              token={token}
              chainId={chainId}
              layout={layout}
              revealedCleartext={cleartextById[token.id]}
              onWrap={() => setWrapToken(token)}
              onUnwrap={() => setUnwrapToken(token)}
              onSend={() => setSendToken(token)}
            />
          ))}
        </div>
      )}

      {wrapToken && (
        <WrapModal
          visible={!!wrapToken}
          onClose={() => setWrapToken(null)}
          token={wrapToken}
          chainId={chainId}
        />
      )}
      {unwrapToken && (
        <UnwrapModal
          visible={!!unwrapToken}
          onClose={() => setUnwrapToken(null)}
          token={unwrapToken}
          chainId={chainId}
        />
      )}
      {sendToken && (
        <SendModal
          visible={!!sendToken}
          onClose={() => setSendToken(null)}
          token={sendToken}
          chainId={chainId}
        />
      )}
    </>
  );
};

export default ShieldList;
