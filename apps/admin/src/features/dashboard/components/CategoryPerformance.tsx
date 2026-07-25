import type { FC } from 'react';
import Skeleton from 'react-loading-skeleton';
import { useAppSelector } from '@/stores/store';

/**
 * CategoryPerformance — horizontal bars showing each category's share (spec §1.3).
 * Category name on the left, a bar sized by percentage, the percentage on the right.
 */
const BAR_COLORS = ['bg-primary', 'bg-gold', 'bg-info', 'bg-success', 'bg-primary-dark'];

const CategoryPerformance: FC = () => {
  const { data, loading, error } = useAppSelector((s) => s.dashboard.categoryPerformance);

  return (
    <div className="rounded-xl border border-border bg-surface p-5 shadow-sm">
      <h2 className="mb-4 text-[15px] font-bold text-foreground">Category performance</h2>

      {loading ? (
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i}>
              <Skeleton width={120} height={13} />
              <Skeleton height={8} className="mt-2" />
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="py-8 text-center text-[14px] text-muted">{error}</div>
      ) : data.length === 0 ? (
        <div className="py-8 text-center text-[14px] text-muted">No categories yet</div>
      ) : (
        <div className="space-y-4">
          {data.map((c, i) => (
            <div key={c.categoryName}>
              <div className="mb-1.5 flex items-center justify-between text-[13px]">
                <span className="font-medium text-foreground">{c.categoryName}</span>
                <span className="font-semibold text-muted">{c.percentage}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-pill bg-subtle">
                <div
                  className={`h-full rounded-pill ${BAR_COLORS[i % BAR_COLORS.length]}`}
                  style={{ width: `${Math.max(c.percentage, 2)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default CategoryPerformance;
