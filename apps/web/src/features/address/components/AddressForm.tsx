'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { ReactNode } from 'react';
import { Button } from '@/components/Button';
import { Constants } from '@/config/constants';
import { ADDRESS_LABELS, addressFormSchema, type AddressFormValues } from '../utils/addressSchema';
import { INDIAN_STATES } from '../utils/indianStates';
import { MapPicker } from './MapPicker';
import type { ResolvedLocation } from '../utils/googleMaps';

export interface AddressFormProps {
  onSubmit: (values: AddressFormValues) => Promise<void> | void;
  onCancel?: () => void;
  submitting?: boolean;
  /** The very first address is always the default (spec §2.14) — hides the manual toggle so it can't
   *  be un-set on the one address that has to stay the default anyway. */
  isFirstAddress?: boolean;
}

const inputClass =
  'h-11 w-full rounded-md border border-border-strong bg-surface px-3 text-sm text-foreground outline-none focus:border-primary';

/**
 * Add-address form — label / recipient name / phone / address lines / city / state / pincode /
 * landmark, field-for-field matching `apps/app`'s `AddAddressPage` (read per this batch's step 0) so
 * both clients write identical `users/{uid}/addresses/{id}` documents. Delete + add only, no edit
 * (spec §2.14) — this component is deliberately create-only; there is no `initialValues`/edit mode.
 *
 * Shared by C2's checkout section and C5's `/account/addresses` page — both import this rather than
 * building their own form (this batch's brief, §6).
 */
export function AddressForm({ onSubmit, onCancel, submitting = false, isFirstAddress = false }: AddressFormProps) {
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<AddressFormValues>({
    resolver: zodResolver(addressFormSchema),
    defaultValues: { label: 'Home', addressLine2: '', landmark: '', isDefault: false },
  });
  const label = watch('label');

  /** Prefill from the map/geocoder — never overwrites a field the customer already typed something into. */
  function handleLocationResolved(loc: ResolvedLocation) {
    if (loc.addressLine1 && !watch('addressLine1')) setValue('addressLine1', loc.addressLine1, { shouldValidate: true });
    if (loc.area && !watch('addressLine2')) setValue('addressLine2', loc.area);
    if (loc.city) setValue('city', loc.city, { shouldValidate: true });
    if (loc.state && INDIAN_STATES.includes(loc.state)) setValue('state', loc.state, { shouldValidate: true });
    if (loc.pincode) setValue('pincode', loc.pincode, { shouldValidate: true });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      <MapPicker onResolved={handleLocationResolved} />

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Address label</p>
        <div className="flex gap-2">
          {ADDRESS_LABELS.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setValue('label', option, { shouldValidate: true })}
              aria-pressed={label === option}
              className={`rounded-full border px-4 py-1.5 text-sm font-medium transition ${
                label === option
                  ? 'border-primary bg-primary-subtle text-primary'
                  : 'border-border-strong text-foreground hover:bg-subtle'
              }`}
            >
              {option}
            </button>
          ))}
        </div>
      </div>

      <Field label="Full name" error={errors.fullName?.message}>
        <input {...register('fullName')} placeholder="Recipient's name" className={inputClass} />
      </Field>

      <Field label="Phone number" error={errors.phone?.message}>
        <div className="flex items-center rounded-md border border-border-strong">
          <span className="border-r border-border-strong px-3 text-sm font-medium text-muted">
            {Constants.DEFAULT_COUNTRY_CODE}
          </span>
          <input
            {...register('phone')}
            inputMode="numeric"
            maxLength={10}
            placeholder="10-digit mobile number"
            className={`${inputClass} border-0`}
          />
        </div>
      </Field>

      <Field label="Address line 1" error={errors.addressLine1?.message}>
        <input {...register('addressLine1')} placeholder="House no, building, street" className={inputClass} />
      </Field>

      <Field label="Address line 2 (optional)">
        <input {...register('addressLine2')} placeholder="Area, colony" className={inputClass} />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="City" error={errors.city?.message}>
          <input {...register('city')} className={inputClass} />
        </Field>
        <Field label="Pincode" error={errors.pincode?.message}>
          <input {...register('pincode')} inputMode="numeric" maxLength={6} className={inputClass} />
        </Field>
      </div>

      <Field label="State" error={errors.state?.message}>
        <select {...register('state')} className={inputClass} defaultValue="">
          <option value="" disabled>
            Select state
          </option>
          {INDIAN_STATES.map((state) => (
            <option key={state} value={state}>
              {state}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Landmark (optional)">
        <input {...register('landmark')} className={inputClass} />
      </Field>

      {!isFirstAddress && (
        <label className="flex items-center gap-2 text-sm font-medium text-foreground">
          <input type="checkbox" {...register('isDefault')} className="size-4 rounded border-border-strong" />
          Set as default address
        </label>
      )}

      <div className="flex gap-3 pt-2">
        <Button type="submit" variant="primary" size="lg" loading={submitting} fullWidth>
          Save address
        </Button>
        {onCancel && (
          <Button type="button" variant="secondary" size="lg" onClick={onCancel} disabled={submitting}>
            Cancel
          </Button>
        )}
      </div>
    </form>
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
