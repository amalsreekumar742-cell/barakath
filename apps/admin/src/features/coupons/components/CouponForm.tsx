import { type FC, type ReactNode, type FocusEvent, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { DiscountType, CouponApplicationType } from '@barakath/shared/config/enums';
import type { CouponProps } from '@barakath/shared/types';
import { useAppDispatch, useAppSelector } from '@/stores/store';
import Icon from '@/components/icons/Icon';
import { createCoupon } from '../api/createCoupon';
import { updateCoupon } from '../api/updateCoupon';
import { isCouponCodeTaken } from '../api/isCouponCodeTaken';
import { loadCouponProductsByIds } from '../api/searchCouponProducts';
import type { CouponInput } from '../types';
import CategoryMultiSelect from './CategoryMultiSelect';
import ProductMultiSelect, { type PickedProduct } from './ProductMultiSelect';

/**
 * Zod schema for the coupon form (spec §1.12 validation table). Cross-field rules live in superRefine:
 * the discountValue range depends on the discount type, maximumDiscount is required only for Percentage,
 * validUntil must be after validFrom, and category/product selections are required only for their
 * matching application type. WHY zod + react-hook-form: the standard forms stack in this app — declarative
 * validation kept next to the field, no hand-rolled checks scattered through the component.
 */
const schema = z
  .object({
    code: z
      .string()
      .trim()
      .min(3, 'At least 3 characters')
      .max(20, 'At most 20 characters')
      .regex(/^[A-Z0-9-]+$/, 'Only A–Z, 0–9 and hyphens'),
    description: z.string().trim().min(1, 'Description is required').max(200, 'At most 200 characters'),
    discountType: z.enum(['Percentage', 'Fixed']),
    discountValue: z.coerce.number({ invalid_type_error: 'Enter a number' }),
    minimumOrderAmount: z.coerce.number().min(0, 'Cannot be negative'),
    maximumDiscount: z.coerce.number().min(0, 'Cannot be negative'),
    usageLimit: z.coerce.number().int('Whole number').min(1, 'Minimum 1'),
    perUserLimit: z.coerce.number().int('Whole number').min(1, 'Minimum 1'),
    validFrom: z.date({ required_error: 'Start date is required', invalid_type_error: 'Start date is required' }),
    validUntil: z.date({ required_error: 'End date is required', invalid_type_error: 'End date is required' }),
    isActive: z.boolean(),
    applicationType: z.enum(['All', 'Category', 'Product']),
    applicableCategories: z.array(z.string()),
    applicableProducts: z.array(z.string()),
  })
  .superRefine((d, ctx) => {
    if (d.discountType === 'Percentage') {
      if (d.discountValue < 1 || d.discountValue > 100) {
        ctx.addIssue({ path: ['discountValue'], code: z.ZodIssueCode.custom, message: 'Enter 1–100%' });
      }
      if (!(d.maximumDiscount >= 1)) {
        ctx.addIssue({
          path: ['maximumDiscount'],
          code: z.ZodIssueCode.custom,
          message: 'Required for percentage (min ₹1)',
        });
      }
    } else if (d.discountValue < 1) {
      ctx.addIssue({ path: ['discountValue'], code: z.ZodIssueCode.custom, message: 'Minimum ₹1' });
    }
    if (d.validUntil <= d.validFrom) {
      ctx.addIssue({ path: ['validUntil'], code: z.ZodIssueCode.custom, message: 'Must be after the start date' });
    }
    if (d.applicationType === 'Category' && d.applicableCategories.length === 0) {
      ctx.addIssue({ path: ['applicableCategories'], code: z.ZodIssueCode.custom, message: 'Select at least one category' });
    }
    if (d.applicationType === 'Product' && d.applicableProducts.length === 0) {
      ctx.addIssue({ path: ['applicableProducts'], code: z.ZodIssueCode.custom, message: 'Select at least one product' });
    }
  });

type FormValues = z.infer<typeof schema>;

/** Generate a random 8-char A–Z0–9 coupon code (spec §1.12 "Generate" helper). */
function randomCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let out = '';
  for (let i = 0; i < 8; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

/**
 * CouponForm — the shared Create/Edit coupon form (spec §1.12). Both routes render this: Create passes no
 * `coupon` (empty defaults), Edit passes the loaded coupon so the fields hydrate and a read-only "Used"
 * count shows. The single form + schema avoids duplicating the ~7 sections across two pages.
 */
interface CouponFormProps {
  mode: 'create' | 'edit';
  coupon?: CouponProps;
}

const CouponForm: FC<CouponFormProps> = ({ mode, coupon }) => {
  const isEdit = mode === 'edit';
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const admin = useAppSelector((s) => s.currentAdmin.admin);
  const saving = useAppSelector((s) => (isEdit ? s.coupons.updateLoading : s.coupons.createLoading));

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    setError,
    clearErrors,
    formState: { errors, isDirty },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      code: '',
      description: '',
      discountType: DiscountType.PERCENTAGE,
      discountValue: 10,
      minimumOrderAmount: 0,
      maximumDiscount: 0,
      usageLimit: 100,
      perUserLimit: 1,
      validFrom: new Date(),
      validUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      isActive: true,
      applicationType: CouponApplicationType.ALL,
      applicableCategories: [],
      applicableProducts: [],
    },
  });

  const [codeChecking, setCodeChecking] = useState(false);
  // Chip labels for products already selected on the Edit page (names resolved asynchronously).
  const [initialProducts, setInitialProducts] = useState<PickedProduct[]>([]);
  const hydrated = useRef(false);

  // Hydrate the form from the loaded coupon on Edit (once).
  useEffect(() => {
    if (!isEdit || hydrated.current || !coupon) return;
    hydrated.current = true;
    setValue('code', coupon.code);
    setValue('description', coupon.description);
    setValue('discountType', coupon.discountType);
    setValue('discountValue', coupon.discountValue);
    setValue('minimumOrderAmount', coupon.minimumOrderAmount);
    setValue('maximumDiscount', coupon.maximumDiscount);
    setValue('usageLimit', coupon.usageLimit);
    setValue('perUserLimit', coupon.perUserLimit);
    setValue('validFrom', coupon.validFrom.toDate());
    setValue('validUntil', coupon.validUntil.toDate());
    setValue('isActive', coupon.isActive);
    setValue('applicationType', coupon.applicationType);
    setValue('applicableCategories', coupon.applicableCategories ?? []);
    setValue('applicableProducts', coupon.applicableProducts ?? []);
    // Resolve product names so the chips read nicely instead of raw ids.
    if (coupon.applicableProducts?.length) {
      void loadCouponProductsByIds(coupon.applicableProducts).then((ps) =>
        setInitialProducts(ps.map((p) => ({ id: p.id, name: p.name, thumbnail: p.thumbnail }))),
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coupon, isEdit]);

  const discountType = watch('discountType');
  const applicationType = watch('applicationType');
  const isActive = watch('isActive');
  const code = watch('code');
  const validFrom = watch('validFrom');
  const validUntil = watch('validUntil');
  const applicableCategories = watch('applicableCategories');
  const applicableProducts = watch('applicableProducts');
  const isPercentage = discountType === DiscountType.PERCENTAGE;

  // Uppercase-as-you-type: codes are stored uppercased and the regex only allows A–Z0–9-.
  const onCodeChange = (v: string) => {
    setValue('code', v.toUpperCase(), { shouldDirty: true, shouldValidate: false });
    clearErrors('code');
  };

  // Uniqueness feedback on blur — surfaces "already exists" inline before the admin submits.
  const onCodeBlur = async (e: FocusEvent<HTMLInputElement>) => {
    const value = e.target.value.trim().toUpperCase();
    if (value.length < 3) return;
    setCodeChecking(true);
    try {
      if (await isCouponCodeTaken(value, coupon?.id)) {
        setError('code', { message: 'Coupon code already exists' });
      }
    } finally {
      setCodeChecking(false);
    }
  };

  const cancel = () => {
    if (isDirty && !window.confirm('Discard unsaved changes?')) return;
    navigate('/coupons');
  };

  // Build the CouponInput and dispatch create/update. Fixed coupons carry no max-discount cap (0).
  const onSubmit = async (values: FormValues) => {
    if (!admin) return toast.error('Not signed in');
    const input: CouponInput = {
      code: values.code,
      description: values.description,
      discountType: values.discountType,
      discountValue: values.discountValue,
      minimumOrderAmount: values.minimumOrderAmount,
      maximumDiscount: values.discountType === 'Percentage' ? values.maximumDiscount : 0,
      usageLimit: values.usageLimit,
      perUserLimit: values.perUserLimit,
      validFrom: values.validFrom,
      validUntil: values.validUntil,
      isActive: values.isActive,
      applicationType: values.applicationType,
      applicableCategories: values.applicationType === 'Category' ? values.applicableCategories : [],
      applicableProducts: values.applicationType === 'Product' ? values.applicableProducts : [],
    };

    const res =
      isEdit && coupon
        ? await dispatch(
            updateCoupon({
              couponId: coupon.id,
              input,
              previous: coupon,
              adminId: admin.id,
              adminName: admin.fullName,
            }),
          )
        : await dispatch(createCoupon({ input, adminId: admin.id, adminName: admin.fullName }));

    if (createCoupon.fulfilled.match(res) || updateCoupon.fulfilled.match(res)) {
      toast.success(isEdit ? 'Coupon updated' : 'Coupon created');
      navigate('/coupons');
    } else {
      const msg = (res.payload as string) ?? 'Could not save coupon';
      if (msg === 'Coupon code already exists') setError('code', { message: msg });
      toast.error(msg);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="pb-24">
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-[22px] font-extrabold tracking-tight text-foreground">
            {isEdit ? 'Edit coupon' : 'Create coupon'}
          </h1>
          {isEdit && coupon && (
            <p className="mt-1 text-[13px] text-muted">
              Used: <span className="font-semibold text-foreground">{coupon.usedCount}</span> times
            </p>
          )}
        </div>

        <div className="max-w-3xl space-y-4">
          {/* Coupon code & description */}
          <Card title="Coupon code & description">
            <div className="grid gap-4">
              <Field label="Coupon code" error={errors.code?.message}>
                <div className="flex gap-2">
                  <input
                    value={code}
                    onChange={(e) => onCodeChange(e.target.value)}
                    onBlur={onCodeBlur}
                    placeholder="e.g. WELCOME20"
                    maxLength={20}
                    className={`${inputCls} font-mono uppercase tracking-wide`}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setValue('code', randomCode(), { shouldDirty: true });
                      clearErrors('code');
                    }}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-border-strong px-3.5 text-[13px] font-semibold text-primary hover:bg-primary-subtle"
                  >
                    <Icon name="SparklingLine" size={15} /> Generate
                  </button>
                </div>
                {codeChecking && <p className="mt-1 text-[12px] text-faint">Checking availability…</p>}
              </Field>
              <Field label="Description" error={errors.description?.message}>
                <textarea
                  {...register('description')}
                  rows={3}
                  maxLength={200}
                  placeholder="e.g. Flat 20% off for new customers on their first order"
                  className={`${inputCls} resize-y`}
                />
              </Field>
            </div>
          </Card>

          {/* Discount settings */}
          <Card title="Discount settings">
            <div className="grid gap-4">
              <Field label="Discount type">
                <div className="flex gap-2">
                  <Radio
                    label="Percentage"
                    checked={isPercentage}
                    onClick={() => setValue('discountType', DiscountType.PERCENTAGE, { shouldDirty: true, shouldValidate: true })}
                  />
                  <Radio
                    label="Fixed amount"
                    checked={!isPercentage}
                    onClick={() => setValue('discountType', DiscountType.FIXED, { shouldDirty: true, shouldValidate: true })}
                  />
                </div>
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label={isPercentage ? 'Discount value (%)' : 'Discount value (₹)'}
                  error={errors.discountValue?.message}
                >
                  <div className="relative">
                    <input
                      type="number"
                      step={isPercentage ? '1' : '0.01'}
                      {...register('discountValue')}
                      className={`${inputCls} pr-9`}
                    />
                    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[13px] font-semibold text-faint">
                      {isPercentage ? '%' : '₹'}
                    </span>
                  </div>
                </Field>
                <Field label="Minimum order amount (₹)" error={errors.minimumOrderAmount?.message}>
                  <input type="number" step="0.01" {...register('minimumOrderAmount')} className={inputCls} />
                </Field>
                {isPercentage && (
                  <Field label="Maximum discount (₹)" error={errors.maximumDiscount?.message}>
                    <input type="number" step="0.01" {...register('maximumDiscount')} className={inputCls} />
                  </Field>
                )}
              </div>
            </div>
          </Card>

          {/* Usage limits */}
          <Card title="Usage limits">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Total usage limit" error={errors.usageLimit?.message}>
                <input type="number" {...register('usageLimit')} className={inputCls} />
              </Field>
              <Field label="Per-user limit" error={errors.perUserLimit?.message}>
                <input type="number" {...register('perUserLimit')} className={inputCls} />
              </Field>
            </div>
          </Card>

          {/* Validity period */}
          <Card title="Validity period">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Valid from" error={errors.validFrom?.message}>
                <DatePicker
                  selected={validFrom}
                  onChange={(d) => d && setValue('validFrom', d, { shouldDirty: true, shouldValidate: true })}
                  showTimeSelect
                  dateFormat="dd MMM yyyy, h:mm aa"
                  className={inputCls}
                  wrapperClassName="w-full"
                />
              </Field>
              <Field label="Valid until" error={errors.validUntil?.message}>
                <DatePicker
                  selected={validUntil}
                  onChange={(d) => d && setValue('validUntil', d, { shouldDirty: true, shouldValidate: true })}
                  showTimeSelect
                  minDate={validFrom}
                  dateFormat="dd MMM yyyy, h:mm aa"
                  className={inputCls}
                  wrapperClassName="w-full"
                />
              </Field>
            </div>
          </Card>

          {/* Applicability */}
          <Card title="Applicability">
            <div className="grid gap-4">
              <Field label="Applies to">
                <div className="flex flex-wrap gap-2">
                  <Radio
                    label="All products"
                    checked={applicationType === CouponApplicationType.ALL}
                    onClick={() => setValue('applicationType', CouponApplicationType.ALL, { shouldDirty: true, shouldValidate: true })}
                  />
                  <Radio
                    label="Specific categories"
                    checked={applicationType === CouponApplicationType.CATEGORY}
                    onClick={() => setValue('applicationType', CouponApplicationType.CATEGORY, { shouldDirty: true, shouldValidate: true })}
                  />
                  <Radio
                    label="Specific products"
                    checked={applicationType === CouponApplicationType.PRODUCT}
                    onClick={() => setValue('applicationType', CouponApplicationType.PRODUCT, { shouldDirty: true, shouldValidate: true })}
                  />
                </div>
              </Field>

              {applicationType === CouponApplicationType.CATEGORY && (
                <Field label="Categories" error={errors.applicableCategories?.message as string | undefined}>
                  <CategoryMultiSelect
                    value={applicableCategories}
                    onChange={(ids) => setValue('applicableCategories', ids, { shouldDirty: true, shouldValidate: true })}
                  />
                </Field>
              )}

              {applicationType === CouponApplicationType.PRODUCT && (
                <Field label="Products" error={errors.applicableProducts?.message as string | undefined}>
                  <ProductMultiSelect
                    value={applicableProducts}
                    onChange={(ids) => setValue('applicableProducts', ids, { shouldDirty: true, shouldValidate: true })}
                    initialItems={initialProducts}
                  />
                </Field>
              )}
            </div>
          </Card>

          {/* Status */}
          <Card title="Status">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setValue('isActive', !isActive, { shouldDirty: true })}
                className="flex items-center gap-2.5"
              >
                <span
                  className={`relative h-6 w-11 shrink-0 rounded-pill transition-colors ${isActive ? 'bg-primary' : 'bg-border-strong'}`}
                >
                  <span
                    className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-all ${isActive ? 'left-[22px]' : 'left-0.5'}`}
                  />
                </span>
                <span className="text-[14px] font-medium text-foreground">
                  {isActive ? 'Active' : 'Inactive'}
                </span>
              </button>
            </div>
          </Card>
        </div>
      </div>

      {/* Sticky action bar */}
      <div className="fixed bottom-0 left-[236px] right-0 flex items-center justify-end gap-2.5 border-t border-border bg-surface/95 px-6 py-3 backdrop-blur">
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
          {isEdit ? 'Update coupon' : 'Create coupon'}
        </button>
      </div>
    </form>
  );
};

const inputCls =
  'w-full rounded-md border border-border-strong bg-surface px-3 py-2.5 text-[14px] outline-none placeholder:text-faint focus:border-primary focus:ring-2 focus:ring-primary/20';

const Card: FC<{ title: string; children: ReactNode }> = ({ title, children }) => (
  <div className="rounded-xl border border-border bg-surface p-5 shadow-sm">
    <h2 className="mb-4 text-[15px] font-bold text-foreground">{title}</h2>
    {children}
  </div>
);

const Field: FC<{ label: string; error?: string; children: ReactNode }> = ({ label, error, children }) => (
  <div>
    <label className="mb-1.5 block text-[13px] font-semibold text-foreground">{label}</label>
    {children}
    {error && <p className="mt-1 text-[12px] text-error">{error}</p>}
  </div>
);

/** A segmented radio button (used for discount type and applicability). */
const Radio: FC<{ label: string; checked: boolean; onClick: () => void }> = ({ label, checked, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className={`inline-flex items-center gap-2 rounded-md border px-3.5 py-2 text-[13px] font-semibold transition-colors ${
      checked
        ? 'border-primary bg-primary-subtle text-primary'
        : 'border-border-strong bg-surface text-muted hover:text-foreground'
    }`}
  >
    <span
      className={`flex h-4 w-4 items-center justify-center rounded-full border ${
        checked ? 'border-primary' : 'border-border-strong'
      }`}
    >
      {checked && <span className="h-2 w-2 rounded-full bg-primary" />}
    </span>
    {label}
  </button>
);

export default CouponForm;
