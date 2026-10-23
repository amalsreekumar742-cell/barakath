import { type FC, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { PolicyStatus } from '@barakath/shared/config/enums';
import { POLICY_LIST_LIMIT, POLICY_NAME_MAX } from '@barakath/shared/config/policies';
import type { PolicyProps } from '@barakath/shared/types';
import { useAppDispatch, useAppSelector } from '@/stores/store';
import ConfirmDialog from '@/components/ConfirmDialog';
import Icon from '@/components/icons/Icon';
import { savePolicy } from '../api/savePolicy';
import { useBackToPolicies } from '../hooks/useBackToPolicies';
import { isBlankHtml } from '../utils/policyContent';
import PolicyContentEditor from './PolicyContentEditor';
import PolicyPreviewModal from './PolicyPreviewModal';
import { Field, SettingsCard, Toggle, inputCls } from './ui';

/**
 * The policy form's validation. Limits come from the shared policy config so the admin, the rules
 * (which mirror POLICY_NAME_MAX) and the readers agree. WHY `order` is capped at POLICY_LIST_LIMIT:
 * there can never be more policies than that, so a larger position is always a typo.
 */
const schema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Name is required')
    .max(POLICY_NAME_MAX, `At most ${POLICY_NAME_MAX} characters`),
  order: z.coerce
    .number({ invalid_type_error: 'Enter a number' })
    .int('Whole numbers only')
    .min(1, 'Minimum 1')
    .max(POLICY_LIST_LIMIT, `Maximum ${POLICY_LIST_LIMIT}`),
  enabled: z.boolean(),
  content: z.string().refine((html) => !isBlankHtml(html), 'Write the policy content'),
});
type FormValues = z.infer<typeof schema>;

interface Props {
  /** The policy being edited, or null to add one. */
  policy: PolicyProps | null;
  /** Starting "Display order" — the policy's own, or count + 1 for a new one. */
  defaultOrder: number;
  /** Adding is blocked because the store already holds POLICY_LIST_LIMIT policies. */
  atLimit: boolean;
}

/**
 * PolicyForm — Name, Display order, Status and Content for one policy, then Preview / Cancel / Save.
 * Mounted by PolicyEditorPage only once its starting values are known, so `defaultValues` are set once.
 *
 * Save flow (spec §1.22 — confirm before every action): validate → ConfirmDialog → savePolicy →
 * toast "Policy saved" → back to Settings with the Policies tab open. WHY validate BEFORE confirming:
 * asking "Save this policy?" and then failing on a blank name wastes the admin's click and reads as a
 * broken dialog. The validated values are held while the dialog is open, so what's confirmed is
 * exactly what's written.
 */
