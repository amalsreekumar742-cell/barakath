/**
 * Reviews feature-local types (spec §1.11) — the active list filters and the summary-stats shape.
 * WHY local (not shared): these describe admin UI state + an aggregated view, not a Firestore document.
 */

/** Publish tab value; mirrors the ReviewFilter enum labels ('All' applies no isPublished constraint). */
export type ReviewPublishStatus = 'All' | 'Published' | 'Hidden';

/**
 * Active review-list filters. `rating` is undefined for "any rating" (no rating constraint); `searchTerm`
 * runs server-side against the review `keywords` array.
 */
export interface ReviewFilters {
  publishStatus: ReviewPublishStatus;
  rating?: number;
  searchTerm: string;
}

/** Per-star-rating counts (1★..5★) for the distribution bars (spec §1.11 summary). */
export interface StarCounts {
  1: number;
  2: number;
  3: number;
  4: number;
  5: number;
}

/** Summary stats shown above the list: totals, the average rating, and the star distribution. */
export interface ReviewStats {
  total: number;
  published: number;
  hidden: number;
  averageRating: number;
  starCounts: StarCounts;
}
