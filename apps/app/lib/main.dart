import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import 'core/config/firebase_config.dart';
import 'core/constants/app_details.dart';
import 'core/di/injection_container.dart';
import 'core/routes/app_router.dart';
import 'core/theme/app_theme.dart';
import 'features/auth/presentation/providers/auth_provider.dart';
import 'features/cart/presentation/providers/cart_provider.dart';
import 'features/address/presentation/providers/address_provider.dart';
import 'features/categories/presentation/providers/categories_provider.dart';
import 'features/checkout/presentation/providers/checkout_provider.dart';
import 'features/checkout/presentation/providers/coupon_provider.dart';
import 'features/home/presentation/providers/home_provider.dart';
import 'features/products/presentation/providers/product_listing_provider.dart';
import 'features/search/presentation/providers/search_provider.dart';
import 'features/settings/presentation/providers/general_settings_provider.dart';
import 'features/wishlist/presentation/providers/wishlist_provider.dart';
// Batch 4
import 'features/affiliate/presentation/providers/affiliate_provider.dart';
import 'features/notifications/presentation/providers/notifications_provider.dart';
import 'features/orders/presentation/providers/order_detail_provider.dart';
import 'features/orders/presentation/providers/orders_provider.dart';
import 'features/profile/presentation/providers/profile_provider.dart';
import 'features/replacement/presentation/providers/replacement_provider.dart';
import 'features/reviews/presentation/providers/reviews_provider.dart';
import 'features/spinner/presentation/providers/spinner_provider.dart';
import 'features/wallet/presentation/providers/wallet_provider.dart';

/// Entry point for the Barakath customer app.
///
/// WHY the ordering: Firebase must init before the DI graph is wired (datasources
/// resolve Firebase singletons) and before `AuthProvider` is created (it subscribes
/// to the auth stream immediately). `configureDependencies()` also `@preResolve`s
/// SharedPreferences, so the cart can restore before first frame and the Bag badge
/// is correct on launch. FCM permission is best-effort (never blocks startup). The
/// GoRouter is built from the AuthProvider so its redirect guard reacts to sign-in/out.
Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  await FirebaseConfig.init();
  await configureDependencies();

  // NOTE: notification permission is deliberately NOT requested here.
  // Spec §2.25 — "Notification permission asked after login". Prompting a
  // first-time visitor before they have an account is the fastest way to get a
  // permanent deny, and a denied prompt cannot be re-shown on iOS.
  // `PushService.requestPermissionAfterLogin()` owns it; AuthProvider calls it
  // on the auth-success path.

  final auth = sl<AuthProvider>();
  final settings = sl<GeneralSettingsProvider>();
  final cart = sl<CartProvider>();
  await cart.load();

  runApp(BarakathApp(auth: auth, settings: settings, cart: cart));
}

class BarakathApp extends StatefulWidget {
  const BarakathApp({super.key, required this.auth, required this.settings, required this.cart});

  final AuthProvider auth;
  final GeneralSettingsProvider settings;
  final CartProvider cart;

  @override
  State<BarakathApp> createState() => _BarakathAppState();
}

class _BarakathAppState extends State<BarakathApp> {
  late final GoRouter _router = AppRouter.createRouter(widget.auth);

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        ChangeNotifierProvider<AuthProvider>.value(value: widget.auth),
        ChangeNotifierProvider<GeneralSettingsProvider>.value(value: widget.settings),
        ChangeNotifierProvider<CartProvider>.value(value: widget.cart),

        // Catalogue state. WishlistProvider subscribes to its auth-aware stream in
        // its constructor, so it's created once here alongside AuthProvider rather
        // than per-screen. The rest are app-wide so a back-navigation returns to a
        // warm list instead of refetching.
        ChangeNotifierProvider<WishlistProvider>(create: (_) => sl<WishlistProvider>()),
        ChangeNotifierProvider<HomeProvider>(create: (_) => sl<HomeProvider>()),
        ChangeNotifierProvider<CategoriesProvider>(create: (_) => sl<CategoriesProvider>()),
        ChangeNotifierProvider<ProductListingProvider>(
          create: (_) => sl<ProductListingProvider>(),
        ),
        ChangeNotifierProvider<SearchProvider>(create: (_) => sl<SearchProvider>()),

        // Cart -> checkout flow. App-wide because the bag, coupon picker and
        // checkout all read the same applied-coupon and address state.
        ChangeNotifierProvider<CouponProvider>(create: (_) => sl<CouponProvider>()),
        ChangeNotifierProvider<AddressProvider>(create: (_) => sl<AddressProvider>()),
        ChangeNotifierProvider<CheckoutProvider>(create: (_) => sl<CheckoutProvider>()),

        // Batch 4. Registered up front so every route compiles and the six
        // feature sessions can fill their provider in place without touching
        // this file. `lazy: true` (the default) means none of them constructs
        // until a screen actually reads it, so a customer who never opens the
        // affiliate area pays nothing for it.
        ChangeNotifierProvider<OrdersProvider>(create: (_) => sl<OrdersProvider>()),
        ChangeNotifierProvider<OrderDetailProvider>(create: (_) => sl<OrderDetailProvider>()),
        ChangeNotifierProvider<ReplacementProvider>(create: (_) => sl<ReplacementProvider>()),
        ChangeNotifierProvider<WalletProvider>(create: (_) => sl<WalletProvider>()),
        ChangeNotifierProvider<ProfileProvider>(create: (_) => sl<ProfileProvider>()),
        ChangeNotifierProvider<AffiliateProvider>(create: (_) => sl<AffiliateProvider>()),
        ChangeNotifierProvider<SpinnerProvider>(create: (_) => sl<SpinnerProvider>()),
        ChangeNotifierProvider<ReviewsProvider>(create: (_) => sl<ReviewsProvider>()),
        ChangeNotifierProvider<NotificationsProvider>(
          create: (_) => sl<NotificationsProvider>(),
        ),
      ],
      child: MaterialApp.router(
        title: AppDetails.appName,
        debugShowCheckedModeBanner: false,
        theme: AppTheme.light,
        routerConfig: _router,
      ),
    );
  }
}
