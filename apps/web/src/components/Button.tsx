'use client';

import { Loader2 } from 'lucide-react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';

/**
 * The app's button.
 *
 * WHY `loading` is a prop rather than each caller rendering its own spinner: the skill requires
 * every button that triggers a server-side action to disable itself on click, show visible feedback
 * and reset in a `finally`. Building the disable-and-spin into the component means a caller cannot
 * ship the loading state by accident — it gets it by passing one boolean.
 *
 * WHY `disabled` is derived from `loading || disabled`: a button that spins but stays clickable is
 * how a customer places the same order twice.
 *
 * WHY the label stays mounted while loading (opacity 0) rather than being swapped for the spinner:
 * swapping changes the button's width mid-action, which makes the row jump under the cursor.
 */
type Variant = 'primary' | 'secondary' | 'ghost' | 'destructive';
type Size = 'sm' | 'md' | 'lg';

const VARIANT: Record<Variant, string> = {
  // Gold fill with ink text — the design's CTA. Not green: green is for links and ticks.
  primary: 'bg-gold text-ink hover:bg-gold-strong hover:text-white',
  secondary: 'border border-border-strong bg-surface text-foreground hover:bg-subtle',
  ghost: 'bg-transparent text-primary hover:bg-primary-subtle',
  destructive: 'bg-error text-white hover:brightness-95',
};

/**
 * Sizes are touch-first and shrink at `lg:`, not the other way round.
 *
 * WHY `sm` is 44px on a phone: a 36px control is below the 44px minimum the design brief sets for
 * hit targets, and `sm` is used for exactly the dense inline actions (Track, Reorder, Apply) that
 * are hardest to hit on a phone. It keeps its compact 36px on pointer devices via `lg:`.
 *
 * WHY `lg` is 52px on a phone: that is the Flutter app's primary CTA height
 * (`app_theme.dart` ElevatedButton minimumSize), and `lg` is what the sticky bottom action bars use.
 *
 * These deliberately use only the `lg:` breakpoint — never `sm:` — because this build's compiled
 * `@media` blocks are ordered by first use, not width, so mixing two breakpoints on one property
 * is unreliable. See the note in `globals.css`.
 */
const SIZE: Record<Size, string> = {
  sm: 'h-11 px-3 text-[13px] rounded-md lg:h-9',
  md: 'h-11 px-4 text-sm rounded-md',
  lg: 'h-[52px] px-6 text-base rounded-md lg:h-12 lg:rounded-lg lg:text-[15px]',
};

export interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  fullWidth?: boolean;
  iconLeft?: ReactNode;
  children: ReactNode;
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  fullWidth = false,
  iconLeft,
  disabled,
  className = '',
  children,
  ...rest
}: ButtonProps) {
  const isDisabled = loading || disabled;

  return (
    <button
      {...rest}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      className={[
        'relative inline-flex items-center justify-center gap-2 font-medium transition',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
        'disabled:cursor-not-allowed disabled:opacity-50',
        VARIANT[variant],
        SIZE[size],
        fullWidth ? 'w-full' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {loading && (
        <Loader2 className="absolute size-4 animate-spin" aria-hidden />
      )}
      <span className={loading ? 'invisible inline-flex items-center gap-2' : 'inline-flex items-center gap-2'}>
        {iconLeft}
        {children}
      </span>
    </button>
  );
}
