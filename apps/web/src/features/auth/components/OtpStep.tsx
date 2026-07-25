'use client';

import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft } from 'lucide-react';

import { Constants } from '@/config/constants';
import { Button } from '@/components/Button';
import { AuthError } from '@/features/auth/components/AuthError';
import { otpSchema, type OtpForm } from '@/features/auth/types/schemas';

/**
 * OtpStep — step 2: enter the code, with a segmented input, a change-number back link and a
 * countdown-gated resend.
 *
 * WHY a segmented (box-per-digit) input over one text field: it matches the design, makes the
 * expected length obvious at a glance, and supports paste-to-fill and auto-advance. The boxes are a
 * view over one RHF-managed `otp` string — validation and submit stay with react-hook-form.
 */
export function OtpStep({
  phone,
  submitting,
  serverError,
  resendAt,
  onVerify,
  onResend,
  onChangeNumber,
}: {
  phone: string;
  submitting: boolean;
  serverError: string | null;
  resendAt: number | null;
  onVerify: (otp: string) => void;
  onResend: () => void;
  onChangeNumber: () => void;
}) {
  const length = Constants.OTP_LENGTH;
  const {
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<OtpForm>({ resolver: zodResolver(otpSchema), defaultValues: { otp: '' } });

  const otp = watch('otp');
  const inputsRef = useRef<Array<HTMLInputElement | null>>([]);
  const remaining = useCountdown(resendAt);

  const digits = Array.from({ length }, (_, i) => otp[i] ?? '');

  /** Replace the digit at `index`, revalidate, and advance focus. */
  const setDigit = (index: number, value: string) => {
    const d = value.replace(/\D/g, '').slice(-1); // keep only the last typed digit
    const next = digits.slice();
    next[index] = d;
    setValue('otp', next.join(''), { shouldValidate: true });
    if (d && index < length - 1) inputsRef.current[index + 1]?.focus();
  };

  const onKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputsRef.current[index - 1]?.focus();
    }
  };

  /** Paste-to-fill: distribute the pasted digits across the boxes and focus the last filled one. */
  const onPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, length);
    if (!pasted) return;
    setValue('otp', pasted, { shouldValidate: true });
    inputsRef.current[Math.min(pasted.length, length - 1)]?.focus();
  };

  const canResend = remaining <= 0;

  return (
    <form onSubmit={handleSubmit((v) => onVerify(v.otp))} className="flex flex-col gap-5" noValidate>
      <div>
        <button
          type="button"
          onClick={onChangeNumber}
          className="mb-3 inline-flex items-center gap-1 text-[13px] font-bold text-primary hover:underline"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Change number
        </button>
        <h2 className="text-[26px] font-extrabold leading-tight tracking-tight text-foreground">
          Enter {length}-digit code
        </h2>
        <p className="mt-1.5 text-sm text-muted">
          Sent to {Constants.DEFAULT_COUNTRY_CODE} {phone}
        </p>
      </div>

      <div>
        {/* max-w caps the box size: the boxes are `flex-1 aspect-square`, so without a width
            ceiling they stretch to fill the whole form column and each grows as TALL as it is wide.
            Capping the row keeps them ~46px and lets them shrink on a narrow phone.

            WHY each box ALSO needs `min-w-0`: a flex item's default `min-width` is `auto`, which
            means it won't shrink below its own content's intrinsic size — and `aspect-square`
            derives that intrinsic size from the box's height (driven by its `text-2xl` glyph),
            not from the space `flex-1`/`max-w-80` allot it. Without `min-w-0` every box ignored
            the container's 320px cap and rendered at its natural ~335px square regardless,
            overflowing the row (confirmed via a computed-style check: container 320px, boxes
            335px each) — `max-w-80` alone was capping the ROW, not the boxes actually filling it. */}
        <div className="flex max-w-80 gap-2" onPaste={onPaste}>
          {digits.map((d, i) => (
            <input
              key={i}
              ref={(el) => {
                inputsRef.current[i] = el;
              }}
              value={d}
              onChange={(e) => setDigit(i, e.target.value)}
              onKeyDown={(e) => onKeyDown(i, e)}
              onFocus={(e) => e.target.select()}
              type="text"
              inputMode="numeric"
              autoComplete={i === 0 ? 'one-time-code' : 'off'}
              maxLength={1}
              aria-label={`Digit ${i + 1}`}
              className={`aspect-square min-w-0 flex-1 rounded-lg border-2 text-center text-2xl font-extrabold text-foreground focus:border-primary focus:outline-none ${
                errors.otp ? 'border-error' : d ? 'border-primary' : 'border-border-strong'
              }`}
            />
          ))}
        </div>
        {errors.otp && (
          <p role="alert" className="mt-2 text-xs text-error">
            {errors.otp.message}
          </p>
        )}
      </div>

      <AuthError message={serverError} />

      <Button type="submit" size="lg" fullWidth loading={submitting}>
        Verify &amp; continue
      </Button>

      <div className="text-[13px] text-muted">
        {canResend ? (
          <button
            type="button"
            onClick={onResend}
            disabled={submitting}
            className="font-bold text-primary hover:underline disabled:opacity-50"
          >
            Resend code
          </button>
        ) : (
          <span className="text-faint">Resend code in {formatMMSS(remaining)}</span>
        )}
      </div>
    </form>
  );
}

/**
 * Seconds remaining until `resendAt`, ticking once a second.
 * WHY a live tick rather than a static value: the design shows a running "00:24" countdown, and the
 * resend link must un-gate the instant it hits zero without the customer refreshing.
 */
function useCountdown(target: number | null): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (target === null) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [target]);
  if (target === null) return 0;
  return Math.max(0, Math.ceil((target - now) / 1000));
}

/** Format seconds as MM:SS (e.g. 24 -> "00:24"). */
function formatMMSS(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
