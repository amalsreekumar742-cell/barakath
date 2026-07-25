import { Constants } from '@/config/constants';

/**
 * BrandingPanel — the left column of the two-column login screen (spec 3.3 / design).
 *
 * WHY hidden below `lg`: the design runs a full-height branding panel beside the form on desktop, but
 * on a phone the form should own the whole viewport — a decorative panel there would push the actual
 * inputs below the fold. So it renders only at `lg` and up; mobile gets the form full-bleed.
 *
 * WHY tokens compose the dark gradient instead of the design's raw hex: the skill forbids inline hex.
 * `bg-ink` is the near-black brand surface and a blurred `bg-gold` glow reproduces the design's warm
 * radial without a one-off colour literal.
 */
export function BrandingPanel() {
  return (
    <div className="relative hidden flex-1 flex-col justify-center overflow-hidden bg-ink px-16 py-12 lg:flex">
      {/* Warm gold glow, bottom-left — the design's radial highlight, built from a token. */}
      <div
        className="pointer-events-none absolute -bottom-24 -left-20 size-96 rounded-full bg-gold/25 blur-3xl"
        aria-hidden
      />
      <div className="relative z-10">
        <span className="mb-8 block text-3xl font-extrabold tracking-tight text-white">
          {Constants.APP_NAME}
        </span>
        <h1 className="max-w-md text-[44px] font-extrabold leading-[1.1] tracking-tight text-white">
          Premium finds, <span className="text-gold">handpicked for you</span>
        </h1>
        <p className="mt-5 max-w-sm text-base leading-relaxed text-white/70">
          Sign in with your mobile number — no passwords. Perfumes, books, clothing and Islamic
          essentials await.
        </p>
      </div>
    </div>
  );
}
