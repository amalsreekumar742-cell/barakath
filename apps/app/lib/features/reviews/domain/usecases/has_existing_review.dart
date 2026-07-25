import 'package:dartz/dartz.dart';
import 'package:equatable/equatable.dart';
import 'package:injectable/injectable.dart';

import '../../../../core/error/failures.dart';
import '../../../../core/usecase/usecase.dart';
import '../repositories/review_repository.dart';

/// "One review per product per order" (spec §2.24).
///
/// WHY the app enforces it: a Security Rule cannot query for a sibling document,
/// so `firestore.rules` deliberately leaves this to the client. It is checked
/// twice — on screen open (to show the already-reviewed state) and again inside
/// submit (to close the window between the two).
@injectable
class HasExistingReview implements UseCase<bool, ExistingReviewParams> {
  HasExistingReview(this._repository);

  final ReviewRepository _repository;

  @override
  Future<Either<Failure, bool>> call(ExistingReviewParams params) =>
      _repository.hasExistingReview(
        userId: params.userId,
        productId: params.productId,
        orderId: params.orderId,
      );
}

class ExistingReviewParams extends Equatable {
  const ExistingReviewParams({
    required this.userId,
    required this.productId,
    required this.orderId,
  });

  final String userId;
  final String productId;
  final String orderId;

  @override
  List<Object?> get props => [userId, productId, orderId];
}
