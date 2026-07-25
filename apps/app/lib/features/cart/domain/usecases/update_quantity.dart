import 'package:dartz/dartz.dart';
import 'package:equatable/equatable.dart';
import 'package:injectable/injectable.dart';

import '../../../../core/error/failures.dart';
import '../../../../core/usecase/usecase.dart';
import '../entities/cart_item.dart';
import '../repositories/cart_repository.dart';

/// Set the absolute quantity for a line. Removes the line when quantity <= 0.
@injectable
class UpdateQuantity implements UseCase<List<CartItem>, UpdateQuantityParams> {
  UpdateQuantity(this._repository);

  final CartRepository _repository;

  @override
  Future<Either<Failure, List<CartItem>>> call(UpdateQuantityParams params) =>
      _repository.updateQuantity(
        params.productId,
        params.variantId,
        params.quantity,
      );
}

class UpdateQuantityParams extends Equatable {
  const UpdateQuantityParams({
    required this.productId,
    required this.variantId,
    required this.quantity,
  });

  final String productId;
  final String variantId;
  final int quantity;

  @override
  List<Object?> get props => [productId, variantId, quantity];
}
