'use client';

import { useState } from 'react';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { useLogout } from '@/hooks/useLogout';

/**
 * LogoutDialog — spec §3.23's "Log out?" confirmation, opened from the account sidebar's Logout item.
 *
 * WHY built here rather than imported: the Batch 4 brief assumed a "LogoutDialog" already existed
 * (from W2) and should be reused as-is. It does not. The header's `AccountMenu` — the only other
 * sign-out entry point on the site — calls `useLogout()` straight from its menu item with NO
 * confirmation step at all, which is itself a gap against spec §3.23 (every destructive/irreversible
 * action needs a confirm dialog, spec §3.25). That gap is pre-existing and out of this session's file
 * scope (`AccountMenu.tsx` is not under `src/features/account/`) — flagged for the Batch 4 close-out
 * doc rather than fixed here. The two pieces that DO already exist and are genuinely reusable —
 * `ConfirmDialog` (the one dialog every destructive action goes through) and `useLogout` (the one
 * sign-out sequence: clear the session cookie, sign out of the Web SDK, wipe every Redux slice) — are
 * simply wired together with spec §3.23's copy.
 *
 * WHY the dialog always closes after the attempt, success or failure: `useLogout` never rejects — it
 * catches its own errors and shows a toast, then returns normally either way. On success it also
 * navigates to `/` and resets every slice, which unmounts this dialog's tree regardless; on failure
 * the toast is the feedback, and the customer can simply reopen this dialog from the sidebar to retry.
 */
export function LogoutDialog({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const logout = useLogout();
  const [loading, setLoading] = useState(false);

  async function handleConfirm() {
    setLoading(true);
    try {
      await logout();
    } finally {
      setLoading(false);
      onClose();
    }
  }

  return (
    <ConfirmDialog
      isOpen={isOpen}
      title="Log out?"
      description="You'll need to verify your mobile number again to sign back in."
      confirmLabel="Log out"
      cancelLabel="Cancel"
      destructive
      loading={loading}
      onConfirm={handleConfirm}
      onClose={onClose}
    />
  );
}
