import type { Timestamp } from 'firebase/firestore';

/**
 * SubCategoryProps — a sub-category document (spec §1.4).
 *
 * WHY its own collection (a subcollection under its category: `categories/{categoryId}/subCategories`):
 * sub-categories need stable ids that products reference (`ProductProps.subCategoryId`) and their own
 * searchable `keywords`. `mainCategoryId` also stores the parent id explicitly (so a sub-category is
 * self-contained — handy for collection-group queries and product links), even though it's implicit in
 * the path. The category doc keeps a denormalized `subCategoryNames: string[]` for fast list rendering.
 */
export interface SubCategoryProps {
  id: string;
  /** The parent category's document id (also implicit in the subcollection path). */
  mainCategoryId: string;
  name: string;
  keywords: string[];
  createdAt: Timestamp;
}
