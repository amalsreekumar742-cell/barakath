import type { BannerLinkType, BannerPlacement } from '@barakath/shared/config/enums';

/**
 * Feature-local types for the Banners module (spec §1.15). Kept inside the feature (not shared) because
 * these describe the admin form/list state, not the persisted Firestore document (that is BannerProps).
 */

/** Placement filter pill values — "All" plus the three real placements. */
export type BannerPlacementFilter = 'All' | BannerPlacement;

/** Status filter pill values. */
export type BannerStatusFilter = 'All' | 'Active' | 'Inactive';

/** The list-screen filters that drive the paginated query (spec §1.15 listing filters). */
export interface BannerFilters {
  placement: BannerPlacementFilter;
  status: BannerStatusFilter;
}

/**
 * BannerInput — the normalized form payload handed to create/update thunks. Dates are plain JS `Date`
 * (or null) here and converted to Firestore `Timestamp` at the write boundary; the image file is passed
 * separately so an unchanged Edit can skip re-uploading.
 */
export interface BannerInput {
  title: string;
  linkType: BannerLinkType;
  linkValue: string;
  linkProductName: string;
  linkCategoryName: string;
  placement: BannerPlacement;
  isActive: boolean;
  startDate: Date | null;
  endDate: Date | null;
}
