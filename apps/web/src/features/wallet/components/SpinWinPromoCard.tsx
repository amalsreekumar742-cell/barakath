import Link from 'next/link';
import { Sparkles } from 'lucide-react';

/**
 * The Spin & Win promo card on the wallet tab (spec §3.13 — website-specific; the Flutter app has no
 * wallet-tab equivalent, it links to the spinner from its own home/rewards surfaces instead). Purely a
 * link out to `/spin-win` (spec §3.14, built by a parallel Batch 4 session) — no spin state, slot data
 * or eligibility logic belongs here.
 */
export function SpinWinPromoCard() {
  return (
    <Link
      href="/spin-win"
      className="flex items-center gap-4 rounded-2xl border border-gold-border bg-gold-subtle p-5 transition hover:brightness-[0.98]"
    >
      <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-gold text-white">
        <Sparkles size={20} aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-display text-sm font-extrabold text-foreground">Spin & Win</p>
        <p className="mt-0.5 text-xs text-muted">
          Spin the wheel for a chance to win a coupon — free, once your cooldown resets.
        </p>
      </div>
      <span className="shrink-0 text-xs font-bold text-gold-strong">Play now →</span>
    </Link>
  );
}
