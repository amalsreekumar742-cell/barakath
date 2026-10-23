import { type FC, useEffect, useMemo, useState } from 'react';
import Skeleton from 'react-loading-skeleton';
import toast from 'react-hot-toast';
import type { Msg91Settings } from '@barakath/shared/types';
import { useAppDispatch, useAppSelector } from '@/stores/store';
import Icon from '@/components/icons/Icon';
import ConfirmDialog from '@/components/ConfirmDialog';
import { fetchMsg91Settings } from '../api/fetchMsg91Settings';
import { updateMsg91Settings } from '../api/updateMsg91Settings';
import { Field, SaveButton, SettingsCard, inputCls } from './ui';

interface Props {
  onDirtyChange: (dirty: boolean) => void;
}

const toForm = (s: Msg91Settings) => ({
  appWidgetId: s.appWidgetId,
  appTokenAuth: s.appTokenAuth,
  webWidgetId: s.webWidgetId,
  webTokenAuth: s.webTokenAuth,
  reviewLoginPhone: s.reviewLoginPhone,
  reviewLoginOtp: s.reviewLoginOtp,
});

type OtpFormValues = ReturnType<typeof toForm>;

/** A masked input with a show/hide eye — the widget tokens are server-only secrets. */
const SecretInput: FC<{ label: string; value: string; onChange: (v: string) => void; placeholder?: string }> = ({
  label,
  value,
  onChange,
  placeholder,
}) => {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input
        type={show ? 'text' : 'password'}
        className={`${inputCls} pr-11`}
        placeholder={placeholder ?? '••••••••••••'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete="off"
      />
      <button
        type="button"
        onClick={() => setShow((v) => !v)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-faint hover:text-foreground"
        aria-label={show ? `Hide ${label}` : `Show ${label}`}
      >
        <Icon name="EyeLine" size={18} />
      </button>
    </div>
  );
};

/** Section heading inside the card — groups app widget / website widget / reviewer login. */
const GroupTitle: FC<{ title: string; description: string }> = ({ title, description }) => (
  <div className="mb-3">
    <p className="text-[14px] font-semibold text-foreground">{title}</p>
    <p className="text-[12px] text-muted">{description}</p>
  </div>
);

/** The form itself — mounted only once the doc has loaded, so its state seeds from real values. */
const OtpForm: FC<Props & { saved: Msg91Settings }> = ({ saved, onDirtyChange }) => {
  const dispatch = useAppDispatch();
  const { saveLoading } = useAppSelector((s) => s.settings);
  const [form, setForm] = useState<OtpFormValues>(() => toForm(saved));
  const [confirmOpen, setConfirmOpen] = useState(false);

  const dirty = useMemo(() => JSON.stringify(form) !== JSON.stringify(toForm(saved)), [form, saved]);
  useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange]);

  const set = <K extends keyof OtpFormValues>(k: K, v: OtpFormValues[K]) => setForm((f) => ({ ...f, [k]: v }));

  // The functions only switch to these settings once the app widget pair is saved; before that they
  // still run on functions/.env.
  const adminManaged = !!saved.appWidgetId.trim() && !!saved.appTokenAuth.trim();

  const requestSave = () => {
    const f = form;
    if (!f.appWidgetId.trim() || !f.appTokenAuth.trim())
      return toast.error('Enter the app widget ID and token auth');
    const phone = f.reviewLoginPhone.trim();
    const otp = f.reviewLoginOtp.trim();
    if (phone || otp) {
      if (!/^\d{10}$/.test(phone)) return toast.error('Reviewer number must be 10 digits');
      if (!/^\d{6}$/.test(otp)) return toast.error('Reviewer OTP must be 6 digits');
    }
    setConfirmOpen(true);
  };

  const doSave = async () => {
    const trimmed = Object.fromEntries(
      Object.entries(form).map(([k, v]) => [k, v.trim()]),
    ) as OtpFormValues;
    const res = await dispatch(updateMsg91Settings(trimmed));
    setConfirmOpen(false);
    if (updateMsg91Settings.fulfilled.match(res)) toast.success('OTP settings updated');
    else toast.error((res.payload as string) ?? 'Could not save OTP settings');
  };

  return (
    <SettingsCard title="OTP (MSG91)" description="MSG91 OTP widget credentials used for customer sign-in.">
      <div className="mb-5 flex gap-3 rounded-lg border border-gold-border bg-gold-subtle px-4 py-3">
        <Icon name="AlertLine" size={18} className="mt-0.5 shrink-0 text-gold-strong" />
        <p className="text-[13px] leading-normal text-foreground">
          These credentials send every sign-in OTP. A wrong widget ID or token stops customers from
          signing in on the app and website — changes apply to the very next OTP request.
        </p>
      </div>

      <div className="flex items-center justify-between rounded-lg border border-border bg-subtle px-4 py-3">
        <div>
          <p className="text-[14px] font-semibold text-foreground">Credential source</p>
          <p className="text-[12px] text-muted">
            {adminManaged
              ? 'Sign-in uses the credentials saved here.'
              : 'Not saved yet — sign-in uses the server environment fallback.'}
          </p>
        </div>
        <span
          className={`rounded-pill px-3 py-1 text-[12px] font-semibold ${
            adminManaged ? 'bg-success-subtle text-success' : 'bg-subtle text-muted ring-1 ring-border-strong'
          }`}
        >
          {adminManaged ? 'Admin' : 'Fallback'}
        </span>
      </div>

      <div className="mt-6">
        <GroupTitle title="Customer app widget" description="Required. MSG91 → OTP Widget → the app widget." />
        <div className="grid gap-5">
          <Field label="Widget ID">
            <input
              className={inputCls}
              placeholder="App widget ID"
              value={form.appWidgetId}
              onChange={(e) => set('appWidgetId', e.target.value)}
              autoComplete="off"
            />
          </Field>
          <Field label="Token auth">
            <SecretInput
              label="app token auth"
              value={form.appTokenAuth}
              onChange={(v) => set('appTokenAuth', v)}
            />
          </Field>
        </div>
      </div>

      <div className="mt-6">
        <GroupTitle
          title="Website widget"
          description="Optional. The website uses its own widget — leave blank to use the app widget."
        />
        <div className="grid gap-5">
          <Field label="Widget ID">
            <input
              className={inputCls}
              placeholder="Same as app widget"
              value={form.webWidgetId}
              onChange={(e) => set('webWidgetId', e.target.value)}
              autoComplete="off"
            />
          </Field>
          <Field label="Token auth" hint="Leave blank if the account shares one token across widgets.">
            <SecretInput
              label="website token auth"
              value={form.webTokenAuth}
              onChange={(v) => set('webTokenAuth', v)}
              placeholder="Same as app token"
            />
          </Field>
        </div>
      </div>

      <div className="mt-6">
        <GroupTitle
          title="Play Store review login"
          description="Optional. This number skips the SMS and signs in with the fixed code. Leave both blank to turn it off."
        />
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Mobile number">
            <input
              className={inputCls}
              inputMode="numeric"
              maxLength={10}
              placeholder="10-digit number"
              value={form.reviewLoginPhone}
              onChange={(e) => set('reviewLoginPhone', e.target.value.replace(/\D/g, ''))}
              autoComplete="off"
            />
          </Field>
          <Field label="OTP">
            <SecretInput
              label="reviewer OTP"
              value={form.reviewLoginOtp}
              onChange={(v) => set('reviewLoginOtp', v.replace(/\D/g, '').slice(0, 6))}
              placeholder="6-digit code"
            />
          </Field>
        </div>
      </div>

      <div className="mt-6 flex justify-end">
        <SaveButton onClick={requestSave} loading={saveLoading} disabled={!dirty} />
      </div>

      <ConfirmDialog
        isOpen={confirmOpen}
        title="Save OTP settings?"
        message="Customer sign-in will use these MSG91 credentials from the next OTP request. Continue?"
        confirmLabel="Save"
        loading={saveLoading}
        onConfirm={doSave}
        onCancel={() => setConfirmOpen(false)}
      />
    </SettingsCard>
  );
};

