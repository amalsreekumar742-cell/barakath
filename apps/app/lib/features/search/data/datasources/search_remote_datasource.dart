import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:injectable/injectable.dart';

import '../../../../core/constants/firebase_collections.dart';
import '../../../../core/error/exceptions.dart';
import '../../../products/data/models/product_model.dart';
import '../../../products/data/models/variant_model.dart';
import '../../../products/domain/entities/variant.dart';
import '../models/search_results_model.dart';
import '../../../../core/error/firebase_error_message.dart';

/// The ONLY place that queries Firestore for search (skill: Firebase lives in
/// datasources only). Throws [ServerException]; the repository converts it.
abstract class SearchRemoteDataSource {
  /// One page of Active products whose `keywords` array contains [query].
  /// [startAfter] must be the previous page's cursor (a `DocumentSnapshot`).
  Future<SearchResultsModel> searchProducts({
    required String query,
    required int limit,
    Object? startAfter,
  });
}

@LazySingleton(as: SearchRemoteDataSource)
class SearchRemoteDataSourceImpl implements SearchRemoteDataSource {
  SearchRemoteDataSourceImpl(this._firestore);

  final FirebaseFirestore _firestore;

  @override
  Future<SearchResultsModel> searchProducts({
    required String query,
    required int limit,
    Object? startAfter,
  }) async {
    // Keywords are stored lowercased (spec §4.23), so the needle must match.
    final needle = query.trim().toLowerCase();
    if (needle.isEmpty) {
      return const SearchResultsModel(
        products: [],
        firstVariants: {},
        nextCursor: null,
        hasMore: false,
      );
    }

    try {
      Query<Map<String, dynamic>> q = _firestore
          .collection(FirebaseCollections.products)
          .where('status', isEqualTo: 'Active')
          .where('keywords', arrayContains: needle)
          .orderBy('createdAt', descending: true)
          .limit(limit);

      if (startAfter is DocumentSnapshot) {
        q = q.startAfterDocument(startAfter);
      }

      final snap = await q.get();
      final products = snap.docs.map(ProductModel.fromFirestore).toList();

      return SearchResultsModel(
        products: products,
        firstVariants: await _loadFirstVariants(snap.docs),
        // Only the last doc of a full page can seed the next one.
        nextCursor: snap.docs.isEmpty ? null : snap.docs.last,
        // A short page means the result set is exhausted; a full page *might*
        // have more, and a wasted empty fetch is cheaper than a count query.
        hasMore: snap.docs.length == limit,
      );
    } on FirebaseException catch (e) {
      throw ServerException(FirebaseErrorMessage.of(e) ?? 'Search failed. Please try again.', e.code);
    }
  }

  /// Product cards price themselves from the first variant, so each result's
  /// variant subcollection is read alongside the page — in parallel, since a
  /// sequential loop would make a 10-item page 10 round trips deep.
  ///
  /// WHY ordered by `createdAt` with an unordered fallback: "first variant" has
  /// to mean the SAME variant on every surface, or the identical product shows
  /// one price in search and another in the listing (seen live: ₹150 vs ₹101).
  /// Home and the listing both order by `createdAt`, so search must too. The
  /// fallback covers the reason ordering was avoided in the first place — an
  /// ordered query silently drops docs missing the field, which would otherwise
  /// leave a card with no price at all.
  Future<Map<String, Variant>> _loadFirstVariants(
    List<QueryDocumentSnapshot<Map<String, dynamic>>> docs,
  ) async {
    final entries = await Future.wait(
      docs.map((doc) async {
        final variantsRef = doc.reference.collection(FirebaseCollections.variants);
        var variants = await variantsRef.orderBy('createdAt').limit(1).get();
        if (variants.docs.isEmpty) {
          variants = await variantsRef.limit(1).get();
        }
        if (variants.docs.isEmpty) return null;
        return MapEntry<String, Variant>(
          doc.id,
          VariantModel.fromFirestore(variants.docs.first),
        );
      }),
    );
    return Map<String, Variant>.fromEntries(entries.whereType<MapEntry<String, Variant>>());
  }
}
