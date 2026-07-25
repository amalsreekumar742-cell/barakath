import { type FC, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Skeleton from 'react-loading-skeleton';
import toast from 'react-hot-toast';
import type { ProductProps } from '@barakath/shared/types';
import { useAppDispatch, useAppSelector } from '@/stores/store';
import Icon from '@/components/icons/Icon';
import ConfirmDialog from '@/components/ConfirmDialog';
import { formatShortDate } from '@/utils/format';
import { fetchNewArrivals } from '../api/fetchNewArrivals';
import { removeNewArrival } from '../api/removeNewArrival';

/**
 * NewArrivalsPage — the curated list of products flagged `isNewArrival` (spec §1.17 / prototype "Growth ›
 * New Arrivals"): a table of Product · Category · Added · Status · delete. Status reflects the product's
 * storefront visibility (Active → Visible, Archived → Hidden). "+ Add products" opens the add page;
 * removing a row clears the flag (the product itself is not deleted). Cursor-paginated with View More.
 */
const NewArrivalsPage: FC = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { newArrivals, hasMore, loading, loadingMore, error, lastVisible } = useAppSelector(
    (s) => s.newArrivals,
  );

  useEffect(() => {
    void dispatch(fetchNewArrivals({ cursor: null }));
  }, [dispatch]);

  return (
    <div className="p-6">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[24px] font-extrabold tracking-tight text-foreground">New Arrivals</h1>
          <p className="mt-1.5 text-[13px] text-muted">Curated from existing products</p>
        </div>
        <button
          type="button"
          onClick={() => navigate('/new-arrivals/add')}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-primary px-4 py-2.5 text-[14px] font-semibold text-white hover:bg-primary-dark"
        >
          <Icon name="AddLine" size={16} /> Add products
        </button>
      </div>

      {/* Body */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} height={52} borderRadius={12} />
          ))}
        </div>
      ) : error ? (
        <div className="rounded-xl border border-border bg-surface p-10 text-center">
          <p className="text-[14px] text-muted">{error}</p>
          <button
            type="button"
            onClick={() => dispatch(fetchNewArrivals({ cursor: null }))}
            className="mt-3 rounded-md bg-primary px-4 py-2 text-[14px] font-semibold text-white hover:bg-primary-dark"
          >
            Retry
          </button>
        </div>
      ) : newArrivals.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface p-12 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-primary-subtle text-primary">
            <Icon name="SparklingLine" size={28} />
          </div>
          <h2 className="text-[16px] font-bold text-foreground">No products marked as new arrivals</h2>
          <button
            type="button"
            onClick={() => navigate('/new-arrivals/add')}
            className="mt-4 inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-[14px] font-semibold text-white hover:bg-primary-dark"
          >
            <Icon name="AddLine" size={16} /> Add products
          </button>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-surface shadow-sm">
          <table className="w-full min-w-[720px]">
            <thead className="border-b border-border bg-subtle/50">
              <tr>
                {['Product', 'Category', 'Added', 'Status', ''].map((h, i) => (
                  <th
                    key={h || `actions-${i}`}
                    className="px-5 py-3 text-left text-[11px] font-bold uppercase tracking-wide text-faint"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {newArrivals.map((p) => (
                <tr key={p.id} className="border-b border-border last:border-0 hover:bg-subtle/40">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="h-[34px] w-[34px] shrink-0 overflow-hidden rounded-md bg-subtle">
                        {p.thumbnail ? (
                          <img src={p.thumbnail} alt="" className="h-full w-full object-cover" />
                        ) : null}
                      </div>
                      <span className="text-[13px] font-bold text-foreground">{p.name}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-[13px] text-muted">{p.categoryName || '—'}</td>
                  <td className="whitespace-nowrap px-5 py-3 text-[13px] text-muted">
                    {formatShortDate(p.createdAt)}
                  </td>
                  <td className="px-5 py-3">
                    <VisibilityBadge product={p} />
                  </td>
                  <td className="px-5 py-3">
                    <RemoveAction product={p} />
                  </td>
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
                onClick={() => dispatch(fetchNewArrivals({ cursor: lastVisible }))}
                className="rounded-md border border-border-strong px-4 py-2 text-[14px] font-semibold text-foreground hover:bg-subtle"
              >
                View More
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

/** Visible (Active product) / Hidden (Archived) status pill, per the prototype. */
const VisibilityBadge: FC<{ product: ProductProps }> = ({ product }) => {
  const visible = product.status === 'Active';
  return (
    <span
      className={`inline-flex items-center rounded-md px-2.5 py-1 text-[11px] font-bold ${
        visible ? 'bg-success-subtle text-success' : 'bg-subtle text-muted'
      }`}
    >
      {visible ? 'Visible' : 'Hidden'}
    </span>
  );
};

/**
 * RemoveAction — the per-row remove ✕ (spec §1.17: removing only clears the flag, the product stays).
 * Confirmed (§1.22). WHY its own component reading the store: keeps each row's confirm-dialog state + the
 * per-row remove spinner (removeLoading === productId) local.
 */
const RemoveAction: FC<{ product: ProductProps }> = ({ product }) => {
  const dispatch = useAppDispatch();
  const removeLoading = useAppSelector((s) => s.newArrivals.removeLoading);
  const [confirm, setConfirm] = useState(false);
  const removing = removeLoading === product.id;

  const onRemove = async () => {
    const res = await dispatch(removeNewArrival(product.id));
    setConfirm(false);
    if (removeNewArrival.fulfilled.match(res)) toast.success('Removed from New Arrivals');
    else toast.error((res.payload as string) ?? 'Could not remove product');
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setConfirm(true)}
        disabled={removing}
        className="inline-flex rounded-md p-1.5 text-error hover:bg-error-subtle disabled:opacity-50"
        aria-label="Remove from new arrivals"
      >
        {removing ? <Icon name="Loader4Line" size={18} className="animate-spin" /> : <Icon name="CloseLine" size={18} />}
      </button>

      <ConfirmDialog
        isOpen={confirm}
        title="Remove from New Arrivals?"
        message={`Remove "${product.name}" from New Arrivals? The product itself is not deleted.`}
        confirmLabel="Remove"
        confirmVariant="danger"
        loading={removing}
        onConfirm={onRemove}
        onCancel={() => setConfirm(false)}
      />
    </>
  );
};

export default NewArrivalsPage;
