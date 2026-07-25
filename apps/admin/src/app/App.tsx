import AppProvider from './provider';
import AppRouter from './router';

/**
 * App — the root component.
 * WHY thin: it only composes the provider layer (Redux, toast) around the router. Cross-feature
 *   wiring belongs at this app layer, not inside any feature.
 */
export default function App() {
  return (
    <AppProvider>
      <AppRouter />
    </AppProvider>
  );
}
