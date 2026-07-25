'use client';

import { Gift } from 'lucide-react';
import type { SpinnerSlotProps } from '@barakath/shared';

const SIZE = 280;
const CENTER = SIZE / 2;
const RADIUS = SIZE / 2 - 6;
const HUB_RADIUS = 30;
/** Kept in one place so `SpinWinExperience`'s `setTimeout` (which reveals the result) cannot drift
 *  from what the wheel visually does — see that file's `SPIN_DURATION_MS`. */
export const SPIN_TRANSITION_MS = 4000;

/**
 * A point on the wheel's circumference for `angleDeg`, measured CLOCKWISE from 12 o'clock — the same
 * convention `SpinWinExperience`'s landing-rotation math uses (wedge 0 starts at 12 o'clock).
 */
function pointAt(angleDeg: number, radius: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180; // shift so 0deg is 12 o'clock instead of 3 o'clock
  return { x: CENTER + radius * Math.cos(rad), y: CENTER + radius * Math.sin(rad) };
}

export interface SpinWheelProps {
  slots: SpinnerSlotProps[];
  /** Current wheel angle in degrees, clockwise — driven from the parent so this component stays dumb:
   *  it draws whatever angle it's handed and has no opinion on where it lands. The landing wedge is the
   *  SERVER's answer (`findSlotIndex`), never picked here. */
  rotationDeg: number;
}

/**
 * The prize wheel: one wedge per campaign slot, a fixed pointer at 12 o'clock, and a hub cap.
 *
 * WHY `slot.color` fills each wedge directly, not an alternating theme palette: WEB_BATCH4_NOTES.md §8
 * is explicit that each `SpinnerSlotProps` already carries its own admin-chosen `color` (hex) — using it
 * is the difference between the wheel matching what the admin configured and silently overriding it.
 *
 * WHY a CSS `transform: rotate()` transition on an SVG `<g>`, not a JS animation loop (requestAnimationFrame
 * / a tween library): the browser's own compositor handles a single CSS transition efficiently, and the
 * ~4s eased duration the spec asks for ("eased over ~4s") is exactly what `transition` + a cubic-bezier
 * easing curve already does — a JS loop would only add complexity for the same visual result.
 */
export function SpinWheel({ slots, rotationDeg }: SpinWheelProps) {
  if (slots.length === 0) return null;
  const sweep = 360 / slots.length;

  return (
    <div className="relative mx-auto" style={{ width: SIZE, height: SIZE + 16 }}>
      {/* Fixed pointer — OUTSIDE the rotating group, so it marks the winning position while the wheel
          turns under it, never rotating itself. */}
      <div className="absolute left-1/2 top-0 z-10 -translate-x-1/2">
        <svg width="28" height="22" viewBox="0 0 28 22" aria-hidden focusable="false">
          <path d="M0 0 L28 0 L14 22 Z" style={{ fill: 'var(--color-gold-strong)' }} />
        </svg>
      </div>

      <svg
        width={SIZE}
        height={SIZE}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className="absolute left-0 top-4 drop-shadow-lg"
        role="img"
        aria-label="Spin wheel"
      >
        <g
          style={{
            transform: `rotate(${rotationDeg}deg)`,
            transformOrigin: `${CENTER}px ${CENTER}px`,
            transition: `transform ${SPIN_TRANSITION_MS}ms cubic-bezier(0.33, 1, 0.68, 1)`,
          }}
        >
          {slots.map((slot, i) => {
            const start = i * sweep;
            const end = start + sweep;
            const p1 = pointAt(start, RADIUS);
            const p2 = pointAt(end, RADIUS);
            const largeArc = sweep > 180 ? 1 : 0;
            const mid = start + sweep / 2;
            const labelPos = pointAt(mid, RADIUS * 0.62);
            // Flip the label on the left half of the wheel so it never reads upside down.
            const labelRotate = mid > 90 && mid < 270 ? mid + 180 : mid;
            const label = slot.label.length > 14 ? `${slot.label.slice(0, 13)}…` : slot.label;

            return (
              <g key={slot.id}>
                <path
                  d={`M${CENTER},${CENTER} L${p1.x},${p1.y} A${RADIUS},${RADIUS} 0 ${largeArc} 1 ${p2.x},${p2.y} Z`}
                  style={{ fill: slot.color, stroke: 'rgba(255,255,255,0.35)', strokeWidth: 1.5 }}
                />
                <text
                  x={labelPos.x}
                  y={labelPos.y}
                  transform={`rotate(${labelRotate}, ${labelPos.x}, ${labelPos.y})`}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  style={{
                    fill: '#ffffff',
                    fontSize: 10,
                    fontWeight: 800,
                    paintOrder: 'stroke',
                    stroke: 'rgba(0,0,0,0.35)',
                    strokeWidth: 2,
                  }}
                >
                  {label}
                </text>
              </g>
            );
          })}
        </g>

        <circle cx={CENTER} cy={CENTER} r={RADIUS} fill="none" style={{ stroke: 'var(--color-gold)' }} strokeWidth={6} />
      </svg>

      {/* Hub cap — sits above the wedges and does not rotate, so the icon stays upright throughout. */}
      <div
        className="absolute z-10 flex items-center justify-center rounded-full bg-surface shadow-md"
        style={{
          width: HUB_RADIUS * 2,
          height: HUB_RADIUS * 2,
          left: CENTER - HUB_RADIUS,
          top: 16 + CENTER - HUB_RADIUS,
        }}
      >
        <Gift className="size-6 text-gold-strong" aria-hidden />
      </div>
    </div>
  );
}
