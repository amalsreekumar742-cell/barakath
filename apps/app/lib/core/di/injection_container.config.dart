// GENERATED CODE - DO NOT MODIFY BY HAND
// dart format width=80

// **************************************************************************
// InjectableConfigGenerator
// **************************************************************************

// ignore_for_file: type=lint
// coverage:ignore-file

// ignore_for_file: no_leading_underscores_for_library_prefixes
import 'package:cloud_firestore/cloud_firestore.dart' as _i974;
import 'package:cloud_functions/cloud_functions.dart' as _i809;
import 'package:connectivity_plus/connectivity_plus.dart' as _i895;
import 'package:firebase_auth/firebase_auth.dart' as _i59;
import 'package:firebase_messaging/firebase_messaging.dart' as _i892;
import 'package:firebase_storage/firebase_storage.dart' as _i457;
import 'package:get_it/get_it.dart' as _i174;
import 'package:injectable/injectable.dart' as _i526;
import 'package:shared_preferences/shared_preferences.dart' as _i460;

import '../../features/address/data/datasources/address_remote_datasource.dart'
    as _i182;
import '../../features/address/data/repositories/address_repository_impl.dart'
    as _i590;
import '../../features/address/domain/repositories/address_repository.dart'
    as _i463;
import '../../features/address/domain/usecases/address_usecases.dart' as _i947;
import '../../features/address/presentation/providers/address_provider.dart'
    as _i385;
import '../../features/affiliate/data/datasources/affiliate_remote_datasource.dart'
    as _i342;
import '../../features/affiliate/data/datasources/ifsc_remote_datasource.dart'
    as _i251;
import '../../features/affiliate/data/repositories/affiliate_repository_impl.dart'
    as _i833;
import '../../features/affiliate/domain/repositories/affiliate_repository.dart'
    as _i1;
import '../../features/affiliate/domain/usecases/affiliate_usecases.dart'
    as _i643;
import '../../features/affiliate/presentation/providers/affiliate_provider.dart'
    as _i286;
import '../../features/auth/data/datasources/auth_remote_datasource.dart'
    as _i161;
import '../../features/auth/data/repositories/auth_repository_impl.dart'
    as _i153;
import '../../features/auth/domain/repositories/auth_repository.dart' as _i787;
import '../../features/auth/domain/usecases/clear_fcm_token.dart' as _i224;
import '../../features/auth/domain/usecases/create_profile.dart' as _i800;
import '../../features/auth/domain/usecases/resend_otp.dart' as _i152;
import '../../features/auth/domain/usecases/send_otp.dart' as _i727;
import '../../features/auth/domain/usecases/sign_out.dart' as _i568;
import '../../features/auth/domain/usecases/sync_fcm_token.dart' as _i789;
import '../../features/auth/domain/usecases/upload_profile_photo.dart' as _i126;
import '../../features/auth/domain/usecases/verify_otp.dart' as _i975;
import '../../features/auth/domain/usecases/watch_auth_user.dart' as _i28;
import '../../features/auth/domain/usecases/watch_fcm_token_refresh.dart'
    as _i859;
import '../../features/auth/presentation/providers/auth_provider.dart'
    as _i1054;
import '../../features/cart/data/datasources/cart_local_datasource.dart'
    as _i339;
import '../../features/cart/data/datasources/cart_remote_datasource.dart'
    as _i15;
import '../../features/cart/data/repositories/cart_pricing_repository_impl.dart'
    as _i810;
import '../../features/cart/data/repositories/cart_repository_impl.dart'
    as _i642;
import '../../features/cart/domain/repositories/cart_pricing_repository.dart'
    as _i88;
import '../../features/cart/domain/repositories/cart_repository.dart' as _i322;
import '../../features/cart/domain/usecases/add_to_cart.dart' as _i868;
import '../../features/cart/domain/usecases/clear_cart.dart' as _i387;
import '../../features/cart/domain/usecases/fetch_cart_details.dart' as _i216;
import '../../features/cart/domain/usecases/get_cart.dart' as _i912;
import '../../features/cart/domain/usecases/remove_from_cart.dart' as _i904;
import '../../features/cart/domain/usecases/update_quantity.dart' as _i556;
import '../../features/cart/presentation/providers/cart_provider.dart' as _i365;
import '../../features/categories/data/datasources/category_remote_datasource.dart'
    as _i390;
import '../../features/categories/data/repositories/category_repository_impl.dart'
    as _i894;
import '../../features/categories/domain/repositories/category_repository.dart'
    as _i266;
import '../../features/categories/domain/usecases/get_categories.dart' as _i872;
import '../../features/categories/domain/usecases/get_category_by_id.dart'
    as _i777;
import '../../features/categories/presentation/providers/categories_provider.dart'
    as _i1071;
import '../../features/checkout/data/datasources/checkout_remote_datasource.dart'
    as _i26;
import '../../features/checkout/data/datasources/coupon_remote_datasource.dart'
    as _i633;
import '../../features/checkout/data/repositories/checkout_repository_impl.dart'
    as _i949;
import '../../features/checkout/data/repositories/coupon_repository_impl.dart'
    as _i957;
import '../../features/checkout/domain/repositories/checkout_repository.dart'
    as _i498;
import '../../features/checkout/domain/repositories/coupon_repository.dart'
    as _i173;
import '../../features/checkout/domain/usecases/checkout_usecases.dart'
    as _i741;
import '../../features/checkout/domain/usecases/find_coupon_by_code.dart'
    as _i807;
import '../../features/checkout/domain/usecases/get_active_coupons.dart'
    as _i538;
import '../../features/checkout/domain/usecases/validate_coupon.dart' as _i427;
import '../../features/checkout/presentation/providers/checkout_provider.dart'
    as _i238;
