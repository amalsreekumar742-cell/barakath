import { type FC, useEffect, useState } from 'react';
import Skeleton from 'react-loading-skeleton';
import type { AffiliateWithdrawalProps } from '@barakath/shared/types';
import { AffiliateWithdrawalStatus } from '@barakath/shared/config/enums';
import { useAppDispatch, useAppSelector } from '@/stores/store';
import Icon from '@/components/icons/Icon';
import { formatINR, formatShortDate } from '@/utils/format';
import { fetchWithdrawals } from '../api/fetchWithdrawals';
import { fetchWithdrawalStatusCounts } from '../api/fetchWithdrawalStatusCounts';
import { setWithdrawalStatusFilter } from '../stores/affiliateSlice';
import { WithdrawalStatusBadge, maskAccount } from './ui';
import ApproveWithdrawalModal from './ApproveWithdrawalModal';
import RejectWithdrawalModal from './RejectWithdrawalModal';

const STATUS_TABS: { label: string; value: string; countKey: 'all' | 'pending' | 'approved' | 'rejected' }[] = [
  { label: 'All', value: '', countKey: 'all' },
  { label: 'Pending', value: AffiliateWithdrawalStatus.PENDING, countKey: 'pending' },
  { label: 'Approved', value: AffiliateWithdrawalStatus.APPROVED, countKey: 'approved' },
  { label: 'Rejected', value: AffiliateWithdrawalStatus.REJECTED, countKey: 'rejected' },
];

/**
 * WithdrawalsTab — affiliate withdrawal requests with status filter pills (badge counts), a paginated
 * table, and Approve / Reject actions on pending rows (spec §1.14). Approve deducts the amount from the
 * affiliate's balance (via the Approve modal); Reject records a reason. Changing the status pill resets
 * the list to page one.
 */
