import { NextResponse } from 'next/server';
import { Constants } from '@/config/constants';

/**
 * /api/session — the bridge between the Web SDK's client-side session and the Edge middleware.
 *
 * WHY this route exists at all: the Firebase Web SDK keeps its session in IndexedDB, which the Edge
 * middleware (which runs before React, with no browser) cannot see. `middleware.ts` therefore gates
 * protected routes on the PRESENCE of an httpOnly cookie, and this handler is the only thing that
 * sets or clears it — POST on sign-in, DELETE on sign-out.
 *
 * WHY no Admin SDK / no token verification here: this app deliberately ships no service account (see
 * src/app/README.md), and the cookie is a REDIRECT hint, not a security boundary — Firestore Security
 * Rules are the real gate, and they reject an unauthorised read no matter what cookie is presented.
 * Verifying the token would buy nothing the rules don't already enforce, at the cost of a secret to
 * manage. So we treat the value as an opaque presence marker and never decode it.
 */

/** Long enough to outlive a normal browsing session; the middleware only checks presence, and the
 *  AuthListener re-POSTs a fresh token on every sign-in so a live session keeps the cookie alive. */
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 14; // 14 days

/**
 * POST { idToken } — set the session cookie after `signInWithCustomToken`.
 * WHY httpOnly + sameSite lax + secure-in-prod: httpOnly keeps the value out of reach of page
 *   scripts (XSS can't read it), lax lets it ride top-level navigations (so a link into /account
 *   carries it) while blocking cross-site POSTs, and `secure` is dropped only in dev so localhost
 *   over http still works.
 */
export async function POST(request: Request): Promise<NextResponse> {
  let idToken: unknown;
  try {
    ({ idToken } = (await request.json()) as { idToken?: unknown });
  } catch {
    return NextResponse.json({ error: 'Malformed body.' }, { status: 400 });
  }

  if (typeof idToken !== 'string' || idToken.length === 0) {
    return NextResponse.json({ error: 'Missing idToken.' }, { status: 400 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set({
    name: Constants.SESSION_COOKIE,
    value: idToken,
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
  return response;
}

/**
 * DELETE — clear the session cookie on sign-out. Called by both the AuthListener (when the Web SDK
 * reports a signed-out state) and W2's logout button. Idempotent: clearing an absent cookie is fine.
 */
export async function DELETE(): Promise<NextResponse> {
  const response = NextResponse.json({ ok: true });
  response.cookies.set({
    name: Constants.SESSION_COOKIE,
    value: '',
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0, // expire immediately
  });
  return response;
}
