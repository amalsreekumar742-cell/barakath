import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:injectable/injectable.dart';

import '../../../../core/constants/firebase_collections.dart';
import '../../../../core/error/exceptions.dart';
import '../../domain/repositories/product_repository.dart';
import '../models/product_model.dart';
import '../models/variant_model.dart';
import '../../../../core/error/firebase_error_message.dart';

/// The raw result of one listing query — models plus the Firestore cursor. Kept
/// in the data layer so the `DocumentSnapshot` type never escapes it.
class ProductPageDto {
  const ProductPageDto({
    required this.items,
    required this.nextCursor,
    required this.hasMore,
  });

  final List<ProductModel> items;
  final DocumentSnapshot<Map<String, dynamic>>? nextCursor;
  final bool hasMore;
}

/// Reads the `products` collection and its `variants` subcollection for the
/// listing surfaces. The ONLY place these Firebase reads live (skill: Firebase
/// in datasources only).
abstract class ProductRemoteDataSource {
  /// One cursor page of `Active` products. Throws [ServerException] on failure.
  Future<ProductPageDto> getProducts({
    String? categoryId,
    String? subCategory,
    bool newArrivalsOnly = false,
    bool flashSaleOnly = false,
    ProductSort sortBy = ProductSort.newest,
    int limit = 10,
    Object? startAfter,
  });

  /// The first variant of each product id (price/stock for the card).
  Future<Map<String, VariantModel>> getFirstVariants(List<String> productIds);
}

@LazySingleton(as: ProductRemoteDataSource)
class ProductRemoteDataSourceImpl implements ProductRemoteDataSource {
  ProductRemoteDataSourceImpl(this._firestore);

  final FirebaseFirestore _firestore;

  /// Sort → (field, descending) on the PRODUCT document.
  ///
  /// WHY it must be a product-doc field: Firestore cannot order a parent query
  /// by a subcollection field, and an `orderBy` on a field a document LACKS
  /// silently excludes that document — a wrong field name here doesn't error,
  /// it just returns an empty grid.
  ///
  /// So price sorts use the denormalised `minPrice`/`maxPrice` the admin writes
  /// onto `products` (cheapest variant ascending, dearest descending) — NOT the
  /// variant's `offerPrice`, which lives in the sub-collection.
  ///
  /// Popularity uses `totalReviews` as a stand-in: `products` has no sales
  /// counter yet. TODO(server): have a Cloud Function denormalise a `soldCount`
  /// onto the product on order completion, then switch this over.
  static const Map<ProductSort, (String, bool)> _order = {
    ProductSort.newest: ('createdAt', true),
    ProductSort.priceLowToHigh: ('minPrice', false),
    ProductSort.priceHighToLow: ('maxPrice', true),
    ProductSort.rating: ('averageRating', true),
    ProductSort.popularity: ('totalReviews', true),
  };

  @override
  Future<ProductPageDto> getProducts({
    String? categoryId,
    String? subCategory,
    bool newArrivalsOnly = false,
    bool flashSaleOnly = false,
    ProductSort sortBy = ProductSort.newest,
    int limit = 10,
    Object? startAfter,
  }) async {
    try {
      // Only live catalogue rows are ever shown to a customer.
      Query<Map<String, dynamic>> query = _firestore
          .collection(FirebaseCollections.products)
          .where('status', isEqualTo: 'Active');

      if (categoryId != null && categoryId.isNotEmpty) {
        query = query.where('categoryId', isEqualTo: categoryId);
      }
      // Matched by NAME, not id: the category doc only denormalises
      // `subCategoryNames`, which is what the UI navigates with.
      if (subCategory != null && subCategory.isNotEmpty) {
        query = query.where('subCategoryName', isEqualTo: subCategory);
      }
      if (newArrivalsOnly) {
        query = query.where('isNewArrival', isEqualTo: true);
      }
      // Home's Flash Sale "View All" lands here (`?flashSale=true`).
      if (flashSaleOnly) {
        query = query.where('isFlashSale', isEqualTo: true);
      }

      final (field, descending) = _order[sortBy] ?? _order[ProductSort.newest]!;
      query = query.orderBy(field, descending: descending);

      // startAfterDocument (not offset) — reads only the next page.
      if (startAfter is DocumentSnapshot<Map<String, dynamic>>) {
        query = query.startAfterDocument(startAfter);
      }

      final snap = await query.limit(limit).get();
      return ProductPageDto(
        items: snap.docs.map(ProductModel.fromFirestore).toList(),
        nextCursor: snap.docs.isEmpty ? null : snap.docs.last,
        hasMore: snap.docs.length == limit,
      );
    } on FirebaseException catch (e) {
      throw ServerException(FirebaseErrorMessage.of(e) ?? 'Could not load products.', e.code);
    }
  }

  @override
  Future<Map<String, VariantModel>> getFirstVariants(List<String> productIds) async {
    if (productIds.isEmpty) return const {};
    try {
      // One tiny limit(1) query per product, issued in parallel. A collection
      // group query can't be used here because it cannot be constrained to an
      // arbitrary set of parent documents.
      final results = await Future.wait(
        productIds.map((id) async {
          final snap = await _firestore
              .collection(FirebaseCollections.products)
              .doc(id)
              .collection(FirebaseCollections.variants)
              .orderBy('createdAt')
              .limit(1)
              .get();
          if (snap.docs.isEmpty) return null;
          return MapEntry(id, VariantModel.fromFirestore(snap.docs.first));
        }),
      );
      return Map.fromEntries(results.whereType<MapEntry<String, VariantModel>>());
    } on FirebaseException catch (e) {
      throw ServerException(FirebaseErrorMessage.of(e) ?? 'Could not load prices.', e.code);
    }
  }
}
