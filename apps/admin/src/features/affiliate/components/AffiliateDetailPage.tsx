import { type FC, useEffect } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Skeleton from 'react-loading-skeleton';
import { format } from 'date-fns';
import { useAppDispatch, useAppSelector } from '@/stores/store';
import Icon from '@/components/icons/Icon';
import { formatINR } from '@/utils/format';
import { fetchAffiliateDetail } from '../api/fetchAffiliateDetail';
import { fetchAffiliateTransactions } from '../api/fetchAffiliateTransactions';
import { resetAffiliateDetail } from '../stores/affiliateSlice';
import { Avatar, CopyableCode, LedgerStatusBadge, LedgerTypeCell } from './ui';

const LEDGER_HEADERS = ['Date', 'Type', 'Source', 'Details', 'Order', 'Status', 'Amount', 'Balance after'];

const Stat: FC<{ label: string; value: string; tone?: string }> = ({ label, value, tone }) => (
  <div className="rounded-xl border border-border bg-surface p-4 shadow-sm">
    <p className="text-[12px] font-medium text-faint">{label}</p>
    <p className={`mt-2 text-[22px] font-extrabold leading-none tracking-tight ${tone ?? 'text-foreground'}`}>{value}</p>
  </div>
);

/**
 * AffiliateDetailPage — one affiliate's summary and full transaction ledger (spec §1.14): referral
 * commissions (Pending inside the 7-day hold, then Cleared), withdrawals and reversals, newest first.
 * Lives in the Affiliate feature so an admin with only the Affiliate permission can open it.
 */
