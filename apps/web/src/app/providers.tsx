'use client';

import type { ReactNode } from 'react';
import { Provider as ReduxProvider } from 'react-redux';
import { Toaster } from 'react-hot-toast';
import { store } from '@/stores/store';
import { AuthListener } from '@/features/auth/AuthListener';

/**
 * Providers — the client-side app-wide provider layer.
 * WHY "use client": Redux's <Provider> and the toast container rely on client-only React context and
 *   browser APIs, so they must live in a client component. Keeping this island small lets the rest of
 *   the tree stay Server Components (better for catalog/SEO).
 */
export function Providers({ children }: { children: ReactNode }) {
  return (
    <ReduxProvider store={store}>
      {/* AuthListener renders nothing; it wires Firebase auth → Redux and keeps the session cookie
          in sync. Mounted once here so the user-doc subscription lives for the whole app. */}
      <AuthListener />
      {children}
      <Toaster position="top-right" />
    </ReduxProvider>
  );
}
