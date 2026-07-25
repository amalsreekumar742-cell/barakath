import { type FC } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { OrderStatus, PaymentStatus } from '@barakath/shared/config/enums';
import { useAppDispatch, useAppSelector } from '@/stores/store';
import Modal from '@/components/Modal';
import Icon from '@/components/icons/Icon';
import { updateOrderStatus } from '../api/updateOrderStatus';

const schema = z.object({
  cancelReason: z.string().trim().min(10, 'Please give a reason (at least 10 characters)'),
});
type CancelForm = z.infer<typeof schema>;

interface Props {
  isOpen: boolean;
  orderId: string;
  paymentStatus: string;
  onClose: () => void;
  onCancelled: () => void;
}

/**
 * CancelOrderModal — cancel a still-Pending order with a required reason (spec §1.7). Warns that the
 * action is irreversible and that stock will be restored; if the order was Paid, also warns that a
 * refund will be initiated. Cancellation itself is enforced server-side in `updateOrderStatus`.
 */
const CancelOrderModal: FC<Props> = ({ isOpen, orderId, paymentStatus, onClose, onCancelled }) => {
  const dispatch = useAppDispatch();
  const loading = useAppSelector((s) => s.orders.updateStatusLoading);
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

  const onSubmit = async (data: CancelForm) => {
    const res = await dispatch(
      updateOrderStatus({ orderId, newStatus: OrderStatus.CANCELLED, cancelReason: data.cancelReason }),
    );
    if (updateOrderStatus.fulfilled.match(res)) {
      toast.success('Order status updated to Cancelled');
      onCancelled();
      close();
    } else {
      toast.error((res.payload as string) ?? 'Could not cancel order');
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={close} maxWidth="max-w-md">
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="rounded-xl border border-border bg-surface p-6 shadow-lg"
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[18px] font-bold tracking-tight text-foreground">Cancel Order</h2>
          <button type="button" onClick={close} className="text-faint hover:text-foreground" aria-label="Close">
            <Icon name="CloseLine" size={20} />
          </button>
        </div>

        <p className="text-[13px] leading-normal text-muted">
          This action cannot be undone. The order will be cancelled and stock will be restored.
        </p>
        {paymentStatus === PaymentStatus.PAID && (
          <div className="mt-3 flex gap-2 rounded-lg border border-warning-subtle bg-warning-subtle/50 px-3 py-2.5">
            <Icon name="AlertLine" size={16} className="mt-0.5 shrink-0 text-warning" />
            <p className="text-[13px] text-foreground">
              A refund will be initiated to the original payment method.
            </p>
          </div>
        )}

        <div className="mt-4">
          <label className="mb-1.5 block text-[13px] font-semibold text-foreground">Reason for cancellation</label>
          <textarea
            {...register('cancelReason')}
            rows={3}
            placeholder="Explain why this order is being cancelled…"
            className="w-full resize-none rounded-md border border-border-strong bg-surface px-3 py-2 text-[14px] outline-none placeholder:text-faint focus:border-primary"
          />
          {errors.cancelReason && (
            <p className="mt-1 text-[12px] text-error">{errors.cancelReason.message}</p>
          )}
        </div>

        <div className="mt-6 flex justify-end gap-2.5">
          <button
            type="button"
            onClick={close}
            disabled={loading}
            className="rounded-md border border-border-strong px-4 py-2 text-[14px] font-semibold text-foreground hover:bg-subtle disabled:opacity-50"
          >
            Go Back
          </button>
          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-md bg-error px-5 py-2 text-[14px] font-semibold text-white hover:brightness-95 disabled:opacity-50"
          >
            {loading && <Icon name="Loader4Line" size={16} className="animate-spin" />}
            Cancel Order
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default CancelOrderModal;
