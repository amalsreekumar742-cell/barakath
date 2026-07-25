import 'package:dartz/dartz.dart';
import 'package:injectable/injectable.dart';

import '../../../../core/error/exceptions.dart';
import '../../../../core/error/failures.dart';
import '../../domain/entities/cart_item.dart';
import '../../domain/repositories/cart_repository.dart';
import '../datasources/cart_local_datasource.dart';
import '../models/cart_item_model.dart';

/// Orchestrates cart mutations over the local datasource. Holds the dedupe /
/// increment / drop-on-zero business rules, reads the current lines, applies the
/// mutation, persists, and returns the result — catching [CacheException] and
/// converting it to a [CacheFailure] on the `Left`.
@LazySingleton(as: CartRepository)
class CartRepositoryImpl implements CartRepository {
  CartRepositoryImpl(this._local);

  final CartLocalDataSource _local;

  int _indexOf(List<CartItemModel> items, String productId, String variantId) {
    return items.indexWhere(
      (e) => e.productId == productId && e.variantId == variantId,
    );
  }

  @override
  Future<Either<Failure, List<CartItem>>> getCart() async {
    try {
      return Right(_local.getCart());
    } on CacheException catch (e) {
      return Left(CacheFailure(e.message));
    }
  }

  @override
  Future<Either<Failure, List<CartItem>>> addToCart(CartItem item) async {
    try {
      final items = _local.getCart();
      final index = _indexOf(items, item.productId, item.variantId);
      if (index >= 0) {
        final existing = items[index];
        items[index] =
            existing.copyWith(quantity: existing.quantity + item.quantity);
      } else {
        items.add(CartItemModel.fromEntity(item));
      }
      await _local.saveCart(items);
      return Right(items);
    } on CacheException catch (e) {
      return Left(CacheFailure(e.message));
    }
  }

  @override
  Future<Either<Failure, List<CartItem>>> removeFromCart(
    String productId,
    String variantId,
  ) async {
    try {
      final items = _local.getCart();
      final index = _indexOf(items, productId, variantId);
      if (index < 0) return Right(items);
      items.removeAt(index);
      await _local.saveCart(items);
      return Right(items);
    } on CacheException catch (e) {
      return Left(CacheFailure(e.message));
    }
  }

  @override
  Future<Either<Failure, List<CartItem>>> updateQuantity(
    String productId,
    String variantId,
    int quantity,
  ) async {
    try {
      final items = _local.getCart();
      final index = _indexOf(items, productId, variantId);
      if (index < 0) return Right(items);
      if (quantity <= 0) {
        items.removeAt(index);
      } else {
        items[index] = items[index].copyWith(quantity: quantity);
      }
      await _local.saveCart(items);
      return Right(items);
    } on CacheException catch (e) {
      return Left(CacheFailure(e.message));
    }
  }

  @override
  Future<Either<Failure, List<CartItem>>> clearCart() async {
    try {
      await _local.saveCart(const []);
      return const Right([]);
    } on CacheException catch (e) {
      return Left(CacheFailure(e.message));
    }
  }
}
