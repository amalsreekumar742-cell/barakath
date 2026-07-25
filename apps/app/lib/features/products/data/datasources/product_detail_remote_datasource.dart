import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:injectable/injectable.dart';

import '../../../../core/constants/firebase_collections.dart';
import '../../../../core/error/exceptions.dart';
import '../../../reviews/data/models/review_model.dart';
import '../models/product_model.dart';
import '../models/variant_model.dart';
import '../../../../core/error/firebase_error_message.dart';

/// The ONLY place the Product **Detail** screen touches Firestore.
///
/// WHY this lives apart from the listing datasource: the detail screen reads a
/// single document plus three satellite queries (variants, bundle items, recent
/// reviews) with completely different shapes from the paginated catalogue query.
/// Keeping them in separate files means the two screens can evolve (and be
/// edited) independently instead of fighting over one god-datasource.
abstract class ProductDetailRemoteDataSource {
  /// `products/{productId}`. Throws [ServerException] when the doc is missing.
  Future<ProductModel> getProduct(String productId);

  /// `products/{productId}/variants` ordered by `createdAt` ascending, so the
  /// first entry is the variant the merchant created first — the default
  /// selection on the detail screen.
  Future<List<VariantModel>> getVariants(String productId);

  /// The bundle / "frequently bought together" products for [productIds]
  /// (capped at 5) paired with each one's first variant for price display.
  Future<List<(ProductModel, VariantModel?)>> getBundleProducts(
    List<String> productIds,
  );

  /// The most recent published reviews for a product.
  Future<List<ReviewModel>> getRecentReviews(String productId, {int limit = 3});
}

@LazySingleton(as: ProductDetailRemoteDataSource)
class ProductDetailRemoteDataSourceImpl implements ProductDetailRemoteDataSource {
  ProductDetailRemoteDataSourceImpl(this._firestore);

  final FirebaseFirestore _firestore;

  /// A product can realistically carry a few dozen variants; the cap keeps the
  /// read bounded (no unbounded `.get()` — skill rule) without paginating a
  /// selector the user expects to see in full.
  static const int _variantLimit = 50;

  /// Firestore's `whereIn` accepts at most 30 values; the spec caps the bundle
  /// strip at 5 anyway.
  static const int _bundleLimit = 5;

  @override
  Future<ProductModel> getProduct(String productId) async {
    try {
      final doc = await _firestore
          .collection(FirebaseCollections.products)
          .doc(productId)
          .get();
      if (!doc.exists) {
        throw const ServerException('This product is no longer available.');
      }
      return ProductModel.fromFirestore(doc);
    } on FirebaseException catch (e) {
      throw ServerException(FirebaseErrorMessage.of(e) ?? 'Could not load this product.', e.code);
    }
  }

  @override
  Future<List<VariantModel>> getVariants(String productId) async {
    try {
      final snap = await _firestore
          .collection(FirebaseCollections.products)
          .doc(productId)
          .collection(FirebaseCollections.variants)
          .orderBy('createdAt')
          .limit(_variantLimit)
          .get();
      return snap.docs.map(VariantModel.fromFirestore).toList();
    } on FirebaseException catch (e) {
      throw ServerException(FirebaseErrorMessage.of(e) ?? 'Could not load variants.', e.code);
    }
  }

  @override
  Future<List<(ProductModel, VariantModel?)>> getBundleProducts(
    List<String> productIds,
  ) async {
    final ids = productIds.take(_bundleLimit).toList();
    if (ids.isEmpty) return const [];
    try {
      final snap = await _firestore
          .collection(FirebaseCollections.products)
          .where(FieldPath.documentId, whereIn: ids)
          .limit(_bundleLimit)
          .get();

      // Archived items must not be purchasable from the bundle strip.
      final products = snap.docs
          .map(ProductModel.fromFirestore)
          .where((p) => p.status != 'Archived')
          .toList();

      // whereIn returns documents in arbitrary order — restore the merchant's
      // authored ordering from `frequentlyBoughtTogether`.
      products.sort((a, b) => ids.indexOf(a.id).compareTo(ids.indexOf(b.id)));

      final firstVariants = await Future.wait(
        products.map((p) => _firstVariant(p.id)),
      );

      return [
        for (var i = 0; i < products.length; i++) (products[i], firstVariants[i]),
      ];
    } on FirebaseException catch (e) {
      throw ServerException(FirebaseErrorMessage.of(e) ?? 'Could not load bundle items.', e.code);
    }
  }

  @override
  Future<List<ReviewModel>> getRecentReviews(
    String productId, {
    int limit = 3,
  }) async {
    try {
      final snap = await _firestore
          .collection(FirebaseCollections.reviews)
          .where('productId', isEqualTo: productId)
          .where('isPublished', isEqualTo: true)
          .orderBy('createdAt', descending: true)
          .limit(limit)
          .get();
      return snap.docs.map(ReviewModel.fromFirestore).toList();
    } on FirebaseException catch (e) {
      throw ServerException(FirebaseErrorMessage.of(e) ?? 'Could not load reviews.', e.code);
    }
  }

  /// The cheapest way to price a bundle tile: one variant, not the whole
  /// subcollection.
  Future<VariantModel?> _firstVariant(String productId) async {
    final snap = await _firestore
        .collection(FirebaseCollections.products)
        .doc(productId)
        .collection(FirebaseCollections.variants)
        .orderBy('createdAt')
        .limit(1)
        .get();
    if (snap.docs.isEmpty) return null;
    return VariantModel.fromFirestore(snap.docs.first);
  }
}
