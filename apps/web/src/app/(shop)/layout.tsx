import { StorefrontShell } from '@/components/layout/StorefrontShell';

/**
 * (shop) — the public, indexable storefront.
 *
 * WHY the chrome lives in the GROUP layout rather than the root layout: /login is a full-bleed
 * two-column screen with no header. Putting the shell at the root would force that group to fight
 * it back off.
 *
 * The shell itself — header, footer, mobile bottom nav, and the settings/category reads they need —
 * lives in `StorefrontShell`, shared with (checkout) and (account).
 */
/**
 * The catalog ISR window. Written as a literal because Next statically analyses this export and
 * rejects an imported identifier — the reasoning for 300 lives in lib/data/serverFirestore.ts.
 */
export const revalidate = 300;

export default function ShopLayout({ children }: { children: React.ReactNode }) {
  return <StorefrontShell mobileSearch>{children}</StorefrontShell>;
}
