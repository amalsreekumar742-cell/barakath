import 'package:dartz/dartz.dart';

import '../../../../core/error/failures.dart';
import '../entities/address.dart';

abstract class AddressRepository {
  Future<Either<Failure, List<Address>>> fetchAddresses();
  Future<Either<Failure, Address>> addAddress(Address address);
  Future<Either<Failure, Unit>> updateAddress(Address address);
  Future<Either<Failure, Unit>> deleteAddress(String addressId);
  Future<Either<Failure, Unit>> setDefault(String addressId);
}
