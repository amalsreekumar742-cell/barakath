import 'package:cloud_firestore/cloud_firestore.dart' hide Order;
import 'package:cloud_functions/cloud_functions.dart';
import 'package:firebase_auth/firebase_auth.dart' as fb_auth;
import 'package:injectable/injectable.dart' hide Order;

import '../../../../core/constants/cloud_functions.dart';
import '../../../../core/constants/domain_enums.dart';
import '../../../../core/constants/firebase_collections.dart';
import '../../../../core/error/exceptions.dart';
import '../../../../core/utils/model_parse.dart';
import '../../../replacement/data/models/replacement_model.dart';
import '../models/invoice_business_model.dart';
import '../models/order_model.dart';
import '../../../../core/error/firebase_error_message.dart';

/// The raw result of one orders query — models plus the Firestore cursor. Kept
/// in the data layer so the `DocumentSnapshot` type never escapes it.
class OrderPageDto {
  const OrderPageDto({
    required this.items,
    required this.nextCursor,
    required this.hasMore,
  });

  final List<OrderModel> items;
  final DocumentSnapshot<Map<String, dynamic>>? nextCursor;
  final bool hasMore;
}

/// The ONLY place the orders feature touches Firebase.
///
/// SCHEMA NOTE — the deployed order document is NOT spec §4.8. Verified against
/// `functions/src/orders/createPaymentOrder.ts` and a live order: the owner field
/// is `userId` (which is also what `firestore.rules` checks), money lives in
/// `grandTotal` / `deliveryCharge` / `gstAmount` / `couponDiscount` /
/// `walletAmountUsed`, the address is `shippingAddress`, and history is a
/// `statusTimeline` array — there are no `pendingAt`/`acceptedAt`/… fields and no
/// human `orderId`. The Firestore document id IS the order reference.
abstract class OrderRemoteDataSource {
  /// One cursor page of the signed-in customer's orders, newest-first.
  Future<OrderPageDto> getOrders({
    required OrderFilter filter,
    required int limit,
    Object? startAfter,
  });

  Future<OrderModel> getOrderById(String orderId);

  /// The replacement already raised for one order line, or null.
  Future<ReplacementModel?> getItemReplacement({
    required String orderId,
    required String productId,
    required String variantId,
  });

  Future<void> cancelOrder({required String orderId, required String reason});

  /// Returns the invoice PDF download URL.
  Future<String> generateInvoice(String orderId);

  /// The seller block for the natively rendered invoice (spec Part 7).
  Future<InvoiceBusinessModel> getInvoiceBusiness();
}

@LazySingleton(as: OrderRemoteDataSource)
class OrderRemoteDataSourceImpl implements OrderRemoteDataSource {
  OrderRemoteDataSourceImpl(this._auth, this._firestore, this._functions);

  final fb_auth.FirebaseAuth _auth;
  final FirebaseFirestore _firestore;
  final FirebaseFunctions _functions;

  /// The current uid, or a thrown [AuthException]. Every orders read is scoped
  /// by `userId` — the security rules reject an unscoped query outright, so
  /// failing here gives the UI a friendly message instead of a raw rules error.
  String get _requireUid {
    final uid = _auth.currentUser?.uid;
    if (uid == null) {
      throw const AuthException('Please log in to see your orders.');
    }
    return uid;
  }

  @override
  Future<OrderPageDto> getOrders({
    required OrderFilter filter,
    required int limit,
    Object? startAfter,
  }) async {
    final uid = _requireUid;
    try {
      Query<Map<String, dynamic>> query = _firestore
          .collection(FirebaseCollections.orders)
          .where('userId', isEqualTo: uid);

      // "Active" is a whereIn over the five in-flight statuses; the composite
      // index (userId, status, createdAt desc) in firestore.indexes.json serves
      // it alongside the sort.
      final statuses = filter.statuses;
      if (statuses != null) {
        query = query.where('status', whereIn: statuses);
      }

      query = query.orderBy('createdAt', descending: true);

      // startAfterDocument (not offset) — reads only the next page.
      if (startAfter is DocumentSnapshot<Map<String, dynamic>>) {
        query = query.startAfterDocument(startAfter);
      }

      final snap = await query.limit(limit).get();
      return OrderPageDto(
        items: snap.docs.map(OrderModel.fromFirestore).toList(),
        nextCursor: snap.docs.isEmpty ? null : snap.docs.last,
        hasMore: snap.docs.length == limit,
      );
    } on FirebaseException catch (e) {
      throw ServerException(FirebaseErrorMessage.of(e) ?? 'Could not load your orders.', e.code);
    }
  }

