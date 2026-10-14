import type { Timestamp } from 'firebase/firestore';
import type { PolicyStatus } from '../config/enums';

/**
 * PolicyProps — one customer-facing policy page (Privacy Policy, Terms & Conditions, Refund, Shipping…)
 * stored at `policies/{id}`, managed from Settings › Policies (the "Add policy" model).
 *
 * WHY one document per policy (not two fixed HTML strings on `general/config`): the admin can add any
 * number of policies, order them and hide one without deleting it; the website and app list whatever
 * is enabled. `content` is the React Quill HTML the admin authors — the website sanitises it
 * (DOMPurify) and the app renders it in a script-disabled WebView, exactly as the old legal pages did.
 *
 * The two policies migrated from `general/config` keep fixed ids (`LEGACY_POLICY_IDS`) so the old
 * `/privacy-policy` and `/terms` URLs can redirect to them. Policies are never deleted (rules deny it) —
 * `status: 'disabled'` hides one from customers but keeps it in the admin.
 */
export interface PolicyProps {
  id: string;
  name: string;
  /** Rich-text HTML (React Quill). */
  content: string;
  status: PolicyStatus;
  /** 1-based display position; lists sort ascending. */
  order: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  /** uid of the admin who last saved it. */
  updatedBy: string;
}
