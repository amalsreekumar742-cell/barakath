'use client';

import { AlertTriangle } from 'lucide-react';
import { Modal } from '@/components/Modal';
import { Button } from '@/components/Button';
import { formatInr } from '@/components/catalog/PriceBlock';
import type { ReconcileNumbers } from '../stores/checkoutSlice';

export interface ReconcileDialogProps {
  reconcile: ReconcileNumbers | null;
  onContinue: () => void;
  onCancel: () => void;
}

/**
 * "The amount changed" prompt (spec §2.15) — shown only when `placeOrder`'s `onReconcileRequired`
 * fires, which happens ONLY when the server's real amount (after re-pricing the cart, the coupon and
 * stock server-side) differs from what was on screen by more than 50 paisa. At the moment this dialog
 * is visible, `createPaymentOrder` has ALREADY created the order (WEB_BATCH3_NOTES.md §7) — Continue
 * proceeds to Razorpay for the server's real amount; Cancel calls `cancelOrder` on that already-created
 * order (handled inside `checkoutThunks.ts`, not here) and the checkout ends in a `payment-failed`
 * route with a `reconcile-declined` reason.
 */
export function ReconcileDialog({ reconcile, onContinue, onCancel }: ReconcileDialogProps) {
  return (
    <Modal isOpen={reconcile !== null} onClose={onCancel} maxWidth="max-w-sm" labelledBy="reconcile-title">
      {reconcile && (
        <div className="rounded-xl bg-surface p-5">
          <div className="flex items-center gap-2">
            <AlertTriangle size={18} className="text-warning" />
            <h2 id="reconcile-title" className="font-display text-base font-extrabold text-foreground">
              The amount changed
            </h2>
          </div>
          <p className="mt-2 text-sm text-muted">
            The price you saw was <span className="font-medium text-foreground">{formatInr(reconcile.displayed)}</span>,
            but your order now totals <span className="font-medium text-foreground">{formatInr(reconcile.amount)}</span>{' '}
            (a coupon or price may have just changed). Continue with the new amount, or cancel.
          </p>
          <div className="mt-5 flex gap-3">
            <Button variant="secondary" size="md" fullWidth onClick={onCancel}>
              Cancel order
            </Button>
            <Button variant="primary" size="md" fullWidth onClick={onContinue}>
              Continue · {formatInr(reconcile.amount)}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
