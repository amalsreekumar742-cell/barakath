import type { FC } from 'react';
import Modal from './Modal';
import Icon from './icons/Icon';

/**
 * ConfirmDialog — the standard confirmation prompt, built on the shared Modal (design: white card,
 * radius-xl, warm shadow; error CTA for destructive actions).
 *
 * WHY one component: spec §1.22 requires a confirmation dialog before EVERY action (add, edit, delete,
 * toggle, approve, reject, send, export, stock adjust). Centralizing keeps every prompt consistent.
 * WHY the confirm button follows the button-loading rule: the confirm action is server-side; it must
 * disable + show a spinner while in flight so it can't be double-submitted.
 */
interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmVariant?: 'danger' | 'primary';
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

const ConfirmDialog: FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  confirmVariant = 'primary',
  loading = false,
  onConfirm,
  onCancel,
}) => {
  const confirmClasses =
    confirmVariant === 'danger'
      ? 'bg-error text-white hover:brightness-95'
      : 'bg-primary text-white hover:bg-primary-dark';

  return (
    <Modal isOpen={isOpen} onClose={loading ? () => {} : onCancel} maxWidth="max-w-[400px]">
      <div className="rounded-xl border border-border bg-surface p-6 shadow-lg">
        <h2 className="text-[18px] font-bold tracking-tight text-foreground">{title}</h2>
        <p className="mt-2 text-[14px] leading-normal text-muted">{message}</p>

        <div className="mt-6 flex justify-end gap-2.5">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="rounded-md border border-border-strong px-4 py-2 text-[14px] font-semibold text-foreground transition-colors hover:bg-subtle disabled:cursor-not-allowed disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={`inline-flex items-center gap-2 rounded-md px-4 py-2 text-[14px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${confirmClasses}`}
          >
            {loading && <Icon name="Loader4Line" size={16} className="animate-spin" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default ConfirmDialog;
