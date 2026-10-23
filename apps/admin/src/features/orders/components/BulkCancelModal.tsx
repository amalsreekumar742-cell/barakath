import type { FC } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Modal from '@/components/Modal';
import Icon from '@/components/icons/Icon';

const schema = z.object({
  cancelReason: z.string().trim().min(10, 'Please give a reason (at least 10 characters)'),
});
type CancelForm = z.infer<typeof schema>;

interface Props {
  isOpen: boolean;
  count: number;
  /** Selected orders already Paid — each is refunded by the server, same as a single cancel. */
  paidCount: number;
  onClose: () => void;
  onConfirm: (cancelReason: string) => void;
}

/**
 * BulkCancelModal — cancel several Pending orders with ONE shared reason (spec §1.7). Mirrors
 * CancelOrderModal's copy and validation; the actual cancel (refund, wallet, coupon and stock reversal)
 * still runs order by order through `updateOrderStatus` → the `cancelOrder` callable, so the rules are
 * identical to a single cancel.
 */
const BulkCancelModal: FC<Props> = ({ isOpen, count, paidCount, onClose, onConfirm }) => {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CancelForm>({ resolver: zodResolver(schema), defaultValues: { cancelReason: '' } });

  const close = () => {
    reset();
    onClose();
  };

  const submit = (data: CancelForm) => {
    onConfirm(data.cancelReason.trim());
    reset();
  };

  return (
    <Modal isOpen={isOpen} onClose={close} maxWidth="max-w-md">
      <form onSubmit={handleSubmit(submit)} className="rounded-xl border border-border bg-surface p-6 shadow-lg">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[18px] font-bold tracking-tight text-foreground">
            Cancel {count} order{count === 1 ? '' : 's'}
          </h2>
          <button type="button" onClick={close} className="text-faint hover:text-foreground" aria-label="Close">
            <Icon name="CloseLine" size={20} />
          </button>
        </div>

        <p className="text-[13px] leading-normal text-muted">
          This action cannot be undone. Every selected order will be cancelled and its stock restored.
        </p>
        {paidCount > 0 && (
          <div className="mt-3 flex gap-2 rounded-lg border border-warning-subtle bg-warning-subtle/50 px-3 py-2.5">
            <Icon name="AlertLine" size={16} className="mt-0.5 shrink-0 text-warning" />
            <p className="text-[13px] text-foreground">
              {paidCount} of these {paidCount === 1 ? 'is' : 'are'} paid — a refund will be initiated to the
              original payment method.
            </p>
          </div>
        )}

        <div className="mt-4">
          <label className="mb-1.5 block text-[13px] font-semibold text-foreground">Reason for cancellation</label>
          <textarea
            {...register('cancelReason')}
            rows={3}
            placeholder="Applies to every selected order…"
            className="w-full resize-none rounded-md border border-border-strong bg-surface px-3 py-2 text-[14px] outline-none placeholder:text-faint focus:border-primary"
          />
          {errors.cancelReason && <p className="mt-1 text-[12px] text-error">{errors.cancelReason.message}</p>}
        </div>

        <div className="mt-6 flex justify-end gap-2.5">
          <button
            type="button"
            onClick={close}
            className="rounded-md border border-border-strong px-4 py-2 text-[14px] font-semibold text-foreground hover:bg-subtle"
          >
            Go Back
          </button>
          <button
            type="submit"
            className="rounded-md bg-error px-5 py-2 text-[14px] font-semibold text-white hover:brightness-95"
          >
            Cancel orders
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default BulkCancelModal;
