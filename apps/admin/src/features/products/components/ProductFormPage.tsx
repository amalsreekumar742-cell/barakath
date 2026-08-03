import { type FC, type ReactNode, type FocusEvent, type ChangeEvent, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { v4 as uuid } from 'uuid';
import toast from 'react-hot-toast';
import Skeleton from 'react-loading-skeleton';
import { ProductStatus } from '@barakath/shared/config/enums';
import type { SpecificationProps } from '@barakath/shared/types';
import { useAppDispatch, useAppSelector } from '@/stores/store';
import Icon from '@/components/icons/Icon';
import SearchSelect from '@/components/SearchSelect';
import ImageCropperModal from '@/components/ImageCropperModal';
import { formatINR } from '@/utils/format';
import { fetchCategoriesForFilter } from '../api/fetchCategoriesForFilter';
import { fetchProductDetail } from '../api/fetchProductDetail';
import { loadSubCategories } from '../api/loadSubCategories';
import { loadProductsByIds } from '../api/loadProductsByIds';
import { isSkuTaken } from '../api/checkSku';
import { createProduct } from '../api/createProduct';
import { updateProduct } from '../api/updateProduct';
import { resetProductDetail } from '../stores/productsSlice';
import { fetchGeneralSettings } from '@/features/settings/api/fetchGeneralSettings';
import ProductPicker from './ProductPicker';
import { VariantColorPicker, VariantUnitPicker } from './VariantVariablePickers';
import { fetchVariantCosts } from '../api/variantCosts';
import type { VariantDraft, ImageDraft, FBTItem } from '../types';

const EMPTY_NV = { color: '', colorCode: '#0f7a5a', name: '', purchasePrice: '', mrp: '', offerPrice: '', referralPrice: '', commission: '', gstPercentage: '', stock: '' };

/**
 * Fields the add-row keeps after a variant is added, so a product whose variants differ only by
 * colour/size is entered once rather than retyped per row. Colour and variant are deliberately NOT
 * carried over — they are the only fields that MUST differ between two variants of one product, so
 * pre-filling them would invite a duplicate.
 */
const CARRY_OVER = ['purchasePrice', 'mrp', 'offerPrice', 'referralPrice', 'commission', 'gstPercentage', 'stock'] as const;

const MAX_SPECS = 10;
const MAX_FBT = 10;
const MAX_IMAGES = 5;
const MAX_BYTES = 2 * 1024 * 1024;
const ALLOWED = ['image/jpeg', 'image/png', 'image/webp'];

const schema = z
  .object({
    name: z.string().trim().min(3, 'At least 3 characters'),
    sku: z.string().trim().min(1, 'SKU is required'),
    description: z.string().optional(),
    youtubeVideoLink: z.string().trim().optional(),
    comboDeliveryCharge: z.coerce.number().min(0).optional(),
    lowStockThreshold: z.coerce.number().int('Whole number').min(1, 'Minimum 1'),
  })
  .refine((d) => !d.youtubeVideoLink || /(?:youtube\.com|youtu\.be)/.test(d.youtubeVideoLink), {
    message: 'Enter a valid YouTube URL',
    path: ['youtubeVideoLink'],
  });
type FormValues = z.infer<typeof schema>;

/**
 * ProductFormPage — Add / Edit product inner page (spec §1.5; design screen 04). Two-column top row:
 * Details (left) and Images + Product video (right, per spec "Images section, right side"). Product
 * images are a product-level gallery (first = hero, max 5); variants carry pricing/stock only. Below:
 * Product settings (status/combo/replacement/low-stock), Variants (modal), Specs, and combo-only FBT.
 */
const ProductFormPage: FC = () => {
  const { id } = useParams();
  const isEdit = !!id;
  const dispatch = useAppDispatch();
  const navigate = useNavigate();

  const categories = useAppSelector((s) => s.products.filterCategories);
  const detail = useAppSelector((s) => s.products.productDetail);
  const detailLoading = useAppSelector((s) => s.products.detailLoading);
  const saving = useAppSelector((s) => (isEdit ? s.products.updateLoading : s.products.createLoading));
  // Variant axes come from Settings › Variables (spec §1.21 / design 04): the Colour swatches + the
  // variant-group names (e.g. Size) feed this section's pickers and the "From Settings" helper chips.
  const variantGroupNames = useAppSelector(
    (s) => s.settings.settings?.variables.variantGroups.map((g) => g.name) ?? [],
  );

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isDirty },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { lowStockThreshold: 5, description: '', youtubeVideoLink: '', comboDeliveryCharge: 0 },
  });

  const [categoryId, setCategoryId] = useState('');
  const [categoryName, setCategoryName] = useState('');
  const [subCategoryId, setSubCategoryId] = useState('');
  const [subCategoryName, setSubCategoryName] = useState('');
  const [subOptions, setSubOptions] = useState<{ value: string; label: string }[]>([]);
  const [status, setStatus] = useState<ProductStatus>(ProductStatus.ACTIVE);
  const [isCombo, setIsCombo] = useState(false);
  const [replacementAvailable, setReplacementAvailable] = useState(true);
  const [images, setImages] = useState<ImageDraft[]>([]);
  const [variants, setVariants] = useState<VariantDraft[]>([]);
  /** Settings › Delivery & Tax rate — the fallback for any variant with no rate of its own. */
  const globalGstPct = useAppSelector((s) => s.settings.settings?.delivery.gstPercentage ?? 0);
  const [specifications, setSpecifications] = useState<SpecificationProps[]>([]);
  const [fbt, setFbt] = useState<FBTItem[]>([]);

  const [cropperSrc, setCropperSrc] = useState<string | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [nv, setNv] = useState(EMPTY_NV); // inline "new variant" row
  const [skuChecking, setSkuChecking] = useState(false);
  const imageFileRef = useRef<HTMLInputElement>(null);
  const addRowRef = useRef<HTMLTableRowElement>(null); // header "Add variant" scrolls the add-row into view
  const hydrated = useRef(false);

  useEffect(() => {
    if (categories.length === 0) void dispatch(fetchCategoriesForFilter());
    void dispatch(fetchGeneralSettings()); // colours + variant units for the variant pickers (spec §1.21)
    if (isEdit && id) void dispatch(fetchProductDetail(id));
    return () => {
      dispatch(resetProductDetail());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatch, id]);

  useEffect(() => {
    if (!isEdit || hydrated.current || !detail || detail.product.id !== id) return;
    hydrated.current = true;
    const p = detail.product;
    reset({
      name: p.name,
      sku: p.sku,
      description: p.description,
      youtubeVideoLink: p.youtubeVideoLink,
      comboDeliveryCharge: p.comboDeliveryCharge,
      lowStockThreshold: p.lowStockThreshold,
    });
    setCategoryId(p.categoryId);
    setCategoryName(p.categoryName);
    setSubCategoryId(p.subCategoryId);
    setSubCategoryName(p.subCategoryName);
    setStatus(p.status);
    setIsCombo(p.isCombo);
    setReplacementAvailable(p.replacementAvailable);
    setSpecifications(p.specifications ?? []);
    setImages((p.images ?? []).map((url) => ({ id: uuid(), url })));
    setVariants(
      detail.variants.map((v) => ({
        id: v.id,
        isNew: false,
        name: v.name,
        color: v.color,
        colorCode: v.colorCode,
        // Filled in by the variantCosts read below — it is a separate, admin-only document.
        purchasePrice: 0,
        mrp: v.mrp,
        offerPrice: v.offerPrice,
        referralPrice: v.referralPrice,
        commission: v.commission,
        // null (not 0) when the variant predates per-variant rates — see VariantDraft.
        gstPercentage: typeof v.gstPercentage === 'number' ? v.gstPercentage : null,
        stock: v.stock,
      })),
    );
    // Purchase prices are NOT on the variant documents (they would be world-readable there), so they
    // need their own read. Patched in rather than awaited so the form is usable immediately.
    void fetchVariantCosts(detail.variants.map((v) => v.id)).then((costs) => {
      if (costs.size === 0) return;
      setVariants((prev) => prev.map((v) => ({ ...v, purchasePrice: costs.get(v.id) ?? v.purchasePrice })));
    });
    if (p.categoryId) void loadSubCategories(p.categoryId).then((subs) => setSubOptions(subs.map((s) => ({ value: s.id, label: s.name }))));
    if (p.isCombo && p.frequentlyBoughtTogether?.length) void loadProductsByIds(p.frequentlyBoughtTogether).then(setFbt);
  }, [detail, id, isEdit, reset]);

  const onCategoryChange = async (catId: string) => {
    const cat = categories.find((c) => c.id === catId);
    setCategoryId(catId);
    setCategoryName(cat?.name ?? '');
    setSubCategoryId('');
    setSubCategoryName('');
    const subs = await loadSubCategories(catId);
    setSubOptions(subs.map((s) => ({ value: s.id, label: s.name })));
  };

  const onSkuBlur = async (e: FocusEvent<HTMLInputElement>) => {
    const sku = e.target.value.trim();
    if (!sku) return;
    setSkuChecking(true);
    try {
      if (await isSkuTaken(sku, id)) setError('sku', { message: 'SKU already exists' });
    } finally {
      setSkuChecking(false);
    }
  };

  // --- product images ---
  const onImageFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (images.length >= MAX_IMAGES) return toast.error(`Up to ${MAX_IMAGES} images`);
    if (!ALLOWED.includes(file.type)) return toast.error('Only JPG, PNG or WebP');
    if (file.size > MAX_BYTES) return toast.error('Image must be 2MB or smaller');
    const reader = new FileReader();
    reader.onload = () => setCropperSrc(reader.result as string);
    reader.readAsDataURL(file);
  };
  const onImageCropped = (blob: Blob) => {
    setImages((prev) => [...prev, { id: uuid(), blob }]);
    setCropperSrc(null);
  };
  const removeImage = (imgId: string) =>
    setImages((prev) => prev.filter((i) => i.id !== imgId));
  const onDropImage = (target: number) => {
    if (dragIndex === null || dragIndex === target) return;
    setImages((prev) => {
      const next = [...prev];
      const [moved] = next.splice(dragIndex, 1);
      next.splice(target, 0, moved!);
      return next;
    });
    setDragIndex(null);
  };
  const imgSrc = (img: ImageDraft) => img.url ?? (img.blob ? URL.createObjectURL(img.blob) : '');

  // Inline "Add variant" row (spec §1.5 / design 04 — variants added inline, not in a modal).
  const addInlineVariant = () => {
    const mrp = Number(nv.mrp), offer = Number(nv.offerPrice);
    const referral = Number(nv.referralPrice || 0), commission = Number(nv.commission || 0), stock = Number(nv.stock || 0);
    const purchasePrice = Number(nv.purchasePrice || 0), gstPercentage = Number(nv.gstPercentage || 0);
    if (!nv.color.trim() || !nv.name.trim()) return toast.error('Color and variant are required');
    if (!(mrp > 0) || !(offer > 0)) return toast.error('Enter actual and selling price');
    if (offer > mrp) return toast.error('Selling price must be ≤ Actual');
    if (referral > offer) return toast.error('Ref buying price must be ≤ Selling price');
    if (commission > referral) return toast.error('Commission must be ≤ Ref buying price');
    if (purchasePrice < 0) return toast.error('Purchase payment cannot be negative');
    if (gstPercentage < 0 || gstPercentage > 100) return toast.error('GST must be between 0 and 100');
    setVariants((prev) => [
      ...prev,
      { id: uuid(), isNew: true, name: nv.name.trim(), color: nv.color.trim(), colorCode: nv.colorCode, purchasePrice, mrp, offerPrice: offer, referralPrice: referral, commission, gstPercentage, stock },
    ]);
    // Keep the pricing fields for the next row (see CARRY_OVER) — the common case is several sizes
    // of one product sharing everything but colour and size. Clearing all of it forced a full retype
    // for every variant after the first.
    setNv((s) => ({ ...EMPTY_NV, ...Object.fromEntries(CARRY_OVER.map((k) => [k, s[k]])) }));
  };
  const removeVariant = (vid: string) => {
    if (variants.length <= 1) return toast.error('Minimum one variant required');
    setVariants((prev) => prev.filter((v) => v.id !== vid));
  };

  const addSpec = () => specifications.length < MAX_SPECS && setSpecifications((p) => [...p, { key: '', value: '' }]);
  const setSpec = (i: number, field: 'key' | 'value', val: string) => setSpecifications((p) => p.map((s, idx) => (idx === i ? { ...s, [field]: val } : s)));
  const removeSpec = (i: number) => setSpecifications((p) => p.filter((_, idx) => idx !== i));

  const cancel = () => {
    if (isDirty || variants.length > 0 || images.length > 0) {
      if (!window.confirm('Discard unsaved changes?')) return;
    }
    navigate('/products');
  };

  const onSubmit = async (values: FormValues) => {
    if (!categoryId || !subCategoryId) return toast.error('Select a category and sub-category');
    if (images.length === 0) return toast.error('Add at least one product image');
    if (variants.length === 0) return toast.error('Add at least one variant');
    const specs = specifications.filter((s) => s.key.trim() && s.value.trim());

    const common = {
      name: values.name,
      sku: values.sku,
      description: values.description ?? '',
      categoryId,
      categoryName,
      subCategoryId,
      subCategoryName,
      images,
      specifications: specs,
      youtubeVideoLink: values.youtubeVideoLink ?? '',
      isCombo,
      comboDeliveryCharge: values.comboDeliveryCharge ?? 0,
      replacementAvailable,
      lowStockThreshold: values.lowStockThreshold,
      frequentlyBoughtTogether: fbt.map((f) => f.id),
      status,
      // Resolve "inherit the shop default" into a concrete rate here, at the one place that knows
      // both the draft and the current global rate — see VariantDraft.gstPercentage.
      variants: variants.map((v) => ({ ...v, gstPercentage: v.gstPercentage ?? globalGstPct })),
    };

    const res = isEdit ? await dispatch(updateProduct({ id: id!, ...common })) : await dispatch(createProduct(common));
    if (updateProduct.fulfilled.match(res) || createProduct.fulfilled.match(res)) {
      toast.success(isEdit ? 'Product updated' : 'Product created');
      navigate('/products');
    } else {
      const msg = (res.payload as string) ?? 'Could not save product';
      if (msg === 'SKU already exists') setError('sku', { message: msg });
      toast.error(msg);
    }
  };

  if (isEdit && detailLoading && !hydrated.current) {
    return (
      <div className="p-6">
        <Skeleton height={40} width={280} />
        <Skeleton height={260} className="mt-4" borderRadius={16} />
        <Skeleton height={200} className="mt-4" borderRadius={16} />
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="pb-24">
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-[22px] font-extrabold tracking-tight text-foreground">
            {isEdit ? 'Edit product' : 'Add product'}
          </h1>
        </div>

        <div className="max-w-5xl space-y-4">
          {/* Top row: Details (left) + Images/Media (right) */}
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <Card title="Details">
                <div className="grid gap-4">
                  <Field label="Product name" error={errors.name?.message}>
                    <input {...register('name')} placeholder="e.g. Amber Oud — Eau de Parfum" className={inputCls} />
                  </Field>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <Field label="SKU" error={errors.sku?.message}>
                      <input {...register('sku')} onBlur={onSkuBlur} placeholder="e.g. PERF-001" className={inputCls} />
                      {skuChecking && <p className="mt-1 text-[12px] text-faint">Checking…</p>}
                    </Field>
                    <Field label="Category">
                      <SearchSelect options={categories.map((c) => ({ value: c.id, label: c.name }))} value={categoryId} onChange={onCategoryChange} placeholder="Select category" />
                    </Field>
                    <Field label="Sub-category">
                      <SearchSelect
                        options={subOptions}
                        value={subCategoryId}
                        onChange={(v) => {
                          setSubCategoryId(v);
                          setSubCategoryName(subOptions.find((o) => o.value === v)?.label ?? '');
                        }}
                        placeholder={categoryId ? 'Select sub-category' : 'Select a category first'}
                        disabled={!categoryId}
                        emptyText="No sub-categories"
                      />
                    </Field>
                  </div>
                  <Field label="Description">
                    <textarea {...register('description')} rows={4} placeholder="Describe the product…" className={`${inputCls} resize-y`} />
                  </Field>
                </div>
              </Card>
            </div>

            {/* Right column: Images + Product video */}
            <div className="space-y-4 lg:col-span-1">
              <Card title="Images">
                <p className="mb-2 -mt-2 text-[12px] text-faint">First image is the hero · max {MAX_IMAGES} · 2MB each</p>
                {/* Hero */}
                <button
                  type="button"
                  onClick={() => imageFileRef.current?.click()}
                  className="flex aspect-[4/3] w-full items-center justify-center overflow-hidden rounded-lg border border-dashed border-border-strong bg-subtle text-faint hover:border-primary hover:text-primary"
                >
                  {images[0] ? (
                    <img src={imgSrc(images[0])} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span className="flex flex-col items-center gap-1 text-[13px]">
                      <Icon name="ImageLine" size={26} /> Add images
                    </span>
                  )}
                </button>
                {/* Thumb strip */}
                {images.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {images.map((img, i) => (
                      <div
                        key={img.id}
                        draggable
                        onDragStart={() => setDragIndex(i)}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={() => onDropImage(i)}
                        className="group relative h-14 w-14 cursor-move overflow-hidden rounded-md border border-border bg-subtle"
                      >
                        <img src={imgSrc(img)} alt="" className="h-full w-full object-cover" />
                        {i === 0 && <span className="absolute left-0.5 top-0.5 rounded-sm bg-primary px-1 text-[8px] font-bold text-white">Hero</span>}
                        <button type="button" onClick={() => removeImage(img.id)} className="absolute right-0.5 top-0.5 rounded-full bg-ink/60 p-0.5 text-white opacity-0 group-hover:opacity-100" aria-label="Remove image">
                          <Icon name="CloseLine" size={12} />
                        </button>
                      </div>
                    ))}
                    {images.length < MAX_IMAGES && (
                      <button type="button" onClick={() => imageFileRef.current?.click()} className="flex h-14 w-14 items-center justify-center rounded-md border border-dashed border-border-strong text-faint hover:border-primary hover:text-primary">
                        <Icon name="AddLine" size={18} />
                      </button>
                    )}
                  </div>
                )}
                <input ref={imageFileRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={onImageFile} className="hidden" />
              </Card>

              <Card title="Product video">
                <Field label="YouTube video link (optional)" error={errors.youtubeVideoLink?.message}>
                  <input {...register('youtubeVideoLink')} placeholder="https://youtu.be/…" className={inputCls} />
                </Field>
              </Card>
            </div>
          </div>

          {/* Product settings */}
          <Card title="Product settings">
            <div className="grid gap-4 sm:grid-cols-2">
              <ToggleRow label="Status" on={status === ProductStatus.ACTIVE} onToggle={() => setStatus((s) => (s === ProductStatus.ACTIVE ? ProductStatus.ARCHIVED : ProductStatus.ACTIVE))} onText="Active" offText="Archived" />
              <ToggleRow label="Returns available" on={replacementAvailable} onToggle={() => setReplacementAvailable((v) => !v)} />
              <ToggleRow label="Combo product" on={isCombo} onToggle={() => setIsCombo((v) => !v)} />
              {isCombo && (
                <Field label="Combo delivery charge (₹)" error={errors.comboDeliveryCharge?.message}>
                  <input type="number" step="0.01" {...register('comboDeliveryCharge')} placeholder="0" className={inputCls} />
                </Field>
              )}
              <Field label="Low stock threshold" error={errors.lowStockThreshold?.message}>
                <input type="number" {...register('lowStockThreshold')} className={inputCls} />
              </Field>
            </div>
          </Card>

          {/* Variants — added inline (design 04). Each row: Color · Size · Price · Offer · Referral · Comm · Stock */}
          <Card
            title="Variants & pricing"
            action={
              <button
                type="button"
                onClick={() => addRowRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
                className="inline-flex items-center gap-1 rounded-md border border-border-strong px-3 py-1.5 text-[13px] font-semibold text-primary hover:bg-primary-subtle"
              >
                <Icon name="AddLine" size={14} /> Add variant
              </button>
            }
          >
            <div className="-mt-2 mb-3 space-y-2">
              <div className="flex flex-wrap items-center gap-1.5 text-[12px]">
                <span className="font-semibold text-faint">From Settings › Variables:</span>
                <span className="inline-flex items-center rounded-pill border border-border-strong bg-subtle px-2 py-0.5 text-[11px] font-semibold text-foreground">
                  Color
                </span>
                {variantGroupNames.map((n) => (
                  <span
                    key={n}
                    className="inline-flex items-center rounded-pill border border-border-strong bg-subtle px-2 py-0.5 text-[11px] font-semibold text-foreground"
                  >
                    {n}
                  </span>
                ))}
                {variantGroupNames.length === 0 && (
                  <span className="text-faint">no variant groups yet — add them in Settings › Variables</span>
                )}
              </div>
              <p className="text-[12px] text-faint">
                Price varies per variant — set purchase payment, actual, selling, ref buying, commission
                &amp; GST for each (Actual ≥ Selling ≥ Ref buying ≥ Commission). Purchase payment is
                internal: it drives the profit report and is never shown to customers.
              </p>
            </div>
            <div className="overflow-x-auto rounded-lg border border-border">
              {/* Sized so the ten columns fit without scrolling on a normal desktop; narrower than
                  that the pinned action column keeps Add/Delete reachable. */}
              <table className="w-full min-w-[960px] text-[13px]">
                <thead className="bg-subtle/50 text-left text-[11px] uppercase tracking-wide text-faint">
                  <tr>
                    {/* Labels only — the Firestore field names behind them (mrp / offerPrice /
                        referralPrice / commission) are unchanged, so no document is rewritten. */}
                    <th className="px-3 py-2 font-semibold">Color</th>
                    <th className="px-3 py-2 font-semibold">Variant</th>
                    <th className="px-3 py-2 font-semibold">Purchase payment (₹)</th>
                    <th className="px-3 py-2 font-semibold">Actual (₹)</th>
                    <th className="px-3 py-2 font-semibold">Selling price (₹)</th>
                    <th className="px-3 py-2 font-semibold">Ref buying price (₹)</th>
                    <th className="px-3 py-2 font-semibold">Comm.</th>
                    <th className="px-3 py-2 font-semibold">GST (%)</th>
                    <th className="px-3 py-2 font-semibold">Stock</th>
                    {/* Pinned right. With ten columns the table scrolls horizontally, and the Add
                        button lived past the right edge — invisible until you scrolled, on the one
                        row whose whole purpose is that button. Sticky keeps it (and every row's
                        delete) reachable at any width. The cell needs an OPAQUE background or the
                        scrolling columns show through it. */}
                    <th className="sticky right-0 z-10 border-l border-border bg-subtle px-3 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {variants.map((v) => (
                    <tr key={v.id} className="group border-t border-border">
                      <td className="px-3 py-2">
                        <span className="inline-flex items-center gap-1.5 text-foreground">
                          <span className="h-3 w-3 rounded-full border border-border" style={{ backgroundColor: v.colorCode }} />
                          {v.color}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-muted">{v.name}</td>
                      <td className="px-3 py-2 text-muted">{formatINR(v.purchasePrice)}</td>
                      <td className="px-3 py-2 text-muted">{formatINR(v.mrp)}</td>
                      <td className="px-3 py-2 font-semibold text-primary">{formatINR(v.offerPrice)}</td>
                      <td className="px-3 py-2 font-semibold text-gold-strong">{formatINR(v.referralPrice)}</td>
                      <td className="px-3 py-2 text-muted">{formatINR(v.commission)}</td>
                      <td className="px-3 py-2 text-muted">
                        {v.gstPercentage ?? globalGstPct}%
                        {v.gstPercentage === null && (
                          <span className="ml-1 text-[11px] text-faint">(shop default)</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-muted">{v.stock}</td>
                      <td className="sticky right-0 z-10 border-l border-border bg-surface px-3 py-2 text-right group-hover:bg-subtle">
                        <button type="button" onClick={() => removeVariant(v.id)} className="rounded-md p-1.5 text-muted hover:bg-error-subtle hover:text-error" aria-label="Delete variant">
                          <Icon name="CloseLine" size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}

                  {/* Inline add row */}
                  <tr ref={addRowRef} className="border-t border-border bg-subtle/30">
                    <td className="px-2 py-2">
                      <VariantColorPicker
                        value={nv.color}
                        colorCode={nv.colorCode}
                        onSelect={(name, code) => setNv((s) => ({ ...s, color: name, colorCode: code }))}
                      />
                    </td>
                    <td className="px-2 py-2">
                      <VariantUnitPicker value={nv.name} onSelect={(name) => setNv((s) => ({ ...s, name }))} />
                    </td>
                    <td className="px-2 py-2"><input type="number" value={nv.purchasePrice} onChange={(e) => setNv((s) => ({ ...s, purchasePrice: e.target.value }))} placeholder="₹ Purchase" className={cellCls} /></td>
                    <td className="px-2 py-2"><input type="number" value={nv.mrp} onChange={(e) => setNv((s) => ({ ...s, mrp: e.target.value }))} placeholder="₹ Actual" className={cellCls} /></td>
                    <td className="px-2 py-2"><input type="number" value={nv.offerPrice} onChange={(e) => setNv((s) => ({ ...s, offerPrice: e.target.value }))} placeholder="₹ Selling" className={cellCls} /></td>
                    <td className="px-2 py-2"><input type="number" value={nv.referralPrice} onChange={(e) => setNv((s) => ({ ...s, referralPrice: e.target.value }))} placeholder="₹ Ref buying" className={cellCls} /></td>
                    <td className="px-2 py-2"><input type="number" value={nv.commission} onChange={(e) => setNv((s) => ({ ...s, commission: e.target.value }))} placeholder="Comm." className={cellCls} /></td>
                    <td className="px-2 py-2"><input type="number" value={nv.gstPercentage} onChange={(e) => setNv((s) => ({ ...s, gstPercentage: e.target.value }))} placeholder="GST %" className={cellCls} /></td>
                    <td className="px-2 py-2"><input type="number" value={nv.stock} onChange={(e) => setNv((s) => ({ ...s, stock: e.target.value }))} placeholder="Stock" className={cellCls} /></td>
                    <td className="sticky right-0 z-10 border-l border-border bg-subtle px-2 py-2 text-right">
                      <button type="button" onClick={addInlineVariant} className="rounded-md bg-primary px-3 py-1.5 text-[13px] font-semibold text-white hover:bg-primary-dark">
                        Add
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            {variants.length === 0 && (
              <p className="mt-2 text-[12px] text-faint">Add at least one variant using the row above.</p>
            )}
          </Card>

          {/* Specifications */}
          <Card
            title="Specifications"
            action={specifications.length < MAX_SPECS ? (
              <button type="button" onClick={addSpec} className="inline-flex items-center gap-1 text-[13px] font-semibold text-primary hover:underline">
                <Icon name="AddLine" size={16} /> Add field
              </button>
            ) : null}
          >
            {specifications.length === 0 ? (
              <p className="py-2 text-[13px] text-muted">No specifications.</p>
            ) : (
              <div className="space-y-2">
                {specifications.map((s, i) => (
                  <div key={i} className="flex gap-2">
                    <input value={s.key} onChange={(e) => setSpec(i, 'key', e.target.value)} placeholder="Key (e.g. Fragrance family)" className={`${inputCls} flex-1`} />
                    <input value={s.value} onChange={(e) => setSpec(i, 'value', e.target.value)} placeholder="Value (e.g. Amber · Oriental)" className={`${inputCls} flex-1`} />
                    <button type="button" onClick={() => removeSpec(i)} className="rounded-md p-2 text-muted hover:bg-error-subtle hover:text-error" aria-label="Remove">
                      <Icon name="CloseLine" size={18} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* FBT (combo only) */}
          {isCombo && (
            <Card title="Frequently bought together">
              {fbt.length < MAX_FBT && (
                <ProductPicker
                  onSelect={(item) => {
                    if (item.id === id) return toast.error("Can't add this product to itself");
                    if (fbt.some((f) => f.id === item.id)) return;
                    setFbt((prev) => [...prev, item]);
                  }}
                  excludeIds={[...fbt.map((f) => f.id), ...(id ? [id] : [])]}
                />
              )}
              {fbt.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {fbt.map((f) => (
                    <span key={f.id} className="inline-flex items-center gap-2 rounded-lg border border-border bg-subtle py-1 pl-1.5 pr-2 text-[13px]">
                      <span className="h-7 w-7 overflow-hidden rounded-md border border-border bg-surface">
                        {f.image ? <img src={f.image} alt="" className="h-full w-full object-cover" /> : null}
                      </span>
                      <span className="max-w-[160px] truncate font-medium text-foreground">{f.name}</span>
                      <button type="button" onClick={() => setFbt((prev) => prev.filter((x) => x.id !== f.id))} className="text-faint hover:text-error" aria-label="Remove">
                        <Icon name="CloseLine" size={14} />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </Card>
          )}
        </div>
      </div>

      {/* Sticky action bar */}
      <div className="fixed bottom-0 left-[236px] right-0 flex items-center justify-end gap-2.5 border-t border-border bg-surface/95 px-6 py-3 backdrop-blur">
        <button type="button" onClick={cancel} disabled={saving} className="rounded-md border border-border-strong px-4 py-2 text-[14px] font-semibold text-foreground hover:bg-subtle disabled:opacity-50">
          Cancel
        </button>
        <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2 text-[14px] font-semibold text-white hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-50">
          {saving && <Icon name="Loader4Line" size={16} className="animate-spin" />}
          {isEdit ? 'Update product' : 'Save product'}
        </button>
      </div>

      {cropperSrc && (
        <ImageCropperModal isOpen={!!cropperSrc} src={cropperSrc} aspectRatio={1} onCancel={() => setCropperSrc(null)} onCropped={onImageCropped} />
      )}
    </form>
  );
};

const inputCls =
  'w-full rounded-md border border-border-strong bg-surface px-3 py-2.5 text-[14px] outline-none placeholder:text-faint focus:border-primary focus:ring-2 focus:ring-primary/20';
const cellCls =
  'w-full min-w-[56px] rounded-md border border-border-strong bg-surface px-2 py-1.5 text-[13px] outline-none placeholder:text-faint focus:border-primary';

const Card: FC<{ title: string; action?: ReactNode; children: ReactNode }> = ({ title, action, children }) => (
  <div className="rounded-xl border border-border bg-surface p-5 shadow-sm">
    <div className="mb-4 flex items-center justify-between">
      <h2 className="text-[15px] font-bold text-foreground">{title}</h2>
      {action}
    </div>
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

const ToggleRow: FC<{ label: string; on: boolean; onToggle: () => void; onText?: string; offText?: string }> = ({ label, on, onToggle, onText = 'On', offText = 'Off' }) => (
  <div>
    <label className="mb-1.5 block text-[13px] font-semibold text-foreground">{label}</label>
    <button type="button" onClick={onToggle} className="flex items-center gap-2 rounded-md border border-border-strong bg-surface px-3 py-2">
      <span className={`relative h-5 w-9 rounded-full transition-colors ${on ? 'bg-primary' : 'bg-border-strong'}`}>
        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${on ? 'left-4' : 'left-0.5'}`} />
      </span>
      <span className="text-[13px] font-medium text-foreground">{on ? onText : offText}</span>
    </button>
  </div>
);

export default ProductFormPage;
