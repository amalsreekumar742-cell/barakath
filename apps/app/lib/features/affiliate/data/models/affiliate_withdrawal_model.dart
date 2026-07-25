import 'package:cloud_firestore/cloud_firestore.dart';

import '../../../../core/utils/keywords.dart';
import '../../../../core/utils/model_parse.dart';
import '../../domain/entities/affiliate_withdrawal.dart';

/// Firestore mapping for `affiliateWithdrawals` documents.
class AffiliateWithdrawalModel extends AffiliateWithdrawal {
  const AffiliateWithdrawalModel({
    required super.id,
    required super.userId,
    required super.userName,
    required super.userPhone,
    required super.amount,
    required super.bankName,
    required super.accountNumber,
    required super.ifscCode,
    required super.accountHolderName,
    required super.status,
    required super.rejectionReason,
    required super.processedBy,
    required super.processedAt,
    required super.createdAt,
  });

  factory AffiliateWithdrawalModel.fromFirestore(
    DocumentSnapshot<Map<String, dynamic>> doc,
  ) {
    final data = doc.data() ?? const {};
    return AffiliateWithdrawalModel(
      id: doc.id,
      userId: ModelParse.toStr(data['userId']),
      userName: ModelParse.toStr(data['userName']),
      userPhone: ModelParse.toStr(data['userPhone']),
      amount: ModelParse.toDouble(data['amount']),
      bankName: ModelParse.toStr(data['bankName']),
      accountNumber: ModelParse.toStr(data['accountNumber']),
      ifscCode: ModelParse.toStr(data['ifscCode']),
      accountHolderName: ModelParse.toStr(data['accountHolderName']),
      status: ModelParse.toStr(data['status'], 'Pending'),
      rejectionReason: ModelParse.toStr(data['rejectionReason']),
      processedBy: ModelParse.toStr(data['processedBy']),
      processedAt: ModelParse.dateTime(data['processedAt']),
      createdAt: ModelParse.dateTime(data['createdAt']),
    );
  }

  /// The create payload. Deliberately omits every admin-owned field —
  /// `status` is forced to Pending here AND in the Firestore rule, and the
  /// client never touches `affiliateBalance` (admin deducts on approval).
  Map<String, dynamic> toCreateMap() => {
        'userId': userId,
        'userName': userName,
        'userPhone': userPhone,
        'amount': amount,
        'bankName': bankName,
        'accountNumber': accountNumber,
        'ifscCode': ifscCode,
        'accountHolderName': accountHolderName,
        'status': 'Pending',
        'rejectionReason': '',
        'processedBy': '',
        'processedAt': null,
        'keywords': buildKeywords([userName, userPhone]),
        'createdAt': FieldValue.serverTimestamp(),
        'updatedAt': FieldValue.serverTimestamp(),
      };
}
