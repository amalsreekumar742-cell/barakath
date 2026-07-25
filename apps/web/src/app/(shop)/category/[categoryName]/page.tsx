import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PackageX } from 'lucide-react';
import { Breadcrumb } from '@/components/Breadcrumb';
import { EmptyState } from '@/components/EmptyState';
import { ProductGrid, PRODUCT_GRID_CLASS } from '@/components/catalog/ProductGrid';
import { ProductCard } from '@/components/catalog/ProductCard';
import { FlashProductCard } from '@/components/catalog/FlashProductCard';
import { buildMetadata, itemListSchema } from '@/lib/seo';
import { getCategoryByName, getFirstVariantByProduct } from '@/lib/data/catalog';
import { buildProductQuery, getFilterFacets } from '@/lib/data/products';
import { Constants } from '@/config/constants';
import { parseListingParams, flattenSearchParams, type RawSearchParams } from '@/features/listing/utils/filters';
import { getListingCount } from '@/features/listing/utils/getListingCount';
import { FilterSidebar } from '@/features/listing/components/FilterSidebar';
import { QuickFilters } from '@/features/listing/components/QuickFilters';
import { SortDropdown } from '@/features/listing/components/SortDropdown';
import { CategoryPagination } from '@/features/listing/components/CategoryPagination';

/**
 * /category/[categoryName] — the product listing page (spec 3.6).
 *
 * ARCHITECTURE: a Server Component; ALL filter/sort/page state lives in `searchParams`, never in
 * `catalogSlice` or component state. `FilterSidebar`/`QuickFilters`/`SortDropdown` are client islands
 * that hold only local UI staging (the price slider's in-drag value); committing a change calls
 * `router.push` with a new query string, which re-renders THIS Server Component with fresh data — so
 * every filter combination is a real, shareable, back-button-able, crawlable URL.
 *
 * `/category/all` is a reserved slug (spec 3.6 / the home page's flash-sale & new-arrivals "View all"
 * links: `?sale=onSale`, `?new=true`) — no `categoryId` constraint, sub-category section hidden.
 *
 * WHY `buildProductQuery`'s rejection is NOT caught here: a thrown `FAILED_PRECONDITION` (missing
 * composite index for a filter combination) must surface in server logs with the failing combination,
 * per the Batch 2 brief — swallowing it into an empty grid would hide a real index gap. It is left to
 * propagate to Next's default error handling.
 */
export const revalidate = 300;

interface CategoryPageProps {
  params: Promise<{ categoryName: string }>;
  searchParams: Promise<RawSearchParams>;
}

const ALL_SLUG = 'all';

