import 'package:dartz/dartz.dart';
import 'package:injectable/injectable.dart';

import '../../../../core/error/failures.dart';
import '../../../../core/usecase/usecase.dart';
import '../entities/address.dart';
import '../repositories/address_repository.dart';

/// The five address operations. Grouped in one file because they're one-liners
/// over the same repository and splitting them would be five files of imports.

@injectable
class GetAddresses implements UseCase<List<Address>, NoParams> {
  GetAddresses(this._repository);
  final AddressRepository _repository;

  @override
  Future<Either<Failure, List<Address>>> call(NoParams params) =>
      _repository.fetchAddresses();
}

@injectable
class AddAddress implements UseCase<Address, Address> {
  AddAddress(this._repository);
  final AddressRepository _repository;

  @override
  Future<Either<Failure, Address>> call(Address params) =>
      _repository.addAddress(params);
}

@injectable
class UpdateAddress implements UseCase<Unit, Address> {
  UpdateAddress(this._repository);
  final AddressRepository _repository;

  @override
  Future<Either<Failure, Unit>> call(Address params) =>
      _repository.updateAddress(params);
}

@injectable
class DeleteAddress implements UseCase<Unit, String> {
  DeleteAddress(this._repository);
  final AddressRepository _repository;

  @override
  Future<Either<Failure, Unit>> call(String params) =>
      _repository.deleteAddress(params);
}

@injectable
class SetDefaultAddress implements UseCase<Unit, String> {
  SetDefaultAddress(this._repository);
  final AddressRepository _repository;

  @override
  Future<Either<Failure, Unit>> call(String params) =>
      _repository.setDefault(params);
}
