import 'package:equatable/equatable.dart';

/// A product-replacement request (`replacements/{id}`). The app CREATES these
/// (with reason + photos); the admin resolves them.
class Replacement extends Equatable {
  final String id;

  /// Human display reference, `#RP-0001` (design map §4 conflict 5 — the
  /// prototype's `#RT-3391` loses). Not part of the deployed shared contract:
  /// documents written before Batch 4 simply have none, so this can be ''.
  final String requestId;

  final String orderId;
  final String userId;
  final String userName;
  final String userPhone;
  final String userEmail;
  final String productId;
  final String productName;
  final String productImage;
  final String variantId;
  final String variantName;
  final String variantColor;
  final int quantity;
  final String reason;
  final List<String> photos;

  /// 'Pending' | 'Approved' | 'Rejected'.
  final String status;
  final String adminNote;
  final String replacementOrderId;
  final String processedBy;
  final String processedByName;
  final DateTime? processedAt;
  final DateTime? createdAt;
  final DateTime? updatedAt;

  const Replacement({
    required this.id,
    required this.requestId,
    required this.orderId,
    required this.userId,
    required this.userName,
    required this.userPhone,
    required this.userEmail,
    required this.productId,
    required this.productName,
    required this.productImage,
    required this.variantId,
    required this.variantName,
    required this.variantColor,
    required this.quantity,
    required this.reason,
    required this.photos,
    required this.status,
    required this.adminNote,
    required this.replacementOrderId,
    required this.processedBy,
    required this.processedByName,
    required this.processedAt,
    required this.createdAt,
    required this.updatedAt,
  });

  @override
  List<Object?> get props => [
        id,
        requestId,
        orderId,
        userId,
        userName,
        userPhone,
        userEmail,
        productId,
        productName,
        productImage,
        variantId,
        variantName,
        variantColor,
        quantity,
        reason,
        photos,
        status,
        adminNote,
        replacementOrderId,
        processedBy,
        processedByName,
        processedAt,
        createdAt,
        updatedAt,
      ];
}
