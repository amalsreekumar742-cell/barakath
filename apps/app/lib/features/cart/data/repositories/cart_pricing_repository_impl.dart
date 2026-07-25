import 'package:dartz/dartz.dart';
import 'package:injectable/injectable.dart';

import '../../../../core/error/exceptions.dart';
import '../../../../core/error/failures.dart';
import '../../domain/entities/cart_details.dart';
import '../../domain/repositories/cart_pricing_repository.dart';
import '../datasources/cart_remote_datasource.dart';

@LazySingleton(as: CartPricingRepository)
class CartPricingRepositoryImpl implements CartPricingRepository {
  CartPricingRepositoryImpl(this._remote);

  final CartRemoteDataSource _remote;

  @override
  Future<Either<Failure, CartDetails>> fetchDetails(
    List<({String productId, String variantId})> lines,
  ) async {
    try {
      return Right(await _remote.fetchDetails(lines));
    } on ServerException catch (e) {
      return Left(ServerFailure(e.message));
    } catch (_) {
      return const Left(ServerFailure());
    }
  }
}
