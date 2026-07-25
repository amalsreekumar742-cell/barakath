import 'package:equatable/equatable.dart';

/// A top-level catalogue category (`categories/{id}`).
///
/// Sub-categories are their own documents in a subcollection; the category doc
/// keeps a denormalised list of their names under `subCategoryNames`, exposed
/// here as [subCategories]. `productCount` is maintained server-side.
class Category extends Equatable {
  final String id;
  final String name;
  final String image;

  /// Denormalised sub-category names (Firestore key: `subCategoryNames`).
  final List<String> subCategories;
  final int productCount;
  final DateTime? createdAt;

  const Category({
    required this.id,
    required this.name,
    required this.image,
    required this.subCategories,
    required this.productCount,
    required this.createdAt,
  });

  @override
  List<Object?> get props => [
        id,
        name,
        image,
        subCategories,
        productCount,
        createdAt,
      ];
}
