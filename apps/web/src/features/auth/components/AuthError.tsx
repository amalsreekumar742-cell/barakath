import { AlertCircle } from 'lucide-react';

/**
 * AuthError — the inline banner for a server-side auth error (a failed send, a wrong OTP, a save
 * failure) shown above the step's action.
 *
 * WHY a shared banner rather than each step styling its own: the web skill and the Field primitive
 * both insist an error looks the same everywhere, or it reads as a different kind of problem. This is
 * for the SLICE error (a callable's result); per-field validation errors stay on the fields.
 */
export function AuthError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div
      role="alert"
      className="flex items-start gap-2 rounded-md border border-error/30 bg-error-subtle px-3 py-2.5 text-sm text-error"
    >
      <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
      <span>{message}</span>
    </div>
  );
}
