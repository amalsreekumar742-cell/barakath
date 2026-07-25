import type { Timestamp } from 'firebase/firestore';
import type { BannerLinkType, BannerPlacement } from '../config/enums';

/**
 * BannerProps — a home/promo banner shown on the storefronts (spec §1.15).
 *
 * WHY here (not per-app): the admin panel writes these docs and both storefronts (App + Website) read
 * them, so the shape is defined once in shared and can never drift between the surfaces.
 * WHY a `linkType` + `linkValue` pair (not separate product/category fields only): a banner may deep-link
 * to a product, a category, an external URL, or nothing — one discriminant field + a single value keeps
 * the doc flat and lets the storefront route generically. `linkProductName`/`linkCategoryName` denormalize
 * the target's label so a card can render it without an extra read.
 * WHY `position` (not just createdAt ordering): banners are manually reorderable (Move up/down), so an
 * explicit integer position is the authoritative sort key. Date fields use the Firestore `Timestamp` type.
 */
export interface BannerProps {
  id: string;
  title: string;
  /** Public download URL of the banner image (stored at `banners/{id}/image`). */
  image: string;
  linkType: BannerLinkType;
  /** The target id/URL: product id, category id, an external URL, or '' for None. */
  linkValue: string;
  /** Denormalized product name (only when linkType === 'Product'). */
  linkProductName: string;
  /** Denormalized category name (only when linkType === 'Category'). */
  linkCategoryName: string;
  placement: BannerPlacement;
  /** Manual sort order (ascending). Lower = shown first. */
  position: number;
  isActive: boolean;
  /** Optional schedule window; null when unscheduled (always live). */
  startDate: Timestamp | null;
  endDate: Timestamp | null;
  createdBy: string;
  createdByName: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
