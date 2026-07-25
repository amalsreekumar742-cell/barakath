/**
 * CSV helpers for report exports (spec §1.22 "CSV format for all data exports").
 *
 * WHY a shared helper (not per-report inline): every report exports the same way — RFC-4180 quoting +
 * a Blob download — so the escaping rule lives in one place and can't drift between reports.
 */

/** Quote a value only when it contains a comma, quote, or newline; double internal quotes. */
export function csvEscape(value: string | number | null | undefined): string {
  const s = String(value ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Build a CSV string from a header row + data rows (each already a flat array of cells). */
export function toCsv(headers: string[], rows: (string | number)[][]): string {
  const lines = [headers.map(csvEscape).join(',')];
  for (const row of rows) lines.push(row.map(csvEscape).join(','));
  return lines.join('\n');
}

/**
 * Trigger a browser download of a CSV string.
 * WHY object-URL + anchor click (not a server round-trip): the report data is already in memory on the
 * client, so we assemble the file locally and hand the browser a Blob URL — no upload/download hop.
 */
export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
