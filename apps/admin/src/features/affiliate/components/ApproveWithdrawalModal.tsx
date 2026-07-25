import { type FC } from 'react';
import toast from 'react-hot-toast';
import type { AffiliateWithdrawalProps } from '@barakath/shared/types';
import { useAppDispatch, useAppSelector } from '@/stores/store';
import Modal from '@/components/Modal';
import Icon from '@/components/icons/Icon';
import { formatINR } from '@/utils/format';
import { approveWithdrawal } from '../api/approveWithdrawal';
import { maskAccount } from './ui';

/** One label/value row in the request detail block. */
const DetailRow: FC<{ label: string; value: string; mono?: boolean }> = ({ label, value, mono }) => (
  <div className="flex items-center justify-between gap-4 py-1.5">
    <span className="text-[12px] font-semibold uppercase tracking-wide text-faint">{label}</span>
    <span className={`text-[13px] font-medium text-foreground ${mono ? 'font-mono' : ''}`}>{value || '—'}</span>
  </div>
);

/**
 * ApproveWithdrawalModal — confirm approving a withdrawal (spec §1.14). Follows the design's centered
 * confirmation dialog: a gold wallet badge, an "Approve withdrawal?" heading, and a plain-language line
 * summarising who is paid and that the amount is deducted from confirmed commission. A compact bank-detail
 * block is retained below so the admin has the account number / IFSC to perform the manual transfer that
 * the copy references. The primary "Approve & pay" button follows the button-loading rule; `processedBy`
 * records the acting admin's name. Renders nothing when no target.
 */
const ApproveWithdrawalModal: FC<{ withdrawal: AffiliateWithdrawalProps | null; onClose: () => void }> = ({
  withdrawal,
  onClose,
}) => {
  const dispatch = useAppDispatch();
  const { approveLoading } = useAppSelector((s) => s.affiliate);
  const admin = useAppSelector((s) => s.currentAdmin.admin);

  if (!withdrawal) return null;

  const onApprove = async () => {
    const res = await dispatch(
      approveWithdrawal({
        withdrawalId: withdrawal.id,
        processedBy: admin?.fullName ?? admin?.id ?? '',
      }),
    );
    if (approveWithdrawal.fulfilled.match(res)) {
      toast.success(`Withdrawal of ${formatINR(withdrawal.amount)} approved`);
      onClose();
    } else {
      toast.error((res.payload as string) ?? 'Could not approve withdrawal');
    }
  };

  const destination = [withdrawal.bankName, maskAccount(withdrawal.accountNumber)]
    .filter((s) => s && s !== '—')
    .join(' ');

  return (
    <Modal isOpen={!!withdrawal} onClose={approveLoading ? () => {} : onClose} maxWidth="max-w-[420px]">
      <div className="rounded-xl border border-border bg-surface p-7 text-center shadow-lg">
        {/* Gold wallet badge */}
        <span className="mx-auto mb-1 flex h-14 w-14 items-center justify-center rounded-full bg-gold-subtle text-gold-strong">
          <Icon name="WalletLine" size={26} />
        </span>

        <h2 className="text-[20px] font-extrabold tracking-tight text-foreground">Approve withdrawal?</h2>
        <p className="mx-auto mt-2 max-w-[340px] text-[14px] leading-relaxed text-muted">
          {formatINR(withdrawal.amount)} will be transferred to {withdrawal.userName || 'the affiliate'}
          {destination ? `'s ${destination}` : ''}. The amount is deducted from the affiliate&apos;s confirmed
          commission balance and must be transferred manually outside the system.
        </p>

        {/* Bank details for the manual transfer */}
        <div className="mt-4 divide-y divide-border rounded-xl border border-border px-4 text-left">
          <DetailRow label="Account Holder" value={withdrawal.accountHolderName} />
          <DetailRow label="Bank" value={withdrawal.bankName} />
          <DetailRow label="Account No." value={withdrawal.accountNumber} mono />
          <DetailRow label="IFSC" value={withdrawal.ifscCode} mono />
        </div>

        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={approveLoading}
            className="flex-1 rounded-md border border-border-strong px-4 py-2.5 text-[14px] font-semibold text-foreground hover:bg-subtle disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onApprove}
            disabled={approveLoading}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-md bg-primary px-4 py-2.5 text-[14px] font-semibold text-white transition-colors hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-50"
          >
            {approveLoading && <Icon name="Loader4Line" size={16} className="animate-spin" />}
            Approve &amp; pay
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default ApproveWithdrawalModal;
