import type { MetadataRoute } from 'next';

/**
 * robots.txt — generated so the disallow list cannot drift from the routes that actually exist.
 *
 * WHY these paths are excluded: they are per-person or transient, and indexing them is actively
 * harmful — a cart URL, an order-success page or a `?next=`-suffixed login would multiply into
 * near-duplicate URLs that dilute the catalog's ranking and can leak an order reference into a
 * search result.
 *
 * WHY this is belt-and-braces with the group-level `noindex`: robots.txt asks a crawler not to
 * FETCH; the meta tag tells it not to INDEX what it did fetch. A page linked from elsewhere can be
 * indexed without ever being crawled, so neither alone is sufficient.
 */
export default function robots(): MetadataRoute.Robots {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;

  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/account/', '/cart', '/checkout', '/order-success', '/payment-failed', '/login', '/api/'],
    },
    sitemap: siteUrl ? `${siteUrl}/sitemap.xml` : undefined,
  };
}