/**
 * Tab — OTP (MSG91). Backed by the admin-only `general/msg91` doc (not `general/config`), so it loads
 * its own data with its own skeleton and retry, like the Policies tab.
 */
const OtpTab: FC<Props> = ({ onDirtyChange }) => {
  const dispatch = useAppDispatch();
  const { data, loading, error } = useAppSelector((s) => s.settings.msg91);

  useEffect(() => {
    if (!data) void dispatch(fetchMsg91Settings());
  }, [dispatch, data]);

  if (error)
    return (
      <div className="rounded-xl border border-border bg-surface p-8 text-center">
        <p className="text-[14px] text-error">{error}</p>
        <button
          type="button"
          onClick={() => void dispatch(fetchMsg91Settings())}
          className="mt-3 rounded-md bg-primary px-4 py-2 text-[14px] font-semibold text-white hover:bg-primary-dark"
        >
          Retry
        </button>
      </div>
    );

  if (loading || !data)
    return (
      <div className="rounded-xl border border-border bg-surface p-6">
        <Skeleton height={22} width={180} />
        <div className="mt-5 space-y-4">
          <Skeleton height={44} />
          <Skeleton height={44} />
          <Skeleton height={44} />
        </div>
      </div>
    );

  return <OtpForm saved={data} onDirtyChange={onDirtyChange} />;
};

export default OtpTab;
