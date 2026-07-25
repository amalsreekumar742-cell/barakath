import { useRouter } from 'next/navigation';
import { Gift } from 'lucide-react';
import { Button } from '@/components/Button';

/**
 * The Spin & Win promo card — design marker 09's gold sidebar panel (icon, "Spin & win daily" title,
 * a line of copy, a full-width "Spin now" button). Spec §3.13 — website-specific; the Flutter app has
 * no wallet-tab equivalent, it links to the spinner from its own home/rewards surfaces instead. Purely
 * a link out to `/spin-win` (spec §3.14) — no spin state, slot data or eligibility logic belongs here.
 */
export function SpinWinPromoCard() {
  const router = useRouter();

  return (
    <div className="rounded-2xl border border-gold-border bg-gold-subtle p-6">
      <Gift size={26} className="text-gold-strong" aria-hidden />
      <p className="mt-3 font-display text-lg font-semibold text-gold-strong">Spin &amp; win daily</p>
      <p className="mt-2 text-[13px] text-gold-strong opacity-85">
        Win cashback, coupons and rewards straight to your wallet.
      </p>
      <Button variant="primary" size="lg" fullWidth className="mt-4" onClick={() => router.push('/spin-win')}>
        Spin now
      </Button>
    </div>
  );
}
