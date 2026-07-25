import { type FC, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { useAppDispatch, useAppSelector } from '@/stores/store';
import Icon from '@/components/icons/Icon';
import ImageCropperModal from '@/components/ImageCropperModal';
import { createCategory } from '../api/createCategory';
import { updateCategory } from '../api/updateCategory';
import { fetchCategoryDetail } from '../api/fetchCategoryDetail';

const MAX_BYTES = 2 * 1024 * 1024; // 2MB (spec §1.22)
const ALLOWED = ['image/jpeg', 'image/png', 'image/webp'];

const schema = z.object({ name: z.string().trim().min(2, 'Name must be at least 2 characters') });
type FormValues = z.infer<typeof schema>;

/**
 * AddEditCategoryPage — the "Add category" / "Edit category" INNER PAGE (design screen 06).
 *
 * WHY a full page (not a modal): the design renders this as a routed inner page — breadcrumb, title +
 * Cancel/Save in the header, an image+name card and a separate sub-categories card. Reused for both
 * add (`/categories/add`) and edit (`/categories/:id/edit`); edit pre-populates from the loaded doc.
 * Image flow (skill): pick → validate → crop → the compressed upload happens inside the thunk.
 */
const AddEditCategoryPage: FC = () => {
  const { id } = useParams();
  const isEdit = !!id;
  const dispatch = useAppDispatch();
  const navigate = useNavigate();

  const fromList = useAppSelector((s) => s.categories.categories.find((c) => c.id === id));
  const detail = useAppSelector((s) => s.categories.categoryDetail);
  const existing = isEdit ? (fromList ?? (detail?.id === id ? detail : null)) : null;
  const saving = useAppSelector((s) =>
    isEdit ? s.categories.updateLoading : s.categories.createLoading,
  );

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const [subCategories, setSubCategories] = useState<string[]>([]);
  const [subInput, setSubInput] = useState('');
  const [imageBlob, setImageBlob] = useState<Blob | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [cropperSrc, setCropperSrc] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Edit mode: fetch the category if it wasn't already in the list.
  useEffect(() => {
    if (isEdit && !fromList && id) void dispatch(fetchCategoryDetail(id));
  }, [isEdit, fromList, id, dispatch]);

  // Seed the form once the edited category is available.
  useEffect(() => {
    if (existing) {
      reset({ name: existing.name });
      setSubCategories(existing.subCategoryNames);
      setImagePreview(existing.image);
    }
  }, [existing?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!ALLOWED.includes(file.type)) return toast.error('Only JPG, PNG or WebP images are allowed');
    if (file.size > MAX_BYTES) return toast.error('Image must be 2MB or smaller');
    const reader = new FileReader();
    reader.onload = () => setCropperSrc(reader.result as string);
    reader.readAsDataURL(file);
  };

  const onCropped = (blob: Blob) => {
    setImageBlob(blob);
    setImagePreview((prev) => {
      if (prev?.startsWith('blob:')) URL.revokeObjectURL(prev);
      return URL.createObjectURL(blob);
    });
    setCropperSrc(null);
  };

  const addSub = () => {
    const v = subInput.trim();
    if (!v) return;
    if (subCategories.some((s) => s.toLowerCase() === v.toLowerCase())) return toast.error('Already added');
    setSubCategories((p) => [...p, v]);
    setSubInput('');
  };

  const onSubmit = async (values: FormValues) => {
    if (!isEdit && !imageBlob) return toast.error('Add a category image');
    if (subCategories.length === 0) return toast.error('Add at least one sub-category');

    if (isEdit && existing) {
      const res = await dispatch(
        updateCategory({
          id: existing.id,
          name: values.name,
          subCategoryNames: subCategories,
          imageFile: imageBlob,
        }),
      );
      if (updateCategory.fulfilled.match(res)) {
        toast.success('Category updated');
        navigate('/categories');
      } else toast.error((res.payload as string) ?? 'Could not update category');
    } else {
      const res = await dispatch(
        createCategory({ name: values.name, subCategoryNames: subCategories, imageFile: imageBlob! }),
      );
      if (createCategory.fulfilled.match(res)) {
        toast.success('Category created');
        navigate('/categories');
      } else toast.error((res.payload as string) ?? 'Could not create category');
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="p-6">
      {/* Header: title + actions */}
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-[22px] font-extrabold tracking-tight text-foreground">
          {isEdit ? 'Edit category' : 'Add category'}
        </h1>
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => navigate('/categories')}
            disabled={saving}
            className="rounded-md border border-border-strong px-4 py-2 text-[14px] font-semibold text-foreground hover:bg-subtle disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-[14px] font-semibold text-white hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving && <Icon name="Loader4Line" size={16} className="animate-spin" />}
            {isEdit ? 'Update category' : 'Save category'}
          </button>
        </div>
      </div>

      <div className="max-w-3xl space-y-4">
        {/* Image + name card */}
        <div className="rounded-xl border border-border bg-surface p-5 shadow-sm">
          <div className="flex gap-5">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="flex h-24 w-24 shrink-0 flex-col items-center justify-center gap-1 overflow-hidden rounded-lg border border-dashed border-border-strong bg-subtle text-faint hover:border-primary hover:text-primary"
            >
              {imagePreview ? (
                <img src={imagePreview} alt="" className="h-full w-full object-cover" />
              ) : (
                <>
                  <Icon name="AddLine" size={20} />
                  <span className="text-[12px] font-medium">Image</span>
                </>
              )}
            </button>
            <div className="flex-1">
              <label htmlFor="cat-name" className="mb-1.5 block text-[13px] font-semibold text-foreground">
                Category name
              </label>
              <input
                id="cat-name"
                {...register('name')}
                disabled={saving}
                placeholder="e.g. Perfumes"
                className="w-full rounded-md border border-border-strong bg-surface px-3 py-2.5 text-[14px] text-foreground outline-none placeholder:text-faint focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-50"
              />
              {errors.name && <p className="mt-1 text-[12px] text-error">{errors.name.message}</p>}
              <p className="mt-2 text-[12px] text-faint">Image: JPG, PNG or WebP · max 2MB</p>
            </div>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={onFileChange}
            className="hidden"
          />
        </div>

        {/* Sub-categories card */}
        <div className="rounded-xl border border-border bg-surface p-5 shadow-sm">
          <h2 className="mb-3 text-[15px] font-bold text-foreground">Sub-categories</h2>
          <div className="flex gap-2">
            <input
              value={subInput}
              onChange={(e) => setSubInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addSub();
                }
              }}
              placeholder="New sub-category name…"
              className="flex-1 rounded-md border border-border-strong bg-surface px-3 py-2.5 text-[14px] text-foreground outline-none placeholder:text-faint focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
            <button
              type="button"
              onClick={addSub}
              className="rounded-md bg-primary px-4 py-2 text-[14px] font-semibold text-white hover:bg-primary-dark"
            >
              Add
            </button>
          </div>
          {subCategories.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {subCategories.map((s) => (
                <span
                  key={s}
                  className="inline-flex items-center gap-1.5 rounded-md border border-border bg-subtle py-1 pl-3 pr-1.5 text-[13px] font-medium text-foreground"
                >
                  {s}
                  <button
                    type="button"
                    onClick={() => setSubCategories((p) => p.filter((x) => x !== s))}
                    className="text-faint hover:text-error"
                    aria-label={`Remove ${s}`}
                  >
                    <Icon name="CloseLine" size={14} />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {cropperSrc && (
        <ImageCropperModal
          isOpen={!!cropperSrc}
          src={cropperSrc}
          aspectRatio={1}
          onCancel={() => setCropperSrc(null)}
          onCropped={onCropped}
        />
      )}
    </form>
  );
};

export default AddEditCategoryPage;
