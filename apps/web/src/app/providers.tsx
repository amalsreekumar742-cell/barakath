'use client';

import type { ReactNode } from 'react';
import { Provider as ReduxProvider } from 'react-redux';
import { Toaster } from 'react-hot-toast';
import { store } from '@/stores/store';
import { AuthListener } from '@/features/auth/AuthListener';
import { OverlayRouteReset } from '@/components/OverlayRouteReset';

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
      <OverlayRouteReset />
      {children}
      {/*
        Toasts mirror `apps/app/lib/core/widgets/app_toast.dart`: solid ink/green/red pill, white
        text, radius 8. Positioned top-CENTER rather than top-right because on a phone a right-
        anchored toast reads as clipped, and the app puts it centred — this is the one toast
        position that looks deliberate at both 390px and 1440px.
      */}
      <Toaster
        position="top-center"
        toastOptions={{
          style: {
            borderRadius: '8px',
            background: '#181717',
            color: '#ffffff',
            fontSize: '14px',
            fontWeight: 600,
            maxWidth: '92vw',
          },
          success: { style: { background: '#0f7a5a' }, iconTheme: { primary: '#ffffff', secondary: '#0f7a5a' } },
          error: { style: { background: '#fb3748' }, iconTheme: { primary: '#ffffff', secondary: '#fb3748' } },
        }}
      />
    </ReduxProvider>
  );
}
