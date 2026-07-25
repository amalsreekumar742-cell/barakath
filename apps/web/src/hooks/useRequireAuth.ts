'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useCallback } from 'react';
import { useAppSelector } from '@/stores/store';

/**
 * useRequireAuth — gates a client action behind sign-in, redirecting a guest to `/login?next=<path>`.
 *
 * WHY it reuses the middleware's `?next=` contract instead of inventing a new one: `src/middleware.ts`
 * already redirects a guest hitting a protected route to `/login?next=<path+search>`, and the login
 * page already reads that param and returns the visitor there after sign-in. A product or listing page
 * is NOT in `PROTECTED_PREFIXES` (guests must be able to browse it), so this hook applies the same
 * contract to a single in-page ACTION (Add to Bag, wishlist, bundle add-all) rather than the whole route.
 *
 * WHY `requireAuth` takes a callback instead of returning a boolean: the caller (a button's onClick)
 * wants one call that either runs the action or redirects — a boolean forces every call site to
 * duplicate the same `if (!ok) return` guard.
 *
 * WHY `window.location.search` instead of `useSearchParams()`: reading it lazily inside the click
 * handler (never at render time) preserves any query string on the redirect without opting the page
 * into `useSearchParams()`'s Suspense-boundary requirement — `requireAuth` only ever runs from an
 * event handler, which is always client-side, so `window` is safe here.
 */
export function useRequireAuth() {
  const router = useRouter();
  const pathname = usePathname();
  const isAuthenticated = useAppSelector((s) => s.auth.isAuthenticated);

  const requireAuth = useCallback(
    (action: () => void) => {
      if (isAuthenticated) {
        action();
        return;
      }
      const search = typeof window !== 'undefined' ? window.location.search : '';
      router.push(`/login?next=${encodeURIComponent(`${pathname}${search}`)}`);
    },
    [isAuthenticated, pathname, router],
  );

  return { requireAuth, isAuthenticated };
}
