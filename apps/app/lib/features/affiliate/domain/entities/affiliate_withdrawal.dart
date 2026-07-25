import 'package:equatable/equatable.dart';

/// A payout request an affiliate has filed (`affiliateWithdrawals`).
///
/// Field names follow the DEPLOYED contract in
/// `packages/shared/src/types/affiliate.ts`, which the admin panel reads and
/// `approveWithdrawal` writes — NOT spec §4.16, which names the collection
/// `withdrawalRequests` and the rejection field `adminNote`.
///
/// Everything after [status] is server/admin-owned; the client only ever
/// creates the request.
class AffiliateWithdrawal extends Equatable {
  const AffiliateWithdrawal({
    required this.id,
    required this.userId,
    required this.userName,
    required this.userPhone,
    required this.amount,
    required this.bankName,
    required this.accountNumber,
    required this.ifscCode,
    required this.accountHolderName,
    required this.status,
    required this.rejectionReason,
    required this.processedBy,
    required this.processedAt,
    required this.createdAt,
  });

  final String id;
  final String userId;
  final String userName;
  final String userPhone;
  final double amount;
  final String bankName;

  /// Full number as stored. NEVER render it whole — show the last 4 digits via
  /// [maskedAccountNumber].
  final String accountNumber;

  final String ifscCode;
  final String accountHolderName;

  /// 'Pending' | 'Approved' | 'Rejected'.
  final String status;

  /// Set by admin on reject. (Spec §4.16 calls this `adminNote`; the deployed
  /// contract calls it `rejectionReason`.)
  final String rejectionReason;

  final String processedBy;
  final DateTime? processedAt;
  final DateTime? createdAt;

  /// "••4821" — the only form allowed in the UI.
  String get maskedAccountNumber {
    final digits = accountNumber.trim();
    if (digits.length <= 4) return digits;
    return '••${digits.substring(digits.length - 4)}';
  }

  @override
  List<Object?> get props => [
        id,
        userId,
        userName,
        userPhone,
        amount,
        bankName,
        accountNumber,
        ifscCode,
        accountHolderName,
        status,
        rejectionReason,
        processedBy,
        processedAt,
        createdAt,
      ];
}
