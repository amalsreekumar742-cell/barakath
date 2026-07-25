import type { FC } from 'react';
import { useNavigate } from 'react-router-dom';
import Skeleton from 'react-loading-skeleton';
import { useAppSelector } from '@/stores/store';
import { formatINR } from '@/utils/format';
import OrderStatusBadge from '@/components/OrderStatusBadge';

/**
 * RecentOrders — the 5 latest orders as a mini table (spec §1.3). Each row links to the order detail;
 * "View all" links to the Orders screen.
 */
const RecentOrders: FC = () => {
  const navigate = useNavigate();
  const { data, loading, error } = useAppSelector((s) => s.dashboard.recentOrders);

  return (
    <div className="rounded-xl border border-border bg-surface p-5 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-[15px] font-bold text-foreground">Recent orders</h2>
        <button
          type="button"
          onClick={() => navigate('/orders')}
          className="text-[13px] font-semibold text-primary hover:underline"
        >
          View all
        </button>
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} height={40} borderRadius={8} />
          ))}
        </div>
      ) : error ? (
        <div className="py-8 text-center text-[14px] text-muted">{error}</div>
      ) : data.length === 0 ? (
        <div className="py-8 text-center text-[14px] text-muted">No orders yet</div>
      ) : (
        <table className="w-full text-[13px]">
          <thead>
            <tr className="text-left text-[11px] font-semibold uppercase tracking-wide text-faint">
              <th className="pb-2 font-semibold">Order</th>
              <th className="pb-2 font-semibold">Customer</th>
              <th className="pb-2 font-semibold">Status</th>
              <th className="pb-2 text-right font-semibold">Total</th>
            </tr>
          </thead>
          <tbody>
            {data.map((o) => (
              <tr
                key={o.id}
                onClick={() => navigate(`/orders/${o.id}`)}
                className="cursor-pointer border-t border-border hover:bg-subtle"
              >
                <td className="py-2.5 font-semibold text-foreground">
                  #{o.id.slice(0, 8).toUpperCase()}
                </td>
                <td className="py-2.5 text-muted">{o.userName}</td>
                <td className="py-2.5">
                  <OrderStatusBadge status={o.status} />
                </td>
                <td className="py-2.5 text-right font-semibold text-foreground">
                  {formatINR(o.grandTotal)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default RecentOrders;
