import 'package:cloud_firestore/cloud_firestore.dart';

import '../../../../core/utils/model_parse.dart';
import '../../domain/entities/wallet_transaction.dart';

/// One entry in a customer's wallet ledger. Append-only, server-authoritative —
/// the app only reads it.
class WalletTransactionModel extends WalletTransaction {
  const WalletTransactionModel({
    required super.id,
    required super.userId,
    required super.type,
    required super.amount,
    required super.source,
    required super.description,
    required super.orderId,
    required super.balanceAfter,
    required super.createdAt,
  });

  factory WalletTransactionModel.fromFirestore(
    DocumentSnapshot<Map<String, dynamic>> doc,
  ) {
    final data = doc.data() ?? const {};
    return WalletTransactionModel(
      id: doc.id,
      userId: ModelParse.toStr(data['userId']),
      type: ModelParse.toStr(data['type']),
      amount: ModelParse.toDouble(data['amount']),
      source: ModelParse.toStr(data['source']),
      description: ModelParse.toStr(data['description']),
      orderId: ModelParse.toStr(data['orderId']),
      balanceAfter: ModelParse.toDouble(data['balanceAfter']),
      createdAt: ModelParse.dateTime(data['createdAt']),
    );
  }
}
