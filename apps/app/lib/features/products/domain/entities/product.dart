import 'package:equatable/equatable.dart';

/// One row of a product's specification table (`key: value`).
class Specification extends Equatable {
  final String key;
  final String value;

  const Specification({required this.key, required this.value});

  @override
  List<Object?> get props => [key, value];
}

/// A catalogue product document (`products/{id}`).
///
/// Per-variant pricing lives on the variant subcollection; this doc carries
/// denormalised `thumbnail` / `minPrice` / `maxPrice` for list rendering plus
/// the server-computed `stockStatus` / `totalStock`. Ratings are stored as
/// `averageRating` + `totalReviews` (recomputed by Cloud Functions).
class Product extends Equatable {
  final String id;
  final String name;
  final String sku;
  final String description;
  final String categoryId;
  final String categoryName;
  final String subCategoryId;
  final String subCategoryName;
  final List<String> images;
  final List<Specification> specifications;
  final String youtubeVideoLink;
  final bool isCombo;
  final double comboDeliveryCharge;
  final bool replacementAvailable;
  final int lowStockThreshold;
  final List<String> frequentlyBoughtTogether;

  /// 'Active' | 'Archived'.
  final String status;

  /// 'In stock' | 'Low stock' | 'Out of stock'.
  final String stockStatus;
  final int totalStock;
  final String thumbnail;
  final double minPrice;
  final double maxPrice;
  final bool isNewArrival;
  final bool isFlashSale;

  /// Ratings — stored under these exact keys in Firestore.
  final double averageRating;
  final int totalReviews;

  final List<String> keywords;
  final DateTime? createdAt;
  final DateTime? updatedAt;

  const Product({
    required this.id,
    required this.name,
    required this.sku,
    required this.description,
    required this.categoryId,
    required this.categoryName,
    required this.subCategoryId,
    required this.subCategoryName,
    required this.images,
    required this.specifications,
    required this.youtubeVideoLink,
    required this.isCombo,
    required this.comboDeliveryCharge,
    required this.replacementAvailable,
    required this.lowStockThreshold,
    required this.frequentlyBoughtTogether,
    required this.status,
    required this.stockStatus,
    required this.totalStock,
    required this.thumbnail,
    required this.minPrice,
    required this.maxPrice,
    required this.isNewArrival,
    required this.isFlashSale,
    required this.averageRating,
    required this.totalReviews,
    required this.keywords,
    required this.createdAt,
    required this.updatedAt,
  });

  /// Alias getter — the app UI speaks of a "review count".
  int get reviewCount => totalReviews;

  bool get isOutOfStock => stockStatus == 'Out of stock' || totalStock <= 0;

  @override
  List<Object?> get props => [
        id,
        name,
        sku,
        description,
        categoryId,
        categoryName,
        subCategoryId,
        subCategoryName,
        images,
        specifications,
        youtubeVideoLink,
        isCombo,
        comboDeliveryCharge,
        replacementAvailable,
        lowStockThreshold,
        frequentlyBoughtTogether,
        status,
        stockStatus,
        totalStock,
        thumbnail,
        minPrice,
        maxPrice,
        isNewArrival,
        isFlashSale,
        averageRating,
        totalReviews,
        keywords,
        createdAt,
        updatedAt,
      ];
}
