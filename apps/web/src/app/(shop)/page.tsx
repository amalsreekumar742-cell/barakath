import type { Metadata } from 'next';
import type { CategoryProps, ProductProps } from '@barakath/shared';
import { Constants } from '@/config/constants';
import { getCategories, getNewArrivals } from '@/lib/data/catalog';
import { getGeneralSettings } from '@/lib/data/settings';
import { buildMetadata, itemListSchema, organizationSchema } from '@/lib/seo';
import { getHeroSlides } from '@/features/home/api/getHeroSlides';
import { getHomeFlashSale, type HomeFlashSale } from '@/features/home/api/getHomeFlashSale';
import { safeSection } from '@/features/home/utils/safeSection';
import type { HeroSlide } from '@/features/home/types/heroSlide';
import { HeroCarousel } from '@/features/home/components/HeroCarousel';
import { CategorySection } from '@/features/home/components/CategorySection';
import { SpinWinBanner } from '@/features/home/components/SpinWinBanner';
import { FlashSaleSection } from '@/features/home/components/FlashSaleSection';
import { NewArrivalsSection } from '@/features/home/components/NewArrivalsSection';

/**
 * The home page (spec §3.4) — Server Component, ISR.
 *
 * WHY `revalidate = 300` here even though `(shop)/layout.tsx` already declares it: Next statically
 * analyses `export const revalidate` per segment and rejects an imported identifier, so every segment
 * that wants the catalog ISR window writes the literal itself (the reasoning lives once, in
 * `lib/data/serverFirestore.ts`). The flash-sale rail does NOT get its own shorter override — B0's
 * `getActiveFlashSale`/`getFlashSaleProducts` already read the scheduler-managed flags fresh on every
 * ISR regeneration, and `FlashCountdown` recomputes from `Date.now()` client-side regardless of how
 * stale the surrounding HTML is, so 300s here does not desynchronise the visible countdown.
 */
export const revalidate = 300;

export async function generateMetadata(): Promise<Metadata> {
  // `general/config` currently carries no store name/description field (only variables, delivery,
  // payment, privacy/terms HTML and contact details — see `lib/data/settings.ts`), so there is
  // nothing in it yet to fold into the title/description. It is still read here (rather than skipped)
  // so this page picks up such a field automatically the day one is added, without another change.
  await getGeneralSettings();

  return buildMetadata({
    title: `${Constants.APP_NAME} — Perfumes, Books, Clothing & Islamic Essentials`,
    description:
      'Shop premium perfumes, books, clothing and Islamic essentials at Barakath. ' +
      'Flash sales, new arrivals, wallet rewards and a daily Spin & Win.',
    path: '/',
  });
  // No `robots: { index: false }` — the home page is the top page search engines should index.
}

export default async function HomePage() {
  // Every section's data is fetched in ONE Promise.all (no sequential waterfall between sections),
  // and each is wrapped in `safeSection` so one failing read skips just that section instead of
  // blanking the page. `getHomeFlashSale` internally does its own (sale -> products -> variants)
  // sequence, but that sequence is scoped to the flash-sale section alone.
  const [heroSlides, categories, flashSale, newArrivals, settings] = await Promise.all([
    safeSection<HeroSlide[]>(getHeroSlides(), [], 'hero banners'),
    // The design shows exactly 4 tiles here (a `repeat(4,1fr)` grid, not the full catalogue) — the
    // header nav/mega-menu and the `/categories` directory page are what call `getCategories()` with
    // its full default `max`.
    safeSection<CategoryProps[]>(getCategories(4), [], 'categories'),
    safeSection<HomeFlashSale | null>(getHomeFlashSale(8), null, 'flash sale'),
    safeSection<ProductProps[]>(getNewArrivals(8), [], 'new arrivals'),
    safeSection(getGeneralSettings(), null, 'general settings (organization schema)'),
  ]);

  return (
    <main>
      {/* Organization JSON-LD — mounted once, site-wide entry point (spec: SEO for the top page). */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema(settings)) }}
      />
      {newArrivals.length > 0 && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListSchema(newArrivals)) }}
        />
      )}

      <HeroCarousel slides={heroSlides} />
      <CategorySection categories={categories} />
      <SpinWinBanner />
      <FlashSaleSection flashSale={flashSale} />
      <NewArrivalsSection products={newArrivals} />
    </main>
  );
}
