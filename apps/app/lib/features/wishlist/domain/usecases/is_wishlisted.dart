import 'package:dartz/dartz.dart';
import 'package:injectable/injectable.dart';

import '../../../../core/error/failures.dart';
import '../../../../core/usecase/usecase.dart';
import '../repositories/wishlist_repository.dart';
import 'add_to_wishlist.dart';

/// One-shot "is this product hearted?" — for surfaces opened deep-linked, before
/// the live wishlist stream has delivered its first snapshot.
@injectable
class IsWishlisted implements UseCase<bool, WishlistParams> {
  IsWishlisted(this._repository);

  final WishlistRepository _repository;

  @override
  Future<Either<Failure, bool>> call(WishlistParams params) =>
      _repository.isWishlisted(params.productId);
}
