import { type FC, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Skeleton from 'react-loading-skeleton';
import toast from 'react-hot-toast';
import { useAppDispatch, useAppSelector } from '@/stores/store';
import ConfirmDialog from '@/components/ConfirmDialog';
import { fetchGeneralSettings } from '../api/fetchGeneralSettings';
import { setActiveTab } from '../stores/settingsSlice';
import { SETTINGS_TAB_LABELS, SettingsTab } from '../utils/settingsNav';
import VariablesTab from './VariablesTab';
import DeliveryTaxTab from './DeliveryTaxTab';
import PaymentGatewayTab from './PaymentGatewayTab';
import OtpTab from './OtpTab';
import PoliciesTab from './PoliciesTab';
import HelpSupportTab from './HelpSupportTab';
import AppUpdateTab from './AppUpdateTab';

/**
 * SettingsPage — the single `/settings` route with a 7-tab bar (spec §1.21). The `general/config` doc
 * (plus `variables/config`) backs every tab except Policies, which lists `policies/{id}` documents and
 * opens the policy editor on its own route, and OTP, which edits the admin-only `general/msg91` doc. The active tab index lives in Redux so the unsaved-changes
 * guard can intercept a tab switch, and so the policy editor can send the admin back to Policies.
 * Access is gated to admins with the Settings permission (or Super admin).
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

  // WHY clamp: an index from before the tab list shrank (Privacy + Terms → Policies) must not leave the
  // page with no tab selected and an empty body.
  const currentTab = activeTab >= 0 && activeTab < SETTINGS_TAB_LABELS.length ? activeTab : SettingsTab.VARIABLES;

  const requestTab = (i: number) => {
    if (i === currentTab) return;
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
    switch (currentTab) {
      case SettingsTab.VARIABLES:
        return <VariablesTab {...props} />;
      case SettingsTab.DELIVERY_TAX:
        return <DeliveryTaxTab {...props} />;
      case SettingsTab.PAYMENT_GATEWAY:
        return <PaymentGatewayTab {...props} />;
      case SettingsTab.HELP_SUPPORT:
        return <HelpSupportTab {...props} />;
      case SettingsTab.APP_UPDATE:
        return <AppUpdateTab {...props} />;
      default:
        return null;
    }
  };

  // WHY Policies and OTP bypass the config doc's loading/error states: each reads its own document(s)
  // with its own skeleton and retry, so a slow or failed `general/config` read must not block them (or
  // vice versa).
  const isPolicies = currentTab === SettingsTab.POLICIES;
  const isOtp = currentTab === SettingsTab.OTP;
  const ownsData = isPolicies || isOtp;

  return (
    <div className="p-6">
      <h1 className="text-[22px] font-bold tracking-tight text-foreground">Settings</h1>
      <p className="mt-1 text-[14px] text-muted">Business, tax, gateway, OTP, policies, app updates &amp; variables.</p>

      {/* Sub-tab bar — chips (design: brand-solid active, neutral-outline rest). */}
      <div className="mt-5 flex flex-wrap gap-2">
        {SETTINGS_TAB_LABELS.map((label, i) => (
          <button
            key={label}
            type="button"
            onClick={() => requestTab(i)}
            className={`shrink-0 whitespace-nowrap rounded-pill px-3.5 py-1.5 text-[13px] font-semibold transition-colors ${
              i === currentTab
                ? 'bg-primary text-white'
                : 'border border-border-strong text-muted hover:bg-subtle hover:text-foreground'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Body */}
      <div className={`mt-6 ${currentTab === SettingsTab.VARIABLES ? 'max-w-5xl' : 'max-w-3xl'}`}>
        {isPolicies && <PoliciesTab />}
        {isOtp && <OtpTab onDirtyChange={setDirty} />}

        {!ownsData && loading && (
          <div className="rounded-xl border border-border bg-surface p-6">
            <Skeleton height={22} width={180} />
            <div className="mt-5 space-y-4">
              <Skeleton height={44} />
              <Skeleton height={44} />
              <Skeleton height={44} />
            </div>
          </div>
        )}

        {!ownsData && !loading && error && (
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

        {!ownsData && !loading && !error && renderTab()}
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
