import type { NotificationProps } from '@barakath/shared/types';

/**
 * Notification display helpers — compute the status label and the colored badge classes shown in the list
 * (spec §1.18). Kept as pure functions so the table, the row actions and the create preview all render the
 * exact same labels/colors. Colors use only the app's @theme status tokens (no inline hex, no purple token).
 */

export type NotificationStatus = 'Sent' | 'Scheduled' | 'Draft';

/**
 * computeNotificationStatus — derive the status from the two booleans on the doc.
 * WHY derived (not stored): a single source of truth (isSent/isScheduled) can't drift from a duplicated
 * "status" string; the label is a pure function of those flags.
 */
export function computeNotificationStatus(n: NotificationProps): NotificationStatus {
  if (n.isSent) return 'Sent';
  if (n.isScheduled) return 'Scheduled';
  return 'Draft';
}

/** Status → badge label + Tailwind token classes (Sent green / Scheduled gold-warning / Draft muted). */
export function statusBadge(n: NotificationProps): { label: NotificationStatus; cls: string } {
  const label = computeNotificationStatus(n);
  const cls =
    label === 'Sent'
      ? 'bg-success-subtle text-success'
      : label === 'Scheduled'
        ? 'bg-warning-subtle text-warning'
        : 'bg-subtle text-muted';
  return { label, cls };
}

/**
 * typeBadgeClass — colored badge classes per notification type (spec §1.18 "Type colored badge").
 * WHY a fixed map (not hashing): each type reads consistently across sessions; all colors come from the
 * allowed status/brand tokens (there is no purple token).
 */
export function typeBadgeClass(type: NotificationProps['type']): string {
  switch (type) {
    case 'Broadcast':
      return 'bg-primary-subtle text-primary';
    case 'Promotion':
      return 'bg-warning-subtle text-warning';
    case 'Order':
      return 'bg-info-subtle text-info';
    case 'Wallet':
      return 'bg-success-subtle text-success';
    case 'Affiliate':
      return 'bg-warning-subtle text-warning';
    case 'Replacement':
      return 'bg-error-subtle text-error';
    case 'System':
    default:
      return 'bg-subtle text-muted';
  }
}
