import 'package:equatable/equatable.dart';

import '../../../../core/constants/domain_enums.dart';

/// One entry in a customer's wallet ledger. Append-only, server-authoritative —
/// the app only reads it.
///
/// SCHEMA NOTE: these field names mirror the DEPLOYED `walletTransactions`
/// documents (a TOP-LEVEL collection filtered by `userId`), not spec §4.9's
/// `customers/{id}/walletTransactions` sub-collection shape. Do not rename them
/// to the spec's names — the Cloud Functions write these.
class WalletTransaction extends Equatable {
  final String id;
  final String userId;

  /// 'Credit' | 'Debit'.
  final String type;
  final double amount;

  /// 'Refund' | 'Reward' | 'Top-up' | 'Purchase' | 'Admin'.
  final String source;
  final String description;
  final String orderId;
  final double balanceAfter;
  final DateTime? createdAt;

  const WalletTransaction({
    required this.id,
    required this.userId,
    required this.type,
    required this.amount,
    required this.source,
    required this.description,
    required this.orderId,
    required this.balanceAfter,
    required this.createdAt,
  });

  bool get isCredit => type == 'Credit';

  /// Typed view of [type], tolerant of casing written by a newer admin build.
  WalletTxnType get txnType => WalletTxnTypeX.from(type);

  /// Typed view of [source]; `null` when the ledger carries a source this build
  /// doesn't know (render the raw [source] string rather than dropping the row).
  ///
  /// There is deliberately no cashback source — spec §2.20 removed cashback from
  /// the product even though the prototype still draws a Cashback tile.
  WalletSource? get walletSource => WalletSourceX.from(source);

  /// Human label for the row: the ledger's own [description] when the server
  /// wrote one, otherwise the source.
  String get title => description.trim().isNotEmpty ? description : source;

  /// Positive for a credit, negative for a debit — the sign the UI renders.
  double get signedAmount => isCredit ? amount : -amount;

  @override
  List<Object?> get props => [
        id,
        userId,
        type,
        amount,
        source,
        description,
        orderId,
        balanceAfter,
        createdAt,
      ];
}