import '../../features/checkout/presentation/providers/coupon_provider.dart'
    as _i52;
import '../../features/home/data/datasources/home_remote_datasource.dart'
    as _i278;
import '../../features/home/data/repositories/home_repository_impl.dart'
    as _i76;
import '../../features/home/domain/repositories/home_repository.dart' as _i0;
import '../../features/home/domain/usecases/get_banners.dart' as _i606;
import '../../features/home/domain/usecases/get_featured_products.dart'
    as _i449;
import '../../features/home/domain/usecases/get_first_variants.dart' as _i535;
import '../../features/home/domain/usecases/get_flash_sale_end_date.dart'
    as _i862;
import '../../features/home/domain/usecases/get_flash_sale_products.dart'
    as _i369;
import '../../features/home/domain/usecases/get_home_categories.dart' as _i159;
import '../../features/home/domain/usecases/get_new_arrivals.dart' as _i1061;
import '../../features/home/domain/usecases/get_products_by_category.dart'
    as _i161;
import '../../features/home/presentation/providers/home_provider.dart' as _i526;
import '../../features/notifications/data/datasources/notification_local_datasource.dart'
    as _i372;
import '../../features/notifications/data/datasources/notification_remote_datasource.dart'
    as _i923;
import '../../features/notifications/data/repositories/notification_repository_impl.dart'
    as _i361;
import '../../features/notifications/data/services/push_service.dart' as _i1067;
import '../../features/notifications/domain/repositories/notification_repository.dart'
    as _i367;
import '../../features/notifications/domain/usecases/get_broadcast_notifications.dart'
    as _i412;
import '../../features/notifications/domain/usecases/get_personal_notifications.dart'
    as _i501;
import '../../features/notifications/domain/usecases/get_read_notification_ids.dart'
    as _i619;
import '../../features/notifications/domain/usecases/mark_all_notifications_read.dart'
    as _i852;
import '../../features/notifications/domain/usecases/mark_notification_read.dart'
    as _i29;
import '../../features/notifications/presentation/providers/notifications_provider.dart'
    as _i506;
import '../../features/orders/data/datasources/order_remote_datasource.dart'
    as _i1007;
import '../../features/orders/data/repositories/order_repository_impl.dart'
    as _i376;
import '../../features/orders/domain/repositories/order_repository.dart'
    as _i543;
import '../../features/orders/domain/usecases/cancel_order.dart' as _i594;
import '../../features/orders/domain/usecases/generate_invoice.dart' as _i190;
import '../../features/orders/domain/usecases/get_invoice_business.dart'
    as _i353;
import '../../features/orders/domain/usecases/get_item_replacement.dart'
    as _i940;
import '../../features/orders/domain/usecases/get_order_by_id.dart' as _i43;
import '../../features/orders/domain/usecases/get_orders.dart' as _i941;
import '../../features/orders/domain/usecases/get_return_statuses.dart'
    as _i965;
import '../../features/orders/presentation/providers/order_detail_provider.dart'
    as _i462;
import '../../features/orders/presentation/providers/orders_provider.dart'
    as _i388;
import '../../features/products/data/datasources/product_detail_remote_datasource.dart'
    as _i871;
import '../../features/products/data/datasources/product_remote_datasource.dart'
    as _i333;
import '../../features/products/data/repositories/product_detail_repository_impl.dart'
    as _i628;
import '../../features/products/data/repositories/product_repository_impl.dart'
    as _i764;
import '../../features/products/domain/repositories/product_detail_repository.dart'
    as _i550;
import '../../features/products/domain/repositories/product_repository.dart'
    as _i963;
import '../../features/products/domain/usecases/get_bundle_products.dart'
    as _i598;
import '../../features/products/domain/usecases/get_first_variants.dart'
    as _i357;
import '../../features/products/domain/usecases/get_product_detail.dart'
    as _i892;
import '../../features/products/domain/usecases/get_product_variants.dart'
    as _i301;
import '../../features/products/domain/usecases/get_products.dart' as _i143;
import '../../features/products/domain/usecases/get_recent_product_reviews.dart'
    as _i17;
import '../../features/products/presentation/providers/product_detail_provider.dart'
    as _i847;
import '../../features/products/presentation/providers/product_listing_provider.dart'
    as _i389;
import '../../features/profile/data/datasources/profile_remote_datasource.dart'
    as _i327;
import '../../features/profile/data/repositories/profile_repository_impl.dart'
    as _i334;
import '../../features/profile/domain/repositories/profile_repository.dart'
    as _i894;
import '../../features/profile/domain/usecases/delete_account.dart' as _i457;
import '../../features/profile/domain/usecases/update_profile.dart' as _i78;
import '../../features/profile/domain/usecases/upload_profile_photo.dart'
    as _i535;
import '../../features/profile/domain/usecases/watch_user.dart' as _i472;
import '../../features/profile/presentation/providers/profile_provider.dart'
    as _i919;
import '../../features/replacement/data/datasources/replacement_remote_datasource.dart'
    as _i103;
import '../../features/replacement/data/repositories/replacement_repository_impl.dart'
    as _i887;
import '../../features/replacement/domain/repositories/replacement_repository.dart'
    as _i520;
import '../../features/replacement/domain/usecases/submit_replacement_request.dart'
    as _i1013;
import '../../features/replacement/presentation/providers/replacement_provider.dart'
    as _i985;
import '../../features/reviews/data/datasources/review_remote_datasource.dart'
    as _i130;
import '../../features/reviews/data/repositories/review_repository_impl.dart'
    as _i29;
import '../../features/reviews/domain/repositories/review_repository.dart'
    as _i985;
import '../../features/reviews/domain/usecases/get_reviewable_item.dart'
    as _i608;
