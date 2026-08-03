import { AdminModule, SubAdminRole } from '@barakath/shared/config/enums';

/**
 * Permission model for the Sub Admin feature (spec §1.20).
 *
 * WHY feature-local (not in shared): the canonical permission KEYS already live in `AdminModule`
 * (shared) — the creator writes those exact strings and the sidebar reads them. What is UI-only, and
 * therefore stays here, is (a) the human LABEL for each key, (b) how the keys are GROUPED in the matrix
 * (mirroring the sidebar sections), and (c) the role-based ON/OFF defaults. None of that belongs in the
 * shared data contract, so it is defined once here and imported by the form + preview.
 */

/** Human labels for the permission matrix, keyed by the AdminModule value. */
export const MODULE_LABELS: Record<AdminModule, string> = {
  [AdminModule.DASHBOARD]: 'Dashboard',
  [AdminModule.PRODUCTS]: 'Products',
  [AdminModule.CATEGORIES]: 'Categories',
  [AdminModule.INVENTORY]: 'Inventory',
  [AdminModule.ORDERS]: 'Orders',
  [AdminModule.CUSTOMERS]: 'Customers',
  [AdminModule.PAYMENTS]: 'Payments',
  // Display only — the KEY stays AdminModule.REPLACEMENT ('replacement'), which is the persisted
  // permission key on every existing subAdmins doc.
  [AdminModule.REPLACEMENT]: 'Returns',
  [AdminModule.REVIEWS]: 'Reviews',
  [AdminModule.SPINNER_CAMPAIGNS]: 'Spinner Campaigns',
  [AdminModule.COUPONS]: 'Coupons',
  [AdminModule.AFFILIATE]: 'Affiliate Program',
  [AdminModule.BANNER]: 'Banner',
  [AdminModule.FLASH_SALE]: 'Flash Sale',
  [AdminModule.NEW_ARRIVALS]: 'New Arrivals',
  [AdminModule.NOTIFICATIONS]: 'Notifications',
  [AdminModule.REPORTS]: 'Reports & Analytics',
  [AdminModule.SETTINGS]: 'Settings',
  [AdminModule.SUB_ADMIN]: 'Sub Admin',
};

/** A group of permission keys shown together in the matrix — mirrors the sidebar sections (spec §1.2). */
export interface PermissionGroup {
  label: string;
  modules: AdminModule[];
}

/**
 * PERMISSION_GROUPS — the matrix layout, grouped exactly like the sidebar so an admin recognises the
 * modules by the same headings they navigate by. Order matches navigation.ts.
 */
export const PERMISSION_GROUPS: PermissionGroup[] = [
  { label: 'Dashboard', modules: [AdminModule.DASHBOARD] },
  {
    label: 'CATALOGUE',
    modules: [AdminModule.PRODUCTS, AdminModule.CATEGORIES, AdminModule.INVENTORY],
  },
  {
    label: 'OPERATIONS',
    modules: [
      AdminModule.ORDERS,
      AdminModule.CUSTOMERS,
      AdminModule.PAYMENTS,
      AdminModule.REPLACEMENT,
      AdminModule.REVIEWS,
    ],
  },
  {
    label: 'GROWTH',
    modules: [
      AdminModule.SPINNER_CAMPAIGNS,
      AdminModule.COUPONS,
      AdminModule.AFFILIATE,
      AdminModule.BANNER,
      AdminModule.FLASH_SALE,
      AdminModule.NEW_ARRIVALS,
      AdminModule.NOTIFICATIONS,
    ],
  },
  {
    label: 'INSIGHTS',
    modules: [AdminModule.REPORTS, AdminModule.SETTINGS, AdminModule.SUB_ADMIN],
  },
];

/** Every AdminModule value, flattened — used to seed a full permissions map. */
export const ALL_MODULES: AdminModule[] = PERMISSION_GROUPS.flatMap((g) => g.modules);

/**
 * defaultPermissionsForRole — the role-based ON/OFF defaults the matrix seeds when a role is picked
 * (spec §1.20). The admin may override any toggle afterwards (except Super admin, which stays all-ON).
 *   - Super admin: everything ON.
 *   - Manager: everything ON except Settings and Sub Admin.
 *   - Support: only Orders, Customers, Replacement, Reviews ON.
 *
 * WHY compute from ALL_MODULES (not a hand-written map): new modules added to AdminModule are picked up
 * automatically and default OFF for the restricted roles, so a forgotten key can never silently grant
 * access — it must be explicitly enabled.
 */
export function defaultPermissionsForRole(role: SubAdminRole): Record<string, boolean> {
  const perms: Record<string, boolean> = {};
  const supportOn: string[] = [
    AdminModule.ORDERS,
    AdminModule.CUSTOMERS,
    AdminModule.REPLACEMENT,
    AdminModule.REVIEWS,
  ];
  const managerOff: string[] = [AdminModule.SETTINGS, AdminModule.SUB_ADMIN];

  for (const m of ALL_MODULES) {
    if (role === SubAdminRole.SUPER_ADMIN) perms[m] = true;
    else if (role === SubAdminRole.MANAGER) perms[m] = !managerOff.includes(m);
    else perms[m] = supportOn.includes(m); // Support
  }
  return perms;
}

/**
 * roleBadgeClasses — the badge token classes for each role (design: no purple token exists, so Super
 * admin reuses the primary-subtle/primary pair; Manager → info; Support → success). Centralised so the
 * list badge and the form preview stay identical.
 */
export function roleBadgeClasses(role: SubAdminRole): string {
  if (role === SubAdminRole.SUPER_ADMIN) return 'bg-primary-subtle text-primary';
  if (role === SubAdminRole.MANAGER) return 'bg-info-subtle text-info';
  return 'bg-success-subtle text-success'; // Support
}

/** Short description shown under each role radio (spec §1.20 role selection). */
export const ROLE_DESCRIPTIONS: Record<SubAdminRole, string> = {
  [SubAdminRole.SUPER_ADMIN]: 'Full access to every module, including Settings and Sub Admin.',
  [SubAdminRole.MANAGER]: 'Access to everything except Settings and Sub Admin.',
  [SubAdminRole.SUPPORT]: 'Handles Orders, Customers, Returns and Reviews only.',
};
