import 'dart:async';

import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/foundation.dart';
import 'package:injectable/injectable.dart';

import '../../../../core/error/exceptions.dart';
import '../../data/datasources/review_moderation_remote_datasource.dart';
import '../../domain/entities/review.dart';

/// What this customer has chosen not to see: reviews by customers they blocked
/// and reviews they reported. App-wide, so the product page and the full reviews
/// list stay consistent.
///
/// WHY it follows the auth stream itself: a blocked list belongs to one account
/// and must be dropped the moment that account signs out.
@injectable
class ReviewModerationProvider extends ChangeNotifier {
  ReviewModerationProvider(this._remote, this._auth) {
    _authSub = _auth.authStateChanges().listen(_onAuthChanged);
  }

  final ReviewModerationRemoteDataSource _remote;
  final FirebaseAuth _auth;

  StreamSubscription<User?>? _authSub;
  StreamSubscription<Set<String>>? _blockedSub;

  Set<String> _blockedUserIds = const {};
  final Set<String> _reportedReviewIds = {};

  String? get currentUid => _auth.currentUser?.uid;

  List<Review> visible(List<Review> reviews) => reviews
      .where((r) =>
          !_blockedUserIds.contains(r.userId) &&
          !_reportedReviewIds.contains(r.id))
      .toList();

  Future<List<Review>> fetchProductReviews(String productId) =>
      _remote.fetchProductReviews(productId);

  /// Returns an error message, or null on success.
  Future<String?> report(Review review, String reason) async {
    final uid = currentUid;
    if (uid == null) return 'Please sign in to report a review.';
    try {
      await _remote.reportReview(uid: uid, review: review, reason: reason);
      _reportedReviewIds.add(review.id);
      notifyListeners();
      return null;
    } on ServerException catch (e) {
      return e.message;
    }
  }

  /// Returns an error message, or null on success.
  Future<String?> block(Review review) async {
    final uid = currentUid;
    if (uid == null) return 'Please sign in to block a customer.';
    try {
      await _remote.blockUser(uid: uid, blockedUserId: review.userId);
      return null;
    } on ServerException catch (e) {
      return e.message;
    }
  }

  void _onAuthChanged(User? user) {
    _blockedSub?.cancel();
    _blockedSub = null;
    _blockedUserIds = const {};
    _reportedReviewIds.clear();
    notifyListeners();

    if (user == null) return;
    _blockedSub = _remote.watchBlockedUsers(user.uid).listen(
      (ids) {
        _blockedUserIds = ids;
        notifyListeners();
      },
      // A failed read only means nothing is filtered for now.
      onError: (Object _) {},
    );
  }

  @override
  void dispose() {
    _authSub?.cancel();
    _blockedSub?.cancel();
    super.dispose();
  }
}