const AffiliateDetailPage: FC = () => {
  const { userId = '' } = useParams();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const {
    affiliateDetail: user,
    affiliateDetailLoading,
    affiliateDetailError,
    ledger,
    ledgerHasMore,
    ledgerLoading,
    ledgerLoadingMore,
    ledgerError,
    ledgerLastVisible,
  } = useAppSelector((s) => s.affiliate);

  useEffect(() => {
    void dispatch(fetchAffiliateDetail(userId));
    void dispatch(fetchAffiliateTransactions({ userId, cursor: null }));
    return () => {
      dispatch(resetAffiliateDetail());
    };
  }, [dispatch, userId]);

  if (affiliateDetailLoading || (!user && !affiliateDetailError)) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton height={90} borderRadius={12} />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} height={84} borderRadius={12} />
          ))}
        </div>
        <Skeleton height={260} borderRadius={12} />
      </div>
    );
  }

  if (affiliateDetailError || !user) {
    return (
      <div className="p-6">
        <div className="rounded-xl border border-border bg-surface p-10 text-center">
          <p className="text-[14px] text-muted">{affiliateDetailError ?? 'Affiliate not found'}</p>
          <button
            type="button"
            onClick={() => navigate('/affiliate/affiliates')}
            className="mt-3 rounded-md bg-primary px-4 py-2 text-[14px] font-semibold text-white hover:bg-primary-dark"
          >
            Back to affiliates
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-4 flex flex-wrap items-center gap-4 rounded-xl border border-border bg-surface p-5 shadow-sm">
        <Avatar src={user.profileImage} name={user.fullName} size={52} />
        <div className="min-w-0">
          <h1 className="text-[20px] font-extrabold tracking-tight text-foreground">{user.fullName || '—'}</h1>
          <p className="mt-0.5 text-[13px] text-muted">{user.phone || '—'}</p>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-3">
          {user.affiliateCode && <CopyableCode code={user.affiliateCode} />}
          <span
            className={`inline-flex items-center rounded-sm px-2 py-0.5 text-[11px] font-bold ${
              user.affiliateEnabled ? 'bg-success-subtle text-success' : 'bg-subtle text-muted'
            }`}
          >
            Wallet access {user.affiliateEnabled ? 'enabled' : 'off'}
          </span>
        </div>
      </div>

      {/* Summary */}
      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Affiliate balance" value={formatINR(user.affiliateBalance ?? 0)} />
        <Stat label="Pending commission" value={formatINR(user.pendingCommission ?? 0)} tone="text-gold-strong" />
        <Stat label="Confirmed (lifetime)" value={formatINR(user.confirmedCommission ?? 0)} tone="text-success" />
        <Stat label="Referrals" value={String(user.totalReferrals ?? 0)} />
      </div>

      {/* Ledger */}
      <h2 className="mb-3 text-[14px] font-bold text-foreground">Transactions</h2>
      {ledgerLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} height={48} borderRadius={10} />
          ))}
        </div>
      ) : ledgerError ? (
        <div className="rounded-xl border border-border bg-surface p-10 text-center">
          <p className="text-[14px] text-muted">{ledgerError}</p>
          <button
            type="button"
            onClick={() => dispatch(fetchAffiliateTransactions({ userId, cursor: null }))}
            className="mt-3 rounded-md bg-primary px-4 py-2 text-[14px] font-semibold text-white hover:bg-primary-dark"
          >
            Retry
          </button>
        </div>
      ) : ledger.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface p-12 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-primary-subtle text-primary">
            <Icon name="WalletLine" size={28} />
          </div>
          <h3 className="text-[16px] font-bold text-foreground">No transactions yet</h3>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-surface shadow-sm">
          <table className="w-full min-w-[980px]">
            <thead className="border-b border-border bg-subtle/50">
              <tr>
                {LEDGER_HEADERS.map((h, i) => (
                  <th
                    key={h}
                    className={`px-5 py-3 text-[11px] font-semibold uppercase tracking-wide text-faint ${
                      i >= 6 ? 'text-right' : 'text-left'
                    }`}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ledger.map((t) => {
                const credit = t.type === 'Credit';
                return (
                  <tr key={t.id} className="border-b border-border last:border-0">
                    <td className="px-5 py-3 text-[13px] text-muted">
                      {t.createdAt ? format(t.createdAt.toDate(), 'dd MMM yyyy, hh:mm a') : '—'}
                    </td>
                    <td className="px-5 py-3">
                      <LedgerTypeCell type={t.type} />
                    </td>
                    <td className="px-5 py-3">
                      <span className="inline-flex items-center rounded-sm bg-subtle px-2 py-0.5 text-[11px] font-bold text-muted">
                        {t.source}
                      </span>
                    </td>
                    <td className="max-w-[260px] px-5 py-3 text-[12px] text-muted">
                      {t.description || (t.referredUserName ? `Referred ${t.referredUserName}` : '—')}
                    </td>
                    <td className="px-5 py-3">
                      {t.orderId ? (
                        <Link
                          to={`/orders/${t.orderId}`}
                          title={t.orderId}
                          className="font-mono text-[12px] font-semibold text-primary hover:underline"
                        >
                          #{t.orderId.slice(0, 8)}…
                        </Link>
                      ) : (
                        <span className="text-[13px] text-faint">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <LedgerStatusBadge status={t.status} />
                    </td>
                    <td
                      className={`px-5 py-3 text-right text-[13px] font-semibold ${credit ? 'text-success' : 'text-error'}`}
                    >
                      {credit ? '+' : '-'}
                      {formatINR(t.amount)}
                    </td>
                    <td className="px-5 py-3 text-right text-[13px] text-muted">
                      {typeof t.balanceAfter === 'number' ? formatINR(t.balanceAfter) : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {ledgerLoadingMore && (
            <div className="p-3">
              <Skeleton height={40} borderRadius={8} />
            </div>
          )}
          {ledgerHasMore && !ledgerLoadingMore && (
            <div className="flex justify-center border-t border-border p-3">
              <button
                type="button"
                onClick={() => dispatch(fetchAffiliateTransactions({ userId, cursor: ledgerLastVisible }))}
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

export default AffiliateDetailPage;
