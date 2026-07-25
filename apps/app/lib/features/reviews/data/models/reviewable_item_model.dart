import 'package:cloud_firestore/cloud_firestore.dart';

import '../../../../core/constants/domain_enums.dart';
import '../../../../core/utils/model_parse.dart';
import '../../domain/entities/reviewable_item.dart';

/// Projects one line of an `orders/{id}` document into a [ReviewableItem].
///
/// WHY it parses the order map itself instead of reusing `OrderModel`: the
/// Orders feature is owned by another session and its model is free to change
/// shape. This screen needs six fields off one array element — reading them
/// directly keeps the two features from having to move in lockstep.
class ReviewableItemModel extends ReviewableItem {
  const ReviewableItemModel({
    required super.orderId,
    required super.productId,
    required super.productName,
    required super.productImage,
    required super.variantId,
    required super.variantName,
    required super.customerName,
    required super.isDelivered,
    required super.deliveredAt,
  });

  /// Returns null when the order carries no line for [productId] — the caller
  /// turns that into a "this product isn't on that order" failure.
  static ReviewableItemModel? fromOrderDoc(
    DocumentSnapshot<Map<String, dynamic>> doc,
    String productId,
  ) {
    final data = doc.data() ?? const <String, dynamic>{};

    final items = ModelParse.mapList(data['items']);
    Map<String, dynamic>? line;
    for (final item in items) {
      if (ModelParse.toStr(item['productId']) == productId) {
        line = item;
        break;
      }
    }
    if (line == null) return null;

    final status = OrderStatusX.from(ModelParse.toStr(data['status']));

    return ReviewableItemModel(
      orderId: doc.id,
      productId: productId,
      productName: ModelParse.toStr(line['productName']),
      productImage: ModelParse.toStr(line['productImage']),
      variantId: ModelParse.toStr(line['variantId']),
      variantName: ModelParse.toStr(line['variantName']),
      customerName: ModelParse.toStr(data['userName']),
      isDelivered: status == OrderStatus.delivered,
      deliveredAt: _deliveredAt(data),
    );
  }

  /// The timestamp of the `Delivered` entry in `statusTimeline`, if present.
  static DateTime? _deliveredAt(Map<String, dynamic> data) {
    for (final entry in ModelParse.mapList(data['statusTimeline'])) {
      if (OrderStatusX.from(ModelParse.toStr(entry['status'])) ==
          OrderStatus.delivered) {
        return ModelParse.dateTime(entry['timestamp']);
      }
    }
    return null;
  }
}
