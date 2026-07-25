'use client';

import { Suspense, useMemo, type MouseEvent } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { Heart, HeartCrack, Loader2 } from 'lucide-react';

import { Breadcrumb } from '@/components/Breadcrumb';
import { EmptyState } from '@/components/EmptyState';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Pagination } from '@/components/Pagination';
import { ProductCard } from '@/components/catalog/ProductCard';
import { ProductGrid, PRODUCT_GRID_CLASS } from '@/components/catalog/ProductGrid';
import { ProductGridSkeleton } from '@/components/catalog/ProductGridSkeleton';

import { FilterSidebar } from '@/features/listing/components/FilterSidebar';
import { QuickFilters } from '@/features/listing/components/QuickFilters';
import { SortDropdown } from '@/features/listing/components/SortDropdown';
import { flattenSearchParams, parseListingParams } from '@/features/listing/utils/filters';
import type { QuickFilterValue } from '@/features/listing/types/listing';
import { useWishlist } from '@/features/wishlist/hooks/useWishlist';

/**
 * `WishlistHeart`'s aria-label when a product IS wishlisted — every card on this page shows it, since
 * everything here is by definition already saved. Used to detect a heart click during the CAPTURE
 * phase; see `handleCardClickCapture` below for why this is how removal gets a confirmation dialog.
 */
const REMOVE_HEART_LABEL = 'Remove from wishlist';

/**
 * /wishlist — the product listing page (spec 3.12), and this batch's ONE genuinely cross-feature
 * composition: `FilterSidebar`/`QuickFilters`/`SortDropdown` are Batch 2's `features/listing`
 * components, and `import/no-restricted-paths` (`eslint.config.mjs`) forbids `features/wishlist`
 * reaching into `features/listing` directly — no exception is carved out for this pair the way there is
 * for checkout→address. The rule's own message is "compose them at the app/route layer", which is
 * exactly this file: a Client Component (per-customer data — see `useWishlist`'s header comment for why
 * this can never be a Server Component) that parses the URL itself, asks `useWishlist` (owns all the
 * Firestore/Redux/in-memory-filtering logic, zero `features/listing` imports of its own) to answer it,
 * and renders the listing feature's shared controls around that answer.
 *
 * ARCHITECTURE mirror of `/category/[categoryName]`: same URL-param grammar for sub-category/price/
 * rating/quick-filter/sort (`parseListingParams`/`flattenSearchParams`), same `FilterSidebar`/
 * `QuickFilters`/`SortDropdown` wiring — the only difference is `useWishlist` answers every query IN
 * MEMORY over a once-fetched set instead of `buildProductQuery` hitting Firestore again per change,
 * because there is no server-side way to filter/sort/paginate an arbitrary customer-chosen id set
 * (`in` queries cap at a bounded list and cannot combine with a second range filter).
 *
 * WHY the `Suspense` wrapper below: `useSearchParams()` requires it so the route can still prerender a
 * shell — same pattern as `(checkout)/order-success/page.tsx` and `(auth)/login/page.tsx`. Invisible in
 * practice since `WishlistPageContent` renders a skeleton immediately anyway.
 */
export default function WishlistPage() {
  return (
    <Suspense fallback={<WishlistPageSkeleton />}>
      <WishlistPageContent />
    </Suspense>
  );
}

