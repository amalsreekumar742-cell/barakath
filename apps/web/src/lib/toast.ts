import toast from 'react-hot-toast';

/**
 * The app's toast helpers.
 *
 * WHY wrappers rather than calling `react-hot-toast` directly at each site: the duration and styling
 * of a success and an error should not be a decision each screen makes. An error also needs longer
 * on screen than a success — the customer has to read it and often act on it — and that difference
 * gets lost the moment forty call sites each pass their own options.
 *
 * WHY errors accept a fallback: a Cloud Function's own message is written for the customer ("Only 2
 * left of Royal Oud Intense"), so it should win. But a raw SDK error is a Firebase console URL or a
 * stack trace, which must never reach a customer. Callers pass what they want said when there is
 * nothing better to say.
 */
export function toastSuccess(message: string) {
  toast.success(message, { duration: 3000 });
}

/**
 * @param error   whatever was caught — an Error, a string, or an unknown from a rejected thunk
 * @param fallback what to show when `error` carries nothing worth showing a customer
 */
export function toastError(error: unknown, fallback = 'Something went wrong. Please try again.') {
  toast.error(readableMessage(error) ?? fallback, { duration: 5000 });
}

/**
 * Pull a customer-facing message out of an unknown error, or null when there isn't one.
 *
 * WHY the URL check: Firebase SDK errors frequently embed a console link ("The query requires an
 * index. You can create it here: https://console.firebase.google.com/…"). That is a message for a
 * developer, and showing it both confuses the customer and advertises the project's console URL.
 * Anything containing a link is treated as a diagnostic and suppressed in favour of the fallback.
 */
export function readableMessage(error: unknown): string | null {
  const raw =
    typeof error === 'string'
      ? error
      : error instanceof Error
        ? error.message
        : typeof (error as { message?: unknown })?.message === 'string'
          ? ((error as { message: string }).message)
          : null;

  if (!raw) return null;
  const trimmed = raw.trim();
  if (trimmed.length === 0) return null;
  if (/https?:\/\//i.test(trimmed)) return null;
  return trimmed;
}
