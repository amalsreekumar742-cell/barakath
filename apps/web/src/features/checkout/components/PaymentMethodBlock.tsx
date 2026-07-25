'use client';

import { CreditCard, Wallet } from 'lucide-react';
import { formatInr } from '@/components/catalog/PriceBlock';

export interface PaymentMethodBlockProps {
  /** `general/config.payment.walletPaymentsEnabled` — null while settings are still loading. */
  walletPaymentsEnabled: boolean | null;
  walletBalance: number;
  walletApplied: boolean;
  onToggleWallet: () => void;
  /** `computeTotals(...).razorpayAmount` — 0 means the wallet already covers the whole order. */
  razorpayAmount: number;
  /** `computeTotals(...).walletAmountUsed` — how much of the toggle will actually be spent. */
  walletAmountUsed: number;
}

/**
 * Payment method (spec 2.13): a Razorpay row (UPI/Card/Netbanking are choices made INSIDE Razorpay's
 * own sheet, per WEB_BATCH3_NOTES.md §6 — there is no separate radio for each), and a wallet toggle
 * showing the live balance. No Cash on Delivery row at all (WEB_BATCH1_NOTES.md §7 — COD does not
 * exist as a product option, not even as a disabled row).
 */
export function PaymentMethodBlock({
  walletPaymentsEnabled,
  walletBalance,
  walletApplied,
  onToggleWallet,
  razorpayAmount,
  walletAmountUsed,
}: PaymentMethodBlockProps) {
  const walletDisabledReason =
    walletPaymentsEnabled === null
      ? 'Loading wallet settings…'
      : walletPaymentsEnabled === false
        ? 'Wallet payments are currently unavailable.'
        : walletBalance <= 0
          ? 'Your wallet balance is ₹0.'
          : null;
  const walletUsable = walletDisabledReason === null;
  const fullyCoveredByWallet = razorpayAmount === 0 && walletAmountUsed > 0;

  return (
    <div>
      <h3 className="mb-2 text-xs font-extrabold uppercase tracking-wide text-muted">Payment method</h3>
      <div className="space-y-3">
        {/* Wallet toggle */}
        <label
          className={`flex items-center justify-between gap-3 rounded-lg border p-4 transition ${
            walletApplied ? 'border-primary bg-primary-subtle' : 'border-border-strong bg-surface'
          } ${walletUsable ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'}`}
        >
          <span className="flex items-start gap-2">
            <Wallet size={18} className="mt-0.5 shrink-0 text-primary" />
            <span>
              <span className="block text-sm font-semibold text-foreground">Pay with wallet</span>
              <span className="block text-xs text-muted">
                Balance: {formatInr(walletBalance)}
                {walletApplied && walletAmountUsed > 0 ? ` · Using ${formatInr(walletAmountUsed)}` : ''}
              </span>
              {walletDisabledReason && <span className="block text-xs text-error">{walletDisabledReason}</span>}
            </span>
          </span>
          <input
            type="checkbox"
            checked={walletApplied}
            disabled={!walletUsable}
            onChange={onToggleWallet}
            className="size-5 shrink-0 rounded border-border-strong disabled:cursor-not-allowed"
            aria-label="Use wallet balance for this order"
          />
        </label>

        {/* Razorpay row — hidden as a *choice* once the wallet covers the whole total; still shown,
            but visibly inert, so the customer sees WHY there is nothing left to pay by card/UPI. */}
        <div
          className={`flex items-center gap-3 rounded-lg border p-4 ${
            fullyCoveredByWallet
              ? 'border-border bg-subtle opacity-60'
              : 'border-primary bg-primary-subtle'
          }`}
        >
          <CreditCard size={18} className="shrink-0 text-primary" />
          <div>
            <p className="text-sm font-semibold text-foreground">
              {fullyCoveredByWallet ? 'Card / UPI / Netbanking — not needed' : 'Card / UPI / Netbanking'}
            </p>
            <p className="text-xs text-muted">
              {fullyCoveredByWallet
                ? 'Your wallet balance covers the full order — nothing more to pay.'
                : `You'll choose UPI, card or netbanking on Razorpay's secure screen · To pay: ${formatInr(razorpayAmount)}`}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
