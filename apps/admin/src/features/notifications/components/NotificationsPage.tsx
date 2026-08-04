import { type FC, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Skeleton from 'react-loading-skeleton';
import toast from 'react-hot-toast';
import type { NotificationProps } from '@barakath/shared/types';
import { useAppDispatch, useAppSelector } from '@/stores/store';
import Icon from '@/components/icons/Icon';
import ConfirmDialog from '@/components/ConfirmDialog';
import { fetchNotifications } from '../api/fetchNotifications';
import { deleteNotification } from '../api/deleteNotification';
import { statusBadge } from '../utils/notificationDisplay';

/** Audience label shown in the list (design "Audience" column): All users, or the selected-user count. */
const audienceLabel = (n: NotificationProps) =>
  n.targetType === 'All' ? 'All users' : `${n.targetUserIds.length} users`;

/**
 * NotificationsPage — the push-notification list (spec §1.18 listing). A single table
 * (Title · Audience · Sent · Status · delete) under the page header + "Create notification" button —
 * no stat cards, no filter pills, no in-body search. Cursor pagination via "View More".
 *
 * The design's "Opened" column was dropped: open tracking was never implemented (no field on the
 * notification document), so the column could only ever render an em dash on every row.
 */
const NotificationsPage: FC = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { notifications, hasMore, loading, loadingMore, error, lastVisible, filters } = useAppSelector(
    (s) => s.notifications,
  );

  useEffect(() => {
    void dispatch(fetchNotifications({ filters, cursor: null }));
  }, [dispatch, filters]);

  const th =
    'px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-faint whitespace-nowrap';
  const td = 'px-4 py-3 text-[13px] text-muted whitespace-nowrap';

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-extrabold tracking-tight text-foreground">Push notifications</h1>
          <p className="mt-1 text-[13px] text-muted">Schedule · audience · templates</p>
        </div>
        <button
          type="button"
          onClick={() => navigate('/notifications/create')}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-primary px-4 py-2.5 text-[14px] font-semibold text-white hover:bg-primary-dark"
        >
          <Icon name="AddLine" size={16} /> Create notification
        </button>
      </div>

      {/* Body */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} height={52} borderRadius={12} />
          ))}
        </div>
      ) : error ? (
        <div className="rounded-xl border border-border bg-surface p-10 text-center">
          <p className="text-[14px] text-muted">{error}</p>
          <button
            type="button"
            onClick={() => dispatch(fetchNotifications({ filters, cursor: null }))}
            className="mt-3 rounded-md bg-primary px-4 py-2 text-[14px] font-semibold text-white hover:bg-primary-dark"
          >
            Retry
          </button>
        </div>
      ) : notifications.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface p-12 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-primary-subtle text-primary">
            <Icon name="NotificationLine" size={28} />
          </div>
          <h2 className="text-[16px] font-bold text-foreground">No notifications yet</h2>
          <button
            type="button"
            onClick={() => navigate('/notifications/create')}
            className="mt-4 inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-[14px] font-semibold text-white hover:bg-primary-dark"
          >
            <Icon name="AddLine" size={16} /> Create your first notification
          </button>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-surface shadow-sm">
          <table className="w-full min-w-[760px] border-collapse">
            <thead className="border-b border-border bg-subtle/50">
              <tr>
                <th className={th}>Title</th>
                <th className={th}>Audience</th>
                <th className={th}>Sent</th>
                <th className={th}>Status</th>
                <th className={th} />
              </tr>
            </thead>
            <tbody>
              {notifications.map((n) => {
                const { label, cls } = statusBadge(n);
                return (
                  <tr key={n.id} className="border-b border-border last:border-0 hover:bg-subtle/40">
                    <td className="px-4 py-3">
                      <span className="block max-w-[260px] truncate text-[13px] font-bold text-foreground">
                        {n.title}
                      </span>
                    </td>
                    <td className={td}>{audienceLabel(n)}</td>
                    <td className="px-4 py-3 text-[13px] tabular-nums text-muted">
                      {n.isSent ? n.recipientCount.toLocaleString('en-IN') : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-md px-2.5 py-1 text-[11px] font-bold ${cls}`}>
                        {label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <RowActions notification={n} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {loadingMore && (
            <div className="p-3">
              <Skeleton height={44} borderRadius={8} />
            </div>
          )}
          {hasMore && !loadingMore && (
            <div className="flex justify-center border-t border-border p-3">
              <button
                type="button"
                onClick={() => dispatch(fetchNotifications({ filters, cursor: lastVisible }))}
                className="rounded-md border border-border-strong px-4 py-2 text-[14px] font-semibold text-foreground hover:bg-subtle"
              >
                View More
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

/**
 * RowActions — each row shows a delete ✕.
 *
 * The ⋯ overflow menu that used to sit beside it (Send now / Duplicate) was removed. A scheduled
 * notification still goes out on its own schedule, so nothing is stranded; what is gone is sending a
 * scheduled push EARLY and duplicating one as a draft. Re-add the menu if either is wanted back —
 * `sendNotificationNow` and `duplicateNotification` are still exported and still wired to the slice.
 *
 * Deletion is confirmed/toasted (spec §1.22); a SENT notification is a permanent record and cannot be
 * deleted (toast instead of the confirm dialog).
 */
const RowActions: FC<{ notification: NotificationProps }> = ({ notification }) => {
  const dispatch = useAppDispatch();
  const deleteLoading = useAppSelector((s) => s.notifications.deleteLoading);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const deleting = deleteLoading === notification.id;

  const onDeleteClick = () => {
    if (notification.isSent) {
      toast.error('Sent notifications cannot be deleted');
      return;
    }
    setConfirmDelete(true);
  };

  const onDelete = async () => {
    const res = await dispatch(deleteNotification(notification));
    setConfirmDelete(false);
    if (deleteNotification.fulfilled.match(res)) toast.success('Notification deleted');
    else toast.error((res.payload as string) ?? 'Could not delete notification');
  };

  return (
    <div className="flex items-center gap-3">
      {/* Delete ✕ */}
      <button
        type="button"
        onClick={onDeleteClick}
        disabled={deleting}
        aria-label="Delete"
        title={notification.isSent ? 'Sent notifications cannot be deleted' : 'Delete'}
        className={`inline-flex disabled:opacity-50 ${
          notification.isSent ? 'text-faint' : 'text-error hover:opacity-80'
        }`}
      >
        {deleting ? (
          <Icon name="Loader4Line" size={18} className="animate-spin" />
        ) : (
          <Icon name="CloseLine" size={18} />
        )}
      </button>

      <ConfirmDialog
        isOpen={confirmDelete}
        title="Delete notification?"
        message={`This permanently deletes "${notification.title}". This cannot be undone.`}
        confirmLabel="Delete"
        confirmVariant="danger"
        loading={deleting}
        onConfirm={onDelete}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  );
};

export default NotificationsPage;
