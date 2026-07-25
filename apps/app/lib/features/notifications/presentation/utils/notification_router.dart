import '../../../../core/constants/domain_enums.dart';
import '../../domain/entities/app_notification.dart';

/// Resolves a notification's deep link to a go_router path.
///
/// ONE function, used by BOTH the list (tap a tile) and `PushService` (tap a
/// push, foreground or cold start) — two copies of this mapping is how a push
/// and an in-app tap end up on different screens.
///
/// The paths are the real ones in `core/routes/app_router.dart`. Two are easy to
/// get wrong:
///   * Coupons → `/my-coupons`. `/coupons` is the CHECKOUT apply-coupon screen.
///   * Category / Flash sale → `/product-listing` with query parameters; there
///     is no `/category/:id` route.
///
/// An unknown link type, or a missing `linkValue` where one is required, falls
/// back to Home. Opening `/product/` with an empty id would land on the router's
/// not-found page, which reads as a broken notification.
String resolveNotificationRoute(AppNotification notification) =>
    resolveDeepLinkRoute(
      linkType: notification.linkType,
      linkValue: notification.linkValue,
    );

/// The same resolution from raw strings — an FCM data payload carries
/// `linkType` / `linkValue` as plain text, with no document to hydrate.
String resolveDeepLinkRoute({String? linkType, String? linkValue}) {
  const home = '/home';

  final raw = (linkType ?? '').trim();
  // `NotificationDeepLinkX.from` is tolerant and falls back to home, so an
  // unrecognised value is indistinguishable from an explicit "Home" — which is
  // exactly the behaviour we want, and why 'None' also lands on home.
  final link = NotificationDeepLinkX.from(raw);

  final value = (linkValue ?? '').trim();
  if (link.needsReference && value.isEmpty) return home;

  return switch (link) {
    NotificationDeepLink.home => home,
    NotificationDeepLink.product => '/product/${Uri.encodeComponent(value)}',
    NotificationDeepLink.category =>
      '/product-listing?categoryId=${Uri.encodeQueryComponent(value)}',
    NotificationDeepLink.flashSale => '/product-listing?flashSale=true',
    NotificationDeepLink.spinner => '/spin',
    NotificationDeepLink.order => '/orders/${Uri.encodeComponent(value)}',
    NotificationDeepLink.wallet => '/wallet',
    // NOT '/coupons' — that route is the checkout coupon picker.
    NotificationDeepLink.coupons => '/my-coupons',
  };
}
