'use client';

import { useEffect, useMemo, useState } from 'react';
import type { ProductProps } from '@barakath/shared';
import type { ProductSort, SubCategoryFacet } from '@/lib/data/products';

import { useAppDispatch, useAppSelector } from '@/stores/store';
import { toastSuccess } from '@/lib/toast';
import { Constants } from '@/config/constants';

import { fetchWishlistProducts, listWishlistIds, removeStaleWishlistDocs, WISHLIST_MAX_ITEMS } from '../api/wishlist';
import {
  computePriceBounds,
  computeSubCategoryFacets,
  filterWishlistItems,
  sortWishlistItems,
  type WishlistQuickFilter,
} from '../utils/filtering';
import {
  setWishlistError,
  setWishlistIds,
  setWishlistItems,
  setWishlistLoading,
  toggleWishlistId,
} from '../stores/wishlistSlice';

/**
 * useWishlist — every bit of `/wishlist`'s state and behaviour EXCEPT the actual JSX, which the page
 * (`src/app/(checkout)/wishlist/page.tsx`) owns instead. That split is not a style choice: this hook
 * lives under `src/features/wishlist`, and `import/no-restricted-paths` forbids a feature importing
 * another feature (`eslint.config.mjs`) — `FilterSidebar`/`QuickFilters`/`SortDropdown` (Batch 2,
 * `features/listing`) cannot be reached from here even though the wishlist page reuses them, so the
 * page (the app/route layer, exempt from that rule) does the composing and hands this hook only
 * primitives it already parsed from the URL.
 *
 * WHAT this hook does, in order: fetches the id list from `users/{uid}/wishlist`, resolves it to
 * products with a bounded chunked read (guarded above `WISHLIST_MAX_ITEMS`), hydrates `wishlistSlice`,
 * then filters/sorts/paginates the result IN MEMORY against the caller's current filter selection —
 * see `utils/filtering.ts` for why none of that can be a Firestore query.
 */
export interface UseWishlistParams {
  subCategoryNames: string[];
  minPrice?: number;
  maxPrice?: number;
  minRating?: number;
  quickFilter: WishlistQuickFilter;
  sort: ProductSort;
}

export interface UseWishlistResult {
  authLoading: boolean;
  /** The id-fetch + product-fetch cycle is in flight. */
  loading: boolean;
  /** Above `WISHLIST_MAX_ITEMS` saved ids — the page must not render the filter UI or grid at all. */
  tooMany: boolean;
  /** Total saved ids, once known (post auth resolve); null before the first fetch completes. */
  totalIdCount: number | null;
  /** Every wishlisted product currently resolved AND still wishlisted (see the hook body for why this
   *  is a derived intersection, not `items` as-fetched). */
  availableItems: ProductProps[];
  subCategoryFacets: SubCategoryFacet[];
  priceBounds: { min: number; max: number } | null;
  filteredCount: number;
  pageItems: ProductProps[];
  page: number;
  totalPages: number;
  setPage: (page: number) => void;
  /** Ids whose add/remove write is in flight — drives a per-card spinner overlay. */
  pendingIds: string[];
  /** The product a removal confirmation is currently open for; null when the dialog is closed. */
  removeTarget: ProductProps | null;
  requestRemove: (product: ProductProps) => void;
  confirmRemove: () => void;
  cancelRemove: () => void;
}

