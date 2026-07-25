'use client';

import { useState } from 'react';
import { Modal } from '@/components/Modal';
import { Button } from '@/components/Button';
import { formatInr } from '@/components/catalog/PriceBlock';
import { toastError, toastSuccess } from '@/lib/toast';
import { useAppDispatch, useAppSelector } from '@/stores/store';
import { topUpWallet } from '../api/walletThunks';

/** One-tap top-up shortcuts (Batch 4 brief §2). These are shortcuts, NOT limits — the field accepts
 *  any positive whole-rupee amount; the server is the only real min (₹1) / max (₹1,00,000) authority. */
const QUICK_AMOUNTS = [500, 1000, 2000, 5000];

export interface AddMoneyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * "Add money" (Batch 4 brief §2, spec §3.13) — a modal rather than a separate route (unlike the
 * Flutter app's `AddMoneyPage`): the website brief lists this as "'Add money' button opening the
 * Razorpay top-up flow below" with no route of its own, and every other money-adjacent action on this
 * site (address add/delete, logout) already uses the shared `Modal` the same way.
 *
 * FLOW (WEB_BATCH4_NOTES.md §7 — overrides the pasted prompt doc's `createPaymentOrder`/
 * `addWalletMoney`, neither of which exists for this path):
 *   1. `topUpWallet` thunk calls `createWalletTopUpOrder({amount})`.
 *   2. Opens Razorpay Checkout with the SERVER's order id/amount/key (C0's shared loader).
 *   3. On success, calls `verifyWalletTopUp({...})` and checks the `verified` boolean explicitly.
 *   4. On a verified credit, the balance updates on its own via `AuthListener`'s live `users/{uid}`
 *      subscription — this modal never writes a balance anywhere, optimistically or otherwise.
 *
 * The submit button is disabled for the WHOLE sequence (`toppingUp`, from the slice) so a double-click
 * cannot open two Razorpay orders — matches the skill's button-loading rule.
 */
export function AddMoneyModal({ isOpen, onClose }: AddMoneyModalProps) {
  const dispatch = useAppDispatch();
  const user = useAppSelector((s) => s.auth.user);
  const toppingUp = useAppSelector((s) => s.wallet.toppingUp);

  const [amountInput, setAmountInput] = useState('');

  const parsedAmount = Number(amountInput);
  // Client-side check is "a positive number" only (spec has no min/max) — the exact ₹1/₹1,00,000
  // guard rails are enforced (and messaged) server-side by `createWalletTopUpOrder` itself.
  const isValidAmount = amountInput.trim() !== '' && Number.isFinite(parsedAmount) && parsedAmount > 0;

  function handleClose() {
    if (toppingUp) return; // a top-up is mid-flight — losing this dialog would lose the outcome
    setAmountInput('');
    onClose();
  }

  async function handleSubmit() {
    if (!isValidAmount) {
      toastError(null, 'Enter an amount greater than ₹0.');
      return;
    }

    const result = await dispatch(
      topUpWallet({
        amount: parsedAmount,
        prefill: { name: user?.fullName || undefined, contact: user?.phone || undefined, email: user?.email || undefined },
      }),
    );

    if (topUpWallet.rejected.match(result)) {
      // A cancelled/dismissed Checkout sheet is not a fault — the customer changed their mind, so no
      // error toast, just re-arm the form silently (mirrors the Flutter app's identical treatment of
      // Razorpay's PAYMENT_CANCELLED code).
      if (result.payload?.reason !== 'dismissed') {
        toastError(result.payload?.message, 'Could not complete the top-up. Please try again.');
      }
      return;
    }

    toastSuccess(`${formatInr(result.payload.amount)} added to your wallet.`);
    setAmountInput('');
    onClose();
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} maxWidth="max-w-md" labelledBy="add-money-heading">
      <div className="rounded-xl border border-border bg-surface p-6 shadow-lg">
        <h2 id="add-money-heading" className="font-display text-lg font-extrabold text-foreground">
          Add money
        </h2>
        <p className="mt-1 text-sm text-muted">
          Wallet money never expires and can be used at checkout on any order.
        </p>

        <label htmlFor="top-up-amount" className="mt-5 block text-xs font-medium text-muted">
          Enter amount
        </label>
        <div className="mt-1.5 flex items-center gap-2 rounded-lg border-2 border-primary bg-surface px-4 py-3">
          <span className="font-display text-2xl font-medium text-foreground">₹</span>
          <input
            id="top-up-amount"
            type="text"
            inputMode="numeric"
            value={amountInput}
            disabled={toppingUp}
            onChange={(e) => setAmountInput(e.target.value.replace(/[^0-9]/g, '').slice(0, 7))}
            placeholder="0"
            className="w-full bg-transparent font-display text-2xl font-medium text-foreground outline-none placeholder:text-faint disabled:cursor-not-allowed"
          />
        </div>

        <div className="mt-3 grid grid-cols-4 gap-2">
          {QUICK_AMOUNTS.map((amount) => (
            <button
              key={amount}
              type="button"
              disabled={toppingUp}
              onClick={() => setAmountInput(String(amount))}
              className={`rounded-md border py-2.5 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${
                parsedAmount === amount
                  ? 'border-primary bg-primary text-white'
                  : 'border-border-strong bg-surface text-muted hover:text-foreground'
              }`}
            >
              {formatInr(amount)}
            </button>
          ))}
        </div>

        <div className="mt-5 flex gap-3">
          <Button variant="secondary" fullWidth onClick={handleClose} disabled={toppingUp}>
            Cancel
          </Button>
          <Button variant="primary" fullWidth loading={toppingUp} disabled={!isValidAmount} onClick={handleSubmit}>
            {isValidAmount ? `Add ${formatInr(parsedAmount)}` : 'Add money'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
