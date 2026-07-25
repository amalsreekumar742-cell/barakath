import Link from 'next/link';
import { Disc3 } from 'lucide-react';

/**
 * The "Spin & Win" promo card (spec §3.4 / design's "Feeling lucky today?" panel) — a static,
 * full-width call-to-action into `/spin-win`. No data fetch: this is pure design-token markup, always
 * visible to guests. The spin page itself is where the auth gate lives (a guest lands there and is
 * prompted to sign in before the wheel spins), not here — showing the promo to everyone is what gets
 * a guest to sign up in the first place.
 */
export function SpinWinBanner() {
  return (
    <section className="mx-auto w-full max-w-7xl px-4 py-2 lg:px-5">
      <Link
        href="/spin-win"
        className="group relative flex flex-col items-start gap-6 overflow-hidden rounded-2xl bg-gradient-to-br from-ink via-gold-strong to-gold px-6 py-8 shadow-md transition hover:shadow-lg sm:flex-row sm:items-center sm:px-10 sm:py-9"
      >
        {/* Soft radial glow, matching the design's spin-wheel panel treatment. */}
        <div
          aria-hidden
          className="pointer-events-none absolute -right-16 -top-24 size-72 rounded-full bg-white/15 blur-2xl"
        />

        <span className="relative z-10 inline-flex shrink-0 items-center justify-center rounded-full bg-white/15 p-4 text-white">
          <Disc3 size={40} strokeWidth={1.5} aria-hidden />
        </span>

        <div className="relative z-10 flex-1">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/85">
            Spin &amp; Win
          </p>
          <h2 className="mt-2 font-display text-2xl font-semibold tracking-tight text-white sm:text-[28px]">
            Feeling lucky today?
          </h2>
          <p className="mt-2 max-w-md text-sm text-white/85">
            Spin the wheel for coupons and surprise rewards — one free spin every day.
          </p>
        </div>

        <span className="relative z-10 inline-flex shrink-0 items-center rounded-full bg-white px-6 py-3 text-sm font-medium text-ink shadow-sm transition group-hover:bg-white/90">
          Spin now
        </span>
      </Link>
    </section>
  );
}
