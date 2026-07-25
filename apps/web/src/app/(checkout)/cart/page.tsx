'use client';

import { CartSection } from '@/features/cart/components/CartSection';

/**
 * /cart — "Your bag" (design: a standalone screen — items + order summary + "Proceed to checkout",
 * no breadcrumb chrome). Cart and checkout are separate ROUTES, not one page: the design's interactive
 * prototype navigates `nav.bag` → `nav.checkout` as two distinct screens, which overrides spec §3.8's
 * "Same Page Flow" text (confirmed with the user — design wins here). Checkout itself lives at
 * `/checkout` (`(checkout)/checkout/page.tsx`), reached via `CartSection`'s "Proceed to checkout".
 *
 * Client Component: the bag is per-visitor (guest localStorage cart, or a signed-in customer's own
 * selections) and must never be server-rendered — there is nothing here a Server Component could read
 * anyway (`WEB_BATCH1_NOTES.md` §5: Server Components can only read what a signed-out visitor could).
 *
 * Auth: viewable by guests (spec — a visitor must be able to build a bag before signing in and keep it
 * through the login redirect, which is why the cart persists to `localStorage` regardless of auth
 * state — see `cartSlice.ts`) — `/cart` is deliberately NOT in `middleware.ts`'s `PROTECTED_PREFIXES`.
 * Only PROCEEDING to checkout requires sign-in — `/checkout` IS protected there instead.
 */
export default function CartPage() {
  return (
    <main className="mx-auto w-full max-w-6xl px-5 py-6 md:px-10">
      <CartSection />
    </main>
  );
}
