import type { Metadata } from 'next';
import { Breadcrumb } from '@/components/Breadcrumb';
import { ProductGrid } from '@/components/catalog/ProductGrid';
import {
  countSearchResults,
  getCategories,
  getFlashSaleProducts,
  getNewArrivals,
  searchCategories,
  searchProducts,
  searchSubCategories,
} from '@/lib/data/catalog';
import { Constants } from '@/config/constants';
import { RecentSearches } from '@/features/search/results/components/RecentSearches';
import { TaxonomyChips } from '@/features/search/results/components/TaxonomyChips';
import { NoResultsSuggestions } from '@/features/search/results/components/NoResultsSuggestions';
import { SearchPagination } from '@/features/search/results/components/SearchPagination';
import { FetchErrorToast } from '@/features/search/results/components/FetchErrorToast';
import { SEARCH_RESULTS_GRID_CLASS } from '@/features/search/results/constants';

/**
 * /search — the full search RESULTS page (spec 3.20), replacing W1's placeholder.
 *
 * WHY a Server Component reading `searchParams`: the results URL is meant to be shared and linked, so
 * it must be real, crawlable HTML that already contains the products — not a client view assembled
 * after load. Everything user-specific (recent-searches pills, the pagination cursor stack) is pushed
 * into small client islands; the page itself only awaits values and renders.
 *
 * WHY `robots: index=false` despite living in the indexable (shop) group: an arbitrary `?q=` produces
 * effectively unbounded thin/duplicate pages that dilute crawl budget. The catalog PAGES
 * (category/product) are what should rank; the search box is a tool, not a landing page.
 */
export const revalidate = 300;

interface SearchPageProps {
  // Next 15: searchParams is async.
  searchParams: Promise<{
    q?: string | string[];
    after?: string | string[];
    page?: string | string[];
    trail?: string | string[];
  }>;
}

/** Normalise a possibly-repeated searchParam to a single trimmed string, or undefined when blank. */
function readParam(raw: string | string[] | undefined): string | undefined {
  const value = Array.isArray(raw) ? raw[0] : raw;
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

/** Same as `readParam`, but the query specifically is capped before it ever reaches Firestore — see
 * `tokenizeSearchTerm` in `lib/data/catalog.ts` for why an unbounded `?q=` is worth guarding against. */
function readQuery(raw: string | string[] | undefined): string {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return (value ?? '').trim().slice(0, Constants.SEARCH_QUERY_MAX_LENGTH);
}

export async function generateMetadata({ searchParams }: SearchPageProps): Promise<Metadata> {
  const q = readQuery((await searchParams).q);
  return {
    title: q ? `Search: ${q}` : 'Search',
    robots: { index: false, follow: true },
  };
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const params = await searchParams;
  const q = readQuery(params.q);
  const after = readParam(params.after);
  const page = Number(readParam(params.page) ?? '1') || 1;
  const trailRaw = readParam(params.trail);
  const trail = trailRaw ? trailRaw.split(',').filter(Boolean) : [];

  return (
    <main className="mx-auto w-full max-w-7xl px-4 pb-16 lg:px-5">
      <Breadcrumb items={[{ label: 'Home', href: '/' }, { label: 'Search' }]} />

      {!q ? (
        <>
          <h1 className="mb-6 font-display text-2xl font-extrabold tracking-tight text-foreground">
            Search
          </h1>
          <RecentSearches variant="main" />
        </>
      ) : (
        <SearchResults q={q} after={after} page={page} trail={trail} />
      )}
    </main>
  );
}

/**
 * Split out from the default export so the `!q` branch above never pays for a Firestore round-trip —
 * an async Server Component can be awaited as a normal child, no `<Suspense>` boundary required since
 * the page is already async top to bottom.
 */
async function SearchResults({
  q,
  after,
  page,
  trail,
}: {
  q: string;
  after?: string;
  page: number;
  trail: string[];
}) {
  let items: Awaited<ReturnType<typeof searchProducts>>['items'];
  let hasNext: boolean;
  let lastDocId: string | null;

  try {
    const productPage = await searchProducts(q, { after, pageSize: Constants.PAGE_SIZE });
    items = productPage.items;
    hasNext = productPage.hasNext;
    lastDocId = productPage.lastDocId;
  } catch (error) {
    // A thrown PRODUCT query (e.g. a missing index) must not blank the whole page — degrade to an
    // inline message plus a toast, never a raw exception reaching the customer.
    console.error('[search] failed to load product results for', q, error);
    return (
      <>
        <FetchErrorToast />
        <h1 className="mb-6 font-display text-2xl font-extrabold tracking-tight text-foreground">
          Results for <span className="text-primary">&ldquo;{q}&rdquo;</span>
        </h1>
        <p className="text-sm text-muted">
          Something went wrong loading these results. Please try again.
        </p>
      </>
    );
  }

  // The taxonomy row and the true count are a SEPARATE, lower-stakes Promise.all: a permission or
  // index problem specific to one of these (categories/sub-categories/the count aggregation) must
  // never take down product results that loaded fine — each degrades to its own safe fallback
  // instead of failing the whole page. (This is exactly what happened with the sub-category
  // collection-group query before its Firestore rule existed — caught here in case a future gap does
  // the same to a different query.)
  const [total, categories, subcategories] = await Promise.all([
    countSearchResults(q).catch((error: unknown) => {
      console.error('[search] count failed for', q, error);
      return items.length; // a same-page-size lower bound beats showing nothing
    }),
    searchCategories(q).catch((error: unknown) => {
      console.error('[search] category search failed for', q, error);
      return [];
    }),
    searchSubCategories(q).catch((error: unknown) => {
      console.error('[search] sub-category search failed for', q, error);
      return [];
    }),
  ]);

  // Only a sub-category needs the id -> name lookup, and only when at least one matched — skip the
  // (bounded, but not free) categories read otherwise.
  const categoryNameById = new Map<string, string>();
  if (subcategories.length > 0) {
    const allCategories = await getCategories();
    for (const category of allCategories) categoryNameById.set(category.id, category.name);
  }

  return (
    <>
      <h1 className="mb-1 font-display text-2xl font-extrabold tracking-tight text-foreground">
        Results for <span className="text-primary">&ldquo;{q}&rdquo;</span>
      </h1>
      <p className="mb-5 text-sm font-medium text-muted">
        {total} result{total === 1 ? '' : 's'} for &ldquo;{q}&rdquo;
      </p>

      <RecentSearches variant="pills" recordTerm={total > 0 ? q : undefined} />

      <TaxonomyChips
        categories={categories}
        subcategories={subcategories}
        categoryNameById={categoryNameById}
      />

      {total === 0 ? (
        <NoResultsFallback query={q} />
      ) : (
        <>
          <ProductGrid products={items} className={SEARCH_RESULTS_GRID_CLASS} />
          <SearchPagination q={q} page={page} trail={trail} hasNext={hasNext} lastDocId={lastDocId} />
        </>
      )}
    </>
  );
}

/** Flash-sale first, new arrivals as the fallback — the "You might like" row inside `NoResultsSuggestions`. */
async function NoResultsFallback({ query }: { query: string }) {
  const flash = await getFlashSaleProducts(8);
  const suggestions = flash.length > 0 ? flash : await getNewArrivals(8);
  return <NoResultsSuggestions query={query} suggestions={suggestions} />;
}
