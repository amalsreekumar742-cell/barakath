'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { UserProps } from '@barakath/shared';
import { useAppSelector } from '@/stores/store';

/**
 * Access gate for every /account/affiliate-wallet* route (spec §2.22, mirrors
 * `apps/app/lib/features/affiliate/presentation/widgets/affiliate_scaffold.dart`'s `AffiliateGuard`).
 *
 * WHY this exists even though `AccountSidebar` already hides the "Affiliate Wallet" nav entry for a
 * non-affiliate: hiding a link is not an access control — a signed-in customer can still type the URL
 * directly. `(account)/layout.tsx` only proves "signed in", never "is an affiliate", so each affiliate
 * route needs its own check (same reasoning as this batch's own brief).
 *
 * - Not an affiliate (`affiliateCode` empty/whitespace) -> redirect to `/account/orders`.
 * - `requireWalletAccess` (the withdraw page only) AND `affiliateEnabled === false` -> redirect back to
 *   the wallet dashboard, which is the page that explains wallet access is off (mirrors Flutter's
 *   `AffiliateGuard.requireWalletAccess` redirecting to `/affiliate` for the identical reason). The
 *   wallet page itself does NOT require this — spec's own wording keeps the dashboard visible with
 *   the withdrawal entry point merely disabled, matching the brief's "Access" section.
 *
 * WHY a render-prop rather than just early-returning: this needs to hand the CALLER a non-null `user`
 * (every field it renders — balance, code, stats — is required), and TypeScript cannot narrow
 * `user: UserProps | null` across a component boundary the way it can within one function body.
 */
export function AffiliateGuard({
  requireWalletAccess = false,
  children,
}: {
  requireWalletAccess?: boolean;
  children: (user: UserProps) => React.ReactNode;
}) {
  const router = useRouter();
  const user = useAppSelector((s) => s.auth.user);
  const authLoading = useAppSelector((s) => s.auth.authLoading);

  const isAffiliate = Boolean(user?.affiliateCode?.trim());
  // Opt-in: only an explicit `true` grants wallet access. A missing field means "never granted",
  // matching the admin toggle and the Flutter `User` entity's own `affiliateEnabled = false` default.
  const walletEnabled = user?.affiliateEnabled === true;
  const blocked = !authLoading && (!isAffiliate || (requireWalletAccess && !walletEnabled));

  useEffect(() => {
    if (authLoading || !blocked) return;
    router.replace(!isAffiliate ? '/account/orders' : '/account/affiliate-wallet');
  }, [authLoading, blocked, isAffiliate, router]);

  if (authLoading || !user || blocked) {
    return (
      <div className="space-y-4" aria-busy="true">
        <div className="h-28 animate-pulse rounded-2xl bg-subtle" />
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded-2xl bg-subtle" />
          ))}
        </div>
        <div className="h-24 animate-pulse rounded-2xl bg-subtle" />
      </div>
    );
  }

  return <>{children(user)}</>;
}
