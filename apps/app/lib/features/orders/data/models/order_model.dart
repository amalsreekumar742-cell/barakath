import 'package:cloud_firestore/cloud_firestore.dart' hide Order;

import 'package:barakath/features/address/data/models/address_model.dart';

import '../../../../core/utils/model_parse.dart';
import '../../domain/entities/order.dart';

/// One line item on an order (embedded array on the order document).
class OrderItemModel extends OrderItem {
  const OrderItemModel({
    required super.productId,
    required super.productName,
    required super.productImage,
    required super.variantId,
    required super.variantName,
    required super.variantColor,
    required super.mrp,
    required super.offerPrice,
    required super.quantity,
    required super.subtotal,
    super.gstPercentage,
    super.gstAmount,
  });

  factory OrderItemModel.fromMap(Map<String, dynamic> data) {
    // Read as nullable, NOT through ModelParse.toDouble: that maps a missing key to 0.0, which would
    // report a legacy order as taxed at 0% instead of "breakdown unavailable".
    final rawPct = data['gstPercentage'];
    final rawGst = data['gstAmount'];
    return OrderItemModel(
      productId: ModelParse.toStr(data['productId']),
      productName: ModelParse.toStr(data['productName']),
      productImage: ModelParse.toStr(data['productImage']),
      variantId: ModelParse.toStr(data['variantId']),
      variantName: ModelParse.toStr(data['variantName']),
      variantColor: ModelParse.toStr(data['variantColor']),
      mrp: ModelParse.toDouble(data['mrp']),
      offerPrice: ModelParse.toDouble(data['offerPrice']),
      quantity: ModelParse.toInt(data['quantity']),
      subtotal: ModelParse.toDouble(data['subtotal']),
      gstPercentage: rawPct is num ? rawPct.toDouble() : null,
      gstAmount: rawGst is num ? rawGst.toDouble() : null,
    );
  }

  Map<String, dynamic> toMap() {
    return {
      'productId': productId,
      'productName': productName,
      'productImage': productImage,
      'variantId': variantId,
      'variantName': variantName,
      'variantColor': variantColor,
      'mrp': mrp,
      'offerPrice': offerPrice,
      'quantity': quantity,
      'subtotal': subtotal,
      // Omitted when absent, so a round-trip never turns "unknown" into an explicit 0%.
      if (gstPercentage != null) 'gstPercentage': gstPercentage,
      if (gstAmount != null) 'gstAmount': gstAmount,
    };
  }
}

/// One entry in an order's status history (embedded array).
class StatusTimelineModel extends StatusTimeline {
  const StatusTimelineModel({
    required super.status,
    required super.timestamp,
    required super.note,
  });

  factory StatusTimelineModel.fromMap(Map<String, dynamic> data) {
    return StatusTimelineModel(
      status: ModelParse.toStr(data['status']),
      timestamp: ModelParse.dateTime(data['timestamp']),
      note: ModelParse.toStr(data['note']),
    );
  }
}

/// A customer order document (`orders/{id}`).
///
/// Money fields are recomputed server-side and never trusted from the client;
/// the app reads them for display only.
class OrderModel extends Order {
  const OrderModel({
    required super.id,
    required super.userId,
    required super.userName,
    required super.userPhone,
    required super.userEmail,
    required super.items,
    required super.subtotal,
    required super.couponDiscount,
    required super.couponCode,
    required super.walletAmountUsed,
    required super.deliveryCharge,
    required super.gstAmount,
    required super.grandTotal,
    required super.paymentMethod,
    required super.paymentStatus,
    required super.razorpayOrderId,
    required super.razorpayPaymentId,
    required super.status,
    required super.shippingAddress,
    required super.trackingId,
    required super.courierName,
    required super.invoiceUrl,
    required super.statusTimeline,
    required super.cancelReason,
    required super.isComboOrder,
    required super.createdAt,
    required super.updatedAt,
  });

  factory OrderModel.fromFirestore(DocumentSnapshot<Map<String, dynamic>> doc) {
    final data = doc.data() ?? const {};
    return OrderModel(
      id: doc.id,
      userId: ModelParse.toStr(data['userId']),
      userName: ModelParse.toStr(data['userName']),
      userPhone: ModelParse.toStr(data['userPhone']),
      userEmail: ModelParse.toStr(data['userEmail']),
      items: ModelParse.mapList(data['items'])
          .map(OrderItemModel.fromMap)
          .toList(),
      subtotal: ModelParse.toDouble(data['subtotal']),
      couponDiscount: ModelParse.toDouble(data['couponDiscount']),
      couponCode: ModelParse.toStr(data['couponCode']),
      walletAmountUsed: ModelParse.toDouble(data['walletAmountUsed']),
      deliveryCharge: ModelParse.toDouble(data['deliveryCharge']),
      gstAmount: ModelParse.toDouble(data['gstAmount']),
      grandTotal: ModelParse.toDouble(data['grandTotal']),
      paymentMethod: ModelParse.toStr(data['paymentMethod']),
      paymentStatus: ModelParse.toStr(data['paymentStatus'], 'Pending'),
      razorpayOrderId: ModelParse.toStr(data['razorpayOrderId']),
      razorpayPaymentId: ModelParse.toStr(data['razorpayPaymentId']),
      status: ModelParse.toStr(data['status'], 'Pending'),
      shippingAddress:
          AddressModel.fromMap(ModelParse.map(data['shippingAddress'])),
      trackingId: ModelParse.toStr(data['trackingId']),
      courierName: ModelParse.toStr(data['courierName']),
      invoiceUrl: ModelParse.toStr(data['invoiceUrl']),
      statusTimeline: ModelParse.mapList(data['statusTimeline'])
          .map(StatusTimelineModel.fromMap)
          .toList(),
      cancelReason: ModelParse.toStr(data['cancelReason']),
      isComboOrder: ModelParse.toBool(data['isComboOrder']),
      createdAt: ModelParse.dateTime(data['createdAt']),
      updatedAt: ModelParse.dateTime(data['updatedAt']),
    );
  }
}
