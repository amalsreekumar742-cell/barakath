import 'package:dartz/dartz.dart';
import 'package:injectable/injectable.dart';

import '../../../../core/error/failures.dart';
import '../../../../core/usecase/usecase.dart';
import '../repositories/home_repository.dart';

/// The deadline the flash-sale countdown ticks down to — the soonest live sale
/// end, or `null` when no sale is running.
@injectable
class GetFlashSaleEndDate implements UseCase<DateTime?, NoParams> {
  GetFlashSaleEndDate(this._repository);

  final HomeRepository _repository;

  @override
  Future<Either<Failure, DateTime?>> call(NoParams params) =>
      _repository.getFlashSaleEndDate();
}
