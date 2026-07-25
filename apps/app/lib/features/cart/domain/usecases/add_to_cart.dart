import 'package:dartz/dartz.dart';
import 'package:injectable/injectable.dart';

import '../../../../core/error/failures.dart';
import '../../../../core/usecase/usecase.dart';
import '../entities/cart_item.dart';
import '../repositories/cart_repository.dart';

/// Add a line to the cart (dedupes by product+variant, incrementing quantity).
@injectable
class AddToCart implements UseCase<List<CartItem>, CartItem> {
  AddToCart(this._repository);

  final CartRepository _repository;

  @override
  Future<Either<Failure, List<CartItem>>> call(CartItem params) =>
      _repository.addToCart(params);
}
