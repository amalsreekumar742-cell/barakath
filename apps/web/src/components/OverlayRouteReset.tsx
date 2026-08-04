'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useAppDispatch } from '@/stores/store';
import { closeAllOverlays } from '@/stores/uiSlice';

/**
 * Closes every global overlay whenever the route changes. Renders nothing.
 *
 * WHY this exists: a navigation triggered from INSIDE an overlay — tapping a category in the login
 * sheet's footer, following a link in a filter sheet — swaps the page underneath but leaves the
 * overlay mounted on top of it, because nothing else ever tells it to close. Every overlay owning
 * its own "close on navigate" effect is the same bug waiting in N places; doing it once here means a
 * new overlay is correct by default as long as its open-state lives in `uiSlice`.
 *
 * WHY it is mounted in `providers.tsx` rather than a layout: route groups each have their own
 * layout, and an overlay opened in (shop) can navigate into (account) — crossing a layout boundary
 * would unmount the effect at exactly the moment it is needed. The provider tree spans every group.
 */
export function OverlayRouteReset() {
  const pathname = usePathname();
  const dispatch = useAppDispatch();

  useEffect(() => {
    dispatch(closeAllOverlays());
  }, [pathname, dispatch]);

  return null;
}
