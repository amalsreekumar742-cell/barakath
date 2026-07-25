import 'package:equatable/equatable.dart';

/// Everything the Spin screen needs to decide whether the button is live, and
/// what to say when it isn't.
///
/// Every field is derived from server state (a `spinHistory` count, the campaign
/// document, the user document) — never from a local decrement after a spin.
/// The callable remains the authority; this only keeps the UI from offering a
/// spin that would come straight back as an error.
class SpinAvailability extends Equatable {
  const SpinAvailability({
    required this.spinsUsed,
    required this.maxSpins,
    required this.isEligible,
    required this.ineligibleMessage,
    required this.cooldownHoursRemaining,
  });

  final int spinsUsed;
  final int maxSpins;

  /// False when the campaign targets an audience this customer isn't in.
  final bool isEligible;

  /// The explanation to render instead of the wheel. Null when [isEligible].
  final String? ineligibleMessage;

  /// Whole hours still to wait because of `spinCooldownHours`; 0 when free.
  final int cooldownHoursRemaining;

  static const SpinAvailability none = SpinAvailability(
    spinsUsed: 0,
    maxSpins: 0,
    isEligible: true,
    ineligibleMessage: null,
    cooldownHoursRemaining: 0,
  );

  int get spinsRemaining {
    final left = maxSpins - spinsUsed;
    return left < 0 ? 0 : left;
  }

  bool get canSpin =>
      isEligible && spinsRemaining > 0 && cooldownHoursRemaining <= 0;

  /// The chip copy. Deliberately NOT "today": the cap is per campaign, not per
  /// calendar day — see `SpinTally`.
  String get spinsLeftLabel =>
      spinsRemaining == 1 ? '1 spin left' : '$spinsRemaining spins left';

  @override
  List<Object?> get props => [
        spinsUsed,
        maxSpins,
        isEligible,
        ineligibleMessage,
        cooldownHoursRemaining,
      ];
}
