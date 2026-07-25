import 'package:dartz/dartz.dart';
import 'package:injectable/injectable.dart';

import '../../../../core/error/failures.dart';
import '../../../../core/usecase/usecase.dart';
import '../entities/cart_item.dart';
import '../repositories/cart_repository.dart';

/// Rehydrate the cart lines from local storage.
@injectable
class GetCart implements UseCase<List<CartItem>, NoParams> {
  GetCart(this._repository);

  final CartRepository _repository;

  @override
  Future<Either<Failure, List<CartItem>>> call(NoParams params) =>
      _repository.getCart();
}
