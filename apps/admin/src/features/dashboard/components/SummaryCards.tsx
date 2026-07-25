import type { FC, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import Skeleton from 'react-loading-skeleton';
import { useAppSelector } from '@/stores/store';
import { formatINR, formatINRCompact, formatPercent } from '@/utils/format';

/**
 * SummaryCards — the four KPI tiles (spec §1.3): Today's revenue, Total orders (week), Pending orders,
 * Avg order value. Each shows a value + a trend indicator (▲ green / ▼ red) vs the prior period.
 * Pending shows a "needs action" amber note when > 0 and links to the filtered Orders screen.
 */
interface Trend {
  value: number;
}

const TrendLabel: FC<Trend & { suffix: string }> = ({ value, suffix }) => {
  const up = value >= 0;
  return (
    <p className={`mt-1 text-[12px] font-semibold ${up ? 'text-success' : 'text-error'}`}>
      {up ? '▲' : '▼'} {formatPercent(value)} <span className="font-medium text-muted">{suffix}</span>
    </p>
  );
};

const Card: FC<{ label: string; children: ReactNode; onClick?: () => void }> = ({
  label,
  children,
  onClick,
}) => (
  <div
    onClick={onClick}
    className={`rounded-xl border border-border bg-surface p-5 shadow-sm ${
      onClick ? 'cursor-pointer transition-colors hover:border-border-strong' : ''
    }`}
  >
    <p className="text-[13px] text-muted">{label}</p>
    {children}
  </div>
);

const SummaryCards: FC = () => {
  const navigate = useNavigate();
  const { data, loading, error } = useAppSelector((s) => s.dashboard.stats);

  if (loading || (!data && !error)) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-border bg-surface p-5 shadow-sm">
            <Skeleton width={110} height={14} />
            <Skeleton width={90} height={28} className="mt-2" />
            <Skeleton width={130} height={12} className="mt-2" />
          </div>
        ))}
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-xl border border-border bg-surface p-5 text-[14px] text-muted">
        {error ?? 'No stats available'}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Card label="Today's revenue">
        <p className="mt-1 text-[26px] font-extrabold tracking-tight text-foreground">
          {formatINRCompact(data.todayRevenue)}
        </p>
        <TrendLabel value={data.revenueTrend} suffix="vs yesterday" />
      </Card>

      <Card label="Total orders">
        <p className="mt-1 text-[26px] font-extrabold tracking-tight text-foreground">
          {data.totalOrdersWeek.toLocaleString('en-IN')}
        </p>
        <TrendLabel value={data.ordersTrend} suffix="this week" />
      </Card>

      <Card
        label="Pending orders"
        onClick={() => navigate('/orders?status=Pending')}
      >
        <p className="mt-1 text-[26px] font-extrabold tracking-tight text-foreground">
          {data.pendingOrders.toLocaleString('en-IN')}
        </p>
        {data.pendingOrders > 0 ? (
          <p className="mt-1 text-[12px] font-semibold text-warning">● needs action</p>
        ) : (
          <p className="mt-1 text-[12px] font-medium text-muted">all clear</p>
        )}
      </Card>

      <Card label="Avg order value">
        <p className="mt-1 text-[26px] font-extrabold tracking-tight text-foreground">
          {formatINR(data.avgOrderValue)}
        </p>
        <TrendLabel value={data.avgTrend} suffix="this month" />
      </Card>
    </div>
  );
};

export default SummaryCards;
