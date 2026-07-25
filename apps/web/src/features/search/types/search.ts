import type { CategoryProps, ProductProps, SubCategoryProps } from '@barakath/shared';

/**
 * The shapes the live search surfaces return.
 *
 * WHY three separate arrays rather than one tagged union list: the dropdown renders them as three
 * labelled GROUPS ("Products" / "Categories" / "Sub-categories"), each capped independently, so the
 * consumer wants them pre-split, not a mixed list it has to bucket on every render.
 *
 * WHY the full domain `XxxProps` and not a trimmed suggestion type: these come straight off the
 * Firestore docs already typed, a product suggestion links by id and shows a thumbnail, and inventing
 * a second slimmer type here would be a second thing to keep in step with the catalogue.
 */
export interface SearchSuggestions {
  products: ProductProps[];
  categories: CategoryProps[];
  subcategories: SubCategoryProps[];
}

/** The named state the suggestion hook exposes — never inferred from empty-array checks. */
export interface SearchSuggestionsState extends SearchSuggestions {
  /** True while a debounced query is in flight. */
  loading: boolean;
  /** True once a query has resolved for the current term and every group came back empty. */
  empty: boolean;
  error: string | null;
}
