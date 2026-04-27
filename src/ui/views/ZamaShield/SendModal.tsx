import React, { useMemo, useState } from 'react';
import { Modal, Input, Button, message } from 'antd';
import { useTranslation } from 'react-i18next';
import { isAddress, parseUnits } from 'viem';
import { ConfidentialTokenDefinition } from '@/utils/zamaShield/registry';
import { useConfidentialTransfer } from './useZamaShield';

type Props = {
  visible: boolean;
  onClose: () => void;
  token: ConfidentialTokenDefinition;
  chainId: number;
};

export const SendModal: React.FC<Props> = ({
  visible,
  onClose,
  token,
  chainId,
}) => {
  const { t } = useTranslation();
  const [to, setTo] = useState('');
  const [amount, setAmount] = useState('');
  const { transfer, pending } = useConfidentialTransfer(token, chainId);

  const isInvalid = useMemo(() => {
    if (!isAddress(to)) return true;
    if (!amount) return true;
    try {
      return parseUnits(amount, token.decimals) <= 0n;
    } catch {
      return true;
    }
  }, [to, amount, token.decimals]);

  const handleSend = async () => {
    try {
      await transfer(to as `0x${string}`, amount);
      message.success(
        t('page.zamaShield.send.submitted', {
          defaultValue: 'Confidential transfer submitted',
        })
      );
      setAmount('');
      setTo('');
      onClose();
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Send failed');
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
          {t('page.zamaShield.send.title', {
            defaultValue: 'Send {{symbol}}',
            symbol: token.symbol,
          })}
        </span>
      }
      width={400}
    >
      <div className="flex flex-col gap-[12px] mt-[8px]">
        <div className="text-r-neutral-foot text-[12px]">
          {t('page.zamaShield.send.description', {
            defaultValue:
              'The recipient and the amount are encrypted on-chain — only the parties involved can decrypt.',
          })}
        </div>
        <div className="text-[12px] text-r-neutral-body">
          {t('page.zamaShield.send.toLabel', { defaultValue: 'Recipient' })}
        </div>
        <Input
          placeholder="0x…"
          value={to}
          onChange={(e) => setTo(e.target.value.trim())}
          maxLength={42}
        />
        <div className="text-[12px] text-r-neutral-body">
          {t('page.zamaShield.send.amountLabel', {
            defaultValue: 'Amount',
          })}
        </div>
        <Input
          inputMode="decimal"
          placeholder="0.0"
          value={amount}
          onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ''))}
          suffix={token.symbol}
        />
        <Button
          type="primary"
          block
          size="large"
          loading={pending}
          disabled={isInvalid || pending}
          onClick={handleSend}
        >
          {t('page.zamaShield.send.cta', {
            defaultValue: 'Send {{symbol}}',
            symbol: token.symbol,
          })}
        </Button>
      </div>
    </Modal>
  );
};

export default SendModal;
