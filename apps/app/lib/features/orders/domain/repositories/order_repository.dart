// dartz exports its own `Order` (the comparison typeclass), which collides with
// this feature's entity. Hide it — every file that touches an Order does the same.
import 'package:dartz/dartz.dart' hide Order;

import '../../../../core/constants/domain_enums.dart';
import '../../../../core/error/failures.dart';
import '../../../replacement/domain/entities/replacement.dart';
import '../entities/invoice_business.dart';
import '../entities/order.dart';

/// One cursor-paginated page of the customer's orders.
///
/// [nextCursor] is deliberately opaque (`Object?`): it is a Firestore
/// `DocumentSnapshot` minted in — and only ever read back by — the data layer,
/// so the domain never depends on the Firestore SDK.
class OrderPageResult {
  const OrderPageResult({
    required this.items,
    required this.nextCursor,
    required this.hasMore,
  });

  final List<Order> items;
  final Object? nextCursor;
  final bool hasMore;
}

/// Domain contract for the customer's own orders (spec §2.17).
///
/// Every method returns `Either<Failure, T>`; the implementation catches the
/// datasource's exceptions so no raw Firebase error reaches a provider.
abstract class OrderRepository {
  /// One page of the signed-in customer's orders, newest-first. [filter] maps
  /// to a `status` clause (see [OrderFilterX.statuses]); pass a previous page's
  /// `nextCursor` as [startAfter] to paginate.
  Future<Either<Failure, OrderPageResult>> getOrders({
    required OrderFilter filter,
    int limit,
    Object? startAfter,
  });

  /// A single order document by its Firestore id.
  Future<Either<Failure, Order>> getOrderById(String orderId);

  /// The replacement request already raised for one line of an order, or `null`
  /// when none exists. Drives whether Order Detail shows the "Return / Replace"
  /// button or the existing request's status badge.
  Future<Either<Failure, Replacement?>> getItemReplacement({
    required String orderId,
    required String productId,
    required String variantId,
  });

  /// `orderId` → return status, for every return the customer has raised.
  /// Drives the "Return" tag on the My Orders cards, which the order document
  /// itself carries no field for.
  Future<Either<Failure, Map<String, String>>> getReturnStatusesByOrder();

  /// Cancel a still-Pending order via the `cancelOrder` callable. The client
  /// never writes `status` itself — money moves server-side.
  Future<Either<Failure, Unit>> cancelOrder({
    required String orderId,
    required String reason,
  });

  /// Ask `generateInvoicePDF` to render (or re-render) the invoice and return
  /// its download URL. Delivered orders only — the callable enforces that.
  Future<Either<Failure, String>> generateInvoice(String orderId);

  /// The seller block for the natively rendered invoice (spec Part 7).
  Future<Either<Failure, InvoiceBusiness>> getInvoiceBusiness();
}
