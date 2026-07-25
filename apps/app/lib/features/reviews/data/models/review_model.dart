import 'package:cloud_firestore/cloud_firestore.dart';

import '../../../../core/utils/model_parse.dart';
import '../../domain/entities/review.dart';

/// A product review document (`reviews/{id}`). Written by the app after an order
/// is Delivered; the admin only toggles publish / responds / deletes.
class ReviewModel extends Review {
  const ReviewModel({
    required super.id,
    required super.userId,
    required super.userName,
    required super.userImage,
    required super.productId,
    required super.productName,
    required super.productImage,
    required super.variantId,
    required super.variantName,
    required super.orderId,
    required super.rating,
    required super.title,
    required super.comment,
    required super.photos,
    required super.isPublished,
    required super.isVerifiedPurchase,
    required super.adminResponse,
    required super.keywords,
    required super.createdAt,
    required super.updatedAt,
  });

  factory ReviewModel.fromFirestore(DocumentSnapshot<Map<String, dynamic>> doc) {
    final data = doc.data() ?? const {};
    return ReviewModel(
      id: doc.id,
      userId: ModelParse.toStr(data['userId']),
      userName: ModelParse.toStr(data['userName']),
      userImage: ModelParse.toStr(data['userImage']),
      productId: ModelParse.toStr(data['productId']),
      productName: ModelParse.toStr(data['productName']),
      productImage: ModelParse.toStr(data['productImage']),
      variantId: ModelParse.toStr(data['variantId']),
      variantName: ModelParse.toStr(data['variantName']),
      orderId: ModelParse.toStr(data['orderId']),
      rating: ModelParse.toDouble(data['rating']),
      title: ModelParse.toStr(data['title']),
      comment: ModelParse.toStr(data['comment']),
      photos: ModelParse.stringList(data['photos']),
      isPublished: ModelParse.toBool(data['isPublished']),
      isVerifiedPurchase: ModelParse.toBool(data['isVerifiedPurchase']),
      adminResponse: ModelParse.toStr(data['adminResponse']),
      keywords: ModelParse.stringList(data['keywords']),
      createdAt: ModelParse.dateTime(data['createdAt']),
      updatedAt: ModelParse.dateTime(data['updatedAt']),
    );
  }

  /// The fields the app writes when a customer submits a review. Server /
  /// Cloud Functions own `isPublished` (moderation) and `adminResponse`.
  Map<String, dynamic> toFirestore() {
    return {
      'userId': userId,
      'userName': userName,
      'userImage': userImage,
      'productId': productId,
      'productName': productName,
      'productImage': productImage,
      'variantId': variantId,
      'variantName': variantName,
      'orderId': orderId,
      'rating': rating,
      'title': title,
      'comment': comment,
      'photos': photos,
      'isVerifiedPurchase': isVerifiedPurchase,
      'keywords': keywords,
      'createdAt': FieldValue.serverTimestamp(),
      'updatedAt': FieldValue.serverTimestamp(),
    };
  }

  /// The EXACT payload the customer's create is allowed to carry.
  ///
  /// `firestore.rules` gates `reviews` create on four things and rejects the
  /// write if any is missing: `userId == request.auth.uid`, `isPublished == true`
  /// (reviews auto-publish, spec §2.24), `adminResponse == ''` (otherwise a
  /// customer could author the shop's reply to their own review) and a numeric
  /// `rating` in 1..5. [toFirestore] omits the two booleans/strings because the
  /// admin panel owns them on ITS writes — so the app needs this second shape
  /// rather than a mutated copy of that one.
  ///
  /// `id` is written onto the document as well, so a stray query result is never
  /// missing it (same convention as the admin's writes).
  Map<String, dynamic> toCreateMap() {
    return {
      ...toFirestore(),
      'id': id,
      'isPublished': true,
      'adminResponse': '',
    };
  }
}
