import { type FC, type ReactNode, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import type { ProductProps } from '@barakath/shared/types';
import { useAppDispatch, useAppSelector } from '@/stores/store';
import Icon from '@/components/icons/Icon';
import { formatINR } from '@/utils/format';
import { createFlashSale } from '../api/createFlashSale';
import { searchFlashSaleProducts, fetchProductVariants } from '../api/searchFlashSaleProducts';
import type { FlashSaleInput, FlashSaleProductInput, FlashSalePriceInput } from '../types';

/**
 * Zod schema for the flash-sale settings (spec §1.16C validation). Cross-field rules in superRefine:
 * endDate after startDate, and a percentage discount must be 1–99. Product selection is validated
 * separately (it lives in component state), see onSubmit.
 */
const schema = z
  .object({
    name: z.string().trim().min(3, 'At least 3 characters'),
    discountType: z.enum(['Percentage', 'Fixed']),
    discountValue: z.coerce.number({ invalid_type_error: 'Enter a value' }).positive('Enter a value'),
    startDate: z.date({ required_error: 'Start date is required', invalid_type_error: 'Start date is required' }),
    endDate: z.date({ required_error: 'End date is required', invalid_type_error: 'End date is required' }),
  })
  .superRefine((d, ctx) => {
    if (d.endDate <= d.startDate) {
      ctx.addIssue({ path: ['endDate'], code: z.ZodIssueCode.custom, message: 'Must be after the start date' });
    }
    if (d.discountType === 'Percentage' && (d.discountValue < 1 || d.discountValue > 99)) {
      ctx.addIssue({ path: ['discountValue'], code: z.ZodIssueCode.custom, message: 'Enter 1–99%' });
    }
  });

type FormValues = z.infer<typeof schema>;

/** Compute one variant's flash price from the sale discount, clamped so it never exceeds the offer price. */
function flashPriceFor(offerPrice: number, type: 'Percentage' | 'Fixed', value: number): number {
  if (type === 'Percentage') return Math.max(1, Math.round(offerPrice * (1 - value / 100)));
  return Math.min(value, offerPrice); // Fixed = flat sale price
}

/**
 * CreateFlashSalePage — route /flash-sale/create (spec §1.16, prototype "Flash Sale › Add"). Two columns:
 * a multi-select product list on the left and the sale settings on the right (name, discount type + value,
 * window, activate). One discount is applied to every selected product; the form snapshots the resulting
 * per-variant flash prices on submit. Create-only (no edit after creation).
 */
const CreateFlashSalePage: FC = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const admin = useAppSelector((s) => s.currentAdmin.admin);
  const saving = useAppSelector((s) => s.flashSale.createLoading);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isDirty },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '',
      discountType: 'Percentage',
      discountValue: 20,
      startDate: new Date(),
      endDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
  });

  // Product search + multi-selection (kept outside RHF — fetched dynamically).
  const [term, setTerm] = useState('');
  const [items, setItems] = useState<ProductProps[]>([]);
  const [cursor, setCursor] = useState<QueryCursor>(null);
  const [hasMore, setHasMore] = useState(false);
  const [listLoading, setListLoading] = useState(false);
  const [selected, setSelected] = useState<Record<string, ProductProps>>({});
  const [productError, setProductError] = useState<string | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [isActive, setIsActive] = useState(true);

  const discountType = watch('discountType');
  const startDate = watch('startDate');
  const endDate = watch('endDate');
  const selectedCount = Object.keys(selected).length;

  // Debounced product search (300ms).
  useEffect(() => {
    setListLoading(true);
    const t = setTimeout(async () => {
      try {
        const page = await searchFlashSaleProducts(term, null);
        setItems(page.items);
        setCursor(page.lastVisible);
        setHasMore(page.hasMore);
      } catch {
        setItems([]);
      } finally {
        setListLoading(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [term]);

  const loadMore = async () => {
    const page = await searchFlashSaleProducts(term, cursor);
    setItems((prev) => [...prev, ...page.items]);
    setCursor(page.lastVisible);
    setHasMore(page.hasMore);
  };

  const toggleProduct = (p: ProductProps) => {
    setProductError(null);
    setSelected((prev) => {
      const next = { ...prev };
      if (next[p.id]) delete next[p.id];
      else next[p.id] = p;
      return next;
    });
  };

  const cancel = () => {
    if ((isDirty || selectedCount > 0) && !window.confirm('Discard unsaved changes?')) return;
    navigate('/flash-sale');
  };

  const onSubmit = async (values: FormValues) => {
    if (!admin) return toast.error('Not signed in');
    const chosen = Object.values(selected);
    if (chosen.length === 0) {
      setProductError('Select at least one product');
      return;
    }

    // Snapshot each selected product's variants with the computed flash price.
    setPreparing(true);
    let products: FlashSaleProductInput[];
    try {
      products = await Promise.all(
        chosen.map(async (p) => {
          const variants = await fetchProductVariants(p.id);
          const variantPrices: FlashSalePriceInput[] = variants.map((v) => ({
            variantId: v.id,
            variantName: v.name,
            originalMrp: v.mrp,
            originalOfferPrice: v.offerPrice,
            flashSalePrice: flashPriceFor(v.offerPrice, values.discountType, values.discountValue),
          }));
          return {
            productId: p.id,
            productName: p.name,
            productImage: p.thumbnail || p.images?.[0] || '',
            categoryName: p.categoryName,
            variantPrices,
          };
        }),
      );
    } catch {
      setPreparing(false);
      return toast.error('Could not load product variants');
    }
    setPreparing(false);

    const input: FlashSaleInput = {
      name: values.name,
      description: '',
      discountType: values.discountType,
      discountValue: values.discountValue,
      products,
      startDate: values.startDate,
      endDate: values.endDate,
      isActive,
    };

    const res = await dispatch(createFlashSale({ input, adminId: admin.id, adminName: admin.fullName }));
    if (createFlashSale.fulfilled.match(res)) {
      toast.success('Flash sale created');
      navigate('/flash-sale');
    } else {
      const msg = (res.payload as string) ?? 'Could not create flash sale';
      if (msg.includes('active flash sale')) setProductError(msg);
      toast.error(msg);
    }
  };

  const busy = saving || preparing;

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="p-6">
      {/* Header */}
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <button
            type="button"
            onClick={() => navigate('/flash-sale')}
            className="mb-2 inline-flex items-center gap-1.5 text-[13px] font-semibold text-muted hover:text-foreground"
          >
            <Icon name="ArrowLeftLine" size={15} /> Flash Sale
          </button>
          <h1 className="text-[24px] font-extrabold tracking-tight text-foreground">Add flash sale</h1>
        </div>
        <div className="flex shrink-0 items-center gap-2.5">
          <button
            type="button"
            onClick={cancel}
            disabled={busy}
            className="rounded-md border border-border-strong px-4 py-2.5 text-[14px] font-semibold text-foreground hover:bg-subtle disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-[14px] font-semibold text-white hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy && <Icon name="Loader4Line" size={16} className="animate-spin" />}
            Create flash sale
          </button>
        </div>
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        {/* Select products */}
        <div className="rounded-xl border border-border bg-surface p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-[14px] font-bold text-foreground">Select products</h2>
            <span className="text-[12px] text-muted">{selectedCount} selected</span>
          </div>

          {/* Search */}
          <div className="relative mb-4 max-w-[280px]">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint">
              <Icon name="SearchLine" size={16} />
            </span>
            <input
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder="Search…"
              className="w-full rounded-md border border-border-strong bg-surface py-2 pl-9 pr-3 text-[13px] outline-none placeholder:text-faint focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>

          {productError && <p className="mb-3 text-[12px] font-semibold text-error">{productError}</p>}

          {/* Product rows with checkboxes */}
          <div className="flex flex-col gap-2.5">
            {listLoading ? (
              <p className="py-6 text-center text-[13px] text-muted">Searching…</p>
            ) : items.length === 0 ? (
              <p className="py-6 text-center text-[13px] text-muted">No products found</p>
            ) : (
              items.map((p) => {
                const checked = !!selected[p.id];
                const price =
                  p.minPrice === p.maxPrice ? formatINR(p.minPrice) : `${formatINR(p.minPrice)}+`;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => toggleProduct(p)}
                    className={`flex items-center gap-3 rounded-[10px] border px-3.5 py-3 text-left transition-colors ${
                      checked ? 'border-primary bg-primary-subtle/40' : 'border-border hover:border-border-strong'
                    }`}
                  >
                    <div className="h-10 w-10 shrink-0 overflow-hidden rounded-md bg-subtle">
                      {p.thumbnail ? <img src={p.thumbnail} alt="" className="h-full w-full object-cover" /> : null}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-bold text-foreground">{p.name}</p>
                      <p className="truncate text-[11px] text-muted">
                        {p.categoryName || '—'} · {price}
                      </p>
                    </div>
                    <span
                      className={`inline-flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-md border-2 ${
                        checked ? 'border-primary bg-primary text-white' : 'border-border-strong bg-surface'
                      }`}
                    >
                      {checked && <Icon name="CheckLine" size={14} />}
                    </span>
                  </button>
                );
              })
            )}
            {hasMore && !listLoading && (
              <button
                type="button"
                onClick={loadMore}
                className="mt-1 rounded-md border border-border-strong py-2 text-[13px] font-semibold text-foreground hover:bg-subtle"
              >
                Load more
              </button>
            )}
          </div>
        </div>

        {/* Settings */}
        <div className="rounded-xl border border-border bg-surface p-5 shadow-sm">
          <div className="flex flex-col gap-4">
            <Field label="Sale name" error={errors.name?.message}>
              <input {...register('name')} placeholder="e.g. Eid Flash — 6 hours" className={inputCls} />
            </Field>

            <Field label="Discount type" error={errors.discountType?.message}>
              <div className="relative">
                <select {...register('discountType')} className={`${inputCls} appearance-none pr-9`}>
                  <option value="Percentage">Percentage</option>
                  <option value="Fixed">Fixed price</option>
                </select>
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-faint">
                  <Icon name="ArrowDownLine" size={16} />
                </span>
              </div>
            </Field>

            <Field label="Discount value" error={errors.discountValue?.message}>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[13px] font-semibold text-faint">
                  {discountType === 'Percentage' ? '%' : '₹'}
                </span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  {...register('discountValue')}
                  placeholder={discountType === 'Percentage' ? '40' : '99'}
                  className={`${inputCls} pl-7`}
                />
              </div>
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Start" error={errors.startDate?.message}>
                <DatePicker
                  selected={startDate}
                  onChange={(d) => d && setValue('startDate', d, { shouldDirty: true, shouldValidate: true })}
                  showTimeSelect
                  dateFormat="dd MMM, h:mm aa"
                  className={inputCls}
                  wrapperClassName="w-full"
                />
              </Field>
              <Field label="End" error={errors.endDate?.message}>
                <DatePicker
                  selected={endDate}
                  onChange={(d) => d && setValue('endDate', d, { shouldDirty: true, shouldValidate: true })}
                  showTimeSelect
                  minDate={startDate}
                  dateFormat="dd MMM, h:mm aa"
                  className={inputCls}
                  wrapperClassName="w-full"
                />
              </Field>
            </div>

            {/* Activate now */}
            <div className="flex items-center justify-between">
              <span className="text-[13px] font-semibold text-foreground">Activate now</span>
              <button
                type="button"
                onClick={() => setIsActive((v) => !v)}
                aria-label="Toggle activate now"
                className={`relative h-6 w-11 shrink-0 rounded-pill transition-colors ${isActive ? 'bg-primary' : 'bg-border-strong'}`}
              >
                <span
                  className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-all ${isActive ? 'left-[22px]' : 'left-0.5'}`}
                />
              </button>
            </div>
          </div>
        </div>
      </div>
    </form>
  );
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Firestore cursor snapshot
type QueryCursor = any;

const inputCls =
  'w-full rounded-md border border-border-strong bg-surface px-3 py-2.5 text-[14px] outline-none placeholder:text-faint focus:border-primary focus:ring-2 focus:ring-primary/20';

const Field: FC<{ label: string; error?: string; children: ReactNode }> = ({ label, error, children }) => (
  <div className="flex flex-col gap-1.5">
    <label className="text-[12px] font-bold text-foreground">{label}</label>
    {children}
    {error && <p className="text-[12px] text-error">{error}</p>}
  </div>
);

export default CreateFlashSalePage;
