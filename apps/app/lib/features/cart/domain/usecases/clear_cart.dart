import 'package:dartz/dartz.dart';
import 'package:injectable/injectable.dart';

import '../../../../core/error/failures.dart';
import '../../../../core/usecase/usecase.dart';
import '../entities/cart_item.dart';
import '../repositories/cart_repository.dart';

/// Empty the cart (e.g. after a successful checkout).
@injectable
class ClearCart implements UseCase<List<CartItem>, NoParams> {
  ClearCart(this._repository);

  final CartRepository _repository;

  @override
  Future<Either<Failure, List<CartItem>>> call(NoParams params) =>
      _repository.clearCart();
}
