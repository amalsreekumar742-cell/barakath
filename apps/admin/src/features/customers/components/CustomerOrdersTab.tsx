import { type FC, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Skeleton from 'react-loading-skeleton';
import { format } from 'date-fns';
import { useAppDispatch, useAppSelector } from '@/stores/store';
import OrderStatusBadge from '@/components/OrderStatusBadge';
import { formatINR } from '@/utils/format';
import { fetchCustomerOrders } from '../api/fetchCustomerOrders';

/**
 * CustomerOrdersTab — a customer's order history (spec §1.8 Orders tab). Loads its own first page on
 * mount (lazy — only when the tab is shown), paginates via "View More", and a row opens the order.
 */
const CustomerOrdersTab: FC<{ userId: string }> = ({ userId }) => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { customerOrders, ordersHasMore, ordersLoading, ordersLoadingMore, ordersLastVisible } =
    useAppSelector((s) => s.customers);

  // Fetch the first page only if this tab hasn't loaded yet (avoids a re-fetch when switching back).
  useEffect(() => {
    if (customerOrders.length === 0) void dispatch(fetchCustomerOrders({ userId, cursor: null }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatch, userId]);

  if (ordersLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} height={48} borderRadius={10} />
        ))}
      </div>
    );
  }

  if (customerOrders.length === 0) {
    return <p className="py-10 text-center text-[14px] text-muted">No orders yet</p>;
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface">
      <table className="w-full">
        <thead className="border-b border-border bg-subtle/50">
          <tr>
            {['Order', 'Date', 'Items', 'Status', 'Total'].map((h, i) => (
              <th
                key={h}
                className={`px-5 py-3 text-[11px] font-semibold uppercase tracking-wide text-faint ${i === 4 ? 'text-right' : 'text-left'}`}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {customerOrders.map((o) => (
            <tr
              key={o.id}
              onClick={() => navigate(`/orders/${o.id}`)}
              className="cursor-pointer border-b border-border last:border-0 hover:bg-subtle/40"
            >
              <td className="px-5 py-3">
                <span className="font-mono text-[12px] font-semibold text-foreground">#{o.id.slice(0, 8)}…</span>
              </td>
              <td className="px-5 py-3 text-[13px] text-muted">
                {o.createdAt ? format(o.createdAt.toDate(), 'dd MMM yyyy') : '—'}
              </td>
              <td className="px-5 py-3 text-[13px] text-muted">{o.items?.length ?? 0}</td>
              <td className="px-5 py-3">
                <OrderStatusBadge status={o.status} />
              </td>
              <td className="px-5 py-3 text-right text-[13px] font-semibold text-foreground">
                {formatINR(o.grandTotal)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {ordersLoadingMore && (
        <div className="p-3">
          <Skeleton height={40} borderRadius={8} />
        </div>
      )}
      {ordersHasMore && !ordersLoadingMore && (
        <div className="flex justify-center border-t border-border p-3">
          <button
            type="button"
            onClick={() => dispatch(fetchCustomerOrders({ userId, cursor: ordersLastVisible }))}
            className="rounded-md border border-border-strong px-4 py-2 text-[14px] font-semibold text-foreground hover:bg-subtle"
          >
            View More
          </button>
        </div>
      )}
    </div>
  );
};

export default CustomerOrdersTab;
