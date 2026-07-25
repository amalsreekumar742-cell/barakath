import { format } from 'date-fns';
import type { ReviewProps } from '@barakath/shared';
import { RatingStars } from '@/components/catalog/RatingStars';

/**
 * One published review row. Deliberately a plain (non-`"use client"`) component so it can be imported
 * both by the server-rendered first page (`ReviewsSection`) and by the client `ViewMoreReviews`
 * pagination without forking the markup — it does no data fetching and holds no hooks, so it is safe
 * either side of the RSC boundary.
 *
 * WHY `createdAt` is formatted with `date-fns` rather than `.toLocaleDateString`: consistent with the
 * rest of the storefront (privacy-policy uses the same `format`), and stable across server/client
 * locale differences that `toLocaleDateString` is prone to.
 */
export function ReviewCard({ review }: { review: ReviewProps }) {
  return (
    <li className="border-b border-border py-5 last:border-b-0">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="font-display text-sm font-extrabold text-foreground">
            {review.userName || 'Barakath customer'}
          </span>
          {review.isVerifiedPurchase && (
            <span className="rounded-full bg-primary-subtle px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-primary">
              Verified purchase
            </span>
          )}
        </div>
        {review.createdAt && (
          <span className="shrink-0 text-xs text-faint">
            {format(review.createdAt.toDate(), 'd MMM yyyy')}
          </span>
        )}
      </div>

      <RatingStars rating={review.rating} size={13} className="mt-1.5" />

      {review.title && (
        <p className="mt-2 text-sm font-bold text-foreground">{review.title}</p>
      )}
      {review.comment && (
        <p className="mt-1 text-sm leading-6 text-muted">{review.comment}</p>
      )}

      {/* A handful of user-submitted photos per review isn't worth next/image's remote-pattern config for an already-small thumbnail row, so a plain <img> is used below (lint-disabled) rather than next/image. */}
      {review.photos.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {review.photos.map((src) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={src}
              src={src}
              alt="Customer photo"
              className="size-16 rounded-md border border-border object-cover"
            />
          ))}
        </div>
      )}

      {review.adminResponse && (
        <div className="mt-3 rounded-lg bg-subtle p-3">
          <p className="text-xs font-extrabold uppercase tracking-wide text-muted">
            Response from Barakath
          </p>
          <p className="mt-1 text-sm leading-6 text-muted">{review.adminResponse}</p>
        </div>
      )}
    </li>
  );
}
