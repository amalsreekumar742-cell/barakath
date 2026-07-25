import type { CSSProperties } from 'react';

/**
 * CHART_COLORS — the ONE documented exception to the "no inline hex / tokens-only" rule for this
 * feature (mirrors the spinner-wheel slot-colors exception).
 *
 * WHY real hex strings (not Tailwind tokens): recharts paints series through the `fill`/`stroke` SVG
 * attributes and `<Cell>` — it needs concrete color strings at runtime, and cannot resolve Tailwind
 * utility classes. These values are drawn from the app's @theme palette (primary green, gold, info
 * blue, success, error) plus a few extra distinct hues so a many-slice pie/legend stays readable.
 *
 * USE ONLY for recharts `fill` / `stroke` / `<Cell>`. Everything else in the feature uses @theme tokens.
 */
export const CHART_COLORS = [
  '#0f7a5a', // primary green
  '#daa227', // gold
  '#005aa5', // info blue
  '#16a34a', // success green
  '#fb3748', // error red
  '#7c3aed', // violet (extra)
  '#0891b2', // cyan (extra)
  '#ea580c', // orange (extra)
] as const;

/** Shared recharts tooltip styling so every chart's tooltip looks identical (design: hairline card). */
export const TOOLTIP_STYLE: CSSProperties = {
  borderRadius: 8,
  border: '1px solid #ececec',
  fontSize: 12,
};

/** Axis tick styling reused across charts (muted grey, small). */
export const AXIS_TICK = { fontSize: 11, fill: '#7f7f7f' };
