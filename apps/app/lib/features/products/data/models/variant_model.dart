import 'package:cloud_firestore/cloud_firestore.dart';

import '../../../../core/utils/model_parse.dart';
import '../../domain/entities/variant.dart';

/// A product variant document (`products/{id}/variants/{variantId}`).
///
/// Per-variant pricing (spec §1.5): MRP ≥ Offer ≥ Referral ≥ Commission.
/// The fixed affiliate commission is stored under the key `commission`.
/// `flashSalePrice` is only present on a variant while its product is in an
/// active flash sale (added/removed at the sale window edges).
class VariantModel extends Variant {
  const VariantModel({
    required super.id,
    required super.name,
    required super.color,
    required super.colorCode,
    required super.mrp,
    required super.offerPrice,
    required super.referralPrice,
    required super.commission,
    required super.flashSalePrice,
    required super.stock,
    required super.images,
    required super.createdAt,
  });

  factory VariantModel.fromFirestore(DocumentSnapshot<Map<String, dynamic>> doc) {
    return VariantModel.fromMap(doc.data() ?? const {}, doc.id);
  }

  factory VariantModel.fromMap(Map<String, dynamic> data, String id) {
    final flash = data['flashSalePrice'];
    return VariantModel(
      id: id.isNotEmpty ? id : ModelParse.toStr(data['id']),
      name: ModelParse.toStr(data['name']),
      color: ModelParse.toStr(data['color']),
      colorCode: ModelParse.toStr(data['colorCode']),
      mrp: ModelParse.toDouble(data['mrp']),
      offerPrice: ModelParse.toDouble(data['offerPrice']),
      referralPrice: ModelParse.toDouble(data['referralPrice']),
      commission: ModelParse.toDouble(data['commission']),
      flashSalePrice: flash == null ? null : ModelParse.toDouble(flash),
      stock: ModelParse.toInt(data['stock']),
      images: ModelParse.stringList(data['images']),
      createdAt: ModelParse.dateTime(data['createdAt']),
    );
  }
}
