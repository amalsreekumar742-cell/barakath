'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

import { Constants } from '@/config/constants';
import { Button } from '@/components/Button';
import { AuthError } from '@/features/auth/components/AuthError';
import { phoneSchema, type PhoneForm } from '@/features/auth/types/schemas';

/**
 * PhoneStep — step 1: collect the 10-digit mobile number and request an OTP.
 *
 * WHY react-hook-form + zod (not manual state): the skill mandates them for every non-trivial form,
 * and they give the instant "enter a valid number" feedback and first-invalid-field focus for free.
 * WHY the `+91` is a fixed, non-editable prefix: the store is India-only (spec 2.3); the customer
 * types only the 10 national digits, and the country code is supplied to the callable from Constants.
 */
export function PhoneStep({
  submitting,
  serverError,
  onSubmit,
}: {
  submitting: boolean;
  serverError: string | null;
  onSubmit: (phone: string) => void;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<PhoneForm>({
    resolver: zodResolver(phoneSchema),
    defaultValues: { phone: '' },
  });

  const phoneReg = register('phone');

  return (
    <form
      onSubmit={handleSubmit((v) => onSubmit(v.phone))}
      className="flex flex-col gap-5"
      noValidate
    >
      <div>
        <h2 className="text-[26px] font-extrabold leading-tight tracking-tight text-foreground">
          Enter your mobile number
        </h2>
        <p className="mt-1.5 text-sm text-muted">
          We&apos;ll text you a {Constants.OTP_LENGTH}-digit code to verify.
        </p>
      </div>

      <div>
        <label htmlFor="phone" className="mb-2 block text-[13px] font-medium text-foreground">
          Mobile number
        </label>
        <div
          className={`flex items-center gap-3 rounded-lg border-2 px-4 py-3 focus-within:border-primary ${
            errors.phone ? 'border-error' : 'border-border-strong'
          }`}
        >
          <span className="border-r border-border pr-3 text-[15px] font-medium text-foreground">
            {Constants.DEFAULT_COUNTRY_CODE}
          </span>
          <input
            {...phoneReg}
            id="phone"
            type="tel"
            inputMode="numeric"
            autoComplete="tel-national"
            maxLength={Constants.PHONE_DIGITS}
            placeholder="98765 43210"
            aria-invalid={errors.phone ? true : undefined}
            // Strip anything that isn't a digit and cap length before handing the value to RHF, so a
            // pasted "+91 98765" or a stray letter can't reach validation.
            onChange={(e) => {
              e.target.value = e.target.value.replace(/\D/g, '').slice(0, Constants.PHONE_DIGITS);
              void phoneReg.onChange(e);
            }}
            className="w-full bg-transparent text-[15px] text-foreground placeholder:text-faint focus:outline-none"
          />
        </div>
        {errors.phone && (
          <p role="alert" className="mt-1 text-xs text-error">
            {errors.phone.message}
          </p>
        )}
      </div>

      <AuthError message={serverError} />

      <Button type="submit" size="lg" fullWidth loading={submitting}>
        Send OTP
      </Button>
    </form>
  );
}
