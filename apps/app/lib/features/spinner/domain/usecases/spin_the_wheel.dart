import 'package:dartz/dartz.dart';
import 'package:injectable/injectable.dart';

import '../../../../core/error/failures.dart';
import '../../../../core/usecase/usecase.dart';
import '../entities/spin_result.dart';
import '../repositories/spinner_repository.dart';

/// Runs one spin of [campaignId] through the `spinWheel` callable.
///
/// The only argument is the campaign id — everything else (eligibility, the
/// weighted draw, the coupon, the history record) is the server's. A `Left` here
/// carries the function's own `HttpsError` message ("Maximum spins reached",
/// "This campaign has ended", "Please wait 6 hours"), which is written for the
/// customer and must be shown verbatim.
@injectable
class SpinTheWheel implements UseCase<SpinResult, String> {
  const SpinTheWheel(this._repository);

  final SpinnerRepository _repository;

  @override
  Future<Either<Failure, SpinResult>> call(String campaignId) =>
      _repository.spin(campaignId);
}
