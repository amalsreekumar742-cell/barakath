import { useEffect, type FC, type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import toast from 'react-hot-toast';
import { AdminModule, SubAdminRole, SubAdminStatus } from '@barakath/shared/config/enums';
import { auth } from '@/lib/firebaseConfig';
import { useAppDispatch, useAppSelector } from '@/stores/store';
import { logout } from '@/features/auth/stores/authSlice';
import PageSkeleton from '@/components/PageSkeleton';

/**
 * routePermissions — maps a route PREFIX to the AdminModule permission that guards it (spec §1.20).
 * Nested routes inherit their parent module (matched by prefix), so `/coupons/create` needs `coupons`
 * and `/sub-admin/:id/edit` needs `subAdmin`. NOTE: the Banner route is plural (`/banners`) but its
 * permission key is the singular `banner` (AdminModule.BANNER). Dashboard (`/`) is deliberately absent —
 * it is the baseline landing page and never gated, which also prevents a redirect loop for an admin who
 * lacks every module.
 */
const routePermissions: { prefix: string; module: AdminModule }[] = [
  { prefix: '/products', module: AdminModule.PRODUCTS },
  { prefix: '/categories', module: AdminModule.CATEGORIES },
  { prefix: '/inventory', module: AdminModule.INVENTORY },
  { prefix: '/orders', module: AdminModule.ORDERS },
  { prefix: '/customers', module: AdminModule.CUSTOMERS },
  { prefix: '/payments', module: AdminModule.PAYMENTS },
  { prefix: '/replacement', module: AdminModule.REPLACEMENT },
  { prefix: '/reviews', module: AdminModule.REVIEWS },
  { prefix: '/spinner-campaigns', module: AdminModule.SPINNER_CAMPAIGNS },
  { prefix: '/coupons', module: AdminModule.COUPONS },
  { prefix: '/affiliate', module: AdminModule.AFFILIATE },
  { prefix: '/banners', module: AdminModule.BANNER },
  { prefix: '/flash-sale', module: AdminModule.FLASH_SALE },
  { prefix: '/new-arrivals', module: AdminModule.NEW_ARRIVALS },
  { prefix: '/notifications', module: AdminModule.NOTIFICATIONS },
  { prefix: '/reports', module: AdminModule.REPORTS },
  { prefix: '/settings', module: AdminModule.SETTINGS },
  { prefix: '/sub-admin', module: AdminModule.SUB_ADMIN },
];

/** Resolve the guarding module for a pathname via the longest matching prefix (null = ungated, e.g. `/`). */
function moduleForPath(pathname: string): AdminModule | null {
  let match: { prefix: string; module: AdminModule } | null = null;
  for (const entry of routePermissions) {
    if (pathname === entry.prefix || pathname.startsWith(`${entry.prefix}/`)) {
      if (!match || entry.prefix.length > match.prefix.length) match = entry;
    }
  }
  return match?.module ?? null;
}

/**
 * RouteGuard — gates every protected route (spec §1.1, §1.20).
 *
 * WHY it reads `currentAdmin` (the live slice) rather than the login result: the app-wide listener
 * (useCurrentAdmin) is the single source of truth for "who is signed in right now", so a session
 * restored on refresh, or revoked in another tab, is reflected here without a separate check.
 *
 * Decision order:
 *  1. auth not yet resolved  → full-page skeleton (can't tell "signed out" from "still checking").
 *  2. no Firebase user OR no admin doc loaded → redirect to /login.
 *  3. admin suspended → force sign-out + toast + redirect.
 *  4. admin lacks the current route's module permission → redirect to Dashboard + toast (Super admins,
 *     and admins with no permission model set, bypass this check).
 *  5. otherwise → render the protected tree.
 */
const RouteGuard: FC<{ children: ReactNode }> = ({ children }) => {
  const dispatch = useAppDispatch();
  const { pathname } = useLocation();
  const { admin, authResolved } = useAppSelector((s) => s.currentAdmin);
  const suspended = admin?.status === SubAdminStatus.SUSPENDED;

  // Per-route permission check. Super admins (and any admin with no permission map) are never gated.
  const perms = admin?.permissions;
  const enforce =
    !!admin && admin.role !== SubAdminRole.SUPER_ADMIN && !!perms && Object.keys(perms).length > 0;
  const requiredModule = enforce ? moduleForPath(pathname) : null;
  const permissionDenied = !!requiredModule && perms?.[requiredModule] !== true;

  // Side-effects (toast + signOut) must run in an effect, not during render.
  useEffect(() => {
    if (authResolved && suspended) {
      toast.error('Your account has been suspended');
      void dispatch(logout());
    }
  }, [authResolved, suspended, dispatch]);

  useEffect(() => {
    if (authResolved && !suspended && permissionDenied) {
      toast.error("You don't have access to that section");
    }
  }, [authResolved, suspended, permissionDenied, pathname]);

  if (!authResolved) {
    return (
      <div className="min-h-screen">
        <PageSkeleton />
      </div>
    );
  }

  if (!auth.currentUser || !admin || suspended) {
    return <Navigate to="/login" replace />;
  }

  // Signed in but lacking this route's permission → bounce to the (ungated) Dashboard.
  if (permissionDenied) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

export default RouteGuard;
