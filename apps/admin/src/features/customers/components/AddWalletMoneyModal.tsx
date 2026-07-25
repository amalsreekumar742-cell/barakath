import { type FC, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import type { UserProps } from '@barakath/shared/types';
import { useAppDispatch, useAppSelector } from '@/stores/store';
import Modal from '@/components/Modal';
import Icon from '@/components/icons/Icon';
import { formatINR } from '@/utils/format';
import { addWalletMoney } from '../api/addWalletMoney';

const schema = z.object({
  amount: z.coerce.number({ invalid_type_error: 'Enter an amount' }).min(1, 'Minimum ₹1'),
  description: z.string().trim().min(1, 'Reason is required'),
});
type FormValues = z.infer<typeof schema>;

const QUICK_PILLS = [100, 500, 1000, 2000];

/**
 * AddWalletMoneyModal — admin credits a customer's wallet (spec §1.8 "Add money to wallet"). Shows the
 * customer name + current balance, an amount field with quick pills, and a required reason. Built on the
 * shared Modal; the submit button follows the button-loading rule while the credit is in flight.
 */
const AddWalletMoneyModal: FC<{ isOpen: boolean; customer: UserProps; onClose: () => void }> = ({
  isOpen,
  customer,
  onClose,
}) => {
  const dispatch = useAppDispatch();
  const { addWalletLoading } = useAppSelector((s) => s.customers);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { amount: 0, description: '' },
  });

  // Reset the form whenever the modal (re)opens so stale input never lingers.
  useEffect(() => {
    if (isOpen) reset({ amount: 0, description: '' });
  }, [isOpen, reset]);

  const amount = Number(watch('amount')) || 0;

  const onSubmit = async (values: FormValues) => {
    const res = await dispatch(
      addWalletMoney({ userId: customer.id, amount: values.amount, description: values.description.trim() }),
    );
    if (addWalletMoney.fulfilled.match(res)) {
      toast.success(`${formatINR(values.amount)} added to wallet`);
      onClose();
    } else {
      toast.error((res.payload as string) ?? 'Could not add money');
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={addWalletLoading ? () => {} : onClose} maxWidth="max-w-[440px]">
      <div className="rounded-xl border border-border bg-surface p-6 shadow-lg">
        <div className="mb-1 flex items-center justify-between">
          <h2 className="text-[18px] font-bold tracking-tight text-foreground">Add money to wallet</h2>
          <button
            type="button"
            onClick={onClose}
            disabled={addWalletLoading}
            className="rounded-md p-1 text-muted hover:bg-subtle hover:text-foreground disabled:opacity-50"
            aria-label="Close"
          >
            <Icon name="CloseLine" size={18} />
          </button>
        </div>
        <p className="text-[13px] text-muted">
          {customer.fullName} · Current balance{' '}
          <span className="font-semibold text-foreground">{formatINR(customer.walletBalance ?? 0)}</span>
        </p>

        <form onSubmit={handleSubmit(onSubmit)} className="mt-5 space-y-4">
          <div>
            <label className="mb-1.5 block text-[13px] font-semibold text-foreground">
              Amount <span className="text-error">*</span>
            </label>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[15px] text-muted">₹</span>
              <input
                type="number"
                min={1}
                step={1}
                {...register('amount')}
                className="w-full rounded-md border border-border-strong bg-surface py-2.5 pl-7 pr-3 text-[14px] outline-none focus:border-primary"
              />
            </div>
            {errors.amount && <p className="mt-1 text-[12px] text-error">{errors.amount.message}</p>}
            <div className="mt-2 flex flex-wrap gap-2">
              {QUICK_PILLS.map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setValue('amount', v, { shouldValidate: true })}
                  className="rounded-pill border border-border-strong px-3 py-1 text-[12px] font-semibold text-foreground hover:bg-subtle"
                >
                  {formatINR(v)}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-[13px] font-semibold text-foreground">
              Reason <span className="text-error">*</span>
            </label>
            <input
              {...register('description')}
              placeholder="e.g. Goodwill credit, Compensation for delayed order"
              className="w-full rounded-md border border-border-strong bg-surface px-3 py-2.5 text-[14px] outline-none placeholder:text-faint focus:border-primary"
            />
            {errors.description && <p className="mt-1 text-[12px] text-error">{errors.description.message}</p>}
          </div>

          <div className="flex justify-end gap-2.5 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={addWalletLoading}
              className="rounded-md border border-border-strong px-4 py-2 text-[14px] font-semibold text-foreground hover:bg-subtle disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={addWalletLoading}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-[14px] font-semibold text-white hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-50"
            >
              {addWalletLoading && <Icon name="Loader4Line" size={16} className="animate-spin" />}
              Add {amount > 0 ? formatINR(amount) : 'money'}
            </button>
          </div>
        </form>
      </div>
    </Modal>
  );
};

export default AddWalletMoneyModal;
