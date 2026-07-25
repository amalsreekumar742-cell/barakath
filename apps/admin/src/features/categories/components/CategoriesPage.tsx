import { type FC, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table';
import Skeleton from 'react-loading-skeleton';
import toast from 'react-hot-toast';
import type { CategoryProps } from '@barakath/shared/types';
import { useAppDispatch, useAppSelector } from '@/stores/store';
import Icon from '@/components/icons/Icon';
import ConfirmDialog from '@/components/ConfirmDialog';
import { fetchCategories } from '../api/fetchCategories';
import { deleteCategory } from '../api/deleteCategory';

/**
 * CategoriesPage — the category listing (spec §1.4). Cursor-paginated table (@tanstack/react-table),
 * add/edit via the shared form modal, delete via ConfirmDialog (blocked when the category has products).
 */
const columnHelper = createColumnHelper<CategoryProps>();

const CategoriesPage: FC = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { categories, hasMore, loading, loadingMore, error, lastVisible, deleteLoading } =
    useAppSelector((s) => s.categories);

  const [deleteTarget, setDeleteTarget] = useState<CategoryProps | null>(null);

  // Initial page on mount (only if not already loaded).
  useEffect(() => {
    if (categories.length === 0) void dispatch(fetchCategories({}));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatch]);

  const subCategoryTotal = useMemo(
    () => categories.reduce((n, c) => n + c.subCategoryNames.length, 0),
    [categories],
  );

  const openAdd = () => navigate('/categories/add');
  const openEdit = (c: CategoryProps) => navigate(`/categories/${c.id}/edit`);

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const res = await dispatch(deleteCategory(deleteTarget.id));
    if (deleteCategory.fulfilled.match(res)) {
      toast.success('Category deleted');
      setDeleteTarget(null);
    } else {
      toast.error((res.payload as string) ?? 'Could not delete category');
      setDeleteTarget(null);
    }
  };

  const columns = useMemo(
    () => [
      columnHelper.accessor('name', {
        header: 'Category',
        cell: (ctx) => (
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg border border-border bg-subtle">
              {ctx.row.original.image ? (
                <img src={ctx.row.original.image} alt="" className="h-full w-full object-cover" />
              ) : null}
            </div>
            <span className="text-[14px] font-semibold text-foreground">{ctx.getValue()}</span>
          </div>
        ),
      }),
      columnHelper.accessor('subCategoryNames', {
        header: 'Sub-categories',
        cell: (ctx) => (
          <span className="text-[13px] text-muted">
            {ctx.getValue().length ? ctx.getValue().join(' · ') : '—'}
          </span>
        ),
      }),
      columnHelper.accessor('productCount', {
        header: 'Products',
        cell: (ctx) => <span className="text-[14px] text-foreground">{ctx.getValue() ?? 0}</span>,
      }),
      columnHelper.display({
        id: 'actions',
        header: '',
        cell: (ctx) => (
          <div className="flex items-center justify-end gap-1">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                openEdit(ctx.row.original);
              }}
              className="rounded-md p-1.5 text-muted hover:bg-subtle hover:text-primary"
              aria-label="Edit"
            >
              <Icon name="EditLine" size={18} />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setDeleteTarget(ctx.row.original);
              }}
              className="rounded-md p-1.5 text-muted hover:bg-error-subtle hover:text-error"
              aria-label="Delete"
            >
              <Icon name="CloseLine" size={18} />
            </button>
          </div>
        ),
      }),
    ],
    [navigate],
  );

  const table = useReactTable({
    data: categories,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-extrabold tracking-tight text-foreground">Categories</h1>
          <p className="mt-0.5 text-[13px] text-muted">
            {categories.length} top-level · {subCategoryTotal} sub-categories
          </p>
        </div>
        <button
          type="button"
          onClick={openAdd}
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2.5 text-[14px] font-semibold text-white hover:bg-primary-dark"
        >
          <Icon name="AddLine" size={18} /> Add category
        </button>
      </div>

      {/* Body */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} height={64} borderRadius={12} />
          ))}
        </div>
      ) : error ? (
        <div className="rounded-xl border border-border bg-surface p-10 text-center">
          <p className="text-[14px] text-muted">{error}</p>
          <button
            type="button"
            onClick={() => dispatch(fetchCategories({}))}
            className="mt-3 rounded-md bg-primary px-4 py-2 text-[14px] font-semibold text-white hover:bg-primary-dark"
          >
            Retry
          </button>
        </div>
      ) : categories.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface p-12 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-primary-subtle text-primary">
            <Icon name="GridLine" size={28} />
          </div>
          <h2 className="text-[16px] font-bold text-foreground">No categories yet</h2>
          <p className="mt-1 text-[14px] text-muted">Create your first category to organise products.</p>
          <button
            type="button"
            onClick={openAdd}
            className="mt-4 rounded-md bg-primary px-4 py-2 text-[14px] font-semibold text-white hover:bg-primary-dark"
          >
            Add your first category
          </button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
          <table className="w-full">
            <thead className="border-b border-border bg-subtle/50">
              {table.getHeaderGroups().map((hg) => (
                <tr key={hg.id}>
                  {hg.headers.map((h) => (
                    <th
                      key={h.id}
                      className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-faint"
                    >
                      {flexRender(h.column.columnDef.header, h.getContext())}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  onClick={() => navigate(`/categories/${row.original.id}`)}
                  className="cursor-pointer border-b border-border last:border-0 hover:bg-subtle/40"
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-5 py-3">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>

          {loadingMore && (
            <div className="p-3">
              <Skeleton height={44} borderRadius={8} />
            </div>
          )}

          {hasMore && !loadingMore && (
            <div className="flex justify-center border-t border-border p-3">
              <button
                type="button"
                onClick={() => dispatch(fetchCategories({ cursor: lastVisible }))}
                className="rounded-md border border-border-strong px-4 py-2 text-[14px] font-semibold text-foreground hover:bg-subtle"
              >
                View More
              </button>
            </div>
          )}
        </div>
      )}

      {/* Delete confirm */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        title="Delete category?"
        message={
          deleteTarget
            ? `Are you sure you want to delete "${deleteTarget.name}"? This will also remove all its sub-categories. This action cannot be undone.`
            : ''
        }
        confirmLabel="Delete"
        confirmVariant="danger"
        loading={deleteLoading}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
};

export default CategoriesPage;
