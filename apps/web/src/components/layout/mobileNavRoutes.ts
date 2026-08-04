/**
 * Where the mobile bottom nav appears — the single source of truth.
 *
 * WHY this is its own module rather than a constant inside `MobileBottomNav`: two components depend
 * on the answer. The nav uses it to decide whether to render, and `StickyActionBar` uses it to
 * decide whether to sit at the bottom edge or 60px above it. If they disagree, a sticky CTA either
 * floats over a gap or hides behind the tab bar — and both mistakes only show up on a phone.
 */

/**
 * Routes that own their whole bottom edge.
 *
 * `/checkout` and the two payment outcomes are a linear flow with a single primary action; offering
 * tab navigation mid-payment invites an abandoned order. `/login` has no storefront shell at all.
 */
export const NAV_HIDDEN_ON = ['/login', '/checkout', '/order-success', '/payment-failed'];

export function isMobileNavVisible(pathname: string): boolean {
  return !NAV_HIDDEN_ON.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}
