import { type FC, useEffect } from 'react';
import Skeleton from 'react-loading-skeleton';
import { format } from 'date-fns';
import type { UserProps } from '@barakath/shared/types';
import { useAppDispatch, useAppSelector } from '@/stores/store';
import Icon from '@/components/icons/Icon';
import { formatINR } from '@/utils/format';
import { fetchCustomerAffiliateTransactions } from '../api/fetchCustomerAffiliateTransactions';
import { TxnTypeCell, TxnAmount, SourceBadge } from './ui';

/** Affiliate ledger status pill: Cleared (green), Pending (amber), Withdrawn (gray) (spec §1.8). */
const AffiliateStatusBadge: FC<{ status: string }> = ({ status }) => {
  const tone =
    status === 'Cleared'
      ? 'bg-success-subtle text-success'
      : status === 'Pending'
        ? 'bg-warning-subtle text-warning'
        : 'bg-subtle text-muted';
  return (
    <span className={`inline-flex items-center rounded-sm px-2 py-0.5 text-[11px] font-bold ${tone}`}>
      {status}
    </span>
  );
};

/**
 * CustomerAffiliateTab — the customer's affiliate code, balance and commission/withdrawal ledger (spec
 * §1.8 Affiliate wallet tab). Non-affiliates (no `affiliateCode`) get a dedicated empty state. Loads its
 * first page lazily on mount and paginates via "View More".
 */
const CustomerAffiliateTab: FC<{ customer: UserProps }> = ({ customer }) => {
  const dispatch = useAppDispatch();
  const {
    affiliateTransactions,
    affiliateHasMore,
    affiliateLoading,
    affiliateLoadingMore,
    affiliateLastVisible,
  } = useAppSelector((s) => s.customers);

  const isAffiliate = !!customer.affiliateCode;

  useEffect(() => {
    if (isAffiliate && affiliateTransactions.length === 0)
      void dispatch(fetchCustomerAffiliateTransactions({ userId: customer.id, cursor: null }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatch, customer.id]);

  if (!isAffiliate) {
    return (
      <p className="py-10 text-center text-[14px] text-muted">
        Customer is not part of the affiliate program
      </p>
    );
  }

  return (
    <div>
      {/* Slim balance header, matching the Wallet tab's treatment (design screen 46: icon + "Affiliate
          wallet" + balance). The referral code itself lives in the sidebar card, not repeated here. */}
      <div className="mb-3 flex items-center gap-2.5">
        <Icon name="UserHeartLine" size={18} className="text-primary" />
        <span className="text-[14px] font-bold text-foreground">Affiliate wallet</span>
        <span className="ml-auto text-[16px] font-extrabold text-foreground">
          {formatINR(customer.affiliateBalance ?? 0)}
        </span>
      </div>

      {/* History */}
      {affiliateLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} height={44} borderRadius={10} />
          ))}
        </div>
      ) : affiliateTransactions.length === 0 ? (
        <p className="py-10 text-center text-[14px] text-muted">No affiliate activity</p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-surface">
          <table className="w-full">
            <thead className="border-b border-border bg-subtle/50">
              <tr>
                {['Type', 'Source', 'Referred user', 'Status', 'Date', 'Amount'].map((h, i) => (
                  <th
                    key={h}
                    className={`px-5 py-3 text-[11px] font-semibold uppercase tracking-wide text-faint ${i === 5 ? 'text-right' : 'text-left'}`}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {affiliateTransactions.map((t) => (
                <tr key={t.id} className="border-b border-border last:border-0">
                  <td className="px-5 py-3"><TxnTypeCell type={t.type} /></td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <SourceBadge source={t.source} />
                      {t.description && <span className="text-[12px] text-muted">{t.description}</span>}
                    </div>
                  </td>
                  <td className="px-5 py-3 text-[13px] text-muted">{t.referredUserName || '—'}</td>
                  <td className="px-5 py-3"><AffiliateStatusBadge status={t.status} /></td>
                  <td className="px-5 py-3 text-[13px] text-muted">
                    {t.createdAt ? format(t.createdAt.toDate(), 'dd MMM yyyy') : '—'}
                  </td>
                  <td className="px-5 py-3 text-right"><TxnAmount type={t.type} amount={t.amount} /></td>
                </tr>
              ))}
            </tbody>
          </table>

          {affiliateLoadingMore && (
            <div className="p-3">
              <Skeleton height={40} borderRadius={8} />
            </div>
          )}
          {affiliateHasMore && !affiliateLoadingMore && (
            <div className="flex justify-center border-t border-border p-3">
              <button
                type="button"
                onClick={() =>
                  dispatch(
                    fetchCustomerAffiliateTransactions({ userId: customer.id, cursor: affiliateLastVisible }),
                  )
                }
                className="rounded-md border border-border-strong px-4 py-2 text-[14px] font-semibold text-foreground hover:bg-subtle"
              >
                View More
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default CustomerAffiliateTab;
