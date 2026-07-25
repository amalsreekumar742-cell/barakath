import { createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import type { ReviewProps } from '@barakath/shared/types';
import { fetchReviews } from '../api/fetchReviews';
import { fetchReviewStats } from '../api/fetchReviewStats';
import { toggleReviewPublish } from '../api/toggleReviewPublish';
import { deleteReview } from '../api/deleteReview';
import { addAdminResponse } from '../api/addAdminResponse';
import { removeAdminResponse } from '../api/removeAdminResponse';
import type { ReviewFilters, ReviewStats } from '../types';

/* eslint-disable @typescript-eslint/no-explicit-any -- Firestore cursors are opaque QueryDocumentSnapshots */

/**
 * reviewsSlice — the review list + filters + summary stats and the per-review admin actions (spec §1.11).
 *
 * WHY changing a filter resets the list: the list is a cursor-paginated view of the CURRENT filters, so
 * any change clears reviews/cursor and the component refetches page one. WHY we patch stats locally on
 * toggle/delete/response: the summary counts are expensive aggregate queries, so after a mutation we
 * shift the affected counters in place rather than re-running all seven aggregations. Per-item loading
 * (toggle/delete/response) is keyed by the acting review id so only that card shows a spinner.
 */
interface ReviewsState {
  reviews: ReviewProps[];
  lastVisible: any;
  hasMore: boolean;
  loading: boolean;
  loadingMore: boolean;
  error: string | null;

  filters: ReviewFilters;

  stats: ReviewStats | null;
  statsLoading: boolean;

  toggleLoading: string | null;
  deleteLoading: string | null;
  responseLoading: string | null;
}

const initialState: ReviewsState = {
  reviews: [],
  lastVisible: null,
  hasMore: false,
  loading: false,
  loadingMore: false,
  error: null,
  filters: { publishStatus: 'All', rating: undefined, searchTerm: '' },
  stats: null,
  statsLoading: false,
  toggleLoading: null,
  deleteLoading: null,
  responseLoading: null,
};

const resetList = (s: ReviewsState) => {
  s.reviews = [];
  s.lastVisible = null;
  s.hasMore = false;
};

/** Dedup helper: append only ids not already present (StrictMode / rapid "View More" can double-dispatch). */
const appendDedup = (existing: ReviewProps[], incoming: ReviewProps[]): ReviewProps[] => {
  const seen = new Set(existing.map((x) => x.id));
  return [...existing, ...incoming.filter((x) => !seen.has(x.id))];
};

const reviewsSlice = createSlice({
  name: 'reviews',
  initialState,
  reducers: {
    setPublishFilter(s, a: PayloadAction<ReviewFilters['publishStatus']>) {
      s.filters.publishStatus = a.payload;
      resetList(s);
    },
    setRatingFilter(s, a: PayloadAction<number | undefined>) {
      s.filters.rating = a.payload;
      resetList(s);
    },
    setReviewSearch(s, a: PayloadAction<string>) {
      s.filters.searchTerm = a.payload;
      resetList(s);
    },
  },
  extraReducers: (builder) => {
    builder
      // --- list ---
      .addCase(fetchReviews.pending, (s, a) => {
        if (a.meta.arg.cursor) s.loadingMore = true;
        else {
          s.loading = true;
          s.error = null;
        }
      })
      .addCase(fetchReviews.fulfilled, (s, a) => {
        const isFirst = !a.meta.arg.cursor;
        s.loading = false;
        s.loadingMore = false;
        s.reviews = isFirst ? a.payload.items : appendDedup(s.reviews, a.payload.items);
        s.lastVisible = a.payload.lastVisible;
        s.hasMore = a.payload.hasMore;
      })
      .addCase(fetchReviews.rejected, (s, a) => {
        s.loading = false;
        s.loadingMore = false;
        s.error = a.payload ?? 'Failed to load reviews';
      })

      // --- stats ---
      .addCase(fetchReviewStats.pending, (s) => {
        s.statsLoading = true;
      })
      .addCase(fetchReviewStats.fulfilled, (s, a) => {
        s.statsLoading = false;
        s.stats = a.payload;
      })
      .addCase(fetchReviewStats.rejected, (s) => {
        s.statsLoading = false;
      })

      // --- toggle publish ---
      .addCase(toggleReviewPublish.pending, (s, a) => {
        s.toggleLoading = a.meta.arg.reviewId;
      })
      .addCase(toggleReviewPublish.fulfilled, (s, a) => {
        s.toggleLoading = null;
        const { reviewId, isPublished } = a.payload;
        const row = s.reviews.find((r) => r.id === reviewId);
        if (row) row.isPublished = isPublished;
        // Move one review between the published/hidden buckets (total unchanged).
        if (s.stats) {
          if (isPublished) {
            s.stats.published += 1;
            s.stats.hidden = Math.max(0, s.stats.hidden - 1);
          } else {
            s.stats.hidden += 1;
            s.stats.published = Math.max(0, s.stats.published - 1);
          }
        }
      })
      .addCase(toggleReviewPublish.rejected, (s) => {
        s.toggleLoading = null;
      })

      // --- delete ---
      .addCase(deleteReview.pending, (s, a) => {
        s.deleteLoading = a.meta.arg;
      })
      .addCase(deleteReview.fulfilled, (s, a) => {
        s.deleteLoading = null;
        const removed = s.reviews.find((r) => r.id === a.payload);
        s.reviews = s.reviews.filter((r) => r.id !== a.payload);
        // Decrement total, and the matching published/hidden bucket for the removed review.
        if (s.stats && removed) {
          s.stats.total = Math.max(0, s.stats.total - 1);
          if (removed.isPublished) s.stats.published = Math.max(0, s.stats.published - 1);
          else s.stats.hidden = Math.max(0, s.stats.hidden - 1);
        }
      })
      .addCase(deleteReview.rejected, (s) => {
        s.deleteLoading = null;
      })

      // --- add admin response ---
      .addCase(addAdminResponse.pending, (s, a) => {
        s.responseLoading = a.meta.arg.reviewId;
      })
      .addCase(addAdminResponse.fulfilled, (s, a) => {
        s.responseLoading = null;
        const row = s.reviews.find((r) => r.id === a.payload.reviewId);
        if (row) row.adminResponse = a.payload.adminResponse;
      })
      .addCase(addAdminResponse.rejected, (s) => {
        s.responseLoading = null;
      })

      // --- remove admin response ---
      .addCase(removeAdminResponse.pending, (s, a) => {
        s.responseLoading = a.meta.arg;
      })
      .addCase(removeAdminResponse.fulfilled, (s, a) => {
        s.responseLoading = null;
        const row = s.reviews.find((r) => r.id === a.payload);
        if (row) row.adminResponse = '';
      })
      .addCase(removeAdminResponse.rejected, (s) => {
        s.responseLoading = null;
      });
  },
});

export const { setPublishFilter, setRatingFilter, setReviewSearch } = reviewsSlice.actions;
export default reviewsSlice.reducer;
