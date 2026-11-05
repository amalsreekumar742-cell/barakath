import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:injectable/injectable.dart';

import '../../../../core/constants/firebase_collections.dart';
import '../../../../core/error/exceptions.dart';
import '../../../../core/error/firebase_error_message.dart';
import '../../domain/entities/review.dart';
import '../models/review_model.dart';

/// Reading a product's reviews, and the customer's report and block actions on
/// them (App Store guideline 1.2).
abstract class ReviewModerationRemoteDataSource {
  Future<List<ReviewModel>> fetchProductReviews(String productId);

  /// Ids of the customers [uid] has blocked, live.
  Stream<Set<String>> watchBlockedUsers(String uid);

  Future<void> blockUser({
    required String uid,
    required String blockedUserId,
  });

  Future<void> reportReview({
    required String uid,
    required Review review,
    required String reason,
  });
}

@LazySingleton(as: ReviewModerationRemoteDataSource)
class ReviewModerationRemoteDataSourceImpl
    implements ReviewModerationRemoteDataSource {
  ReviewModerationRemoteDataSourceImpl(this._firestore);

  static const int _maxReviews = 100;

  final FirebaseFirestore _firestore;

  CollectionReference<Map<String, dynamic>> _blocked(String uid) => _firestore
      .collection(FirebaseCollections.users)
      .doc(uid)
      .collection(FirebaseCollections.blockedUsers);

  @override
  Future<List<ReviewModel>> fetchProductReviews(String productId) async {
    try {
      final snap = await _firestore
          .collection(FirebaseCollections.reviews)
          .where('productId', isEqualTo: productId)
          .where('isPublished', isEqualTo: true)
          .orderBy('createdAt', descending: true)
          .limit(_maxReviews)
          .get();
      return snap.docs.map(ReviewModel.fromFirestore).toList();
    } on FirebaseException catch (e) {
      throw ServerException(
        FirebaseErrorMessage.of(e) ?? 'Could not load reviews.',
        e.code,
      );
    }
  }

  @override
  Stream<Set<String>> watchBlockedUsers(String uid) => _blocked(uid)
      .snapshots()
      .map((snap) => snap.docs.map((d) => d.id).toSet());

  @override
  Future<void> blockUser({
    required String uid,
    required String blockedUserId,
  }) async {
    try {
      await _blocked(uid).doc(blockedUserId).set({
        'blockedAt': FieldValue.serverTimestamp(),
      });
    } on FirebaseException catch (e) {
      throw ServerException(
        FirebaseErrorMessage.of(e) ?? 'Could not block this customer.',
        e.code,
      );
    }
  }

  @override
  Future<void> reportReview({
    required String uid,
    required Review review,
    required String reason,
  }) async {
    try {
      await _firestore
          .collection(FirebaseCollections.reviewReports)
          .doc('${uid}_${review.id}')
          .set({
        'reporterId': uid,
        'reviewId': review.id,
        'reviewUserId': review.userId,
        'reviewUserName': review.userName,
        'productId': review.productId,
        'productName': review.productName,
        'reviewTitle': review.title,
        'reviewComment': review.comment,
        'reason': reason,
        'status': 'Open',
        'createdAt': FieldValue.serverTimestamp(),
      });
    } on FirebaseException catch (e) {
      // The rules let a report be created once. A repeat is denied as an
      // update, and to this customer it has still been reported.
      if (e.code == 'permission-denied') return;
      throw ServerException(
        FirebaseErrorMessage.of(e) ?? 'Could not send your report.',
        e.code,
      );
    }
  }
}
