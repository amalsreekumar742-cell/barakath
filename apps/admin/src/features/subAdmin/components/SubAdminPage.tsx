import { type FC, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Skeleton from 'react-loading-skeleton';
import toast from 'react-hot-toast';
import { formatDistanceToNow } from 'date-fns';
import { SubAdminStatus } from '@barakath/shared/config/enums';
import type { SubAdminProps } from '@barakath/shared/types';
import { useAppDispatch, useAppSelector } from '@/stores/store';
import Icon from '@/components/icons/Icon';
import ConfirmDialog from '@/components/ConfirmDialog';
import { fetchSubAdmins } from '../api/fetchSubAdmins';
import { fetchSubAdminCount } from '../api/fetchSubAdminCount';
import { deleteSubAdmin } from '../api/deleteSubAdmin';
import { toggleSubAdminStatus } from '../api/toggleSubAdminStatus';
import { resetSubAdminPassword } from '../api/resetSubAdminPassword';

/** Relative "last active" label — "Never" when the admin has not signed in yet (spec §1.20). */
function lastActiveLabel(sa: SubAdminProps): string {
  if (!sa.lastActive) return 'Never';
  return formatDistanceToNow(sa.lastActive.toDate(), { addSuffix: true });
}

/**
 * SubAdminPage — the sub-admin list (spec §1.20 / prototype "Insights › Sub Admin"): a table of Admin ·
 * Role · Last active · Status · actions. A row opens its edit page; the delete ✕ and the ⋯ menu (Edit /
 * Suspend-Activate / Reset password) carry the per-row actions, each confirmed (§1.22). Cursor-paginated.
 */
const SubAdminPage: FC = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { subAdmins, hasMore, loading, loadingMore, error, lastVisible, filters, count } =
    useAppSelector((s) => s.subAdmin);

  useEffect(() => {
    void dispatch(fetchSubAdminCount());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatch]);

  useEffect(() => {
    void dispatch(fetchSubAdmins({ filters, cursor: null }));
  }, [dispatch, filters]);

  return (
    <div className="p-6">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[24px] font-extrabold tracking-tight text-foreground">Sub admin</h1>
          <p className="mt-1.5 text-[13px] text-muted">
            {count} {count === 1 ? 'admin' : 'admins'} · individual permissions
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigate('/sub-admin/create')}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-primary px-4 py-2.5 text-[14px] font-semibold text-white hover:bg-primary-dark"
        >
          <Icon name="AddLine" size={16} /> Create admin
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
            onClick={() => dispatch(fetchSubAdmins({ filters, cursor: null }))}
            className="mt-3 rounded-md bg-primary px-4 py-2 text-[14px] font-semibold text-white hover:bg-primary-dark"
          >
            Retry
          </button>
        </div>
      ) : subAdmins.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface p-12 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-primary-subtle text-primary">
            <Icon name="User1Line" size={28} />
          </div>
          <h2 className="text-[16px] font-bold text-foreground">No sub admins yet</h2>
          <button
            type="button"
            onClick={() => navigate('/sub-admin/create')}
            className="mt-4 inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-[14px] font-semibold text-white hover:bg-primary-dark"
          >
            <Icon name="AddLine" size={16} /> Create your first sub admin
          </button>
        </div>
      ) : (
        <div className="overflow-visible rounded-xl border border-border bg-surface shadow-sm">
          <table className="w-full min-w-[640px]">
            <thead className="border-b border-border bg-subtle/50">
              <tr>
                {['Admin', 'Role', 'Last active', 'Status', ''].map((h, i) => (
                  <th
                    key={h || `actions-${i}`}
                    className="px-5 py-3 text-left text-[11px] font-bold uppercase tracking-wide text-faint"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {subAdmins.map((sa) => {
                const label = lastActiveLabel(sa);
                const active = sa.status === SubAdminStatus.ACTIVE;
                return (
                  <tr
                    key={sa.id}
                    onClick={() => navigate(`/sub-admin/${sa.id}/edit`)}
                    className="cursor-pointer border-b border-border last:border-0 hover:bg-subtle/40"
                  >
                    <td className="px-5 py-3 text-[13px] font-bold text-foreground">{sa.fullName}</td>
                    <td className="px-5 py-3 text-[13px] text-muted">{sa.role}</td>
                    <td className="whitespace-nowrap px-5 py-3">
                      <span className={`text-[13px] ${label === 'Never' ? 'text-faint' : 'text-muted'}`}>{label}</span>
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={`inline-flex items-center rounded-md px-2.5 py-1 text-[11px] font-bold ${
                          active ? 'bg-success-subtle text-success' : 'bg-subtle text-muted'
                        }`}
                      >
                        {sa.status}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <RowActions subAdmin={sa} />
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
                onClick={() => dispatch(fetchSubAdmins({ filters, cursor: lastVisible }))}
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
 * RowActions — the delete ✕ + a ⋯ menu (Edit / Suspend-Activate / Reset password) for one sub-admin (spec
 * §1.20 + §1.22: every action confirmed). Reads the current admin so the delete guards (can't delete self;
 * can't delete the last Super admin) surface as toasts. All clicks stop propagation so the row's own
 * "open edit" navigation never also fires.
 */
const RowActions: FC<{ subAdmin: SubAdminProps }> = ({ subAdmin }) => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const currentAdmin = useAppSelector((s) => s.currentAdmin.admin);
  const toggleLoading = useAppSelector((s) => s.subAdmin.toggleLoading);
  const deleteLoading = useAppSelector((s) => s.subAdmin.deleteLoading);
  const resetPwLoading = useAppSelector((s) => s.subAdmin.resetPwLoading);

  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmToggle, setConfirmToggle] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const toggling = toggleLoading === subAdmin.id;
  const deleting = deleteLoading === subAdmin.id;
  const resetting = resetPwLoading === subAdmin.email;
  const isActive = subAdmin.status === SubAdminStatus.ACTIVE;

  useEffect(() => {
    if (!menuOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [menuOpen]);

  const stop = (e: React.MouseEvent) => e.stopPropagation();

  const onToggle = async () => {
    const next = isActive ? SubAdminStatus.SUSPENDED : SubAdminStatus.ACTIVE;
    const res = await dispatch(toggleSubAdminStatus({ id: subAdmin.id, status: next }));
    setConfirmToggle(false);
    if (toggleSubAdminStatus.fulfilled.match(res)) {
      toast.success(next === SubAdminStatus.SUSPENDED ? 'Sub admin suspended' : 'Sub admin activated');
    } else {
      toast.error((res.payload as string) ?? 'Could not update status');
    }
  };

  const onReset = async () => {
    const res = await dispatch(resetSubAdminPassword(subAdmin.email));
    setConfirmReset(false);
    if (resetSubAdminPassword.fulfilled.match(res)) toast.success(`Reset email sent to ${subAdmin.email}`);
    else toast.error((res.payload as string) ?? 'Could not send reset email');
  };

  const onDelete = async () => {
    const res = await dispatch(deleteSubAdmin({ target: subAdmin, currentAdminId: currentAdmin?.id ?? '' }));
    setConfirmDelete(false);
    if (deleteSubAdmin.fulfilled.match(res)) toast.success('Sub admin deleted');
    else toast.error((res.payload as string) ?? 'Could not delete sub admin');
  };

  return (
    <div className="flex items-center justify-end gap-3" onClick={stop}>
      <button
        type="button"
        onClick={() => setConfirmDelete(true)}
        aria-label="Delete sub admin"
        className="inline-flex rounded-md p-1 text-error hover:bg-error-subtle"
      >
        {deleting ? <Icon name="Loader4Line" size={18} className="animate-spin" /> : <Icon name="CloseLine" size={18} />}
      </button>

      <div className="relative" ref={menuRef}>
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          aria-label="More actions"
          className="inline-flex rounded-md p-1 text-muted hover:bg-subtle hover:text-foreground"
        >
          <Icon name="MenuLine" size={18} />
        </button>

        {menuOpen && (
          <div className="absolute right-0 top-full z-20 mt-1 w-44 overflow-hidden rounded-lg border border-border bg-surface py-1 shadow-lg">
            <MenuItem
              icon="EditLine"
              label="Edit"
              onClick={() => {
                setMenuOpen(false);
                navigate(`/sub-admin/${subAdmin.id}/edit`);
              }}
            />
            <MenuItem
              icon={isActive ? 'CloseLine' : 'CheckLine'}
              label={isActive ? 'Suspend' : 'Activate'}
              onClick={() => {
                setMenuOpen(false);
                setConfirmToggle(true);
              }}
              disabled={toggling}
            />
            <MenuItem
              icon="LockPasswordLine"
              label="Reset password"
              onClick={() => {
                setMenuOpen(false);
                setConfirmReset(true);
              }}
              disabled={resetting}
            />
          </div>
        )}
      </div>

      <ConfirmDialog
        isOpen={confirmToggle}
        title={isActive ? 'Suspend sub admin?' : 'Activate sub admin?'}
        message={
          isActive
            ? `${subAdmin.fullName} will be blocked from signing in until reactivated.`
            : `${subAdmin.fullName} will be able to sign in again.`
        }
        confirmLabel={isActive ? 'Suspend' : 'Activate'}
        confirmVariant={isActive ? 'danger' : 'primary'}
        loading={toggling}
        onConfirm={onToggle}
        onCancel={() => setConfirmToggle(false)}
      />

      <ConfirmDialog
        isOpen={confirmReset}
        title="Send password reset?"
        message={`A secure reset link will be emailed to ${subAdmin.email}.`}
        confirmLabel="Send reset email"
        confirmVariant="primary"
        loading={resetting}
        onConfirm={onReset}
        onCancel={() => setConfirmReset(false)}
      />

      <ConfirmDialog
        isOpen={confirmDelete}
        title="Delete sub admin?"
        message={`This permanently deletes ${subAdmin.fullName}'s admin account. This cannot be undone.`}
        confirmLabel="Delete"
        confirmVariant="danger"
        loading={deleting}
        onConfirm={onDelete}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  );
};

/** One item in the row's ⋯ dropdown. */
const MenuItem: FC<{ icon: Parameters<typeof Icon>[0]['name']; label: string; onClick: () => void; disabled?: boolean }> = ({
  icon,
  label,
  onClick,
  disabled,
}) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-[13px] font-medium text-foreground hover:bg-subtle disabled:cursor-not-allowed disabled:opacity-50"
  >
    <Icon name={icon} size={15} className="text-muted" />
    {label}
  </button>
);

export default SubAdminPage;
