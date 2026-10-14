import { describe, it, expect } from 'vitest';
import { planVariantStock, type StockPlanVariant } from './planVariantStock';

const existing = (id: string, stock: number, originalStock: number): StockPlanVariant => ({
  id,
  isNew: false,
  stock,
  originalStock,
});

describe('planVariantStock', () => {
  it('does not write an untouched stock and totals the LIVE value', () => {
    // Loaded at 10; an order took one while the form was open, so live is 9.
    const plan = planVariantStock([existing('a', 10, 10)], new Map([['a', 9]]));
    expect(plan.writeStock.has('a')).toBe(false);
    expect(plan.changes).toEqual([]);
    expect(plan.totalStock).toBe(9);
  });

  it('writes and audits a changed stock against the live value', () => {
    const plan = planVariantStock([existing('a', 15, 10)], new Map([['a', 9]]));
    expect(plan.writeStock.get('a')).toBe(15);
    expect(plan.changes).toEqual([{ variantId: 'a', previousStock: 9, newStock: 15 }]);
    expect(plan.totalStock).toBe(15);
  });

  it('always writes a new variant’s stock, without an audit', () => {
    const plan = planVariantStock([{ id: 'tmp', isNew: true, stock: 4 }], new Map());
    expect(plan.writeStock.get('tmp')).toBe(4);
    expect(plan.changes).toEqual([]);
    expect(plan.totalStock).toBe(4);
  });

  it('skips a change that already equals the live stock', () => {
    const plan = planVariantStock([existing('a', 9, 10)], new Map([['a', 9]]));
    expect(plan.writeStock.has('a')).toBe(false);
    expect(plan.changes).toEqual([]);
    expect(plan.totalStock).toBe(9);
  });

  it('mixes untouched, changed and new variants into one total', () => {
    const plan = planVariantStock(
      [existing('a', 10, 10), existing('b', 0, 5), { id: 'tmp', isNew: true, stock: 3 }],
      new Map([
        ['a', 8],
        ['b', 4],
      ]),
    );
    expect([...plan.writeStock.entries()]).toEqual([
      ['b', 0],
      ['tmp', 3],
    ]);
    expect(plan.changes).toEqual([{ variantId: 'b', previousStock: 4, newStock: 0 }]);
    expect(plan.totalStock).toBe(8 + 0 + 3);
  });

  it('diffs an existing variant with no originalStock against live', () => {
    const plan = planVariantStock([{ id: 'a', isNew: false, stock: 6 }], new Map([['a', 2]]));
    expect(plan.writeStock.get('a')).toBe(6);
    expect(plan.changes).toEqual([{ variantId: 'a', previousStock: 2, newStock: 6 }]);
  });
});
