'use client';

import { useEffect } from 'react';
import { toastError } from '@/lib/toast';

/**
 * Fires a toast once, on mount — the bridge between a Server Component catching a Firestore error
 * (e.g. a missing index throwing `FAILED_PRECONDITION`) and the client-only toast system.
 *
 * WHY a component instead of calling `toastError` from the page: `react-hot-toast` renders through a
 * portal that only exists in the client tree (mounted once in `providers.tsx`) — a Server Component
 * cannot call it directly. Rendering this null-returning client island alongside the page's own
 * inline error message lets the server branch stay server-rendered while still surfacing the toast the
 * task asks for.
 */
export function FetchErrorToast() {
  useEffect(() => {
    toastError('Could not load search results. Please try again.');
    // Deliberately empty deps: this island remounts fresh on every navigation to `/search`, and a
    // fresh mount is exactly the one time this error should announce itself again.
  }, []);
  return null;
}
