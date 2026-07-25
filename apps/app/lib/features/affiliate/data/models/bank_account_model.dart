import 'package:cloud_firestore/cloud_firestore.dart';

import '../../../../core/utils/model_parse.dart';
import '../../domain/entities/bank_account.dart';

/// Firestore mapping for `users/{uid}/bankAccounts` documents.
class BankAccountModel extends BankAccount {
  const BankAccountModel({
    required super.id,
    required super.accountHolderName,
    required super.accountNumber,
    required super.ifscCode,
    required super.bankName,
    required super.bankBranch,
    required super.createdAt,
  });

  factory BankAccountModel.fromFirestore(
    DocumentSnapshot<Map<String, dynamic>> doc,
  ) {
    final data = doc.data() ?? const {};
    return BankAccountModel(
      id: doc.id,
      accountHolderName: ModelParse.toStr(data['accountHolderName']),
      accountNumber: ModelParse.toStr(data['accountNumber']),
      ifscCode: ModelParse.toStr(data['ifscCode']),
      bankName: ModelParse.toStr(data['bankName']),
      bankBranch: ModelParse.toStr(data['bankBranch']),
      createdAt: ModelParse.dateTime(data['createdAt']),
    );
  }

  Map<String, dynamic> toFirestore() => {
        'accountHolderName': accountHolderName,
        'accountNumber': accountNumber,
        'ifscCode': ifscCode.toUpperCase(),
        'bankName': bankName,
        'bankBranch': bankBranch,
        'createdAt': FieldValue.serverTimestamp(),
      };
}
