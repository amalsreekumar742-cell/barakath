import 'package:dartz/dartz.dart';

import '../../../../core/constants/domain_enums.dart';
import '../../../../core/error/failures.dart';
import '../entities/customer_audience.dart';
import '../entities/spin_coupon_page.dart';
import '../entities/spin_result.dart';
import '../entities/spin_tally.dart';
import '../entities/spinner_campaign.dart';

/// Spin & Win + coupon wallet (spec §2.23) against the DEPLOYED contract:
/// `spinnerCampaigns` (inline `slots[]`), `spinHistory`, the `spinWheel`
/// callable, and `coupons` for the wallet. No `spinRewards`, no `offers`
/// sub-collection.
abstract class SpinnerRepository {
  /// The one live campaign, or `null` when nothing is running.
  Future<Either<Failure, SpinnerCampaign?>> getActiveCampaign();

  /// How many spins this customer has already used on [campaignId].
  Future<Either<Failure, SpinTally>> getSpinTally(String campaignId);

  /// The signed-in customer's audience facts (order count, affiliate code).
  Future<Either<Failure, CustomerAudience>> getCustomerAudience();

  /// Runs one spin. The RESULT comes from the server — the client neither picks
  /// the wedge nor writes the coupon.
  Future<Either<Failure, SpinResult>> spin(String campaignId);

  /// A cursor page of the customer's `SPIN-` coupons for one wallet tab.
  Future<Either<Failure, SpinCouponPage>> getMyCoupons({
    required SpinRewardStatus status,
    Object? startAfter,
    int limit,
  });
}
