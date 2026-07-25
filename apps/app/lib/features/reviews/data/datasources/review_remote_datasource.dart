import 'dart:io';

import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:injectable/injectable.dart';

import '../../../../core/constants/firebase_collections.dart';
import '../../../../core/error/exceptions.dart';
import '../../../../core/services/storage_service.dart';
import '../models/review_model.dart';
import '../models/reviewable_item_model.dart';
import '../../../../core/error/firebase_error_message.dart';

/// The ONLY place the Write Review screen touches Firebase.
abstract class ReviewRemoteDataSource {
  /// Reads `orders/{orderId}` and projects the line for [productId].
  Future<ReviewableItemModel> getReviewableItem({
    required String orderId,
    required String productId,
  });

  Future<bool> hasExistingReview({
    required String userId,
    required String productId,
    required String orderId,
  });

  /// Uploads [photos], creates the review, returns the new document id.
  Future<String> submitReview(ReviewModel review, List<File> photos);
}

@LazySingleton(as: ReviewRemoteDataSource)
class ReviewRemoteDataSourceImpl implements ReviewRemoteDataSource {
  ReviewRemoteDataSourceImpl(this._firestore, this._storage);

  final FirebaseFirestore _firestore;
  final StorageService _storage;

  @override
  Future<ReviewableItemModel> getReviewableItem({
    required String orderId,
    required String productId,
  }) async {
    try {
      final doc = await _firestore
          .collection(FirebaseCollections.orders)
          .doc(orderId)
          .get();
      if (!doc.exists) {
        throw const ServerException('We could not find that order.');
      }

      final item = ReviewableItemModel.fromOrderDoc(doc, productId);
      if (item == null) {
        throw const ServerException('That product is not on this order.');
      }
      return item;
    } on FirebaseException catch (e) {
      throw ServerException(FirebaseErrorMessage.of(e) ?? 'Could not load this purchase.', e.code);
    }
  }

  @override
  Future<bool> hasExistingReview({
    required String userId,
    required String productId,
    required String orderId,
  }) async {
    try {
      // Equality-only filters — Firestore serves this by merging the single
      // field indexes, so no composite index is needed. `isPublished` is in the
      // query (not just the rule) because a `list` whose rule reads
      // `resource.data.isPublished` must be provably constrained to matching
      // documents, or the whole query is denied.
      final snap = await _firestore
          .collection(FirebaseCollections.reviews)
          .where('userId', isEqualTo: userId)
          .where('productId', isEqualTo: productId)
          .where('orderId', isEqualTo: orderId)
          .where('isPublished', isEqualTo: true)
          .limit(1)
          .get();
      return snap.docs.isNotEmpty;
    } on FirebaseException catch (e) {
      throw ServerException(
        FirebaseErrorMessage.of(e) ?? 'Could not check your existing reviews.',
        e.code,
      );
    }
  }

  @override
  Future<String> submitReview(ReviewModel review, List<File> photos) async {
    // The id is minted CLIENT-side before anything is written, because the
    // storage path is `reviews/{reviewId}/{photoIndex}` (spec §4.22) and the
    // index therefore needs the id first.
    final ref = _firestore.collection(FirebaseCollections.reviews).doc();

    try {
      // Photos are uploaded BEFORE the document is created, and the finished
      // URLs go into the create payload.
      //
      // WHY not create-then-update (which would show the review sooner): the
      // deployed rule allows `update` on a review only for an admin, and only
      // for ['isPublished', 'adminResponse', 'updatedAt']. A customer patching
      // `photos` after the fact is denied — the photos would be orphaned in
      // Storage and the review would publish without them.
      final urls = photos.isEmpty
          ? const <String>[]
          : await _storage.uploadImages(photos, StoragePaths.reviewPrefix(ref.id));

      final payload = ReviewModel(
        id: ref.id,
        userId: review.userId,
        userName: review.userName,
        userImage: review.userImage,
        productId: review.productId,
        productName: review.productName,
        productImage: review.productImage,
        variantId: review.variantId,
        variantName: review.variantName,
        orderId: review.orderId,
        rating: review.rating,
        title: review.title,
        comment: review.comment,
        photos: urls,
        isPublished: true,
        isVerifiedPurchase: review.isVerifiedPurchase,
        adminResponse: '',
        keywords: review.keywords,
        createdAt: review.createdAt,
        updatedAt: review.updatedAt,
      ).toCreateMap();

      await ref.set(payload);
      return ref.id;
    } on FirebaseException catch (e) {
      throw ServerException(
        FirebaseErrorMessage.of(e) ?? 'Could not submit your review. Please try again.',
        e.code,
      );
    }
  }
}
