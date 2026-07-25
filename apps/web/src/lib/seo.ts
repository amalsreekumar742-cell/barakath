import type { Metadata } from 'next';
import type {
  GeneralSettingsProps,
  ProductProps,
  ReviewProps,
  VariantProps,
} from '@barakath/shared';
import { Constants } from '@/config/constants';
import { resolvePrice } from './pricing';

/**
 * seo — page `Metadata` and JSON-LD structured-data builders shared by every catalog page.
 *
 * WHY structured data matters here: this is a catalogue site whose product and category pages are the
 * ones that must rank. `Product`, `BreadcrumbList` and `ItemList` schemas let Google render rich results
 * (price, rating stars, breadcrumb trail) instead of a bare URL — free click-through on exactly those
 * pages. Every builder returns a PLAIN OBJECT the page serialises into a `<script type="application/ld+json">`;
 * keeping them pure (no JSX, no I/O) means they are trivially testable and reusable server-side.
 */

/** The site origin without a trailing slash, or '' when `NEXT_PUBLIC_SITE_URL` is unset. */
function origin(): string {
  return process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ?? '';
}

/** An absolute URL for `path` when the origin is configured, else the relative path. */
function absolute(path: string): string {
  const base = origin();
  return base ? `${base}${path}` : path;
}

export interface BuildMetadataInput {
  title: string;
  description: string;
  /** The page's absolute path, beginning with '/'. */
  path: string;
  /** An absolute image URL for the social preview (product hero, banner). */
  image?: string;
}

/**
 * Per-page `Metadata` with a canonical URL and Open Graph / Twitter cards.
 *
 * WHY a single builder: 20+ pages each hand-writing canonical + OG + Twitter is 20 chances to omit the
 * canonical (which causes duplicate-content dilution) or the OG image (which strips the preview from a
 * WhatsApp/Twitter share). The root layout already sets `metadataBase`, so a relative canonical resolves;
 * this still emits an absolute URL when the origin is known, which is what crawlers prefer.
 */
export function buildMetadata({ title, description, path, image }: BuildMetadataInput): Metadata {
  const url = absolute(path);
  const images = image ? [image] : undefined;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      type: 'website',
      images,
    },
    twitter: {
      card: image ? 'summary_large_image' : 'summary',
      title,
      description,
      images,
    },
  };
}

/**
 * `Product` JSON-LD for a product detail page. Price comes from `resolvePrice` (the single pricing
 * truth — so the structured price matches what the customer sees, flash sale included) and availability
 * from `totalStock`. `aggregateRating`/`review` are added only when there are published reviews, because
 * Google flags an empty or zero rating as invalid structured data.
 */
export function productSchema(
  product: ProductProps,
  variant: VariantProps,
  reviews: ReviewProps[] = [],
): Record<string, unknown> {
  const { displayPrice } = resolvePrice(product, variant);
  const images = product.images?.length
    ? product.images
    : product.thumbnail
      ? [product.thumbnail]
      : [];

  const schema: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description: product.description,
    sku: product.sku,
    image: images,
    offers: {
      '@type': 'Offer',
      priceCurrency: 'INR',
      price: displayPrice,
      availability:
        product.totalStock > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
      url: absolute(`/product/${product.id}`),
    },
  };

  if (product.totalReviews > 0) {
    schema.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: product.averageRating,
      reviewCount: product.totalReviews,
    };
  }
  if (reviews.length > 0) {
    schema.review = reviews.map((r) => ({
      '@type': 'Review',
      reviewRating: { '@type': 'Rating', ratingValue: r.rating, bestRating: 5 },
      author: { '@type': 'Person', name: r.userName },
      ...(r.comment ? { reviewBody: r.comment } : {}),
    }));
  }
  return schema;
}

/** One crumb in a breadcrumb trail; the final crumb (current page) omits `path`. */
export interface BreadcrumbTrailItem {
  name: string;
  /** Absolute path beginning with '/'; omitted on the current page. */
  path?: string;
}

/**
 * `BreadcrumbList` JSON-LD from a trail. The current page's crumb carries no `item` URL — a
 * self-referencing breadcrumb link is what search engines treat as a loop.
 */
export function breadcrumbSchema(trail: BreadcrumbTrailItem[]): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: trail.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      ...(item.path ? { item: absolute(item.path) } : {}),
    })),
  };
}

/**
 * `ItemList` JSON-LD for a listing/search/category grid — tells Google the page is a product list and
 * links each entry, which can surface as a carousel result.
 */
export function itemListSchema(products: ProductProps[]): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    itemListElement: products.map((product, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: product.name,
      url: absolute(`/product/${product.id}`),
    })),
  };
}

/**
 * `Organization` JSON-LD for the store — mounted once (site-wide, e.g. the footer) so the business name
 * and support contact are machine-readable. Contact fields come from `general/config.contactus`; a null
 * settings doc still yields a valid minimal Organization.
 */
export function organizationSchema(
  settings: GeneralSettingsProps | null,
): Record<string, unknown> {
  const base = origin();
  const contact = settings?.contactus;

  const schema: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: Constants.APP_NAME,
    ...(base ? { url: base } : {}),
  };

  if (contact?.helpPhone || contact?.helpEmail) {
    schema.contactPoint = {
      '@type': 'ContactPoint',
      contactType: 'customer support',
      ...(contact.helpPhone ? { telephone: contact.helpPhone } : {}),
      ...(contact.helpEmail ? { email: contact.helpEmail } : {}),
    };
  }
  return schema;
}
