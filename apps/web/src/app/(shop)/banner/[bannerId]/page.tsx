import Link from 'next/link';
import Image from 'next/image';
import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { ChevronLeft, ChevronRight, ExternalLink, Layers, PackageX } from 'lucide-react';
import { BannerLinkType } from '@barakath/shared';
import { Breadcrumb } from '@/components/Breadcrumb';
import { EmptyState } from '@/components/EmptyState';
import { ProductGrid } from '@/components/catalog/ProductGrid';
import { buildMetadata } from '@/lib/seo';
import { getProductById } from '@/lib/data/catalog';
import { buildProductQuery, type PageResult } from '@/lib/data/products';
import { getBannerById, isBannerLive } from '@/lib/data/banners';

/**
 * /banner/[bannerId] — what happens when a customer follows a banner (spec 3.22, corrected).
 *
 * THE CORRECTION THIS PAGE IS BUILT AGAINST: `BannerProps` (packages/shared/src/types/banner.ts) is a
 * SINGLE-LINK promo — `linkType` + one `linkValue` — not a banner with an attached list of products.
 * There is no "products this banner promotes" to list in the generic sense; the page must branch by
 * `linkType`:
 *  - `Product` → the banner deep-links to ONE product. `redirect()` to it rather than faking a
 *    one-item grid — that is the honest behaviour for a single target.
 *  - `Category` → the banner points at a whole category. THIS is the one case where a listing still
 *    makes sense, so it renders that category's products via `buildProductQuery`, paginated only when
 *    there is more than one page (Prev/Next below — see the note on why not the shared `Pagination`).
 *  - `External` → no internal page exists at all; show the banner image/title with an outbound link.
 *  - `None`, or the linked target no longer exists/is inactive → an `EmptyState`, never a 404. A
 *    marketing link may still be live on a poster/social post after the admin unpublishes its target;
 *    treating that as an empty state (not a broken link) is what spec 1.15 implies by "no longer
 *    available" rather than "page not found".
 *
 * A missing/inactive/expired BANNER itself (bad id, `isActive !== true`, outside its schedule window)
 * DOES 404 via `notFound()` — a draft/paused campaign must never be reachable by direct URL.
 *
 * WHY `revalidate = 300`: same ISR window as the rest of the catalog (serverFirestore.ts) — this page
 * shows banner + category content, not a live flash price, so the 60s window B0 reserves for
 * flash-sale segments does not apply here.
 */
export const revalidate = 300;

interface BannerPageProps {
  params: Promise<{ bannerId: string }>;
  // Cursor pagination for the Category-link case only — document ids, per buildProductQuery's contract.
  searchParams: Promise<{ after?: string; before?: string }>;
}

export async function generateMetadata({ params }: BannerPageProps): Promise<Metadata> {
  const { bannerId } = await params;
  const banner = await getBannerById(bannerId);
  if (!banner || !isBannerLive(banner)) notFound();

  const meta = buildMetadata({
    title: banner.title,
    description: `${banner.title} — a Barakath promotion.`,
    path: `/banner/${bannerId}`,
    image: banner.image,
  });
  // Campaign landing pages shouldn't compete with category/product pages in search results (task brief).
  return { ...meta, robots: { index: false } };
}

