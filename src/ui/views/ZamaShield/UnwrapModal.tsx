import React, { useMemo, useState } from 'react';
import { Modal, Input, Button } from 'antd';
import {
  CheckOutlined,
  CloseOutlined,
  LoadingOutlined,
} from '@ant-design/icons';
import clsx from 'clsx';
import { useTranslation } from 'react-i18next';
import { parseUnits } from 'viem';
import {
  ConfidentialTokenDefinition,
  getUnderlyingPublicSymbol,
} from '@/utils/zamaShield/registry';
import { UnwrapStep, useUnwrap } from './useZamaShield';

type Props = {
  visible: boolean;
  onClose: () => void;
  token: ConfidentialTokenDefinition;
  chainId: number;
};

type StepKey = 'confirming' | 'getting_proof' | 'finalizing';

const STEP_ORDER: StepKey[] = ['confirming', 'getting_proof', 'finalizing'];

// Map every UnwrapStep to the visible milestone step it currently lives in.
// When `done`, return STEP_ORDER.length so every index i satisfies i < length
// and all three circles render as checkmarks (not the last one still "active").
function activeStepFor(step: UnwrapStep): number {
  switch (step) {
    case 'idle':
      return -1;
    case 'encrypting':
    case 'submitting':
    case 'confirming':
      return 0;
    case 'getting_proof':
      return 1;
    case 'finalizing':
      return 2;
    case 'done':
      return STEP_ORDER.length;
    case 'failed':
      return -2;
  }
}

const StepCircle: React.FC<{
  state: 'pending' | 'active' | 'done' | 'failed';
}> = ({ state }) => (
  <div
    className={clsx(
      'w-[24px] h-[24px] rounded-full flex items-center justify-center shrink-0 border',
      state === 'pending' &&
        'border-r-neutral-line bg-r-neutral-card2 text-r-neutral-foot',
      state === 'active' &&
        'border-r-blue-default bg-r-blue-light1 text-r-blue-default',
      state === 'done' && 'border-transparent bg-r-green-default text-white',
      state === 'failed' && 'border-transparent bg-r-red-default text-white'
    )}
  >
    {state === 'active' && <LoadingOutlined className="text-[14px]" spin />}
    {state === 'done' && <CheckOutlined className="text-[14px]" />}
    {state === 'failed' && <CloseOutlined className="text-[14px]" />}
  </div>
);

const StepConnector: React.FC<{ active: boolean; failed: boolean }> = ({
  active,
  failed,
}) => (
  <div
    className={clsx(
      'w-[2px] h-[24px] ml-[11px] my-[2px]',
      failed
        ? 'bg-r-red-default'
        : active
        ? 'bg-r-blue-default'
        : 'bg-r-neutral-line'
    )}
  />
);

