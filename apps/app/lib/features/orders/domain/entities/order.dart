import 'package:equatable/equatable.dart';

import '../../../address/domain/entities/address.dart';

/// One line item on an order (embedded array on the order document).
class OrderItem extends Equatable {
  final String productId;
  final String productName;
  final String productImage;
  final String variantId;
  final String variantName;
  final String variantColor;
  final double mrp;
  final double offerPrice;
  final int quantity;
  final double subtotal;

  const OrderItem({
    required this.productId,
    required this.productName,
    required this.productImage,
    required this.variantId,
    required this.variantName,
    required this.variantColor,
    required this.mrp,
    required this.offerPrice,
    required this.quantity,
    required this.subtotal,
  });

  @override
  List<Object?> get props => [
        productId,
        productName,
        productImage,
        variantId,
        variantName,
        variantColor,
        mrp,
        offerPrice,
        quantity,
        subtotal,
      ];
}

/// One entry in an order's status history (embedded array).
class StatusTimeline extends Equatable {
  final String status;
  final DateTime? timestamp;
  final String note;

  const StatusTimeline({
    required this.status,
    required this.timestamp,
    required this.note,
  });

  @override
  List<Object?> get props => [status, timestamp, note];
}

/// A customer order document (`orders/{id}`).
///
/// Money fields are recomputed server-side and never trusted from the client;
/// the app reads them for display only.
class Order extends Equatable {
  final String id;
  final String userId;
  final String userName;
  final String userPhone;
  final String userEmail;
  final List<OrderItem> items;
  final double subtotal;
  final double couponDiscount;
  final String couponCode;
  final double walletAmountUsed;
  final double deliveryCharge;
  final double gstAmount;
  final double grandTotal;

  /// 'Razorpay' | 'Wallet' | 'Both'.
  final String paymentMethod;

  /// 'Pending' | 'Paid' | 'Failed' | 'Refunded'.
  final String paymentStatus;
  final String razorpayOrderId;
  final String razorpayPaymentId;

  /// Order status enum ('Pending' … 'Delivered' | 'Cancelled').
  final String status;
  final Address shippingAddress;
  final String trackingId;
  final String courierName;

  /// Not in the shared schema — defaults to '' (see report).
  final String invoiceUrl;
  final List<StatusTimeline> statusTimeline;
  final String cancelReason;
  final bool isComboOrder;
  final DateTime? createdAt;
  final DateTime? updatedAt;

  const Order({
    required this.id,
    required this.userId,
    required this.userName,
    required this.userPhone,
    required this.userEmail,
    required this.items,
    required this.subtotal,
    required this.couponDiscount,
    required this.couponCode,
    required this.walletAmountUsed,
    required this.deliveryCharge,
    required this.gstAmount,
    required this.grandTotal,
    required this.paymentMethod,
    required this.paymentStatus,
    required this.razorpayOrderId,
    required this.razorpayPaymentId,
    required this.status,
    required this.shippingAddress,
    required this.trackingId,
    required this.courierName,
    required this.invoiceUrl,
    required this.statusTimeline,
    required this.cancelReason,
    required this.isComboOrder,
    required this.createdAt,
    required this.updatedAt,
  });

  int get totalItems => items.fold(0, (acc, item) => acc + item.quantity);

  @override
  List<Object?> get props => [
        id,
        userId,
        userName,
        userPhone,
        userEmail,
        items,
        subtotal,
        couponDiscount,
        couponCode,
        walletAmountUsed,
        deliveryCharge,
        gstAmount,
        grandTotal,
        paymentMethod,
        paymentStatus,
        razorpayOrderId,
        razorpayPaymentId,
        status,
        shippingAddress,
        trackingId,
        courierName,
        invoiceUrl,
        statusTimeline,
        cancelReason,
        isComboOrder,
        createdAt,
        updatedAt,
      ];
}
