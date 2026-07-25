import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:injectable/injectable.dart';

import '../../../../core/constants/firebase_collections.dart';
import '../../../../core/error/exceptions.dart';
import '../../../../core/utils/model_parse.dart';
import '../../../categories/data/models/category_model.dart';
import '../../../products/data/models/product_model.dart';
import '../../../products/data/models/variant_model.dart';
import '../models/banner_model.dart';
import '../../../../core/error/firebase_error_message.dart';

/// The ONLY place that touches Firestore for the home screen (spec §2.6).
///
/// Every method is bounded by a `limit` — the home screen shows a teaser row per
/// section and hands off to a paginated listing for "View all", so it must never
/// read an unbounded collection.
abstract class HomeRemoteDataSource {
  /// Active banners placed on the App (`placement` of 'App' or 'Both'), ordered
  /// by `position`. Scheduling windows are applied client-side.
  Future<List<BannerModel>> getBanners({int limit});

  Future<List<CategoryModel>> getCategories({int limit});

  Future<List<ProductModel>> getFlashSaleProducts({int limit});

  Future<List<ProductModel>> getNewArrivals({int limit});

  /// "Featured" = the best-rated active products; there is no editorial
  /// featured flag in the schema.
  Future<List<ProductModel>> getFeaturedProducts({int limit});

  /// The newest Active products in one category — backs the per-category rows
  /// on the home screen.
  Future<List<ProductModel>> getProductsByCategory({
    required String categoryId,
    int limit,
  });

  /// The soonest end of a live flash sale, for the section countdown. `null`
  /// when nothing is running.
  Future<DateTime?> getFlashSaleEndDate();

  /// The FIRST variant of each of [productIds] — the one whose price, stock and
  /// images the product card renders. Products with no variants are absent.
  Future<Map<String, VariantModel>> getFirstVariants(Iterable<String> productIds);
}

@LazySingleton(as: HomeRemoteDataSource)
class HomeRemoteDataSourceImpl implements HomeRemoteDataSource {
  HomeRemoteDataSourceImpl(this._firestore);

  final FirebaseFirestore _firestore;

  /// Only sellable products reach the customer app; 'Archived' rows stay hidden
  /// everywhere, so every product query starts from this.
  Query<Map<String, dynamic>> get _activeProducts => _firestore
      .collection(FirebaseCollections.products)
      .where('status', isEqualTo: 'Active');

  @override
  Future<List<BannerModel>> getBanners({int limit = 6}) async {
    try {
      final snap = await _firestore
          .collection(FirebaseCollections.banners)
          .where('isActive', isEqualTo: true)
          .where('placement', whereIn: const ['App', 'Both'])
          .orderBy('position')
          .limit(limit)
          .get();

      // WHY the date window is filtered here and not in the query: adding two
      // range filters on startDate/endDate would need a different index and
      // would drop banners that leave either bound unset (which the admin
      // allows — an open-ended banner runs forever).
      final now = DateTime.now();
      return snap.docs
          .map(BannerModel.fromFirestore)
          .where((b) => _isLive(b.startDate, b.endDate, now))
          .toList();
    } on FirebaseException catch (e) {
      throw ServerException(FirebaseErrorMessage.of(e) ?? 'Could not load banners.', e.code);
    }
  }

  bool _isLive(DateTime? start, DateTime? end, DateTime now) {
    if (start != null && start.isAfter(now)) return false;
    if (end != null && end.isBefore(now)) return false;
    return true;
  }

  @override
  Future<List<CategoryModel>> getCategories({int limit = 10}) async {
    try {
      final snap = await _firestore
          .collection(FirebaseCollections.categories)
          .orderBy('createdAt')
          .limit(limit)
          .get();
      return snap.docs.map(CategoryModel.fromFirestore).toList();
    } on FirebaseException catch (e) {
      throw ServerException(FirebaseErrorMessage.of(e) ?? 'Could not load categories.', e.code);
    }
  }

  @override
  Future<List<ProductModel>> getFlashSaleProducts({int limit = 6}) =>
      _products(
        _activeProducts.where('isFlashSale', isEqualTo: true).limit(limit),
        'Could not load the flash sale.',
      );

  @override
  Future<List<ProductModel>> getNewArrivals({int limit = 6}) => _products(
        _activeProducts
            .where('isNewArrival', isEqualTo: true)
            .orderBy('createdAt', descending: true)
            .limit(limit),
        'Could not load new arrivals.',
      );

  @override
  Future<List<ProductModel>> getFeaturedProducts({int limit = 6}) => _products(
        _activeProducts
            .orderBy('averageRating', descending: true)
            .limit(limit),
        'Could not load featured products.',
      );

  @override
  Future<List<ProductModel>> getProductsByCategory({
    required String categoryId,
    int limit = 6,
  }) =>
      _products(
        _activeProducts
            .where('categoryId', isEqualTo: categoryId)
            .orderBy('createdAt', descending: true)
            .limit(limit),
        'Could not load this category.',
      );

  Future<List<ProductModel>> _products(
    Query<Map<String, dynamic>> query,
    String errorMessage,
  ) async {
    try {
      final snap = await query.get();
      return snap.docs.map(ProductModel.fromFirestore).toList();
    } on FirebaseException catch (e) {
      throw ServerException(FirebaseErrorMessage.of(e) ?? errorMessage, e.code);
    }
  }

  @override
  Future<DateTime?> getFlashSaleEndDate() async {
    try {
      // Only `isActive` is filtered server-side and the earliest live deadline is
      // picked in Dart: ordering by endDate alongside the equality filter
      // would need a composite index purely to save a handful of tiny docs.
      final snap = await _firestore
          .collection(FirebaseCollections.flashSales)
          .where('isActive', isEqualTo: true)
          .limit(20)
          .get();

      final now = DateTime.now();
      DateTime? earliest;
      for (final doc in snap.docs) {
        final end = ModelParse.dateTime(doc.data()['endDate']);
        if (end == null || !end.isAfter(now)) continue;
        if (earliest == null || end.isBefore(earliest)) earliest = end;
      }
      return earliest;
    } on FirebaseException catch (e) {
      throw ServerException(FirebaseErrorMessage.of(e) ?? 'Could not load the flash sale.', e.code);
    }
  }

  @override
  Future<Map<String, VariantModel>> getFirstVariants(
    Iterable<String> productIds,
  ) async {
    final ids = productIds.toSet();
    if (ids.isEmpty) return const {};
    try {
      // One 1-document subcollection read per product, all in flight together.
      // `whereIn` can't reach across subcollections, and a collection-group query
      // would return every variant of every product just to keep the first.
      final entries = await Future.wait(ids.map(_firstVariantOf));
      return {
        for (final entry in entries)
          if (entry.value != null) entry.key: entry.value!,
      };
    } on FirebaseException catch (e) {
      throw ServerException(FirebaseErrorMessage.of(e) ?? 'Could not load prices.', e.code);
    }
  }

  Future<MapEntry<String, VariantModel?>> _firstVariantOf(String productId) async {
    final snap = await _firestore
        .collection(FirebaseCollections.products)
        .doc(productId)
        .collection(FirebaseCollections.variants)
        .orderBy('createdAt')
        .limit(1)
        .get();
    return MapEntry(
      productId,
      snap.docs.isEmpty ? null : VariantModel.fromFirestore(snap.docs.first),
    );
  }
}
