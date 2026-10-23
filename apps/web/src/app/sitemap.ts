import type { MetadataRoute } from 'next';
import { getAllProductIdsForSitemap, getCategories } from '@/lib/data/catalog';
import { getEnabledPolicies } from '@/lib/data/policies';

/**
 * sitemap.xml — built from the live catalog rather than a checked-in list.
 *
 * WHY generated: a static list goes stale the moment the admin adds a product, and nobody notices,
 * because a missing sitemap entry has no visible symptom — the page simply never gets crawled.
 *
 * WHY `next-sitemap` is NOT used (the Batch 1 prompt lists it): that package post-processes a build
 * to emit static XML, which cannot see products created after the deploy. Next's own `sitemap.ts` is
 * a server route that re-runs on the same ISR window as the pages, so a product added at noon is in
 * the sitemap five minutes later without a rebuild.
 *
 * Only public catalog and policy URLs appear here. Account, cart and login are excluded by construction
 * — they are neither, so there is no list to accidentally include them from.
 */
/** Same 300s window as the catalog pages, as a literal — see lib/data/serverFirestore.ts. */
export const revalidate = 300;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  // Without an absolute origin every entry would be a relative URL, which is invalid in a sitemap;
  // emitting nothing is better than emitting a file every crawler rejects.
  if (!siteUrl) return [];

  const [categories, productIds, policies] = await Promise.all([
    getCategories(),
    getAllProductIdsForSitemap(),
    getEnabledPolicies(),
  ]);

  // No /privacy-policy or /terms entries: those are now 308 redirects (next.config.ts), and a sitemap
  // that lists redirecting URLs is flagged in Search Console. Their targets appear as policies below.
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: siteUrl, changeFrequency: 'daily', priority: 1 },
    { url: `${siteUrl}/categories`, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${siteUrl}/policies`, changeFrequency: 'monthly', priority: 0.2 },
  ];

  return [
    ...staticRoutes,
    ...policies.map((p) => ({
      url: `${siteUrl}/policies/${encodeURIComponent(p.id)}`,
      lastModified: p.updatedAt?.toDate(),
      changeFrequency: 'yearly' as const,
      priority: 0.2,
    })),
    ...categories.map((c) => ({
      url: `${siteUrl}/category/${encodeURIComponent(c.name)}`,
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    })),
    ...productIds.map((id) => ({
      url: `${siteUrl}/product/${id}`,
      changeFrequency: 'weekly' as const,
      priority: 0.6,
    })),
  ];
}
