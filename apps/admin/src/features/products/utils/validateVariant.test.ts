import { describe, it, expect } from 'vitest';
import { validateVariant, parseVariantFields, type VariantFieldsInput } from './validateVariant';

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