export const UnwrapModal: React.FC<Props> = ({
  visible,
  onClose,
  token,
  chainId,
}) => {
  const { t } = useTranslation();
  const [amount, setAmount] = useState('');
  const publicSymbol = getUnderlyingPublicSymbol(token);

  const { state, unwrap, reset } = useUnwrap(token, chainId);
  const inFlight =
    state.step !== 'idle' && state.step !== 'done' && state.step !== 'failed';

  const isInvalid = useMemo(() => {
    if (!amount) return true;
    try {
      return parseUnits(amount, token.decimals) <= 0n;
    } catch {
      return true;
    }
  }, [amount, token.decimals]);

  const stepLabels: Record<StepKey, string> = {
    confirming: t('page.zamaShield.unwrap.steps.confirming', {
      defaultValue: 'Transaction is being confirmed',
    }),
    getting_proof: t('page.zamaShield.unwrap.steps.publicDecrypt', {
      defaultValue: 'Public decryption step',
    }),
    finalizing: t('page.zamaShield.unwrap.steps.finalize', {
      defaultValue: 'Final unshield step',
    }),
  };

  const stepHints: Record<StepKey, string> = {
    confirming: t('page.zamaShield.unwrap.hints.confirming', {
      defaultValue: 'Waiting for the unshield transaction to be mined.',
    }),
    getting_proof: t('page.zamaShield.unwrap.hints.publicDecrypt', {
      defaultValue:
        'Asking the relayer for the decryption proof of your burnt amount.',
    }),
    finalizing: t('page.zamaShield.unwrap.hints.finalize', {
      defaultValue:
        'Submitting the final on-chain step to release the public {{symbol}}.',
      symbol: publicSymbol,
    }),
  };

  const initialStepLabel = t('page.zamaShield.unwrap.encrypting', {
    defaultValue: 'Encrypting with the relayer…',
  });

  const activeStep = activeStepFor(state.step);
  const failed = state.step === 'failed';

  const handleClose = () => {
    if (inFlight) return;
    reset();
    setAmount('');
    onClose();
  };

  const handleStart = () => {
    void unwrap(amount);
  };

  return (
    <Modal
      visible={visible}
      onCancel={handleClose}
      maskClosable={!inFlight}
      closable={!inFlight}
      destroyOnClose
      footer={null}
      width={420}
      title={
        <span className="text-r-neutral-title1 text-[16px] font-medium">
          {t('page.zamaShield.unwrap.title', {
            defaultValue: 'Unshield {{symbol}}',
            symbol: token.symbol,
          })}
        </span>
      }
    >
      {state.step === 'idle' || state.step === 'failed' ? (
        <div className="flex flex-col gap-[12px] mt-[8px]">
          <div className="text-r-neutral-foot text-[12px]">
            {t('page.zamaShield.unwrap.description', {
              defaultValue:
                'Burns confidential {{conf}} and releases the public {{public}} after the relayer proves the amount.',
              conf: token.symbol,
              public: publicSymbol,
            })}
          </div>
          <Input
            autoFocus
            inputMode="decimal"
            placeholder="0.0"
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ''))}
            suffix={token.symbol}
          />
          {state.error && (
            <div className="text-[12px] text-r-red-default px-[8px] py-[6px] rounded-[6px] bg-r-red-light">
              {state.error}
            </div>
          )}
          <Button
            type="primary"
            block
            size="large"
            disabled={isInvalid}
            onClick={handleStart}
          >
            {t('page.zamaShield.unwrap.cta', {
              defaultValue: 'Unshield to {{symbol}}',
              symbol: publicSymbol,
            })}
          </Button>
        </div>
      ) : (
        <div className="flex flex-col mt-[12px]">
          <div className="text-r-neutral-body text-[13px] mb-[16px]">
            {state.step === 'encrypting' || state.step === 'submitting'
              ? initialStepLabel
              : t('page.zamaShield.unwrap.tracker', {
                  defaultValue: 'Tracking your unwrap on-chain…',
                })}
          </div>

          {state.step === 'encrypting' || state.step === 'submitting' ? (
            <div className="flex items-center gap-[10px] py-[12px]">
              <StepCircle state="active" />
              <span className="text-r-neutral-title1 text-[13px]">
                {initialStepLabel}
              </span>
            </div>
          ) : (
            <div className="flex flex-col">
              {STEP_ORDER.map((key, idx) => {
                let stepState: 'pending' | 'active' | 'done' | 'failed';
                if (failed && idx === activeStep) stepState = 'failed';
                else if (idx < activeStep) stepState = 'done';
                else if (idx === activeStep) stepState = 'active';
                else stepState = 'pending';
                return (
                  <React.Fragment key={key}>
                    <div className="flex items-start gap-[12px] py-[2px]">
                      <StepCircle state={stepState} />
                      <div className="flex-1 pt-[2px]">
                        <div
                          className={clsx(
                            'text-[13px] font-medium',
                            stepState === 'done' && 'text-r-neutral-title1',
                            stepState === 'active' && 'text-r-neutral-title1',
                            stepState === 'pending' && 'text-r-neutral-foot',
                            stepState === 'failed' && 'text-r-red-default'
                          )}
                        >
                          {stepLabels[key]}
                        </div>
                        {stepState === 'active' && (
                          <div className="text-[11px] text-r-neutral-foot mt-[2px]">
                            {stepHints[key]}
                          </div>
                        )}
                      </div>
                    </div>
                    {idx < STEP_ORDER.length - 1 && (
                      <StepConnector
                        active={idx < activeStep}
                        failed={failed && idx < activeStep}
                      />
                    )}
                  </React.Fragment>
                );
              })}
            </div>
          )}

          {state.step === 'done' && (
            <div className="mt-[16px] text-center text-r-green-default text-[13px] font-medium">
              {t('page.zamaShield.unwrap.success', {
                defaultValue: 'Unshield finalized — {{symbol}} released.',
                symbol: publicSymbol,
              })}
            </div>
          )}

          {state.step === 'done' && (
            <Button
              className="mt-[16px]"
              block
              size="large"
              type="primary"
              onClick={handleClose}
            >
              {t('global.close', { defaultValue: 'Close' })}
            </Button>
          )}
        </div>
      )}
    </Modal>
  );
};

export default UnwrapModal;
