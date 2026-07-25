'use client';

import { forwardRef, useId } from 'react';
import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
} from 'react';

/**
 * Form primitives, built to be handed straight to `react-hook-form`'s `register()`.
 *
 * WHY they forward refs: `register()` returns a `ref` that RHF needs on the real DOM node to read
 * values and focus the first invalid field. A wrapper that swallows the ref turns every one of
 * these into an uncontrolled input RHF cannot see.
 *
 * WHY the error message is rendered here rather than by each form: an error that appears in a
 * different place or style on each screen reads as a different kind of problem. Wiring
 * `aria-describedby` and `aria-invalid` once also means no form has to remember the accessibility.
 *
 * WHY there is no `<Slider>` in this file: the filter sidebar needs a DUAL-handle range, which a
 * native `<input type="range">` cannot do — two overlaid ranges need their own pointer logic and
 * z-index handling. W4 owns it as a feature component, sitting next to the sidebar that is its only
 * consumer, rather than as a shared primitive with one caller.
 */

/** The label / error / hint frame shared by every control below. */
function FieldShell({
  id,
  label,
  error,
  hint,
  required,
  children,
}: {
  id: string;
  label?: string;
  error?: string;
  hint?: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="w-full">
      {label && (
        <label htmlFor={id} className="mb-1.5 block text-[13px] font-bold text-foreground">
          {label}
          {required && <span className="ml-0.5 text-error">*</span>}
        </label>
      )}
      {children}
      {error ? (
        <p id={`${id}-error`} role="alert" className="mt-1 text-xs text-error">
          {error}
        </p>
      ) : (
        hint && (
          <p id={`${id}-hint`} className="mt-1 text-xs text-muted">
            {hint}
          </p>
        )
      )}
    </div>
  );
}

const CONTROL =
  'w-full rounded-md border bg-surface px-3 py-2.5 text-sm text-foreground placeholder:text-faint ' +
  'focus:outline-2 focus:outline-offset-0 focus:outline-primary disabled:cursor-not-allowed disabled:opacity-60';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, error, hint, id, className = '', required, ...rest },
  ref,
) {
  const generated = useId();
  const fieldId = id ?? generated;

  return (
    <FieldShell id={fieldId} label={label} error={error} hint={hint} required={required}>
      <input
        {...rest}
        id={fieldId}
        ref={ref}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${fieldId}-error` : hint ? `${fieldId}-hint` : undefined}
        className={`${CONTROL} ${error ? 'border-error' : 'border-border-strong'} ${className}`}
      />
    </FieldShell>
  );
});

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  hint?: string;
  options: { value: string; label: string }[];
}

/**
 * A NATIVE select — correct here, and only here.
 *
 * WHY native is acceptable: the skill bans `<select>` for a GROWABLE option pool (categories,
 * products) because such a list must be cursor-paginated with a "View More", which a native select
 * cannot host. This component is for small, fixed, curated sets — sort order, country code, a
 * withdrawal reason. Anything that grows with the catalogue needs the paginated dropdown instead.
 */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, error, hint, id, className = '', required, options, ...rest },
  ref,
) {
  const generated = useId();
  const fieldId = id ?? generated;

  return (
    <FieldShell id={fieldId} label={label} error={error} hint={hint} required={required}>
      <select
        {...rest}
        id={fieldId}
        ref={ref}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${fieldId}-error` : hint ? `${fieldId}-hint` : undefined}
        className={`${CONTROL} ${error ? 'border-error' : 'border-border-strong'} ${className}`}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </FieldShell>
  );
});

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: ReactNode;
  /** e.g. the product count beside a sub-category in the filter sidebar. */
  trailing?: ReactNode;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  { label, trailing, id, className = '', ...rest },
  ref,
) {
  const generated = useId();
  const fieldId = id ?? generated;

  return (
    <div className="flex items-center gap-2.5">
      <input
        {...rest}
        type="checkbox"
        id={fieldId}
        ref={ref}
        className={`size-4 shrink-0 accent-primary ${className}`}
      />
      <label htmlFor={fieldId} className="flex-1 cursor-pointer text-sm text-foreground">
        {label}
      </label>
      {trailing && <span className="text-xs text-faint">{trailing}</span>}
    </div>
  );
});

export interface RadioGroupProps {
  name: string;
  label?: string;
  value: string | null;
  options: { value: string; label: ReactNode }[];
  onChange: (value: string) => void;
}

/**
 * WHY this one is controlled rather than ref-forwarded like the others: a radio GROUP is a single
 * logical value spread across several inputs, and the rating filter it exists for lives in Redux,
 * not in a form. Callers inside a react-hook-form can wrap it in RHF's `<Controller>`.
 */
export function RadioGroup({ name, label, value, options, onChange }: RadioGroupProps) {
  return (
    <fieldset>
      {label && (
        <legend className="mb-1.5 text-[13px] font-bold text-foreground">{label}</legend>
      )}
      <div className="space-y-2">
        {options.map((o) => (
          <label key={o.value} className="flex cursor-pointer items-center gap-2.5 text-sm">
            <input
              type="radio"
              name={name}
              value={o.value}
              checked={value === o.value}
              onChange={() => onChange(o.value)}
              className="size-4 shrink-0 accent-primary"
            />
            <span className="text-foreground">{o.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
