import { type FC, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Skeleton from 'react-loading-skeleton';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import type { SpinnerCampaignProps } from '@barakath/shared/types';
import { useAppDispatch, useAppSelector } from '@/stores/store';
import Icon from '@/components/icons/Icon';
import ConfirmDialog from '@/components/ConfirmDialog';
import { formatShortDate } from '@/utils/format';
import { fetchCampaignDetail } from '../api/fetchCampaignDetail';
import { fetchCampaignSpinHistory } from '../api/fetchCampaignSpinHistory';
import { toggleCampaignActive } from '../api/toggleCampaignActive';
import { updateCampaign } from '../api/updateCampaign';
import { resetCampaignDetail } from '../stores/spinnerCampaignsSlice';
import type { CampaignInput, SlotInput } from '../types';
import { probabilitySum } from '../utils/slots';
import { campaignStatus, TypeBadge } from './ui';
import SpinnerWheel from './SpinnerWheel';

const MIN_SLOTS = 2;
const MAX_SLOTS = 8;

/** Wedge colours cycled as new offers are added. */
const SLOT_COLORS = ['#f59e0b', '#ef4444', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];

/**
 * Zod schema for one wheel offer (spec F13). A Coupon offer needs a code + a valid discount (a percentage
 * offer also needs a max cap); a Better-luck offer carries no discount. Probability is the offer's share of
 * the 100% wheel and is validated to sum to exactly 100 at the form level.
 */
const offerSchema = z
  .object({
    id: z.string(),
    label: z.string().trim().min(1, 'Reward text is required').max(40, 'At most 40 characters'),
    type: z.enum(['Coupon', 'Better luck']),
    couponCode: z.string(),
    couponId: z.string(),
    discountType: z.enum(['Percentage', 'Fixed']),
    discountValue: z.coerce.number({ invalid_type_error: 'Enter a number' }),
    minimumOrderAmount: z.coerce.number().min(0, 'Cannot be negative'),
    maximumDiscount: z.coerce.number().min(0, 'Cannot be negative'),
    probability: z.coerce.number({ invalid_type_error: 'Enter a number' }).min(0, 'Min 0').max(100, 'Max 100'),
    color: z.string(),
  })
  .superRefine((s, ctx) => {
    if (s.type !== 'Coupon') return;
    if (!s.couponCode.trim()) {
      ctx.addIssue({ path: ['couponCode'], code: z.ZodIssueCode.custom, message: 'Coupon code required' });
    }
    if (s.discountType === 'Percentage') {
      if (s.discountValue < 1 || s.discountValue > 100) {
        ctx.addIssue({ path: ['discountValue'], code: z.ZodIssueCode.custom, message: '1–100%' });
      }
      if (!(s.maximumDiscount >= 1)) {
        ctx.addIssue({ path: ['maximumDiscount'], code: z.ZodIssueCode.custom, message: 'Required' });
      }
    } else if (s.discountValue < 1) {
      ctx.addIssue({ path: ['discountValue'], code: z.ZodIssueCode.custom, message: 'Min ₹1' });
    }
  });

const schema = z
  .object({
    slots: z.array(offerSchema).min(MIN_SLOTS, `At least ${MIN_SLOTS} offers`).max(MAX_SLOTS, `At most ${MAX_SLOTS} offers`),
  })
  .superRefine((d, ctx) => {
    if (probabilitySum(d.slots) !== 100) {
      ctx.addIssue({ path: ['slots'], code: z.ZodIssueCode.custom, message: 'Win chances must sum to exactly 100%' });
    }
  });

type FormValues = z.infer<typeof schema>;

/**
 * CampaignDetailPage — route /spinner-campaigns/:id (spec F13). This is the campaign's CONFIGURE screen
 * (reached from "Create & configure"): the wheel preview on the left and the editable Wheel offers on the
 * right, with Pause/Resume + Save in the header and the paginated spin history below. Loads the detail +
 * first history page on mount and clears them on unmount so a different campaign never shows stale data.
 */
const CampaignDetailPage: FC = () => {
  const { id = '' } = useParams();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { campaignDetail, detailLoading, detailError } = useAppSelector((s) => s.spinnerCampaigns);

  useEffect(() => {
    void dispatch(fetchCampaignDetail(id));
    void dispatch(fetchCampaignSpinHistory({ campaignId: id, cursor: null }));
    return () => {
      dispatch(resetCampaignDetail());
    };
  }, [dispatch, id]);

  if (detailLoading || (!campaignDetail && !detailError)) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton height={40} width={280} borderRadius={8} />
        <div className="grid gap-5 lg:grid-cols-[340px_minmax(0,1fr)]">
          <Skeleton height={340} borderRadius={12} />
          <Skeleton height={340} borderRadius={12} />
        </div>
      </div>
    );
  }

  if (detailError || !campaignDetail) {
    return (
      <div className="p-6">
        <div className="rounded-xl border border-border bg-surface p-10 text-center">
          <p className="text-[14px] text-muted">{detailError ?? 'Campaign not found'}</p>
          <button
            type="button"
            onClick={() => navigate('/spinner-campaigns')}
            className="mt-3 rounded-md bg-primary px-4 py-2 text-[14px] font-semibold text-white hover:bg-primary-dark"
          >
            Back to campaigns
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Keyed on id so the editable form re-hydrates cleanly when navigating between campaigns. */}
      <ConfigureForm key={campaignDetail.id} campaign={campaignDetail} />
      <SpinHistorySection campaignId={campaignDetail.id} />
    </div>
  );
};