export default async function BannerPage({ params, searchParams }: BannerPageProps) {
  const { bannerId } = await params;
  const banner = await getBannerById(bannerId);
  if (!banner || !isBannerLive(banner)) notFound();

  // Product-link banners have no listing of their own — redirect straight to the one product.
  // `getProductById` already enforces `status === 'Active'`, so a taken-down product falls through to
  // the "no longer available" empty state below instead of redirecting to a dead product page.
  if (banner.linkType === BannerLinkType.PRODUCT) {
    const product = await getProductById(banner.linkValue);
    if (product) redirect(`/product/${product.id}`);
  }

  const isCategoryLink = banner.linkType === BannerLinkType.CATEGORY;
  let page: PageResult | null = null;
  if (isCategoryLink) {
    const { after, before } = await searchParams;
    page = await buildProductQuery({ categoryId: banner.linkValue, after, before });
  }

  return (
    <main className="mx-auto w-full max-w-7xl px-4 pb-16 lg:px-5">
      <Breadcrumb items={[{ label: 'Home', href: '/' }, { label: banner.title }]} />

      <div className="relative mb-6 aspect-[3/1] w-full overflow-hidden rounded-2xl bg-subtle">
        <Image src={banner.image} alt={banner.title} fill sizes="100vw" priority className="object-cover" />
      </div>

      <h1 className="mb-6 font-display text-2xl font-extrabold tracking-tight text-foreground">
        {banner.title}
      </h1>

      {banner.linkType === BannerLinkType.EXTERNAL ? (
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-border bg-surface px-6 py-12 text-center">
          <p className="max-w-md text-sm text-muted">This promotion links to an external site.</p>
          <a
            href={banner.linkValue}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-md bg-gold px-5 py-2.5 text-sm font-bold text-ink transition hover:bg-gold-strong hover:text-white"
          >
            Visit link
            <ExternalLink className="size-4" aria-hidden />
          </a>
        </div>
      ) : banner.linkType === BannerLinkType.NONE ? (
        <EmptyState
          icon={<Layers className="size-12" aria-hidden />}
          title="No destination for this promotion"
          subtitle="This banner isn't linked to a product or category yet."
        />
      ) : banner.linkType === BannerLinkType.PRODUCT ? (
        // Reached only when the redirect above did not fire — the product is gone or inactive.
        <EmptyState
          icon={<PackageX className="size-12" aria-hidden />}
          title="This promotion is no longer available"
          subtitle="The product it pointed to has been removed or taken down."
        />
      ) : page && page.items.length > 0 ? (
        <>
          <ProductGrid products={page.items} />
          <BannerPager
            bannerId={bannerId}
            hasPrev={page.hasPrev}
            hasNext={page.hasNext}
            firstDocId={page.firstDocId}
            lastDocId={page.lastDocId}
          />
        </>
      ) : (
        <EmptyState
          icon={<Layers className="size-12" aria-hidden />}
          title="This promotion is no longer available"
          subtitle="This category currently has no products to show."
        />
      )}
    </main>
  );
}

/**
 * Prev/Next for the Category-link case — deliberately NOT the shared `Pagination` widget.
 *
 * WHY: `Pagination`'s numbered-page mode (see its file header) assumes the caller holds a STACK of
 * every visited cursor, so it can jump back to any earlier page by number. That stack is only
 * meaningful across client-side navigations within one session (its own doc says as much — "the
 * cursors are NOT in Redux… the owning page holds the stack in a ref"). This route is a stateless
 * Server Component rendered fresh per request/share-link: on any given request the ONLY cursors known
 * are this page's own `firstDocId`/`lastDocId`. Firestore's `before=`/`after=` genuinely recompute the
 * correct adjacent page with no memory required (`endBefore+limitToLast` / `startAfter+limit`), so a
 * plain, honest Prev/Next pair is what the data can actually support here — presenting numbered
 * buttons for pages this request has no cursor for would silently produce wrong hrefs. A category
 * under a banner is also an edge case unlikely to run deep (paginates only once it exceeds 12 items),
 * so this is not a meaningful loss of functionality.
 */
function BannerPager({
  bannerId,
  hasPrev,
  hasNext,
  firstDocId,
  lastDocId,
}: {
  bannerId: string;
  hasPrev: boolean;
  hasNext: boolean;
  firstDocId: string | null;
  lastDocId: string | null;
}) {
  if (!hasPrev && !hasNext) return null;

  const base =
    'inline-flex h-9 min-w-9 items-center justify-center rounded-md border px-3 text-[13px] font-bold transition border-border-strong bg-surface text-foreground';
  const enabled = `${base} hover:bg-subtle`;
  const disabled = `${base} cursor-not-allowed opacity-40`;

  return (
    <nav aria-label="Pagination" className="flex items-center justify-center gap-2 py-6">
      {hasPrev && firstDocId ? (
        <Link href={`/banner/${bannerId}?before=${firstDocId}`} className={enabled} aria-label="Previous page">
          <ChevronLeft className="size-4" aria-hidden />
        </Link>
      ) : (
        <span className={disabled} aria-hidden>
          <ChevronLeft className="size-4" />
        </span>
      )}
      {hasNext && lastDocId ? (
        <Link href={`/banner/${bannerId}?after=${lastDocId}`} className={enabled} aria-label="Next page">
          <ChevronRight className="size-4" aria-hidden />
        </Link>
      ) : (
        <span className={disabled} aria-hidden>
          <ChevronRight className="size-4" />
        </span>
      )}
    </nav>
  );
}
