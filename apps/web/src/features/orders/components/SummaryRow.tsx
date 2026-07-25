/**
 * One "Label ... value" row — the KeyValueRow-style primitive the brief asks for, shared by Order
 * Detail's price/payment summaries and the Invoice's Part 7 blocks so both screens render the same row
 * shape for the same kind of figure (spec 3.11 §2 and §5 both ask for this exact pattern).
 */
export interface SummaryRowProps {
  label: string;
  value: string;
  /** 'discount' = green (a deduction from the total); 'total' = large + gold (the final figure). */
  emphasis?: 'discount' | 'total';
}

export function SummaryRow({ label, value, emphasis }: SummaryRowProps) {
  return (
    <div className="flex items-center justify-between py-1.5 text-sm">
      <span className={emphasis === 'total' ? 'font-semibold text-foreground' : 'text-muted'}>{label}</span>
      <span
        className={
          emphasis === 'total'
            ? 'font-display text-lg font-semibold text-gold-strong'
            : emphasis === 'discount'
              ? 'font-medium text-success'
              : 'font-medium text-foreground'
        }
      >
        {value}
      </span>
    </div>
  );
}
