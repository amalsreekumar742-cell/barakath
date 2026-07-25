import 'package:cloud_firestore/cloud_firestore.dart';

import '../../../../core/utils/keywords.dart';
import '../../../../core/utils/model_parse.dart';
import '../../domain/entities/replacement.dart';

/// A product-replacement request (`replacements/{id}`). The app CREATES these
/// (with reason + photos); the admin resolves them.
class ReplacementModel extends Replacement {
  const ReplacementModel({
    required super.id,
    required super.requestId,
    required super.orderId,
    required super.userId,
    required super.userName,
    required super.userPhone,
    required super.userEmail,
    required super.productId,
    required super.productName,
    required super.productImage,
    required super.variantId,
    required super.variantName,
    required super.variantColor,
    required super.quantity,
    required super.reason,
    required super.photos,
    required super.status,
    required super.adminNote,
    required super.replacementOrderId,
    required super.processedBy,
    required super.processedByName,
    required super.processedAt,
    required super.createdAt,
    required super.updatedAt,
  });

  factory ReplacementModel.fromFirestore(
    DocumentSnapshot<Map<String, dynamic>> doc,
  ) {
    final data = doc.data() ?? const {};
    return ReplacementModel(
      id: doc.id,
      requestId: ModelParse.toStr(data['requestId']),
      orderId: ModelParse.toStr(data['orderId']),
      userId: ModelParse.toStr(data['userId']),
      userName: ModelParse.toStr(data['userName']),
      userPhone: ModelParse.toStr(data['userPhone']),
      userEmail: ModelParse.toStr(data['userEmail']),
      productId: ModelParse.toStr(data['productId']),
      productName: ModelParse.toStr(data['productName']),
      productImage: ModelParse.toStr(data['productImage']),
      variantId: ModelParse.toStr(data['variantId']),
      variantName: ModelParse.toStr(data['variantName']),
      variantColor: ModelParse.toStr(data['variantColor']),
      quantity: ModelParse.toInt(data['quantity']),
      reason: ModelParse.toStr(data['reason']),
      photos: ModelParse.stringList(data['photos']),
      status: ModelParse.toStr(data['status'], 'Pending'),
      adminNote: ModelParse.toStr(data['adminNote']),
      replacementOrderId: ModelParse.toStr(data['replacementOrderId']),
      processedBy: ModelParse.toStr(data['processedBy']),
      processedByName: ModelParse.toStr(data['processedByName']),
      processedAt: ModelParse.dateTime(data['processedAt']),
      createdAt: ModelParse.dateTime(data['createdAt']),
      updatedAt: ModelParse.dateTime(data['updatedAt']),
    );
  }

  /// Fields the app writes when a customer raises a replacement request.
  ///
  /// The resolution fields ARE written, as empty values: `firestore.rules`
  /// requires `status == 'Pending'`, `adminNote == ''` and
  /// `replacementOrderId == ''` on create, so a request can never arrive
  /// pre-approved. Everything after that is admin-owned.
  ///
  /// `keywords` feeds the admin's `array-contains` replacement search
  /// (firestore.indexes.json) — omitting it makes the request unsearchable.
  Map<String, dynamic> toFirestore() {
    return {
      'requestId': requestId,
      'adminNote': '',
      'replacementOrderId': '',
      'processedBy': '',
      'processedByName': '',
      'processedAt': null,
      'orderId': orderId,
      'userId': userId,
      'userName': userName,
      'userPhone': userPhone,
      'userEmail': userEmail,
      'productId': productId,
      'productName': productName,
      'productImage': productImage,
      'variantId': variantId,
      'variantName': variantName,
      'variantColor': variantColor,
      'quantity': quantity,
      'reason': reason,
      'photos': photos,
      'status': 'Pending',
      'keywords': buildKeywords([userName, userPhone, userEmail, productName]),
      'createdAt': FieldValue.serverTimestamp(),
      'updatedAt': FieldValue.serverTimestamp(),
    };
  }
}
