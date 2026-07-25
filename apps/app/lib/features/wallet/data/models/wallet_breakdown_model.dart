import '../../domain/entities/wallet_breakdown.dart';

/// The Rewards total as returned by the Firestore aggregation `sum()` queries.
/// No `fromFirestore` — an aggregate snapshot carries a single number, not a
/// document.
class WalletBreakdownModel extends WalletBreakdown {
  const WalletBreakdownModel({required super.rewardsTotal});
}
