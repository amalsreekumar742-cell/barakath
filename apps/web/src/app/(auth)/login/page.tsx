'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

import { useAppSelector } from '@/stores/store';
import { BrandingPanel } from '@/features/auth/components/BrandingPanel';
import { PhoneStep } from '@/features/auth/components/PhoneStep';
import { OtpStep } from '@/features/auth/components/OtpStep';
import { ProfileStep } from '@/features/auth/components/ProfileStep';
import { useAuthFlow } from '@/features/auth/hooks/useAuthFlow';
import { sanitizeNext } from '@/features/auth/utils/redirect';

/**
 * Login — the full-bleed two-column auth screen (spec 3.3). The (auth) layout already strips the
 * storefront header/footer, so this owns the whole viewport: branding panel left, form right.
 *
 * WHY a Suspense boundary: the flow reads `useSearchParams()` (for `?next=`), which Next.js requires
 * be wrapped in Suspense so the rest of the route can still prerender. The boundary is invisible in
 * practice — this is a client screen that hydrates instantly.
 */
export default function LoginPage() {
  return (
    <div className="flex min-h-screen">
      <BrandingPanel />
      <div className="flex flex-1 items-center justify-center px-6 py-12 sm:px-10">
        <div className="w-full max-w-[440px]">
          <Suspense fallback={null}>
            <LoginFlow />
          </Suspense>
        </div>
      </div>
    </div>
  );
}

/**
 * The step machine, driven entirely by `authSlice.otpStep`. Kept separate from the page shell so the
 * `useSearchParams` it depends on (via the flow hook) sits inside the Suspense boundary above.
 */
function LoginFlow() {
  const flow = useAuthFlow();
  const router = useRouter();
  const searchParams = useSearchParams();
  const isAuthenticated = useAppSelector((s) => s.auth.isAuthenticated);

  // A visitor who is already signed in has no business on the phone form (e.g. they clicked a stale
  // "Login" link). Send them on. The profile step is exempt — a brand-new user IS authenticated
  // while still filling it in, and must not be bounced away mid-flow.
  useEffect(() => {
    if (isAuthenticated && flow.otpStep === 'phone') {
      router.replace(sanitizeNext(searchParams.get('next')));
    }
  }, [isAuthenticated, flow.otpStep, router, searchParams]);

  if (flow.otpStep === 'otp') {
    return (
      <OtpStep
        phone={flow.otpPhone}
        submitting={flow.submitting}
        serverError={flow.error}
        resendAt={flow.resendAt}
        onVerify={flow.verifyOtp}
        onResend={flow.resendOtp}
        onChangeNumber={flow.changeNumber}
      />
    );
  }

  if (flow.otpStep === 'profile') {
    return (
      <ProfileStep
        phone={flow.otpPhone}
        submitting={flow.submitting}
        serverError={flow.error}
        onSubmit={flow.saveProfile}
        onSkip={flow.skipProfile}
      />
    );
  }

  return (
    <PhoneStep submitting={flow.submitting} serverError={flow.error} onSubmit={flow.sendOtp} />
  );
}
