/**
 * Variant row validation for the product form (spec §1.5: Actual ≥ Selling ≥ Ref buying ≥ Commission).
 *
 * WHY one pure function for both rows: the inline "add" row and the in-place "edit" row take the same
 * fields, and a variant must satisfy the same rules however it got its prices. Two copies of these
 * checks would drift the first time either row changed.
 *
 * Input is the RAW input strings, exactly as the rows hold them. Blank optional fields read as 0 (the
 * add row's long-standing behaviour); Actual/Selling are required, so blank fails them.
 */
export interface VariantFieldsInput {
  color: string;
  name: string;
  purchasePrice: string;
  mrp: string;
  offerPrice: string;
  referralPrice: string;
  commission: string;
  gstPercentage: string;
  stock: string;
}

export interface ParsedVariantFields {
  purchasePrice: number;
  mrp: number;
  offerPrice: number;
  referralPrice: number;
  commission: number;
  gstPercentage: number;
  stock: number;
}

const num = (raw: string) => Number(raw.trim() || 0);

export function parseVariantFields(input: VariantFieldsInput): ParsedVariantFields {
  return {
    purchasePrice: num(input.purchasePrice),
    mrp: num(input.mrp),
    offerPrice: num(input.offerPrice),
    referralPrice: num(input.referralPrice),
    commission: num(input.commission),
    gstPercentage: num(input.gstPercentage),
    stock: num(input.stock),
  };
}

/**
 * The first rule the row breaks, as a user-facing message — or null when the row is valid.
 *
 * Comparisons are written as `!(a <= b)` rather than `a > b` on purpose: the negated form also fails
 * on NaN, so an unparseable value can never slip through a check by comparing false both ways.
 */
export function validateVariant(input: VariantFieldsInput): string | null {
  const { purchasePrice, mrp, offerPrice, referralPrice, commission, gstPercentage, stock } =
    parseVariantFields(input);
  if (!input.color.trim() || !input.name.trim()) return 'Color and variant are required';
  if (!(mrp > 0) || !(offerPrice > 0)) return 'Enter actual and selling price';
  if (!(offerPrice <= mrp)) return 'Selling price must be ≤ Actual';
  if (!(referralPrice <= offerPrice)) return 'Ref buying price must be ≤ Selling price';
  if (!(commission <= referralPrice)) return 'Commission must be ≤ Ref buying price';
  if (!(purchasePrice >= 0)) return 'Purchase payment cannot be negative';
  if (!(gstPercentage >= 0 && gstPercentage <= 100)) return 'GST must be between 0 and 100';
  // Stock is a unit count: a fractional or negative value would be stored as-is and break the
  // per-unit decrement every order does.
  if (!Number.isInteger(stock) || stock < 0) return 'Stock must be a whole number (0 or more)';
  return null;
}
