'use client';

import { Copy, Share2 } from 'lucide-react';
import { Button } from '@/components/Button';
import { Constants } from '@/config/constants';
import { toastError, toastSuccess } from '@/lib/toast';

/**
 * The referral-code card — code in large monospace, Copy (clipboard + toast) and Share.
 *
 * WEB_BATCH4_NOTES.md §1/§6, overriding the pasted Batch 4 prompt doc: this is deliberately
 * CODE-ONLY, no referral link, no `?ref=` middleware capture, no second Copy button. The Flutter app
 * (`referral_code_card.dart`) has no deep-link mechanism at all — its `_share()` shares plain invite
 * TEXT carrying the code, and a new signup types the code into a manual "Friend's code" field. This
 * mirrors that exactly: same invite-text pattern, Web Share API with a clipboard fallback for browsers
 * without `navigator.share` (desktop Chrome/Firefox, notably).
 */
export function ReferralCodeCard({ code }: { code: string }) {
  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(code);
      toastSuccess('Referral code copied');
    } catch {
      toastError(null, 'Could not copy the code. Please select and copy it manually.');
    }
  }

  async function handleShare() {
    const text = `Shop with ${Constants.APP_NAME} and use my referral code ${code} when you sign up.`;
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share({ text, title: `My ${Constants.APP_NAME} referral code` });
      } catch (error) {
        // A user-cancelled share throws AbortError — not a failure worth a toast.
        if (error instanceof Error && error.name === 'AbortError') return;
        toastError(error, 'Could not open the share sheet.');
      }
      return;
    }
    // No Web Share API (most desktop browsers) — fall back to copying the invite text itself.
    try {
      await navigator.clipboard.writeText(text);
      toastSuccess('Invite message copied — paste it anywhere to share');
    } catch {
      toastError(null, 'Could not copy the invite message.');
    }
  }

  return (
    <div className="rounded-2xl border border-border bg-surface p-[22px]">
      <p className="mb-3.5 font-display text-[15px] font-semibold text-foreground">Your referral</p>

      <button
        type="button"
        onClick={handleCopy}
        className="flex w-full items-center justify-between rounded-[10px] border border-dashed border-gold-border bg-gold-subtle px-3.5 py-3.5 text-left"
      >
        <span className="truncate font-mono text-base font-semibold tracking-wider text-gold-strong">
          {code}
        </span>
        <Copy size={18} className="shrink-0 text-gold-strong" aria-hidden />
      </button>

      <p className="mt-3 text-xs leading-relaxed text-muted">
        You earn a fixed commission every time someone shops with your code. It clears 7 days after the
        sale, then admin confirms it.
      </p>

      <Button variant="secondary" size="lg" fullWidth onClick={handleShare} iconLeft={<Share2 size={16} />} className="mt-3.5">
        Share link
      </Button>
    </div>
  );
}
