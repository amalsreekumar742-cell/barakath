'use client';

import { Breadcrumb } from '@/components/Breadcrumb';
import { AccountPageHeader } from '@/features/account/components/AccountPageHeader';
import { useAppSelector } from '@/stores/store';
import { CouponWallet } from '@/features/coupons/CouponWallet';

/**
 * /account/wallet/coupons (spec §3.15) — a thin route: `AccountPageHeader` + D0's `CouponWallet`. Tabs,
 * cards, pagination and empty states all live inside that component — this file intentionally has no
 * logic of its own and must not reimplement or modify it (D3's `/spin-win` page renders the SAME
 * component too, with `variant="embedded"`).
 *
 * WHY `variant="embedded"` here, even though the Batch 4 brief's own prose says "renders … with
 * variant='page' … plus an AccountPageHeader": `CouponWallet.tsx`'s OWN doc comment (D0, verified
 * against the actual component) is explicit that combining the two doubles the heading — `variant=
 * "page"` already renders its own "My coupons" `<h2>` + card chrome, so wrapping that in a SECOND
 * `AccountPageHeader` puts two headings on one screen. The component's real, checked-in behaviour wins
 * over the brief's prose here: `embedded` under this page's own `AccountPageHeader` is the combination
 * `CouponWallet.tsx` itself documents as correct.
 *
 * WHY no guest fallback: same reasoning as `/account/wallet` — `(account)/layout.tsx` sits behind
 * `middleware.ts`'s auth gate, so `uid` is only ever null for the brief pre-hydration instant before
 * Redux catches up (during which this renders nothing rather than a flash of the wrong state).
 */
export default function CouponWalletPage() {
  const uid = useAppSelector((s) => s.auth.uid);

  return (
    <div>
      <Breadcrumb
        items={[{ label: 'Home', href: '/' }, { label: 'Wallet', href: '/account/wallet' }, { label: 'My Coupons' }]}
      />
      <AccountPageHeader title="My Coupons" subtitle="Codes you've won and saved to your account." />
      {uid && <CouponWallet customerId={uid} variant="embedded" />}
    </div>
  );
}
