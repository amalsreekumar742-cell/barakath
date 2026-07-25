import { type FC, useState } from 'react';
import toast from 'react-hot-toast';
import { useAppDispatch, useAppSelector } from '@/stores/store';
import Modal from '@/components/Modal';
import Icon from '@/components/icons/Icon';
import { rejectReplacement } from '../api/rejectReplacement';

interface Props {
  isOpen: boolean;
  replacementId: string;
  onClose: () => void;
  onRejected: () => void;
}

const MIN_NOTE = 10;

/**
 * RejectReplacementModal — decline a Pending request with a MANDATORY note (spec §1.10). The customer is
 * notified of the rejection, so the note (≥10 chars) supplies the reason. Validation is local (show an
 * inline error); the thunk re-checks the note server-side too. Danger-styled confirm with the standard
 * button-loading behaviour so it can't be double-submitted.
 */
const RejectReplacementModal: FC<Props> = ({ isOpen, replacementId, onClose, onRejected }) => {
  const dispatch = useAppDispatch();
  const loading = useAppSelector((s) => s.replacement.rejectLoading);
  const admin = useAppSelector((s) => s.currentAdmin.admin);
  const [adminNote, setAdminNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  const close = () => {
    setAdminNote('');
    setError(null);
    onClose();
  };

  const onReject = async () => {
    if (!admin) return;
    if (adminNote.trim().length < MIN_NOTE) {
      setError(`Please give a reason (at least ${MIN_NOTE} characters)`);
      return;
    }
    const res = await dispatch(
      rejectReplacement({
        replacementId,
        adminNote: adminNote.trim(),
        adminId: admin.id,
        adminName: admin.fullName,
      }),
    );
    if (rejectReplacement.fulfilled.match(res)) {
      toast.success('Replacement request rejected');
      onRejected();
      close();
    } else {
      toast.error((res.payload as string) ?? 'Could not reject the replacement');
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={loading ? () => {} : close} maxWidth="max-w-md">
      <div className="rounded-xl border border-border bg-surface p-6 shadow-lg">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[18px] font-bold tracking-tight text-foreground">Reject Replacement</h2>
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

        <div className="flex gap-2 rounded-lg border border-warning-subtle bg-warning-subtle/50 px-3 py-2.5">
          <Icon name="AlertLine" size={16} className="mt-0.5 shrink-0 text-warning" />
          <p className="text-[13px] text-foreground">
            The customer will be notified that their replacement request has been rejected.
          </p>
        </div>

        <div className="mt-4">
          <label className="mb-1.5 block text-[13px] font-semibold text-foreground">
            Reason for rejection
          </label>
          <textarea
            value={adminNote}
            onChange={(e) => {
              setAdminNote(e.target.value);
              if (error) setError(null);
            }}
            rows={3}
            placeholder="Explain why this request is being rejected…"
            className="w-full resize-none rounded-md border border-border-strong bg-surface px-3 py-2 text-[14px] outline-none placeholder:text-faint focus:border-primary"
          />
          {error && <p className="mt-1 text-[12px] text-error">{error}</p>}
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
            onClick={onReject}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-md bg-error px-5 py-2 text-[14px] font-semibold text-white hover:brightness-95 disabled:opacity-50"
          >
            {loading && <Icon name="Loader4Line" size={16} className="animate-spin" />}
            Reject Request
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default RejectReplacementModal;
