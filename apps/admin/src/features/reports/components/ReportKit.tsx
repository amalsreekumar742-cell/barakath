import type { FC, ReactNode } from 'react';
import Skeleton from 'react-loading-skeleton';
import Icon from '@/components/icons/Icon';

/**
 * ReportKit — the small presentational pieces every report reuses (summary card, chart skeleton, and
 * the loading/error/empty state wrapper), so the seven report components stay consistent and DRY.
 * All colours come from @theme tokens; only recharts (elsewhere) uses the CHART_COLORS hex exception.
 */

/** A KPI summary tile (same shape as the Payments/Dashboard cards). `tone` colours the value. */
export const SummaryCard: FC<{
  label: string;
  value: string;
  tone?: string;
  sub?: string;
  loading: boolean;
}> = ({ label, value, tone, sub, loading }) => (
  <div className="rounded-xl border border-border bg-surface p-4 shadow-sm">
    <p className="text-[12px] font-semibold uppercase tracking-wide text-faint">{label}</p>
    {loading ? (
      <Skeleton height={26} width={90} className="mt-1" />
    ) : (
      <>
        <p className={`mt-1 text-[20px] font-extrabold tracking-tight ${tone ?? 'text-foreground'}`}>
          {value}
        </p>
        {sub && <p className="mt-0.5 text-[12px] text-muted">{sub}</p>}
      </>
    )}
  </div>
);

/** Signed trend pill (▲ green up / ▼ red down) for a summary card. */
export const TrendPill: FC<{ value: number }> = ({ value }) => {
  const up = value >= 0;
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-[12px] font-semibold ${
        up ? 'text-success' : 'text-error'
      }`}
    >
      <Icon name={up ? 'ArrowUpLine' : 'ArrowDownLine'} size={13} />
      {Math.abs(value).toFixed(1)}%
    </span>
  );
};

/** Gray rectangle placeholder matching a chart's dimensions while its data loads. */
export const ChartSkeleton: FC<{ height?: number }> = ({ height = 300 }) => (
  <Skeleton height={height} borderRadius={12} />
);

/**
 * ReportStates — renders the shared loading / error(+retry) / empty branches; when none apply it renders
 * `children` (the actual report). Keeps every report's state handling identical (skill: explicit
 * loading|error|empty|data, always a retry + an empty state).
 */
export const ReportStates: FC<{
  loading: boolean;
  error: string | null;
  isEmpty: boolean;
  onRetry: () => void;
  emptyLabel?: string;
  skeleton?: ReactNode;
  children: ReactNode;
}> = ({ loading, error, isEmpty, onRetry, emptyLabel = 'No data for this range', skeleton, children }) => {
  if (loading) {
    return <>{skeleton ?? <ChartSkeleton />}</>;
  }
  if (error) {
    return (
      <div className="rounded-xl border border-border bg-surface p-10 text-center">
        <p className="text-[14px] text-muted">{error}</p>
        <button
          type="button"
          onClick={onRetry}
          className="mt-3 rounded-md bg-primary px-4 py-2 text-[14px] font-semibold text-white hover:bg-primary-dark"
        >
          Retry
        </button>
      </div>
    );
  }
  if (isEmpty) {
    return (
      <div className="rounded-xl border border-border bg-surface p-12 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-primary-subtle text-primary">
          <Icon name="DashboardLine" size={28} />
        </div>
        <h2 className="text-[15px] font-bold text-foreground">{emptyLabel}</h2>
      </div>
    );
  }
  return <>{children}</>;
};

/** A card wrapper for a chart/table block with a title (design: rounded-xl hairline surface). */
export const ReportCard: FC<{ title: string; children: ReactNode; className?: string }> = ({
  title,
  children,
  className,
}) => (
  <div className={`rounded-xl border border-border bg-surface p-5 shadow-sm ${className ?? ''}`}>
    <h2 className="mb-4 text-[15px] font-bold text-foreground">{title}</h2>
    {children}
  </div>
);
