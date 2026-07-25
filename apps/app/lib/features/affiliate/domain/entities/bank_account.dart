import 'package:equatable/equatable.dart';

/// A saved payout account (`users/{uid}/bankAccounts`), spec §4.9.
///
/// New in Batch 4 — nothing deployed writes this yet, so it follows the spec
/// shape exactly. Max 2 per affiliate (spec §2.22), enforced in the app.
class BankAccount extends Equatable {
  const BankAccount({
    required this.id,
    required this.accountHolderName,
    required this.accountNumber,
    required this.ifscCode,
    required this.bankName,
    required this.bankBranch,
    required this.createdAt,
  });

  final String id;
  final String accountHolderName;

  /// Stored in full; render only [maskedAccountNumber].
  final String accountNumber;

  final String ifscCode;

  /// Resolved from the IFSC lookup, not typed by the customer.
  final String bankName;
  final String bankBranch;

  final DateTime? createdAt;

  String get maskedAccountNumber {
    final digits = accountNumber.trim();
    if (digits.length <= 4) return digits;
    return '••${digits.substring(digits.length - 4)}';
  }

  @override
  List<Object?> get props => [
        id,
        accountHolderName,
        accountNumber,
        ifscCode,
        bankName,
        bankBranch,
        createdAt,
      ];
}
