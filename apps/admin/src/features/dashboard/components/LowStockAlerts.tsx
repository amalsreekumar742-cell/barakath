import type { FC } from 'react';
import { useNavigate } from 'react-router-dom';
import Skeleton from 'react-loading-skeleton';
import { useAppSelector } from '@/stores/store';

/**
 * LowStockAlerts — up to 5 low/out-of-stock products (spec §1.3). Remaining count is red at 0, amber
 * when low. "View inventory" links to the Inventory screen.
 */
const LowStockAlerts: FC = () => {
  const navigate = useNavigate();
  const { data, loading, error } = useAppSelector((s) => s.dashboard.lowStockAlerts);

  return (
    <div className="rounded-xl border border-border bg-surface p-5 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-[15px] font-bold text-foreground">Low stock alerts</h2>
        <button
          type="button"
          onClick={() => navigate('/inventory')}
          className="text-[13px] font-semibold text-primary hover:underline"
        >
          View inventory
        </button>
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} height={44} borderRadius={8} />
          ))}
        </div>
      ) : error ? (
        <div className="py-8 text-center text-[14px] text-muted">{error}</div>
      ) : data.length === 0 ? (
        <div className="py-8 text-center text-[14px] text-muted">Everything is well stocked</div>
      ) : (
        <ul className="divide-y divide-border">
          {data.map((p) => (
            <li key={p.sku} className="flex items-center justify-between py-2.5">
              <div className="min-w-0">
                <p className="truncate text-[14px] font-medium text-foreground">{p.productName}</p>
                <p className="text-[12px] text-faint">{p.sku}</p>
              </div>
              <span
                className={`shrink-0 rounded-sm px-2 py-0.5 text-[11px] font-bold ${
                  p.totalStock === 0
                    ? 'bg-error-subtle text-error'
                    : 'bg-warning-subtle text-warning'
                }`}
              >
                {p.totalStock === 0 ? 'Out of stock' : `${p.totalStock} left`}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default LowStockAlerts;
