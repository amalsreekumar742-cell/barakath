import 'package:dartz/dartz.dart';
import 'package:equatable/equatable.dart';
import 'package:injectable/injectable.dart';

import '../../../../core/error/failures.dart';
import '../../../../core/usecase/usecase.dart';
import '../../../../core/utils/constants.dart';
import '../entities/affiliate_transaction.dart';
import '../entities/affiliate_withdrawal.dart';
import '../entities/bank_account.dart';
import '../entities/ifsc_details.dart';
import '../repositories/affiliate_repository.dart';

/// The affiliate use cases. Grouped in one file because each is a one-liner
/// over the same repository and splitting them would be seven files of imports.

/// Params for a cursor-paginated affiliate read. [startAfter] is the previous
/// page's `nextCursor`, passed straight back through untouched.
class AffiliatePageParams extends Equatable {
  const AffiliatePageParams({
    required this.uid,
    this.startAfter,
    this.limit = PageSizes.defaultPageSize,
  });

  final String uid;
  final Object? startAfter;
  final int limit;

  @override
  List<Object?> get props => [uid, startAfter, limit];
}

@injectable
class GetCommissions
    implements UseCase<AffiliatePage<AffiliateTransaction>, AffiliatePageParams> {
  GetCommissions(this._repository);
  final AffiliateRepository _repository;

  @override
  Future<Either<Failure, AffiliatePage<AffiliateTransaction>>> call(
    AffiliatePageParams params,
  ) =>
      _repository.fetchCommissions(
        uid: params.uid,
        startAfter: params.startAfter,
        limit: params.limit,
      );
}

@injectable
class GetWithdrawals
    implements UseCase<AffiliatePage<AffiliateWithdrawal>, AffiliatePageParams> {
  GetWithdrawals(this._repository);
  final AffiliateRepository _repository;

  @override
  Future<Either<Failure, AffiliatePage<AffiliateWithdrawal>>> call(
    AffiliatePageParams params,
  ) =>
      _repository.fetchWithdrawals(
        uid: params.uid,
        startAfter: params.startAfter,
        limit: params.limit,
      );
}

@injectable
class GetBankAccounts implements UseCase<List<BankAccount>, String> {
  GetBankAccounts(this._repository);
  final AffiliateRepository _repository;

  @override
  Future<Either<Failure, List<BankAccount>>> call(String params) =>
      _repository.fetchBankAccounts(params);
}

class AddBankAccountParams extends Equatable {
  const AddBankAccountParams({required this.uid, required this.account});

  final String uid;
  final BankAccount account;

  @override
  List<Object?> get props => [uid, account];
}

@injectable
class AddBankAccount implements UseCase<BankAccount, AddBankAccountParams> {
  AddBankAccount(this._repository);
  final AffiliateRepository _repository;

  @override
  Future<Either<Failure, BankAccount>> call(AddBankAccountParams params) =>
      _repository.addBankAccount(uid: params.uid, account: params.account);
}

class DeleteBankAccountParams extends Equatable {
  const DeleteBankAccountParams({required this.uid, required this.accountId});

  final String uid;
  final String accountId;

  @override
  List<Object?> get props => [uid, accountId];
}

@injectable
class DeleteBankAccount implements UseCase<Unit, DeleteBankAccountParams> {
  DeleteBankAccount(this._repository);
  final AffiliateRepository _repository;

  @override
  Future<Either<Failure, Unit>> call(DeleteBankAccountParams params) =>
      _repository.deleteBankAccount(
        uid: params.uid,
        accountId: params.accountId,
      );
}

@injectable
class CreateWithdrawal implements UseCase<Unit, AffiliateWithdrawal> {
  CreateWithdrawal(this._repository);
  final AffiliateRepository _repository;

  @override
  Future<Either<Failure, Unit>> call(AffiliateWithdrawal params) =>
      _repository.createWithdrawal(params);
}

@injectable
class VerifyIfsc implements UseCase<IfscDetails, String> {
  VerifyIfsc(this._repository);
  final AffiliateRepository _repository;

  @override
  Future<Either<Failure, IfscDetails>> call(String params) =>
      _repository.verifyIfsc(params);
}
