import { type FC, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Skeleton from 'react-loading-skeleton';
import toast from 'react-hot-toast';
import { useAppDispatch, useAppSelector } from '@/stores/store';
import ConfirmDialog from '@/components/ConfirmDialog';
import { fetchGeneralSettings } from '../api/fetchGeneralSettings';
import { setActiveTab } from '../stores/settingsSlice';
import VariablesTab from './VariablesTab';
import DeliveryTaxTab from './DeliveryTaxTab';
import PaymentGatewayTab from './PaymentGatewayTab';
import PrivacyPolicyTab from './PrivacyPolicyTab';
import TermsConditionsTab from './TermsConditionsTab';
import HelpSupportTab from './HelpSupportTab';

const TABS = [
  'Variables',
  'Delivery & Tax',
  'Payment Gateway',
  'Privacy Policy',
  'Terms & Conditions',
  'Help & Support',
] as const;

/**
 * SettingsPage — the single `/settings` route with a 6-tab bar (spec §1.21). One `general/config` doc
 * backs every tab; the active tab index lives in Redux so the unsaved-changes guard can intercept a tab
 * switch. Access is gated to admins with the Settings permission (or Super admin).
 */
const SettingsPage: FC = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { settings, loading, error, activeTab } = useAppSelector((s) => s.settings);
  const admin = useAppSelector((s) => s.currentAdmin.admin);

  const [dirty, setDirty] = useState(false);
  const [pendingTab, setPendingTab] = useState<number | null>(null);

  // Permission gate: only Settings-permitted admins (or Super admin) — else bounce to Dashboard.
  const allowed = !!admin && (admin.role === 'Super admin' || admin.permissions?.settings === true);
  useEffect(() => {
    if (admin && !allowed) {
      toast.error("You don't have permission to access Settings");
      navigate('/', { replace: true });
    }
  }, [admin, allowed, navigate]);

  useEffect(() => {
    if (!settings) void dispatch(fetchGeneralSettings());
  }, [dispatch, settings]);

  const requestTab = (i: number) => {
    if (i === activeTab) return;
    if (dirty) {
      setPendingTab(i);
      return;
    }
    dispatch(setActiveTab(i));
  };

  const confirmSwitch = () => {
    if (pendingTab === null) return;
    setDirty(false);
    dispatch(setActiveTab(pendingTab));
    setPendingTab(null);
  };

  if (!admin || !allowed) return null; // guard effect will redirect; render nothing meanwhile

  const renderTab = () => {
    if (!settings) return null;
    const props = { settings, onDirtyChange: setDirty };
    switch (activeTab) {
      case 0:
        return <VariablesTab {...props} />;
      case 1:
        return <DeliveryTaxTab {...props} />;
      case 2:
        return <PaymentGatewayTab {...props} />;
      case 3:
        return <PrivacyPolicyTab {...props} />;
      case 4:
        return <TermsConditionsTab {...props} />;
      case 5:
        return <HelpSupportTab {...props} />;
      default:
        return null;
    }
  };

  return (
    <div className="p-6">
      <h1 className="text-[22px] font-bold tracking-tight text-foreground">Settings</h1>
      <p className="mt-1 text-[14px] text-muted">Business, tax, gateway &amp; variables.</p>

      {/* Sub-tab bar — chips (design: brand-solid active, neutral-outline rest). */}
      <div className="mt-5 flex flex-wrap gap-2">
        {TABS.map((label, i) => (
          <button
            key={label}
            type="button"
            onClick={() => requestTab(i)}
            className={`shrink-0 whitespace-nowrap rounded-pill px-3.5 py-1.5 text-[13px] font-semibold transition-colors ${
              i === activeTab
                ? 'bg-primary text-white'
                : 'border border-border-strong text-muted hover:bg-subtle hover:text-foreground'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Body */}
      <div className={`mt-6 ${activeTab === 0 ? 'max-w-5xl' : 'max-w-3xl'}`}>
        {loading && (
          <div className="rounded-xl border border-border bg-surface p-6">
            <Skeleton height={22} width={180} />
            <div className="mt-5 space-y-4">
              <Skeleton height={44} />
              <Skeleton height={44} />
              <Skeleton height={44} />
            </div>
          </div>
        )}

        {!loading && error && (
          <div className="rounded-xl border border-border bg-surface p-8 text-center">
            <p className="text-[14px] text-error">{error}</p>
            <button
              type="button"
              onClick={() => void dispatch(fetchGeneralSettings())}
              className="mt-3 rounded-md bg-primary px-4 py-2 text-[14px] font-semibold text-white hover:bg-primary-dark"
            >
              Retry
            </button>
          </div>
        )}

        {!loading && !error && renderTab()}
      </div>

      <ConfirmDialog
        isOpen={pendingTab !== null}
        title="Discard unsaved changes?"
        message="You have unsaved changes on this tab. Switching tabs will discard them."
        confirmLabel="Discard"
        confirmVariant="danger"
        onConfirm={confirmSwitch}
        onCancel={() => setPendingTab(null)}
      />
    </div>
  );
};

export default SettingsPage;
