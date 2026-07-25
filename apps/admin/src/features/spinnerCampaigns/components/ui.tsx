import type { FC, ReactNode } from 'react';
import type { SpinnerCampaignProps } from '@barakath/shared/types';

/**
 * Small presentational building blocks shared across the spinner-campaign screens (list, form, detail),
 * so the surfaces stay visually consistent without repeating class strings.
 */

/** Standard text/number input classes for the campaign form. */
export const inputCls =
  'w-full rounded-md border border-border-strong bg-surface px-3 py-2.5 text-[14px] outline-none placeholder:text-faint focus:border-primary focus:ring-2 focus:ring-primary/20';

/** A titled white card that wraps a form section / detail block. */
export const Card: FC<{ title?: string; children: ReactNode; className?: string }> = ({
  title,
  children,
  className,
}) => (
  <div className={`rounded-xl border border-border bg-surface p-5 shadow-sm ${className ?? ''}`}>
    {title && <h2 className="mb-4 text-[15px] font-bold text-foreground">{title}</h2>}
    {children}
  </div>
);

/** A labelled field wrapper (label above, input/children below, optional error). */
export const Field: FC<{ label: string; error?: string; children: ReactNode }> = ({
  label,
  error,
  children,
}) => (
  <div>
    <label className="mb-1.5 block text-[13px] font-semibold text-foreground">{label}</label>
    {children}
    {error && <p className="mt-1 text-[12px] text-error">{error}</p>}
  </div>
);

/**
 * Toggle — pill switch copied per the feature rules from settings/components/ui.tsx (features may not
 * import another feature's files). Optional `loading` swaps the knob for a spinner via the parent.
 */
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

/** True when the campaign's window has ended (endDate at or before now). */
export const isEnded = (c: SpinnerCampaignProps): boolean => c.endDate.toMillis() <= Date.now();

/**
 * campaignStatus — the computed display status + badge classes (spec F13): Active green (isActive &&
 * endDate>now), Ended gray (isActive && endDate<=now), Inactive red (!isActive).
 */
export function campaignStatus(c: SpinnerCampaignProps): { label: string; cls: string } {
  if (!c.isActive) return { label: 'Inactive', cls: 'bg-error-subtle text-error' };
  if (isEnded(c)) return { label: 'Ended', cls: 'bg-subtle text-muted' };
  return { label: 'Active', cls: 'bg-success-subtle text-success' };
}

/** Status pill (small) used in the list Status column. */
export const StatusBadge: FC<{ campaign: SpinnerCampaignProps }> = ({ campaign }) => {
  const { label, cls } = campaignStatus(campaign);
  return <span className={`inline-flex rounded-pill px-2.5 py-1 text-[11px] font-bold ${cls}`}>{label}</span>;
};

/**
 * Slot-type badge (Coupon = brand primary, Better luck = neutral) — used in the detail slots table.
 * WHY primary tokens (not raw purple): the design associates reward offers with the brand colour, and
 * the app's convention is @theme token pairs only (bg-*-subtle / text-*) — never Tailwind palette hexes.
 */
export const TypeBadge: FC<{ type: 'Coupon' | 'Better luck' }> = ({ type }) => (
  <span
    className={`inline-flex rounded-pill px-2.5 py-1 text-[11px] font-bold ${
      type === 'Coupon' ? 'bg-primary-subtle text-primary' : 'bg-subtle text-muted'
    }`}
  >
    {type}
  </span>
);