/**
 * ConfigureForm — the wheel-preview + editable Wheel-offers editor (spec F13). Holds the offers in a
 * react-hook-form field array hydrated from the campaign; the left preview re-renders live from the watched
 * offers. Save persists via updateCampaign (settings passed through untouched); Pause/Resume flips active.
 */
const ConfigureForm: FC<{ campaign: SpinnerCampaignProps }> = ({ campaign }) => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const admin = useAppSelector((s) => s.currentAdmin.admin);
  const saving = useAppSelector((s) => s.spinnerCampaigns.updateLoading);
  const toggling = useAppSelector((s) => s.spinnerCampaigns.toggleLoading) === campaign.id;
  const [confirmToggle, setConfirmToggle] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { slots: campaign.slots.map((s) => ({ ...s })) },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'slots' });
  const watchedSlots = watch('slots');

  const total = useMemo(
    () => probabilitySum((watchedSlots ?? []).map((s) => ({ probability: Number(s.probability) }))),
    [watchedSlots],
  );
  const wheelSlots = useMemo(
    () =>
      (watchedSlots ?? []).map((s) => ({
        label: s.label || '',
        probability: Number(s.probability) || 0,
        color: s.color || '#e5e7eb',
      })),
    [watchedSlots],
  );

  const status = campaignStatus(campaign);
  const winRate = campaign.totalSpins > 0 ? Math.round((campaign.totalWins / campaign.totalSpins) * 100) : 0;

  const addOffer = () => {
    append({
      id: `slot_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      label: '',
      type: 'Coupon',
      couponCode: '',
      couponId: '',
      discountType: 'Percentage',
      discountValue: 10,
      minimumOrderAmount: 0,
      maximumDiscount: 100,
      probability: 0,
      color: SLOT_COLORS[fields.length % SLOT_COLORS.length]!,
    } satisfies SlotInput);
  };

  const onToggle = async () => {
    const next = !campaign.isActive;
    const res = await dispatch(toggleCampaignActive({ campaignId: campaign.id, isActive: next }));
    setConfirmToggle(false);
    if (toggleCampaignActive.fulfilled.match(res)) toast.success(next ? 'Campaign resumed' : 'Campaign paused');
    else toast.error((res.payload as string) ?? 'Could not update campaign');
  };

  const onSave = async (values: FormValues) => {
    if (!admin) return toast.error('Not signed in');
    const input: CampaignInput = {
      name: campaign.name,
      description: campaign.description,
      slots: values.slots,
      maxSpinsPerUser: campaign.maxSpinsPerUser,
      spinCooldownHours: campaign.spinCooldownHours,
      couponValidityDays: campaign.couponValidityDays,
      isActive: campaign.isActive,
      startDate: campaign.startDate.toDate(),
      endDate: campaign.endDate.toDate(),
    };
    const res = await dispatch(
      updateCampaign({ campaignId: campaign.id, input, previous: campaign, adminId: admin.id, adminName: admin.fullName }),
    );
    if (updateCampaign.fulfilled.match(res)) toast.success('Wheel offers saved');
    else toast.error((res.payload as string) ?? 'Could not save offers');
  };

  return (
    <form onSubmit={handleSubmit(onSave)}>
      {/* Header */}
      <div className="mb-5">
        <button
          type="button"
          onClick={() => navigate('/spinner-campaigns')}
          className="mb-2 inline-flex items-center gap-1.5 text-[13px] font-semibold text-muted hover:text-foreground"
        >
          <Icon name="ArrowLeftLine" size={15} /> Spinner campaigns
        </button>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <h1 className="text-[24px] font-extrabold tracking-tight text-foreground">{campaign.name}</h1>
            <span className={`inline-flex rounded-pill px-3 py-1 text-[12px] font-bold ${status.cls}`}>{status.label}</span>
          </div>
          <div className="flex shrink-0 items-center gap-2.5">
            <button
              type="button"
              onClick={() => navigate(`/spinner-campaigns/create?edit=${campaign.id}`)}
              className="inline-flex items-center gap-1.5 rounded-md border border-border-strong px-4 py-2.5 text-[14px] font-semibold text-foreground hover:bg-subtle"
            >
              <Icon name="Settings1Line" size={16} /> Settings
            </button>
            <button
              type="button"
              onClick={() => setConfirmToggle(true)}
              disabled={toggling}
              className="inline-flex items-center gap-1.5 rounded-md border border-border-strong px-4 py-2.5 text-[14px] font-semibold text-foreground hover:bg-subtle disabled:opacity-50"
            >
              {toggling ? <Icon name="Loader4Line" size={16} className="animate-spin" /> : null}
              {campaign.isActive ? 'Pause' : 'Resume'}
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-[14px] font-semibold text-white hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving && <Icon name="Loader4Line" size={16} className="animate-spin" />}
              Save
            </button>
          </div>
        </div>
        <p className="mt-2 text-[13px] text-muted">
          {formatShortDate(campaign.startDate)} – {formatShortDate(campaign.endDate)} · {campaign.maxSpinsPerUser} spin
          {campaign.maxSpinsPerUser === 1 ? '' : 's'} / user / day
        </p>
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-[340px_minmax(0,1fr)]">
        {/* Wheel preview */}
        <div className="rounded-xl border border-border bg-surface p-5 shadow-sm lg:sticky lg:top-6">
          <h2 className="mb-4 text-[14px] font-bold text-foreground">Wheel preview</h2>
          <div className="flex justify-center">
            <SpinnerWheel slots={wheelSlots} size={240} />
          </div>
          <div className="mt-4 text-center">
            <p className="text-[11px] font-medium text-faint">Total plays</p>
            <p className="mt-1.5 text-[24px] font-extrabold tabular-nums text-foreground">
              {campaign.totalSpins.toLocaleString('en-IN')}
            </p>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 border-t border-border pt-4 text-center">
            <div>
              <p className="text-[11px] font-medium text-faint">Wins</p>
              <p className="mt-1 text-[15px] font-bold tabular-nums text-foreground">
                {campaign.totalWins.toLocaleString('en-IN')}
              </p>
            </div>
            <div>
              <p className="text-[11px] font-medium text-faint">Win rate</p>
              <p className="mt-1 text-[15px] font-bold tabular-nums text-foreground">{winRate}%</p>
            </div>
          </div>
          {/* Running probability total (must be 100 to save). */}
          <div className="mt-4 flex items-center justify-center">
            <span
              className={`rounded-pill px-3 py-1 text-[12px] font-bold ${
                total === 100 ? 'bg-success-subtle text-success' : 'bg-error-subtle text-error'
              }`}
            >
              {total === 100 ? '✓ Chances total 100%' : `✗ Chances total ${total}%`}
            </span>
          </div>
        </div>

        {/* Wheel offers editor */}
        <div className="rounded-xl border border-border bg-surface p-5 shadow-sm">
          <div className="mb-2 flex items-center justify-between gap-3">
            <h2 className="text-[14px] font-bold text-foreground">Wheel offers</h2>
            <button
              type="button"
              onClick={addOffer}
              disabled={fields.length >= MAX_SLOTS}
              className="inline-flex items-center gap-1.5 text-[13px] font-bold text-primary hover:text-primary-dark disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Icon name="AddLine" size={15} /> Add offer
            </button>
          </div>
          <p className="mb-4 text-[11px] leading-relaxed text-muted">
            Choose a type (₹ fixed / % percentage / == no-win) then enter the reward text. "Chance" is the
            offer's share of the wheel — all chances must add up to 100%.
          </p>

          {typeof errors.slots?.message === 'string' && (
            <p className="mb-3 text-[12px] font-semibold text-error">{errors.slots.message}</p>
          )}

          <div>
            {fields.map((f, i) => (
              <OfferRow
                key={f.id}
                index={i}
                register={register}
                watch={watch}
                setValue={setValue}
                errors={errors}
                total={total}
                canRemove={fields.length > MIN_SLOTS}
                onRemove={() => remove(i)}
              />
            ))}
          </div>
        </div>
      </div>

      <ConfirmDialog
        isOpen={confirmToggle}
        title={campaign.isActive ? 'Pause campaign?' : 'Resume campaign?'}
        message={
          campaign.isActive
            ? `Customers will no longer see the "${campaign.name}" wheel.`
            : `"${campaign.name}" will become spinnable by customers.`
        }
        confirmLabel={campaign.isActive ? 'Pause' : 'Resume'}
        confirmVariant={campaign.isActive ? 'danger' : 'primary'}
        loading={toggling}
        onConfirm={onToggle}
        onCancel={() => setConfirmToggle(false)}
      />
    </form>
  );
};

/* react-hook-form helpers kept local (avoids exporting the FormValues shape). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- RHF register/watch/setValue are generic over the form
type RHF = any;

/**
 * OfferRow — one editable wheel offer laid out like the prototype: a ₹/%/== type selector, the reward text,
 * and a "Chance" bar (the probability, editable), with a delete ✕. Coupon offers reveal the code + discount
 * fields the data model needs (the prototype's single reward-text line can't hold them). WHY the extra
 * fields: the wheel writes real coupons, so a code + value are required — the bar visualises the chance.
 */
const OfferRow: FC<{
  index: number;
  register: RHF;
  watch: RHF;
  setValue: RHF;
  errors: RHF;
  total: number;
  canRemove: boolean;
  onRemove: () => void;
}> = ({ index, register, watch, setValue, errors, total, canRemove, onRemove }) => {
  const base = `slots.${index}` as const;
  const type = watch(`${base}.type`) as 'Coupon' | 'Better luck';
  const discountType = watch(`${base}.discountType`) as 'Percentage' | 'Fixed';
  const color = watch(`${base}.color`) as string;
  const probability = Number(watch(`${base}.probability`)) || 0;
  const isCoupon = type === 'Coupon';
  const isPercentage = discountType === 'Percentage';
  const err = errors?.slots?.[index] ?? {};

  // Which of the three type chips is active.
  const active: '₹' | '%' | '==' = !isCoupon ? '==' : isPercentage ? '%' : '₹';
  const setType = (t: '₹' | '%' | '==') => {
    if (t === '==') setValue(`${base}.type`, 'Better luck', { shouldDirty: true, shouldValidate: true });
    else {
      setValue(`${base}.type`, 'Coupon', { shouldDirty: true, shouldValidate: true });
      setValue(`${base}.discountType`, t === '%' ? 'Percentage' : 'Fixed', { shouldDirty: true, shouldValidate: true });
    }
  };

  const cellCls =
    'w-full rounded-md border border-border-strong bg-surface px-2.5 py-2 text-[13px] outline-none focus:border-primary';
  // Share of the wheel for the bar — relative to the running total so it reads sensibly mid-edit.
  const share = total > 0 ? Math.min(100, Math.round((probability / total) * 100)) : 0;

  return (
    <div className="flex items-start gap-3 border-b border-border py-3 last:border-0">
      {/* Type selector */}
      <div className="flex shrink-0 gap-1.5 pt-0.5">
        {(['₹', '%', '=='] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setType(t)}
            aria-label={t === '₹' ? 'Fixed discount' : t === '%' ? 'Percentage discount' : 'No-win'}
            className={`inline-flex h-[34px] w-[34px] items-center justify-center rounded-md border text-[13px] font-extrabold transition-colors ${
              active === t
                ? 'border-primary bg-primary text-white'
                : 'border-border-strong bg-surface text-muted hover:text-foreground'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Reward text + coupon detail */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span
            className="h-4 w-4 shrink-0 rounded-full border border-border-strong"
            style={{ backgroundColor: color || '#e5e7eb' }}
          />
          <input {...register(`${base}.color`)} type="color" className="sr-only" aria-label="Offer colour" />
          <input {...register(`${base}.label`)} placeholder="Reward text · e.g. ₹10 off · min ₹99" className={cellCls} />
        </div>
        {err.label?.message && <p className="mt-1 text-[11px] text-error">{err.label.message}</p>}

        {isCoupon && (
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div>
              <input
                {...register(`${base}.couponCode`)}
                placeholder="CODE"
                className={`${cellCls} font-mono uppercase`}
              />
              {err.couponCode?.message && <p className="mt-1 text-[11px] text-error">{err.couponCode.message}</p>}
            </div>
            <div>
              <input
                type="number"
                step="0.01"
                {...register(`${base}.discountValue`)}
                placeholder={isPercentage ? 'Value %' : 'Value ₹'}
                className={cellCls}
              />
              {err.discountValue?.message && <p className="mt-1 text-[11px] text-error">{err.discountValue.message}</p>}
            </div>
            <div>
              <input
                type="number"
                step="0.01"
                {...register(`${base}.minimumOrderAmount`)}
                placeholder="Min order ₹"
                className={cellCls}
              />
            </div>
            {isPercentage && (
              <div>
                <input
                  type="number"
                  step="0.01"
                  {...register(`${base}.maximumDiscount`)}
                  placeholder="Max ₹"
                  className={cellCls}
                />
                {err.maximumDiscount?.message && (
                  <p className="mt-1 text-[11px] text-error">{err.maximumDiscount.message}</p>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Chance (probability) + bar */}
      <div className="w-[130px] shrink-0">
        <div className="mb-1 flex items-center justify-between gap-2">
          <span className="text-[11px] font-semibold text-muted">Chance</span>
          <div className="flex items-center gap-0.5">
            <input
              type="number"
              step="0.01"
              {...register(`${base}.probability`)}
              className="w-14 rounded-md border border-border-strong bg-surface px-1.5 py-1 text-right text-[12px] font-bold tabular-nums outline-none focus:border-primary"
            />
            <span className="text-[12px] font-bold text-foreground">%</span>
          </div>
        </div>
        <div className="h-1.5 overflow-hidden rounded-pill bg-subtle">
          <div className="h-full rounded-pill bg-primary" style={{ width: `${share}%` }} />
        </div>
        {err.probability?.message && <p className="mt-1 text-[11px] text-error">{err.probability.message}</p>}
      </div>

      {/* Remove */}
      <button
        type="button"
        onClick={onRemove}
        disabled={!canRemove}
        aria-label="Remove offer"
        className="mt-0.5 shrink-0 rounded-md p-1.5 text-muted hover:bg-error-subtle hover:text-error disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Icon name="CloseLine" size={16} />
      </button>
    </div>
  );
};

/**
 * SpinHistorySection — the campaign's paginated spin log (spec F13). Reads the history sub-list from the
 * slice (loaded by the parent on mount): User / Phone / Result / Type / Coupon Code / Date, with a bottom
 * skeleton on load-more, a "View More" while more pages remain, and an empty state.
 */
const SpinHistorySection: FC<{ campaignId: string }> = ({ campaignId }) => {
  const dispatch = useAppDispatch();
  const { spinHistory, historyHasMore, historyLoading, historyLoadingMore, historyLastVisible } =
    useAppSelector((s) => s.spinnerCampaigns);

  return (
    <div className="mt-5 overflow-x-auto rounded-xl border border-border bg-surface shadow-sm">
      <div className="border-b border-border p-5">
        <h2 className="text-[14px] font-bold text-foreground">Spin history</h2>
      </div>

      {historyLoading ? (
        <div className="space-y-2 p-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} height={40} borderRadius={8} />
          ))}
        </div>
      ) : spinHistory.length === 0 ? (
        <p className="p-10 text-center text-[14px] text-muted">No spins yet</p>
      ) : (
        <>
          <table className="w-full min-w-[720px]">
            <thead className="border-b border-border bg-subtle/50">
              <tr>
                {['User', 'Phone', 'Result', 'Type', 'Coupon Code', 'Date'].map((h) => (
                  <th key={h} className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-faint">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {spinHistory.map((h) => (
                <tr key={h.id} className="border-b border-border last:border-0 hover:bg-subtle/40">
                  <td className="px-4 py-3 text-[13px] font-medium text-foreground">{h.userName || '—'}</td>
                  <td className="px-4 py-3 text-[13px] text-muted">{h.userPhone || '—'}</td>
                  <td className="px-4 py-3 text-[13px] text-foreground">{h.slotLabel}</td>
                  <td className="px-4 py-3">
                    <TypeBadge type={h.resultType} />
                  </td>
                  <td className="px-4 py-3">
                    {h.couponCode ? (
                      <span className="font-mono text-[12px] font-semibold text-foreground">{h.couponCode}</span>
                    ) : (
                      <span className="text-[13px] text-faint">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-[13px] text-muted">
                    {h.createdAt ? format(h.createdAt.toDate(), 'dd MMM yyyy, h:mm aa') : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {historyLoadingMore && (
            <div className="p-3">
              <Skeleton height={40} borderRadius={8} />
            </div>
          )}
          {historyHasMore && !historyLoadingMore && (
            <div className="flex justify-center border-t border-border p-3">
              <button
                type="button"
                onClick={() => dispatch(fetchCampaignSpinHistory({ campaignId, cursor: historyLastVisible }))}
                className="rounded-md border border-border-strong px-4 py-2 text-[14px] font-semibold text-foreground hover:bg-subtle"
              >
                View More
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default CampaignDetailPage;
