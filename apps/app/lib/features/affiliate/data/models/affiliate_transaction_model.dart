import 'package:cloud_firestore/cloud_firestore.dart';

import '../../../../core/utils/model_parse.dart';
import '../../domain/entities/affiliate_transaction.dart';

/// One entry in a customer's affiliate ledger. Server-authoritative — the app
/// only reads it. Referral rewards clear after a hold window (`clearsAt`).
class AffiliateTransactionModel extends AffiliateTransaction {
  const AffiliateTransactionModel({
    required super.id,
    required super.userId,
    required super.type,
    required super.amount,
    required super.source,
    required super.description,
    required super.referredUserId,
    required super.referredUserName,
    required super.orderId,
    required super.balanceAfter,
    required super.status,
    required super.clearsAt,
    required super.createdAt,
  });

  factory AffiliateTransactionModel.fromFirestore(
    DocumentSnapshot<Map<String, dynamic>> doc,
  ) {
    final data = doc.data() ?? const {};
    return AffiliateTransactionModel(
      id: doc.id,
      userId: ModelParse.toStr(data['userId']),
      type: ModelParse.toStr(data['type']),
      amount: ModelParse.toDouble(data['amount']),
      source: ModelParse.toStr(data['source']),
      description: ModelParse.toStr(data['description']),
      referredUserId: ModelParse.toStr(data['referredUserId']),
      referredUserName: ModelParse.toStr(data['referredUserName']),
      orderId: ModelParse.toStr(data['orderId']),
      balanceAfter: ModelParse.toDouble(data['balanceAfter']),
      status: ModelParse.toStr(data['status']),
      clearsAt: ModelParse.dateTime(data['clearsAt']),
      createdAt: ModelParse.dateTime(data['createdAt']),
    );
  }
}
