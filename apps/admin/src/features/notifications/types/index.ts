import type {
  NotificationType,
  NotificationTargetType,
  NotificationLinkType,
} from '@barakath/shared/config/enums';

/**
 * Notifications feature-local types (spec §1.18 / Feature 18). These stay inside the feature because they
 * describe list-filter, form-input and stat shapes only the notifications screens use — the cross-app
 * data contract is NotificationProps in packages/shared.
 */

/**
 * The status tab options on the Notifications list. "Sent"/"Scheduled"/"Draft" are computed from the
 * `isSent` + `isScheduled` booleans on the doc (a doc is Draft when neither is set).
 */
export type NotificationStatusFilter = 'All' | 'Sent' | 'Scheduled' | 'Draft';

/** The type-pill options — 'All' plus each NotificationType value. */
export type NotificationTypeFilter = 'All' | NotificationType;

/** Active list filters — drive the cursor-paginated query and reset the list when changed. */
export interface NotificationFilters {
  status: NotificationStatusFilter;
  type: NotificationTypeFilter;
  searchTerm: string;
}

/**
 * NotificationStats — the four headline figures on the list (spec §1.18). Computed with server-side
 * aggregation queries (getCountFromServer), never by reading and counting docs client-side.
 */
export interface NotificationStats {
  totalSent: number;
  scheduled: number;
  draft: number;
  totalRecipients: number;
}

/**
 * NotificationInput — the create payload produced by the form. `scheduledAt` is a plain JS `Date` here
 * (from the date-time picker); the api thunk converts it to a Firestore `Timestamp` at the write edge.
 * Server-owned fields (isSent/sentAt/recipientCount/keywords/timestamps) are intentionally absent — the
 * form never writes them directly; the thunk derives them from `sendMode`.
 */
export interface NotificationInput {
  title: string;
  body: string;
  type: NotificationType;
  targetType: NotificationTargetType;
  targetUserIds: string[];
  linkType: NotificationLinkType;
  linkValue: string;
  /** 'now' → send immediately; 'schedule' → queue for `scheduledAt`. */
  sendMode: 'now' | 'schedule';
  scheduledAt: Date | null;
}
