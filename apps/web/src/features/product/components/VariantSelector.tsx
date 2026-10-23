'use client';

import { useId, useMemo, type ReactNode } from 'react';
import {
  COLOUR_AXIS,
  chipState as sharedChipState,
  variantAxisList,
  type ChipState,
  type VariantAxesSource,
} from '@barakath/shared/utils/variantOptions';

type SelectorVariant = VariantAxesSource & { colorCode: string };

export interface VariantSelectorProps {
  /** In the admin's display order — every chip row follows it (first-seen order). */
  variants: SelectorVariant[];
  /** The current variant's axis values, keyed by axis name (`COLOUR_AXIS` for the colour). */
  selection: Record<string, string>;
  onSelect: (axis: string, value: string) => void;
}

/**
 * Chip states come from the shared `chipState` (each row judged against the rows above it — the same
 * rule the Flutter app uses): `available`, `elsewhere` (in stock, just not with the rows above —
 * greyed yet tappable, and the tap moves the other rows to it) and `soldOut` (no in-stock variant has
 * the value; disabled, as before).
 *
 * WHY the middle state: with more than one option axis, "greyed = disabled" strands the shopper — on
 * Layer 3, a size that only exists in Layer 2 could never be reached without first guessing the right
 * Layer. For a single-colour single-axis product it cannot occur, so those chips behave as they always have.
 */
const HINT: Record<Exclude<ChipState, 'available'>, string> = {
  elsewhere: 'unavailable with your current selection',
  soldOut: 'out of stock',
};

/**
 * The variant chip rows of the product page: a colour-swatch row, then one row per option axis
 * (Size, Layer, …) labelled with the axis name from the data. A row only renders when it offers a
 * real choice (more than one value). Stateless — `ProductExperience` owns the selection and resolves
 * a tap to a real variant via `resolveVariant`.
 */
export function VariantSelector({ variants, selection, onSelect }: VariantSelectorProps) {
  const colors = useMemo(
    () => Array.from(new Map(variants.map((v) => [v.color, v.colorCode])).entries()),
    [variants],
  );
  const axisRows = useMemo(
    () => variantAxisList(variants).filter((row) => row.values.length > 1),
    [variants],
  );

  const chipState = (axis: string, value: string): ChipState =>
    sharedChipState(variants, selection, axis, value);

  return (
    <>
      {colors.length > 1 && (
        // Kept as "Color" (not COLOUR_AXIS's "Colour") — the storefront's existing copy.
        <AxisRow label="Color" value={selection[COLOUR_AXIS]} className="mt-6" chipsClassName="gap-2.5">
          {colors.map(([color, colorCode]) => {
            const state = chipState(COLOUR_AXIS, color);
            const selected = color === selection[COLOUR_AXIS];
            const label = state === 'available' ? color : `${color} — ${HINT[state]}`;
            return (
              <button
                key={color}
                type="button"
                disabled={state === 'soldOut'}
                onClick={() => onSelect(COLOUR_AXIS, color)}
                aria-pressed={selected}
                aria-label={label}
                title={label}
                className={`relative size-9 rounded-full border-2 transition disabled:cursor-not-allowed ${
                  state === 'available' ? '' : 'opacity-35'
                } ${selected ? 'border-primary' : 'border-border-strong'}`}
                style={{ backgroundColor: colorCode || '#ccc' }}
              />
            );
          })}
        </AxisRow>
      )}

      {axisRows.map(({ axis, values }) => (
        <AxisRow
          key={axis}
          label={axis}
          value={selection[axis]}
          className="mt-5"
          chipsClassName="gap-2"
        >
          {values.map((value) => {
            const state = chipState(axis, value);
            const selected = value === selection[axis];
            return (
              <button
                key={value}
                type="button"
                disabled={state === 'soldOut'}
                onClick={() => onSelect(axis, value)}
                aria-pressed={selected}
                title={state === 'available' ? undefined : `${value} — ${HINT[state]}`}
                className={`h-10 rounded-md border px-4 text-sm font-medium transition disabled:cursor-not-allowed ${
                  state === 'available' ? '' : 'opacity-35 line-through'
                } ${
                  selected
                    ? 'border-primary bg-primary-subtle text-primary'
                    : 'border-border-strong text-foreground hover:bg-subtle'
                }`}
              >
                {value}
                {state !== 'available' && <span className="sr-only"> — {HINT[state]}</span>}
              </button>
            );
          })}
        </AxisRow>
      ))}
    </>
  );
}

/**
 * One labelled chip row. The chips sit in a `role="group"` named by the axis alone, so a screen reader
 * announces "Layer, 2" rather than a bare "2" — with several numeric rows the value means nothing
 * without its axis. The current value beside the label mirrors the app's variant selector, so the
 * choice reads at a glance without scanning for the highlighted chip.
 */
function AxisRow({
  label,
  value,
  className,
  chipsClassName,
  children,
}: {
  label: string;
  value: string | undefined;
  className: string;
  chipsClassName: string;
  children: ReactNode;
}) {
  const labelId = useId();
  return (
    <div className={className}>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">
        <span id={labelId}>{label}</span>
        {value && (
          <span className="ml-2 font-medium normal-case tracking-normal text-foreground">{value}</span>
        )}
      </p>
      <div role="group" aria-labelledby={labelId} className={`mt-2 flex flex-wrap ${chipsClassName}`}>
        {children}
      </div>
    </div>
  );
}
