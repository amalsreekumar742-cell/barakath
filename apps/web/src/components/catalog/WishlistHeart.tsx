'use client';

import type { MouseEvent } from 'react';
import { Heart } from 'lucide-react';

import { useAppDispatch, useAppSelector } from '@/stores/store';
import { setLoginSheetOpen } from '@/stores/uiSlice';

/**
 * The wishlist slice's optimistic-toggle action, referenced by its RTK type string (slice name +
 * reducer key) rather than imported.
 *
 * WHY by string and not `import { toggleWishlistId }`: this is a SHARED component (`src/components`),
 * and the lint boundary (`import/no-restricted-paths`) forbids a shared module from importing a
 * feature — that would invert the dependency direction and make the card unshareable. The wishlist
 * feature owns the reducer; the card only needs to FIRE its action, and an RTK action type is a
 * stable public contract, so dispatching the plain action object keeps the boundary intact.
 */
const WISHLIST_TOGGLE = 'wishlist/toggleWishlistId';

export interface WishlistHeartProps {
  productId: string;
  /** Extra classes for the button (positioning is the caller's job — the card places it in a corner). */
  className?: string;
}

/**
 * The wishlist toggle that sits in a product card's corner — the one interactive island on an
 * otherwise Server-rendered card, kept deliberately tiny so the card itself stays server-renderable
 * and SEO-friendly.
 *
 * WHY guests get the login SHEET rather than an immediate redirect to /login: a wishlist belongs to
 * a signed-in customer (spec §2.4, `firestore.rules`), so a guest has nowhere to save to — but
 * yanking a browsing visitor off the grid they are scrolling to a full sign-in page loses their
 * place for a tap that may have been exploratory. The Flutter card raises `login_prompt_sheet.dart`
 * here, and the shared sheet (mounted once by `StorefrontShell`, opened through `uiSlice` because a
 * shared component may not import a feature) now lets the website mirror that exactly.
 *
 * WHY it dispatches the optimistic slice toggle only: the heart must feel instant, so it flips the
 * shared `productIds` immediately. Persisting the change to `users/{uid}/wishlist/{productId}` (a
 * direct, rule-constrained self-owned write) is the wishlist feature's job, not this shared card's —
 * this island stays free of Firebase so it can be dropped onto any grid. See the report's
 * cross-cutting note.
 *
 * WHY `preventDefault` + `stopPropagation`: the whole card is a `<Link>`; without stopping the event
 * a tap on the heart would also navigate to the product.
 */
export function WishlistHeart({ productId, className = '' }: WishlistHeartProps) {
  const dispatch = useAppDispatch();
  const isGuest = useAppSelector((s) => s.auth.isGuest);
  const isWishlisted = useAppSelector((s) => s.wishlist.productIds.includes(productId));

  function onClick(e: MouseEvent<HTMLButtonElement>) {
    e.preventDefault();
    e.stopPropagation();
    if (isGuest) {
      dispatch(setLoginSheetOpen(true));
      return;
    }
    dispatch({ type: WISHLIST_TOGGLE, payload: productId });
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={isWishlisted}
      aria-label={isWishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
      className={[
        // 36px on touch, 32px on pointer devices. The Flutter card's heart is 30px, but a finger
        // needs more than a mouse does, and this sits inside a <Link> where a near-miss navigates to
        // the product instead of saving it — the most annoying way for a tap to be wrong.
        'inline-flex size-9 items-center justify-center rounded-full bg-surface/90 shadow-sm backdrop-blur lg:size-8',
        'transition hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <Heart
        className={`size-[18px] lg:size-4 ${isWishlisted ? 'fill-current text-error' : 'text-ink'}`}
        strokeWidth={2}
        aria-hidden
      />
    </button>
  );
}
