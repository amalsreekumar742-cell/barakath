import { type FC, type ReactNode, type ChangeEvent, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { BannerLinkType, BannerPlacement } from '@barakath/shared/config/enums';
import type { BannerProps } from '@barakath/shared/types';
import { useAppDispatch, useAppSelector } from '@/stores/store';
import Icon from '@/components/icons/Icon';
import ImageCropperModal from '@/components/ImageCropperModal';
import { createBanner } from '../api/createBanner';
import { updateBanner } from '../api/updateBanner';
import { loadBannerProductById } from '../api/searchBannerProducts';
import type { BannerInput } from '../types';
import ProductPicker from './ProductPicker';

// Image constraints (spec §1.22): max 2MB, JPG/PNG/WebP, error toast on violation.
const MAX_BYTES = 2 * 1024 * 1024;
const ALLOWED = ['image/jpeg', 'image/png', 'image/webp'];

/**
 * Zod schema for the banner form (prototype "Add banner"): a title and an OPTIONAL attached product. The
 * image is validated OUTSIDE zod (it lives in component state as a Blob/URL, not a form field). WHY zod +
 * react-hook-form: the standard forms stack in this app.
 */
const schema = z.object({
  title: z.string().trim().min(2, 'At least 2 characters'),
  placement: z.enum(['App', 'Website', 'Both']),
  linkValue: z.string(),
  linkProductName: z.string(),
  isActive: z.boolean(),
});

type FormValues = z.infer<typeof schema>;

/**
 * BannerForm — the shared Create/Edit banner form (spec §1.15 / prototype "Add banner"): a 16:9 image, a
 * banner title, an optional attached product and a Publish-live toggle. Both routes render this: Add passes
 * no `banner` (empty defaults), Edit passes the loaded banner so fields + the current image hydrate.
 *
 * WHY the image lives in local state (not react-hook-form): it is a cropped Blob (new) or an existing URL
 * (Edit), neither of which fits a plain form field — the crop→compress→upload flow is imperative, so we
 * track `imageBlob` (new upload) + `imagePreview` (what to show) and validate them on submit. Placement is
 * fixed to App (prototype has no placement control); on Edit the banner's existing placement/schedule are
 * preserved untouched.
 */
interface BannerFormProps {
  mode: 'create' | 'edit';
  banner?: BannerProps;
}

const BannerForm: FC<BannerFormProps> = ({ mode, banner }) => {
  const isEdit = mode === 'edit';
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const admin = useAppSelector((s) => s.currentAdmin.admin);
  const saving = useAppSelector((s) => (isEdit ? s.banners.updateLoading : s.banners.createLoading));

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
      placement: BannerPlacement.APP,
      linkValue: '',
      linkProductName: '',
      isActive: true,
    },
  });

  // Image state: a newly cropped Blob (upload on save) and the preview URL (new blob URL or existing image).
  const [imageBlob, setImageBlob] = useState<Blob | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [cropperSrc, setCropperSrc] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const hydrated = useRef(false);

  // Hydrate the form + image from the loaded banner on Edit (once).
  useEffect(() => {
    if (!isEdit || hydrated.current || !banner) return;
    hydrated.current = true;
    setValue('title', banner.title);
    setValue('placement', banner.placement);
    setValue('isActive', banner.isActive);
    setImagePreview(banner.image); // show the current image with a "change" option
    if (banner.linkType === 'Product' && banner.linkValue) {
      setValue('linkValue', banner.linkValue);
      setValue('linkProductName', banner.linkProductName);
      // If the linked product was deleted, refresh its label so a stale name doesn't persist silently.
      void loadBannerProductById(banner.linkValue).then((p) => {
        if (!p) setValue('linkProductName', 'Product not available');
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [banner, isEdit]);

  const placement = watch('placement');
  const linkValue = watch('linkValue');
  const linkProductName = watch('linkProductName');
  const isActive = watch('isActive');

  // Website heroes are 3:1; App/Both use 16:9. Drives the recommended line, upload label and crop aspect.
  const isWebsite = placement === 'Website';
  const ratioLabel = isWebsite ? '3:1' : '16:9';
  const recommended = isWebsite
    ? 'Recommended aspect ratio 3:1 (e.g. 1920×640)'
    : 'Recommended aspect ratio 16:9 (e.g. 1920×1080)';

  // Pick → validate (size/type, spec §1.22) → open the cropper. Reset the input so re-picking the same file fires.
  const onPickFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!ALLOWED.includes(file.type)) return toast.error('Only JPG, PNG or WebP');
    if (file.size > MAX_BYTES) return toast.error('Image must be 2MB or smaller');
    const reader = new FileReader();
    reader.onload = () => setCropperSrc(reader.result as string);
    reader.readAsDataURL(file);
  };

  // Cropper returns a WebP Blob; hold it for upload and show a local preview.
  const onCropped = (blob: Blob) => {
    setImageBlob(blob);
    setImagePreview((prev) => {
      if (prev && prev.startsWith('blob:')) URL.revokeObjectURL(prev);
      return URL.createObjectURL(blob);
    });
    setCropperSrc(null);
  };

  // Revoke the last object URL on unmount to avoid a leak.
  useEffect(
    () => () => {
      if (imagePreview && imagePreview.startsWith('blob:')) URL.revokeObjectURL(imagePreview);
    },
    [imagePreview],
  );

  const cancel = () => {
    if ((isDirty || imageBlob) && !window.confirm('Discard unsaved changes?')) return;
    navigate('/banners');
  };

  // Build the BannerInput + dispatch create/update. A selected product links the banner; otherwise it is
  // display-only. Placement + any existing schedule are preserved (the prototype form doesn't expose them).
  const onSubmit = async (values: FormValues) => {
    if (!admin) return toast.error('Not signed in');
    if (!imagePreview) return toast.error('Banner image is required');
    if (!isEdit && !imageBlob) return toast.error('Banner image is required');

    const productId = values.linkValue.trim();
    const input: BannerInput = {
      title: values.title,
      linkType: productId ? BannerLinkType.PRODUCT : BannerLinkType.NONE,
      linkValue: productId,
      linkProductName: productId ? values.linkProductName : '',
      linkCategoryName: '',
      placement: values.placement,
      isActive: values.isActive,
      startDate: isEdit && banner && banner.startDate ? banner.startDate.toDate() : null,
      endDate: isEdit && banner && banner.endDate ? banner.endDate.toDate() : null,
    };

    const res =
      isEdit && banner
        ? await dispatch(
            updateBanner({
              bannerId: banner.id,
              input,
              previous: banner,
              imageFile: imageBlob, // null → keep the current image
              adminId: admin.id,
              adminName: admin.fullName,
            }),
          )
        : await dispatch(
            createBanner({
              input,
              imageFile: imageBlob as Blob, // guarded above (create requires an image)
              adminId: admin.id,
              adminName: admin.fullName,
            }),
          );

    if (createBanner.fulfilled.match(res) || updateBanner.fulfilled.match(res)) {
      toast.success(isEdit ? 'Banner updated' : 'Banner created');
      navigate('/banners');
    } else {
      toast.error((res.payload as string) ?? 'Could not save banner');
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <div className="p-6">
        {/* Header with title + top-right actions (design: Cancel / Save banner in the page header). */}
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <button
              type="button"
              onClick={() => navigate('/banners')}
              className="mb-2 inline-flex items-center gap-1.5 text-[13px] font-semibold text-muted hover:text-foreground"
            >
              <Icon name="ArrowLeftLine" size={15} /> Banner
            </button>
            <h1 className="text-[24px] font-extrabold tracking-tight text-foreground">
              {isEdit ? 'Edit banner' : 'Add banner'}
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
              {isEdit ? 'Update banner' : 'Save banner'}
            </button>
          </div>
        </div>

        <div className="max-w-[720px] space-y-4">
          {/* Banner image */}
          <Card title="Banner image">
            <p className="-mt-1.5 mb-3 text-[11px] font-medium text-primary">{recommended}</p>
            {imagePreview ? (
              <div className="space-y-3">
                <div
                  className={`overflow-hidden rounded-lg border border-border bg-subtle ${isWebsite ? 'aspect-[3/1]' : 'aspect-video'}`}
                >
                  <img src={imagePreview} alt="Banner preview" className="h-full w-full object-cover" />
                </div>
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="inline-flex items-center gap-1.5 rounded-md border border-border-strong px-3.5 py-2 text-[13px] font-semibold text-primary hover:bg-primary-subtle"
                >
                  <Icon name="ImageLine" size={15} /> Change image
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className={`flex w-full flex-col items-center justify-center gap-2 rounded-[10px] border border-dashed border-border text-faint transition-colors hover:border-primary hover:text-primary ${isWebsite ? 'aspect-[3/1]' : 'aspect-video'}`}
              >
                <Icon name="ImageLine" size={30} />
                <span className="text-[12px] font-semibold">Upload {ratioLabel} image</span>
              </button>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={onPickFile}
              className="hidden"
            />
          </Card>

          {/* Banner details */}
          <Card>
            <div className="flex flex-col gap-4">
              <Field label="Banner title" error={errors.title?.message}>
                <input {...register('title')} placeholder="e.g. The Eid Edit" className={inputCls} />
              </Field>

              <Field label="Placement">
                <div className="grid grid-cols-2 gap-2">
                  {(['App', 'Website'] as const).map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setValue('placement', p, { shouldDirty: true, shouldValidate: true })}
                      className={`rounded-md border px-3 py-2.5 text-[13px] font-semibold transition-colors ${
                        placement === p
                          ? 'border-primary bg-primary-subtle text-primary'
                          : 'border-border-strong bg-surface text-muted hover:text-foreground'
                      }`}
                    >
                      {p === 'App' ? 'App · 16:9' : 'Website · 3:1'}
                    </button>
                  ))}
                </div>
              </Field>

              <Field label="Attach product">
                <ProductPicker
                  value={linkValue}
                  valueName={linkProductName}
                  onChange={(id, name) => {
                    setValue('linkValue', id, { shouldDirty: true, shouldValidate: true });
                    setValue('linkProductName', name, { shouldDirty: true });
                  }}
                />
              </Field>

              {/* Publish live */}
              <div className="flex items-center justify-between">
                <span className="text-[13px] font-semibold text-foreground">Publish live</span>
                <button
                  type="button"
                  onClick={() => setValue('isActive', !isActive, { shouldDirty: true })}
                  aria-label="Toggle publish live"
                  className={`relative h-6 w-11 shrink-0 rounded-pill transition-colors ${isActive ? 'bg-primary' : 'bg-border-strong'}`}
                >
                  <span
                    className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-all ${isActive ? 'left-[22px]' : 'left-0.5'}`}
                  />
                </button>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {cropperSrc && (
        <ImageCropperModal
          isOpen={!!cropperSrc}
          src={cropperSrc}
          aspectRatio={isWebsite ? 3 / 1 : 16 / 9}
          onCancel={() => setCropperSrc(null)}
          onCropped={onCropped}
        />
      )}
    </form>
  );
};

const inputCls =
  'w-full rounded-md border border-border-strong bg-surface px-3 py-2.5 text-[14px] outline-none placeholder:text-faint focus:border-primary focus:ring-2 focus:ring-primary/20';

const Card: FC<{ title?: string; children: ReactNode }> = ({ title, children }) => (
  <div className="rounded-xl border border-border bg-surface p-5 shadow-sm">
    {title && <h2 className="mb-1.5 text-[13px] font-bold text-foreground">{title}</h2>}
    {children}
  </div>
);

const Field: FC<{ label: string; error?: string; children: ReactNode }> = ({ label, error, children }) => (
  <div className="flex flex-col gap-1.5">
    <label className="text-[12px] font-bold text-foreground">{label}</label>
    {children}
    {error && <p className="text-[12px] text-error">{error}</p>}
  </div>
);

export default BannerForm;
