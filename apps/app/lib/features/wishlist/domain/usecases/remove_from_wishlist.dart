import 'package:dartz/dartz.dart';
import 'package:injectable/injectable.dart';

import '../../../../core/error/failures.dart';
import '../../../../core/usecase/usecase.dart';
import '../repositories/wishlist_repository.dart';
import 'add_to_wishlist.dart';

/// Un-heart a product for the signed-in customer.
@injectable
class RemoveFromWishlist implements UseCase<Unit, WishlistParams> {
  RemoveFromWishlist(this._repository);

  final WishlistRepository _repository;

  @override
  Future<Either<Failure, Unit>> call(WishlistParams params) =>
      _repository.removeFromWishlist(params.productId);
}
