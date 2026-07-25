import type { ReactNode } from 'react';
import { Provider as ReduxProvider } from 'react-redux';
import { Toaster } from 'react-hot-toast';
import { store } from '../stores/store';

/**
 * AppProvider — the app-wide provider layer.
 * WHY here: the Redux <Provider> and the toast container are global concerns wired once at the app
 *   layer, so every feature can dispatch/select and fire toasts without re-wiring providers.
 */
export default function AppProvider({ children }: { children: ReactNode }) {
  return (
    <ReduxProvider store={store}>
      {children}
      <Toaster position="top-right" />
    </ReduxProvider>
  );
}
