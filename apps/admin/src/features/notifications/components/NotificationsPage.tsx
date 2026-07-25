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
import { sendNotificationNow } from '../api/sendNotificationNow';
import { duplicateNotification } from '../api/duplicateNotification';
import { statusBadge } from '../utils/notificationDisplay';

/** Audience label shown in the list (design "Audience" column): All users, or the selected-user count. */
const audienceLabel = (n: NotificationProps) =>
  n.targetType === 'All' ? 'All users' : `${n.targetUserIds.length} users`;

/**
 * NotificationsPage — the push-notification list (spec §1.18 listing). The design is a single table
 * (Title · Audience · Sent · Opened · Status · actions) under the page header + "Create notification"
 * button — no stat cards, no filter pills, no in-body search. Cursor pagination via "View More".
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
                <th className={th}>Opened</th>
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
                    {/* Opens aren't tracked yet (no field on the doc) — shown as — per the design column. */}
                    <td className="px-4 py-3 text-[13px] tabular-nums text-muted">—</td>
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
 * RowActions — per the design, each row shows a delete ✕ and a ⋯ menu. The menu holds the remaining
 * actions (Send now for unsent rows, Duplicate). Every action is confirmed/toasted (spec §1.22); a SENT
 * notification is a permanent record and cannot be deleted (toast instead of the confirm dialog).
 */
const RowActions: FC<{ notification: NotificationProps }> = ({ notification }) => {
  const dispatch = useAppDispatch();
  const admin = useAppSelector((s) => s.currentAdmin.admin);
  const sendLoading = useAppSelector((s) => s.notifications.sendLoading);
  const deleteLoading = useAppSelector((s) => s.notifications.deleteLoading);
  const duplicateLoading = useAppSelector((s) => s.notifications.duplicateLoading);
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmSend, setConfirmSend] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const sending = sendLoading === notification.id;
  const deleting = deleteLoading === notification.id;
  const duplicating = duplicateLoading === notification.id;
  const canSend = !notification.isSent;

  const onSend = async () => {
    const res = await dispatch(sendNotificationNow(notification));
    setConfirmSend(false);
    if (sendNotificationNow.fulfilled.match(res)) toast.success('Notification sent');
    else toast.error((res.payload as string) ?? 'Could not send notification');
  };

  const onDuplicate = async () => {
    setMenuOpen(false);
    if (!admin) return toast.error('Not signed in');
    const res = await dispatch(
      duplicateNotification({ source: notification, adminId: admin.id, adminName: admin.fullName }),
    );
    if (duplicateNotification.fulfilled.match(res)) toast.success('Duplicated as draft');
    else toast.error((res.payload as string) ?? 'Could not duplicate notification');
  };

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

      {/* ⋯ menu */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setMenuOpen((o) => !o)}
          aria-label="More actions"
          className="inline-flex text-muted hover:text-foreground"
        >
          {sending || duplicating ? (
            <Icon name="Loader4Line" size={18} className="animate-spin" />
          ) : (
            <Icon name="MenuLine" size={18} />
          )}
        </button>

        {menuOpen && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
            <div className="absolute right-0 z-20 mt-1 w-40 overflow-hidden rounded-lg border border-border bg-surface py-1 shadow-lg">
              {canSend && (
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    setConfirmSend(true);
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] font-medium text-foreground hover:bg-subtle"
                >
                  <Icon name="Share2Line" size={15} /> Send now
                </button>
              )}
              <button
                type="button"
                onClick={onDuplicate}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] font-medium text-foreground hover:bg-subtle"
              >
                <Icon name="BookmarkLine" size={15} /> Duplicate
              </button>
            </div>
          </>
        )}
      </div>

      <ConfirmDialog
        isOpen={confirmSend}
        title="Send notification now?"
        message={
          notification.targetType === 'All'
            ? 'This sends the push to all users immediately. This cannot be undone.'
            : `This sends the push to ${notification.targetUserIds.length} selected user(s) immediately. This cannot be undone.`
        }
        confirmLabel="Send now"
        confirmVariant="primary"
        loading={sending}
        onConfirm={onSend}
        onCancel={() => setConfirmSend(false)}
      />

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
