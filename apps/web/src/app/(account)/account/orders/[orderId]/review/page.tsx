'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { PackageX, Star } from 'lucide-react';
import { OrderStatus } from '@barakath/shared';
import { Breadcrumb } from '@/components/Breadcrumb';
import { Button } from '@/components/Button';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { EmptyState } from '@/components/EmptyState';
import { SkeletonText } from '@/components/Skeleton';
import { useAppSelector } from '@/stores/store';
import { toastError, toastSuccess } from '@/lib/toast';
import { useOrder } from '@/features/orders/hooks/useOrder';
import { formatDateShort, orderReference, timestampFor } from '@/features/orders/utils/orderFormat';
import { hasExistingReview, submitReview, MAX_REVIEW_PHOTOS } from '@/features/reviews/api/reviews';
import { StarRatingInput } from '@/features/reviews/components/StarRatingInput';
import { PhotoUpload } from '@/features/reviews/components/PhotoUpload';

const MIN_COMMENT_LENGTH = 10;

/**
 * /account/orders/[orderId]/review — Write a review (spec §1.11, §2.24; design's `show.writeReview`).
 * Only reachable from a Delivered order's own item — see the "Write review" trigger on the order-detail
 * page. Query params (`productId`, `variantId`), not a nested dynamic segment, matching the `return`
 * page's own convention for "a form reached from one line of a delivered order".
 *
 * The product header comes straight off `order.items` (no extra `products/{id}` read) — mirrors
 * `apps/app`'s `ReviewableItemModel.fromOrderDoc`, which documents the same choice.
 *
 * NOTE: the design's confirmation copy ("will appear after a quick check", "You've earned 10 wallet
 * points") does not match reality — reviews publish immediately (the create rule forces `isPublished:
 * true`, there is no moderation queue) and no Cloud Function credits wallet points for a review. Neither
 * line is shown here; see `apps/web/src/features/reviews/api/reviews.ts`'s header comment.
 */
