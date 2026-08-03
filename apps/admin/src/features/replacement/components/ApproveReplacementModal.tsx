import { type FC, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { computeReplacementRefund } from '@barakath/shared/utils/replacementRefund';
import { useAppDispatch, useAppSelector } from '@/stores/store';
import Modal from '@/components/Modal';
import Icon from '@/components/icons/Icon';
import { formatINRExact } from '@/utils/format';
import { approveReplacement } from '../api/approveReplacement';

interface Props {
  isOpen: boolean;
  replacementId: string;
  onClose: () => void;
  onApproved: () => void;
}

/**
 * ApproveReplacementModal — confirm approval of a Pending return request (spec §1.10). Approving
 * refunds the returned line's value to the customer's WALLET; no replacement order is created any more.
 *
 * The amount shown here is a PREVIEW computed from the same shared helper the Cloud Function uses, so
 * the admin sees the figure before committing. The authoritative number comes back from the server and
 * is what the success toast reports — if they ever disagree, the server wins and the admin sees it.
 *
 * The admin note is optional here (unlike rejection). The confirm button follows the button-loading rule
 * (disabled + spinner while the call runs) so it can't be double-submitted.
 */
const ApproveReplacementModal: FC<Props> = ({ isOpen, replacementId, onClose, onApproved }) => {
  const dispatch = useAppDispatch();
  const loading = useAppSelector((s) => s.replacement.approveLoading);
  const detail = useAppSelector((s) => s.replacement.replacementDetail);
  const [adminNote, setAdminNote] = useState('');

  // Preview only — null when the original order is missing, in which case the server will reject the
  // approval anyway and we simply don't promise an amount.
  const preview = useMemo(() => {
    if (!detail?.order || !detail.replacement) return null;
    try {
      return computeReplacementRefund(detail.order, {
        productId: detail.replacement.productId,
        variantId: detail.replacement.variantId,
        quantity: detail.replacement.quantity,
      });
    } catch {
      return null;
    }
  }, [detail]);

  const close = () => {
    setAdminNote('');
    onClose();
  };

  const onApprove = async () => {
    const res = await dispatch(
      approveReplacement({ replacementId, adminNote: adminNote.trim() }),
    );
    if (approveReplacement.fulfilled.match(res)) {
      toast.success(
        `Return approved — ${formatINRExact(res.payload.refundAmount ?? 0)} credited to wallet`,
      );
      onApproved();
      close();
    } else {
      toast.error((res.payload as string) ?? 'Could not approve the return request');
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={loading ? () => {} : close} maxWidth="max-w-md">
      <div className="rounded-xl border border-border bg-surface p-6 shadow-lg">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[18px] font-bold tracking-tight text-foreground">Approve Return</h2>
          <button
            type="button"
            onClick={close}
            disabled={loading}
            className="text-faint hover:text-foreground disabled:opacity-50"
            aria-label="Close"
          >
            <Icon name="CloseLine" size={20} />
          </button>
        </div>

        <div className="flex gap-2 rounded-lg border border-success-subtle bg-success-subtle/50 px-3 py-2.5">
          <Icon name="CheckLine" size={16} className="mt-0.5 shrink-0 text-success" />
          <p className="text-[13px] text-foreground">
            {preview ? (
              <>
                <span className="font-semibold">{formatINRExact(preview.refundAmount)}</span> will be
                credited to {detail?.replacement.userName || 'the customer'}&apos;s wallet.
              </>
            ) : (
              <>The refund will be credited to the customer&apos;s wallet.</>
            )}
          </p>
        </div>

        {preview && (
          <p className="mt-2 text-[12px] text-faint">
            {preview.quantity} × item {formatINRExact(preview.lineGross)}
            {preview.couponShare > 0 && <> − coupon share {formatINRExact(preview.couponShare)}</>}
            {preview.gstShare > 0 && <> + GST {formatINRExact(preview.gstShare)}</>}. Delivery is not
            refunded.
          </p>
        )}

        <div className="mt-4">
          <label className="mb-1.5 block text-[13px] font-semibold text-foreground">
            Admin note <span className="font-normal text-faint">(optional)</span>
          </label>
          <textarea
            value={adminNote}
            onChange={(e) => setAdminNote(e.target.value)}
            rows={3}
            placeholder="Add an internal note about this approval…"
            className="w-full resize-none rounded-md border border-border-strong bg-surface px-3 py-2 text-[14px] outline-none placeholder:text-faint focus:border-primary"
          />
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
            type="button"
            onClick={onApprove}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-md bg-success px-5 py-2 text-[14px] font-semibold text-white hover:brightness-95 disabled:opacity-50"
          >
            {loading && <Icon name="Loader4Line" size={16} className="animate-spin" />}
            Approve &amp; Refund to Wallet
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default ApproveReplacementModal;
