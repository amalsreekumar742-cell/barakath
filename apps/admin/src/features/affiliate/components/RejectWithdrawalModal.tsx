import { type FC, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import type { AffiliateWithdrawalProps } from '@barakath/shared/types';
import { useAppDispatch, useAppSelector } from '@/stores/store';
import Modal from '@/components/Modal';
import Icon from '@/components/icons/Icon';
import { formatINR } from '@/utils/format';
import { rejectWithdrawal } from '../api/rejectWithdrawal';

const MIN_REASON = 10;

/**
 * RejectWithdrawalModal — reject a withdrawal with a required reason (spec §1.14). Shows the affiliate
 * name + amount and a reason textarea (min 10 chars). "Reject" (red) follows the button-loading rule.
 * `processedBy` records the acting admin's name. Renders nothing when no target is set.
 */
const RejectWithdrawalModal: FC<{ withdrawal: AffiliateWithdrawalProps | null; onClose: () => void }> = ({
  withdrawal,
  onClose,
}) => {
  const dispatch = useAppDispatch();
  const { rejectLoading } = useAppSelector((s) => s.affiliate);
  const admin = useAppSelector((s) => s.currentAdmin.admin);

  const [reason, setReason] = useState('');
  const [touched, setTouched] = useState(false);

  // Clear the field whenever a new target opens so a prior reason never carries over.
  useEffect(() => {
    if (withdrawal) {
      setReason('');
      setTouched(false);
    }
  }, [withdrawal]);

  if (!withdrawal) return null;

  const tooShort = reason.trim().length < MIN_REASON;

  const onReject = async () => {
    setTouched(true);
    if (tooShort) return;
    const res = await dispatch(
      rejectWithdrawal({
        withdrawalId: withdrawal.id,
        rejectionReason: reason,
        processedBy: admin?.fullName ?? admin?.id ?? '',
      }),
    );
    if (rejectWithdrawal.fulfilled.match(res)) {
      toast.success('Withdrawal request rejected');
      onClose();
    } else {
      toast.error((res.payload as string) ?? 'Could not reject withdrawal');
    }
  };

  return (
    <Modal isOpen={!!withdrawal} onClose={rejectLoading ? () => {} : onClose} maxWidth="max-w-[440px]">
      <div className="rounded-xl border border-border bg-surface p-6 shadow-lg">
        <div className="mb-1 flex items-center justify-between">
          <h2 className="text-[18px] font-bold tracking-tight text-foreground">Reject Withdrawal</h2>
          <button
            type="button"
            onClick={onClose}
            disabled={rejectLoading}
            className="rounded-md p-1 text-muted hover:bg-subtle hover:text-foreground disabled:opacity-50"
            aria-label="Close"
          >
            <Icon name="CloseLine" size={18} />
          </button>
        </div>
        <p className="text-[13px] text-muted">
          {withdrawal.userName || '—'} ·{' '}
          <span className="font-semibold text-foreground">{formatINR(withdrawal.amount)}</span>
        </p>

        <div className="mt-4">
          <label className="mb-1.5 block text-[13px] font-semibold text-foreground">
            Reason for rejection <span className="text-error">*</span>
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            onBlur={() => setTouched(true)}
            rows={3}
            placeholder="Explain why this request is being rejected (min 10 characters)…"
            className="w-full resize-none rounded-md border border-border-strong bg-surface px-3 py-2.5 text-[14px] outline-none placeholder:text-faint focus:border-primary"
          />
          {touched && tooShort && (
            <p className="mt-1 text-[12px] text-error">Please enter at least {MIN_REASON} characters.</p>
          )}
        </div>

        <div className="mt-6 flex justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            disabled={rejectLoading}
            className="rounded-md border border-border-strong px-4 py-2 text-[14px] font-semibold text-foreground hover:bg-subtle disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onReject}
            disabled={rejectLoading || tooShort}
            className="inline-flex items-center gap-2 rounded-md bg-error px-4 py-2 text-[14px] font-semibold text-white transition-colors hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {rejectLoading && <Icon name="Loader4Line" size={16} className="animate-spin" />}
            Reject
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default RejectWithdrawalModal;
