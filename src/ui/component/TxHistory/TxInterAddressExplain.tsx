import React, { useMemo } from 'react';
import { useAsync } from 'react-use';
import { NameAndAddress } from '..';
import { getTokenSymbol } from 'ui/utils/token';
import { TxAvatar } from './TxAvatar';
import { useTranslation } from 'react-i18next';
import { TxHistoryItemRow } from '@/db/schema/history';
import { getChain } from '@/utils';
import { useWallet } from 'ui/utils';
import {
  getZamaMethodKeyFromInput,
  ZamaTxMethodKey,
} from '@/utils/zamaShield/abi';
import { findConfidentialTokenByWrapperAddress } from '@/utils/zamaShield/registry';

type TxInterAddressExplainProps = {
  data: TxHistoryItemRow;
};

type ZamaParsed = { method: ZamaTxMethodKey; symbol: string } | null;

// Session cache: one `eth_getTransactionByHash` per chain+hash (rows may repeat).
const zamaTxInputCache = new Map<string, string | undefined | null>();

function zamaCacheKey(chain: string, txId: string) {
  return `${chain}:${txId.toLowerCase()}`;
}

/**
 * When Debank leaves `tx.name` empty for Zama ERC-7984 wrappers, resolve the
 * label from on-chain `input` (same pattern as HistoryItem fetching calldata
 * for the “view input” icon — we only run when `to` matches our registry).
 */
export function useZamaTxHistoryTitle(data: TxHistoryItemRow): string | null {
  const { t, i18n } = useTranslation();
  const wallet = useWallet();

  const { value: parsed } = useAsync(async (): Promise<ZamaParsed> => {
    const chainItem = getChain(data.chain);
    if (!chainItem?.id || !data.id) {
      return null;
    }
    const toAddr = data.tx?.to_addr || data.other_addr;
    if (!toAddr) {
      return null;
    }
    const token = findConfidentialTokenByWrapperAddress(chainItem.id, toAddr);
    if (!token) {
      return null;
    }

    const ckey = zamaCacheKey(data.chain, data.id);
    let input: string | undefined | null;
    if (zamaTxInputCache.has(ckey)) {
      input = zamaTxInputCache.get(ckey);
    } else {
      try {
        const hashDetail = await wallet.requestETHRpc<{
          input: string;
        }>(
          {
            method: 'eth_getTransactionByHash',
            params: [data.id],
          },
          chainItem.serverId
        );
        input = hashDetail?.input;
      } catch {
        input = undefined;
      }
      zamaTxInputCache.set(ckey, input);
    }

    const method = getZamaMethodKeyFromInput(
      typeof input === 'string' ? input : null
    );
    if (!method) {
      return null;
    }
    return { method, symbol: token.symbol };
  }, [data.id, data.chain, data.tx?.to_addr, data.other_addr, wallet]);

  return useMemo(() => {
    if (!parsed) {
      return null;
    }
    return t(`page.zamaShield.txHistory.${parsed.method}`, {
      symbol: parsed.symbol,
    });
  }, [parsed, t, i18n.language]);
}

export const TxInterAddressExplain = ({ data }: TxInterAddressExplainProps) => {
  const isCancel = data.cate_id === 'cancel';
  const isApprove = data.cate_id === 'approve';
  const project = data.project_item;
  const { t } = useTranslation();
  const zamaTitle = useZamaTxHistoryTitle(data);

  const projectName = (
    <span>
      {project?.name ? (
        project.name
      ) : data.other_addr ? (
        <NameAndAddress address={data.other_addr} copyIcon={!data.is_scam} />
      ) : (
        ''
      )}
    </span>
  );

  let interAddressExplain;

  if (isCancel) {
    interAddressExplain = (
      <div className="tx-explain-title">
        {t('page.transactions.explain.cancel')}
      </div>
    );
  } else if (isApprove) {
    const approveToken = data.approve_token;
    const amount = data.token_approve?.value || 0;

    interAddressExplain = (
      <div className="tx-explain-title">
        Approve {amount < 1e9 ? amount.toFixed(4) : 'infinite'}{' '}
        {`${getTokenSymbol(approveToken)} for `}
        {projectName}
      </div>
    );
  } else {
    interAddressExplain = (
      <>
        <div className="tx-explain-title">
          {zamaTitle ??
            data.cate_item?.name ??
            (data.tx?.name || t('page.transactions.explain.unknown'))}
        </div>
        <div className="tx-explain-desc">{projectName}</div>
      </>
    );
  }

  return (
    <div className="ui tx-explain">
      <TxAvatar
        src={data.project_item?.logo_url}
        cateId={data.cate_id}
        className="tx-icon"
      ></TxAvatar>
      <div className="tx-explain-body">{interAddressExplain}</div>
    </div>
  );
};
