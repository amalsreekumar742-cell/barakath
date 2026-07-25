import { useState, type FC } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAppDispatch, useAppSelector } from '@/stores/store';
import { logout } from '@/features/auth/stores/authSlice';
import Breadcrumb from './Breadcrumb';
import ConfirmDialog from './ConfirmDialog';
import Icon from './icons/Icon';

/**
 * TopBar — fixed 60px header (spec §1.22; design: breadcrumb left, profile badge right).
 *
 * Left: breadcrumb (auto from route). Right: admin profile badge (avatar + name + role) and a logout
 * button that opens the shared ConfirmDialog before signing out. Per spec §1.22 there is intentionally
 * NO global search bar, NO notification bell and NO quick-actions here.
 *
 * WHY confirm-then-logout: a misclick shouldn't drop the session; the confirm button shows a loading
 * state through the async signOut, then the currentAdmin listener clears state and the guard redirects.
 */
const TopBar: FC = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const admin = useAppSelector((s) => s.currentAdmin.admin);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await dispatch(logout()).unwrap();
      toast.success('Signed out');
      navigate('/login', { replace: true });
    } catch {
      toast.error('Could not sign out. Please try again');
    } finally {
      setLoggingOut(false);
      setConfirmOpen(false);
    }
  };

  const initials = admin?.fullName
    ? admin.fullName
        .split(' ')
        .map((p) => p[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : '?';

  return (
    <header className="flex h-[60px] shrink-0 items-center justify-between border-b border-border bg-surface px-6">
      <Breadcrumb />

      <div className="flex items-center gap-3">
        {/* Profile badge */}
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-subtle text-[13px] font-bold text-primary">
            {initials}
          </div>
          <div className="hidden text-right leading-tight sm:block">
            <p className="text-[13px] font-semibold text-foreground">{admin?.fullName ?? '—'}</p>
            <p className="text-[12px] text-muted">{admin?.role ?? ''}</p>
          </div>
        </div>

        <div className="h-6 w-px bg-border" aria-hidden />

        {/* Logout */}
        <button
          type="button"
          onClick={() => setConfirmOpen(true)}
          aria-label="Log out"
          className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-2 text-[13px] font-medium text-muted transition-colors hover:bg-error-subtle hover:text-error"
        >
          <Icon name="LogoutBoxRLine" size={18} />
          <span className="hidden sm:inline">Logout</span>
        </button>
      </div>

      <ConfirmDialog
        isOpen={confirmOpen}
        title="Log out?"
        message="You'll need to sign in again to access the admin panel."
        confirmLabel="Log out"
        confirmVariant="danger"
        loading={loggingOut}
        onConfirm={handleLogout}
        onCancel={() => setConfirmOpen(false)}
      />
    </header>
  );
};

export default TopBar;
