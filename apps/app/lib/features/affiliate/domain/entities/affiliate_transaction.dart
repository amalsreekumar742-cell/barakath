import 'package:equatable/equatable.dart';

/// One entry in a customer's affiliate ledger. Server-authoritative — the app
/// only reads it. Referral rewards clear after a hold window (`clearsAt`).
class AffiliateTransaction extends Equatable {
  final String id;
  final String userId;

  /// 'Credit' | 'Debit'.
  final String type;
  final double amount;

  /// 'Referral' | 'Withdrawal' | 'Admin' | 'Reversal'.
  final String source;
  final String description;
  final String referredUserId;
  final String referredUserName;
  final String orderId;
  final double balanceAfter;

  /// 'Cleared' | 'Pending' | 'Withdrawn'.
  final String status;
  final DateTime? clearsAt;
  final DateTime? createdAt;

  const AffiliateTransaction({
    required this.id,
    required this.userId,
    required this.type,
    required this.amount,
    required this.source,
    required this.description,
    required this.referredUserId,
    required this.referredUserName,
    required this.orderId,
    required this.balanceAfter,
    required this.status,
    required this.clearsAt,
    required this.createdAt,
  });

  bool get isCredit => type == 'Credit';

  @override
  List<Object?> get props => [
        id,
        userId,
        type,
        amount,
        source,
        description,
        referredUserId,
        referredUserName,
        orderId,
        balanceAfter,
        status,
        clearsAt,
        createdAt,
      ];
}
