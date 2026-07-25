'use client';

import { useEffect, useRef, useState } from 'react';
import {
  collection,
  collectionGroup,
  getDocs,
  limit,
  query,
  where,
  type DocumentData,
  type QuerySnapshot,
} from 'firebase/firestore';
import { FirestoreCollections } from '@barakath/shared';
import type { CategoryProps, ProductProps, SubCategoryProps } from '@barakath/shared';
import { db } from '@/lib/firebaseConfig';
import { Constants } from '@/config/constants';
import type { SearchSuggestionsState } from '../types/search';

/**
 * Live, debounced search suggestions for the header dropdown — Products, Categories and
 * Sub-categories in one pass.
 *
 * WHY the query lives in a hook and not `lib/data/*`: `lib/data` is `server-only` and feeds Server
 * Components. This reacts to keystrokes in the browser, so it reads the CLIENT `db` directly. The
 * skill routes client reads through a thunk when they feed a slice, but the task forbids a search
 * slice — this state is local to the open dropdown and dies when it closes, so a hook that owns its
 * own `useState` is the correct home.
 *
 * WHY `array-contains` on the precomputed `keywords` field: Firestore has no case-insensitive
 * "contains", so every searchable doc stores a lowercased keyword array (built by the shared
 * `keywordsBuilder` when the doc is written). The term is lowercased to match; each group is capped
 * at `SEARCH_GROUP_LIMIT`, and products also pin `status == 'Active'` so a draft never surfaces.
 *
 * WHY each group is queried independently and its failure isolated: sub-categories are read with a
 * COLLECTION-GROUP query, which needs a collection-group index on `subCategories.keywords`. If that
 * index is missing the query throws — but a thrown sub-category query must not blank out the product
 * suggestions the visitor actually wants. `Promise.allSettled` lets each group succeed or fail alone.
 *
 * WHY the request id guard: keystrokes fire overlapping queries and a slow earlier one can resolve
 * AFTER a faster later one, painting stale results. Stamping each run and ignoring any resolution
 * that is not the latest keeps the dropdown showing the current term's results.
 */
const EMPTY: SearchSuggestionsState = {
  products: [],
  categories: [],
  subcategories: [],
  loading: false,
  empty: false,
  error: null,
};

function mapDocs<T>(snap: QuerySnapshot<DocumentData>): T[] {
  return snap.docs.map((d) => ({ ...d.data(), id: d.id }) as T);
}

export function useSearchSuggestions(rawTerm: string): SearchSuggestionsState {
  const [state, setState] = useState<SearchSuggestionsState>(EMPTY);
  // Monotonic id: only the most recently STARTED query is allowed to write state.
  const runId = useRef(0);

  useEffect(() => {
    const term = rawTerm.trim().toLowerCase();

    // Below the threshold there is nothing to query — the dropdown shows recent searches instead.
    if (term.length < Constants.SEARCH_MIN_CHARS) {
      runId.current += 1;
      setState(EMPTY);
      return;
    }

    const id = (runId.current += 1);
    let cancelled = false;
    setState((s) => ({ ...s, loading: true, error: null }));

    const timer = setTimeout(async () => {
      const productsQ = getDocs(
        query(
          collection(db, FirestoreCollections.products),
          where('status', '==', 'Active'),
          where('keywords', 'array-contains', term),
          limit(Constants.SEARCH_GROUP_LIMIT),
        ),
      );
      const categoriesQ = getDocs(
        query(
          collection(db, FirestoreCollections.categories),
          where('keywords', 'array-contains', term),
          limit(Constants.SEARCH_GROUP_LIMIT),
        ),
      );
      const subcategoriesQ = getDocs(
        query(
          collectionGroup(db, FirestoreCollections.subCategories),
          where('keywords', 'array-contains', term),
          limit(Constants.SEARCH_GROUP_LIMIT),
        ),
      );

      const [products, categories, subcategories] = await Promise.allSettled([
        productsQ,
        categoriesQ,
        subcategoriesQ,
      ]);

      // A run that was superseded (or whose input unmounted) must not clobber fresher state.
      if (cancelled || id !== runId.current) return;

      const p = products.status === 'fulfilled' ? mapDocs<ProductProps>(products.value) : [];
      const c = categories.status === 'fulfilled' ? mapDocs<CategoryProps>(categories.value) : [];
      const s =
        subcategories.status === 'fulfilled'
          ? mapDocs<SubCategoryProps>(subcategories.value)
          : [];

      // Only surface an error if EVERY group failed; a single missing index degrades quietly.
      const allFailed =
        products.status === 'rejected' &&
        categories.status === 'rejected' &&
        subcategories.status === 'rejected';

      setState({
        products: p,
        categories: c,
        subcategories: s,
        loading: false,
        empty: p.length === 0 && c.length === 0 && s.length === 0 && !allFailed,
        error: allFailed ? 'Could not load suggestions.' : null,
      });
    }, Constants.SEARCH_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [rawTerm]);

  return state;
}
