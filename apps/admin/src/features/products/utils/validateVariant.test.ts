import { describe, it, expect } from 'vitest';
import { validateVariant, parseVariantFields, isSameVariant, type VariantFieldsInput } from './validateVariant';

const valid: VariantFieldsInput = {
  color: 'Black',
  name: '100ml',
  purchasePrice: '400',
  mrp: '1000',
  offerPrice: '800',
  referralPrice: '700',
  commission: '50',
  gstPercentage: '18',
  stock: '12',
};

const withField = (patch: Partial<VariantFieldsInput>) => validateVariant({ ...valid, ...patch });

describe('validateVariant', () => {
  it('accepts a valid row', () => {
    expect(validateVariant(valid)).toBeNull();
  });

  it('accepts the boundary cases (equal prices, 0/100% GST, zero stock)', () => {
    expect(withField({ offerPrice: '1000', referralPrice: '1000', commission: '1000' })).toBeNull();
    expect(withField({ gstPercentage: '0' })).toBeNull();
    expect(withField({ gstPercentage: '100' })).toBeNull();
    expect(withField({ stock: '0' })).toBeNull();
  });

  it('treats blank optional fields as 0', () => {
    expect(
      withField({ purchasePrice: '', referralPrice: '', commission: '', gstPercentage: '', stock: '' }),
    ).toBeNull();
  });

  it('requires colour and variant', () => {
    expect(withField({ color: '  ' })).toBe('Color and variant are required');
    expect(withField({ name: '' })).toBe('Color and variant are required');
  });

  it('requires positive actual and selling prices', () => {
    expect(withField({ mrp: '' })).toBe('Enter actual and selling price');
    expect(withField({ offerPrice: '0' })).toBe('Enter actual and selling price');
    expect(withField({ mrp: '-5' })).toBe('Enter actual and selling price');
  });

  it('enforces Actual ≥ Selling ≥ Ref buying ≥ Commission', () => {
    expect(withField({ offerPrice: '1001' })).toBe('Selling price must be ≤ Actual');
    expect(withField({ referralPrice: '801' })).toBe('Ref buying price must be ≤ Selling price');
    expect(withField({ commission: '701' })).toBe('Commission must be ≤ Ref buying price');
  });

  it('rejects a negative purchase payment', () => {
    expect(withField({ purchasePrice: '-1' })).toBe('Purchase payment cannot be negative');
  });

  it('keeps GST within 0–100', () => {
    expect(withField({ gstPercentage: '-1' })).toBe('GST must be between 0 and 100');
    expect(withField({ gstPercentage: '101' })).toBe('GST must be between 0 and 100');
  });

  it('requires stock to be a whole number ≥ 0', () => {
    expect(withField({ stock: '2.5' })).toBe('Stock must be a whole number (0 or more)');
    expect(withField({ stock: '-1' })).toBe('Stock must be a whole number (0 or more)');
  });

  it('fails an unparseable value instead of letting it slip past a comparison', () => {
    expect(withField({ referralPrice: 'abc' })).toBe('Ref buying price must be ≤ Selling price');
    expect(withField({ stock: 'abc' })).toBe('Stock must be a whole number (0 or more)');
  });
});

describe('validateVariant — duplicates', () => {
  const DUP = 'This colour and variant already exist';
  const size = (value: string) => ({ group: 'Size', value });
  const layer = (value: string) => ({ group: 'Layer', value });
  const multi = (color: string, s: string, l: string) => ({
    color,
    name: `${s} · Layer ${l}`,
    options: [size(s), layer(l)],
  });

  it('refuses a row matching an existing multi-axis variant', () => {
    const row = { ...valid, ...multi('White', '57', '2') };
    expect(validateVariant(row, [multi('White', '57', '2')])).toBe(DUP);
  });

  it('accepts the same colour with a different unit in any group', () => {
    const existing = [multi('White', '57', '2')];
    expect(validateVariant({ ...valid, ...multi('White', '57', '1') }, existing)).toBeNull();
    expect(validateVariant({ ...valid, ...multi('White', '55', '2') }, existing)).toBeNull();
    expect(validateVariant({ ...valid, ...multi('Black', '57', '2') }, existing)).toBeNull();
  });

  it('collides a new single-group row with a legacy name-only row of the same unit', () => {
    const row = { ...valid, color: 'White', name: '57', options: [size('57')] };
    expect(validateVariant(row, [{ color: 'white', name: '57' }])).toBe(DUP);
  });

  it('compares legacy rows by colour + name, case-insensitively', () => {
    expect(validateVariant(valid, [{ color: 'black', name: '100ML' }])).toBe(DUP);
    expect(validateVariant(valid, [{ color: 'Black', name: '200ml' }])).toBeNull();
  });

  it('checks duplicates only after the required fields', () => {
    expect(validateVariant({ ...valid, name: '' }, [{ color: 'Black', name: '' }])).toBe(
      'Color and variant are required',
    );
  });
});

describe('isSameVariant', () => {
  it('ignores option order and case', () => {
    expect(
      isSameVariant(
        { color: 'White', name: '57 · Layer 2', options: [{ group: 'Size', value: '57' }, { group: 'Layer', value: '2' }] },
        { color: 'WHITE', name: 'x', options: [{ group: 'layer', value: '2' }, { group: 'size', value: '57' }] },
      ),
    ).toBe(true);
  });

  it('tells apart rows whose labels read alike but sit in different groups', () => {
    expect(
      isSameVariant(
        { color: 'White', name: '57', options: [{ group: 'Size', value: '57' }] },
        { color: 'White', name: '57', options: [{ group: 'Length', value: '57' }] },
      ),
    ).toBe(false);
  });

  it('a multi-axis row is not the same as a legacy row with only its first unit', () => {
    expect(
      isSameVariant(
        { color: 'White', name: '57 · Layer 2', options: [{ group: 'Size', value: '57' }, { group: 'Layer', value: '2' }] },
        { color: 'White', name: '57' },
      ),
    ).toBe(false);
  });
});

describe('parseVariantFields', () => {
  it('parses every numeric field and reads blanks as 0', () => {
    expect(parseVariantFields({ ...valid, commission: '', stock: ' 7 ' })).toEqual({
      purchasePrice: 400,
      mrp: 1000,
      offerPrice: 800,
      referralPrice: 700,
      commission: 0,
      gstPercentage: 18,
      stock: 7,
    });
  });
});
