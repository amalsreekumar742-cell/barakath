import { type FC, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import type { GeneralSettingsProps } from '@barakath/shared/types';
import { useAppDispatch, useAppSelector } from '@/stores/store';
import ConfirmDialog from '@/components/ConfirmDialog';
import { updateDeliveryTax } from '../api/updateSettings';
import { Field, SaveButton, SettingsCard, Toggle, inputCls } from './ui';

interface Props {
  settings: GeneralSettingsProps;
  onDirtyChange: (dirty: boolean) => void;
}

/** Local form shape (numbers kept as strings so the inputs stay controlled and can be cleared). */
const toForm = (s: GeneralSettingsProps) => ({
  standardDeliveryFee: String(s.delivery.standardDeliveryFee),
  freeDeliveryThreshold: String(s.delivery.freeDeliveryThreshold),
  gstin: s.delivery.gstin,
  pricesIncludeTax: s.delivery.pricesIncludeTax,
});

/** Tab 2 — Delivery & Tax (spec §1.21). */
const DeliveryTaxTab: FC<Props> = ({ settings, onDirtyChange }) => {
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
    const fee = Number(form.standardDeliveryFee);
    const free = Number(form.freeDeliveryThreshold);
    if (![fee, free].every((n) => Number.isFinite(n) && n >= 0))
      return toast.error('Amounts must be zero or more');
    setConfirmOpen(true);
  };

  const doSave = async () => {
    const res = await dispatch(
      updateDeliveryTax({
        standardDeliveryFee: Number(form.standardDeliveryFee),
        freeDeliveryThreshold: Number(form.freeDeliveryThreshold),
        gstin: form.gstin.trim(),
        pricesIncludeTax: form.pricesIncludeTax,
      }),
    );
    setConfirmOpen(false);
    if (updateDeliveryTax.fulfilled.match(res)) toast.success('Delivery & tax updated');
    else toast.error((res.payload as string) ?? 'Could not save delivery & tax');
  };

  return (
    <SettingsCard title="Delivery & Tax" description="Delivery fees and tax applied at checkout.">
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Standard delivery fee (₹)">
          <input
            type="number"
            min={0}
            className={inputCls}
            value={form.standardDeliveryFee}
            onChange={(e) => set('standardDeliveryFee', e.target.value)}
          />
        </Field>
        <Field label="Free delivery over (₹)" hint="Minimum order value that qualifies for free delivery.">
          <input
            type="number"
            min={0}
            className={inputCls}
            value={form.freeDeliveryThreshold}
            onChange={(e) => set('freeDeliveryThreshold', e.target.value)}
          />
        </Field>
        {/* No "GST rate (%)" field: the rate is per-variant (products/{id}/variants/{id}.gstPercentage),
            which is what checkout actually charges — a single global rate could not describe a cart
            holding an 8% and a 9% item, and editing it here implied a control it did not have. GSTIN
            stays; it is the seller's own registration number and belongs on every invoice. */}
        <Field label="GSTIN number">
          <input
            className={inputCls}
            placeholder="e.g. 29ABCDE1234F1Z5"
            value={form.gstin}
            onChange={(e) => set('gstin', e.target.value)}
          />
        </Field>
      </div>

      <div className="mt-6 flex items-center justify-between rounded-lg border border-border bg-subtle px-4 py-3">
        <div>
          <p className="text-[14px] font-semibold text-foreground">Prices include tax</p>
          <p className="text-[12px] text-muted">When on, displayed prices are treated as tax-inclusive.</p>
        </div>
        <Toggle on={form.pricesIncludeTax} onChange={(v) => set('pricesIncludeTax', v)} />
      </div>

      <div className="mt-6 flex justify-end">
        <SaveButton onClick={requestSave} loading={saveLoading} disabled={!dirty} />
      </div>

      <ConfirmDialog
        isOpen={confirmOpen}
        title="Save delivery & tax?"
        message="These settings affect checkout totals for all customers."
        confirmLabel="Save"
        loading={saveLoading}
        onConfirm={doSave}
        onCancel={() => setConfirmOpen(false)}
      />
    </SettingsCard>
  );
};

export default DeliveryTaxTab;
