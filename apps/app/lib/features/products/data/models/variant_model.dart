import 'package:cloud_firestore/cloud_firestore.dart';

import '../../../../core/utils/model_parse.dart';
import '../../domain/entities/variant.dart';
import '../../domain/entities/variant_options.dart';

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
    super.options,
    required super.color,
    required super.colorCode,
    required super.mrp,
    required super.offerPrice,
    required super.referralPrice,
    required super.commission,
    required super.flashSalePrice,
    required super.stock,
    required super.images,
    super.imageUrl,
    required super.sortOrder,
    required super.createdAt,
  });

  factory VariantModel.fromFirestore(DocumentSnapshot<Map<String, dynamic>> doc) {
    return VariantModel.fromMap(doc.data() ?? const {}, doc.id);
  }

  factory VariantModel.fromMap(Map<String, dynamic> data, String id) {
    final flash = data['flashSalePrice'];
    // Absent (not 0) on never-reordered variants — 0 would claim first place.
    final sortOrder = data['sortOrder'];
    return VariantModel(
      id: id.isNotEmpty ? id : ModelParse.toStr(data['id']),
      name: ModelParse.toStr(data['name']),
      // Absent on single-axis variants; entries with no group or value are
      // dropped rather than rendered as an empty chip.
      options: [
        for (final o in ModelParse.mapList(data['options']))
          if (ModelParse.toStr(o['group']).isNotEmpty &&
              ModelParse.toStr(o['value']).isNotEmpty)
            VariantOption(
              group: ModelParse.toStr(o['group']),
              value: ModelParse.toStr(o['value']),
            ),
      ],
      color: ModelParse.toStr(data['color']),
      colorCode: ModelParse.toStr(data['colorCode']),
      mrp: ModelParse.toDouble(data['mrp']),
      offerPrice: ModelParse.toDouble(data['offerPrice']),
      referralPrice: ModelParse.toDouble(data['referralPrice']),
      commission: ModelParse.toDouble(data['commission']),
      flashSalePrice: flash == null ? null : ModelParse.toDouble(flash),
      stock: ModelParse.toInt(data['stock']),
      images: ModelParse.stringList(data['images']),
      imageUrl: ModelParse.toStr(data['imageUrl']),
      sortOrder: sortOrder == null ? null : ModelParse.toInt(sortOrder),
      createdAt: ModelParse.dateTime(data['createdAt']),
    );
  }
}
