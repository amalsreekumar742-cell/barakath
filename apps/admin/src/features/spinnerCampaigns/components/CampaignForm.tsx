import { type FC, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import type { SpinnerCampaignProps } from '@barakath/shared/types';
import { useAppDispatch, useAppSelector } from '@/stores/store';
import Icon from '@/components/icons/Icon';
import { createCampaign } from '../api/createCampaign';
import { updateCampaign } from '../api/updateCampaign';
import type { CampaignInput, SlotInput } from '../types';
import { Card, Field, inputCls } from './ui';

/** Default wedge colours seeded onto a brand-new campaign's starter slots. */
const SLOT_COLORS = ['#f59e0b', '#ef4444', '#10b981', '#3b82f6'];

/**
 * Zod schema for the campaign SETTINGS form (spec F13). The wheel offers/slots are configured separately on
 * the campaign's configure page, so this form only validates the shell: name, the campaign window (end
 * after start) and the per-user spin limit. WHY zod + react-hook-form: the app's standard forms stack.
 */
const schema = z
  .object({
    name: z.string().trim().min(3, 'At least 3 characters').max(60, 'At most 60 characters'),
    startDate: z.date({ required_error: 'Start date is required', invalid_type_error: 'Start date is required' }),
    endDate: z.date({ required_error: 'End date is required', invalid_type_error: 'End date is required' }),
    maxSpinsPerUser: z.coerce.number().int('Whole number').min(1, 'Minimum 1'),
    isActive: z.boolean(),
  })
  .superRefine((d, ctx) => {
    if (d.endDate <= d.startDate) {
      ctx.addIssue({ path: ['endDate'], code: z.ZodIssueCode.custom, message: 'Must be after the start date' });
    }
  });

type FormValues = z.infer<typeof schema>;

/**
 * Four evenly-weighted starter slots (25% each ⇒ sums to 100) seeded onto a new campaign so its wheel is
 * valid immediately; the admin then edits them on the configure page. Two coupon + two better-luck give a
 * sensible default wheel out of the box.
 */
function defaultSlots(): SlotInput[] {
  const seed: Array<Pick<SlotInput, 'label' | 'type'>> = [
    { label: '10% OFF', type: 'Coupon' },
    { label: '₹50 OFF', type: 'Coupon' },
    { label: 'Free shipping', type: 'Better luck' },
    { label: 'Better luck next time', type: 'Better luck' },
  ];
  return seed.map((s, i) => ({
    id: `slot_${Date.now()}_${i}_${Math.random().toString(36).slice(2, 8)}`,
    label: s.label,
    type: s.type,
    couponCode: '',
    couponId: '',
    discountType: 'Percentage',
    discountValue: s.label === '₹50 OFF' ? 50 : 10,
    minimumOrderAmount: 0,
    maximumDiscount: 100,
    probability: 25,
    color: SLOT_COLORS[i % SLOT_COLORS.length]!, // modulo keeps the index in range
  }));
}

interface CampaignFormProps {
  mode: 'create' | 'edit';
  campaign?: SpinnerCampaignProps;
}

/**
 * CampaignForm — the campaign SETTINGS form (spec F13). Create renders a blank form and, on "Create &
 * configure", seeds a default wheel and drops the admin straight onto the new campaign's configure page
 * (where the wheel offers are set up). Edit reuses the same fields to change the shell without touching the
 * already-configured slots (they're passed through untouched). WHY split settings from the wheel: the
 * prototype's Create screen is a short settings form, and the wheel lives on the configure page.
 */
const CampaignForm: FC<CampaignFormProps> = ({ mode, campaign }) => {
  const isEdit = mode === 'edit';
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const admin = useAppSelector((s) => s.currentAdmin.admin);
  const saving = useAppSelector((s) =>
    isEdit ? s.spinnerCampaigns.updateLoading : s.spinnerCampaigns.createLoading,
  );

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isDirty },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '',
      startDate: new Date(),
      endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      maxSpinsPerUser: 1,
      isActive: true,
    },
  });

  const hydrated = useRef(false);

  // Hydrate the form from the loaded campaign on Edit (once).
  useEffect(() => {
    if (!isEdit || hydrated.current || !campaign) return;
    hydrated.current = true;
    reset({
      name: campaign.name,
      startDate: campaign.startDate.toDate(),
      endDate: campaign.endDate.toDate(),
      maxSpinsPerUser: campaign.maxSpinsPerUser,
      isActive: campaign.isActive,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaign, isEdit]);

  const startDate = watch('startDate');
  const endDate = watch('endDate');
  const isActive = watch('isActive');

  const cancel = () => {
    if (isDirty && !window.confirm('Discard unsaved changes?')) return;
    navigate(isEdit && campaign ? `/spinner-campaigns/${campaign.id}` : '/spinner-campaigns');
  };

  // Build the CampaignInput and dispatch create/update. On create, go to the configure page; on edit, back
  // to the campaign. Slots are seeded on create and passed through untouched on edit.
  const onSubmit = async (values: FormValues) => {
    if (!admin) return toast.error('Not signed in');
    const input: CampaignInput = {
      name: values.name,
      description: isEdit && campaign ? campaign.description : '',
      slots: isEdit && campaign ? campaign.slots.map((s) => ({ ...s })) : defaultSlots(),
      maxSpinsPerUser: values.maxSpinsPerUser,
      spinCooldownHours: isEdit && campaign ? campaign.spinCooldownHours : 24,
      couponValidityDays: isEdit && campaign ? campaign.couponValidityDays : 3,
      isActive: values.isActive,
      startDate: values.startDate,
      endDate: values.endDate,
    };

    const res =
      isEdit && campaign
        ? await dispatch(
            updateCampaign({
              campaignId: campaign.id,
              input,
              previous: campaign,
              adminId: admin.id,
              adminName: admin.fullName,
            }),
          )
        : await dispatch(createCampaign({ input, adminId: admin.id, adminName: admin.fullName }));

    if (updateCampaign.fulfilled.match(res)) {
      toast.success('Campaign updated');
      navigate(`/spinner-campaigns/${campaign!.id}`);
    } else if (createCampaign.fulfilled.match(res)) {
      toast.success('Campaign created — configure the wheel offers');
      navigate(`/spinner-campaigns/${res.payload.id}`); // straight to configure
    } else {
      toast.error((res.payload as string) ?? 'Could not save campaign');
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="p-6">
      {/* Header — title + Cancel / Create & configure */}
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <button
            type="button"
            onClick={() => navigate('/spinner-campaigns')}
            className="mb-2 inline-flex items-center gap-1.5 text-[13px] font-semibold text-muted hover:text-foreground"
          >
            <Icon name="ArrowLeftLine" size={15} /> Spinner campaigns
          </button>
          <h1 className="text-[24px] font-extrabold tracking-tight text-foreground">
            {isEdit ? 'Edit campaign' : 'Create campaign'}
          </h1>
        </div>
        <div className="flex shrink-0 items-center gap-2.5">
          <button
            type="button"
            onClick={cancel}
            disabled={saving}
            className="rounded-md border border-border-strong px-4 py-2.5 text-[14px] font-semibold text-foreground hover:bg-subtle disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-[14px] font-semibold text-white hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving && <Icon name="Loader4Line" size={16} className="animate-spin" />}
            {isEdit ? 'Save settings' : 'Create & configure'}
          </button>
        </div>
      </div>

      {/* Settings card */}
      <div className="max-w-[640px]">
        <Card>
          <div className="flex flex-col gap-4">
            <Field label="Campaign name" error={errors.name?.message}>
              <input {...register('name')} placeholder="e.g. Eid Mega Spin" className={inputCls} />
            </Field>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Start date" error={errors.startDate?.message}>
                <DatePicker
                  selected={startDate}
                  onChange={(d) => d && setValue('startDate', d, { shouldDirty: true, shouldValidate: true })}
                  showTimeSelect
                  dateFormat="dd MMM yyyy, h:mm aa"
                  className={inputCls}
                  wrapperClassName="w-full"
                />
              </Field>
              <Field label="End date" error={errors.endDate?.message}>
                <DatePicker
                  selected={endDate}
                  onChange={(d) => d && setValue('endDate', d, { shouldDirty: true, shouldValidate: true })}
                  showTimeSelect
                  minDate={startDate}
                  dateFormat="dd MMM yyyy, h:mm aa"
                  className={inputCls}
                  wrapperClassName="w-full"
                />
              </Field>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Spins per user / day" error={errors.maxSpinsPerUser?.message}>
                <input type="number" min={1} {...register('maxSpinsPerUser')} className={inputCls} />
              </Field>
              <Field label="Eligibility">
                {/* Model currently supports all users only; kept as a select to mirror the design. */}
                <select className={inputCls} defaultValue="all" disabled>
                  <option value="all">All users</option>
                </select>
              </Field>
            </div>

            {/* Activate immediately */}
            <div className="flex items-center justify-between">
              <span className="text-[13px] font-semibold text-foreground">Activate immediately</span>
              <button
                type="button"
                onClick={() => setValue('isActive', !isActive, { shouldDirty: true })}
                aria-label="Toggle activate immediately"
                className={`relative h-6 w-11 shrink-0 rounded-pill transition-colors ${isActive ? 'bg-primary' : 'bg-border-strong'}`}
              >
                <span
                  className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-all ${isActive ? 'left-[22px]' : 'left-0.5'}`}
                />
              </button>
            </div>
          </div>
        </Card>

        {!isEdit && (
          <p className="mt-3 text-[12px] text-muted">
            You'll set up the wheel offers &amp; win probabilities on the next step.
          </p>
        )}
      </div>
    </form>
  );
};

export default CampaignForm;