import '../../features/reviews/domain/usecases/has_existing_review.dart'
    as _i1048;
import '../../features/reviews/domain/usecases/submit_review.dart' as _i225;
import '../../features/reviews/presentation/providers/reviews_provider.dart'
    as _i1064;
import '../../features/search/data/datasources/search_local_datasource.dart'
    as _i751;
import '../../features/search/data/datasources/search_remote_datasource.dart'
    as _i879;
import '../../features/search/data/repositories/search_repository_impl.dart'
    as _i1017;
import '../../features/search/domain/repositories/search_repository.dart'
    as _i357;
import '../../features/search/domain/usecases/add_recent_search.dart' as _i710;
import '../../features/search/domain/usecases/clear_recent_searches.dart'
    as _i614;
import '../../features/search/domain/usecases/get_recent_searches.dart'
    as _i869;
import '../../features/search/domain/usecases/remove_recent_search.dart'
    as _i591;
import '../../features/search/domain/usecases/search_products.dart' as _i815;
import '../../features/search/presentation/providers/search_provider.dart'
    as _i88;
import '../../features/settings/data/datasources/settings_remote_datasource.dart'
    as _i140;
import '../../features/settings/data/repositories/settings_repository_impl.dart'
    as _i955;
import '../../features/settings/domain/repositories/settings_repository.dart'
    as _i674;
import '../../features/settings/domain/usecases/get_general_settings.dart'
    as _i123;
import '../../features/settings/presentation/providers/general_settings_provider.dart'
    as _i449;
import '../../features/spinner/data/datasources/spinner_remote_datasource.dart'
    as _i792;
import '../../features/spinner/data/repositories/spinner_repository_impl.dart'
    as _i448;
import '../../features/spinner/domain/repositories/spinner_repository.dart'
    as _i165;
import '../../features/spinner/domain/usecases/get_active_campaign.dart'
    as _i65;
import '../../features/spinner/domain/usecases/get_my_coupons.dart' as _i87;
import '../../features/spinner/domain/usecases/get_spin_availability.dart'
    as _i586;
import '../../features/spinner/domain/usecases/spin_the_wheel.dart' as _i806;
import '../../features/spinner/presentation/providers/spinner_provider.dart'
    as _i1011;
import '../../features/wallet/data/datasources/wallet_remote_datasource.dart'
    as _i684;
import '../../features/wallet/data/repositories/wallet_repository_impl.dart'
    as _i690;
import '../../features/wallet/domain/repositories/wallet_repository.dart'
    as _i571;
import '../../features/wallet/domain/usecases/create_wallet_top_up_order.dart'
    as _i517;
import '../../features/wallet/domain/usecases/get_wallet_breakdown.dart'
    as _i1053;
import '../../features/wallet/domain/usecases/get_wallet_transactions.dart'
    as _i346;
import '../../features/wallet/domain/usecases/verify_wallet_top_up.dart'
    as _i655;
import '../../features/wallet/domain/usecases/watch_wallet_balance.dart'
    as _i767;
import '../../features/wallet/presentation/providers/wallet_provider.dart'
    as _i463;
import '../../features/wishlist/data/datasources/wishlist_remote_datasource.dart'
    as _i529;
import '../../features/wishlist/data/repositories/wishlist_repository_impl.dart'
    as _i919;
import '../../features/wishlist/domain/repositories/wishlist_repository.dart'
    as _i4;
import '../../features/wishlist/domain/usecases/add_to_wishlist.dart' as _i1071;
import '../../features/wishlist/domain/usecases/is_wishlisted.dart' as _i286;
import '../../features/wishlist/domain/usecases/remove_from_wishlist.dart'
    as _i28;
import '../../features/wishlist/domain/usecases/watch_wishlist_product_ids.dart'
    as _i160;
import '../../features/wishlist/presentation/providers/wishlist_provider.dart'
    as _i915;
import '../network/network_info.dart' as _i932;
import '../services/storage_service.dart' as _i306;
import 'register_module.dart' as _i291;

