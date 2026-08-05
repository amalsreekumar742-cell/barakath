import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Breadcrumb } from '@/components/Breadcrumb';
import { EmptyState } from '@/components/EmptyState';
import { getProductById, getProductReviews, getVariants } from '@/lib/data/catalog';
import { getActiveFlashSale } from '@/lib/data/flashSales';
import { buildMetadata, productSchema } from '@/lib/seo';
import { getRelatedProducts } from '@/features/product/data/getRelatedProducts';
import { getFrequentlyBoughtTogetherItems } from '@/features/product/data/getFrequentlyBoughtTogetherItems';
import { Gallery } from '@/features/product/components/Gallery';
import { MobileGallery } from '@/features/product/components/MobileGallery';
import { YoutubeEmbed } from '@/features/product/components/YoutubeEmbed';
import { ProductExperience } from '@/features/product/components/ProductExperience';
import { DescriptionSection } from '@/features/product/components/DescriptionSection';
import { SpecificationsTable } from '@/features/product/components/SpecificationsTable';
import { ReviewsSection } from '@/features/product/components/ReviewsSection';
import { FrequentlyBoughtTogether } from '@/features/product/components/FrequentlyBoughtTogether';
import { RelatedProducts } from '@/features/product/components/RelatedProducts';

/**
 * Product detail (`/product/[productId]`, spec §3.7).
 *
 * WHY `revalidate = 60` rather than the catalog's usual 300: unlike a listing page, a PDP can show a
 * LIVE flash-sale price and (via `FlashCountdown`) a countdown to when it ends. The scheduler flips
 * flash flags every 5 minutes; 60s bounds how long a stale flash price/badge can show here, per
 * WEB_BATCH2_NOTES.md §A. Written as a literal — Next statically analyses this export and rejects an
 * imported identifier.
 *
 * WHY `generateStaticParams` is skipped: the catalogue is not a small, bounded set worth enumerating at
 * build time (unlike, say, a handful of legal pages) — every product is rendered on its first real
 * visit and served from the ISR cache after that (`dynamicParams` defaults to `true`), which is the
 * right tradeoff for a catalogue that grows continuously without a redeploy.
 */
export const revalidate = 60;

interface PageProps {
  params: Promise<{ productId: string }>;
}

/** Strip markup for the meta description — `product.description` may be rich HTML or plain text. */
function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { productId } = await params;
  const product = await getProductById(productId);
  if (!product) return {};

  const description =
    stripHtml(product.description).slice(0, 160) || `Buy ${product.name} at Barakath.`;
  const image = product.images[0] || product.thumbnail || undefined;

  return buildMetadata({
    title: product.name,
    description,
    path: `/product/${product.id}`,
    image,
  });
}

