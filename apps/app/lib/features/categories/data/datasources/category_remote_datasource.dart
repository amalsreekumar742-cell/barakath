import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:injectable/injectable.dart';

import '../../../../core/constants/firebase_collections.dart';
import '../../../../core/error/exceptions.dart';
import '../models/category_model.dart';
import '../../../../core/error/firebase_error_message.dart';

/// Reads the `categories` collection. The ONLY place these Firebase reads live
/// (skill: Firebase in datasources only).
abstract class CategoryRemoteDataSource {
  /// Categories in admin display order (`createdAt` ascending), capped at
  /// [limit]. Throws [ServerException] on any read/parse failure.
  Future<List<CategoryModel>> getCategories({int limit});

  /// A single `categories/{id}` document. Throws [ServerException] when the
  /// document is missing or the read fails.
  Future<CategoryModel> getCategoryById(String id);
}

@LazySingleton(as: CategoryRemoteDataSource)
class CategoryRemoteDataSourceImpl implements CategoryRemoteDataSource {
  CategoryRemoteDataSourceImpl(this._firestore);

  final FirebaseFirestore _firestore;

  @override
  Future<List<CategoryModel>> getCategories({int limit = 50}) async {
    try {
      // WHY createdAt ascending: the admin panel treats creation order as the
      // catalogue's display order, so the app must not re-sort by name.
      // WHY a hard limit instead of a cursor: the whole category set is a small,
      // bounded admin-curated list rendered as one screen — 50 is a safety cap,
      // not a page.
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
  Future<CategoryModel> getCategoryById(String id) async {
    try {
      final doc = await _firestore
          .collection(FirebaseCollections.categories)
          .doc(id)
          .get();
      if (!doc.exists) {
        throw const ServerException('This category is no longer available.');
      }
      return CategoryModel.fromFirestore(doc);
    } on FirebaseException catch (e) {
      throw ServerException(FirebaseErrorMessage.of(e) ?? 'Could not load this category.', e.code);
    }
  }
}