const WithdrawalsTab: FC = () => {
  const dispatch = useAppDispatch();
  const {
    withdrawals,
    withdrawalsHasMore,
    withdrawalsLoading,
    withdrawalsLoadingMore,
    withdrawalsError,
    withdrawalsLastVisible,
    withdrawalStatusFilter,
    withdrawalCounts,
  } = useAppSelector((s) => s.affiliate);

  const [approveTarget, setApproveTarget] = useState<AffiliateWithdrawalProps | null>(null);
  const [rejectTarget, setRejectTarget] = useState<AffiliateWithdrawalProps | null>(null);

  useEffect(() => {
    void dispatch(fetchWithdrawalStatusCounts());
  }, [dispatch]);

  useEffect(() => {
    void dispatch(fetchWithdrawals({ status: withdrawalStatusFilter, cursor: null }));
  }, [dispatch, withdrawalStatusFilter]);

  const emptyLabel =
    withdrawalStatusFilter === AffiliateWithdrawalStatus.PENDING
      ? 'No pending withdrawal requests'
      : withdrawalStatusFilter === AffiliateWithdrawalStatus.APPROVED
        ? 'No approved withdrawals'
        : withdrawalStatusFilter === AffiliateWithdrawalStatus.REJECTED
          ? 'No rejected withdrawals'
          : 'No withdrawal requests yet';

  return (
    <div>
      {/* Status pills with counts */}
      <div className="mb-4 flex gap-1.5 overflow-x-auto">
        {STATUS_TABS.map((tab) => {
          const active = withdrawalStatusFilter === tab.value;
          return (
            <button
              key={tab.label}
              type="button"
              onClick={() => dispatch(setWithdrawalStatusFilter(tab.value))}
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-pill border px-3 py-1.5 text-[12px] font-semibold transition-colors ${
                active
                  ? 'border-primary bg-primary-subtle text-primary'
                  : 'border-border-strong text-muted hover:bg-subtle'
              }`}
            >
              {tab.label}
              <span
                className={`rounded-pill px-1.5 text-[11px] font-bold ${
                  active ? 'bg-primary text-white' : 'bg-subtle text-faint'
                }`}
              >
                {withdrawalCounts[tab.countKey]}
              </span>
            </button>
          );
        })}
      </div>

      {/* Body */}
      {withdrawalsLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} height={56} borderRadius={12} />
          ))}
        </div>
      ) : withdrawalsError ? (
        <div className="rounded-xl border border-border bg-surface p-10 text-center">
          <p className="text-[14px] text-muted">{withdrawalsError}</p>
          <button
            type="button"
            onClick={() => dispatch(fetchWithdrawals({ status: withdrawalStatusFilter, cursor: null }))}
            className="mt-3 rounded-md bg-primary px-4 py-2 text-[14px] font-semibold text-white hover:bg-primary-dark"
          >
            Retry
          </button>
        </div>
      ) : withdrawals.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface p-12 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-primary-subtle text-primary">
            <Icon name="WalletLine" size={28} />
          </div>
          <h2 className="text-[16px] font-bold text-foreground">{emptyLabel}</h2>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-surface shadow-sm">
          <table className="w-full min-w-[980px]">
            <thead className="border-b border-border bg-subtle/50">
              <tr>
                {['User', 'Phone', 'Amount', 'Bank', 'Account', 'IFSC', 'Status', 'Date', ''].map((h, i) => (
                  <th
                    key={h || `actions-${i}`}
                    className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wide text-faint"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {withdrawals.map((w) => {
                const pending = w.status === AffiliateWithdrawalStatus.PENDING;
                return (
                  <tr key={w.id} className="border-b border-border last:border-0 hover:bg-subtle/40">
                    <td className="px-4 py-3 text-[13px] font-semibold text-foreground">{w.userName || '—'}</td>
                    <td className="px-4 py-3 text-[13px] text-muted">{w.userPhone || '—'}</td>
                    <td className="px-4 py-3 text-[13px] font-bold text-foreground">{formatINR(w.amount)}</td>
                    <td className="px-4 py-3 text-[13px] text-muted">{w.bankName || '—'}</td>
                    <td className="px-4 py-3 font-mono text-[12px] text-muted">{maskAccount(w.accountNumber)}</td>
                    <td className="px-4 py-3 font-mono text-[12px] text-muted">{w.ifscCode || '—'}</td>
                    <td className="px-4 py-3">
                      <WithdrawalStatusBadge status={w.status} />
                    </td>
                    <td className="px-4 py-3 text-[13px] text-muted">{formatShortDate(w.createdAt)}</td>
                    <td className="px-4 py-3">
                      {pending ? (
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setApproveTarget(w)}
                            className="inline-flex items-center rounded-md bg-primary px-3 py-1.5 text-[12px] font-semibold text-white transition-colors hover:bg-primary-dark"
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            onClick={() => setRejectTarget(w)}
                            className="inline-flex items-center rounded-md px-3 py-1.5 text-[12px] font-semibold text-error transition-colors hover:bg-error-subtle"
                          >
                            Reject
                          </button>
                        </div>
                      ) : (
                        <span className="text-[12px] text-faint">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {withdrawalsLoadingMore && (
            <div className="p-3">
              <Skeleton height={44} borderRadius={8} />
            </div>
          )}
          {withdrawalsHasMore && !withdrawalsLoadingMore && (
            <div className="flex justify-center border-t border-border p-3">
              <button
                type="button"
                onClick={() =>
                  dispatch(fetchWithdrawals({ status: withdrawalStatusFilter, cursor: withdrawalsLastVisible }))
                }
                className="rounded-md border border-border-strong px-4 py-2 text-[14px] font-semibold text-foreground hover:bg-subtle"
              >
                View More
              </button>
            </div>
          )}
        </div>
      )}

      <ApproveWithdrawalModal withdrawal={approveTarget} onClose={() => setApproveTarget(null)} />
      <RejectWithdrawalModal withdrawal={rejectTarget} onClose={() => setRejectTarget(null)} />
    </div>
  );
};

export default WithdrawalsTab;
