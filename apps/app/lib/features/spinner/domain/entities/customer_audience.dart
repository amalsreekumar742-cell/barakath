import 'package:equatable/equatable.dart';

import '../../../../core/constants/domain_enums.dart';

/// The two facts about the signed-in customer that decide whether a campaign's
/// audience gate lets them in (`users/{uid}.totalOrders` and `.affiliateCode`).
///
/// Kept as its own entity rather than reaching for the auth feature's `User`:
/// the eligibility rule needs two counters, not a profile, and the spinner has
/// no business depending on the whole session object.
class CustomerAudience extends Equatable {
  const CustomerAudience({required this.totalOrders, required this.affiliateCode});

  final int totalOrders;
  final String affiliateCode;

  static const CustomerAudience unknown =
      CustomerAudience(totalOrders: 0, affiliateCode: '');

  bool get isNewCustomer => totalOrders == 0;
  bool get isAffiliate => affiliateCode.trim().isNotEmpty;

  /// Does this customer match [audience]?
  bool matches(SpinEligibility audience) => switch (audience) {
        SpinEligibility.allUsers => true,
        SpinEligibility.newUsers => isNewCustomer,
        SpinEligibility.affiliates => isAffiliate,
      };

  /// Why they don't, phrased for the customer. Null when they DO match.
  String? rejectionMessage(SpinEligibility audience) {
    if (matches(audience)) return null;
    return switch (audience) {
      SpinEligibility.allUsers => null,
      SpinEligibility.newUsers =>
        'This campaign is for first-time customers only.',
      SpinEligibility.affiliates =>
        'This campaign is for affiliate members only.',
    };
  }

  @override
  List<Object?> get props => [totalOrders, affiliateCode];
}
