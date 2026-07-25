import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../constants/app_details.dart';
import '../../features/auth/presentation/pages/splash_page.dart';
import '../../features/auth/presentation/pages/onboarding_page.dart';
import '../../features/auth/presentation/pages/login_page.dart';
import '../../features/auth/presentation/pages/otp_page.dart';
import '../../features/auth/presentation/pages/create_profile_page.dart';
import '../../features/auth/presentation/providers/auth_provider.dart';
import '../../features/home/presentation/pages/app_shell.dart';
import '../../features/home/presentation/pages/home_page.dart';
import '../../features/address/presentation/pages/add_address_page.dart';
import '../../features/address/presentation/pages/saved_addresses_page.dart';
import '../../features/categories/presentation/pages/categories_page.dart';
import '../../features/checkout/presentation/pages/checkout_page.dart';
import '../../features/checkout/presentation/pages/coupon_selection_page.dart';
import '../../features/checkout/presentation/pages/order_success_page.dart';
import '../../features/checkout/presentation/pages/payment_failed_page.dart';
import '../../features/products/presentation/pages/product_detail_page.dart';
import '../../features/products/presentation/pages/product_listing_page.dart';
import '../../features/search/presentation/pages/search_page.dart';
import '../../features/cart/presentation/pages/bag_page.dart';
import '../../features/wallet/presentation/pages/wallet_page.dart';
import '../../features/profile/presentation/pages/profile_page.dart';
// Batch 4
import '../../features/affiliate/presentation/pages/add_bank_account_page.dart';
import '../../features/affiliate/presentation/pages/affiliate_dashboard_page.dart';
import '../../features/affiliate/presentation/pages/affiliate_wallet_page.dart';
import '../../features/affiliate/presentation/pages/bank_accounts_page.dart';
import '../../features/affiliate/presentation/pages/withdraw_page.dart';
import '../../features/notifications/presentation/pages/notifications_page.dart';
import '../../features/orders/presentation/pages/invoice_page.dart';
import '../../features/orders/presentation/pages/my_orders_page.dart';
import '../../features/orders/presentation/pages/order_detail_page.dart';
import '../../features/orders/presentation/pages/order_tracking_page.dart';
import '../../features/profile/presentation/pages/edit_profile_page.dart';
import '../../features/profile/presentation/pages/help_centre_page.dart';
import '../../features/profile/presentation/pages/privacy_policy_page.dart';
import '../../features/profile/presentation/pages/settings_page.dart';
import '../../features/profile/presentation/pages/terms_page.dart';
import '../../features/replacement/presentation/pages/request_replacement_page.dart';
import '../../features/reviews/presentation/pages/write_review_page.dart';
import '../../features/spinner/presentation/pages/my_coupons_page.dart';
import '../../features/spinner/presentation/pages/spin_page.dart';
import '../../features/wallet/presentation/pages/add_money_page.dart';
import '../../features/wishlist/presentation/pages/wishlist_page.dart';

/// App route configuration for Barakath.
///
/// WHY go_router + StatefulShellRoute: the 5-tab bottom nav needs each tab to keep its own navigation
/// stack + scroll state across switches — `StatefulShellRoute.indexedStack` gives exactly that, feeding
/// a `StatefulNavigationShell` into `AppShell`. WHY the router is built from an AuthProvider: the redirect
/// guard reads auth state and re-runs whenever it changes (`refreshListenable`), so a sign-in/out moves
/// the user to the right place without any screen having to push manually.
class AppRouter {
  const AppRouter._();

  static final _rootKey = GlobalKey<NavigatorState>();

  /// Auth-flow routes drive their own navigation (splash decides where to go), so the guard leaves them
  /// alone. Everything else is gated below.
  static const _authFlow = {'/splash', '/onboarding', '/login', '/otp', '/create-profile'};

