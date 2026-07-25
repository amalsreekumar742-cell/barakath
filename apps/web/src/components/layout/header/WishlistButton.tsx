'use client';

import Link from 'next/link';
import { Heart } from 'lucide-react';
import { useAppSelector } from '@/stores/store';
import { CountBadge } from './CountBadge';

/**
 * The wishlist (heart) icon with its saved-count badge.
 *
 * WHY the count is `productIds.length` and not `items.length`: the wishlist slice keeps a lightweight
 * id list that is populated app-wide (every product card reads it to draw its heart), while the
 * hydrated `items` are only loaded when the wishlist PAGE is open. The id list is the count that is
 * always correct.
 */
export function WishlistButton() {
  const count = useAppSelector((s) => s.wishlist.productIds.length);

  return (
    <Link
      href="/wishlist"
      aria-label={count > 0 ? `Wishlist, ${count} saved` : 'Wishlist'}
      className="relative inline-flex size-10 items-center justify-center rounded-lg text-foreground hover:bg-subtle"
    >
      <Heart className="size-[22px]" aria-hidden />
      <CountBadge count={count} />
    </Link>
  );
}
