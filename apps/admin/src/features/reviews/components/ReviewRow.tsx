import { type FC, Fragment, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import type { ReviewProps } from '@barakath/shared/types';
import { useAppDispatch, useAppSelector } from '@/stores/store';
import Icon from '@/components/icons/Icon';
import ConfirmDialog from '@/components/ConfirmDialog';
import { formatShortDate } from '@/utils/format';
import { toggleReviewPublish } from '../api/toggleReviewPublish';
import { deleteReview } from '../api/deleteReview';
import { Avatar, Stars, VerifiedBadge, ReviewStatusBadge } from './ui';
import AdminResponseModal from './AdminResponseModal';
import PhotoViewerModal from './PhotoViewerModal';

/**
 * ReviewRow — one review as a table row (spec §1.11 listing: Customer · Product · Rating · Review text ·
 * Date · Status, with Eye publish/hide + × delete actions). A Reply action (EditLine) opens the admin
 * response editor and, when a response exists, the review cell shows a small "replied" note — this keeps
 * the admin-response capability without breaking the table layout.
 *
 * WHY per-row local state: the two confirm dialogs, the photo viewer and the response modal are row-scoped
 * UI toggles, so they stay in component state (not Redux). WHY hide confirms but publish is immediate:
 * hiding removes a review from the storefront (a customer-visible change → §1.22 confirmation); publishing
 * is safe and instant.
 */
const ReviewRow: FC<{ review: ReviewProps }> = ({ review }) => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { toggleLoading, deleteLoading } = useAppSelector((s) => s.reviews);

  const [viewer, setViewer] = useState(false);
  const [responseOpen, setResponseOpen] = useState(false);
  const [confirmHide, setConfirmHide] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const toggling = toggleLoading === review.id;
  const deleting = deleteLoading === review.id;

  const onTogglePublish = () => {
    if (review.isPublished) setConfirmHide(true);
    else void runToggle(true);
  };

  const runToggle = async (isPublished: boolean) => {
    const res = await dispatch(toggleReviewPublish({ reviewId: review.id, isPublished }));
    if (toggleReviewPublish.fulfilled.match(res)) {
      toast.success(isPublished ? 'Review published' : 'Review hidden');
      setConfirmHide(false);
    } else {
      toast.error((res.payload as string) ?? 'Could not update review');
    }
  };

  const onDelete = async () => {
    const res = await dispatch(deleteReview(review.id));
    if (deleteReview.fulfilled.match(res)) toast.success('Review deleted');
    else toast.error((res.payload as string) ?? 'Could not delete review');
  };

  return (
    <Fragment>
    <tr className="border-b border-border last:border-0 align-top hover:bg-subtle/40">
      {/* Customer */}
      <td className="px-5 py-3">
        <div className="flex items-center gap-2.5">
          <Avatar src={review.userImage} name={review.userName} size={36} />
          <div className="min-w-0">
            <p className="truncate text-[13px] font-semibold text-foreground">{review.userName}</p>
            {review.isVerifiedPurchase && (
              <span className="mt-0.5 inline-block">
                <VerifiedBadge />
              </span>
            )}
          </div>
        </div>
      </td>

      {/* Product */}
      <td className="px-5 py-3">
        <button
          type="button"
          onClick={() => navigate(`/products/${review.productId}/edit`)}
          className="flex items-center gap-2 text-left hover:opacity-80"
        >
          {review.productImage ? (
            <img
              src={review.productImage}
              alt=""
              className="h-8 w-8 shrink-0 rounded-md border border-border object-cover"
            />
          ) : (
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-subtle text-faint">
              <Icon name="ImageLine" size={14} />
            </span>
          )}
          <span className="max-w-[160px] truncate text-[13px] font-medium text-foreground" title={review.productName}>
            {review.productName}
            {review.variantName && <span className="text-muted"> · {review.variantName}</span>}
          </span>
        </button>
      </td>

      {/* Rating */}
      <td className="px-5 py-3">
        <Stars rating={review.rating} size={14} />
      </td>

      {/* Review text */}
      <td className="px-5 py-3">
        <div className="max-w-[320px]">
          {review.title && <p className="text-[13px] font-semibold text-foreground">{review.title}</p>}
          {review.comment && (
            <p className="line-clamp-2 text-[13px] text-muted" title={review.comment}>
              {review.comment}
            </p>
          )}
          <div className="mt-1 flex items-center gap-3">
            {review.photos.length > 0 && (
              <button
                type="button"
                onClick={() => setViewer(true)}
                className="inline-flex items-center gap-1 text-[12px] font-semibold text-primary hover:underline"
              >
                <Icon name="ImageLine" size={13} /> {review.photos.length}
              </button>
            )}
            {review.adminResponse && (
              <span className="inline-flex items-center gap-1 text-[12px] text-success">
                <Icon name="CheckLine" size={12} /> Replied
              </span>
            )}
            <button
              type="button"
              onClick={() => navigate(`/orders/${review.orderId}`)}
              className="text-[12px] font-medium text-faint hover:text-primary hover:underline"
            >
              #{review.orderId.slice(0, 6)}
            </button>
          </div>
        </div>
      </td>

      {/* Date */}
      <td className="px-5 py-3 text-[13px] text-muted">{formatShortDate(review.createdAt)}</td>

      {/* Status */}
      <td className="px-5 py-3">
        <ReviewStatusBadge isPublished={review.isPublished} />
      </td>

      {/* Actions */}
      <td className="px-5 py-3">
        <div className="flex items-center justify-end gap-0.5">
          <button
            type="button"
            onClick={onTogglePublish}
            disabled={toggling}
            title={review.isPublished ? 'Hide review' : 'Publish review'}
            aria-label={review.isPublished ? 'Hide review' : 'Publish review'}
            className="rounded-md p-1.5 text-muted hover:bg-subtle hover:text-foreground disabled:opacity-50"
          >
            {toggling ? (
              <Icon name="Loader4Line" size={16} className="animate-spin" />
            ) : (
              <Icon name="EyeLine" size={16} />
            )}
          </button>
          <button
            type="button"
            onClick={() => setResponseOpen(true)}
            title={review.adminResponse ? 'Edit response' : 'Reply to review'}
            aria-label="Reply to review"
            className="rounded-md p-1.5 text-muted hover:bg-subtle hover:text-foreground"
          >
            <Icon name="EditLine" size={16} />
          </button>
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            disabled={deleting}
            title="Delete review"
            aria-label="Delete review"
            className="rounded-md p-1.5 text-muted hover:bg-error-subtle hover:text-error disabled:opacity-50"
          >
            {deleting ? (
              <Icon name="Loader4Line" size={16} className="animate-spin" />
            ) : (
              <Icon name="CloseLine" size={16} />
            )}
          </button>
        </div>
      </td>

    </tr>

    {/* Overlays — portal-based (render to document.body, null when closed), so they sit outside the
        row without inserting non-<td> markup into it. */}
    <PhotoViewerModal isOpen={viewer} photos={review.photos} onClose={() => setViewer(false)} />
    <AdminResponseModal isOpen={responseOpen} review={review} onClose={() => setResponseOpen(false)} />
    <ConfirmDialog
      isOpen={confirmHide}
      title="Hide this review?"
      message="This review will no longer be visible to customers."
      confirmLabel="Hide review"
      confirmVariant="danger"
      loading={toggling}
      onConfirm={() => void runToggle(false)}
      onCancel={() => setConfirmHide(false)}
    />
    <ConfirmDialog
      isOpen={confirmDelete}
      title="Delete review"
      message="Permanently delete this review? This cannot be undone."
      confirmLabel="Delete"
      confirmVariant="danger"
      loading={deleting}
      onConfirm={onDelete}
      onCancel={() => setConfirmDelete(false)}
    />
    </Fragment>
  );
};

export default ReviewRow;
