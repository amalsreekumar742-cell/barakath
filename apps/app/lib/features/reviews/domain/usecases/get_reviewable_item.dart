import 'package:dartz/dartz.dart';
import 'package:equatable/equatable.dart';
import 'package:injectable/injectable.dart';

import '../../../../core/error/failures.dart';
import '../../../../core/usecase/usecase.dart';
import '../entities/reviewable_item.dart';
import '../repositories/review_repository.dart';

/// Loads the product header (image, name, variant) for the Write Review screen
/// from the order's own line-item snapshot.
@injectable
class GetReviewableItem implements UseCase<ReviewableItem, ReviewableItemParams> {
  GetReviewableItem(this._repository);

  final ReviewRepository _repository;

  @override
  Future<Either<Failure, ReviewableItem>> call(ReviewableItemParams params) =>
      _repository.getReviewableItem(
        orderId: params.orderId,
        productId: params.productId,
      );
}

class ReviewableItemParams extends Equatable {
  const ReviewableItemParams({required this.orderId, required this.productId});

  final String orderId;
  final String productId;

  @override
  List<Object?> get props => [orderId, productId];
}
