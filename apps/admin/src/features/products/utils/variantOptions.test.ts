import { describe, it, expect } from 'vitest';
import {
  COLOUR_AXIS,
  LEGACY_AXIS,
  chipState,
  isComboAvailable,
  resolveVariant,
  variantAxisList,
  variantLabel,
} from '@barakath/shared/utils/variantOptions';

// The shared multi-axis rules (packages/shared has no test runner, so they are exercised here). The
// Flutter app mirrors these in variant_options.dart — keep the cases in step if either changes.

const v = (id: string, color: string, size: string, layer: string | null, stock = 5) => ({
  id,
  color,
  stock,
  name: layer ? `${size} · Layer ${layer}` : size,
  options: layer ? [{ group: 'Size', value: size }, { group: 'Layer', value: layer }] : undefined,
});

describe('variantLabel', () => {
  it('shows the first axis bare and prefixes the rest with their group', () => {
    expect(variantLabel([{ group: 'Size', value: '57' }, { group: 'Layer', value: '2' }])).toBe('57 · Layer 2');
    expect(variantLabel([{ group: 'Size', value: '57' }])).toBe('57');
  });
});

describe('variantAxisList', () => {
  it('lists axes and values in first-seen order', () => {
    const rows = variantAxisList([v('a', 'White', '57', '2'), v('b', 'White', '55', '1'), v('c', 'White', '57', '1')]);
    expect(rows).toEqual([
      { axis: 'Size', values: ['57', '55'] },
      { axis: 'Layer', values: ['2', '1'] },
    ]);
  });

  it('treats a legacy variant name as the single Size axis', () => {
    expect(variantAxisList([v('a', 'White', '51', null), v('b', 'White', '57', null)])).toEqual([
      { axis: LEGACY_AXIS, values: ['51', '57'] },
    ]);
  });
});

describe('resolveVariant', () => {
  const variants = [
    v('57-1', 'White', '57', '1'),
    v('57-2', 'White', '57', '2'),
    v('55-2', 'White', '55', '2'),
    v('55-3', 'White', '55', '3', 0),
  ];

  it('returns the exact match', () => {
    expect(resolveVariant(variants, { [COLOUR_AXIS]: 'White', Size: '55', Layer: '2' })?.id).toBe('55-2');
  });

  it('keeps the tapped value and moves the other axis when the combination does not exist', () => {
    // On 57 · Layer 1, tap Size 55 — 55 has no Layer 1, so land on an in-stock 55.
    expect(resolveVariant(variants, { [COLOUR_AXIS]: 'White', Size: '55', Layer: '1' }, 'Size')?.id).toBe('55-2');
  });

  it('prefers an in-stock variant over an out-of-stock exact neighbour', () => {
    // Tap Layer 3: only 55 · Layer 3 has it (out of stock) — still the one with the tapped value.
    expect(resolveVariant(variants, { [COLOUR_AXIS]: 'White', Size: '57', Layer: '3' }, 'Layer')?.id).toBe('55-3');
  });

  it('resolves legacy single-axis variants by name', () => {
    const legacy = [v('51', 'White', '51', null), v('57', 'White', '57', null)];
    expect(resolveVariant(legacy, { [COLOUR_AXIS]: 'White', [LEGACY_AXIS]: '57' })?.id).toBe('57');
  });

  it('returns undefined only for an empty list', () => {
    expect(resolveVariant([], { [COLOUR_AXIS]: 'White' })).toBeUndefined();
  });
});

describe('chipState (each row judged against the rows above it)', () => {
  const variants = [
    v('w57-1', 'White', '57', '1'),
    v('w55-2', 'White', '55', '2'),
    v('b58-1', 'Black', '58', '1'),
    v('w56-3', 'White', '56', '3', 0),
  ];
  const sel = { [COLOUR_AXIS]: 'White', Size: '57', Layer: '1' };

  it('never dims a colour because of the size or layer the shopper is on', () => {
    expect(chipState(variants, sel, COLOUR_AXIS, 'Black')).toBe('available');
  });

  it('judges Size against the chosen colour only', () => {
    expect(chipState(variants, sel, 'Size', '55')).toBe('available'); // White 55 exists, any layer
    expect(chipState(variants, sel, 'Size', '58')).toBe('elsewhere'); // only in Black
    expect(chipState(variants, sel, 'Size', '56')).toBe('soldOut'); // no stock anywhere
  });

  it('judges Layer against colour and size', () => {
    expect(chipState(variants, sel, 'Layer', '1')).toBe('available');
    expect(chipState(variants, sel, 'Layer', '2')).toBe('elsewhere'); // White 57 has no Layer 2
  });
});

describe('isComboAvailable', () => {
  const variants = [v('57-1', 'White', '57', '1'), v('55-2', 'White', '55', '2'), v('55-3', 'White', '55', '3', 0)];
  const sel = { [COLOUR_AXIS]: 'White', Size: '55', Layer: '2' };

  it('is true when an in-stock variant keeps every other selection', () => {
    expect(isComboAvailable(variants, sel, 'Layer', '2')).toBe(true);
  });

  it('is false for an out-of-stock or non-existent combination', () => {
    expect(isComboAvailable(variants, sel, 'Layer', '3')).toBe(false); // 55 · Layer 3 has no stock
    expect(isComboAvailable(variants, sel, 'Layer', '1')).toBe(false); // 55 · Layer 1 doesn't exist
  });
});
