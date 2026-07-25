import 'package:dartz/dartz.dart';
import 'package:injectable/injectable.dart';

import '../../../../core/error/failures.dart';
import '../../../../core/usecase/usecase.dart';
import '../entities/spin_availability.dart';
import '../entities/spinner_campaign.dart';
import '../repositories/spinner_repository.dart';

/// Composes "can this customer spin, and how often" from the two server reads
/// the answer depends on: their `spinHistory` count for the campaign, and their
/// user document.
///
/// The three gates mirror `spinWheel` exactly — per-user cap, cooldown, and the
/// campaign audience — so the button is never offered for a spin the callable
/// would reject.
@injectable
class GetSpinAvailability implements UseCase<SpinAvailability, SpinnerCampaign> {
  const GetSpinAvailability(this._repository);

  final SpinnerRepository _repository;

  @override
  Future<Either<Failure, SpinAvailability>> call(SpinnerCampaign campaign) async {
    final tallyResult = await _repository.getSpinTally(campaign.id);
    final tally = tallyResult.fold((f) => null, (t) => t);
    if (tally == null) {
      return Left(tallyResult.fold((f) => f, (_) => const ServerFailure()));
    }

    final audienceResult = await _repository.getCustomerAudience();
    final audience = audienceResult.fold((f) => null, (a) => a);
    if (audience == null) {
      return Left(audienceResult.fold((f) => f, (_) => const ServerFailure()));
    }

    // `maxSpinsPerUser` defaults to 1 server-side when unset — match that,
    // otherwise an unconfigured campaign would show "0 spins left" forever.
    final maxSpins = campaign.maxSpinsPerUser > 0 ? campaign.maxSpinsPerUser : 1;

    // Cooldown only bites once at least one spin has been recorded.
    var cooldownLeft = 0;
    final lastSpinAt = tally.lastSpinAt;
    if (campaign.spinCooldownHours > 0 && tally.count > 0 && lastSpinAt != null) {
      final elapsed = DateTime.now().difference(lastSpinAt).inMinutes / 60;
      final remaining = campaign.spinCooldownHours - elapsed;
      if (remaining > 0) cooldownLeft = remaining.ceil();
    }

    return Right(
      SpinAvailability(
        spinsUsed: tally.count,
        maxSpins: maxSpins,
        isEligible: audience.matches(campaign.eligibility),
        ineligibleMessage: audience.rejectionMessage(campaign.eligibility),
        cooldownHoursRemaining: cooldownLeft,
      ),
    );
  }
}
