import type { Timestamp } from 'firebase/firestore';

/**
 * SubAdminProps — an admin-panel user (spec §1.20).
 *
 * WHY here (not per-app): the admin panel reads/writes this doc and a Cloud Function creates it;
 * defining the shape once keeps the two in lockstep.
 * WHY Timestamp (not number) for date fields: preserves server-authoritative time + correct range
 * queries/sorting server-side (see the web skill's Firestore rules).
 *
 * `permissions` maps a sidebar-module key -> whether this admin may access it (see AdminModule in
 * config/enums). `role` and `status` use the SubAdminRole / SubAdminStatus enums.
 */
export interface SubAdminProps {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  role: 'Super admin' | 'Manager' | 'Support';
  permissions: Record<string, boolean>;
  status: 'Active' | 'Suspended';
  lastActive: Timestamp | null;
  keywords: string[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
