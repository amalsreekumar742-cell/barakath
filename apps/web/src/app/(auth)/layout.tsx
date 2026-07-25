import type { Metadata } from 'next';

/**
 * (auth) — the login flow.
 *
 * WHY no Header or Footer: spec 3.3 draws login as a full-bleed two-column screen — branding panel
 * on the left, form on the right — and the design's left panel runs to the top of the viewport.
 * Storefront chrome would also give a half-authenticated visitor a cart and account icon to click
 * mid-flow, which is exactly where a login gets abandoned.
 *
 * WHY `noindex`: a login page in a search index is noise at best, and the `?next=` variants would
 * multiply into hundreds of near-duplicate URLs at worst.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen">{children}</div>;
}
