import 'package:equatable/equatable.dart';

/// How many times this customer has already spun ONE campaign, and when they
/// last did.
///
/// Read straight off `spinHistory` (`userId == uid && campaignId == id`) with a
/// `count()` aggregation — the same query `spinWheel` runs before it lets a spin
/// through. Counting all-time (not "today") is deliberate: the deployed schema
/// caps by `maxSpinsPerUser` over the LIFE of the campaign plus a
/// `spinCooldownHours` gap, and there is no per-day allowance field. Counting a
/// calendar day here would show "spins left" for a customer the callable will
/// refuse.
class SpinTally extends Equatable {
  const SpinTally({required this.count, required this.lastSpinAt});

  final int count;
  final DateTime? lastSpinAt;

  static const SpinTally empty = SpinTally(count: 0, lastSpinAt: null);

  @override
  List<Object?> get props => [count, lastSpinAt];
}
