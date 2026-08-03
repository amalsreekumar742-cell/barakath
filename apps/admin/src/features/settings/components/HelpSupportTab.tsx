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

/**
 * Accepts any international number: an optional leading `+`, then digits with
 * spaces/hyphens/parentheses allowed as separators. Length is checked on the
 * digits alone — E.164 allows at most 15, and no country has fewer than 6.
 */
const PHONE_SHAPE = /^\+?[\d\s\-()]+$/;
const phoneDigits = (v: string) => v.replace(/\D/g, '').length;
const isValidPhone = (v: string) =>
  PHONE_SHAPE.test(v) && phoneDigits(v) >= 6 && phoneDigits(v) <= 15;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Tab 6 — Help & Support (spec §1.21).
 *
 * Phone/WhatsApp are free-form international numbers. There is deliberately no
 * hardcoded +91 and no 10-digit rule: support numbers may sit outside India, and
 * `wa.me` links (apps/web Footer, the app's help centre) need a country code to
 * resolve at all — a bare national number produced a dead WhatsApp link. Admins
 * type the full number including its country code.
 */
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

  const requestSave = () => {
    if (form.helpPhone.trim() && !isValidPhone(form.helpPhone.trim()))
      return toast.error('Enter a valid phone number with country code, e.g. +91 8590941583');
    if (form.helpWhatsApp.trim() && !isValidPhone(form.helpWhatsApp.trim()))
      return toast.error('Enter a valid WhatsApp number with country code, e.g. +91 8590941583');
    if (form.helpEmail && !EMAIL.test(form.helpEmail.trim()))
      return toast.error('Enter a valid email address');
    setConfirmOpen(true);
  };

  const doSave = async () => {
    const res = await dispatch(
      updateHelpSupport({
        helpPhone: form.helpPhone.trim(),
        helpWhatsApp: form.helpWhatsApp.trim(),
        helpEmail: form.helpEmail.trim(),
      }),
    );
    setConfirmOpen(false);
    if (updateHelpSupport.fulfilled.match(res)) toast.success('Help & support updated');
    else toast.error((res.payload as string) ?? 'Could not save help & support');
  };

  return (
    <SettingsCard title="Help & Support" description="Contact details shown to customers.">
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Phone number">
          <input
            type="tel"
            inputMode="tel"
            className={inputCls}
            placeholder="+91 8590941583"
            value={form.helpPhone}
            onChange={(e) => set('helpPhone', e.target.value)}
          />
        </Field>
        <Field label="WhatsApp number">
          <input
            type="tel"
            inputMode="tel"
            className={inputCls}
            placeholder="+91 8590941583"
            value={form.helpWhatsApp}
            onChange={(e) => set('helpWhatsApp', e.target.value)}
          />
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
