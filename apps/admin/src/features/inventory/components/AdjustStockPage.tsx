import { type FC, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Skeleton from 'react-loading-skeleton';
import toast from 'react-hot-toast';
import { useAppDispatch, useAppSelector } from '@/stores/store';
import Icon from '@/components/icons/Icon';
import ConfirmDialog from '@/components/ConfirmDialog';
import { fetchInventory } from '../api/fetchInventory';
import { fetchInventoryCounts } from '../api/fetchInventoryCounts';
import { adjustStockBatch } from '../api/adjustStockBatch';
import { setInventorySearch } from '../stores/inventorySlice';
import type { StockEdit } from '../types';

/**
 * AdjustStockPage — adjust the stock of MANY variants (SKUs) at once and save them in one batch
 * (spec §1.6 Adjust Stock Page): a left-hand −/+ table over the variant list + a right panel for the
 * required Reason and optional Reference/note. Stock is blocked at 0. Each change is logged to
 * `stockAdjustments`; a confirmation dialog + toast gate the save.
 */
const AdjustStockPage: FC = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { rows, hasMore, loading, loadingMore, error, lastVisible, filters, adjustLoading } =
    useAppSelector((s) => s.inventory);
  const admin = useAppSelector((s) => s.currentAdmin.admin);

  const [searchInput, setSearchInput] = useState('');
  const [edits, setEdits] = useState<Record<string, number>>({});
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);

  // Load page one on mount (fresh stock numbers).
  useEffect(() => {
    void dispatch(fetchInventory({ filters, cursor: null }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatch, filters]);

  // Debounced search.
  useEffect(() => {
    const t = setTimeout(() => {
      if ((filters.searchTerm ?? '') !== searchInput) dispatch(setInventorySearch(searchInput));
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput, dispatch]);

  // Seed editable stock for any newly-loaded variants without clobbering in-progress edits.
  useEffect(() => {
    setEdits((prev) => {
      const next = { ...prev };
      for (const r of rows) if (!(r.variantId in next)) next[r.variantId] = r.stock;
      return next;
    });
  }, [rows]);

  const setStock = (variantId: string, value: number) =>
    setEdits((e) => ({ ...e, [variantId]: Math.max(0, Math.round(Number.isFinite(value) ? value : 0)) }));

  const changed = useMemo(
    () => rows.filter((r) => (edits[r.variantId] ?? r.stock) !== r.stock),
    [rows, edits],
  );

  const requestSave = () => {
    if (!reason.trim()) return toast.error('Reason is required');
    if (changed.length === 0) return toast.error('Adjust at least one SKU');
    setConfirmOpen(true);
  };

  const doSave = async () => {
    if (!admin) return;
    const editList: StockEdit[] = changed.map((r) => ({
      productId: r.productId,
      productName: r.productName,
      productSku: r.productSku,
      variantId: r.variantId,
      variantName: r.variantName,
      variantLabel: r.variantLabel,
      lowStockThreshold: r.lowStockThreshold,
      previousStock: r.stock,
      newStock: edits[r.variantId] ?? r.stock,
    }));
    const res = await dispatch(
      adjustStockBatch({ edits: editList, reason, note, adjustedBy: admin.id, adjustedByName: admin.fullName }),
    );
    setConfirmOpen(false);
    if (adjustStockBatch.fulfilled.match(res)) {
      toast.success(`Stock updated for ${editList.length} SKU${editList.length === 1 ? '' : 's'}`);
      void dispatch(fetchInventoryCounts());
      navigate('/inventory');
    } else {
      toast.error((res.payload as string) ?? 'Could not adjust stock');
    }
  };

  return (
    <div className="p-6">
      <div className="mb-5 flex items-center gap-2">
        <button
          type="button"
          onClick={() => navigate('/inventory')}
          className="rounded-md p-1.5 text-muted hover:bg-subtle hover:text-foreground"
          aria-label="Back"
        >
          <Icon name="ArrowLeftLine" size={20} />
        </button>
        <div>
          <h1 className="text-[22px] font-extrabold tracking-tight text-foreground">Adjust stock</h1>
          <p className="mt-0.5 text-[13px] text-muted">Update stock for one or more SKUs, then save.</p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Left: variant table with -/+ */}
        <div className="lg:col-span-2">
          <div className="mb-4">
            <div className="relative max-w-sm">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint">
                <Icon name="SearchLine" size={16} />
              </span>
              <input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search SKUs to adjust…"
                className="w-full rounded-md border border-border-strong bg-surface py-2.5 pl-9 pr-3 text-[14px] outline-none placeholder:text-faint focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </div>
          </div>

          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} height={56} borderRadius={12} />
              ))}
            </div>
          ) : error ? (
            <div className="rounded-xl border border-border bg-surface p-10 text-center">
              <p className="text-[14px] text-muted">{error}</p>
            </div>
          ) : rows.length === 0 ? (
            <div className="rounded-xl border border-border bg-surface p-12 text-center">
              <h2 className="text-[16px] font-bold text-foreground">No SKUs found</h2>
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
              <table className="w-full">
                <thead className="border-b border-border bg-subtle/50">
                  <tr>
                    <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-faint">Product · variant</th>
                    <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-faint">SKU</th>
                    <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-faint">In stock</th>
                    <th className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-faint">Adjust</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const val = edits[r.variantId] ?? r.stock;
                    const diff = val - r.stock;
                    return (
                      <tr key={r.variantId} className="border-b border-border last:border-0">
                        <td className="px-5 py-3">
                          <p className="text-[13px] font-semibold text-foreground">{r.productName}</p>
                          <div className="mt-0.5 flex items-center gap-1.5 text-[12px] text-muted">
                            {r.variantLabel !== '—' && (
                              <span className="h-3 w-3 rounded-full border border-border" style={{ backgroundColor: r.colorCode }} />
                            )}
                            {r.variantLabel}
                          </div>
                        </td>
                        <td className="px-5 py-3 font-mono text-[12px] text-muted">{r.sku}</td>
                        <td className="px-5 py-3">
                          <span className="text-[13px] text-muted">{r.stock}</span>
                          {diff !== 0 && (
                            <span className={`ml-2 text-[12px] font-bold ${diff > 0 ? 'text-success' : 'text-error'}`}>
                              {diff > 0 ? `+${diff}` : diff}
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-3">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => setStock(r.variantId, val - 1)}
                              disabled={val <= 0}
                              className="flex h-8 w-8 items-center justify-center rounded-md border border-border-strong text-foreground hover:bg-subtle disabled:opacity-40"
                              aria-label="Decrease"
                            >
                              <Icon name="CloseLine" size={14} />
                            </button>
                            <input
                              type="number"
                              min={0}
                              value={val}
                              onChange={(e) => setStock(r.variantId, Number(e.target.value))}
                              className="w-16 rounded-md border border-border-strong bg-surface px-2 py-1.5 text-center text-[13px] outline-none focus:border-primary"
                            />
                            <button
                              type="button"
                              onClick={() => setStock(r.variantId, val + 1)}
                              className="flex h-8 w-8 items-center justify-center rounded-md border border-border-strong text-foreground hover:bg-subtle"
                              aria-label="Increase"
                            >
                              <Icon name="AddLine" size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
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
                    onClick={() => dispatch(fetchInventory({ filters, cursor: lastVisible }))}
                    className="rounded-md border border-border-strong px-4 py-2 text-[14px] font-semibold text-foreground hover:bg-subtle"
                  >
                    View More
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right: reason / note panel */}
        <div>
          <div className="sticky top-6 rounded-xl border border-border bg-surface p-5 shadow-sm">
            <h2 className="text-[14px] font-bold tracking-tight text-foreground">Adjustment details</h2>
            <p className="mt-1 text-[12px] text-muted">
              {changed.length} SKU{changed.length === 1 ? '' : 's'} changed
            </p>

            <div className="mt-4 space-y-4">
              <div>
                <label className="mb-1.5 block text-[13px] font-semibold text-foreground">
                  Reason <span className="text-error">*</span>
                </label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={3}
                  placeholder="e.g. Restock from supplier, Damaged goods, Inventory count correction"
                  className="w-full resize-none rounded-md border border-border-strong bg-surface px-3 py-2 text-[14px] outline-none placeholder:text-faint focus:border-primary"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-[13px] font-semibold text-foreground">
                  Reference / note <span className="text-faint">(optional)</span>
                </label>
                <input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="e.g. GRN-2043"
                  className="w-full rounded-md border border-border-strong bg-surface px-3 py-2 text-[14px] outline-none placeholder:text-faint focus:border-primary"
                />
              </div>
            </div>

            <div className="mt-5 flex flex-col gap-2">
              <button
                type="button"
                onClick={requestSave}
                disabled={changed.length === 0}
                className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-5 py-2.5 text-[14px] font-semibold text-white hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-50"
              >
                Save adjustments {changed.length > 0 ? `(${changed.length})` : ''}
              </button>
              <button
                type="button"
                onClick={() => navigate('/inventory')}
                className="rounded-md border border-border-strong px-5 py-2.5 text-[14px] font-semibold text-foreground hover:bg-subtle"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>

      <ConfirmDialog
        isOpen={confirmOpen}
        title="Save stock adjustments?"
        message={`This will update ${changed.length} SKU${changed.length === 1 ? '' : 's'} and log the change. Continue?`}
        confirmLabel="Save"
        loading={adjustLoading}
        onConfirm={doSave}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
};

export default AdjustStockPage;
