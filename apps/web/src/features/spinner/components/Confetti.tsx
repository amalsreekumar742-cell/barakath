'use client';

import { useMemo } from 'react';

const COLORS = ['var(--color-gold)', 'var(--color-gold-strong)', 'var(--color-primary)', 'var(--color-success)'];
const PIECE_COUNT = 24;

/**
 * A small, dependency-free confetti burst for a spin WIN (spec §2.23's "optional confetti").
 *
 * WHY hand-rolled instead of a package: nothing in `package.json` is a confetti library, and the
 * package-first policy's own escape hatch ("only build custom when nothing fits") applies — pulling in
 * a whole animation dependency for a two-second decorative flourish on one screen is not proportionate.
 * A handful of absolutely positioned pieces animated by one shared `@keyframes confetti-fall` (declared
 * once in `globals.css`, the app's design-token file, alongside the existing `fade-in` keyframe) covers
 * it with zero new dependencies. Purely decorative: no Redux, no Firestore, safe to mount/unmount freely.
 */
export function Confetti() {
  const pieces = useMemo(
    () =>
      Array.from({ length: PIECE_COUNT }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        delay: Math.random() * 300,
        duration: 1400 + Math.random() * 900,
        color: COLORS[i % COLORS.length],
      })),
    [],
  );

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {pieces.map((p) => (
        <span
          key={p.id}
          className="animate-confetti-fall absolute top-0 block h-2.5 w-1.5 rounded-xs"
          style={{
            left: `${p.left}%`,
            backgroundColor: p.color,
            animationDelay: `${p.delay}ms`,
            animationDuration: `${p.duration}ms`,
          }}
        />
      ))}
    </div>
  );
}