const PolicyForm: FC<Props> = ({ policy, defaultOrder, atLimit }) => {
  const dispatch = useAppDispatch();
  const back = useBackToPolicies();
  const saving = useAppSelector((s) => s.settings.policySaveLoading);

  const {
    register,
    control,
    handleSubmit,
    watch,
    formState: { errors, isDirty },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: policy?.name ?? '',
      order: defaultOrder,
      enabled: policy ? policy.status === PolicyStatus.ENABLED : true,
      content: policy?.content ?? '',
    },
  });

  const [pendingSave, setPendingSave] = useState<FormValues | null>(null);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  const name = watch('name');
  const content = watch('content');

  const doSave = async () => {
    if (!pendingSave) return;
    const res = await dispatch(
      savePolicy({
        id: policy?.id ?? null,
        name: pendingSave.name,
        content: pendingSave.content,
        status: pendingSave.enabled ? PolicyStatus.ENABLED : PolicyStatus.DISABLED,
        order: pendingSave.order,
      }),
    );
    setPendingSave(null);
    if (savePolicy.fulfilled.match(res)) {
      toast.success('Policy saved');
      back();
    } else {
      toast.error(res.payload ?? 'Could not save the policy');
    }
  };

  const cancel = () => (isDirty ? setDiscardOpen(true) : back());

  return (
    <form onSubmit={handleSubmit((v) => setPendingSave(v))} noValidate className="max-w-3xl space-y-4">
      {atLimit && (
        <div className="rounded-lg border border-error bg-error-subtle px-4 py-3 text-[13px] text-error">
          You already have {POLICY_LIST_LIMIT} policies, the most allowed. Edit or disable an existing policy
          instead.
        </div>
      )}

      <SettingsCard title="Policy" description="Shown to customers on the website and in the app while enabled.">
        <div className="grid gap-4">
          <Field label="Name" error={errors.name?.message} hint={`${name.trim().length}/${POLICY_NAME_MAX}`}>
            <input
              {...register('name')}
              disabled={saving}
              maxLength={POLICY_NAME_MAX}
              placeholder="e.g. Refund Policy"
              className={`${inputCls} disabled:opacity-50`}
            />
          </Field>

          <div className="max-w-[220px]">
            <Field label="Display order" error={errors.order?.message} hint="1 is shown first">
              <input
                {...register('order')}
                type="number"
                inputMode="numeric"
                min={1}
                max={POLICY_LIST_LIMIT}
                step={1}
                disabled={saving}
                className={`${inputCls} disabled:opacity-50`}
              />
            </Field>
          </div>

          <div>
            <span className="mb-1.5 block text-[13px] font-semibold text-foreground">Status</span>
            <Controller
              control={control}
              name="enabled"
              render={({ field }) => (
                <Toggle
                  on={field.value}
                  onChange={field.onChange}
                  disabled={saving}
                  label={field.value ? 'Enabled — visible on website and app' : 'Disabled — hidden, kept in admin'}
                />
              )}
            />
          </div>
        </div>
      </SettingsCard>

      <section className="rounded-xl border border-border bg-surface p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-[16px] font-bold tracking-tight text-foreground">Content</h2>
          <button
            type="button"
            onClick={() => setPreviewOpen(true)}
            className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-primary hover:underline"
          >
            <Icon name="EyeLine" size={16} /> Preview
          </button>
        </div>
        <Controller
          control={control}
          name="content"
          render={({ field }) => (
            <PolicyContentEditor
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              disabled={saving}
              invalid={!!errors.content}
            />
          )}
        />
        {errors.content && <p className="mt-1.5 text-[12px] text-error">{errors.content.message}</p>}
      </section>

      <div className="flex justify-end gap-2.5 pb-2">
        <button
          type="button"
          onClick={cancel}
          disabled={saving}
          className="rounded-md border border-border-strong px-4 py-2.5 text-[14px] font-semibold text-foreground hover:bg-subtle disabled:cursor-not-allowed disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving || atLimit}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-[14px] font-semibold text-white transition-colors hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving && <Icon name="Loader4Line" size={16} className="animate-spin" />}
          Save policy
        </button>
      </div>

      <ConfirmDialog
        isOpen={pendingSave !== null}
        title="Save this policy?"
        message={
          pendingSave?.enabled
            ? 'It will be shown to customers on the website and in the app.'
            : 'It is disabled, so customers won’t see it until you enable it.'
        }
        confirmLabel="Save"
        loading={saving}
        onConfirm={() => void doSave()}
        onCancel={() => setPendingSave(null)}
      />

      <ConfirmDialog
        isOpen={discardOpen}
        title="Discard unsaved changes?"
        message="Your edits to this policy will be lost."
        confirmLabel="Discard"
        confirmVariant="danger"
        onConfirm={() => {
          setDiscardOpen(false);
          back();
        }}
        onCancel={() => setDiscardOpen(false)}
      />

      <PolicyPreviewModal
        isOpen={previewOpen}
        onClose={() => setPreviewOpen(false)}
        title={name.trim() || 'Policy'}
        html={content}
      />
    </form>
  );
};

export default PolicyForm;
