/**
 * Small formatting helpers shared by every affiliate-wallet row (Batch 4, D4).
 *
 * WHY not `AffiliateFormat` (Flutter's 2-decimal money formatter): `TransactionRow`/`StatCard` and
 * every other account-area screen on the website already render money through
 * `formatInr` (`@/components/catalog/PriceBlock`, 0 decimals, `en-IN` lakh/crore grouping) — matching
 * THAT convention keeps a commission amount reading identically to every other rupee figure on this
 * site, rather than introducing a second money format only this one feature uses.
 */

/** "••4821" — the only form a bank account number is ever allowed to render in. */
export function maskAccountNumber(accountNumber: string): string {
  const digits = accountNumber.trim();
  return digits.length <= 4 ? digits : `••${digits.slice(-4)}`;
}

/**
 * The commission ledger's internal `status` value ('Pending' | 'Cleared' | 'Withdrawn') maps to a
 * customer-facing label. "Cleared" is internal vocabulary (see `functions/src/growth/
 * clearAffiliateCommissions.ts`) — an affiliate looking at their earnings reads "Confirmed" instead,
 * exactly matching Flutter's `CommissionStatusX.label` and spec §3.16's own wording ("no Commission
 * Adjustment, no percentage" — but Pending/Confirmed IS the expected vocabulary).
 *
 * WHY this alone is enough to also fix the status pill's colour: `StatusBadge`'s `toneForStatus` already
 * treats `'confirmed'` (case-insensitive) as positive — the same tone `'cleared'` would have mapped to —
 * so passing the mapped label straight into `<StatusBadge status={...} />` gets the right colour for
 * free, with no separate tone override needed.
 */
export function commissionStatusLabel(status: string): string {
  return status === 'Cleared' ? 'Confirmed' : status;
}
