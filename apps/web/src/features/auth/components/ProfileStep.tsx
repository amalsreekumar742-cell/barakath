'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

import { Button } from '@/components/Button';
import { Input } from '@/components/form/Field';
import { AuthError } from '@/features/auth/components/AuthError';
import { profileSchema, type ProfileForm } from '@/features/auth/types/schemas';

/**
 * ProfileStep — step 3, new users only: the essentials merged into the already-created user doc.
 *
 * WHY only `fullName` is required and the rest optional: the design frames this as "just the
 * essentials — you can skip", and the account works with an empty profile (verifyOTP created the doc).
 * WHY a "Skip for now": forcing the form would abandon a customer who just proved their phone — the
 * doc already exists, so skipping simply proceeds to their destination.
 */
export function ProfileStep({
  phone,
  submitting,
  serverError,
  onSubmit,
  onSkip,
}: {
  phone: string;
  submitting: boolean;
  serverError: string | null;
  onSubmit: (form: ProfileForm) => void;
  onSkip: () => void;
}) {
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    defaultValues: { fullName: '', email: '', whatsapp: phone, referredBy: '' },
  });

  const name = (watch('fullName') ?? '').trim();
  const initial = name ? name.charAt(0).toUpperCase() : 'B';

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
      <div>
        <h1 className="text-[26px] font-semibold leading-tight tracking-tight text-foreground">
          Create your profile
        </h1>
        <p className="mt-1.5 text-sm text-muted">
          Just the essentials — you can skip and do this later.
        </p>
      </div>

      <div className="flex justify-center">
        <div className="flex size-[88px] items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary-dark text-3xl font-semibold text-white">
          {initial}
        </div>
      </div>

      <Input
        label="Display name"
        required
        placeholder="Your name"
        autoComplete="name"
        error={errors.fullName?.message}
        {...register('fullName')}
      />
      <Input
        label="WhatsApp number"
        type="tel"
        inputMode="numeric"
        placeholder="98765 43210"
        error={errors.whatsapp?.message}
        {...register('whatsapp')}
      />
      <Input
        label="Friend's code"
        hint="Optional — enter a referral code if you have one."
        placeholder="MIRA-7Q2K"
        error={errors.referredBy?.message}
        {...register('referredBy')}
      />
      <Input
        label="Email address"
        type="email"
        placeholder="you@email.com"
        autoComplete="email"
        error={errors.email?.message}
        {...register('email')}
      />

      <AuthError message={serverError} />

      <div className="mt-1 flex flex-col gap-2">
        <Button type="submit" size="lg" fullWidth loading={submitting}>
          Enter Barakath
        </Button>
        <button
          type="button"
          onClick={onSkip}
          disabled={submitting}
          className="py-1 text-center text-sm font-medium text-primary hover:underline disabled:opacity-50"
        >
          Skip for now
        </button>
      </div>
    </form>
  );
}
