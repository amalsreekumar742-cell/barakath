import 'package:dartz/dartz.dart';
import 'package:injectable/injectable.dart';

import '../../../../core/error/exceptions.dart';
import '../../../../core/error/failures.dart';
import '../../domain/entities/address.dart';
import '../../domain/repositories/address_repository.dart';
import '../datasources/address_remote_datasource.dart';

@LazySingleton(as: AddressRepository)
class AddressRepositoryImpl implements AddressRepository {
  AddressRepositoryImpl(this._remote);

  final AddressRemoteDataSource _remote;

  @override
  Future<Either<Failure, List<Address>>> fetchAddresses() =>
      _guard(() => _remote.fetchAddresses());

  @override
  Future<Either<Failure, Address>> addAddress(Address address) =>
      _guard(() => _remote.addAddress(address));

  @override
  Future<Either<Failure, Unit>> updateAddress(Address address) =>
      _guardUnit(() => _remote.updateAddress(address));

  @override
  Future<Either<Failure, Unit>> deleteAddress(String addressId) =>
      _guardUnit(() => _remote.deleteAddress(addressId));

  @override
  Future<Either<Failure, Unit>> setDefault(String addressId) =>
      _guardUnit(() => _remote.setDefault(addressId));

  Future<Either<Failure, T>> _guard<T>(Future<T> Function() run) async {
    try {
      return Right(await run());
    } on AuthException catch (e) {
      return Left(AuthFailure(e.message));
    } on ServerException catch (e) {
      return Left(ServerFailure(e.message));
    } catch (_) {
      return const Left(ServerFailure());
    }
  }

  Future<Either<Failure, Unit>> _guardUnit(Future<void> Function() run) async {
    final result = await _guard(() async {
      await run();
      return unit;
    });
    return result;
  }
}
