import 'server-only';

import { BannerLinkType } from '@barakath/shared';
import { getBanners, getProductById } from '@/lib/data/catalog';
import type { HeroSlide } from '../types/heroSlide';

/**
 * The home hero carousel's slides: Website-placement, active, in-window banners resolved to a safe
 * (or null) destination.
 *
 * WHY this lives in the home feature's `api/` rather than `lib/data/`: it is not a generic catalog
 * read — it is home-page-specific composition (banner + per-slide interactivity) built ON TOP of the
 * generic `getBanners`/`getProductById` reads that already live in `lib/data/catalog.ts`. Reusing
 * those (never re-querying `banners`/`products` directly) keeps this the only place that decides
 * "is this slide clickable", while the underlying Firestore access stays where every other server
 * read lives.
 *
 * WHY `getBanners('Website')`: the placement filter is `in ['Website', 'Both']`, which is exactly
 * what `getBanners` does for the 'Website' argument (see catalog.ts) — reused rather than
 * re-implemented. It already filters `isActive == true` and the schedule window in memory.
 *
 * WHY a `Product`-linked banner needs an extra read: `BannerProps` is a single-link model with no
 * attached-products list (WEB_BATCH2_NOTES.md §F). If the admin deletes/archives the product a banner
 * points at, the banner doc is untouched — nothing tells the storefront the link has gone stale except
 * asking. `getProductById` already returns null for a missing OR non-Active product, so this reuses
 * that existing "is this product safe to show" rule instead of re-deriving it.
 *
 * WHY `Category`/`External` need no extra read: a Category banner carries its own denormalised
 * `linkCategoryName`, and `/banner/[bannerId]` resolves it from the banner doc itself; an External
 * banner's `linkValue` is a plain outbound URL. Only the Product case can silently point at nothing.
 */
export async function getHeroSlides(): Promise<HeroSlide[]> {
  const banners = await getBanners('Website');
  if (banners.length === 0) return [];

  // Resolve "does this banner's product still exist" in parallel, one read per Product-linked
  // banner — bounded by MAX_BANNERS, so this is never an unbounded fan-out.
  const productLive = new Map<string, boolean>();
  await Promise.all(
    banners
      .filter((banner) => banner.linkType === BannerLinkType.PRODUCT && banner.linkValue)
      .map(async (banner) => {
        const product = await getProductById(banner.linkValue);
        productLive.set(banner.id, product != null);
      }),
  );

  return banners.map((banner) => {
    // The click destination is always the banner's own landing page — never a direct deep link — so
    // a Category/External banner can add its own resolution logic in one place later without this
    // carousel changing. 'None', and a 'Product' banner whose target vanished, get no href at all.
    const isInteractive =
      banner.linkType !== BannerLinkType.NONE &&
      (banner.linkType !== BannerLinkType.PRODUCT || productLive.get(banner.id) === true);

    return {
      id: banner.id,
      title: banner.title || 'Barakath banner',
      image: banner.image,
      href: isInteractive ? `/banner/${banner.id}` : null,
    };
  });
}
