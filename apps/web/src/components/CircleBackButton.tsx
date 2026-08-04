'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

/**
 * The 42px circular back button the Flutter app puts on every pushed screen
 * (`apps/app/lib/core/widgets/circle_back_button.dart`).
 *
 * WHY three tones rather than one: the same control sits on three very different backgrounds — a
 * plain page, a full-bleed product photo, and the dark Spin & Win screen. A single white-on-hairline
 * treatment disappears against a light product image and glares on the dark screen.
 *
 * WHY `href` is optional: most screens want true "back" (`router.back()`), but a page reachable by
 * deep link — a shared product URL opened cold — has no history to go back to, and would strand the
 * visitor on a dead button. Passing `href` gives those screens a defined destination instead.
 */
export type CircleBackTone = 'surface' | 'onImage' | 'onDark';

const TONE: Record<CircleBackTone, string> = {
  surface: 'bg-surface border border-border text-foreground',
  onImage: 'bg-surface/90 text-foreground backdrop-blur',
  onDark: 'bg-white/12 text-white',
};

export interface CircleBackButtonProps {
  /** Navigate here instead of popping history. Use on deep-linkable screens. */
  href?: string;
  tone?: CircleBackTone;
  label?: string;
  className?: string;
}

export function CircleBackButton({
  href,
  tone = 'surface',
  label = 'Go back',
  className = '',
}: CircleBackButtonProps) {
  const router = useRouter();
  const shared = `inline-flex size-[42px] shrink-0 items-center justify-center rounded-full transition active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${TONE[tone]} ${className}`;

  if (href) {
    return (
      <Link href={href} aria-label={label} className={shared}>
        <ArrowLeft className="size-5" aria-hidden />
      </Link>
    );
  }

  return (
    <button type="button" onClick={() => router.back()} aria-label={label} className={shared}>
      <ArrowLeft className="size-5" aria-hidden />
    </button>
  );
}