export default async function ProductPage({ params }: PageProps) {
  const { productId } = await params;

  // `getProductById` already gates on `status === 'Active'` (see lib/data/catalog.ts) — a draft or
  // archived product 404s exactly like one that never existed, rather than rendering at a guessable URL.
  const product = await getProductById(productId);
  if (!product) notFound();

  const [variants, activeFlashSale] = await Promise.all([
    getVariants(product.id),
    // Only worth the read when the product is actually flagged into a sale.
    product.isFlashSale ? getActiveFlashSale() : Promise.resolve(null),
  ]);

  const crumbs = [
    { label: 'Home', href: '/' },
    { label: product.categoryName, href: `/category/${encodeURIComponent(product.categoryName)}` },
    { label: product.name },
  ];

  // A product with zero variants has nothing to price or add to bag. The PRODUCT doc is still valid
  // and Active (a real, if incomplete, catalogue entry) so a 404 would be the wrong signal — show the
  // page shell with an explicit "unavailable" message instead of crashing on `variants[0]`.
  if (variants.length === 0) {
    return (
      <main className="mx-auto w-full max-w-[1280px] px-5 pb-16">
        {/* MobileGallery already overlays a back button on the image — a second would double up. */}
        <Breadcrumb items={crumbs} showBack={false} />
        <EmptyState
          title="This product is currently unavailable."
          subtitle="Please check back soon."
        />
      </main>
    );
  }

  // Sections that must degrade independently rather than take the whole page down with them (a
  // reviews/related/bundle read failing must not blank an otherwise-working PDP).
  const [reviewsPage, relatedProducts, bundleItems] = await Promise.all([
    getProductReviews(product.id).catch(() => ({ items: [], cursor: null, hasMore: false })),
    getRelatedProducts(product).catch(() => []),
    getFrequentlyBoughtTogetherItems(product).catch(() => []),
  ]);

  // `variants.length === 0` returned above, so index 0 is always present here.
  const defaultVariant = variants[0]!;
  // Matches what the page actually renders by default (the first variant, no flash sale applied yet
  // client-side) — see `@/lib/seo` productSchema's doc comment on why it takes `resolvePrice`'s inputs.
  const schema = productSchema(product, defaultVariant, reviewsPage.items);

  // Firestore `Timestamp` fields don't survive the Server → Client prop boundary as plain objects
  // (React rejects them) — strip `createdAt`/`updatedAt`, which `ProductExperience` never reads,
  // rather than passing the raw docs through. Mirrors the `NavCategory` fix in `lib/data/catalog.ts`
  // for the same class of bug.
  const { createdAt: _createdAt, updatedAt: _updatedAt, ...clientProduct } = product;
  const clientVariants = variants.map(({ createdAt: _variantCreatedAt, ...v }) => v);

  return (
    // `has-sticky-cta` reserves room for the pinned Add-to-bag bar (globals.css). It stacks with the
    // shell's `has-mobile-nav` because the two sit on nested elements, so the last review/related row
    // clears BOTH the CTA and the tab bar. Both are no-ops above 1024px.
    <main className="has-sticky-cta mx-auto w-full max-w-[1280px] pb-16 lg:px-5">
      {/*
        The mobile gallery is FULL-BLEED, as it is in the app — so the page's horizontal padding
        starts at `lg:` and everything that must stay inset gets `px-4` of its own below. The
        breadcrumb is desktop-only here: the gallery's floating back button is the mobile way out,
        and a breadcrumb above a full-bleed image would push it off the top of the screen.
      */}
      <div className="hidden lg:block">
        {/* MobileGallery already overlays a back button on the image — a second would double up. */}
        <Breadcrumb items={crumbs} showBack={false} />
      </div>

      <MobileGallery
        images={product.images}
        productName={product.name}
        productId={product.id}
        videoUrl={product.youtubeVideoLink}
        onSale={product.isFlashSale}
      />

      <div className="grid grid-cols-1 gap-10 px-4 lg:grid-cols-2 lg:px-0">
        {/* Desktop keeps the thumbnail-rail gallery and the video as a separate block below it. */}
        <div className="hidden flex-col gap-4 lg:flex">
          <Gallery images={product.images} productName={product.name} />
          {product.youtubeVideoLink && <YoutubeEmbed url={product.youtubeVideoLink} />}
        </div>

        <ProductExperience
          product={clientProduct}
          variants={clientVariants}
          activeFlashSaleEndMillis={activeFlashSale ? activeFlashSale.endDate.toMillis() : null}
        />
      </div>

      {/* `px-4` here because `main` no longer pads on mobile — the gallery above is full-bleed. */}
      <div className="mt-14 flex flex-col gap-12 px-4 lg:px-0">
        <DescriptionSection description={product.description} />
        <SpecificationsTable specifications={product.specifications} />
        <ReviewsSection product={product} firstPage={reviewsPage.items} hasMore={reviewsPage.hasMore} />
        <FrequentlyBoughtTogether
          items={bundleItems}
          // The first row is context only, so the DEFAULT variant's price is the right one to show —
          // the section deliberately cannot add this product (see its doc comment).
          currentProduct={{
            name: product.name,
            image: product.thumbnail || product.images[0] || '',
            offerPrice: defaultVariant.offerPrice,
            mrp: defaultVariant.mrp,
          }}
        />
        <RelatedProducts products={relatedProducts} />
      </div>

      <script
        type="application/ld+json"
        // Safe: `schema` is built entirely from our own catalogue data, never user input.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
      />
    </main>
  );
}
