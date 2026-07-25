'use client';

import Link from 'next/link';
import { formatDistanceToNowStrict } from 'date-fns';
import { Bell, Gift, RefreshCw, Truck, Users, Wallet } from 'lucide-react';
import type { NotificationProps } from '@barakath/shared';
import { resolveNotificationLink } from '../utils/deepLink';

export interface NotificationRowProps {
  notification: NotificationProps;
  isRead: boolean;
  /** Called on click, BEFORE navigation, so the row's own row marks itself read locally even though
   *  the click also follows the deep link away from this page. */
  onOpen: (id: string) => void;
}

/** Colored icon badge per `NotificationProps.type` (design marker 28) — a real, server-set field, not
 *  a guess: `Order`/`Wallet`/`Affiliate`/`Replacement` are system-generated, `Promotion`/`Broadcast`/
 *  `System` are admin-composed. */
const TYPE_BADGE: Record<NotificationProps['type'], { icon: typeof Bell; className: string }> = {
  Order: { icon: Truck, className: 'bg-info-subtle text-info' },
  Wallet: { icon: Wallet, className: 'bg-success-subtle text-success' },
  Affiliate: { icon: Users, className: 'bg-gold-subtle text-gold-strong' },
  Replacement: { icon: RefreshCw, className: 'bg-warning-subtle text-warning' },
  Promotion: { icon: Gift, className: 'bg-gold-subtle text-gold-strong' },
  Broadcast: { icon: Bell, className: 'bg-primary-subtle text-primary' },
  System: { icon: Bell, className: 'bg-primary-subtle text-primary' },
};

/**
 * One notification row — a colored type-icon badge, title (semibold while unread), message clamped to
 * two lines, and a relative time (spec 3.18). Unread rows get a tinted background, matching the design,
 * rather than only a small leading dot. The whole row is the tap target; clicking marks it read then
 * follows `resolveNotificationLink`.
 */
export function NotificationRow({ notification, isRead, onOpen }: NotificationRowProps) {
  const href = resolveNotificationLink(notification);
  const jsDate = notification.createdAt.toDate();
  const badge = TYPE_BADGE[notification.type] ?? TYPE_BADGE.System;
  const Icon = badge.icon;

  return (
    <Link
      href={href}
      onClick={() => onOpen(notification.id)}
      className={`flex items-start gap-3 rounded-lg border-b border-border px-2.5 py-3 last:border-0 hover:bg-subtle ${
        isRead ? '' : 'bg-primary-subtle'
      }`}
    >
      <span
        aria-hidden
        className={`flex size-10 shrink-0 items-center justify-center rounded-full ${badge.className}`}
      >
        <Icon size={18} />
      </span>
      <div className="min-w-0 flex-1">
        <p className={`text-sm text-foreground ${isRead ? 'font-medium' : 'font-semibold'}`}>
          {notification.title}
        </p>
        <p className="mt-0.5 line-clamp-2 text-sm text-muted">{notification.body}</p>
        <p className="mt-1 text-xs text-faint">
          {formatDistanceToNowStrict(jsDate, { addSuffix: true })}
        </p>
      </div>
    </Link>
  );
}
