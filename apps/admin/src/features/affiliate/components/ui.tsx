import { type FC, useState } from 'react';
import { AffiliateWithdrawalStatus } from '@barakath/shared/config/enums';
import Icon from '@/components/icons/Icon';

/**
 * Small presentational helpers local to the Affiliate feature (features don't import each other, so the
 * Avatar / badges are copied here rather than pulled from the customers feature). Keeps the affiliate
 * list, withdrawals table and modals rendering identifiers consistently.
 */

/** Derive up-to-2-letter initials from a name for the avatar fallback. */
const initials = (name: string): string =>
  (name || '?')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('') || '?';

/** Circular profile image with an initials fallback (40px in tables, larger in modals via `size`). */
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

/** Pending=amber, Approved=green, Rejected=red status pill for withdrawal requests (spec §1.14). */
const WITHDRAWAL_TONES: Record<string, string> = {
  [AffiliateWithdrawalStatus.PENDING]: 'bg-warning-subtle text-warning',
  [AffiliateWithdrawalStatus.APPROVED]: 'bg-success-subtle text-success',
  [AffiliateWithdrawalStatus.REJECTED]: 'bg-error-subtle text-error',
};

export const WithdrawalStatusBadge: FC<{ status: string }> = ({ status }) => (
  <span
    className={`inline-flex items-center rounded-sm px-2 py-0.5 text-[11px] font-bold ${
      WITHDRAWAL_TONES[status] ?? 'bg-subtle text-muted'
    }`}
  >
    {status}
  </span>
);

/**
 * CopyableCode — the affiliate code shown monospace with a copy button (spec §1.14 "Affiliate Code
 * (mono copyable)"). Clicking copies to the clipboard and flips the icon to a check briefly.
 * WHY stopPropagation: the code sits inside a clickable table row that navigates to the customer; the
 * copy click must not also trigger navigation.
 */
export const CopyableCode: FC<{ code: string }> = ({ code }) => {
  const [copied, setCopied] = useState(false);
  const copy = (e: React.MouseEvent) => {
    e.stopPropagation();
    void navigator.clipboard?.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="rounded-sm bg-subtle px-2 py-0.5 font-mono text-[12px] font-semibold text-foreground">
        {code}
      </span>
      <button
        type="button"
        onClick={copy}
        className="rounded-sm p-1 text-muted hover:bg-subtle hover:text-foreground"
        aria-label={copied ? 'Copied' : 'Copy code'}
        title={copied ? 'Copied' : 'Copy code'}
      >
        <Icon name={copied ? 'CheckLine' : 'Share2Line'} size={13} />
      </button>
    </span>
  );
};

/** Mask a bank account number to its last 4 digits — e.g. "•••• 4321" (spec §1.14 withdrawals table). */
export const maskAccount = (account: string): string => {
  const digits = (account || '').replace(/\s+/g, '');
  if (digits.length <= 4) return digits || '—';
  return `•••• ${digits.slice(-4)}`;
};
