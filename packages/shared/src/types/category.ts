import type { Timestamp } from 'firebase/firestore';

/**
 * CategoryProps — a top-level catalogue category (spec §1.4).
 *
 * WHY here: shared by admin (CRUD) and storefronts (browse). Sub-categories are their OWN documents in
 * a subcollection (`categories/{id}/subCategories`, see SubCategoryProps); `subCategoryNames` is a
 * denormalized list of their names kept on the category doc so the Categories list can render the
 * "Sub-categories" column without reading the subcollection. `productCount` is maintained server-side.
 * Date fields use `Timestamp`.
 */
export interface CategoryProps {
  id: string;
  name: string;
  image: string;
  subCategoryNames: string[];
  productCount: number;
  keywords: string[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
