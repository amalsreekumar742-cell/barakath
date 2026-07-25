import 'package:equatable/equatable.dart';

/// A product review document (`reviews/{id}`). Written by the app after an order
/// is Delivered; the admin only toggles publish / responds / deletes.
class Review extends Equatable {
  final String id;
  final String userId;
  final String userName;
  final String userImage;
  final String productId;
  final String productName;
  final String productImage;
  final String variantId;
  final String variantName;
  final String orderId;
  final double rating;
  final String title;
  final String comment;
  final List<String> photos;
  final bool isPublished;
  final bool isVerifiedPurchase;
  final String adminResponse;
  final List<String> keywords;
  final DateTime? createdAt;
  final DateTime? updatedAt;

  const Review({
    required this.id,
    required this.userId,
    required this.userName,
    required this.userImage,
    required this.productId,
    required this.productName,
    required this.productImage,
    required this.variantId,
    required this.variantName,
    required this.orderId,
    required this.rating,
    required this.title,
    required this.comment,
    required this.photos,
    required this.isPublished,
    required this.isVerifiedPurchase,
    required this.adminResponse,
    required this.keywords,
    required this.createdAt,
    required this.updatedAt,
  });

  @override
  List<Object?> get props => [
        id,
        userId,
        userName,
        userImage,
        productId,
        productName,
        productImage,
        variantId,
        variantName,
        orderId,
        rating,
        title,
        comment,
        photos,
        isPublished,
        isVerifiedPurchase,
        adminResponse,
        keywords,
        createdAt,
        updatedAt,
      ];
}
