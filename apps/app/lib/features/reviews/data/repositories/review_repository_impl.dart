import 'dart:io';

import 'package:dartz/dartz.dart';
import 'package:injectable/injectable.dart';

import '../../../../core/error/exceptions.dart';
import '../../../../core/error/failures.dart';
import '../../domain/entities/review.dart';
import '../../domain/entities/reviewable_item.dart';
import '../../domain/repositories/review_repository.dart';
import '../datasources/review_remote_datasource.dart';
import '../models/review_model.dart';

/// Converts the datasource's exceptions into `Either<Failure, T>` — nothing
/// throws past this class.
@LazySingleton(as: ReviewRepository)
class ReviewRepositoryImpl implements ReviewRepository {
  ReviewRepositoryImpl(this._remote);

  final ReviewRemoteDataSource _remote;

  @override
  Future<Either<Failure, ReviewableItem>> getReviewableItem({
    required String orderId,
    required String productId,
  }) async {
    try {
      return Right(
        await _remote.getReviewableItem(orderId: orderId, productId: productId),
      );
    } on ServerException catch (e) {
      return Left(ServerFailure(e.message));
    } catch (_) {
      return const Left(ServerFailure());
    }
  }

  @override
  Future<Either<Failure, bool>> hasExistingReview({
    required String userId,
    required String productId,
    required String orderId,
  }) async {
    try {
      return Right(
        await _remote.hasExistingReview(
          userId: userId,
          productId: productId,
          orderId: orderId,
        ),
      );
    } on ServerException catch (e) {
      return Left(ServerFailure(e.message));
    } catch (_) {
      return const Left(ServerFailure());
    }
  }

  @override
  Future<Either<Failure, String>> submitReview({
    required Review review,
    required List<File> photos,
  }) async {
    try {
      return Right(await _remote.submitReview(_asModel(review), photos));
    } on ServerException catch (e) {
      return Left(ServerFailure(e.message));
    } catch (_) {
      return const Left(ServerFailure());
    }
  }

  /// The provider builds a plain [Review]; the datasource needs the model's
  /// `toCreateMap`. Re-wrapping here keeps the Firestore payload knowledge in
  /// the data layer instead of leaking a model type into the domain contract.
  ReviewModel _asModel(Review review) => ReviewModel(
        id: review.id,
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
        photos: review.photos,
        isPublished: review.isPublished,
        isVerifiedPurchase: review.isVerifiedPurchase,
        adminResponse: review.adminResponse,
        keywords: review.keywords,
        createdAt: review.createdAt,
        updatedAt: review.updatedAt,
      );
}
