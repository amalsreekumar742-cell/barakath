'use client';

import { useEffect, useMemo, useState } from 'react';
import { isToday } from 'date-fns';
import { Bell } from 'lucide-react';
import type { NotificationProps } from '@barakath/shared';
import { AccountPageHeader } from '@/features/account/components/AccountPageHeader';
import { Button } from '@/components/Button';
import { EmptyState } from '@/components/EmptyState';
import { SkeletonText } from '@/components/Skeleton';
import { useAppSelector } from '@/stores/store';
import { useNotificationsFeed } from '@/features/notifications/hooks/useNotificationsFeed';
import { NotificationRow } from '@/features/notifications/components/NotificationRow';
import { getReadIds, markAllRead, markRead } from '@/features/notifications/utils/readStatus';

/**
 * /account/notifications (spec 3.18). Merges two independent Firestore queries — broadcast
 * (`targetType == 'All'`) and personal (`targetUserIds array-contains uid`) — into one createdAt-desc
 * feed via `useNotificationsFeed`; see `features/notifications/api/notifications.ts` for why the
 * spec's assumed `type == 'admin'/'user'` + `customerId` + `audience` schema does not exist on the
 * deployed document and isn't used here.
 *
 * Read status is local-only (`localStorage`, no Firestore write — spec 3.18), so "unread"/"Mark all
 * read" are necessarily scoped to whatever has been loaded into this page so far, same as any
 * client-only read-tracking scheme: a not-yet-fetched later page's notifications simply start unread
 * when they arrive, exactly like a first-ever visit would show them.
 *
 * `noindex` is inherited from `(account)/layout.tsx` (`metadata.robots`) — not re-declared here.
 */
export default function NotificationsPage() {
  const uid = useAppSelector((s) => s.auth.uid);
  const authLoading = useAppSelector((s) => s.auth.authLoading);
  const { items, isLoading, isLoadingMore, hasMore, loadMore, error } = useNotificationsFeed(
    authLoading ? null : uid,
  );

  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  // localStorage is browser-only — seed local state after mount, never during SSR/prerender.
  useEffect(() => {
    setReadIds(new Set(getReadIds()));
  }, []);

  function handleOpen(id: string) {
    markRead(id);
    setReadIds((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }

  function handleMarkAllRead() {
    const ids = items.map((n) => n.id);
    markAllRead(ids);
    setReadIds((prev) => new Set([...prev, ...ids]));
  }

  const unreadCount = items.filter((n) => !readIds.has(n.id)).length;

  const { today, earlier } = useMemo(() => {
    const t: NotificationProps[] = [];
    const e: NotificationProps[] = [];
    for (const n of items) (isToday(n.createdAt.toDate()) ? t : e).push(n);
    return { today: t, earlier: e };
  }, [items]);

  return (
    <div>
      <AccountPageHeader
        title="Notifications"
        action={
          <Button variant="secondary" size="sm" onClick={handleMarkAllRead} disabled={unreadCount === 0}>
            Mark all read
          </Button>
        }
      />

      {isLoading ? (
        <div className="space-y-4" aria-busy="true">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="border-b border-border pb-3">
              <SkeletonText width="w-1/3" />
              <SkeletonText width="w-2/3" className="mt-2" />
              <SkeletonText width="w-1/5" className="mt-2" />
            </div>
          ))}
        </div>
      ) : error ? (
        <EmptyState icon={<Bell size={40} />} title="Could not load notifications" subtitle={error} />
      ) : items.length === 0 ? (
        <EmptyState
          icon={<Bell size={40} />}
          title="No notifications yet"
          subtitle="Updates about your orders, offers and wallet will show up here."
        />
      ) : (
        <>
          {today.length > 0 && (
            <section className="mb-4">
              <h2 className="mb-1 text-xs font-extrabold uppercase tracking-wide text-muted">Today</h2>
              {today.map((n) => (
                <NotificationRow key={n.id} notification={n} isRead={readIds.has(n.id)} onOpen={handleOpen} />
              ))}
            </section>
          )}
          {earlier.length > 0 && (
            <section>
              <h2 className="mb-1 text-xs font-extrabold uppercase tracking-wide text-muted">Earlier</h2>
              {earlier.map((n) => (
                <NotificationRow key={n.id} notification={n} isRead={readIds.has(n.id)} onOpen={handleOpen} />
              ))}
            </section>
          )}

          {hasMore && (
            <div className="mt-4 flex justify-center">
              <Button variant="secondary" onClick={loadMore} loading={isLoadingMore}>
                View more
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
