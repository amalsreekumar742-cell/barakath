import 'package:dartz/dartz.dart';
import 'package:equatable/equatable.dart';
import 'package:injectable/injectable.dart';

import '../../../../core/error/failures.dart';
import '../../../../core/usecase/usecase.dart';
import '../repositories/wishlist_repository.dart';

/// Heart a product for the signed-in customer.
@injectable
class AddToWishlist implements UseCase<Unit, WishlistParams> {
  AddToWishlist(this._repository);

  final WishlistRepository _repository;

  @override
  Future<Either<Failure, Unit>> call(WishlistParams params) =>
      _repository.addToWishlist(params.productId);
}

/// Shared by every wishlist use case — they all key off a product id.
class WishlistParams extends Equatable {
  const WishlistParams(this.productId);

  final String productId;

  @override
  List<Object?> get props => [productId];
}
