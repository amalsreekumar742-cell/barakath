'use client';

import { useState, type ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { FirestoreCollections, keywordsBuilder, type UserProps } from '@barakath/shared';
import { db } from '@/lib/firebaseConfig';
import { Button } from '@/components/Button';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { toastError, toastSuccess } from '@/lib/toast';
import { personalInfoSchema, type PersonalInfoFormValues } from './settingsSchema';

/**
 * `packages/shared`'s `UserProps` doesn't declare `whatsapp`, even though `features/auth/hooks/
 * useAuthFlow.ts`'s `saveProfile` already writes it to the real `users/{uid}` document (and
 * `firestore.rules`' `onlyOwnProfileFields()` explicitly allows it) — a known gap in the shared type,
 * flagged in this batch's report rather than fixed here (`packages/shared` is out of this session's
 * scope). Read/write it via this local extension instead of widening the shared type unilaterally.
 */
type UserDocWithWhatsapp = UserProps & { whatsapp?: string };

const inputClass =
  'h-11 w-full rounded-md border border-border-strong bg-surface px-3 text-sm text-foreground outline-none focus:border-primary';
const readOnlyInputClass = 'h-11 w-full rounded-md border border-border bg-subtle px-3 text-sm text-muted';

/**
 * Personal-info edit form (spec 3.19). Save → confirmation dialog → `users/{uid}` update, rebuilding
 * `keywords` from name + phone + email with the shared `keywordsBuilder` (same call shape
 * `useAuthFlow.ts`'s `saveProfile` already uses: one space-joined string of the non-empty parts).
 *
 * Mobile is rendered read-only and is NEVER part of the form/submit — it is the OTP login identity
 * (spec 3.19 explicitly marks it display-only) and isn't even in `onlyOwnProfileFields()`'s allowlist,
 * so a client write to it would be rejected anyway.
 *
 * Fields written — fullName, email, whatsapp, keywords, updatedAt — are all inside
 * `firestore.rules`' `onlyOwnProfileFields()` allowlist (`fullName, email, whatsapp, profileImage,
 * referredBy, keywords, fcmToken, updatedAt`); `profileImage`/`referredBy`/`fcmToken` are never
 * touched by this write.
 */
export function PersonalInfoForm({ uid, user }: { uid: string; user: UserDocWithWhatsapp }) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<PersonalInfoFormValues>({
    resolver: zodResolver(personalInfoSchema),
    defaultValues: {
      fullName: user.fullName ?? '',
      whatsapp: user.whatsapp ?? '',
      email: user.email ?? '',
    },
  });

  // Validated values wait here until the confirm dialog is answered — Save never writes directly.
  const [pendingValues, setPendingValues] = useState<PersonalInfoFormValues | null>(null);
  const [saving, setSaving] = useState(false);

  function onSubmit(values: PersonalInfoFormValues) {
    setPendingValues(values);
  }

  async function handleConfirmSave() {
    if (!pendingValues) return;
    setSaving(true);
    try {
      const fullName = pendingValues.fullName.trim();
      const email = pendingValues.email?.trim() ?? '';
      const whatsapp = pendingValues.whatsapp?.trim() ?? '';
      const keywords = keywordsBuilder([fullName, user.phone, email].filter(Boolean).join(' '));
      await updateDoc(doc(db, FirestoreCollections.users, uid), {
        fullName,
        email,
        whatsapp,
        keywords,
        updatedAt: serverTimestamp(),
      });
      toastSuccess('Profile updated');
    } catch (e) {
      toastError(e, 'Could not save your changes. Please try again.');
    } finally {
      setSaving(false);
      setPendingValues(null);
    }
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      <h2 className="font-display text-lg font-extrabold text-foreground">Personal info</h2>

      <form onSubmit={handleSubmit(onSubmit)} className="mt-4 space-y-4" noValidate>
        <Field label="Full name" error={errors.fullName?.message}>
          <input {...register('fullName')} className={inputClass} />
        </Field>

        <Field label="Mobile number">
          <input value={user.phone} disabled readOnly className={readOnlyInputClass} />
          <p className="mt-1 text-xs text-faint">
            Your mobile number is your login and can&apos;t be changed here.
          </p>
        </Field>

        <Field label="WhatsApp number (optional)" error={errors.whatsapp?.message}>
          <input {...register('whatsapp')} inputMode="numeric" maxLength={10} className={inputClass} />
        </Field>

        <Field label="Email (optional)" error={errors.email?.message}>
          <input {...register('email')} type="email" className={inputClass} />
        </Field>

        <Button type="submit" variant="primary" size="lg">
          Save changes
        </Button>
      </form>

      <ConfirmDialog
        isOpen={pendingValues !== null}
        title="Save changes?"
        description="Your profile info will be updated."
        confirmLabel="Save"
        loading={saving}
        onConfirm={handleConfirmSave}
        onClose={() => {
          if (!saving) setPendingValues(null);
        }}
      />
    </div>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">{label}</label>
      {children}
      {error && <p className="mt-1 text-xs font-medium text-error">{error}</p>}
    </div>
  );
}