export function useWishlist(params: UseWishlistParams): UseWishlistResult {
  const { subCategoryNames, minPrice, maxPrice, minRating, quickFilter, sort } = params;
  const dispatch = useAppDispatch();

  const authLoading = useAppSelector((s) => s.auth.authLoading);
  const uid = useAppSelector((s) => s.auth.uid);
  const productIds = useAppSelector((s) => s.wishlist.productIds);
  const items = useAppSelector((s) => s.wishlist.items);
  const loading = useAppSelector((s) => s.wishlist.loading);
  const pendingIds = useAppSelector((s) => s.wishlist.pendingIds);

  const [tooMany, setTooMany] = useState(false);
  const [totalIdCount, setTotalIdCount] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const [removeTarget, setRemoveTarget] = useState<ProductProps | null>(null);

  // --- subcollection id fetch -> chunked product reads -> slice hydration, once per uid. ---
  useEffect(() => {
    if (authLoading || !uid) return;
    let cancelled = false;

    (async () => {
      dispatch(setWishlistLoading(true));
      dispatch(setWishlistError(null));
      try {
        const ids = await listWishlistIds(uid);
        if (cancelled) return;
        setTotalIdCount(ids.length);

        if (ids.length > WISHLIST_MAX_ITEMS) {
          // Guard: never issue 20+ chunked reads for a wishlist this large — ask the customer to trim
          // it instead. `productIds` is still set (hearts elsewhere stay accurate); `items` stays empty.
          setTooMany(true);
          dispatch(setWishlistIds(ids));
          dispatch(setWishlistItems([]));
          return;
        }
        setTooMany(false);
        dispatch(setWishlistIds(ids));

        const products = await fetchWishlistProducts(ids);
        if (cancelled) return;
        dispatch(setWishlistItems(products));

        // Stale entries: a wishlisted product deleted/unpublished since it was saved never resolves —
        // drop it from display (via productIds) and clean it up in Firestore with one batched delete.
        const foundIds = new Set(products.map((p) => p.id));
        const staleIds = ids.filter((id) => !foundIds.has(id));
        if (staleIds.length > 0) {
          dispatch(setWishlistIds(ids.filter((id) => foundIds.has(id))));
          void removeStaleWishlistDocs(uid, staleIds).catch(() => {
            // Non-fatal: the stale id is simply re-discovered (and re-attempted) next visit.
          });
        }
      } catch {
        if (!cancelled) dispatch(setWishlistError('Could not load your wishlist.'));
      } finally {
        if (!cancelled) dispatch(setWishlistLoading(false));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [uid, authLoading, dispatch]);

  /**
   * WHY the displayed set is `items` filtered by CURRENT `productIds`, not `items` as-fetched:
   * `productIds` is the live, sitewide membership (flipped instantly by `WishlistHeart`/the persistence
   * middleware from ANY page, including this one); deriving the display from the intersection means a
   * removal disappears immediately with no refetch, and a failed write's rollback (the middleware
   * re-flips `productIds`) makes the card reappear automatically, since its data is still in `items`.
   */
  const availableItems = useMemo(
    () => items.filter((p) => productIds.includes(p.id)),
    [items, productIds],
  );

  const subCategoryFacets = useMemo(() => computeSubCategoryFacets(availableItems), [availableItems]);
  const priceBounds = useMemo(() => computePriceBounds(availableItems), [availableItems]);

  const filteredSorted = useMemo(() => {
    const filtered = filterWishlistItems(availableItems, {
      subCategoryNames,
      minPrice,
      maxPrice,
      minRating,
      quickFilter,
    });
    return sortWishlistItems(filtered, sort);
  }, [availableItems, subCategoryNames, minPrice, maxPrice, minRating, quickFilter, sort]);

  // --- in-memory pagination, 12/page ---
  const totalPages = Math.max(1, Math.ceil(filteredSorted.length / Constants.PAGE_SIZE));
  const filterKey = JSON.stringify({ subCategoryNames, minPrice, maxPrice, minRating, quickFilter, sort });
  // A filter/sort change always starts back at page 1 — the previous page number belongs to a
  // different result set.
  useEffect(() => setPage(1), [filterKey]);
  // Removing the last item on the current page (or a filter shrinking the set) must not strand the
  // customer on a now-empty page — step back instead.
  useEffect(() => {
    setPage((p) => (p > totalPages ? totalPages : p));
  }, [totalPages]);

  const pageItems = useMemo(() => {
    const start = (page - 1) * Constants.PAGE_SIZE;
    return filteredSorted.slice(start, start + Constants.PAGE_SIZE);
  }, [filteredSorted, page]);

  function requestRemove(product: ProductProps) {
    setRemoveTarget(product);
  }

  function confirmRemove() {
    if (!removeTarget) return;
    // The exact same action `WishlistHeart` would have dispatched — the persistence middleware picks
    // it up identically, so this goes through the one real write path, not a page-local shortcut.
    dispatch(toggleWishlistId(removeTarget.id));
    toastSuccess(`Removed "${removeTarget.name}" from your wishlist.`);
    setRemoveTarget(null);
  }

  function cancelRemove() {
    setRemoveTarget(null);
  }

  return {
    authLoading,
    loading,
    tooMany,
    totalIdCount,
    availableItems,
    subCategoryFacets,
    priceBounds,
    filteredCount: filteredSorted.length,
    pageItems,
    page,
    totalPages,
    setPage,
    pendingIds,
    removeTarget,
    requestRemove,
    confirmRemove,
    cancelRemove,
  };
}
