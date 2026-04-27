import React, { useMemo, useState } from 'react';
import { Modal, Input, Button, message } from 'antd';
import { useTranslation } from 'react-i18next';
import { formatUnits, parseUnits } from 'viem';
import {
  ConfidentialTokenDefinition,
  getUnderlyingPublicSymbol,
} from '@/utils/zamaShield/registry';
import { usePublicBalance, useWrap } from './useZamaShield';

type Props = {
  visible: boolean;
  onClose: () => void;
  token: ConfidentialTokenDefinition;
  chainId: number;
};

export const WrapModal: React.FC<Props> = ({
  visible,
  onClose,
  token,
  chainId,
}) => {
  const { t } = useTranslation();
  const [amount, setAmount] = useState('');
  const publicSymbol = getUnderlyingPublicSymbol(token);

  const { balance, balanceFormatted, allowance, refetch } = usePublicBalance(
    token,
    chainId
  );
  const { wrap, pending } = useWrap(token, chainId);

  const isAmountInvalid = useMemo(() => {
    if (!amount) return true;
    try {
      const wei = parseUnits(amount, token.decimals);
      return wei <= 0n || wei > balance;
    } catch {
      return true;
    }
  }, [amount, balance, token.decimals]);

  const handleMax = () => setAmount(balanceFormatted);

  const handleWrap = async () => {
    try {
      await wrap(amount, allowance);
      message.success(
        t('page.zamaShield.wrap.submitted', {
          defaultValue: 'Wrap submitted',
        })
      );
      setAmount('');
      void refetch();
      onClose();
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Wrap failed');
    }
  };

  return (
    <Modal
      visible={visible}
      onCancel={onClose}
      footer={null}
      destroyOnClose
      title={
        <span className="text-r-neutral-title1 text-[16px] font-medium">
          {t('page.zamaShield.wrap.title', {
            defaultValue: 'Wrap {{symbol}}',
            symbol: publicSymbol,
          })}
        </span>
      }
      width={400}
    >
      <div className="flex flex-col gap-[12px] mt-[8px]">
        <div className="text-r-neutral-foot text-[12px]">
          {t('page.zamaShield.wrap.description', {
            defaultValue:
              'Wrap public {{public}} into confidential {{conf}}. Encrypted at the protocol layer.',
            public: publicSymbol,
            conf: token.symbol,
          })}
        </div>
        <div className="flex items-end justify-between text-[12px] text-r-neutral-body">
          <span>
            {t('page.zamaShield.balance', { defaultValue: 'Balance' })}:{' '}
            {balanceFormatted} {publicSymbol}
          </span>
          <span
            className="text-r-blue-default cursor-pointer"
            onClick={handleMax}
          >
            {t('global.max', { defaultValue: 'Max' })}
          </span>
        </div>
        <Input
          autoFocus
          inputMode="decimal"
          placeholder="0.0"
          value={amount}
          onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ''))}
          suffix={publicSymbol}
        />
        <div className="text-[11px] text-r-neutral-foot">
          {allowance < parseUnits(amount || '0', token.decimals)
            ? t('page.zamaShield.wrap.requiresApproval', {
                defaultValue:
                  'First-time wraps require an ERC-20 approval (one-time).',
              })
            : t('page.zamaShield.wrap.approved', {
                defaultValue: 'Token approved — direct wrap.',
              })}
        </div>
        <Button
          type="primary"
          block
          size="large"
          loading={pending}
          disabled={isAmountInvalid || pending}
          onClick={handleWrap}
        >
          {t('page.zamaShield.wrap.cta', {
            defaultValue: 'Wrap to {{symbol}}',
            symbol: token.symbol,
          })}
        </Button>
      </div>
    </Modal>
  );
};

export default WrapModal;
