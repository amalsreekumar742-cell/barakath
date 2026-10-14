import type { VariantOption } from '@barakath/shared/types';

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
  /**
   * Display label of the non-colour part. The add row passes `variantLabel(options)`, so it is blank
   * exactly when no unit has been picked; the edit row passes the variant's stored name.
   */
  name: string;
  /** One picked unit per Settings group. Absent on a legacy (single-axis) row being edited. */
  options?: VariantOption[];
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
const norm = (s: string) => s.trim().toLowerCase();

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

/** What identifies a variant row within its product: colour + the non-colour axes. */
export interface VariantIdentity {
  color: string;
  name: string;
  options?: VariantOption[];
}

/** Order-insensitive key of a set of options, e.g. "layer=2|size=57". */
const optionsKey = (options: VariantOption[]) =>
  options
    .map((o) => `${norm(o.group)}=${norm(o.value)}`)
    .sort()
    .join('|');

/**
 * Whether two rows describe the same variant — same colour and the same unit in every group.
 *
 * WHY fall back to `name` when either side lacks `options`: a legacy variant's `name` IS its only
 * axis, and a new single-group row's `name` is its one unit, so White + Size 57 picked today must
 * collide with a legacy White / "57" row. When both carry options they are compared by group AND
 * value, so rows whose labels merely read alike but sit in different groups are not confused.
 * Case-insensitive, like Settings' own colour/unit dedupe.
 */
export function isSameVariant(a: VariantIdentity, b: VariantIdentity): boolean {
  if (norm(a.color) !== norm(b.color)) return false;
  if (a.options?.length && b.options?.length) return optionsKey(a.options) === optionsKey(b.options);
  return norm(a.name) === norm(b.name);
}

/**
 * The first rule the row breaks, as a user-facing message — or null when the row is valid.
 *
 * `existing` are the product's other rows. A row matching one of them (`isSameVariant`) is refused:
 * two identical variants would split one item's stock, and the storefront's chips could only ever
 * reach the first. The edit row passes none — its colour and variant are pinned, so it cannot turn
 * into a duplicate.
 *
 * Comparisons are written as `!(a <= b)` rather than `a > b` on purpose: the negated form also fails
 * on NaN, so an unparseable value can never slip through a check by comparing false both ways.
 */
export function validateVariant(
  input: VariantFieldsInput,
  existing: readonly VariantIdentity[] = [],
): string | null {
  const { purchasePrice, mrp, offerPrice, referralPrice, commission, gstPercentage, stock } =
    parseVariantFields(input);
  if (!input.color.trim() || !input.name.trim()) return 'Color and variant are required';
  if (existing.some((v) => isSameVariant(input, v))) return 'This colour and variant already exist';
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
