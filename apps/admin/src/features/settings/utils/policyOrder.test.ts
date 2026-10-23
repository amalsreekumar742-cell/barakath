import { describe, it, expect } from 'vitest';
import { comparePolicies, policyMoveChanges } from './policyOrder';

const row = (id: string, order: number, name = id) => ({ id, name, order });

describe('policyMoveChanges', () => {
  it('swaps the two neighbours when moving up', () => {
    const items = [row('a', 1), row('b', 2), row('c', 3)];
    expect(policyMoveChanges(items, 1, -1)).toEqual([
      { id: 'b', from: 2, to: 1 },
      { id: 'a', from: 1, to: 2 },
    ]);
  });

  it('swaps the two neighbours when moving down', () => {
    const items = [row('a', 1), row('b', 2), row('c', 3)];
    expect(policyMoveChanges(items, 1, 1)).toEqual([
      { id: 'b', from: 2, to: 3 },
      { id: 'c', from: 3, to: 2 },
    ]);
  });

  it('keeps admin-typed gaps by swapping values instead of renumbering', () => {
    const items = [row('a', 1), row('b', 5), row('c', 9)];
    expect(policyMoveChanges(items, 2, -1)).toEqual([
      { id: 'c', from: 9, to: 5 },
      { id: 'b', from: 5, to: 9 },
    ]);
  });

  it('is a no-op at either end of the list', () => {
    const items = [row('a', 1), row('b', 2)];
    expect(policyMoveChanges(items, 0, -1)).toEqual([]);
    expect(policyMoveChanges(items, 1, 1)).toEqual([]);
  });

  it('is a no-op for an out-of-range index or an empty list', () => {
    expect(policyMoveChanges([row('a', 1)], 5, -1)).toEqual([]);
    expect(policyMoveChanges([], 0, 1)).toEqual([]);
  });

  it('on a tie moving up, places the moved row just above its neighbour', () => {
    const items = [row('x', 1), row('a', 3), row('b', 3)];
    expect(policyMoveChanges(items, 2, -1)).toEqual([{ id: 'b', from: 3, to: 2 }]);
  });

  it('on a tie at order 1 moving up, pushes the neighbour down instead (order never drops below 1)', () => {
    const items = [row('a', 1), row('b', 1)];
    expect(policyMoveChanges(items, 1, -1)).toEqual([{ id: 'a', from: 1, to: 2 }]);
  });

  it('on a tie moving down, places the moved row just below its neighbour', () => {
    const items = [row('a', 2), row('b', 2), row('c', 7)];
    expect(policyMoveChanges(items, 0, 1)).toEqual([{ id: 'a', from: 2, to: 3 }]);
  });

  it('never changes more than two documents', () => {
    const items = [row('a', 1), row('b', 1), row('c', 2), row('d', 4)];
    for (let i = 0; i < items.length; i++) {
      expect(policyMoveChanges(items, i, -1).length).toBeLessThanOrEqual(2);
      expect(policyMoveChanges(items, i, 1).length).toBeLessThanOrEqual(2);
    }
  });

  it('actually moves the row past its neighbour once re-sorted (including ties)', () => {
    const cases: Array<[ReturnType<typeof row>[], number, -1 | 1]> = [
      [[row('a', 1), row('b', 2), row('c', 3)], 2, -1],
      [[row('a', 1), row('b', 1)], 1, -1],
      [[row('a', 4), row('b', 4)], 1, -1],
      [[row('a', 4), row('b', 4)], 0, 1],
    ];
    for (const [items, index, dir] of cases) {
      const moved = items[index]!.id;
      const neighbour = items[index + dir]!.id;
      const changes = policyMoveChanges(items, index, dir);
      const after = items
        .map((p) => ({ ...p, order: changes.find((c) => c.id === p.id)?.to ?? p.order }))
        .sort(comparePolicies)
        .map((p) => p.id);
      const movedAt = after.indexOf(moved);
      const neighbourAt = after.indexOf(neighbour);
      if (dir === -1) expect(movedAt).toBeLessThan(neighbourAt);
      else expect(movedAt).toBeGreaterThan(neighbourAt);
    }
  });
});

describe('comparePolicies', () => {
  it('sorts by order, then by name for ties', () => {
    const sorted = [row('3', 2, 'Refund'), row('1', 1, 'Terms'), row('2', 1, 'Privacy')]
      .sort(comparePolicies)
      .map((p) => p.name);
    expect(sorted).toEqual(['Privacy', 'Terms', 'Refund']);
  });
});
