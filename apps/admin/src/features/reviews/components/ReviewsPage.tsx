import { type FC, useEffect, useState } from 'react';
import Skeleton from 'react-loading-skeleton';
import { ReviewFilter } from '@barakath/shared/config/enums';
import { useAppDispatch, useAppSelector } from '@/stores/store';
import Icon from '@/components/icons/Icon';
import { fetchReviews } from '../api/fetchReviews';
import { fetchReviewStats } from '../api/fetchReviewStats';
import { setPublishFilter, setReviewSearch } from '../stores/reviewsSlice';
import type { ReviewPublishStatus } from '../types';
import ReviewRow from './ReviewRow';

// Filter tabs mirror the ReviewFilter enum labels (spec §1.11: All / Published / Hidden — no Reported).
const PUBLISH_TABS: ReviewPublishStatus[] = [ReviewFilter.ALL, ReviewFilter.PUBLISHED, ReviewFilter.HIDDEN];

const COLUMNS = ['Customer', 'Product', 'Rating', 'Review', 'Date', 'Status', ''];

/**
 * ReviewsPage — the Reviews module (spec §1.11): a summary subtitle ("N reviews · X avg rating"), the
 * All / Published / Hidden filter tabs, a search box, and the reviews TABLE (Customer · Product · Rating ·
 * Review · Date · Status + publish/hide, reply and delete actions) with cursor pagination.
 *
 * WHY a table (not cards): the design/spec §1.11 lists reviews in a table. Stats are loaded only for the
 * headline subtitle; the list refetches page one whenever the tab/search changes (search debounced 300ms).
 */
const ReviewsPage: FC = () => {
  const dispatch = useAppDispatch();
  const { reviews, hasMore, loading, loadingMore, error, lastVisible, filters, stats } = useAppSelector(
    (s) => s.reviews,
  );

  const [searchInput, setSearchInput] = useState('');

  useEffect(() => {
    void dispatch(fetchReviewStats());
  }, [dispatch]);

  useEffect(() => {
    void dispatch(fetchReviews({ filters, cursor: null }));
  }, [dispatch, filters]);

  useEffect(() => {
    const t = setTimeout(() => {
      if (filters.searchTerm !== searchInput) dispatch(setReviewSearch(searchInput));
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput, dispatch]);

  const emptyHeading =
    filters.publishStatus === ReviewFilter.PUBLISHED
      ? 'No Published reviews'
      : filters.publishStatus === ReviewFilter.HIDDEN
        ? 'No Hidden reviews'
        : 'No reviews found';

  return (
    <div className="p-6">
      {/* Header + summary subtitle */}
      <div className="mb-4">
        <h1 className="text-[22px] font-extrabold tracking-tight text-foreground">Reviews</h1>
        <p className="mt-0.5 text-[13px] text-muted">
          {stats ? (
            <>
              {stats.total.toLocaleString('en-IN')} reviews ·{' '}
              <span className="inline-flex items-center gap-0.5 font-semibold text-foreground">
                <Icon name="StarLine" size={13} className="text-gold-strong" />
                {stats.averageRating.toFixed(1)}
              </span>{' '}
              avg rating
            </>
          ) : (
            'Loading…'
          )}
        </p>
      </div>

      {/* Filter tabs */}
      <div className="mb-4 flex gap-1 overflow-x-auto border-b border-border">
        {PUBLISH_TABS.map((tab) => {
          const active = filters.publishStatus === tab;
          return (
            <button
              key={tab}
              type="button"
              onClick={() => dispatch(setPublishFilter(tab))}
              className={`shrink-0 whitespace-nowrap border-b-2 px-3.5 py-2.5 text-[13px] font-semibold transition-colors ${
                active ? 'border-primary text-primary' : 'border-transparent text-muted hover:text-foreground'
              }`}
            >
              {tab}
            </button>
          );
        })}
      </div>

      {/* Search */}
      <div className="mb-4">
        <div className="relative max-w-md">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint">
            <Icon name="SearchLine" size={16} />
          </span>
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search reviews…"
            className="w-full rounded-md border border-border-strong bg-surface py-2.5 pl-9 pr-3 text-[14px] outline-none placeholder:text-faint focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
        </div>
      </div>

      {/* Body */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} height={60} borderRadius={12} />
          ))}
        </div>
      ) : error ? (
        <div className="rounded-xl border border-border bg-surface p-10 text-center">
          <p className="text-[14px] text-muted">{error}</p>
          <button
            type="button"
            onClick={() => dispatch(fetchReviews({ filters, cursor: null }))}
            className="mt-3 rounded-md bg-primary px-4 py-2 text-[14px] font-semibold text-white hover:bg-primary-dark"
          >
            Retry
          </button>
        </div>
      ) : reviews.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface p-12 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-primary-subtle text-primary">
            <Icon name="StarLine" size={28} />
          </div>
          <h2 className="text-[16px] font-bold text-foreground">{emptyHeading}</h2>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-surface shadow-sm">
          <table className="w-full min-w-[860px]">
            <thead className="border-b border-border bg-subtle/50">
              <tr>
                {COLUMNS.map((h, i) => (
                  <th
                    key={h || `col-${i}`}
                    className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-faint"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {reviews.map((review) => (
                <ReviewRow key={review.id} review={review} />
              ))}
            </tbody>
          </table>

          {loadingMore && (
            <div className="p-3">
              <Skeleton height={44} borderRadius={8} />
            </div>
          )}
          {hasMore && !loadingMore && (
            <div className="flex justify-center border-t border-border p-3">
              <button
                type="button"
                onClick={() => dispatch(fetchReviews({ filters, cursor: lastVisible }))}
                className="rounded-md border border-border-strong px-4 py-2 text-[14px] font-semibold text-foreground hover:bg-subtle"
              >
                View More
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ReviewsPage;
