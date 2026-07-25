import 'dart:io';

import 'package:dartz/dartz.dart';
import 'package:equatable/equatable.dart';
import 'package:injectable/injectable.dart';

import '../../../../core/error/failures.dart';
import '../../../../core/usecase/usecase.dart';
import '../entities/review.dart';
import '../repositories/review_repository.dart';

/// Creates the review document and returns its id.
///
/// The product's `averageRating` / `totalReviews` are NOT touched here — the
/// deployed `onReviewCreate` Cloud Function trigger owns that aggregate. Writing
/// it from the app would double-count and would be rejected by the rules anyway.
@injectable
class SubmitReview implements UseCase<String, SubmitReviewParams> {
  SubmitReview(this._repository);

  final ReviewRepository _repository;

  @override
  Future<Either<Failure, String>> call(SubmitReviewParams params) =>
      _repository.submitReview(review: params.review, photos: params.photos);
}

class SubmitReviewParams extends Equatable {
  const SubmitReviewParams({required this.review, this.photos = const []});

  final Review review;

  /// Local files, max 3 (spec §2.24). Uploaded before the document is created —
  /// see `ReviewRemoteDataSource.submitReview` for why.
  final List<File> photos;

  @override
  List<Object?> get props => [review, photos];
}
