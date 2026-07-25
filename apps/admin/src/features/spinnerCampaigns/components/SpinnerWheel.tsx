import { type FC, useMemo } from 'react';
import { sliceAngles } from '../utils/slots';

/**
 * One wheel slot as far as the visualisation cares — the full SpinnerSlotProps also works structurally.
 * Kept minimal so both the live form draft and a persisted campaign can be passed in.
 */
export interface WheelSlot {
  label: string;
  probability: number;
  color: string;
}

interface SpinnerWheelProps {
  slots: WheelSlot[];
  /** Rendered pixel size of the square SVG. */
  size?: number;
}

/** Convert a polar coordinate (degrees, from wheel centre) to an SVG x/y on a unit-100 viewBox. */
function polar(cx: number, cy: number, r: number, angleDeg: number): { x: number; y: number } {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

/**
 * SpinnerWheel — a self-contained SVG pie/conic rendering of a campaign's wheel (spec F13: build a
 * self-contained SVG wheel — no external chart lib). Each wedge's SWEEP is proportional to its slot
 * probability (computed via sliceAngles), filled with the slot's color, with the label drawn along the
 * wedge's mid-angle. WHY SVG over a canvas/library: it's declarative, crisp at any size, theme-independent,
 * and needs zero dependencies — the whole preview re-renders reactively as the form's slots change.
 */
const SpinnerWheel: FC<SpinnerWheelProps> = ({ slots, size = 260 }) => {
  const R = 50; // radius on the 0..100 viewBox
  const C = 50; // centre

  // Precompute each wedge's path + label placement; recomputed only when slots change.
  const wedges = useMemo(() => {
    const angles = sliceAngles(slots);
    return slots.map((slot, i) => {
      const { start, end, mid } = angles[i]!; // one angle entry per slot (same length)
      const sweep = end - start;
      const p1 = polar(C, C, R, start);
      const p2 = polar(C, C, R, end);
      // largeArcFlag=1 when the wedge spans more than 180° (SVG arc rule).
      const largeArc = sweep > 180 ? 1 : 0;
      // A full-circle single slot (≈360°) can't be drawn as one arc — fall back to a full circle.
      const isFull = sweep >= 359.999;
      const path = isFull
        ? ''
        : `M ${C} ${C} L ${p1.x.toFixed(3)} ${p1.y.toFixed(3)} A ${R} ${R} 0 ${largeArc} 1 ${p2.x.toFixed(3)} ${p2.y.toFixed(3)} Z`;
      // Label sits partway out along the mid-angle so it reads inside its wedge.
      const labelPos = polar(C, C, R * 0.62, mid);
      return { key: i, path, isFull, color: slot.color, label: slot.label, labelPos, probability: slot.probability };
    });
  }, [slots]);

  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      role="img"
      aria-label="Spinner wheel preview"
      className="max-w-full"
    >
      {/* Outer ring */}
      <circle cx={C} cy={C} r={R} fill="none" stroke="currentColor" strokeWidth={0.6} className="text-border-strong" />

      {wedges.map((w) =>
        w.isFull ? (
          <circle key={w.key} cx={C} cy={C} r={R} fill={w.color} stroke="#ffffff" strokeWidth={0.4} />
        ) : (
          <path key={w.key} d={w.path} fill={w.color} stroke="#ffffff" strokeWidth={0.4} />
        ),
      )}

      {/* Labels — only drawn for wedges wide enough to fit text (>= ~6% of the wheel). */}
      {wedges.map((w) =>
        w.probability >= 6 ? (
          <text
            key={`t-${w.key}`}
            x={w.labelPos.x}
            y={w.labelPos.y}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize={3.4}
            fontWeight={700}
            fill="#ffffff"
            style={{ paintOrder: 'stroke', pointerEvents: 'none' }}
          >
            {w.label.length > 12 ? `${w.label.slice(0, 11)}…` : w.label}
          </text>
        ) : null,
      )}

      {/* Hub */}
      <circle cx={C} cy={C} r={6} fill="#ffffff" stroke="currentColor" strokeWidth={0.6} className="text-border-strong" />
      {/* Pointer at the top (12 o'clock), where the first wedge starts. */}
      <polygon points="50,2 46.5,9 53.5,9" fill="currentColor" className="text-foreground" />
    </svg>
  );
};

export default SpinnerWheel;
