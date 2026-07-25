import 'package:equatable/equatable.dart';

/// The summary tile under the wallet balance card.
///
/// ONE tile — Rewards. Refunds was removed: a refund is already the most
/// legible line in the ledger below ("Refund for cancelled order …"), so a
/// lifetime total of them told the customer nothing they could act on, and it
/// sat at ₹0 for everyone who had never cancelled anything.
///
/// "Rewards" means every credit the STORE gave you rather than money you put in
/// yourself — a spin/loyalty reward AND an admin credit. The admin's "Add money"
/// is the store handing a customer money, so it belongs in this figure; before
/// this it appeared in the ledger but in neither tile.
///
/// The total comes from Firestore AGGREGATION `sum()` queries — the app never
/// pages the ledger to add money up client-side.
class WalletBreakdown extends Equatable {
  const WalletBreakdown({required this.rewardsTotal});

  /// Lifetime sum of credits the store granted: sources `Reward` and `Admin`.
  final double rewardsTotal;

  /// A safe zero — shown until the first aggregate lands and after a failed one,
  /// so the tile never renders a null or a stale figure.
  static const empty = WalletBreakdown(rewardsTotal: 0);

  @override
  List<Object?> get props => [rewardsTotal];
}
