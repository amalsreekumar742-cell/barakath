import 'package:dartz/dartz.dart';
import 'package:injectable/injectable.dart';

import '../../../../core/error/failures.dart';
import '../../../../core/usecase/usecase.dart';
import '../entities/spinner_campaign.dart';
import '../repositories/spinner_repository.dart';

/// The campaign whose wheel to draw, or `null` when none is running.
@injectable
class GetActiveCampaign implements UseCase<SpinnerCampaign?, NoParams> {
  const GetActiveCampaign(this._repository);

  final SpinnerRepository _repository;

  @override
  Future<Either<Failure, SpinnerCampaign?>> call(NoParams params) =>
      _repository.getActiveCampaign();
}
