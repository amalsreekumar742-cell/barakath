import { type FC, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import type { GeneralSettingsProps } from '@barakath/shared/types';
import { useAppDispatch, useAppSelector } from '@/stores/store';
import ConfirmDialog from '@/components/ConfirmDialog';
import { updateHelpSupport } from '../api/updateSettings';
import { Field, SaveButton, SettingsCard, inputCls } from './ui';

interface Props {
  settings: GeneralSettingsProps;
  onDirtyChange: (dirty: boolean) => void;
}

const toForm = (s: GeneralSettingsProps) => ({
  helpPhone: s.contactus.helpPhone,
  helpWhatsApp: s.contactus.helpWhatsApp,
  helpEmail: s.contactus.helpEmail,
});

const TEN_DIGITS = /^\d{10}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Tab 6 — Help & Support (spec §1.21). Phone/WhatsApp are 10-digit Indian numbers (+91 prefix shown). */
const HelpSupportTab: FC<Props> = ({ settings, onDirtyChange }) => {
  const dispatch = useAppDispatch();
  const { saveLoading } = useAppSelector((s) => s.settings);
  const [form, setForm] = useState(() => toForm(settings));
  const [confirmOpen, setConfirmOpen] = useState(false);

  const dirty = useMemo(
    () => JSON.stringify(form) !== JSON.stringify(toForm(settings)),
    [form, settings],
  );
  useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange]);

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  // Keep only digits for the phone fields, capped at 10.
  const setDigits = (k: 'helpPhone' | 'helpWhatsApp', v: string) =>
    set(k, v.replace(/\D/g, '').slice(0, 10));

  const requestSave = () => {
    if (form.helpPhone && !TEN_DIGITS.test(form.helpPhone))
      return toast.error('Phone must be a 10-digit number');
    if (form.helpWhatsApp && !TEN_DIGITS.test(form.helpWhatsApp))
      return toast.error('WhatsApp must be a 10-digit number');
    if (form.helpEmail && !EMAIL.test(form.helpEmail.trim()))
      return toast.error('Enter a valid email address');
    setConfirmOpen(true);
  };

  const doSave = async () => {
    const res = await dispatch(
      updateHelpSupport({
        helpPhone: form.helpPhone,
        helpWhatsApp: form.helpWhatsApp,
        helpEmail: form.helpEmail.trim(),
      }),
    );
    setConfirmOpen(false);
    if (updateHelpSupport.fulfilled.match(res)) toast.success('Help & support updated');
    else toast.error((res.payload as string) ?? 'Could not save help & support');
  };

  const phonePrefix = (
    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[14px] text-muted">
      +91
    </span>
  );

  return (
    <SettingsCard title="Help & Support" description="Contact details shown to customers.">
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Phone number">
          <div className="relative">
            {phonePrefix}
            <input
              inputMode="numeric"
              className={`${inputCls} pl-12`}
              placeholder="10-digit number"
              value={form.helpPhone}
              onChange={(e) => setDigits('helpPhone', e.target.value)}
            />
          </div>
        </Field>
        <Field label="WhatsApp number">
          <div className="relative">
            {phonePrefix}
            <input
              inputMode="numeric"
              className={`${inputCls} pl-12`}
              placeholder="10-digit number"
              value={form.helpWhatsApp}
              onChange={(e) => setDigits('helpWhatsApp', e.target.value)}
            />
          </div>
        </Field>
        <Field label="Email address">
          <input
            type="email"
            className={inputCls}
            placeholder="support@barakath.com"
            value={form.helpEmail}
            onChange={(e) => set('helpEmail', e.target.value)}
          />
        </Field>
      </div>

      <div className="mt-6 flex justify-end">
        <SaveButton onClick={requestSave} loading={saveLoading} disabled={!dirty} />
      </div>

      <ConfirmDialog
        isOpen={confirmOpen}
        title="Save help & support?"
        message="These contact details are visible to all customers."
        confirmLabel="Save"
        loading={saveLoading}
        onConfirm={doSave}
        onCancel={() => setConfirmOpen(false)}
      />
    </SettingsCard>
  );
};

export default HelpSupportTab;
