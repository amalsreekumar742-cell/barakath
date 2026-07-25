/**
 * Client helpers that keep the Edge session cookie in step with the Web SDK's session.
 *
 * WHY a shared helper rather than an inline `fetch` at each call site: both the sign-in flow (which
 * must set the cookie BEFORE it redirects, or the middleware bounces the fresh session straight back
 * to /login) and the AuthListener (which keeps the cookie in sync with auth state) post the same
 * request. One helper means the cookie contract lives in exactly one place.
 */

/** POST the current ID token so `middleware.ts` sees a signed-in visitor. */
export async function postSession(idToken: string): Promise<void> {
  await fetch('/api/session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken }),
  });
}

/** Clear the session cookie on sign-out. */
export async function clearSession(): Promise<void> {
  await fetch('/api/session', { method: 'DELETE' });
}
