import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:injectable/injectable.dart';

import '../../../../core/utils/keywords.dart';
import '../../domain/entities/review.dart';
import '../../domain/entities/reviewable_item.dart';
import '../../domain/usecases/get_reviewable_item.dart';
import '../../domain/usecases/has_existing_review.dart';
import '../../domain/usecases/submit_review.dart';

/// What the Write Review screen is showing right now. Named states rather than
/// null-checks (skill: "loading/error/data must be explicit named state") — the
/// difference between "still loading" and "already reviewed" is not something a
/// null `item` can express.
enum WriteReviewStatus { initial, loading, ready, alreadyReviewed, error }

/// The outcome of a submit attempt, returned to the page so it can decide
/// between the thank-you dialog, a duplicate toast and an error toast.
enum SubmitReviewOutcome { success, duplicate, failure }

/// Write-review form state and submission (spec §2.24).
@injectable
class ReviewsProvider extends ChangeNotifier {
  ReviewsProvider(
    this._getReviewableItem,
    this._hasExistingReview,
    this._submitReview,
  );

  final GetReviewableItem _getReviewableItem;
  final HasExistingReview _hasExistingReview;
  final SubmitReview _submitReview;

  /// Spec §2.24 — the prototype labels the text "(optional)"; the spec says
  /// required, and the spec wins (design map §4, row 3).
  static const int minReviewLength = 10;

  /// Spec §2.24 / §2.25.
  static const int maxPhotos = 3;

  // --- State ---------------------------------------------------------------
  WriteReviewStatus _status = WriteReviewStatus.initial;
  ReviewableItem? _item;
  String? _error;

  double _rating = 0;
  String _reviewText = '';
  List<File> _photos = const [];

  bool _isSubmitting = false;
  String? _submitError;

  WriteReviewStatus get status => _status;
  ReviewableItem? get item => _item;
  String? get error => _error;

  bool get isLoading => _status == WriteReviewStatus.loading;
  bool get isSubmitting => _isSubmitting;
  String? get submitError => _submitError;

  double get rating => _rating;
  String get reviewText => _reviewText;
  List<File> get photos => List.unmodifiable(_photos);

  bool get hasRating => _rating >= 1;
  bool get isReviewTextValid => _reviewText.trim().length >= minReviewLength;

  /// Both requirements met — drives the Submit button's enabled state.
  bool get canSubmit =>
      _status == WriteReviewStatus.ready &&
      hasRating &&
      isReviewTextValid &&
      !_isSubmitting;

  // --- Load ----------------------------------------------------------------

  /// Loads the order-line snapshot and checks the one-per-product-per-order
  /// rule. [userId] is the signed-in customer; an empty one is a programming
  /// error (the route is guest-blocked) and is surfaced as an error state.
  Future<void> load({
    required String orderId,
    required String productId,
    required String userId,
  }) async {
    _resetForm();
    _status = WriteReviewStatus.loading;
    _error = null;
    notifyListeners();

    if (userId.isEmpty) {
      _status = WriteReviewStatus.error;
      _error = 'Please sign in to write a review.';
      notifyListeners();
      return;
    }

    final itemResult = await _getReviewableItem(
      ReviewableItemParams(orderId: orderId, productId: productId),
    );

    final failed = itemResult.fold<String?>((f) => f.message, (_) => null);
    if (failed != null) {
      _status = WriteReviewStatus.error;
      _error = failed;
      notifyListeners();
      return;
    }

    final item = itemResult.getOrElse(() => throw StateError('unreachable'));
    _item = item;

    if (!item.isDelivered) {
      _status = WriteReviewStatus.error;
      _error = 'You can review this once the order is delivered.';
      notifyListeners();
      return;
    }

    final existing = await _hasExistingReview(
      ExistingReviewParams(
        userId: userId,
        productId: productId,
        orderId: orderId,
      ),
    );

    existing.fold(
      (failure) {
        _status = WriteReviewStatus.error;
        _error = failure.message;
      },
      (alreadyReviewed) {
        _status = alreadyReviewed
            ? WriteReviewStatus.alreadyReviewed
            : WriteReviewStatus.ready;
      },
    );
    notifyListeners();
  }

  // --- Form ----------------------------------------------------------------

  void setRating(double value) {
    if (_rating == value) return;
    _rating = value;
    notifyListeners();
  }

  void setReviewText(String value) {
    if (_reviewText == value) return;
    _reviewText = value;
    notifyListeners();
  }

  void setPhotos(List<File> value) {
    _photos = value.take(maxPhotos).toList(growable: false);
    notifyListeners();
  }

  // --- Submit --------------------------------------------------------------

  /// Creates the review. Re-checks the duplicate rule first, because the screen
  /// may have been open long enough for the same customer to have submitted
  /// from another device.
  ///
  /// [userName] / [userImage] are the customer's profile snapshot, taken at
  /// submit time so a later rename doesn't rewrite what the product page shows.
  Future<SubmitReviewOutcome> submit({
    required String userId,
    required String userName,
    required String userImage,
  }) async {
    final item = _item;
    if (item == null || !canSubmit) return SubmitReviewOutcome.failure;

    _isSubmitting = true;
    _submitError = null;
    notifyListeners();

    final duplicate = await _hasExistingReview(
      ExistingReviewParams(
        userId: userId,
        productId: item.productId,
        orderId: item.orderId,
      ),
    );

    final duplicateFailure = duplicate.fold<String?>((f) => f.message, (_) => null);
    if (duplicateFailure != null) {
      _isSubmitting = false;
      _submitError = duplicateFailure;
      notifyListeners();
      return SubmitReviewOutcome.failure;
    }

    if (duplicate.getOrElse(() => false)) {
      _isSubmitting = false;
      _status = WriteReviewStatus.alreadyReviewed;
      notifyListeners();
      return SubmitReviewOutcome.duplicate;
    }

    final comment = _reviewText.trim();
    final review = Review(
      // The datasource mints the real id (it needs it before uploading photos).
      id: '',
      userId: userId,
      userName: userName.trim().isEmpty ? item.customerName : userName.trim(),
      userImage: userImage,
      productId: item.productId,
      productName: item.productName,
      productImage: item.productImage,
      variantId: item.variantId,
      variantName: item.variantName,
      orderId: item.orderId,
      rating: _rating,
      // The design has no separate title field; the admin list renders `comment`.
      title: '',
      comment: comment,
      // Filled in by the datasource once the uploads finish.
      photos: const [],
      isPublished: true,
      // The review is written from a Delivered order, by definition.
      isVerifiedPurchase: true,
      adminResponse: '',
      keywords: buildKeywords([item.productName, comment]),
      createdAt: null,
      updatedAt: null,
    );

    final result = await _submitReview(
      SubmitReviewParams(review: review, photos: _photos),
    );

    _isSubmitting = false;
    final outcome = result.fold(
      (failure) {
        _submitError = failure.message;
        return SubmitReviewOutcome.failure;
      },
      (_) {
        _status = WriteReviewStatus.alreadyReviewed;
        return SubmitReviewOutcome.success;
      },
    );
    notifyListeners();
    return outcome;
  }

  /// One provider instance is shared app-wide (registered in `main.dart`), so
  /// every entry into the screen must start from a clean form.
  void _resetForm() {
    _item = null;
    _rating = 0;
    _reviewText = '';
    _photos = const [];
    _isSubmitting = false;
    _submitError = null;
  }
}
