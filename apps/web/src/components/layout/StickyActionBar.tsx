'use client';

import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { isMobileNavVisible } from './mobileNavRoutes';

/**
 * The sticky bottom action bar — a screen's primary CTA pinned to the bottom edge on mobile.
 * Mirrors `apps/app/lib/features/products/presentation/widgets/product_detail_bottom_bar.dart`
 * and the equivalent bars on the bag and checkout screens.
 *
 * WHY this exists: today every primary action on this site — Add to bag, Proceed to checkout, Place
 * order — is inline in the page flow, so on a phone it scrolls out of view behind a long product
 * description or a ten-line cart. The app never loses its CTA, and that is most of why it feels
 * decisive to use.
 *
 * WHY it positions itself off `isMobileNavVisible` rather than taking a required prop: the two
 * pieces of bottom chrome have to agree about who owns the bottom 60px, and a prop that each call
 * site sets by hand is a prop that will eventually be set wrong on one screen. Deriving both from
 * one route rule keeps them correct by construction. `usePathname` is known during the server render
 * in the App Router, so this does not cause a hydration flash.
 *
 * Pages that render this must add `has-sticky-cta` to their scroll container (see globals.css) so
 * the last row of content is not hidden underneath it.
 */
export interface StickyActionBarProps {
  /** The primary control — usually a full-width <Button size="lg">. */
  children: ReactNode;
  /** Optional control to the left, e.g. the PDP's 54x54 wishlist square. */
  leading?: ReactNode;
}

export function StickyActionBar({ children, leading }: StickyActionBarProps) {
  const pathname = usePathname();
  const withNav = isMobileNavVisible(pathname);

  return (
    <div
      // The nav bar is z-50 and sits below this in the document; they never overlap because this one
      // is offset upward by the nav's height rather than stacked on top of it.
      className="fixed inset-x-0 z-40 border-t border-border bg-surface px-4 py-3 lg:hidden"
      style={{
        bottom: withNav
          ? 'calc(var(--mobile-nav-h) + env(safe-area-inset-bottom, 0px))'
          : 'env(safe-area-inset-bottom, 0px)',
      }}
    >
      <div className="flex items-center gap-3">
        {leading && <div className="shrink-0">{leading}</div>}
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}
