import 'package:cloud_firestore/cloud_firestore.dart';

import '../../../../core/utils/model_parse.dart';
import '../../domain/entities/category.dart';

/// A top-level catalogue category (`categories/{id}`).
///
/// Sub-categories are their own documents in a subcollection; the category doc
/// keeps a denormalised list of their names under `subCategoryNames`, exposed
/// here as [subCategories]. `productCount` is maintained server-side.
class CategoryModel extends Category {
  const CategoryModel({
    required super.id,
    required super.name,
    required super.image,
    required super.subCategories,
    required super.productCount,
    required super.createdAt,
  });

  factory CategoryModel.fromFirestore(DocumentSnapshot<Map<String, dynamic>> doc) {
    final data = doc.data() ?? const {};
    return CategoryModel(
      id: doc.id,
      name: ModelParse.toStr(data['name']),
      image: ModelParse.toStr(data['image']),
      subCategories: ModelParse.stringList(data['subCategoryNames']),
      productCount: ModelParse.toInt(data['productCount']),
      createdAt: ModelParse.dateTime(data['createdAt']),
    );
  }
}
