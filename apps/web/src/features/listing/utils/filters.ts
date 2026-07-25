import type { ProductSort } from '@/lib/data/products';
import type { ParsedListingParams } from '../types/listing';

/**
 * filters — pure parsing between the page's raw Next.js `searchParams` and the typed
 * `ParsedListingParams` every server read and every client filter control is built from.
 *
 * WHY parsing is pure and has no Firestore/React import: it runs once in the Server Component (to
 * build query params) and its inverse (`toRawParams`) is reused by the client controls to build the
 * NEXT href — sharing one module keeps the URL grammar defined in exactly one place.
 */

/** Next 15's resolved `searchParams` shape: a value may be absent, a string, or repeated (array). */
export type RawSearchParams = Record<string, string | string[] | undefined>;

const SORT_VALUES: ProductSort[] = ['popularity', 'newest', 'priceAsc', 'priceDesc', 'rating'];

/** First value of a possibly-repeated searchParam. */
function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

/** A finite, positive number, or undefined for anything else (blank, NaN, negative, `Infinity`). */
function toPositiveNumber(raw: string | undefined): number | undefined {
  if (!raw) return undefined;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

/**
 * `?sub=` is a comma-joined list of `encodeURIComponent`-ed sub-category NAMES (see
 * `urlParams.ts#buildSubParam`). Splitting on the raw (still-encoded) string first and decoding each
 * piece is what lets a sub-category name contain a literal space without it being mistaken for the
 * list separator.
 */
function parseSubParam(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(',')
    .map((piece) => {
      try {
        return decodeURIComponent(piece).trim();
      } catch {
        return piece.trim();
      }
    })
    .filter(Boolean);
}

/** Parse the page's `searchParams` into the typed shape every child reads. */
export function parseListingParams(sp: RawSearchParams): ParsedListingParams {
  const subCategoryNames = parseSubParam(first(sp.sub));

  const minPrice = toPositiveNumber(first(sp.minPrice));
  const maxPrice = toPositiveNumber(first(sp.maxPrice));

  const ratingRaw = Number(first(sp.rating));
  const minRating = [1, 2, 3, 4].includes(ratingRaw) ? ratingRaw : undefined;

  const stockFilter: 'all' | 'inStock' = first(sp.stock) === 'inStock' ? 'inStock' : 'all';
  const saleFilter: 'all' | 'onSale' = first(sp.sale) === 'onSale' ? 'onSale' : 'all';
  const isNewArrival = first(sp.new) === 'true';

  const sortRaw = first(sp.sort);
  const sort: ProductSort = (SORT_VALUES as string[]).includes(sortRaw ?? '')
    ? (sortRaw as ProductSort)
    : 'popularity';

  const after = first(sp.after) || undefined;
  const before = first(sp.before) || undefined;

  const pageRaw = Number(first(sp.page));
  const page = Number.isInteger(pageRaw) && pageRaw > 0 ? pageRaw : 1;

  const trailRaw = first(sp.trail);
  const trail = trailRaw ? trailRaw.split(',').filter(Boolean) : [];

  return {
    subCategoryNames,
    minPrice,
    maxPrice,
    minRating,
    stockFilter,
    saleFilter,
    isNewArrival,
    sort,
    after,
    before,
    page,
    trail,
    hasAnyParam: Object.keys(sp).length > 0,
  };
}

/**
 * Flatten Next's raw `searchParams` (values may be repeated) to a plain `Record<string,string>` — the
 * shape every client filter control receives as a prop and mutates locally before pushing a new URL.
 * WHY a prop instead of each control calling `useSearchParams()` itself: this page is a Server
 * Component that already parsed the params once; re-reading them via the hook in three separate client
 * children would (a) duplicate the parsing and (b) require wrapping each in its own `<Suspense>`.
 */
export function flattenSearchParams(sp: RawSearchParams): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(sp)) {
    const v = first(value);
    if (v) out[key] = v;
  }
  return out;
}
