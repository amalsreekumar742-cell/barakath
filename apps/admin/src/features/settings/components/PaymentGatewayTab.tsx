import { type FC, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import type { GeneralSettingsProps } from '@barakath/shared/types';
import { useAppDispatch, useAppSelector } from '@/stores/store';
import Icon from '@/components/icons/Icon';
import ConfirmDialog from '@/components/ConfirmDialog';
import { updatePaymentGateway } from '../api/updateSettings';
import { Field, SaveButton, SettingsCard, Toggle, inputCls } from './ui';

interface Props {
  settings: GeneralSettingsProps;
  onDirtyChange: (dirty: boolean) => void;
}

const toForm = (s: GeneralSettingsProps) => ({
  razorpayKeyId: s.payment.razorpayKeyId,
  razorpayKeySecret: s.payment.razorpayKeySecret,
  razorpayConnected: s.payment.razorpayConnected,
  walletPaymentsEnabled: s.payment.walletPaymentsEnabled,
});

/** Tab 3 — Payment Gateway (spec §1.21). Razorpay credentials are sensitive: masked, show-on-demand. */
const PaymentGatewayTab: FC<Props> = ({ settings, onDirtyChange }) => {
  const dispatch = useAppDispatch();
  const { saveLoading } = useAppSelector((s) => s.settings);
  const [form, setForm] = useState(() => toForm(settings));
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [showId, setShowId] = useState(false);
  const [showSecret, setShowSecret] = useState(false);

  const dirty = useMemo(
    () => JSON.stringify(form) !== JSON.stringify(toForm(settings)),
    [form, settings],
  );
  useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange]);

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  // The secret lives in the admin-only `general/secrets` doc and is never read back into the form, so
  // this field is blank on every revisit and blank means "keep the saved one". Requiring it outright
  // would make toggling wallet payments impossible without re-typing the secret.
  const secretAlreadySaved =
    settings.payment.razorpayConnected && settings.payment.razorpayKeyId.trim().length > 0;

  const requestSave = () => {
    if (form.razorpayConnected && !form.razorpayKeyId.trim())
      return toast.error('Enter Key ID before marking as connected');
    if (form.razorpayConnected && !form.razorpayKeySecret.trim() && !secretAlreadySaved)
      return toast.error('Enter Key secret before marking as connected');
    setConfirmOpen(true);
  };

  const doSave = async () => {
    const res = await dispatch(
      updatePaymentGateway({
        razorpayKeyId: form.razorpayKeyId.trim(),
        razorpayKeySecret: form.razorpayKeySecret.trim(),
        razorpayConnected: form.razorpayConnected,
        walletPaymentsEnabled: form.walletPaymentsEnabled,
      }),
    );
    setConfirmOpen(false);
    if (updatePaymentGateway.fulfilled.match(res)) toast.success('Payment gateway updated');
    else toast.error((res.payload as string) ?? 'Could not save payment gateway');
  };

  return (
    <SettingsCard title="Payment Gateway" description="Razorpay credentials and payment options.">
      {/* Security warning — secrets are written from the client for now (see thunk TODO). */}
      <div className="mb-5 flex gap-3 rounded-lg border border-gold-border bg-gold-subtle px-4 py-3">
        <Icon name="AlertLine" size={18} className="mt-0.5 shrink-0 text-gold-strong" />
        <p className="text-[13px] leading-normal text-foreground">
          These are sensitive secrets. Only share them with trusted admins. Store the live keys with
          care — anyone with access can process payments on your account.
        </p>
      </div>

      <div className="flex items-center justify-between rounded-lg border border-border bg-subtle px-4 py-3">
        <div>
          <p className="text-[14px] font-semibold text-foreground">Connection status</p>
          <p className="text-[12px] text-muted">
            {form.razorpayConnected ? 'Razorpay is marked connected.' : 'Razorpay is disconnected.'}
          </p>
        </div>
        <span
          className={`rounded-pill px-3 py-1 text-[12px] font-semibold ${
            form.razorpayConnected
              ? 'bg-success-subtle text-success'
              : 'bg-subtle text-muted ring-1 ring-border-strong'
          }`}
        >
          {form.razorpayConnected ? 'Connected' : 'Disconnected'}
        </span>
      </div>

      <div className="mt-5 grid gap-5">
        <Field label="Razorpay Key ID">
          <div className="relative">
            <input
              type={showId ? 'text' : 'password'}
              className={`${inputCls} pr-11`}
              placeholder="rzp_live_xxxxxxxx"
              value={form.razorpayKeyId}
              onChange={(e) => set('razorpayKeyId', e.target.value)}
            />
            <button
              type="button"
              onClick={() => setShowId((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-faint hover:text-foreground"
              aria-label={showId ? 'Hide Key ID' : 'Show Key ID'}
            >
              <Icon name="EyeLine" size={18} />
            </button>
          </div>
        </Field>
        <Field label="Razorpay Key secret">
          <div className="relative">
            <input
              type={showSecret ? 'text' : 'password'}
              className={`${inputCls} pr-11`}
              placeholder="••••••••••••"
              value={form.razorpayKeySecret}
              onChange={(e) => set('razorpayKeySecret', e.target.value)}
            />
            <button
              type="button"
              onClick={() => setShowSecret((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-faint hover:text-foreground"
              aria-label={showSecret ? 'Hide Key secret' : 'Show Key secret'}
            >
              <Icon name="EyeLine" size={18} />
            </button>
          </div>
        </Field>
      </div>

      <div className="mt-6 space-y-3">
        <div className="flex items-center justify-between rounded-lg border border-border bg-subtle px-4 py-3">
          <div>
            <p className="text-[14px] font-semibold text-foreground">Mark as connected</p>
            <p className="text-[12px] text-muted">Set manually once your Razorpay keys are verified.</p>
          </div>
          <Toggle on={form.razorpayConnected} onChange={(v) => set('razorpayConnected', v)} />
        </div>
        <div className="flex items-center justify-between rounded-lg border border-border bg-subtle px-4 py-3">
          <div>
            <p className="text-[14px] font-semibold text-foreground">Wallet payments</p>
            <p className="text-[12px] text-muted">When off, wallet is shown greyed/disabled at checkout.</p>
          </div>
          <Toggle on={form.walletPaymentsEnabled} onChange={(v) => set('walletPaymentsEnabled', v)} />
        </div>
      </div>

      <div className="mt-6 flex justify-end">
        <SaveButton onClick={requestSave} loading={saveLoading} disabled={!dirty} />
      </div>

      <ConfirmDialog
        isOpen={confirmOpen}
        title="Save payment gateway?"
        message="Updating payment credentials affects live transactions. Continue?"
        confirmLabel="Save"
        loading={saveLoading}
        onConfirm={doSave}
        onCancel={() => setConfirmOpen(false)}
      />
    </SettingsCard>
  );
};

export default PaymentGatewayTab;
