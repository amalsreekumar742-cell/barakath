'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signOut } from 'firebase/auth';
import { AlertTriangle } from 'lucide-react';
import { auth } from '@/lib/firebaseConfig';
import { Button } from '@/components/Button';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { toastError, toastSuccess } from '@/lib/toast';
// `signedOut` comes from the root store's public surface (same import the header's `useLogout` hook
// uses), not the auth feature directly — avoids a cross-feature import for a component that lives at
// the app/route layer.
import { useAppDispatch, signedOut } from '@/stores/store';
import { anonymiseAccount } from './deleteAccount';

/**
 * Danger zone — Delete account (spec 3.19). Confirmation dialog with explicit permanence copy, NO
 * reason field. On confirm: anonymise (see `deleteAccount.ts` — mirrors `apps/app` exactly, including
 * its known `status` gap per WEB_BATCH4_NOTES.md §2), THEN sign out.
 *
 * WHY the sign-out sequence is inlined here instead of calling `useLogout()`: `useLogout` shows its
 * own "Signed out" toast and always navigates home — stacking it after this component's own "Your
 * account has been deleted" toast would show two toasts for one action. The three steps below are the
 * exact same sequence `useLogout` performs (clear the session cookie → sign out of the Web SDK → reset
 * every Redux slice), just under this screen's own single success toast.
 *
 * WHY anonymise MUST fully resolve before any sign-out step runs: mirrors Flutter's own ordering
 * (`profile_provider.dart`'s `deleteAccount()` awaits the anonymise use case, only THEN calls
 * `logout()`) — signing out first would tear down the very auth context the anonymising writes still
 * need (`isOwner(userId)` in `firestore.rules` requires `request.auth.uid == userId`).
 */
export function DangerZone({ uid }: { uid: string }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const dispatch = useAppDispatch();
  const router = useRouter();

  async function handleConfirmDelete() {
    setLoading(true);
    try {
      await anonymiseAccount(uid);

      await fetch('/api/session', { method: 'DELETE', credentials: 'same-origin' });
      await signOut(auth);
      dispatch(signedOut());

      toastSuccess('Your account has been deleted.');
      router.push('/');
    } catch (e) {
      toastError(e, 'Could not delete your account. Please try again.');
    } finally {
      setLoading(false);
      setOpen(false);
    }
  }

  return (
    <div className="rounded-xl border border-error/30 bg-error-subtle p-5">
      <div className="flex items-center gap-2 text-error">
        <AlertTriangle size={18} aria-hidden />
        <h2 className="font-display text-lg font-extrabold">Danger zone</h2>
      </div>
      <p className="mt-2 text-sm text-muted">
        Deleting your account permanently erases your name, email, WhatsApp number, profile photo and
        wishlist from Barakath. This cannot be undone.
      </p>
      <Button variant="destructive" className="mt-4" onClick={() => setOpen(true)}>
        Delete account
      </Button>

      <ConfirmDialog
        isOpen={open}
        title="Delete your account?"
        description="This permanently erases your profile info and wishlist. This action cannot be undone — there is no way to recover your account afterwards."
        confirmLabel="Delete account"
        cancelLabel="Cancel"
        destructive
        loading={loading}
        onConfirm={handleConfirmDelete}
        onClose={() => {
          if (!loading) setOpen(false);
        }}
      />
    </div>
  );
}
