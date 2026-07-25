import 'package:dartz/dartz.dart';
import 'package:injectable/injectable.dart';

import '../../../../core/error/exceptions.dart';
import '../../../../core/error/failures.dart';
import '../../../../core/utils/constants.dart';
import '../../domain/entities/affiliate_transaction.dart';
import '../../domain/entities/affiliate_withdrawal.dart';
import '../../domain/entities/bank_account.dart';
import '../../domain/entities/ifsc_details.dart';
import '../../domain/repositories/affiliate_repository.dart';
import '../datasources/affiliate_remote_datasource.dart';
import '../datasources/ifsc_remote_datasource.dart';
import '../models/affiliate_withdrawal_model.dart';
import '../models/bank_account_model.dart';

@LazySingleton(as: AffiliateRepository)
class AffiliateRepositoryImpl implements AffiliateRepository {
  AffiliateRepositoryImpl(this._remote, this._ifsc);

  final AffiliateRemoteDataSource _remote;
  final IfscRemoteDataSource _ifsc;

  @override
  Future<Either<Failure, AffiliatePage<AffiliateTransaction>>> fetchCommissions({
    required String uid,
    Object? startAfter,
    int limit = PageSizes.defaultPageSize,
  }) =>
      _guard(() async {
        final page = await _remote.fetchCommissions(
          uid: uid,
          startAfter: startAfter,
          limit: limit,
        );
        return AffiliatePage<AffiliateTransaction>(
          items: page.items,
          // Passed straight back through as an opaque token on the next call.
          nextCursor: page.nextCursor,
          hasMore: page.hasMore,
        );
      });

  @override
  Future<Either<Failure, AffiliatePage<AffiliateWithdrawal>>> fetchWithdrawals({
    required String uid,
    Object? startAfter,
    int limit = PageSizes.defaultPageSize,
  }) =>
      _guard(() async {
        final page = await _remote.fetchWithdrawals(
          uid: uid,
          startAfter: startAfter,
          limit: limit,
        );
        return AffiliatePage<AffiliateWithdrawal>(
          items: page.items,
          nextCursor: page.nextCursor,
          hasMore: page.hasMore,
        );
      });

  @override
  Future<Either<Failure, List<BankAccount>>> fetchBankAccounts(String uid) =>
      _guard(() async => await _remote.fetchBankAccounts(uid));

  @override
  Future<Either<Failure, BankAccount>> addBankAccount({
    required String uid,
    required BankAccount account,
  }) =>
      _guard(
        () async => await _remote.addBankAccount(
          uid: uid,
          account: BankAccountModel(
            id: account.id,
            accountHolderName: account.accountHolderName,
            accountNumber: account.accountNumber,
            ifscCode: account.ifscCode,
            bankName: account.bankName,
            bankBranch: account.bankBranch,
            createdAt: account.createdAt,
          ),
        ),
      );

  @override
  Future<Either<Failure, Unit>> deleteBankAccount({
    required String uid,
    required String accountId,
  }) =>
      _guard(() async {
        await _remote.deleteBankAccount(uid: uid, accountId: accountId);
        return unit;
      });

  @override
  Future<Either<Failure, Unit>> createWithdrawal(AffiliateWithdrawal request) =>
      _guard(() async {
        await _remote.createWithdrawal(
          AffiliateWithdrawalModel(
            id: request.id,
            userId: request.userId,
            userName: request.userName,
            userPhone: request.userPhone,
            amount: request.amount,
            bankName: request.bankName,
            accountNumber: request.accountNumber,
            ifscCode: request.ifscCode,
            accountHolderName: request.accountHolderName,
            status: request.status,
            rejectionReason: request.rejectionReason,
            processedBy: request.processedBy,
            processedAt: request.processedAt,
            createdAt: request.createdAt,
          ),
        );
        return unit;
      });

  @override
  Future<Either<Failure, IfscDetails>> verifyIfsc(String ifsc) =>
      _guard(() async => await _ifsc.verifyIfsc(ifsc));

  /// Converts every datasource exception into a [Failure]; nothing throws past
  /// this layer (skill: exceptions never reach domain/UI).
  Future<Either<Failure, T>> _guard<T>(Future<T> Function() run) async {
    try {
      return Right(await run());
    } on AuthException catch (e) {
      return Left(AuthFailure(e.message));
    } on NetworkException catch (e) {
      return Left(NetworkFailure(e.message));
    } on ServerException catch (e) {
      return Left(ServerFailure(e.message));
    } catch (_) {
      return const Left(ServerFailure());
    }
  }
}
