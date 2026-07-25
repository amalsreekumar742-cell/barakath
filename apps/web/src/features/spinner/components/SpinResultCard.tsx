'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { Check, Copy, Frown, Gift } from 'lucide-react';
import { Button } from '@/components/Button';
import { toastSuccess } from '@/lib/toast';
import type { SpinWheelResponse } from '../api/submitSpin';
import { formatSpinRewardAmount, spinConditionsLine } from '../utils/spinReward';
import { Confetti } from './Confetti';

export interface SpinResultCardProps {
  result: SpinWheelResponse;
  /** Server-reported, post-spin — never a local guess (see `spinnerSlice.ts`'s header comment). */
  spinsRemaining: number;
  /** True while a NEW spin (triggered by "Spin again") is in flight — disables the button so a second
   *  tap can't fire two spins at once. */
  spinning: boolean;
  onSpinAgain: () => void;
}

/**
 * The result, rendered INLINE beneath the wheel — spec §3.14 is explicit that the website shows
 * everything on one page (the app's bottom sheet has no equivalent here; do not build a modal). Styled
 * as a full-bleed warm-gradient hero (design marker 26), not a small bordered card, to match the
 * prominence the design gives a win.
 *
 * Both outcomes offer "Spin again (X left)" when spins remain: a loss still counts toward the cap
 * server-side (`spinHistory` records every attempt, win or lose — `spinWheel.ts`), so there is nothing
 * dishonest about letting the customer immediately try again.
 */
export function SpinResultCard({ result, spinsRemaining, spinning, onSpinAgain }: SpinResultCardProps) {
  const [copied, setCopied] = useState(false);
  const isWin = result.resultType === 'Coupon';
  const details = result.couponDetails;

  async function handleCopy() {
    if (!result.couponCode) return;
    try {
      await navigator.clipboard.writeText(result.couponCode);
      setCopied(true);
      toastSuccess('Coupon code copied');
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard permission denied/unavailable — the code is already visible on screen to copy by hand.
    }
  }

  function scrollToCoupons() {
    document.getElementById('coupon-wallet')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  return (
    <div className="relative mt-6 w-full overflow-hidden rounded-2xl bg-gradient-to-br from-[#fbf6e9] to-[#f3e6c4] px-6 py-14 text-center">
      {isWin && <Confetti />}

      <div
        className={`mx-auto flex size-24 items-center justify-center rounded-full shadow-lg ${
          isWin ? 'bg-gold text-white' : 'bg-subtle text-muted'
        }`}
      >
        {isWin ? <Gift className="size-11" aria-hidden /> : <Frown className="size-11" aria-hidden />}
      </div>

      <h1 className="mx-auto mt-7 max-w-md font-display text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
        {isWin && details ? `You won ${formatSpinRewardAmount(details)}!` : isWin ? result.slotLabel : 'Better luck next time'}
      </h1>

      <p className="mx-auto mt-2.5 max-w-sm text-base text-muted">
        {isWin
          ? `Coupon ${result.couponCode} has been added to your wallet — use it at checkout.`
          : 'That spin has been used. Try your luck again.'}
      </p>

      {isWin && result.couponCode && (
        <div className="mx-auto mt-6 max-w-sm">
          <div className="flex items-center justify-between gap-3 rounded-lg border border-gold-border bg-surface px-4 py-3">
            <span className="font-display text-lg font-extrabold tracking-wide text-gold-strong">
              {result.couponCode}
            </span>
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-border-strong bg-surface px-2.5 py-1.5 text-xs font-bold text-foreground hover:bg-subtle"
            >
              {copied ? <Check size={14} aria-hidden /> : <Copy size={14} aria-hidden />}
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
          {details && (
            <p className="mt-2 text-xs text-faint">
              {[spinConditionsLine(details), `Expires ${format(new Date(details.validUntil), 'd MMM yyyy')}`]
                .filter(Boolean)
                .join(' · ')}
            </p>
          )}
        </div>
      )}

      <div className="mt-7 flex flex-wrap items-center justify-center gap-3.5">
        {isWin && (
          <Button variant="primary" size="lg" onClick={scrollToCoupons}>
            View my coupons
          </Button>
        )}
        {spinsRemaining > 0 && (
          <Button variant="secondary" size="lg" loading={spinning} onClick={onSpinAgain}>
            Spin again ({spinsRemaining} left)
          </Button>
        )}
      </div>
    </div>
  );
}