  @override
  Future<OrderModel> getOrderById(String orderId) async {
    final uid = _requireUid;
    try {
      final doc = await _firestore
          .collection(FirebaseCollections.orders)
          .doc(orderId)
          .get();
      if (!doc.exists) throw const ServerException('Order not found.');

      final order = OrderModel.fromFirestore(doc);
      // Defence in depth: the rules already scope reads to the owner, but a
      // mis-typed deep link must not render someone else's address.
      if (order.userId != uid) {
        throw const AuthException('This order belongs to another account.');
      }
      return order;
    } on FirebaseException catch (e) {
      throw ServerException(FirebaseErrorMessage.of(e) ?? 'Could not load this order.', e.code);
    }
  }

  @override
  Future<ReplacementModel?> getItemReplacement({
    required String orderId,
    required String productId,
    required String variantId,
  }) async {
    final uid = _requireUid;
    try {
      // All-equality query, no orderBy: Firestore serves it from single-field
      // indexes via a merge join, so it needs no composite index. `userId` is
      // mandatory — the replacements rule scopes reads to the owner, and a
      // query without it is rejected wholesale.
      final snap = await _firestore
          .collection(FirebaseCollections.replacements)
          .where('userId', isEqualTo: uid)
          .where('orderId', isEqualTo: orderId)
          .where('productId', isEqualTo: productId)
          .where('variantId', isEqualTo: variantId)
          .limit(1)
          .get();
      if (snap.docs.isEmpty) return null;
      return ReplacementModel.fromFirestore(snap.docs.first);
    } on FirebaseException catch (e) {
      throw ServerException(
        FirebaseErrorMessage.of(e) ?? 'Could not check your return requests.',
        e.code,
      );
    }
  }

  @override
  Future<void> cancelOrder({
    required String orderId,
    required String reason,
  }) async {
    try {
      final callable =
          _functions.httpsCallable(CloudFunctions.cancelOrder);
      await callable.call<Map<String, dynamic>>({
        'orderId': orderId,
        'cancelReason': reason,
      });
    } on FirebaseFunctionsException catch (e) {
      // The function checks `admin OR order.userId == caller`, so a customer
      // cancelling their OWN Pending order succeeds. Its other refusals are
      // deliberate and already customer-readable ("Only a Pending order can be
      // cancelled."), so they are surfaced rather than replaced. Cancelling
      // client-side is impossible anyway — orders are `allow update: if
      // isAdmin()` — and would be wrong, since the refund and stock restore are
      // the function's job.
      throw ServerException(
        FirebaseErrorMessage.of(e) ?? 'Could not cancel this order.',
        e.code,
      );
    }
  }

  @override
  Future<String> generateInvoice(String orderId) async {
    try {
      final callable =
          _functions.httpsCallable(CloudFunctions.generateInvoicePDF);
      final response =
          await callable.call<Map<String, dynamic>>({'orderId': orderId});
      final url = ModelParse.toStr(
        Map<String, dynamic>.from(response.data)['invoiceUrl'],
      );
      if (url.isEmpty) {
        throw const ServerException('The invoice could not be generated.');
      }
      return url;
    } on FirebaseFunctionsException catch (e) {
      throw ServerException(
        FirebaseErrorMessage.of(e) ?? 'Could not generate the invoice.',
        e.code,
      );
    }
  }

  @override
  Future<InvoiceBusinessModel> getInvoiceBusiness() async {
    try {
      // `general/config` is world-readable by design (firestore.rules) — the
      // storefront needs delivery fees and GST before sign-in. Secrets live in
      // the sibling `general/secrets`, which is admin-only.
      final doc = await _firestore
          .collection(FirebaseCollections.general)
          .doc(FirebaseCollections.configDoc)
          .get();
      return InvoiceBusinessModel.fromFirestore(doc);
    } on FirebaseException catch (e) {
      throw ServerException(
        FirebaseErrorMessage.of(e) ?? 'Could not load the store details.',
        e.code,
      );
    }
  }
}
