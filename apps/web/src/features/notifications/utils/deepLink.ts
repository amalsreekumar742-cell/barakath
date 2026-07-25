import type { NotificationProps } from '@barakath/shared';

/**
 * Resolves a notification's deep link to a real website route.
 *
 * WHY this does NOT match the brief's Home/Product/Category/Flash sale/Spinner/Order/Wallet/Coupons
 * list, or its `deepLink`/`referenceId` field names: the deployed `notifications` document
 * (`packages/shared/src/types/notification.ts`) only has `linkType: 'Product' | 'Category' | 'Order' |
 * 'None'` and `linkValue: string` — there is no `deepLink`/`referenceId` pair, and no Home / Flash sale
 * / Spinner / Wallet / Coupons link type exists to build for. Routes below are read straight off the
 * real route tree (`apps/web/src/app/**`, not assumed): product is `/product/[productId]`, category is
 * `/category/[categoryName]`, order is the account area's `/account/orders/[orderId]`.
 *
 * Unknown/`'None'` `linkType`, or a missing `linkValue`, falls back to `/` — never a dead link.
 */
export function resolveNotificationLink(
  notification: Pick<NotificationProps, 'linkType' | 'linkValue'>,
): string {
  const value = notification.linkValue?.trim();
  if (!value) return '/';

  switch (notification.linkType) {
    case 'Product':
      return `/product/${encodeURIComponent(value)}`;
    case 'Category':
      return `/category/${encodeURIComponent(value)}`;
    case 'Order':
      return `/account/orders/${encodeURIComponent(value)}`;
    default:
      return '/';
  }
}
