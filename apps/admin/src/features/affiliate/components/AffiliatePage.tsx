import { type FC, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Skeleton from 'react-loading-skeleton';
import { useAppDispatch, useAppSelector } from '@/stores/store';
import Icon from '@/components/icons/Icon';
import { formatINR } from '@/utils/format';
import { fetchAffiliateStats } from '../api/fetchAffiliateStats';
import WithdrawalsTab from './WithdrawalsTab';

/**
 * One summary metric card (design: card padding 16px, rounded-xl, subtle border; label is normal-case
 * 12px muted; value is 24px extrabold `--font-display`). `tone` colours the value — gold for pending
 * payout, success for confirmed commission, error for withdrawals awaiting action (spec §1.14).
 */
const StatCard: FC<{ label: string; value: string; tone?: string; loading: boolean }> = ({
  label,
  value,
  tone,
  loading,
}) => (
  <div className="rounded-xl border border-border bg-surface p-4 shadow-sm">
    <p className="text-[12px] font-medium text-faint">{label}</p>
    {loading ? (
      <Skeleton height={28} width={90} className="mt-2" />
    ) : (
      <p className={`mt-2 text-[24px] font-extrabold leading-none tracking-tight ${tone ?? 'text-foreground'}`}>
        {value}
      </p>
    )}
  </div>
);

/**
 * AffiliatePage — the Affiliate Program screen (prototype "Growth › Affiliate"): four summary cards and the
 * Withdrawal requests listing, with an "Allocate affiliate" outline action in the header that opens the
 * full allocate page. The stat cards use aggregation-query figures; the withdrawal list owns its own
 * paginated data + status filter.
 */
const AffiliatePage: FC = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { stats, statsLoading } = useAppSelector((s) => s.affiliate);

  useEffect(() => {
    void dispatch(fetchAffiliateStats());
  }, [dispatch]);

  return (
    <div className="p-6">
      {/* Page header: title + live summary subtitle + Allocate affiliate (design: header outline button). */}
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[24px] font-extrabold leading-tight tracking-tight text-foreground">
            Affiliate program
          </h1>
          <p className="mt-1.5 text-[13px] text-muted">
            {statsLoading || !stats
              ? 'Manage affiliates & withdrawals'
              : `${stats.totalAffiliates} affiliate${stats.totalAffiliates === 1 ? '' : 's'} · ${formatINR(
                  stats.pendingAmount,
                )} pending payout`}
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigate('/affiliate/allocate')}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-border-strong px-4 py-2.5 text-[14px] font-semibold text-foreground hover:bg-subtle"
        >
          <Icon name="AddCircleLine" size={16} /> Allocate affiliate
        </button>
      </div>

      {/* Summary cards (design labels + tone colours). */}
      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Active affiliates" value={String(stats?.totalAffiliates ?? 0)} loading={statsLoading} />
        <StatCard
          label="Pending commission"
          value={formatINR(stats?.pendingAmount ?? 0)}
          tone={stats && stats.pendingAmount > 0 ? 'text-gold-strong' : undefined}
          loading={statsLoading}
        />
        <StatCard
          label="Confirmed"
          value={formatINR(stats?.totalCommissionPaid ?? 0)}
          tone="text-success"
          loading={statsLoading}
        />
        <StatCard
          label="Withdrawals to approve"
          value={String(stats?.pendingWithdrawals ?? 0)}
          tone={stats && stats.pendingWithdrawals > 0 ? 'text-error' : undefined}
          loading={statsLoading}
        />
      </div>

      {/* Withdrawal requests */}
      <h2 className="mb-3 text-[14px] font-bold text-foreground">Withdrawal requests</h2>
      <WithdrawalsTab />
    </div>
  );
};

export default AffiliatePage;
