import { type FC } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { OrderStatus } from '@barakath/shared/config/enums';
import { useAppDispatch, useAppSelector } from '@/stores/store';
import Modal from '@/components/Modal';
import Icon from '@/components/icons/Icon';
import { updateOrderStatus } from '../api/updateOrderStatus';

const schema = z.object({
  trackingId: z.string().trim().min(1, 'Tracking ID is required'),
  courierName: z.string().trim().min(1, 'Courier name is required'),
});
type ShipmentForm = z.infer<typeof schema>;

interface Props {
  isOpen: boolean;
  orderId: string;
  onClose: () => void;
  onShipped: () => void;
}

/**
 * ShipmentModal — collects the tracking ID + courier name and ships the order (spec §1.7). Shipping is
 * the one transition that carries extra data, so it's gated behind this form (react-hook-form + zod).
 */
const ShipmentModal: FC<Props> = ({ isOpen, orderId, onClose, onShipped }) => {
  const dispatch = useAppDispatch();
  const loading = useAppSelector((s) => s.orders.updateStatusLoading);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ShipmentForm>({ resolver: zodResolver(schema), defaultValues: { trackingId: '', courierName: '' } });

  const close = () => {
    reset();
    onClose();
  };

  const onSubmit = async (data: ShipmentForm) => {
    const res = await dispatch(
      updateOrderStatus({
        orderId,
        newStatus: OrderStatus.SHIPPED,
        trackingId: data.trackingId,
        courierName: data.courierName,
      }),
    );
    if (updateOrderStatus.fulfilled.match(res)) {
      toast.success('Order status updated to Shipped');
      onShipped();
      close();
    } else {
      toast.error((res.payload as string) ?? 'Could not ship order');
    }
  };

  const inputCls =
    'w-full rounded-md border border-border-strong bg-surface px-3 py-2 text-[14px] outline-none placeholder:text-faint focus:border-primary';

  return (
    <Modal isOpen={isOpen} onClose={close} maxWidth="max-w-md">
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="rounded-xl border border-border bg-surface p-6 shadow-lg"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-[18px] font-bold tracking-tight text-foreground">Add Shipment Details</h2>
          <button type="button" onClick={close} className="text-faint hover:text-foreground" aria-label="Close">
            <Icon name="CloseLine" size={20} />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-[13px] font-semibold text-foreground">Tracking ID</label>
            <input {...register('trackingId')} placeholder="e.g. SF1234567890" className={inputCls} />
            {errors.trackingId && (
              <p className="mt-1 text-[12px] text-error">{errors.trackingId.message}</p>
            )}
          </div>
          <div>
            <label className="mb-1.5 block text-[13px] font-semibold text-foreground">Courier name</label>
            <input
              {...register('courierName')}
              placeholder="e.g. Shadowfax, Delhivery, Blue Dart"
              className={inputCls}
            />
            {errors.courierName && (
              <p className="mt-1 text-[12px] text-error">{errors.courierName.message}</p>
            )}
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2.5">
          <button
            type="button"
            onClick={close}
            disabled={loading}
            className="rounded-md border border-border-strong px-4 py-2 text-[14px] font-semibold text-foreground hover:bg-subtle disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2 text-[14px] font-semibold text-white hover:bg-primary-dark disabled:opacity-50"
          >
            {loading && <Icon name="Loader4Line" size={16} className="animate-spin" />}
            Ship Order
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default ShipmentModal;
