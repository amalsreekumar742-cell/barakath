import type { ProductProps, ReviewProps } from '@barakath/shared';
import { RatingStars } from '@/components/catalog/RatingStars';
import { EmptyState } from '@/components/EmptyState';
import { ReviewCard } from './ReviewCard';
import { ViewMoreReviews } from './ViewMoreReviews';

export interface ReviewsSectionProps {
  product: ProductProps;
  /** The server-rendered first page — already Published-only, newest first (see the page's fetch). */
  firstPage: ReviewProps[];
  hasMore: boolean;
}

/**
 * Ratings & reviews (spec §3.7). The first page is server-rendered for SEO (paired with
 * `productSchema`'s `review[]`); `ViewMoreReviews` is the client island that pages further.
 *
 * WHY this degrades to an EmptyState rather than hiding the section: a failed/absent review fetch must
 * not blank the page (the page's caller wraps the fetch in its own try/catch — see page.tsx), and a
 * genuinely review-less product should still show the section so a customer knows reviews are a real
 * feature that simply has none yet, not something broken.
 */
export function ReviewsSection({ product, firstPage, hasMore }: ReviewsSectionProps) {
  const last = firstPage[firstPage.length - 1];

  return (
    <section id="reviews" className="scroll-mt-24">
      <div className="flex items-center gap-3">
        <h2 className="font-display text-xl font-semibold tracking-tight text-foreground">
          Ratings &amp; reviews
        </h2>
        {product.totalReviews > 0 && (
          <RatingStars rating={product.averageRating} count={product.totalReviews} size={16} />
        )}
      </div>

      {firstPage.length === 0 ? (
        <EmptyState title="No reviews yet." subtitle="Be the first to review this product." />
      ) : (
        <>
          <ul className="mt-4">
            {firstPage.map((review) => (
              <ReviewCard key={review.id} review={review} />
            ))}
          </ul>
          {hasMore && last && (
            <ViewMoreReviews
              productId={product.id}
              initialCursorMillis={last.createdAt.toMillis()}
              initialHasMore={hasMore}
            />
          )}
        </>
      )}
    </section>
  );
}
