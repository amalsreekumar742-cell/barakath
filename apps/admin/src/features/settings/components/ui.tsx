import type { FC, ReactNode } from 'react';
import Icon from '@/components/icons/Icon';

/**
 * Small presentational building blocks shared by every Settings tab, so the six tabs stay visually
 * consistent (design: white cards, warm neutrals, primary accents) without repeating class strings.
 */

/** Standard text/number input classes for the settings forms. */
export const inputCls =
  'w-full rounded-md border border-border-strong bg-surface px-3 py-2 text-[14px] text-foreground placeholder:text-faint transition-colors focus:border-primary focus:outline-none';

/** A titled white card that wraps a tab's fields. */
export const SettingsCard: FC<{ title: string; description?: string; children: ReactNode }> = ({
  title,
  description,
  children,
}) => (
  <section className="rounded-xl border border-border bg-surface p-6 shadow-sm">
    <h2 className="text-[16px] font-bold tracking-tight text-foreground">{title}</h2>
    {description && <p className="mt-1 text-[13px] text-muted">{description}</p>}
    <div className="mt-5">{children}</div>
  </section>
);

/** A labelled field wrapper (label above, input/children below). */
export const Field: FC<{ label: string; hint?: string; children: ReactNode }> = ({
  label,
  hint,
  children,
}) => (
  <label className="block">
    <span className="mb-1.5 block text-[13px] font-semibold text-foreground">{label}</span>
    {children}
    {hint && <span className="mt-1 block text-[12px] text-faint">{hint}</span>}
  </label>
);

/** Pill toggle switch (matches the product form's Status/Replacement toggles). */
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

/** The Save button used at the foot of every tab (spec §1.21 — each tab saves independently). */
export const SaveButton: FC<{ onClick: () => void; loading: boolean; disabled?: boolean; label?: string }> = ({
  onClick,
  loading,
  disabled,
  label = 'Save changes',
}) => (
  <button
    type="button"
    onClick={onClick}
    disabled={loading || disabled}
    className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-[14px] font-semibold text-white transition-colors hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-50"
  >
    {loading && <Icon name="Loader4Line" size={16} className="animate-spin" />}
    {label}
  </button>
);
