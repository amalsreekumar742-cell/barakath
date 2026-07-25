'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * PriceRangeSlider — the dual-handle price range. Built from scratch per the prompt's instruction
 * (no range-slider package in the repo, and `src/components/form/Field.tsx` explicitly leaves a
 * `<Slider>` OUT of the shared form primitives for this exact reason — "the filter sidebar needs a
 * DUAL-handle range... W4 owns it as a feature component, sitting next to the sidebar that is its only
 * consumer"). No new dependency is added.
 *
 * HOW two native range inputs make one slider: two `<input type="range">` share the same bounds and
 * sit stacked in the same box (absolute-positioned, transparent track). Each is independently
 * draggable, keyboard-operable (arrow keys, Tab-focusable) and screen-reader labelled — a real
 * accessible control, not a custom pointer-math widget. `pointer-events` on the track is set to `none`
 * so clicks fall through to whichever thumb is on top; the thumb itself re-enables `pointer-events`
 * via `[&::-webkit-slider-thumb]:pointer-events-auto`. The filled bar between the two handles is a
 * plain absolutely-positioned div computed from both values.
 *
 * WHY local state + a commit callback rather than pushing the URL on every `onChange`: a drag fires
 * `onChange` dozens of times a second — routing on every tick would spam `router.push` and hammer the
 * server component with re-renders mid-drag. Local state renders the thumb/label instantly; the commit
 * (a URL push) fires once, on pointer-up/touch-end (mouse/touch drags) and via a short debounce
 * (keyboard arrow-key adjustments, which have no pointer-up event).
 */
export interface PriceRangeSliderProps {
  bounds: { min: number; max: number };
  value: { min: number; max: number };
  onCommit: (value: { min: number; max: number }) => void;
}

/**
 * Shared Tailwind arbitrary-variant chain for both native thumbs (WebKit + Firefox need separate
 * pseudo-elements; there is no cross-browser single selector). `pointer-events-auto` on the thumb is
 * what makes it draggable even though the input's own track has `pointer-events-none` above.
 */
const THUMB_CLASS =
  '[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:pointer-events-auto ' +
  '[&::-webkit-slider-thumb]:size-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-surface ' +
  '[&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-primary [&::-webkit-slider-thumb]:cursor-pointer ' +
  '[&::-webkit-slider-thumb]:shadow [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:size-4 ' +
  '[&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-surface [&::-moz-range-thumb]:border-2 ' +
  '[&::-moz-range-thumb]:border-primary [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:shadow';

export function PriceRangeSlider({ bounds, value, onCommit }: PriceRangeSliderProps) {
  const [local, setLocal] = useState(value);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // A filter cleared elsewhere (e.g. "Clear all") or a fresh page load must re-sync local state.
  // WHY deps are the PRIMITIVE min/max, not `value` itself: the caller passes a new object literal
  // every render, so depending on the object reference would re-sync (and fight the in-drag `local`
  // state) on every keystroke of an unrelated control, not just when the committed range changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => setLocal(value), [value.min, value.max]);

  const { min: boundMin, max: boundMax } = bounds;
  const span = Math.max(1, boundMax - boundMin);

  function scheduleCommit(next: { min: number; max: number }) {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => onCommit(next), 500);
  }

  function commitNow(next: { min: number; max: number }) {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    onCommit(next);
  }

  function onMinChange(raw: number) {
    const next = { min: Math.min(raw, local.max), max: local.max };
    setLocal(next);
    scheduleCommit(next);
  }

  function onMaxChange(raw: number) {
    const next = { min: local.min, max: Math.max(raw, local.min) };
    setLocal(next);
    scheduleCommit(next);
  }

  const leftPct = ((local.min - boundMin) / span) * 100;
  const rightPct = ((local.max - boundMin) / span) * 100;

  return (
    <div>
      <div className="relative h-5">
        <div className="absolute top-1/2 h-[5px] w-full -translate-y-1/2 rounded-full bg-border-strong" />
        <div
          className="absolute top-1/2 h-[5px] -translate-y-1/2 rounded-full bg-primary"
          style={{ left: `${leftPct}%`, right: `${100 - rightPct}%` }}
        />
        <input
          type="range"
          aria-label="Minimum price"
          min={boundMin}
          max={boundMax}
          value={local.min}
          onChange={(e) => onMinChange(Number(e.target.value))}
          onMouseUp={() => commitNow(local)}
          onTouchEnd={() => commitNow(local)}
          className={`pointer-events-none absolute inset-0 w-full appearance-none bg-transparent ${THUMB_CLASS}`}
        />
        <input
          type="range"
          aria-label="Maximum price"
          min={boundMin}
          max={boundMax}
          value={local.max}
          onChange={(e) => onMaxChange(Number(e.target.value))}
          onMouseUp={() => commitNow(local)}
          onTouchEnd={() => commitNow(local)}
          className={`pointer-events-none absolute inset-0 w-full appearance-none bg-transparent ${THUMB_CLASS}`}
        />
      </div>
      <div className="mt-2 flex items-center justify-between text-xs font-semibold text-muted">
        <span>₹{local.min.toLocaleString('en-IN')}</span>
        <span>₹{local.max.toLocaleString('en-IN')}</span>
      </div>
    </div>
  );
}
