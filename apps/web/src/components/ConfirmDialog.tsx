'use client';

import { useId } from 'react';
import { Modal } from './Modal';
import { Button } from './Button';

/**
 * The confirmation dialog every destructive or irreversible action goes through — logout, cancel an
 * order, remove an address, delete an account (spec 3.25 requires one before every such action).
 *
 * WHY it wraps the shared Modal instead of being its own overlay: focus handling, scroll-lock and
 * Escape are solved once in Modal. A second implementation is a second place for them to be wrong.
 *
 * WHY `loading` sits on the confirm button rather than closing the dialog immediately: the action is
 * usually a Cloud Function call that can fail. Closing on click would leave the customer looking at
 * an unchanged screen with no idea whether anything happened.
 *
 * WHY the cancel button comes FIRST in the DOM: it is the safe choice, so it is where focus and a
 * hurried Enter keypress land.
 */
export interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Paints the confirm button red. Use for anything that destroys or cannot be undone. */
  destructive?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export function ConfirmDialog({
  isOpen,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = false,
  loading = false,
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  const titleId = useId();

  return (
    <Modal
      isOpen={isOpen}
      // While the action is in flight, an outside click or Escape must not dismiss — the request is
      // still running and dropping the UI would leave its outcome unreported.
      onClose={loading ? () => {} : onClose}
      maxWidth="max-w-md"
      labelledBy={titleId}
    >
      <div className="rounded-xl border border-border bg-surface p-6 shadow-lg">
        <h2 id={titleId} className="font-display text-lg font-semibold text-foreground">
          {title}
        </h2>
        {description && <p className="mt-2 text-sm leading-relaxed text-muted">{description}</p>}

        <div className="mt-6 flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button
            variant={destructive ? 'destructive' : 'primary'}
            onClick={onConfirm}
            loading={loading}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
