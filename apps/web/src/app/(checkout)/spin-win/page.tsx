'use client';

import { useState } from 'react';
import { CouponWallet } from '@/features/coupons/CouponWallet';
import { SpinWinExperience } from '@/features/spinner/components/SpinWinExperience';
import { useAppSelector } from '@/stores/store';

/**
 * /spin-win (spec §3.14) — the wheel, its inline result, and the coupon wallet on ONE page, no popup
 * (the app shows the result in a bottom sheet; the website has no equivalent modal to build).
 *
 * ROUTE GROUP: `(checkout)`, not `(shop)`. `src/app/README.md` (built by D0, merged before this
 * session) already establishes and documents this — `/spin-win` is per-visitor and non-indexable, the
 * same as `/cart` and `/wishlist`, and `(shop)` is reserved for Server-Component/ISR catalog pages that
 * export `revalidate`/`generateMetadata`. `(checkout)/layout.tsx` already supplies `robots: { index:
 * false }` at the GROUP level (README: "do not re-declare it, and do not remove it"), so nothing is
 * added here. Auth: `src/middleware.ts`'s `PROTECTED_PREFIXES` already lists `/spin-win` — no redirect
 * logic is built in this file; a signed-out visitor never reaches this component.
 *
 * WHY the `CouponWallet` import lives HERE and not inside `features/spinner`: the web skill requires
 * cross-feature composition to happen at the app/route layer ("Compose them at the app/route layer, or
 * move the shared piece into src/components, src/lib or packages/shared" — `eslint.config.mjs`'s own
 * rule message), not by one feature reaching into another. `features/spinner` has no import of
 * `features/coupons` anywhere, so no new `import/no-restricted-paths` exception was needed for this
 * feature (unlike the existing `coupons -> account` one).
 *
 * WHY `couponRefreshToken`: after a WIN, `spinWheel` has already minted a new `coupons` doc, but
 * `CouponWallet`'s own `usePaginatedCollection` call has no way to know that happened. Bumping this
 * number and feeding it to `CouponWallet` as a React `key` remounts the component, which is what forces
 * its internal hook to refetch page 1 from scratch — without this route (or `features/spinner`) reaching
 * into `CouponWallet`'s internals at all. Only fired on a win (`SpinWinExperience`'s `onWin`); a loss
 * changes nothing in the wallet.
 *
 * WHY the wheel and coupon wallet sit side by side (design marker 11): the design lays these out as a
 * two-column row, not stacked — the wheel keeps its own centered layout, the coupon wallet takes the
 * remaining width and stays top-aligned since its list can grow taller than the wheel column.
 */
export default function SpinWinPage() {
  const uid = useAppSelector((s) => s.auth.uid);
  const [couponRefreshToken, setCouponRefreshToken] = useState(0);

  return (
    <main className="mx-auto w-full max-w-6xl px-4 pb-16 pt-6 lg:px-5">
      <div className="grid grid-cols-1 items-start gap-10 lg:grid-cols-[460px_1fr]">
        <SpinWinExperience onWin={() => setCouponRefreshToken((t) => t + 1)} />

        {uid && (
          <div id="coupon-wallet">
            <h2 className="font-display text-lg font-extrabold text-foreground">My coupons</h2>
            <p className="mt-1 text-sm text-muted">Codes you&apos;ve won, ready to use at checkout.</p>
            <div className="mt-4 rounded-xl border border-border bg-surface p-5">
              <CouponWallet key={couponRefreshToken} variant="embedded" customerId={uid} />
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
