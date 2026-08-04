'use client';

import { usePathname, useRouter } from 'next/navigation';
import { Lock } from 'lucide-react';
import { Sheet } from '@/components/Sheet';
import { Button } from '@/components/Button';
import { useAppDispatch, useAppSelector } from '@/stores/store';
import { setLoginSheetOpen } from '@/stores/uiSlice';

/**
 * The guest login prompt, mirroring `apps/app/lib/core/widgets/login_prompt_sheet.dart`.
 *
 * WHY a sheet rather than an immediate redirect to /login: a guest who taps Wallet is browsing, not
 * committing. Throwing them onto a full sign-in page loses the page they were on and reads as a
 * wall; a sheet states the requirement, offers the action, and lets them dismiss it and carry on.
 * The Flutter app makes exactly this distinction, and matching it is most of why the mobile web
 * feels like the app rather than a site that keeps bouncing you to a login form.
 *
 * WHY it is mounted once in the shell and driven by `uiSlice` rather than owned by its openers:
 * several unrelated components need to raise it (the bottom nav's Wallet and Profile tabs, and in
 * later phases product cards and the wishlist heart) and they sit in different features, which may
 * not import one another.
 *
 * WHY it preserves `?next=`: it hands the login page the same contract `middleware.ts` and
 * `useRequireAuth` already use, so sign-in returns the visitor to the page they were reading
 * instead of the home page.
 */
export function LoginSheet() {
  const isOpen = useAppSelector((s) => s.ui.isLoginSheetOpen);
  const dispatch = useAppDispatch();
  const router = useRouter();
  const pathname = usePathname();

  const close = () => dispatch(setLoginSheetOpen(false));

  const goToLogin = () => {
    const search = typeof window !== 'undefined' ? window.location.search : '';
    close();
    router.push(`/login?next=${encodeURIComponent(`${pathname}${search}`)}`);
  };

  return (
    <Sheet isOpen={isOpen} onClose={close} maxWidth="max-w-md">
      <div className="flex flex-col items-center px-2 pb-2 pt-2 text-center">
        <span
          className="mb-5 inline-flex size-[72px] items-center justify-center rounded-full bg-gold/12"
          aria-hidden
        >
          <Lock className="size-[34px] text-gold-strong" />
        </span>

        <h3 className="text-lg font-bold text-foreground">Login to continue</h3>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          Sign in to use your wallet, track orders and save items to your wishlist.
        </p>

        <div className="mt-6 w-full">
          <Button fullWidth onClick={goToLogin}>
            Login
          </Button>
          <button
            type="button"
            onClick={close}
            className="mt-2 w-full rounded-md py-3 text-sm font-semibold text-muted transition hover:text-foreground"
          >
            Cancel
          </button>
        </div>
      </div>
    </Sheet>
  );
}
