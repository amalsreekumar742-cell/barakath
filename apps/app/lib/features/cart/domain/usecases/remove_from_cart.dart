import 'package:dartz/dartz.dart';
import 'package:equatable/equatable.dart';
import 'package:injectable/injectable.dart';

import '../../../../core/error/failures.dart';
import '../../../../core/usecase/usecase.dart';
import '../entities/cart_item.dart';
import '../repositories/cart_repository.dart';

/// Remove a line from the cart entirely.
@injectable
class RemoveFromCart implements UseCase<List<CartItem>, RemoveFromCartParams> {
  RemoveFromCart(this._repository);

  final CartRepository _repository;

  @override
  Future<Either<Failure, List<CartItem>>> call(RemoveFromCartParams params) =>
      _repository.removeFromCart(params.productId, params.variantId);
}

class RemoveFromCartParams extends Equatable {
  const RemoveFromCartParams({
    required this.productId,
    required this.variantId,
  });

  final String productId;
  final String variantId;

  @override
  List<Object?> get props => [productId, variantId];
}
