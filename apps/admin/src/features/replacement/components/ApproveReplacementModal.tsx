import { type FC, useState } from 'react';
import toast from 'react-hot-toast';
import { useAppDispatch, useAppSelector } from '@/stores/store';
import Modal from '@/components/Modal';
import Icon from '@/components/icons/Icon';
import { approveReplacement } from '../api/approveReplacement';

interface Props {
  isOpen: boolean;
  replacementId: string;
  onClose: () => void;
  onApproved: () => void;
}

/**
 * ApproveReplacementModal — confirm approval of a Pending request (spec §1.10). Approving spawns a free
 * replacement order automatically (handled server-side in `approveReplacement`), so the copy states that
 * plainly. The admin note is optional here (unlike rejection). The confirm button follows the
 * button-loading rule (disabled + spinner while the batch runs) so it can't be double-submitted.
 */
const ApproveReplacementModal: FC<Props> = ({ isOpen, replacementId, onClose, onApproved }) => {
  const dispatch = useAppDispatch();
  const loading = useAppSelector((s) => s.replacement.approveLoading);
  const admin = useAppSelector((s) => s.currentAdmin.admin);
  const [adminNote, setAdminNote] = useState('');

  const close = () => {
    setAdminNote('');
    onClose();
  };

  const onApprove = async () => {
    if (!admin) return;
    const res = await dispatch(
      approveReplacement({
        replacementId,
        adminNote: adminNote.trim(),
        adminId: admin.id,
        adminName: admin.fullName,
      }),
    );
    if (approveReplacement.fulfilled.match(res)) {
      toast.success('Replacement approved — new order created');
      onApproved();
      close();
    } else {
      toast.error((res.payload as string) ?? 'Could not approve the replacement');
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={loading ? () => {} : close} maxWidth="max-w-md">
      <div className="rounded-xl border border-border bg-surface p-6 shadow-lg">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[18px] font-bold tracking-tight text-foreground">Approve Replacement</h2>
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
            A free replacement order will be created automatically for the customer.
          </p>
        </div>

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
            Approve &amp; Create Order
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default ApproveReplacementModal;
