import { describe, it, expect } from 'vitest';
import { filterVariantGroups, setGroupOption, selectedUnit, toggleGroupOption } from './variantPick';

const ORDER = ['Size', 'Layer'];
const size = (value: string) => ({ group: 'Size', value });
const layer = (value: string) => ({ group: 'Layer', value });

describe('setGroupOption', () => {
  it("fills a group's slot and keeps the other groups'", () => {
    expect(setGroupOption([size('57')], ORDER, 'Layer', '2')).toEqual([size('57'), layer('2')]);
  });

  it("replaces the group's existing pick rather than adding a second one", () => {
    expect(setGroupOption([size('57'), layer('2')], ORDER, 'Size', '55')).toEqual([size('55'), layer('2')]);
  });

  it('keeps Settings group order whichever group was picked first', () => {
    expect(setGroupOption([layer('2')], ORDER, 'Size', '57')).toEqual([size('57'), layer('2')]);
  });

  it('clears the group on null or a blank value', () => {
    expect(setGroupOption([size('57'), layer('2')], ORDER, 'Layer', null)).toEqual([size('57')]);
    expect(setGroupOption([size('57')], ORDER, 'Size', '  ')).toEqual([]);
  });

  it('matches the group case-insensitively, stores its Settings spelling and trims the value', () => {
    expect(setGroupOption([size('57')], ORDER, ' size ', ' 55 ')).toEqual([size('55')]);
  });

  it('sorts groups no longer in Settings after the known ones, keeping their order', () => {
    const picked = setGroupOption([{ group: 'Old', value: 'x' }, layer('1')], ORDER, 'Size', '57');
    expect(picked).toEqual([size('57'), layer('1'), { group: 'Old', value: 'x' }]);
  });

  it('does not mutate the input', () => {
    const input = [layer('2')];
    setGroupOption(input, ORDER, 'Size', '57');
    expect(input).toEqual([layer('2')]);
  });
});

describe('toggleGroupOption', () => {
  it('picks an unselected unit', () => {
    expect(toggleGroupOption([size('57')], ORDER, 'Layer', '2')).toEqual([size('57'), layer('2')]);
  });

  it("switches the group's pick to a different unit", () => {
    expect(toggleGroupOption([size('57')], ORDER, 'Size', '55')).toEqual([size('55')]);
  });

  it('clears the group when its selected unit is clicked again', () => {
    expect(toggleGroupOption([size('57'), layer('2')], ORDER, 'Size', '57')).toEqual([layer('2')]);
  });
});

describe('selectedUnit', () => {
  it("returns the group's pick, or undefined", () => {
    expect(selectedUnit([size('57'), layer('2')], 'layer')).toBe('2');
    expect(selectedUnit([size('57')], 'Layer')).toBeUndefined();
  });
});

describe('filterVariantGroups', () => {
  const GROUPS = [
    { name: 'Size', units: ['55', '57', '60'] },
    { name: 'Layer', units: ['1', '2'] },
    { name: 'Material', units: [] },
  ];

  it('returns every group with units on a blank term', () => {
    expect(filterVariantGroups(GROUPS, '  ')).toEqual(GROUPS.slice(0, 2));
  });

  it('trims each group to the matching units and drops groups with none', () => {
    expect(filterVariantGroups(GROUPS, '5')).toEqual([{ name: 'Size', units: ['55', '57'] }]);
  });

  it('keeps a whole group when its name matches, case-insensitively', () => {
    expect(filterVariantGroups(GROUPS, ' LAY')).toEqual([{ name: 'Layer', units: ['1', '2'] }]);
  });

  it('returns nothing when no unit or group matches', () => {
    expect(filterVariantGroups(GROUPS, 'xyz')).toEqual([]);
  });
});