export default function WriteReviewPage() {
  const router = useRouter();
  const { orderId } = useParams<{ orderId: string }>();
  const searchParams = useSearchParams();
  const productId = searchParams.get('productId') ?? '';
  const variantId = searchParams.get('variantId') ?? '';

  const uid = useAppSelector((s) => s.auth.uid);
  const user = useAppSelector((s) => s.auth.user);
  const authLoading = useAppSelector((s) => s.auth.authLoading);
  const { order, loading, error, notFound } = useOrder(orderId, uid);

  const [checkingExisting, setCheckingExisting] = useState(true);
  const [alreadyReviewed, setAlreadyReviewed] = useState(false);

  const [rating, setRating] = useState(0);
  const [title, setTitle] = useState('');
  const [comment, setComment] = useState('');
  const [photos, setPhotos] = useState<File[]>([]);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (notFound) {
      toastError(null, 'That order could not be found.');
      router.replace('/account/orders');
    }
  }, [notFound, router]);

  useEffect(() => {
    if (!uid || !productId || !order) return;
    let cancelled = false;
    setCheckingExisting(true);
    hasExistingReview(uid, productId, order.id)
      .then((exists) => {
        if (!cancelled) setAlreadyReviewed(exists);
      })
      .finally(() => {
        if (!cancelled) setCheckingExisting(false);
      });
    return () => {
      cancelled = true;
    };
  }, [uid, productId, order]);

  const isLoading = authLoading || loading || (!order && !notFound && !error);
  const item = order?.items.find((i) => i.productId === productId && i.variantId === variantId) ?? null;
  const isDelivered = order?.status === OrderStatus.DELIVERED;
  const deliveredAt = order ? timestampFor(order, OrderStatus.DELIVERED) : null;

  const hasRating = rating >= 1;
  const isCommentValid = comment.trim().length >= MIN_COMMENT_LENGTH;
  const canSubmit = hasRating && isCommentValid;

  async function handleSubmit() {
    if (!order || !item || !uid || !canSubmit) return;
    setSubmitting(true);
    try {
      // Re-check right before writing — closes the window if the customer reviewed this product on
      // this order from another tab/device since the page loaded (mirrors the Flutter app's submit()).
      const exists = await hasExistingReview(uid, item.productId, order.id);
      if (exists) {
        setShowConfirm(false);
        toastError(null, 'You have already reviewed this product on this order.');
        setAlreadyReviewed(true);
        return;
      }

      await submitReview({
        orderId: order.id,
        userId: uid,
        userName: user?.fullName || order.userName,
        userImage: user?.profileImage || '',
        productId: item.productId,
        productName: item.productName,
        productImage: item.productImage,
        variantId: item.variantId,
        variantName: item.variantName,
        rating,
        title,
        comment,
        photos,
      });
      setShowConfirm(false);
      toastSuccess('Thanks — your review is live.');
      router.push(`/product/${item.productId}`);
    } catch (e) {
      toastError(e, 'Could not submit your review. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (error) {
    return <EmptyState icon={<PackageX size={40} />} title="Could not load this order" subtitle={error} />;
  }

  if (isLoading || !order) {
    return (
      <div className="space-y-4" aria-busy="true">
        <SkeletonText width="w-1/3" />
        <div className="h-20 animate-pulse rounded-xl bg-subtle" />
        <div className="h-40 animate-pulse rounded-xl bg-subtle" />
      </div>
    );
  }

  if (!item) {
    return <EmptyState icon={<PackageX size={40} />} title="That item is not part of this order" />;
  }

  if (!isDelivered) {
    return <EmptyState icon={<Star size={40} />} title="This item has not been delivered yet" />;
  }

  const breadcrumb = (
    <Breadcrumb
      items={[
        { label: 'Home', href: '/' },
        { label: 'My Orders', href: '/account/orders' },
        { label: orderReference(order.id), href: `/account/orders/${order.id}` },
        { label: 'Write a review' },
      ]}
    />
  );

  if (checkingExisting) {
    return (
      <div>
        {breadcrumb}
        <div className="space-y-4" aria-busy="true">
          <div className="h-20 animate-pulse rounded-xl bg-subtle" />
          <div className="h-40 animate-pulse rounded-xl bg-subtle" />
        </div>
      </div>
    );
  }

  if (alreadyReviewed) {
    return (
      <div>
        {breadcrumb}
        <EmptyState
          icon={<Star size={40} />}
          title="Already reviewed"
          subtitle="You have reviewed this product on this order. Reviews cannot be edited after submitting."
        />
      </div>
    );
  }

  return (
    <div>
      {breadcrumb}

      <div className="space-y-4">
        <div className="flex gap-3 rounded-xl border border-border bg-surface p-5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={item.productImage} alt="" className="size-16 shrink-0 rounded-md border border-border object-cover" />
          <div className="min-w-0">
            <p className="line-clamp-2 text-sm font-semibold text-foreground">{item.productName}</p>
            <p className="mt-1 text-xs text-muted">
              {item.variantName}
              {item.variantName ? ' · ' : ''}Delivered on {formatDateShort(deliveredAt)}
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-surface p-5">
          <h2 className="font-display text-base font-semibold text-foreground">How would you rate it?</h2>
          <div className="mt-3">
            <StarRatingInput value={rating} onChange={setRating} />
          </div>
        </div>

        <div className="rounded-xl border border-border bg-surface p-5">
          <h2 className="font-display text-base font-semibold text-foreground">Review title</h2>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value.slice(0, 80))}
            maxLength={80}
            placeholder="Sum it up in a few words"
            className="mt-2 w-full rounded-lg border border-border-strong bg-app p-3 text-sm text-foreground outline-none focus:border-primary"
          />
        </div>

        <div className="rounded-xl border border-border bg-surface p-5">
          <h2 className="font-display text-base font-semibold text-foreground">Your review *</h2>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value.slice(0, 1000))}
            rows={4}
            maxLength={1000}
            placeholder="What did you like or dislike? How's the quality and value?"
            className="mt-2 w-full rounded-lg border border-border-strong bg-app p-3 text-sm text-foreground outline-none focus:border-primary"
          />
          {!isCommentValid && (
            <p className="mt-1 text-xs text-faint">
              {Math.max(0, MIN_COMMENT_LENGTH - comment.trim().length)} more character(s) needed
            </p>
          )}
        </div>

        <div className="rounded-xl border border-border bg-surface p-5">
          <h2 className="font-display text-base font-semibold text-foreground">
            Add photos <span className="font-medium text-faint">(optional)</span>
          </h2>
          <div className="mt-3">
            <PhotoUpload photos={photos} onChange={setPhotos} maxPhotos={MAX_REVIEW_PHOTOS} />
          </div>
        </div>

        <p className="text-center text-xs text-faint">
          Reviews are published immediately and cannot be edited after submitting.
        </p>

        <Button variant="primary" fullWidth disabled={!canSubmit} onClick={() => setShowConfirm(true)}>
          Submit review
        </Button>
      </div>

      <ConfirmDialog
        isOpen={showConfirm}
        title="Submit this review?"
        description="Your review is published straight away and cannot be edited or deleted afterwards."
        confirmLabel="Submit"
        loading={submitting}
        onConfirm={handleSubmit}
        onClose={() => {
          if (!submitting) setShowConfirm(false);
        }}
      />
    </div>
  );
}
