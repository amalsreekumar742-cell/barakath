import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { getCategories, toNavCategories } from '@/lib/data/catalog';
import { getGeneralSettings } from '@/lib/data/settings';

/**
 * (shop) — the public, indexable storefront.
 *
 * WHY the chrome lives in the GROUP layout rather than the root layout: /login is a full-bleed
 * two-column screen with no header, and the account area gets its own sidebar shell in Batch 4.
 * Putting Header/Footer at the root would force every group to fight it back off.
 *
 * WHY the settings and category reads happen HERE: both are needed by the header (mega menu) and
 * the footer on every storefront page. Reading them once in the layout is one round-trip per render
 * instead of one per component, and — because this is a Server Component — the resulting nav is in
 * the HTML, which is what makes the category tree crawlable.
 *
 * WHY they are awaited in parallel: they are independent reads; awaiting them in sequence would put
 * two round-trips in front of the first byte for no reason.
 */
/**
 * The catalog ISR window. Written as a literal because Next statically analyses this export and
 * rejects an imported identifier — the reasoning for 300 lives in lib/data/serverFirestore.ts.
 */
export const revalidate = 300;

export default async function ShopLayout({ children }: { children: React.ReactNode }) {
  const [settings, categories] = await Promise.all([getGeneralSettings(), getCategories()]);

  return (
    <div className="flex min-h-screen flex-col">
      <Header settings={settings} categories={toNavCategories(categories)} />
      <div className="flex-1">{children}</div>
      <Footer settings={settings} />
    </div>
  );
}
