import type { FC } from 'react';
import { StockStatus } from '@barakath/shared/config/enums';

/**
 * StockStatusBadge — the stock-status pill for inventory (design §08): In stock = green, Low = gold,
 * Out = red. WHY short labels: the design shows "In stock" / "Low" / "Out" (not the full enum values),
 * so the pill maps the status to its short label while keeping the enum as the source of truth.
 */
const TONES: Record<string, string> = {
  [StockStatus.IN_STOCK]: 'bg-success-subtle text-success',
  [StockStatus.LOW_STOCK]: 'bg-gold-subtle text-gold-strong',
  [StockStatus.OUT_OF_STOCK]: 'bg-error-subtle text-error',
};

const LABELS: Record<string, string> = {
  [StockStatus.IN_STOCK]: 'In stock',
  [StockStatus.LOW_STOCK]: 'Low',
  [StockStatus.OUT_OF_STOCK]: 'Out',
};

const StockStatusBadge: FC<{ status: string }> = ({ status }) => (
  <span
    className={`inline-flex items-center rounded-md px-2 py-1 text-[11px] font-bold ${
      TONES[status] ?? 'bg-subtle text-muted'
    }`}
  >
    {LABELS[status] ?? status}
  </span>
);

export default StockStatusBadge;