/** `params.categoryName` is Next's decoded route segment; guarded in case a caller double-encoded it. */
function decodeSegment(raw: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

export async function generateMetadata({ params, searchParams }: CategoryPageProps): Promise<Metadata> {
  const categoryName = decodeSegment((await params).categoryName);
  const sp = await searchParams;
  const parsed = parseListingParams(sp);
  const basePath = `/category/${encodeURIComponent(categoryName)}`;

  const isAll = categoryName === ALL_SLUG;
  const category = isAll ? null : await getCategoryByName(categoryName);
  if (!isAll && !category) notFound();

  const title = isAll ? 'All products' : (category?.name ?? categoryName);
  const meta = buildMetadata({
    title,
    description: isAll
      ? 'Browse every product at Barakath — perfumes, books, clothing and Islamic essentials.'
      : `Shop ${title} at Barakath.`,
    path: basePath,
  });

  // Any searchParam beyond the bare category page is a filtered/paged variant — noindex it and point
  // its canonical at the bare URL, so ranking signal consolidates on the one page worth ranking.
  if (parsed.hasAnyParam) {
    return { ...meta, robots: { index: false, follow: true }, alternates: { canonical: basePath } };
  }
  return meta;
}

export default async function CategoryPage({ params, searchParams }: CategoryPageProps) {
  const categoryName = decodeSegment((await params).categoryName);
  const sp = await searchParams;
  const parsed = parseListingParams(sp);
  const basePath = `/category/${encodeURIComponent(categoryName)}`;
  const filterParams = flattenSearchParams(sp);
  // Pagination-only keys are rebuilt by CategoryPagination from its own props — never carried as a
  // stale base for a fresh filter change (see RESET_ON_FILTER_CHANGE in urlParams.ts).
  delete filterParams.after;
  delete filterParams.before;
  delete filterParams.page;
  delete filterParams.trail;

  const isAll = categoryName === ALL_SLUG;
  const category = isAll ? null : await getCategoryByName(categoryName);
  if (!isAll && !category) notFound();

  const categoryId = category?.id;
  const subCategoryNames = parsed.subCategoryNames.length > 0 ? parsed.subCategoryNames : undefined;

  const [facets, pageResult, count] = await Promise.all([
    getFilterFacets({ categoryId }),
    buildProductQuery({
      categoryId,
      subCategoryNames,
      minPrice: parsed.minPrice,
      maxPrice: parsed.maxPrice,
      minRating: parsed.minRating,
      stockFilter: parsed.stockFilter,
      saleFilter: parsed.saleFilter,
      isNewArrival: parsed.isNewArrival || undefined,
      sort: parsed.sort,
      after: parsed.after,
      before: parsed.before,
      limit: Constants.PAGE_SIZE,
    }),
    getListingCount({
      categoryId,
      subCategoryNames,
      isNewArrival: parsed.isNewArrival || undefined,
      saleFilter: parsed.saleFilter,
      minPrice: parsed.minPrice,
      maxPrice: parsed.maxPrice,
      minRating: parsed.minRating,
    }),
  ]);

  const title = isAll ? 'All products' : (category?.name ?? categoryName);
  const quickFilterActive = parsed.saleFilter === 'onSale' ? 'onSale' : parsed.stockFilter === 'inStock' ? 'inStock' : 'all';

  /**
   * The "On Sale" quick filter guarantees `isFlashSale === true` on EVERY item in `pageResult.items`
   * (that is what `saleFilter: 'onSale'` means) — so on this view, `ProductCard`'s regular
   * `minPrice`/`maxPrice` price is systematically wrong for the whole grid, not an edge case (spec
   * §1.16: the offer price must be HIDDEN during a flash sale, flash price shown instead). One bounded
   * batch of first-variant reads (≤ `Constants.PAGE_SIZE` products, already parallelised inside
   * `getFirstVariantByProduct`) resolves this the same way the home flash rail does — never fetched on
   * the general/unfiltered grid, where the mismatch would be rare rather than guaranteed.
   */
  const flashVariantsById =
    parsed.saleFilter === 'onSale' && pageResult.items.length > 0
      ? await getFirstVariantByProduct(pageResult.items.map((p) => p.id))
      : null;

  return (
    <main className="mx-auto w-full max-w-7xl px-4 pb-16 lg:px-5">
      <Breadcrumb items={[{ label: 'Home', href: '/' }, { label: title }]} />

      {/* Page-1 (unfiltered) structured data only — spec: filtered/paged variants are noindexed anyway. */}
      {!parsed.hasAnyParam && pageResult.items.length > 0 && (
        <script
          type="application/ld+json"
          // Safe: itemListSchema only serialises our own product name/url data, never user input.
          dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListSchema(pageResult.items)) }}
        />
      )}

      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <h1 className="font-display text-2xl font-extrabold tracking-tight text-foreground">
          {title}
          <span className="ml-2 align-middle text-sm font-medium text-muted">
            {count} product{count === 1 ? '' : 's'}
          </span>
        </h1>
      </div>

      <div className="flex flex-col gap-6 lg:flex-row">
        <FilterSidebar
          pathname={basePath}
          currentParams={filterParams}
          showSubCategory={!isAll}
          subCategoryFacets={facets.subCategories}
          priceBounds={facets.priceBounds}
          selected={{
            subCategoryNames: parsed.subCategoryNames,
            minPrice: parsed.minPrice,
            maxPrice: parsed.maxPrice,
            minRating: parsed.minRating,
          }}
          resultCount={count}
        />

        <div className="min-w-0 flex-1">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <QuickFilters pathname={basePath} currentParams={filterParams} active={quickFilterActive} />
            <SortDropdown pathname={basePath} currentParams={filterParams} value={parsed.sort} />
          </div>

          {pageResult.items.length === 0 ? (
            <div className="flex flex-col items-center gap-3">
              <EmptyState
                icon={<PackageX className="size-12" aria-hidden />}
                title="No products match these filters"
                subtitle="Try widening your price range or clearing a filter."
              />
              {parsed.hasAnyParam && (
                <Link href={basePath} className="text-[13px] font-medium text-primary hover:underline">
                  Clear all filters
                </Link>
              )}
            </div>
          ) : (
            <>
              {flashVariantsById ? (
                <div className={PRODUCT_GRID_CLASS}>
                  {pageResult.items.map((product) => {
                    const variant = flashVariantsById[product.id];
                    // A product still flagged isFlashSale but whose variant read came back empty
                    // (deleted mid-request) falls back to the regular card rather than being dropped.
                    return variant ? (
                      <FlashProductCard key={product.id} product={product} variant={variant} />
                    ) : (
                      <ProductCard key={product.id} product={product} />
                    );
                  })}
                </div>
              ) : (
                <ProductGrid products={pageResult.items} />
              )}
              <CategoryPagination
                pathname={basePath}
                filterParams={filterParams}
                page={parsed.page}
                trail={parsed.trail}
                lastDocId={pageResult.lastDocId}
                hasNext={pageResult.hasNext}
              />
            </>
          )}
        </div>
      </div>
    </main>
  );
}
