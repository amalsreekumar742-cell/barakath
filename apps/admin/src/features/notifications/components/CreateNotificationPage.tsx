import { type FC, type ReactNode, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import {
  NotificationType,
  NotificationTargetType,
  NotificationLinkType,
} from '@barakath/shared/config/enums';
import { useAppDispatch, useAppSelector } from '@/stores/store';
import Icon from '@/components/icons/Icon';
import ConfirmDialog from '@/components/ConfirmDialog';
import { createNotification } from '../api/createNotification';
import type { NotificationInput } from '../types';
import UserMultiSelect from './UserMultiSelect';
import DeepLinkPicker from './DeepLinkPicker';

/**
 * Zod schema for the create-notification form (spec §1.18C). Cross-field rules in superRefine: a Specific
 * audience needs ≥1 user, a Product/Category deep link needs a selected value, and a scheduled send needs a
 * future date-time. Type is fixed to Broadcast (admin-composed) — the design exposes no type selector.
 */
const schema = z
  .object({
    title: z.string().trim().min(1, 'Title is required').max(100, 'At most 100 characters'),
    body: z.string().trim().min(1, 'Message is required').max(500, 'At most 500 characters'),
    targetType: z.enum(['All', 'Specific']),
    targetUserIds: z.array(z.string()),
    linkType: z.enum(['Product', 'Category', 'None']),
    linkValue: z.string(),
    sendMode: z.enum(['now', 'schedule']),
    scheduledAt: z.date().nullable(),
  })
  .superRefine((d, ctx) => {
    if (d.targetType === 'Specific' && d.targetUserIds.length === 0) {
      ctx.addIssue({ path: ['targetUserIds'], code: z.ZodIssueCode.custom, message: 'Select at least one user' });
    }
    if ((d.linkType === 'Product' || d.linkType === 'Category') && !d.linkValue) {
      ctx.addIssue({
        path: ['linkValue'],
        code: z.ZodIssueCode.custom,
        message: `Select a ${d.linkType.toLowerCase()} to link`,
      });
    }
    if (d.sendMode === 'schedule') {
      if (!d.scheduledAt) {
        ctx.addIssue({ path: ['scheduledAt'], code: z.ZodIssueCode.custom, message: 'Pick a date and time' });
      } else if (d.scheduledAt.getTime() <= Date.now()) {
        ctx.addIssue({ path: ['scheduledAt'], code: z.ZodIssueCode.custom, message: 'Must be in the future' });
      }
    }
  });

type FormValues = z.infer<typeof schema>;

/**
 * CreateNotificationPage — the create form (spec §1.18), route `/notifications/create`. Per the design:
 * a single form card (Title · Message · Audience · Deep link · Send · Schedule) beside/above a live push
 * Preview card, with Cancel + "Send / schedule" in the header. Send-now is gated behind a confirm dialog
 * (irreversible); scheduling submits directly.
 */
const CreateNotificationPage: FC = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const admin = useAppSelector((s) => s.currentAdmin.admin);
  const saving = useAppSelector((s) => s.notifications.createLoading);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isDirty },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: '',
      body: '',
      targetType: NotificationTargetType.ALL,
      targetUserIds: [],
      linkType: NotificationLinkType.NONE,
      linkValue: '',
      sendMode: 'now',
      scheduledAt: null,
    },
  });

  // Holds the validated values for the send-now confirm dialog.
  const [pending, setPending] = useState<FormValues | null>(null);

  const title = watch('title');
  const body = watch('body');
  const targetType = watch('targetType');
  const targetUserIds = watch('targetUserIds');
  const linkType = watch('linkType');
  const linkValue = watch('linkValue');
  const sendMode = watch('sendMode');
  const scheduledAt = watch('scheduledAt');

  const cancel = () => {
    if (isDirty && !window.confirm('Discard unsaved changes?')) return;
    navigate('/notifications');
  };

  // Build the input and dispatch create. Shared by send-now (after confirm) and schedule (direct).
  const doCreate = async (values: FormValues) => {
    if (!admin) return toast.error('Not signed in');
    const input: NotificationInput = {
      title: values.title,
      body: values.body,
      type: NotificationType.BROADCAST, // admin-composed; the design exposes no type selector
      targetType: values.targetType,
      targetUserIds: values.targetType === 'Specific' ? values.targetUserIds : [],
      linkType: values.linkType,
      linkValue: values.linkType === 'None' ? '' : values.linkValue,
      sendMode: values.sendMode,
      scheduledAt: values.sendMode === 'schedule' ? values.scheduledAt : null,
    };

    const res = await dispatch(
      createNotification({ input, imageFile: null, adminId: admin.id, adminName: admin.fullName }),
    );
    setPending(null);
    if (createNotification.fulfilled.match(res)) {
      toast.success(values.sendMode === 'now' ? 'Notification sent' : 'Notification scheduled');
      navigate('/notifications');
    } else {
      toast.error((res.payload as string) ?? 'Could not create notification');
    }
  };

  // On valid submit: send-now opens the confirm dialog; schedule submits directly.
  const onValid = (values: FormValues) => {
    if (values.sendMode === 'now') setPending(values);
    else void doCreate(values);
  };

  return (
    <form onSubmit={handleSubmit(onValid)} className="p-6">
      {/* Header + actions */}
      <div className="mb-5 flex items-start justify-between gap-4">
        <h1 className="text-[22px] font-extrabold tracking-tight text-foreground">Create notification</h1>
        <div className="flex shrink-0 gap-2.5">
          <button
            type="button"
            onClick={cancel}
            disabled={saving}
            className="rounded-md border border-border-strong px-4 py-2 text-[14px] font-semibold text-foreground hover:bg-subtle disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2 text-[14px] font-semibold text-white hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving && <Icon name="Loader4Line" size={16} className="animate-spin" />}
            Send / schedule
          </button>
        </div>
      </div>

      <div className="flex max-w-[720px] flex-col gap-4">
        {/* Form card */}
        <div className="rounded-xl border border-border bg-surface p-5 shadow-sm">
          <div className="flex flex-col gap-4">
            <Field label="Title" error={errors.title?.message}>
              <input {...register('title')} maxLength={100} placeholder="e.g. Eid sale is live" className={inputCls} />
            </Field>

            <Field label="Message" error={errors.body?.message}>
              <textarea
                {...register('body')}
                rows={3}
                maxLength={500}
                placeholder="Up to 40% off signature oud — shop the Eid edit now."
                className={`${inputCls} resize-y`}
              />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Audience">
                <SelectBox
                  value={targetType}
                  onChange={(v) =>
                    setValue('targetType', v as FormValues['targetType'], { shouldDirty: true, shouldValidate: true })
                  }
                  options={[
                    { value: NotificationTargetType.ALL, label: 'All users' },
                    { value: NotificationTargetType.SPECIFIC, label: 'Specific users' },
                  ]}
                />
              </Field>

              <Field label="Deep link">
                <SelectBox
                  value={linkType}
                  onChange={(v) => {
                    setValue('linkType', v as FormValues['linkType'], { shouldDirty: true, shouldValidate: true });
                    setValue('linkValue', '', { shouldDirty: true, shouldValidate: true });
                  }}
                  options={[
                    { value: NotificationLinkType.NONE, label: 'None' },
                    { value: NotificationLinkType.PRODUCT, label: 'Product' },
                    { value: NotificationLinkType.CATEGORY, label: 'Category' },
                  ]}
                />
              </Field>
            </div>

            {/* Reveal the user picker only for a Specific audience. */}
            {targetType === NotificationTargetType.SPECIFIC && (
              <Field label="Select users" error={errors.targetUserIds?.message as string | undefined}>
                <UserMultiSelect
                  value={targetUserIds}
                  onChange={(ids) => setValue('targetUserIds', ids, { shouldDirty: true, shouldValidate: true })}
                />
              </Field>
            )}

            {/* Reveal the target picker only when a deep link needs a value. */}
            {linkType !== NotificationLinkType.NONE && (
              <Field label={`Link ${linkType.toLowerCase()}`} error={errors.linkValue?.message}>
                <DeepLinkPicker
                  linkType={linkType}
                  value={linkValue}
                  onChange={(id) => setValue('linkValue', id, { shouldDirty: true, shouldValidate: true })}
                />
              </Field>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Send">
                <SelectBox
                  value={sendMode}
                  onChange={(v) =>
                    setValue('sendMode', v as FormValues['sendMode'], { shouldDirty: true, shouldValidate: true })
                  }
                  options={[
                    { value: 'now', label: 'Now' },
                    { value: 'schedule', label: 'Schedule' },
                  ]}
                />
              </Field>

              <Field label="Schedule" error={errors.scheduledAt?.message}>
                {sendMode === 'schedule' ? (
                  <DatePicker
                    selected={scheduledAt}
                    onChange={(d) => setValue('scheduledAt', d, { shouldDirty: true, shouldValidate: true })}
                    showTimeSelect
                    minDate={new Date()}
                    dateFormat="dd MMM yyyy, h:mm aa"
                    placeholderText="Pick a future date and time"
                    className={inputCls}
                    wrapperClassName="w-full"
                  />
                ) : (
                  <div className={`${inputCls} flex items-center text-faint`}>—</div>
                )}
              </Field>
            </div>
          </div>
        </div>

        {/* Preview card */}
        <div className="rounded-xl border border-border bg-surface p-5 shadow-sm">
          <div className="mb-2.5 text-[13px] font-bold text-foreground">Preview</div>
          <div className="flex gap-3 rounded-lg bg-app p-3.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary text-white">
              <Icon name="NotificationLine" size={18} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-bold text-foreground">{title || 'Notification title'}</p>
              <p className="mt-1 line-clamp-3 text-[12px] leading-snug text-muted">
                {body || 'Your message preview appears here.'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Send-now confirmation (spec §1.18: irreversible, shows audience) */}
      <ConfirmDialog
        isOpen={!!pending}
        title="Send notification now?"
        message={`This sends the push to ${
          targetType === 'All' ? 'all users' : `${targetUserIds.length} selected user(s)`
        } immediately. This cannot be undone.`}
        confirmLabel="Send now"
        confirmVariant="primary"
        loading={saving}
        onConfirm={() => pending && void doCreate(pending)}
        onCancel={() => setPending(null)}
      />
    </form>
  );
};

const inputCls =
  'w-full rounded-lg border border-border-strong bg-surface px-3 py-2.5 text-[13px] outline-none placeholder:text-faint focus:border-primary focus:ring-2 focus:ring-primary/20';

const Field: FC<{ label: string; error?: string; children: ReactNode }> = ({ label, error, children }) => (
  <div className="flex flex-col gap-1.5">
    <label className="text-[12px] font-bold text-foreground">{label}</label>
    {children}
    {error && <p className="text-[12px] text-error">{error}</p>}
  </div>
);

/** A native <select> styled as the design's bordered dropdown with an ArrowDownLine affordance. */
const SelectBox: FC<{
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}> = ({ value, onChange, options }) => (
  <div className="relative">
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`${inputCls} appearance-none pr-9`}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-faint">
      <Icon name="ArrowDownLine" size={16} />
    </span>
  </div>
);

export default CreateNotificationPage;
