import 'package:dartz/dartz.dart';
import 'package:equatable/equatable.dart';
import 'package:injectable/injectable.dart';

import '../../../../core/error/failures.dart';
import '../../../../core/usecase/usecase.dart';
import '../../../reviews/domain/entities/review.dart';
import '../repositories/product_detail_repository.dart';

/// The newest published reviews shown inline on the detail screen (default 3).
@injectable
class GetRecentProductReviews
    implements UseCase<List<Review>, RecentReviewsParams> {
  GetRecentProductReviews(this._repository);

  final ProductDetailRepository _repository;

  @override
  Future<Either<Failure, List<Review>>> call(RecentReviewsParams params) =>
      _repository.getRecentReviews(params.productId, limit: params.limit);
}

class RecentReviewsParams extends Equatable {
  const RecentReviewsParams({required this.productId, this.limit = 3});

  final String productId;
  final int limit;

  @override
  List<Object?> get props => [productId, limit];
}
