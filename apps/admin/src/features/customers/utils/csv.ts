/**
 * Shared CSV-download primitives — the escape rule and Blob/anchor download are identical across every
 * export in this app (customers list, orders, payments); each of those still owns its own headers/query
 * since the data shape differs, but a 4th+ near-identical copy of just this boilerplate isn't worth it.
 */
export const escapeCSV = (v: string | number): string => {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function downloadCSV(headers: string[], rows: string[][], filename: string): void {
  const lines = [headers.join(','), ...rows.map((r) => r.map(escapeCSV).join(','))];
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
