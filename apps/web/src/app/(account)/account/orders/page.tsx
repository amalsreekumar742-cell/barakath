'use client';

import { useMemo, useState } from 'react';
import { PackageSearch } from 'lucide-react';
import { Breadcrumb } from '@/components/Breadcrumb';
import { Button } from '@/components/Button';
import { EmptyState } from '@/components/EmptyState';
import { SkeletonText } from '@/components/Skeleton';
import { useAppDispatch, useAppSelector } from '@/stores/store';
import { toastError, toastSuccess } from '@/lib/toast';
import { AccountPageHeader } from '@/features/account/components/AccountPageHeader';
import { usePaginatedCollection } from '@/features/account/hooks/usePaginatedCollection';
import { ordersQuery, mapOrder } from '@/features/orders/api/orders';
import { OrderCard } from '@/features/orders/components/OrderCard';
import { reorderItems } from '@/features/orders/utils/reorder';
import type { OrderProps } from '@barakath/shared';

/**
 * /account/orders — My Orders (spec 3.11).
 *
 * NO filter tabs: unlike the Flutter app's All/Active/Delivered/Cancelled chips, spec 3.11's own line
 * list for the website does not mention filter tabs at all — this ships chronological, newest first,
 * cursor-paginated 12/page via `usePaginatedCollection` (Batch 4 brief §1 explicitly specifies this).
 * CHECKED against `docs/design/web/Barakath Website Prototype.dc.html`'s own "My orders" section: it
 * goes straight from the `<h1>` into the order list with no tab row either — the prototype agrees with
 * the spec here, so there is no conflict to flag.
 */
export default function MyOrdersPage() {
  const dispatch = useAppDispatch();
  const uid = useAppSelector((s) => s.auth.uid);
  const authLoading = useAppSelector((s) => s.auth.authLoading);
  const [reorderingId, setReorderingId] = useState<string | null>(null);

  const query = useMemo(() => (uid ? ordersQuery(uid) : null), [uid]);

  const { items, isLoading, isLoadingMore, hasMore, loadMore, error } = usePaginatedCollection({
    query,
    mapper: mapOrder,
  });

  async function handleReorder(order: OrderProps) {
    setReorderingId(order.id);
    try {
      const { added, skipped } = await reorderItems(order, dispatch);
      if (added === 0) {
        toastError(null, 'None of these items is available right now');
      } else {
        toastSuccess(skipped === 0 ? 'Added to your bag' : `Added to your bag · ${skipped} item${skipped === 1 ? '' : 's'} out of stock skipped`);
      }
    } catch (e) {
      toastError(e, 'Could not reorder these items. Please try again.');
    } finally {
      setReorderingId(null);
    }
  }

  const showLoading = authLoading || isLoading;

  return (
    <div>
      <Breadcrumb items={[{ label: 'Home', href: '/' }, { label: 'My Orders' }]} />
      <AccountPageHeader title="My Orders" subtitle="Track, reorder or manage every order you've placed." />

      {showLoading ? (
        <div className="space-y-4" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <div key={i} className="rounded-xl border border-border p-5">
              <SkeletonText width="w-1/4" />
              <div className="mt-3 flex gap-2">
                <div className="size-12 animate-pulse rounded-md bg-subtle" />
                <div className="size-12 animate-pulse rounded-md bg-subtle" />
                <div className="size-12 animate-pulse rounded-md bg-subtle" />
              </div>
              <SkeletonText width="w-1/3" className="mt-3" />
            </div>
          ))}
        </div>
      ) : error ? (
        <EmptyState icon={<PackageSearch size={40} />} title="Could not load your orders" subtitle={error} />
      ) : items.length === 0 ? (
        <EmptyState
          icon={<PackageSearch size={40} />}
          title="No orders yet"
          subtitle="Your orders will appear here once you place one."
        />
      ) : (
        <>
          <div className="space-y-4">
            {items.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                reordering={reorderingId === order.id}
                onReorder={handleReorder}
              />
            ))}
          </div>
          {hasMore && (
            <div className="mt-6 flex justify-center">
              <Button variant="secondary" onClick={loadMore} loading={isLoadingMore}>
                View more
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
