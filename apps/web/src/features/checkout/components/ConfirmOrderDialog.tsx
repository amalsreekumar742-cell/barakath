'use client';

import { Modal } from '@/components/Modal';
import { Button } from '@/components/Button';
import { formatInr } from '@/components/catalog/PriceBlock';

export interface ConfirmOrderDialogProps {
  isOpen: boolean;
  grandTotal: number;
  addressLabel: string | null;
  loading: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * The mandatory confirmation dialog before `placeOrder` fires (this batch's brief: "Confirmation
 * dialog before placing the order" — real money moves the instant this is confirmed, per
 * `createPaymentOrder` creating the order synchronously). Deliberately minimal: address + total only,
 * the full breakdown is already visible in `OrderSummaryBlock` right behind it.
 */
export function ConfirmOrderDialog({
  isOpen,
  grandTotal,
  addressLabel,
  loading,
  onConfirm,
  onCancel,
}: ConfirmOrderDialogProps) {
  return (
    <Modal isOpen={isOpen} onClose={onCancel} maxWidth="max-w-sm" labelledBy="confirm-order-title">
      <div className="rounded-xl bg-surface p-5">
        <h2 id="confirm-order-title" className="font-display text-base font-extrabold text-foreground">
          Confirm your order
        </h2>
        <p className="mt-2 text-sm text-muted">
          Deliver to <span className="font-bold text-foreground">{addressLabel ?? 'the selected address'}</span> for{' '}
          <span className="font-bold text-foreground">{formatInr(grandTotal)}</span>.
        </p>
        <div className="mt-5 flex gap-3">
          <Button variant="secondary" size="md" fullWidth onClick={onCancel} disabled={loading}>
            Cancel
          </Button>
          <Button variant="primary" size="md" fullWidth loading={loading} onClick={onConfirm}>
            Confirm &amp; pay
          </Button>
        </div>
      </div>
    </Modal>
  );
}
