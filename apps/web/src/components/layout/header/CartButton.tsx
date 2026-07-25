'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ShoppingBag } from 'lucide-react';
import { useAppSelector } from '@/stores/store';
import { CountBadge } from './CountBadge';

/**
 * The cart icon with its item-count badge.
 *
 * WHY it is a client island: the badge count comes from the Redux cart slice, which only exists in
 * the browser. Keeping this tiny and client-only lets the rest of the header stay server-rendered.
 *
 * WHY the count sums QUANTITIES, not lines: three of one perfume is "3" in the badge, the same
 * number the bag shows — counting lines would say "1" and disagree with the page it links to.
 *
 * WHY it gates on `mounted` (a `useEffect`-flipped flag) rather than `cart.isHydrating`: the cart is
 * `localStorage`-persisted (see `stores/store.ts`), so the server always renders an empty bag while a
 * returning customer's browser may already hold real items. Gating on `isHydrating` alone was tried
 * first and looked correct — both the server and the client's PRE-rehydration render start from the
 * same `initialState` — but it is still a race between two independent async operations (React's
 * hydration commit vs. `redux-persist`'s async `REHYDRATE` dispatch), and it reproduced live: on a
 * freshly restarted dev server the persistor's read sometimes completed before React's hydration
 * DIFF ran, so the client's very first comparison already showed the post-rehydrate count and still
 * threw "Hydration failed". `mounted` has no such race: React guarantees a `useEffect` never fires
 * until AFTER the hydration commit, full stop — so the first render (server and client alike) always
 * shows 0/"Cart", and the real count only ever appears in a later, definitely-post-hydration update.
 */
export function CartButton() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const rawCount = useAppSelector((s) => s.cart.items.reduce((sum, line) => sum + line.quantity, 0));
  const count = mounted ? rawCount : 0;

  return (
    <Link
      href="/cart"
      aria-label={count > 0 ? `Cart, ${count} item${count === 1 ? '' : 's'}` : 'Cart'}
      className="relative inline-flex size-10 items-center justify-center rounded-lg text-foreground hover:bg-subtle"
    >
      <ShoppingBag className="size-[22px]" aria-hidden />
      <CountBadge count={count} />
    </Link>
  );
}