function WishlistPageContent() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const rawParams = useMemo(() => Object.fromEntries(searchParams.entries()), [searchParams]);
  const parsed = useMemo(() => parseListingParams(rawParams), [rawParams]);
  const filterParams = useMemo(() => flattenSearchParams(rawParams), [rawParams]);
  const quickFilterActive: QuickFilterValue =
    parsed.saleFilter === 'onSale' ? 'onSale' : parsed.stockFilter === 'inStock' ? 'inStock' : 'all';

  const wl = useWishlist({
    subCategoryNames: parsed.subCategoryNames,
    minPrice: parsed.minPrice,
    maxPrice: parsed.maxPrice,
    minRating: parsed.minRating,
    quickFilter: quickFilterActive,
    sort: parsed.sort,
  });

  function handleCardClickCapture(e: MouseEvent<HTMLDivElement>, product: (typeof wl.pageItems)[number]) {
    const target = e.target as HTMLElement;
    // Every OTHER click on the card (the image, the name) must keep navigating to the PDP as normal —
    // only a click landing on the heart button gets intercepted.
    if (!target.closest(`button[aria-label="${REMOVE_HEART_LABEL}"]`)) return;
    // Stopping propagation during the CAPTURE phase, on an ancestor of the heart button, prevents the
    // event from ever reaching the button's own bubble-phase handler — so `WishlistHeart`'s built-in
    // instant, un-confirmed toggle never fires here. This is the only way to put a confirmation dialog
    // in front of the removal without editing `WishlistHeart` itself, which is shared, read-only
    // (`src/components/catalog/**`) code this session does not own.
    e.preventDefault();
    e.stopPropagation();
    wl.requestRemove(product);
  }

  if (wl.authLoading || wl.loading) {
    return <WishlistPageSkeleton />;
  }

  if (wl.tooMany) {
    return (
      <main className="mx-auto w-full max-w-7xl px-4 pb-16 lg:px-5">
        <Breadcrumb items={[{ label: 'Home', href: '/' }, { label: 'Wishlist' }]} />
        <EmptyState
          icon={<HeartCrack className="size-12" aria-hidden />}
          title="Your wishlist has grown very large"
          subtitle={`You have ${wl.totalIdCount ?? 'over 200'} saved items. Please remove a few so we can show your wishlist.`}
        />
      </main>
    );
  }

  if ((wl.totalIdCount ?? 0) === 0) {
    return (
      <main className="mx-auto w-full max-w-7xl px-4 pb-16 lg:px-5">
        <Breadcrumb items={[{ label: 'Home', href: '/' }, { label: 'Wishlist' }]} />
        <EmptyState icon={<Heart className="size-12" aria-hidden />} title="Your wishlist is empty" />
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-7xl px-4 pb-16 lg:px-5">
      <Breadcrumb items={[{ label: 'Home', href: '/' }, { label: 'Wishlist' }]} />

      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <h1 className="font-display text-2xl font-extrabold tracking-tight text-foreground">
          Wishlist
          <span className="ml-2 align-middle text-sm font-medium text-muted">
            {wl.availableItems.length} item{wl.availableItems.length === 1 ? '' : 's'}
          </span>
        </h1>
      </div>

      <div className="flex flex-col gap-6 lg:flex-row">
        <FilterSidebar
          pathname={pathname}
          currentParams={filterParams}
          showSubCategory
          subCategoryFacets={wl.subCategoryFacets}
          priceBounds={wl.priceBounds}
          selected={{
            subCategoryNames: parsed.subCategoryNames,
            minPrice: parsed.minPrice,
            maxPrice: parsed.maxPrice,
            minRating: parsed.minRating,
          }}
          resultCount={wl.filteredCount}
        />

        <div className="min-w-0 flex-1">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <QuickFilters pathname={pathname} currentParams={filterParams} active={quickFilterActive} />
            <SortDropdown pathname={pathname} currentParams={filterParams} value={parsed.sort} />
          </div>

          {wl.filteredCount === 0 ? (
            <div className="flex flex-col items-center gap-3">
              <EmptyState
                icon={<Heart className="size-12" aria-hidden />}
                title="No saved items match these filters"
                subtitle="Try widening your price range or clearing a filter."
              />
              <Link href={pathname} className="text-[13px] font-medium text-primary hover:underline">
                Clear all filters
              </Link>
            </div>
          ) : (
            <>
              <ProductGrid className={PRODUCT_GRID_CLASS}>
                {wl.pageItems.map((product) => (
                  <div
                    key={product.id}
                    className="relative"
                    onClickCapture={(e) => handleCardClickCapture(e, product)}
                  >
                    <ProductCard product={product} />
                    {wl.pendingIds.includes(product.id) && (
                      <div
                        className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-surface/70 backdrop-blur-sm"
                        aria-hidden
                      >
                        <Loader2 className="size-5 animate-spin text-primary" />
                      </div>
                    )}
                  </div>
                ))}
              </ProductGrid>

              <Pagination
                currentPage={wl.page}
                furthestPage={wl.totalPages}
                hasMore={false}
                onGoToPage={wl.setPage}
              />
            </>
          )}
        </div>
      </div>

      <ConfirmDialog
        isOpen={wl.removeTarget !== null}
        title="Remove from wishlist?"
        description={wl.removeTarget ? `"${wl.removeTarget.name}" will be removed from your wishlist.` : undefined}
        confirmLabel="Remove"
        destructive
        onConfirm={wl.confirmRemove}
        onClose={wl.cancelRemove}
      />
    </main>
  );
}

function WishlistPageSkeleton() {
  return (
    <main className="mx-auto w-full max-w-7xl px-4 pb-16 lg:px-5">
      <Breadcrumb items={[{ label: 'Home', href: '/' }, { label: 'Wishlist' }]} />
      <div className="mb-5 h-8 w-48 animate-pulse rounded bg-subtle" />
      <ProductGridSkeleton />
    </main>
  );
}
