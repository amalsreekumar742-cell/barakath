'use client';

import { useMemo, useState } from 'react';
import { Ticket } from 'lucide-react';
import { Button } from '@/components/Button';
import { EmptyState } from '@/components/EmptyState';
import { SkeletonText } from '@/components/Skeleton';
import { usePaginatedCollection } from '@/features/account/hooks/usePaginatedCollection';
import { couponWalletQuery, mapCoupon, type CouponTab } from './api/coupons';
import { CouponCard } from './components/CouponCard';

const TABS: { key: CouponTab; label: string }[] = [
  { key: 'active', label: 'Active' },
  { key: 'used', label: 'Used' },
  { key: 'expired', label: 'Expired' },
];

const EMPTY_COPY: Record<CouponTab, { title: string; subtitle: string }> = {
  active: {
    title: 'No active coupons',
    subtitle: 'Spin the wheel to win a coupon you can use at checkout.',
  },
  used: {
    title: 'No used coupons yet',
    subtitle: 'Coupons you redeem at checkout will show up here.',
  },
  expired: {
    title: 'No expired coupons',
    subtitle: "Coupons that ran out before you used them will show up here.",
  },
};

export interface CouponWalletProps {
  customerId: string;
  /**
   * 'page' renders the full /account/wallet/coupons screen (heading + card chrome).
   * 'embedded' drops both so the identical wallet nests inside the Spin & Win page (spec §3.14)
   * without a second, competing heading.
   */
  variant: 'page' | 'embedded';
}

/**
 * CouponWallet (spec §3.15's dedicated route AND spec §3.14's Spin & Win embed — two parallel Batch 4
 * sessions render this, so it lives here rather than inside either page's own feature folder).
 *
 * Tabs map to derived status, not a stored field — see `features/coupons/api/coupons.ts` for why (no
 * `spinRewards` collection exists; a spin win mints an ordinary `coupons` doc).
 *
 * Guidance for whoever wires the real `/account/wallet/coupons` route (currently a `<ComingSoon>`
 * stub — out of this session's scope to replace): render `<CouponWallet variant="page" ... />` on its
 * own, OR wrap it in that page's own `AccountPageHeader` and use `variant="embedded"` instead — using
 * `variant="page"` UNDER an `AccountPageHeader` would double up the heading.
 */
export function CouponWallet({ customerId, variant }: CouponWalletProps) {
  const [tab, setTab] = useState<CouponTab>('active');

  // Re-derived only when the customer or the active tab changes (not every render) — see
  // usePaginatedCollection's header for why: it resets to page 1 whenever this reference changes.
  const query = useMemo(() => couponWalletQuery(customerId, tab), [customerId, tab]);

  const { items, isLoading, isLoadingMore, hasMore, loadMore, error } = usePaginatedCollection({
    query,
    pageSize: 12,
    mapper: mapCoupon,
  });

  const body = (
    <div>
      <div
        role="tablist"
        aria-label="Coupon status"
        className="mb-4 inline-flex rounded-lg border border-border bg-subtle p-1"
      >
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={`rounded-md px-4 py-1.5 text-sm font-bold transition ${
              tab === t.key ? 'bg-surface text-foreground shadow-sm' : 'text-muted hover:text-foreground'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-3" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <div key={i} className="rounded-xl border border-border p-4">
              <SkeletonText width="w-1/3" />
              <SkeletonText width="w-1/2" className="mt-2" />
              <SkeletonText width="w-1/4" className="mt-2" />
            </div>
          ))}
        </div>
      ) : error ? (
        <EmptyState icon={<Ticket size={40} />} title="Could not load your coupons" subtitle={error} />
      ) : items.length === 0 ? (
        <EmptyState icon={<Ticket size={40} />} title={EMPTY_COPY[tab].title} subtitle={EMPTY_COPY[tab].subtitle} />
      ) : (
        <>
          <div className="space-y-3">
            {items.map((coupon) => (
              <CouponCard key={coupon.id} coupon={coupon} tab={tab} customerId={customerId} />
            ))}
          </div>
          {hasMore && (
            <div className="mt-4 flex justify-center">
              <Button variant="secondary" onClick={loadMore} loading={isLoadingMore}>
                View more
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );

  if (variant === 'embedded') return body;

  return (
    <div>
      <h2 className="font-display text-lg font-extrabold text-foreground">My coupons</h2>
      <p className="mt-1 text-sm text-muted">Codes you&apos;ve won and saved to your account.</p>
      <div className="mt-4 rounded-xl border border-border bg-surface p-5">{body}</div>
    </div>
  );
}
