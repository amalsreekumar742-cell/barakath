import { NextResponse, type NextRequest } from 'next/server';
import { Constants } from '@/config/constants';

/**
 * Route guard for everything that needs a signed-in customer.
 *
 * WHY a cookie and not Firebase auth state: middleware runs on the Edge, before React, with no
 * access to the Web SDK's in-memory session. W3 sets an httpOnly session cookie from a route handler
 * after `signInWithCustomToken`, and this reads it.
 *
 * WHY only presence is checked, not validity: verifying a Firebase ID token needs the Admin SDK,
 * which this app deliberately does not have (see src/app/README.md). That is fine, because this
 * check is a REDIRECT, not a security boundary — the actual protection is Firestore Security Rules,
 * which reject an unauthorised read no matter what cookie the browser presents. A forged cookie buys
 * an attacker an empty account page, nothing more. Never move a real authorisation decision here.
 *
 * WHY absence is treated as "guest" rather than an error: W3 owns setting the cookie, and until it
 * lands every protected route must still redirect cleanly rather than throw.
 *
 * WHY `next` is carried through: sending someone to /login and then dumping them on the home page
 * loses whatever they were trying to do. W3's flow must preserve this parameter all the way through
 * the new-user profile step.
 */
const PROTECTED_PREFIXES = [
  '/account',
  '/checkout',
  '/wishlist',
  '/spin-win',
] as const;

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  const needsAuth = PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
  if (!needsAuth) return NextResponse.next();

  const hasSession = Boolean(request.cookies.get(Constants.SESSION_COOKIE)?.value);
  if (hasSession) return NextResponse.next();

  const loginUrl = new URL('/login', request.url);
  loginUrl.searchParams.set('next', `${pathname}${search}`);
  return NextResponse.redirect(loginUrl);
}

/**
 * WHY an explicit matcher rather than running on every request: middleware on `/_next/static` and
 * image requests is pure overhead on the hot path. Guest browsing of all catalog routes stays open
 * (spec 3.3), so those never reach this file at all.
 */
export const config = {
  matcher: ['/account/:path*', '/checkout', '/wishlist', '/spin-win'],
};
