import type { IconName } from '@/components/icons/Icon';
import { AdminModule } from '@barakath/shared/config/enums';

/**
 * Navigation config — the single source of truth for the sidebar structure AND breadcrumb labels
 * (spec §1.2). Both `Sidebar` and `Breadcrumb` read from here so a route, its label, its icon and its
 * permission key never drift apart. Order matches the spec exactly; groups match the spec's section
 * labels (CATALOGUE / OPERATIONS / GROWTH / INSIGHTS), with Dashboard standalone.
 *
 * WHY `module` on each item: the sidebar hides items whose permission is not granted in
 * `currentAdmin.permissions` (spec §1.20). The key is an AdminModule so it matches what the Sub Admin
 * creator writes.
 */
export interface NavItem {
  label: string;
  path: string;
  /** Barakath design-system glyph name (see components/icons/registry). */
  icon: IconName;
  module: AdminModule;
}

export interface NavGroup {
  /** null = a standalone item with no group heading (Dashboard). */
  label: string | null;
  items: NavItem[];
}

export const navGroups: NavGroup[] = [
  {
    label: null,
    items: [
      { label: 'Dashboard', path: '/', icon: 'DashboardLine', module: AdminModule.DASHBOARD },
    ],
  },
  {
    label: 'CATALOGUE',
    items: [
      { label: 'Products', path: '/products', icon: 'ShoppingBag3Line', module: AdminModule.PRODUCTS },
      { label: 'Categories', path: '/categories', icon: 'GridLine', module: AdminModule.CATEGORIES },
      { label: 'Inventory', path: '/inventory', icon: 'MenuLine', module: AdminModule.INVENTORY },
    ],
  },
  {
    label: 'OPERATIONS',
    items: [
      { label: 'Orders', path: '/orders', icon: 'ShoppingBag1Line', module: AdminModule.ORDERS },
      { label: 'Customers', path: '/customers', icon: 'User1Line', module: AdminModule.CUSTOMERS },
      { label: 'Payments', path: '/payments', icon: 'WalletLine', module: AdminModule.PAYMENTS },
      { label: 'Replacement', path: '/replacement', icon: 'ArrowLeftLine', module: AdminModule.REPLACEMENT },
      { label: 'Reviews', path: '/reviews', icon: 'StarLine', module: AdminModule.REVIEWS },
    ],
  },
  {
    label: 'GROWTH',
    items: [
      { label: 'Spinner Campaigns', path: '/spinner-campaigns', icon: 'GiftLine', module: AdminModule.SPINNER_CAMPAIGNS },
      { label: 'Coupons', path: '/coupons', icon: 'BookmarkLine', module: AdminModule.COUPONS },
      { label: 'Affiliate Program', path: '/affiliate', icon: 'UserHeartLine', module: AdminModule.AFFILIATE },
      { label: 'Banner', path: '/banners', icon: 'EyeLine', module: AdminModule.BANNER },
      { label: 'Flash Sale', path: '/flash-sale', icon: 'FlashlightLine', module: AdminModule.FLASH_SALE },
      { label: 'New Arrivals', path: '/new-arrivals', icon: 'SparklingLine', module: AdminModule.NEW_ARRIVALS },
      { label: 'Notifications', path: '/notifications', icon: 'NotificationLine', module: AdminModule.NOTIFICATIONS },
    ],
  },
  {
    label: 'INSIGHTS',
    items: [
      { label: 'Reports & Analytics', path: '/reports', icon: 'DashboardLine', module: AdminModule.REPORTS },
      { label: 'Settings', path: '/settings', icon: 'Settings1Line', module: AdminModule.SETTINGS },
      { label: 'Sub Admin', path: '/sub-admin', icon: 'User1Line', module: AdminModule.SUB_ADMIN },
    ],
  },
];

/** Flat list of every nav item — convenient for lookups (breadcrumb, guards). */
export const navItems: NavItem[] = navGroups.flatMap((g) => g.items);

/**
 * segmentLabels — maps a URL path segment to a human label for the breadcrumb (spec §1.22).
 * Built from the nav items (first segment of each path) plus common leaf actions. A segment not
 * found here falls back to a title-cased version of the raw segment.
 */
export const segmentLabels: Record<string, string> = {
  ...Object.fromEntries(
    navItems
      .map((i) => i.path.replace(/^\//, ''))
      .filter(Boolean)
      .map((seg) => [seg, navItems.find((i) => i.path === `/${seg}`)!.label]),
  ),
  add: 'Add',
  edit: 'Edit',
  new: 'New',
  create: 'Create',
};
