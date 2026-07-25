import { type FC, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import type { ReviewProps } from '@barakath/shared/types';
import { useAppDispatch, useAppSelector } from '@/stores/store';
import Modal from '@/components/Modal';
import Icon from '@/components/icons/Icon';
import { addAdminResponse } from '../api/addAdminResponse';
import { Stars } from './ui';

const schema = z.object({
  adminResponse: z
    .string()
    .trim()
    .min(5, 'Response must be at least 5 characters')
    .max(500, 'Response must be 500 characters or fewer'),
});
type FormValues = z.infer<typeof schema>;

/**
 * AdminResponseModal — the admin writes a public reply to a review (spec §1.11). Shows the review context
 * (customer, rating, first lines of the comment) so the admin replies with the review in view. Built on
 * the shared Modal; the submit button follows the button-loading rule while the write is in flight.
 *
 * WHY prefilled with the existing response: editing an existing reply reuses this modal, so we seed the
 * textarea from `review.adminResponse` when it (re)opens.
 */
const AdminResponseModal: FC<{ isOpen: boolean; review: ReviewProps; onClose: () => void }> = ({
  isOpen,
  review,
  onClose,
}) => {
  const dispatch = useAppDispatch();
  const responseLoading = useAppSelector((s) => s.reviews.responseLoading);
  const submitting = responseLoading === review.id;

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { adminResponse: '' },
  });

  // Seed the textarea from the current response each time the modal (re)opens so edits start from it.
  useEffect(() => {
    if (isOpen) reset({ adminResponse: review.adminResponse ?? '' });
  }, [isOpen, review.adminResponse, reset]);

  const count = watch('adminResponse')?.length ?? 0;

  const onSubmit = async (values: FormValues) => {
    const res = await dispatch(
      addAdminResponse({ reviewId: review.id, adminResponse: values.adminResponse.trim() }),
    );
    if (addAdminResponse.fulfilled.match(res)) {
      toast.success('Response added');
      onClose();
    } else {
      toast.error((res.payload as string) ?? 'Could not add response');
    }
  };

  // Two-line preview of the review comment for context above the textarea.
  const commentPreview = review.comment.split('\n').slice(0, 2).join(' ');

  return (
    <Modal isOpen={isOpen} onClose={submitting ? () => {} : onClose} maxWidth="max-w-[480px]">
      <div className="rounded-xl border border-border bg-surface p-6 shadow-lg">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[18px] font-bold tracking-tight text-foreground">Add Admin Response</h2>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="rounded-md p-1 text-muted hover:bg-subtle hover:text-foreground disabled:opacity-50"
            aria-label="Close"
          >
            <Icon name="CloseLine" size={18} />
          </button>
        </div>

        {/* Review context */}
        <div className="rounded-md border border-border bg-subtle/50 p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[13px] font-semibold text-foreground">{review.userName}</span>
            <Stars rating={review.rating} size={14} />
          </div>
          {commentPreview && (
            <p className="mt-1.5 line-clamp-2 text-[13px] leading-normal text-muted">{commentPreview}</p>
          )}
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="mt-4 space-y-4">
          <div>
            <label className="mb-1.5 block text-[13px] font-semibold text-foreground">
              Response <span className="text-error">*</span>
            </label>
            <textarea
              rows={4}
              maxLength={500}
              {...register('adminResponse')}
              placeholder="Write a public reply to this review…"
              className="w-full resize-none rounded-md border border-border-strong bg-surface px-3 py-2.5 text-[14px] outline-none placeholder:text-faint focus:border-primary"
            />
            <div className="mt-1 flex items-center justify-between">
              {errors.adminResponse ? (
                <p className="text-[12px] text-error">{errors.adminResponse.message}</p>
              ) : (
                <span />
              )}
              <span className="text-[12px] text-faint tabular-nums">{count}/500</span>
            </div>
          </div>

          <div className="flex justify-end gap-2.5 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="rounded-md border border-border-strong px-4 py-2 text-[14px] font-semibold text-foreground hover:bg-subtle disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-[14px] font-semibold text-white hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting && <Icon name="Loader4Line" size={16} className="animate-spin" />}
              Submit Response
            </button>
          </div>
        </form>
      </div>
    </Modal>
  );
};

export default AdminResponseModal;
