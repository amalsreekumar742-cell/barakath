import type { FC } from 'react';
import { UserStatus, WalletTransactionType } from '@barakath/shared/config/enums';
import Icon from '@/components/icons/Icon';
import { formatINR } from '@/utils/format';

/**
 * Small presentational helpers shared by the customer screens — an initials-fallback avatar and the
 * Active/Blocked status pill — so the list, detail header and tabs render them identically.
 */

/** Derive up-to-2-letter initials from a name for the avatar fallback. */
const initials = (name: string): string =>
  (name || '?')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('') || '?';

/**
 * Avatar — circular profile image with an initials fallback (design: warm-neutral circle). Used at
 * 40px in the list and 80px in the detail header via the `size` prop.
 */
export const Avatar: FC<{ src?: string; name: string; size?: number }> = ({ src, name, size = 40 }) => {
  const dim = { width: size, height: size };
  if (src) {
    return (
      <img
        src={src}
        alt={name}
        style={dim}
        className="shrink-0 rounded-full border border-border object-cover"
      />
    );
  }
  return (
    <span
      style={dim}
      className="flex shrink-0 items-center justify-center rounded-full bg-primary-subtle font-bold text-primary"
    >
      <span style={{ fontSize: Math.round(size * 0.36) }}>{initials(name)}</span>
    </span>
  );
};

/** Active (green) / Blocked (red) status pill (spec §1.8). */
export const CustomerStatusBadge: FC<{ status: string }> = ({ status }) => {
  const tone =
    status === UserStatus.BLOCKED ? 'bg-error-subtle text-error' : 'bg-success-subtle text-success';
  return (
    <span className={`inline-flex items-center rounded-sm px-2 py-0.5 text-[11px] font-bold ${tone}`}>
      {status}
    </span>
  );
};

/** Credit (green ▲) / Debit (red ▼) type indicator for the wallet + affiliate ledgers (spec §1.8). */
export const TxnTypeCell: FC<{ type: string }> = ({ type }) => {
  const credit = type === WalletTransactionType.CREDIT;
  return (
    <span className={`inline-flex items-center gap-1 text-[13px] font-semibold ${credit ? 'text-success' : 'text-error'}`}>
      <Icon name={credit ? 'ArrowUpLine' : 'ArrowDownLine'} size={13} />
      {type}
    </span>
  );
};

/** Signed ₹ amount, green for credit and red for debit (spec §1.8 ledgers). */
export const TxnAmount: FC<{ type: string; amount: number }> = ({ type, amount }) => {
  const credit = type === WalletTransactionType.CREDIT;
  return (
    <span className={`text-[13px] font-semibold ${credit ? 'text-success' : 'text-error'}`}>
      {credit ? '+' : '-'}
      {formatINR(amount)}
    </span>
  );
};

/** Neutral source pill (Refund / Reward / Admin / Referral / …) — one style for both ledgers. */
export const SourceBadge: FC<{ source: string }> = ({ source }) => (
  <span className="inline-flex items-center rounded-sm bg-subtle px-2 py-0.5 text-[11px] font-bold text-muted">
    {source}
  </span>
);

/** Pill toggle switch (copied per the feature rules from settings/components/ui.tsx). */
export const Toggle: FC<{ on: boolean; onChange: (v: boolean) => void; label?: string; disabled?: boolean }> = ({
  on,
  onChange,
  label,
  disabled,
}) => (
  <button
    type="button"
    onClick={() => !disabled && onChange(!on)}
    disabled={disabled}
    className={`inline-flex items-center gap-2.5 ${disabled ? 'cursor-not-allowed opacity-60' : ''}`}
  >
    <span
      className={`relative h-6 w-11 shrink-0 rounded-pill transition-colors ${on ? 'bg-primary' : 'bg-border-strong'}`}
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-all ${on ? 'left-[22px]' : 'left-0.5'}`}
      />
    </span>
    {label && <span className="text-[14px] font-medium text-foreground">{label}</span>}
  </button>
);