  /// Surfaces a guest can't use at all (spec §2.4) — they're inherently
  /// account-bound, so there's nothing meaningful to render without one.
  ///
  /// Exact-match paths; see [_guestBlockedPrefixes] for the subtree gates.
  static const _guestBlocked = {
    '/wallet',
    '/profile',
    '/orders',
    '/spin',
    '/my-coupons',
    '/wishlist',
    '/notifications',
  };

  /// Whole subtrees a guest can't enter. Prefix-matched so a nested route added
  /// later (e.g. `/affiliate/bank-accounts/add`) is covered without another
  /// edit here — a guard you have to remember to update is a guard that leaks.
  static const _guestBlockedPrefixes = [
    '/orders/',
    '/wallet/',
    '/profile/',
    '/affiliate',
    '/reviews/',
  ];

  static bool _isGuestBlocked(String location) {
    if (_guestBlocked.contains(location)) return true;
    return _guestBlockedPrefixes.any(location.startsWith);
  }

  static GoRouter createRouter(AuthProvider auth) {
    return GoRouter(
      navigatorKey: _rootKey,
      initialLocation: '/splash',
      refreshListenable: auth,
      redirect: (context, state) {
        final loc = state.matchedLocation;
        if (_authFlow.contains(loc)) return null; // splash/auth screens self-navigate
        if (auth.isLoading) return null; // still resolving initial auth
        // Protected app surfaces: a visitor who is neither signed in nor a guest goes to login.
        if (!auth.isAuthenticated && !auth.isGuest) return '/login';
        // Spec §2.4 — a guest may browse the catalogue, but these need an account.
        // (Cart/wishlist/buy are gated at the point of action instead, so the
        // customer keeps their place instead of being bounced out of a screen.)
        if (auth.isGuest && _isGuestBlocked(loc)) return '/login';
        // A signed-in user without a completed profile is sent to finish it —
        // unless they explicitly chose Skip, which the design offers.
        if (auth.isAuthenticated &&
            !auth.isProfileComplete &&
            !auth.profileSetupSkipped) {
          return '/create-profile';
        }
        return null;
      },
      routes: <RouteBase>[
        GoRoute(path: '/splash', builder: (c, s) => const SplashPage()),
        GoRoute(path: '/onboarding', builder: (c, s) => const OnboardingPage()),
        GoRoute(path: '/login', builder: (c, s) => const LoginPage()),
        GoRoute(
          path: '/otp',
          builder: (c, s) {
            // Login now passes {phone, countryCode}; tolerate a bare phone string
            // too so any older push (or a deep link) still resolves.
            final extra = s.extra;
            if (extra is Map) {
              return OtpPage(
                phone: extra['phone'] as String? ?? '',
                countryCode: extra['countryCode'] as String? ??
                    AppDetails.initialCountryCodeSelection,
              );
            }
            return OtpPage(phone: extra as String? ?? '');
          },
        ),
        GoRoute(path: '/create-profile', builder: (c, s) => const CreateProfilePage()),

        // Catalogue drill-downs live on the ROOT navigator, above the bottom-nav
        // shell: they're full-screen pushes with their own back button (and product
        // detail has a sticky bottom bar that would fight the tab bar).
        GoRoute(
          path: '/search',
          parentNavigatorKey: _rootKey,
          builder: (c, s) => const SearchPage(),
        ),
        GoRoute(
          path: '/product-listing',
          parentNavigatorKey: _rootKey,
          builder: (c, s) {
            final q = s.uri.queryParameters;
            return ProductListingPage(
              categoryId: q['categoryId'],
              subCategory: q['subCategory'],
              categoryName: q['categoryName'],
              newArrivals: q['newArrivals'] == 'true',
              flashSale: q['flashSale'] == 'true',
            );
          },
        ),
        GoRoute(
          path: '/product/:productId',
          parentNavigatorKey: _rootKey,
          builder: (c, s) =>
              ProductDetailPage(productId: s.pathParameters['productId'] ?? ''),
        ),

        // Cart → checkout flow. All root-level: each is a full-screen step with
        // its own bar, and the outcome pages must not sit under the tab shell.
        GoRoute(
          path: '/coupons',
          parentNavigatorKey: _rootKey,
          builder: (c, s) => const CouponSelectionPage(),
        ),
        GoRoute(
          path: '/checkout',
          parentNavigatorKey: _rootKey,
          builder: (c, s) => const CheckoutPage(),
        ),
        GoRoute(
          path: '/saved-addresses',
          parentNavigatorKey: _rootKey,
          builder: (c, s) => SavedAddressesPage(
            selectMode: s.uri.queryParameters['selectMode'] == 'true',
          ),
        ),
        GoRoute(
          path: '/add-address',
          parentNavigatorKey: _rootKey,
          builder: (c, s) =>
              AddAddressPage(addressId: s.uri.queryParameters['addressId']),
        ),
        GoRoute(
          path: '/order-success',
          parentNavigatorKey: _rootKey,
          builder: (c, s) =>
              OrderSuccessPage(orderId: s.uri.queryParameters['orderId'] ?? ''),
        ),
        GoRoute(
          path: '/payment-failed',
          parentNavigatorKey: _rootKey,
          builder: (c, s) =>
              PaymentFailedPage(orderId: s.uri.queryParameters['orderId'] ?? ''),
        ),

        // --- Batch 4 -------------------------------------------------------
        // All root-navigator: each is a full-screen page with its own back
        // arrow, and several carry a sticky bottom action that would fight the
        // tab bar. `/wallet` and `/profile` stay inside the shell below.

        // Orders. `:orderId` is the Firestore DOCUMENT id, not the #BRK-XXXXX
        // display id — the display id is not unique enough to route on.
        GoRoute(
          path: '/orders',
          parentNavigatorKey: _rootKey,
          builder: (c, s) => const MyOrdersPage(),
          routes: [
            GoRoute(
              path: ':orderId',
              parentNavigatorKey: _rootKey,
              builder: (c, s) =>
                  OrderDetailPage(orderId: s.pathParameters['orderId'] ?? ''),
            ),
            GoRoute(
              path: ':orderId/track',
              parentNavigatorKey: _rootKey,
              builder: (c, s) =>
                  OrderTrackingPage(orderId: s.pathParameters['orderId'] ?? ''),
            ),
            GoRoute(
              path: ':orderId/invoice',
              parentNavigatorKey: _rootKey,
              builder: (c, s) =>
                  InvoicePage(orderId: s.pathParameters['orderId'] ?? ''),
            ),
            GoRoute(
              path: ':orderId/replace',
              parentNavigatorKey: _rootKey,
              builder: (c, s) => RequestReplacementPage(
                orderId: s.pathParameters['orderId'] ?? '',
                productId: s.uri.queryParameters['productId'] ?? '',
                variantId: s.uri.queryParameters['variantId'] ?? '',
              ),
            ),
          ],
        ),

        GoRoute(
          path: '/wallet/add-money',
          parentNavigatorKey: _rootKey,
          builder: (c, s) => const AddMoneyPage(),
        ),

        // Profile sub-pages.
        GoRoute(
          path: '/profile/edit',
          parentNavigatorKey: _rootKey,
          builder: (c, s) => const EditProfilePage(),
        ),
        GoRoute(
          path: '/profile/settings',
          parentNavigatorKey: _rootKey,
          builder: (c, s) => const SettingsPage(),
        ),
        GoRoute(
          path: '/profile/help',
          parentNavigatorKey: _rootKey,
          builder: (c, s) => const HelpCentrePage(),
        ),
        GoRoute(
          path: '/profile/privacy',
          parentNavigatorKey: _rootKey,
          builder: (c, s) => const PrivacyPolicyPage(),
        ),
        GoRoute(
          path: '/profile/terms',
          parentNavigatorKey: _rootKey,
          builder: (c, s) => const TermsPage(),
        ),

        GoRoute(
          path: '/wishlist',
          parentNavigatorKey: _rootKey,
          builder: (c, s) => const WishlistPage(),
        ),

        // Affiliate. Visible only to admin-allocated affiliates — the route
        // guard here only checks sign-in; the isAffiliate gate lives in the
        // feature, which has the customer doc.
        GoRoute(
          path: '/affiliate',
          parentNavigatorKey: _rootKey,
          builder: (c, s) => const AffiliateDashboardPage(),
          routes: [
            GoRoute(
              path: 'wallet',
              parentNavigatorKey: _rootKey,
              builder: (c, s) => const AffiliateWalletPage(),
            ),
            GoRoute(
              path: 'withdraw',
              parentNavigatorKey: _rootKey,
              builder: (c, s) => const WithdrawPage(),
            ),
            GoRoute(
              path: 'bank-accounts',
              parentNavigatorKey: _rootKey,
              builder: (c, s) => const BankAccountsPage(),
              routes: [
                GoRoute(
                  path: 'add',
                  parentNavigatorKey: _rootKey,
                  builder: (c, s) => const AddBankAccountPage(),
                ),
              ],
            ),
          ],
        ),

        GoRoute(
          path: '/spin',
          parentNavigatorKey: _rootKey,
          builder: (c, s) => const SpinPage(),
        ),

        // NOTE: `/coupons` is the checkout apply-coupon screen (Batch 3). The
        // spin-reward coupon wallet is a different screen with a different job,
        // so it gets its own path rather than shadowing that one.
        GoRoute(
          path: '/my-coupons',
          parentNavigatorKey: _rootKey,
          builder: (c, s) => const MyCouponsPage(),
        ),

        GoRoute(
          path: '/reviews/write/:orderId/:productId',
          parentNavigatorKey: _rootKey,
          builder: (c, s) => WriteReviewPage(
            orderId: s.pathParameters['orderId'] ?? '',
            productId: s.pathParameters['productId'] ?? '',
          ),
        ),

        GoRoute(
          path: '/notifications',
          parentNavigatorKey: _rootKey,
          builder: (c, s) => const NotificationsPage(),
        ),

        // Bottom-nav shell — 5 branches, one per tab, state preserved via IndexedStack.
        StatefulShellRoute.indexedStack(
          builder: (context, state, navigationShell) => AppShell(navigationShell: navigationShell),
          branches: [
            StatefulShellBranch(
              routes: [GoRoute(path: '/home', builder: (c, s) => const HomePage())],
            ),
            StatefulShellBranch(
              routes: [GoRoute(path: '/categories', builder: (c, s) => const CategoriesPage())],
            ),
            StatefulShellBranch(
              routes: [GoRoute(path: '/bag', builder: (c, s) => const BagPage())],
            ),
            StatefulShellBranch(
              routes: [GoRoute(path: '/wallet', builder: (c, s) => const WalletPage())],
            ),
            StatefulShellBranch(
              routes: [GoRoute(path: '/profile', builder: (c, s) => const ProfilePage())],
            ),
          ],
        ),
      ],
      // A raw "route not found" string left the customer on a blank screen with
      // no app bar and no way back. Some destinations here are simply features
      // that don't exist yet (orders, notifications, the reviews list), so this
      // has to be a recoverable screen rather than a debug dump.
      errorBuilder: (context, state) => const _RouteNotFoundPage(),
    );
  }
}

class _RouteNotFoundPage extends StatelessWidget {
  const _RouteNotFoundPage();

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(backgroundColor: Colors.transparent, elevation: 0),
      body: Center(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 32),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(Icons.construction_rounded,
                  size: 56, color: Color(0xFF9A9287)),
              const SizedBox(height: 16),
              const Text(
                'Not available yet',
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800),
              ),
              const SizedBox(height: 8),
              const Text(
                'This part of the app is still being built. '
                'Everything else works as normal.',
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 14, color: Color(0xFF6B6459)),
              ),
              const SizedBox(height: 24),
              OutlinedButton(
                onPressed: () => context.go('/home'),
                child: const Text('Go to home'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
