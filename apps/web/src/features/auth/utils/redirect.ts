/**
 * sanitizeNext — clamp a `?next=` value to a safe same-origin path.
 *
 * WHY: the parameter is attacker-controllable, so allowing `//evil.com` or `https://evil.com` would
 * turn the login screen into an open redirect. Only a value that starts with a single `/` (a path on
 * this site) is honoured; anything else falls back to the home page. Shared by the flow (post-login
 * redirect) and the login page (already-signed-in redirect) so the rule lives in one place.
 */
export function sanitizeNext(raw: string | null): string {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//')) return '/';
  return raw;
}
