/**
 * A readable message for a failed `httpsCallable` — the server's own HttpsError text when it sent one.
 *
 * WHY not just `err.message`: the Functions SDK fills the message with the bare status code when the
 * server sent no text of its own — "internal" for an unreachable/undeployed function, "PERMISSION_DENIED"
 * when the body carried only a status. Shown in a toast those read as gibberish, so a code-only message
 * is swapped for a sentence; a real HttpsError message ("Only a Pending order can be cancelled.") is
 * passed through untouched, because the server's wording is the most specific thing we have.
 */
const CODE_MESSAGES: Record<string, string> = {
  'permission-denied': 'You do not have permission to do this.',
  unauthenticated: 'Your session has expired — sign in again.',
  unavailable: 'The server could not be reached — check your connection and try again.',
  'deadline-exceeded': 'The server took too long to respond — refresh to see whether it went through.',
};

export function callableErrorMessage(err: unknown, fallback: string): string {
  if (!(err instanceof Error)) return fallback;
  const rawCode = (err as { code?: unknown }).code;
  const code = typeof rawCode === 'string' ? rawCode.replace(/^functions\//, '') : '';
  const message = err.message.trim();
  // "PERMISSION_DENIED" / "internal" — the SDK's default text, i.e. no message from the server.
  const isCodeOnly = !message || message.toLowerCase().replace(/_/g, '-') === code;
  if (!isCodeOnly) return message;
  return CODE_MESSAGES[code] ?? fallback;
}
