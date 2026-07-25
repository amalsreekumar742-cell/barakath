import 'package:equatable/equatable.dart';

/// The bank an IFSC code resolves to (Razorpay's public IFSC directory).
///
/// The customer never types the bank name — spec §2.22 says the IFSC is
/// "auto-verify", so the resolved [bank] and [branch] are what gets stored on
/// the bank-account document.
class IfscDetails extends Equatable {
  const IfscDetails({
    required this.ifsc,
    required this.bank,
    required this.branch,
  });

  final String ifsc;
  final String bank;
  final String branch;

  @override
  List<Object?> get props => [ifsc, bank, branch];
}