extension GetItInjectableX on _i174.GetIt {
// initializes the registration of main-scope dependencies inside of GetIt
  Future<_i174.GetIt> init({
    String? environment,
    _i526.EnvironmentFilter? environmentFilter,
  }) async {
    final gh = _i526.GetItHelper(
      this,
      environment,
      environmentFilter,
    );
    final registerModule = _$RegisterModule();
    await gh.factoryAsync<_i460.SharedPreferences>(
      () => registerModule.prefs,
      preResolve: true,
    );
    gh.factory<_i427.ValidateCoupon>(() => const _i427.ValidateCoupon());
    gh.lazySingleton<_i59.FirebaseAuth>(() => registerModule.firebaseAuth);
    gh.lazySingleton<_i974.FirebaseFirestore>(() => registerModule.firestore);
    gh.lazySingleton<_i457.FirebaseStorage>(() => registerModule.storage);
    gh.lazySingleton<_i892.FirebaseMessaging>(() => registerModule.messaging);
    gh.lazySingleton<_i895.Connectivity>(() => registerModule.connectivity);
    gh.lazySingleton<_i809.FirebaseFunctions>(() => registerModule.functions);
    gh.lazySingleton<_i792.SpinnerRemoteDataSource>(
        () => _i792.SpinnerRemoteDataSourceImpl(
              gh<_i974.FirebaseFirestore>(),
              gh<_i59.FirebaseAuth>(),
              gh<_i809.FirebaseFunctions>(),
            ));
    gh.lazySingleton<_i251.IfscRemoteDataSource>(
        () => _i251.IfscRemoteDataSourceImpl());
    gh.lazySingleton<_i161.AuthRemoteDataSource>(
        () => _i161.AuthRemoteDataSourceImpl(
              gh<_i59.FirebaseAuth>(),
              gh<_i974.FirebaseFirestore>(),
              gh<_i457.FirebaseStorage>(),
              gh<_i809.FirebaseFunctions>(),
              gh<_i892.FirebaseMessaging>(),
            ));
    gh.lazySingleton<_i529.WishlistRemoteDataSource>(
        () => _i529.WishlistRemoteDataSourceImpl(
              gh<_i59.FirebaseAuth>(),
              gh<_i974.FirebaseFirestore>(),
            ));
    gh.lazySingleton<_i182.AddressRemoteDataSource>(
        () => _i182.AddressRemoteDataSourceImpl(
              gh<_i974.FirebaseFirestore>(),
              gh<_i59.FirebaseAuth>(),
            ));
    gh.lazySingleton<_i165.SpinnerRepository>(
        () => _i448.SpinnerRepositoryImpl(gh<_i792.SpinnerRemoteDataSource>()));
    gh.lazySingleton<_i787.AuthRepository>(
        () => _i153.AuthRepositoryImpl(gh<_i161.AuthRemoteDataSource>()));
    gh.lazySingleton<_i278.HomeRemoteDataSource>(
        () => _i278.HomeRemoteDataSourceImpl(gh<_i974.FirebaseFirestore>()));
    gh.lazySingleton<_i633.CouponRemoteDataSource>(
        () => _i633.CouponRemoteDataSourceImpl(gh<_i974.FirebaseFirestore>()));
    gh.lazySingleton<_i1007.OrderRemoteDataSource>(
        () => _i1007.OrderRemoteDataSourceImpl(
              gh<_i59.FirebaseAuth>(),
              gh<_i974.FirebaseFirestore>(),
              gh<_i809.FirebaseFunctions>(),
            ));
    gh.lazySingleton<_i26.CheckoutRemoteDataSource>(
        () => _i26.CheckoutRemoteDataSourceImpl(
              gh<_i809.FirebaseFunctions>(),
              gh<_i974.FirebaseFirestore>(),
            ));
    gh.lazySingleton<_i923.NotificationRemoteDataSource>(
        () => _i923.NotificationRemoteDataSourceImpl(
              gh<_i974.FirebaseFirestore>(),
              gh<_i59.FirebaseAuth>(),
            ));
    gh.lazySingleton<_i333.ProductRemoteDataSource>(
        () => _i333.ProductRemoteDataSourceImpl(gh<_i974.FirebaseFirestore>()));
    gh.factory<_i224.ClearFcmToken>(
        () => _i224.ClearFcmToken(gh<_i787.AuthRepository>()));
    gh.factory<_i800.CreateProfile>(
        () => _i800.CreateProfile(gh<_i787.AuthRepository>()));
    gh.factory<_i152.ResendOtp>(
        () => _i152.ResendOtp(gh<_i787.AuthRepository>()));
    gh.factory<_i727.SendOtp>(() => _i727.SendOtp(gh<_i787.AuthRepository>()));
    gh.factory<_i568.SignOut>(() => _i568.SignOut(gh<_i787.AuthRepository>()));
    gh.factory<_i789.SyncFcmToken>(
        () => _i789.SyncFcmToken(gh<_i787.AuthRepository>()));
    gh.factory<_i126.UploadProfilePhoto>(
        () => _i126.UploadProfilePhoto(gh<_i787.AuthRepository>()));
    gh.factory<_i975.VerifyOtp>(
        () => _i975.VerifyOtp(gh<_i787.AuthRepository>()));
    gh.factory<_i28.WatchAuthUser>(
        () => _i28.WatchAuthUser(gh<_i787.AuthRepository>()));
    gh.factory<_i859.WatchFcmTokenRefresh>(
        () => _i859.WatchFcmTokenRefresh(gh<_i787.AuthRepository>()));
    gh.lazySingleton<_i306.StorageService>(
        () => _i306.StorageService(gh<_i457.FirebaseStorage>()));
    gh.lazySingleton<_i342.AffiliateRemoteDataSource>(
        () => _i342.AffiliateRemoteDataSourceImpl(
              gh<_i974.FirebaseFirestore>(),
              gh<_i59.FirebaseAuth>(),
            ));
    gh.lazySingleton<_i684.WalletRemoteDataSource>(
        () => _i684.WalletRemoteDataSourceImpl(
              gh<_i974.FirebaseFirestore>(),
              gh<_i809.FirebaseFunctions>(),
            ));
    gh.lazySingleton<_i463.AddressRepository>(
        () => _i590.AddressRepositoryImpl(gh<_i182.AddressRemoteDataSource>()));
    gh.lazySingleton<_i390.CategoryRemoteDataSource>(() =>
        _i390.CategoryRemoteDataSourceImpl(gh<_i974.FirebaseFirestore>()));
    gh.lazySingleton<_i932.NetworkInfo>(
        () => _i932.NetworkInfoImpl(gh<_i895.Connectivity>()));
    gh.lazySingleton<_i879.SearchRemoteDataSource>(
        () => _i879.SearchRemoteDataSourceImpl(gh<_i974.FirebaseFirestore>()));
    gh.lazySingleton<_i751.SearchLocalDataSource>(
        () => _i751.SearchLocalDataSourceImpl(gh<_i460.SharedPreferences>()));
    gh.lazySingleton<_i339.CartLocalDataSource>(
        () => _i339.CartLocalDataSourceImpl(gh<_i460.SharedPreferences>()));
    gh.lazySingleton<_i871.ProductDetailRemoteDataSource>(() =>
        _i871.ProductDetailRemoteDataSourceImpl(gh<_i974.FirebaseFirestore>()));
    gh.lazySingleton<_i1067.PushService>(() => _i1067.PushService(
          gh<_i892.FirebaseMessaging>(),
          gh<_i974.FirebaseFirestore>(),
          gh<_i59.FirebaseAuth>(),
        ));
    gh.lazySingleton<_i963.ProductRepository>(
        () => _i764.ProductRepositoryImpl(gh<_i333.ProductRemoteDataSource>()));
    gh.lazySingleton<_i372.NotificationLocalDataSource>(() =>
        _i372.NotificationLocalDataSourceImpl(gh<_i460.SharedPreferences>()));
    gh.factory<_i65.GetActiveCampaign>(
        () => _i65.GetActiveCampaign(gh<_i165.SpinnerRepository>()));
    gh.factory<_i87.GetMyCoupons>(
        () => _i87.GetMyCoupons(gh<_i165.SpinnerRepository>()));
    gh.factory<_i586.GetSpinAvailability>(
        () => _i586.GetSpinAvailability(gh<_i165.SpinnerRepository>()));
    gh.factory<_i806.SpinTheWheel>(
        () => _i806.SpinTheWheel(gh<_i165.SpinnerRepository>()));
    gh.lazySingleton<_i130.ReviewRemoteDataSource>(
        () => _i130.ReviewRemoteDataSourceImpl(
              gh<_i974.FirebaseFirestore>(),
              gh<_i306.StorageService>(),
            ));
    gh.lazySingleton<_i0.HomeRepository>(
        () => _i76.HomeRepositoryImpl(gh<_i278.HomeRemoteDataSource>()));
    gh.lazySingleton<_i140.SettingsRemoteDataSource>(() =>
        _i140.SettingsRemoteDataSourceImpl(gh<_i974.FirebaseFirestore>()));
    gh.lazySingleton<_i15.CartRemoteDataSource>(
        () => _i15.CartRemoteDataSourceImpl(gh<_i974.FirebaseFirestore>()));
    gh.lazySingleton<_i4.WishlistRepository>(() =>
        _i919.WishlistRepositoryImpl(gh<_i529.WishlistRemoteDataSource>()));
    gh.lazySingleton<_i357.SearchRepository>(() => _i1017.SearchRepositoryImpl(
          gh<_i879.SearchRemoteDataSource>(),
          gh<_i751.SearchLocalDataSource>(),
        ));
    gh.lazySingleton<_i103.ReplacementRemoteDataSource>(
        () => _i103.ReplacementRemoteDataSourceImpl(
              gh<_i59.FirebaseAuth>(),
              gh<_i974.FirebaseFirestore>(),
              gh<_i306.StorageService>(),
            ));
    gh.lazySingleton<_i266.CategoryRepository>(() =>
        _i894.CategoryRepositoryImpl(gh<_i390.CategoryRemoteDataSource>()));
    gh.lazySingleton<_i985.ReviewRepository>(
        () => _i29.ReviewRepositoryImpl(gh<_i130.ReviewRemoteDataSource>()));
    gh.lazySingleton<_i1.AffiliateRepository>(
        () => _i833.AffiliateRepositoryImpl(
              gh<_i342.AffiliateRemoteDataSource>(),
              gh<_i251.IfscRemoteDataSource>(),
            ));
    gh.factory<_i872.GetCategories>(
        () => _i872.GetCategories(gh<_i266.CategoryRepository>()));
    gh.factory<_i777.GetCategoryById>(
        () => _i777.GetCategoryById(gh<_i266.CategoryRepository>()));
    gh.lazySingleton<_i322.CartRepository>(
        () => _i642.CartRepositoryImpl(gh<_i339.CartLocalDataSource>()));
    gh.lazySingleton<_i498.CheckoutRepository>(() =>
        _i949.CheckoutRepositoryImpl(gh<_i26.CheckoutRemoteDataSource>()));
    gh.lazySingleton<_i173.CouponRepository>(
        () => _i957.CouponRepositoryImpl(gh<_i633.CouponRemoteDataSource>()));
    gh.lazySingleton<_i571.WalletRepository>(
        () => _i690.WalletRepositoryImpl(gh<_i684.WalletRemoteDataSource>()));
    gh.factory<_i1071.CategoriesProvider>(() => _i1071.CategoriesProvider(
          gh<_i872.GetCategories>(),
          gh<_i777.GetCategoryById>(),
        ));
    gh.factory<_i947.GetAddresses>(
        () => _i947.GetAddresses(gh<_i463.AddressRepository>()));
    gh.factory<_i947.AddAddress>(
        () => _i947.AddAddress(gh<_i463.AddressRepository>()));
    gh.factory<_i947.UpdateAddress>(
        () => _i947.UpdateAddress(gh<_i463.AddressRepository>()));
    gh.factory<_i947.DeleteAddress>(
        () => _i947.DeleteAddress(gh<_i463.AddressRepository>()));
    gh.factory<_i947.SetDefaultAddress>(
        () => _i947.SetDefaultAddress(gh<_i463.AddressRepository>()));
    gh.factory<_i643.GetCommissions>(
        () => _i643.GetCommissions(gh<_i1.AffiliateRepository>()));
    gh.factory<_i643.GetWithdrawals>(
        () => _i643.GetWithdrawals(gh<_i1.AffiliateRepository>()));
    gh.factory<_i643.GetBankAccounts>(
        () => _i643.GetBankAccounts(gh<_i1.AffiliateRepository>()));
    gh.factory<_i643.AddBankAccount>(
        () => _i643.AddBankAccount(gh<_i1.AffiliateRepository>()));
    gh.factory<_i643.DeleteBankAccount>(
        () => _i643.DeleteBankAccount(gh<_i1.AffiliateRepository>()));
    gh.factory<_i643.CreateWithdrawal>(
        () => _i643.CreateWithdrawal(gh<_i1.AffiliateRepository>()));
    gh.factory<_i643.VerifyIfsc>(
        () => _i643.VerifyIfsc(gh<_i1.AffiliateRepository>()));
    gh.factory<_i517.CreateWalletTopUpOrder>(
        () => _i517.CreateWalletTopUpOrder(gh<_i571.WalletRepository>()));
    gh.factory<_i1053.GetWalletBreakdown>(
        () => _i1053.GetWalletBreakdown(gh<_i571.WalletRepository>()));
    gh.factory<_i346.GetWalletTransactions>(
        () => _i346.GetWalletTransactions(gh<_i571.WalletRepository>()));
    gh.factory<_i655.VerifyWalletTopUp>(
        () => _i655.VerifyWalletTopUp(gh<_i571.WalletRepository>()));
    gh.factory<_i767.WatchWalletBalance>(
        () => _i767.WatchWalletBalance(gh<_i571.WalletRepository>()));
    gh.factory<_i710.AddRecentSearch>(
        () => _i710.AddRecentSearch(gh<_i357.SearchRepository>()));
    gh.factory<_i614.ClearRecentSearches>(
        () => _i614.ClearRecentSearches(gh<_i357.SearchRepository>()));
    gh.factory<_i869.GetRecentSearches>(
        () => _i869.GetRecentSearches(gh<_i357.SearchRepository>()));
    gh.factory<_i591.RemoveRecentSearch>(
        () => _i591.RemoveRecentSearch(gh<_i357.SearchRepository>()));
    gh.factory<_i815.SearchProducts>(
        () => _i815.SearchProducts(gh<_i357.SearchRepository>()));
    gh.factory<_i1011.SpinnerProvider>(() => _i1011.SpinnerProvider(
          gh<_i65.GetActiveCampaign>(),
          gh<_i586.GetSpinAvailability>(),
          gh<_i806.SpinTheWheel>(),
          gh<_i87.GetMyCoupons>(),
        ));
    gh.factory<_i385.AddressProvider>(() => _i385.AddressProvider(
          gh<_i947.GetAddresses>(),
          gh<_i947.AddAddress>(),
          gh<_i947.UpdateAddress>(),
          gh<_i947.DeleteAddress>(),
          gh<_i947.SetDefaultAddress>(),
        ));
    gh.factory<_i1054.AuthProvider>(() => _i1054.AuthProvider(
          gh<_i727.SendOtp>(),
          gh<_i975.VerifyOtp>(),
          gh<_i152.ResendOtp>(),
          gh<_i800.CreateProfile>(),
          gh<_i568.SignOut>(),
          gh<_i126.UploadProfilePhoto>(),
          gh<_i28.WatchAuthUser>(),
          gh<_i789.SyncFcmToken>(),
          gh<_i859.WatchFcmTokenRefresh>(),
          gh<_i224.ClearFcmToken>(),
        ));
    gh.factory<_i357.GetFirstVariants>(
        () => _i357.GetFirstVariants(gh<_i963.ProductRepository>()));
    gh.factory<_i143.GetProducts>(
        () => _i143.GetProducts(gh<_i963.ProductRepository>()));
    gh.lazySingleton<_i674.SettingsRepository>(() =>
        _i955.SettingsRepositoryImpl(gh<_i140.SettingsRemoteDataSource>()));
    gh.lazySingleton<_i543.OrderRepository>(
        () => _i376.OrderRepositoryImpl(gh<_i1007.OrderRemoteDataSource>()));
    gh.factory<_i123.GetGeneralSettings>(
        () => _i123.GetGeneralSettings(gh<_i674.SettingsRepository>()));
    gh.lazySingleton<_i327.ProfileRemoteDataSource>(
        () => _i327.ProfileRemoteDataSourceImpl(
              gh<_i974.FirebaseFirestore>(),
              gh<_i306.StorageService>(),
            ));
    gh.lazySingleton<_i520.ReplacementRepository>(() =>
        _i887.ReplacementRepositoryImpl(
            gh<_i103.ReplacementRemoteDataSource>()));
    gh.lazySingleton<_i550.ProductDetailRepository>(() =>
        _i628.ProductDetailRepositoryImpl(
            gh<_i871.ProductDetailRemoteDataSource>()));
    gh.factory<_i1071.AddToWishlist>(
        () => _i1071.AddToWishlist(gh<_i4.WishlistRepository>()));
    gh.factory<_i286.IsWishlisted>(
        () => _i286.IsWishlisted(gh<_i4.WishlistRepository>()));
    gh.factory<_i28.RemoveFromWishlist>(
        () => _i28.RemoveFromWishlist(gh<_i4.WishlistRepository>()));
    gh.factory<_i160.WatchWishlistProductIds>(
        () => _i160.WatchWishlistProductIds(gh<_i4.WishlistRepository>()));
    gh.factory<_i449.GeneralSettingsProvider>(
        () => _i449.GeneralSettingsProvider(gh<_i123.GetGeneralSettings>()));
    gh.factory<_i606.GetBanners>(
        () => _i606.GetBanners(gh<_i0.HomeRepository>()));
    gh.factory<_i449.GetFeaturedProducts>(
        () => _i449.GetFeaturedProducts(gh<_i0.HomeRepository>()));
    gh.factory<_i535.GetFirstVariants>(
        () => _i535.GetFirstVariants(gh<_i0.HomeRepository>()));
    gh.factory<_i862.GetFlashSaleEndDate>(
        () => _i862.GetFlashSaleEndDate(gh<_i0.HomeRepository>()));
    gh.factory<_i369.GetFlashSaleProducts>(
        () => _i369.GetFlashSaleProducts(gh<_i0.HomeRepository>()));
    gh.factory<_i159.GetHomeCategories>(
        () => _i159.GetHomeCategories(gh<_i0.HomeRepository>()));
    gh.factory<_i1061.GetNewArrivals>(
        () => _i1061.GetNewArrivals(gh<_i0.HomeRepository>()));
    gh.factory<_i161.GetProductsByCategory>(
        () => _i161.GetProductsByCategory(gh<_i0.HomeRepository>()));
    gh.lazySingleton<_i367.NotificationRepository>(
        () => _i361.NotificationRepositoryImpl(
              gh<_i923.NotificationRemoteDataSource>(),
              gh<_i372.NotificationLocalDataSource>(),
            ));
    gh.lazySingleton<_i88.CartPricingRepository>(
        () => _i810.CartPricingRepositoryImpl(gh<_i15.CartRemoteDataSource>()));
    gh.factory<_i807.FindCouponByCode>(
        () => _i807.FindCouponByCode(gh<_i173.CouponRepository>()));
    gh.factory<_i538.GetActiveCoupons>(
        () => _i538.GetActiveCoupons(gh<_i173.CouponRepository>()));
    gh.factory<_i88.SearchProvider>(() => _i88.SearchProvider(
          gh<_i815.SearchProducts>(),
          gh<_i869.GetRecentSearches>(),
          gh<_i710.AddRecentSearch>(),
          gh<_i591.RemoveRecentSearch>(),
          gh<_i614.ClearRecentSearches>(),
        ));
    gh.factory<_i608.GetReviewableItem>(
        () => _i608.GetReviewableItem(gh<_i985.ReviewRepository>()));
    gh.factory<_i1048.HasExistingReview>(
        () => _i1048.HasExistingReview(gh<_i985.ReviewRepository>()));
    gh.factory<_i225.SubmitReview>(
        () => _i225.SubmitReview(gh<_i985.ReviewRepository>()));
    gh.factory<_i741.PlaceOrder>(
        () => _i741.PlaceOrder(gh<_i498.CheckoutRepository>()));
    gh.factory<_i741.VerifyPayment>(
        () => _i741.VerifyPayment(gh<_i498.CheckoutRepository>()));
    gh.factory<_i741.GetOrderPayment>(
        () => _i741.GetOrderPayment(gh<_i498.CheckoutRepository>()));
    gh.factory<_i741.ReleaseAbandonedOrder>(
        () => _i741.ReleaseAbandonedOrder(gh<_i498.CheckoutRepository>()));
    gh.factory<_i286.AffiliateProvider>(() => _i286.AffiliateProvider(
          gh<_i643.GetCommissions>(),
          gh<_i643.GetWithdrawals>(),
          gh<_i643.GetBankAccounts>(),
          gh<_i643.AddBankAccount>(),
          gh<_i643.DeleteBankAccount>(),
          gh<_i643.CreateWithdrawal>(),
          gh<_i643.VerifyIfsc>(),
        ));
    gh.factory<_i868.AddToCart>(
        () => _i868.AddToCart(gh<_i322.CartRepository>()));
    gh.factory<_i387.ClearCart>(
        () => _i387.ClearCart(gh<_i322.CartRepository>()));
    gh.factory<_i912.GetCart>(() => _i912.GetCart(gh<_i322.CartRepository>()));
    gh.factory<_i904.RemoveFromCart>(
        () => _i904.RemoveFromCart(gh<_i322.CartRepository>()));
    gh.factory<_i556.UpdateQuantity>(
        () => _i556.UpdateQuantity(gh<_i322.CartRepository>()));
    gh.factory<_i389.ProductListingProvider>(() => _i389.ProductListingProvider(
          gh<_i143.GetProducts>(),
          gh<_i357.GetFirstVariants>(),
        ));
    gh.factory<_i1064.ReviewsProvider>(() => _i1064.ReviewsProvider(
          gh<_i608.GetReviewableItem>(),
          gh<_i1048.HasExistingReview>(),
          gh<_i225.SubmitReview>(),
        ));
    gh.factory<_i526.HomeProvider>(() => _i526.HomeProvider(
          gh<_i606.GetBanners>(),
          gh<_i159.GetHomeCategories>(),
          gh<_i369.GetFlashSaleProducts>(),
          gh<_i1061.GetNewArrivals>(),
          gh<_i862.GetFlashSaleEndDate>(),
          gh<_i535.GetFirstVariants>(),
          gh<_i161.GetProductsByCategory>(),
        ));
    gh.factory<_i1013.SubmitReplacementRequest>(() =>
        _i1013.SubmitReplacementRequest(gh<_i520.ReplacementRepository>()));
    gh.factory<_i463.WalletProvider>(() => _i463.WalletProvider(
          gh<_i767.WatchWalletBalance>(),
          gh<_i346.GetWalletTransactions>(),
          gh<_i1053.GetWalletBreakdown>(),
          gh<_i517.CreateWalletTopUpOrder>(),
          gh<_i655.VerifyWalletTopUp>(),
        ));
    gh.factory<_i238.CheckoutProvider>(() => _i238.CheckoutProvider(
          gh<_i741.PlaceOrder>(),
          gh<_i741.VerifyPayment>(),
          gh<_i741.GetOrderPayment>(),
          gh<_i741.ReleaseAbandonedOrder>(),
        ));
    gh.lazySingleton<_i894.ProfileRepository>(
        () => _i334.ProfileRepositoryImpl(gh<_i327.ProfileRemoteDataSource>()));
    gh.factory<_i216.FetchCartDetails>(
        () => _i216.FetchCartDetails(gh<_i88.CartPricingRepository>()));
    gh.factory<_i594.CancelOrder>(
        () => _i594.CancelOrder(gh<_i543.OrderRepository>()));
    gh.factory<_i190.GenerateInvoice>(
        () => _i190.GenerateInvoice(gh<_i543.OrderRepository>()));
    gh.factory<_i353.GetInvoiceBusiness>(
        () => _i353.GetInvoiceBusiness(gh<_i543.OrderRepository>()));
    gh.factory<_i940.GetItemReplacement>(
        () => _i940.GetItemReplacement(gh<_i543.OrderRepository>()));
    gh.factory<_i43.GetOrderById>(
        () => _i43.GetOrderById(gh<_i543.OrderRepository>()));
    gh.factory<_i941.GetOrders>(
        () => _i941.GetOrders(gh<_i543.OrderRepository>()));
    gh.factory<_i965.GetReturnStatuses>(
        () => _i965.GetReturnStatuses(gh<_i543.OrderRepository>()));
    gh.factory<_i412.GetBroadcastNotifications>(() =>
        _i412.GetBroadcastNotifications(gh<_i367.NotificationRepository>()));
    gh.factory<_i501.GetPersonalNotifications>(() =>
        _i501.GetPersonalNotifications(gh<_i367.NotificationRepository>()));
    gh.factory<_i619.GetReadNotificationIds>(
        () => _i619.GetReadNotificationIds(gh<_i367.NotificationRepository>()));
    gh.factory<_i852.MarkAllNotificationsRead>(() =>
        _i852.MarkAllNotificationsRead(gh<_i367.NotificationRepository>()));
    gh.factory<_i29.MarkNotificationRead>(
        () => _i29.MarkNotificationRead(gh<_i367.NotificationRepository>()));
    gh.factory<_i598.GetBundleProducts>(
        () => _i598.GetBundleProducts(gh<_i550.ProductDetailRepository>()));
    gh.factory<_i892.GetProductDetail>(
        () => _i892.GetProductDetail(gh<_i550.ProductDetailRepository>()));
    gh.factory<_i301.GetProductVariants>(
        () => _i301.GetProductVariants(gh<_i550.ProductDetailRepository>()));
    gh.factory<_i17.GetRecentProductReviews>(() =>
        _i17.GetRecentProductReviews(gh<_i550.ProductDetailRepository>()));
    gh.factory<_i52.CouponProvider>(() => _i52.CouponProvider(
          gh<_i538.GetActiveCoupons>(),
          gh<_i807.FindCouponByCode>(),
          gh<_i427.ValidateCoupon>(),
        ));
    gh.factory<_i457.DeleteAccount>(
        () => _i457.DeleteAccount(gh<_i894.ProfileRepository>()));
    gh.factory<_i78.UpdateProfile>(
        () => _i78.UpdateProfile(gh<_i894.ProfileRepository>()));
    gh.factory<_i535.UploadProfilePhoto>(
        () => _i535.UploadProfilePhoto(gh<_i894.ProfileRepository>()));
    gh.factory<_i472.WatchUser>(
        () => _i472.WatchUser(gh<_i894.ProfileRepository>()));
    gh.factory<_i915.WishlistProvider>(() => _i915.WishlistProvider(
          gh<_i160.WatchWishlistProductIds>(),
          gh<_i1071.AddToWishlist>(),
          gh<_i28.RemoveFromWishlist>(),
        ));
    gh.factory<_i388.OrdersProvider>(() => _i388.OrdersProvider(
          gh<_i941.GetOrders>(),
          gh<_i892.GetProductDetail>(),
          gh<_i301.GetProductVariants>(),
          gh<_i965.GetReturnStatuses>(),
        ));
    gh.factory<_i506.NotificationsProvider>(() => _i506.NotificationsProvider(
          gh<_i412.GetBroadcastNotifications>(),
          gh<_i501.GetPersonalNotifications>(),
          gh<_i619.GetReadNotificationIds>(),
          gh<_i29.MarkNotificationRead>(),
          gh<_i852.MarkAllNotificationsRead>(),
        ));
    gh.factory<_i847.ProductDetailProvider>(() => _i847.ProductDetailProvider(
          gh<_i892.GetProductDetail>(),
          gh<_i301.GetProductVariants>(),
          gh<_i598.GetBundleProducts>(),
          gh<_i17.GetRecentProductReviews>(),
          gh<_i143.GetProducts>(),
          gh<_i357.GetFirstVariants>(),
        ));
    gh.factory<_i365.CartProvider>(() => _i365.CartProvider(
          gh<_i912.GetCart>(),
          gh<_i868.AddToCart>(),
          gh<_i904.RemoveFromCart>(),
          gh<_i556.UpdateQuantity>(),
          gh<_i387.ClearCart>(),
          gh<_i216.FetchCartDetails>(),
        ));
    gh.factory<_i985.ReplacementProvider>(
        () => _i985.ReplacementProvider(gh<_i1013.SubmitReplacementRequest>()));
    gh.factory<_i919.ProfileProvider>(() => _i919.ProfileProvider(
          gh<_i472.WatchUser>(),
          gh<_i78.UpdateProfile>(),
          gh<_i535.UploadProfilePhoto>(),
          gh<_i457.DeleteAccount>(),
          gh<_i568.SignOut>(),
          gh<_i224.ClearFcmToken>(),
        ));
    gh.factory<_i462.OrderDetailProvider>(() => _i462.OrderDetailProvider(
          gh<_i43.GetOrderById>(),
          gh<_i940.GetItemReplacement>(),
          gh<_i892.GetProductDetail>(),
          gh<_i594.CancelOrder>(),
          gh<_i190.GenerateInvoice>(),
          gh<_i353.GetInvoiceBusiness>(),
        ));
    return this;
  }
}

class _$RegisterModule extends _i291.RegisterModule {}
