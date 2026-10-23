import type { FC } from 'react';
import Modal from '@/components/Modal';
import Icon from '@/components/icons/Icon';

interface Props {
  isOpen: boolean;
  succeededCount: number;
  failed: { orderId: string; reason: string }[];
  onClose: () => void;
}

/**
 * BulkResultModal — shown after a bulk status run in which some orders were NOT updated, listing each
 * one with the reason (e.g. "Payment is not complete…"). A toast alone would hide which orders still
 * need attention.
 */
const BulkResultModal: FC<Props> = ({ isOpen, succeededCount, failed, onClose }) => (
  <Modal isOpen={isOpen} onClose={onClose} maxWidth="max-w-lg">
    <div className="rounded-xl border border-border bg-surface p-6 shadow-lg">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-[18px] font-bold tracking-tight text-foreground">
          {failed.length} order{failed.length === 1 ? '' : 's'} not updated
        </h2>
        <button type="button" onClick={onClose} className="text-faint hover:text-foreground" aria-label="Close">
          <Icon name="CloseLine" size={20} />
        </button>
      </div>
      <p className="text-[13px] text-muted">
        {succeededCount} updated successfully. These were skipped:
      </p>
      <ul className="mt-3 max-h-72 space-y-2 overflow-y-auto">
        {failed.map((f) => (
          <li key={f.orderId} className="rounded-lg border border-border px-3 py-2">
            <p className="font-mono text-[12px] font-semibold text-foreground">#{f.orderId}</p>
            <p className="mt-0.5 text-[12px] text-error">{f.reason}</p>
          </li>
        ))}
      </ul>
      <div className="mt-5 flex justify-end">
        <button
          type="button"
          onClick={onClose}
          className="rounded-md bg-primary px-4 py-2 text-[14px] font-semibold text-white hover:bg-primary-dark"
        >
          Done
        </button>
      </div>
    </div>
  </Modal>
);

export default BulkResultModal;
