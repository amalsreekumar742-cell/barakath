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
  // Write-only, like the key secret: never read back, so it starts blank and blank keeps the saved one.
  razorpayWebhookSecret: '',
  razorpayConnected: s.payment.razorpayConnected,
  walletPaymentsEnabled: s.payment.walletPaymentsEnabled,
});

/**
 * Where Razorpay must POST payment events — the deployed `razorpayWebhook` function. asia-south1 is
 * the region every function is pinned to (functions/src/index.ts; see also lib/firebaseConfig).
 */
const WEBHOOK_URL = `https://asia-south1-${import.meta.env.VITE_FIREBASE_PROJECT_ID}.cloudfunctions.net/razorpayWebhook`;

/** The events razorpayWebhook acts on — the only ones worth subscribing to. */
const WEBHOOK_EVENTS = ['payment.captured', 'payment.failed'];

/** Tab 3 — Payment Gateway (spec §1.21). Razorpay credentials are sensitive: masked, show-on-demand. */
const PaymentGatewayTab: FC<Props> = ({ settings, onDirtyChange }) => {
  const dispatch = useAppDispatch();
  const { saveLoading } = useAppSelector((s) => s.settings);
  const [form, setForm] = useState(() => toForm(settings));
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [showId, setShowId] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const [showWebhookSecret, setShowWebhookSecret] = useState(false);
  const [copied, setCopied] = useState(false);
  const webhookConfigured = settings.payment.razorpayWebhookConfigured;

  const copyWebhookUrl = async () => {
    try {
      await navigator.clipboard.writeText(WEBHOOK_URL);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Could not copy — select the URL and copy it manually');
    }
  };

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
        razorpayWebhookSecret: form.razorpayWebhookSecret.trim(),
        razorpayConnected: form.razorpayConnected,
        walletPaymentsEnabled: form.walletPaymentsEnabled,
      }),
    );
    setConfirmOpen(false);
    if (updatePaymentGateway.fulfilled.match(res)) {
      toast.success('Payment gateway updated');
      // The secrets are write-only: clear what was typed so the fields read "keep saved" again.
      setForm((f) => ({ ...f, razorpayKeySecret: '', razorpayWebhookSecret: '' }));
    } else toast.error((res.payload as string) ?? 'Could not save payment gateway');
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

      {/* Webhook — Razorpay's server-to-server backstop. It settles a payment (order or wallet
          top-up) even when the customer's app closed before it could confirm. */}
      <div className="mt-6 rounded-lg border border-border px-4 py-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[14px] font-semibold text-foreground">Webhook</p>
            <p className="text-[12px] text-muted">
              Confirms payments even if the customer closes the app before it finishes.
            </p>
          </div>
          <span
            className={`shrink-0 rounded-pill px-3 py-1 text-[12px] font-semibold ${
              webhookConfigured
                ? 'bg-success-subtle text-success'
                : 'bg-subtle text-muted ring-1 ring-border-strong'
            }`}
          >
            {webhookConfigured ? 'Secret saved' : 'Not set up'}
          </span>
        </div>

        <ol className="mt-3 list-decimal space-y-1 pl-5 text-[12px] leading-relaxed text-muted">
          <li>Razorpay Dashboard → Account &amp; Settings → Webhooks → Add new webhook.</li>
          <li>Paste the URL below and choose a secret (any strong text you make up).</li>
          <li>
            Tick the events{' '}
            {WEBHOOK_EVENTS.map((e, i) => (
              <span key={e}>
                {i > 0 && ' and '}
                <code className="rounded bg-subtle px-1 font-mono text-foreground">{e}</code>
              </span>
            ))}
            , save, then enter the same secret here.
          </li>
        </ol>

        <div className="mt-4 grid gap-5">
          <Field label="Webhook URL">
            <div className="flex gap-2">
              <input readOnly className={`${inputCls} font-mono text-[13px]`} value={WEBHOOK_URL} />
              <button
                type="button"
                onClick={() => void copyWebhookUrl()}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-border-strong px-3 text-[13px] font-semibold text-foreground hover:bg-subtle"
              >
                {copied && <Icon name="CheckLine" size={16} className="text-success" />}
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
          </Field>
          <Field
            label="Webhook secret"
            hint={
              webhookConfigured
                ? 'Saved. Leave blank to keep it, or enter a new one if you changed it in Razorpay.'
                : 'The secret you entered when creating the webhook in Razorpay.'
            }
          >
            <div className="relative">
              <input
                type={showWebhookSecret ? 'text' : 'password'}
                className={`${inputCls} pr-11`}
                placeholder={webhookConfigured ? '•••••••• (saved)' : 'Webhook secret'}
                value={form.razorpayWebhookSecret}
                onChange={(e) => set('razorpayWebhookSecret', e.target.value)}
                autoComplete="off"
              />
              <button
                type="button"
                onClick={() => setShowWebhookSecret((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-faint hover:text-foreground"
                aria-label={showWebhookSecret ? 'Hide webhook secret' : 'Show webhook secret'}
              >
                <Icon name="EyeLine" size={18} />
              </button>
            </div>
          </Field>
        </div>
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
