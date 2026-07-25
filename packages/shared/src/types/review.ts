import { Timestamp } from 'firebase/firestore';

/**
 * ReviewProps — a customer product review document (collection `reviews`), written by the user app
 * after an order is Delivered (spec §1.11). The admin panel only reads, toggles publish, adds/removes
 * an admin response, or hard-deletes — it never creates reviews.
 *
 * WHY shared (not admin-local): the user app writes these docs and Cloud Functions recompute product
 * `averageRating`/`totalReviews` from them, so the shape must be identical everywhere.
 * WHY `keywords`: a lowercased token array the user app populates so admin search can use a single
 * `array-contains` query (no full-text service). Date fields are Firestore `Timestamp` (never epoch ms).
 */
export interface ReviewProps {
  id: string;
  userId: string;
  userName: string;
  userImage: string;
  productId: string;
  productName: string;
  productImage: string;
  variantId: string;
  variantName: string;
  orderId: string;
  rating: number;
  title: string;
  comment: string;
  photos: string[];
  isPublished: boolean;
  isVerifiedPurchase: boolean;
  adminResponse: string;
  keywords: string[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
