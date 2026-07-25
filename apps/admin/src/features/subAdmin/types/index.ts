import type { SubAdminRole, SubAdminStatus } from '@barakath/shared/config/enums';

/**
 * Sub Admin feature-local types (spec §1.20 / Feature 21). These describe list-filter and form-input
 * shapes only the Sub Admin screens use — the shared data contract is `SubAdminProps` in packages/shared.
 */

/** Role filter options on the list (All + the three roles). */
export type SubAdminRoleFilter = 'All' | SubAdminRole;

/** Status filter options on the list (All + the two statuses). */
export type SubAdminStatusFilter = 'All' | SubAdminStatus;

/** Active list filters — drive the cursor-paginated query and reset the list when changed. */
export interface SubAdminFilters {
  role: SubAdminRoleFilter;
  status: SubAdminStatusFilter;
  searchTerm: string;
}

/**
 * SubAdminInput — the create/update payload produced by the form.
 *
 * `password` is present only on CREATE and is NEVER written to Firestore — it is handed to the Cloud
 * Function that provisions the Auth account (see createSubAdmin's TODO). `permissions` is the full
 * AdminModule→boolean map built from the matrix. `email` is create-only (locked on edit).
 */
export interface SubAdminInput {
  fullName: string;
  email: string;
  phone: string;
  password?: string;
  role: SubAdminRole;
  permissions: Record<string, boolean>;
  status: SubAdminStatus;
}
