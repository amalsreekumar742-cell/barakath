import { type FC, useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Skeleton from 'react-loading-skeleton';
import toast from 'react-hot-toast';
import { useAppDispatch, useAppSelector } from '@/stores/store';
import Icon from '@/components/icons/Icon';
import ConfirmDialog from '@/components/ConfirmDialog';
import { fetchCategoryDetail } from '../api/fetchCategoryDetail';
import { fetchSubCategories } from '../api/fetchSubCategories';
import { fetchSubCategoryProducts } from '../api/fetchSubCategoryProducts';
import { addSubCategory } from '../api/addSubCategory';
import { deleteSubCategory } from '../api/deleteSubCategory';
import { resetCategoryDetail } from '../stores/categoriesSlice';

/**
 * SubCategoriesPage — a category's sub-category DOCUMENTS (design screen 07; spec §1.4).
 *
 * Sub-categories are their own docs (`categories/{id}/subCategories`), so each row has a stable id +
 * live product count (by subCategoryId). Add creates a doc; delete is guarded (blocked when the
 * sub-category still has products). Per spec §1.4/§1.22: no slug, no status/visibility, no drag.
 */
const SubCategoriesPage: FC = () => {
  const { id = '' } = useParams();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const {
    categoryDetail,
    detailLoading,
    detailError,
    subCategories,
    subCategoriesLoading,
    subCategoryProductCounts,
  } = useAppSelector((s) => s.categories);

  const [showAdd, setShowAdd] = useState(false);
  const [newSub, setNewSub] = useState('');
  const [adding, setAdding] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    void dispatch(fetchCategoryDetail(id));
    void dispatch(fetchSubCategories({ categoryId: id }));
    return () => {
      dispatch(resetCategoryDetail());
    };
  }, [dispatch, id]);

  // Fetch a product count for each sub-category doc (by id).
  useEffect(() => {
    subCategories.forEach((sc) => void dispatch(fetchSubCategoryProducts({ subCategoryId: sc.id })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subCategories.length]);

  const handleAdd = async () => {
    const v = newSub.trim();
    if (!v) return;
    if (subCategories.some((sc) => sc.name.toLowerCase() === v.toLowerCase())) {
      return toast.error('Already added');
    }
    setAdding(true);
    const res = await dispatch(addSubCategory({ categoryId: id, subCategoryName: v }));
    setAdding(false);
    if (addSubCategory.fulfilled.match(res)) {
      toast.success('Sub-category added');
      setNewSub('');
      setShowAdd(false);
      void dispatch(fetchSubCategoryProducts({ subCategoryId: res.payload.subCategory.id }));
    } else {
      toast.error((res.payload as string) ?? 'Could not add sub-category');
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    const res = await dispatch(
      deleteSubCategory({
        categoryId: id,
        subCategoryId: deleteTarget.id,
        subCategoryName: deleteTarget.name,
      }),
    );
    setDeleting(false);
    toast[deleteSubCategory.fulfilled.match(res) ? 'success' : 'error'](
      deleteSubCategory.fulfilled.match(res)
        ? 'Sub-category deleted'
        : ((res.payload as string) ?? 'Could not delete sub-category'),
    );
    setDeleteTarget(null);
  };

  return (
    <div className="p-6">
      <button
        type="button"
        onClick={() => navigate('/categories')}
        className="mb-4 inline-flex items-center gap-1 text-[13px] font-medium text-muted hover:text-primary"
      >
        <Icon name="ArrowLeftLine" size={16} /> Categories
      </button>

      {detailLoading ? (
        <Skeleton height={40} width={320} />
      ) : detailError ? (
        <div className="rounded-xl border border-border bg-surface p-8 text-center text-[14px] text-muted">
          {detailError}
        </div>
      ) : categoryDetail ? (
        <>
          {/* Header */}
          <div className="mb-6 flex items-start justify-between">
            <div>
              <h1 className="text-[22px] font-extrabold tracking-tight text-foreground">
                {categoryDetail.name} · sub-categories
              </h1>
              <p className="mt-0.5 text-[13px] text-muted">{subCategories.length} sub-categories</p>
            </div>
            <button
              type="button"
              onClick={() => setShowAdd((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2.5 text-[14px] font-semibold text-white hover:bg-primary-dark"
            >
              <Icon name="AddLine" size={18} /> Add sub-category
            </button>
          </div>

          {/* Inline add form */}
          {showAdd && (
            <div className="mb-4 flex gap-2 rounded-xl border border-border bg-surface p-3 shadow-sm">
              <input
                autoFocus
                value={newSub}
                onChange={(e) => setNewSub(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                placeholder="New sub-category name…"
                className="flex-1 rounded-md border border-border-strong bg-surface px-3 py-2.5 text-[14px] text-foreground outline-none placeholder:text-faint focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
              <button
                type="button"
                onClick={handleAdd}
                disabled={adding}
                className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2.5 text-[14px] font-semibold text-white hover:bg-primary-dark disabled:opacity-50"
              >
                {adding && <Icon name="Loader4Line" size={16} className="animate-spin" />}
                Add
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowAdd(false);
                  setNewSub('');
                }}
                className="rounded-md border border-border-strong px-4 py-2.5 text-[14px] font-semibold text-foreground hover:bg-subtle"
              >
                Cancel
              </button>
            </div>
          )}

          {/* Table */}
          {subCategoriesLoading && subCategories.length === 0 ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} height={52} borderRadius={12} />
              ))}
            </div>
          ) : subCategories.length === 0 ? (
            <div className="rounded-xl border border-border bg-surface p-10 text-center text-[14px] text-muted">
              No sub-categories yet
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
              <table className="w-full">
                <thead className="border-b border-border bg-subtle/50">
                  <tr>
                    <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-faint">
                      Sub-category
                    </th>
                    <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-faint">
                      Products
                    </th>
                    <th className="px-5 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {subCategories.map((sc) => (
                    <tr key={sc.id} className="border-b border-border last:border-0 hover:bg-subtle/40">
                      <td className="px-5 py-3 text-[14px] font-semibold text-foreground">{sc.name}</td>
                      <td className="px-5 py-3 text-[14px] text-muted">
                        {subCategoryProductCounts[sc.id] ?? <Skeleton width={24} />}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => setDeleteTarget({ id: sc.id, name: sc.name })}
                          className="rounded-md p-1.5 text-muted hover:bg-error-subtle hover:text-error"
                          aria-label={`Delete ${sc.name}`}
                        >
                          <Icon name="CloseLine" size={18} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      ) : null}

      <ConfirmDialog
        isOpen={!!deleteTarget}
        title="Delete sub-category?"
        message={
          deleteTarget
            ? `Delete "${deleteTarget.name}"? This can't be undone. It's blocked if products still use it.`
            : ''
        }
        confirmLabel="Delete"
        confirmVariant="danger"
        loading={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
};

export default SubCategoriesPage;
