import { type FC, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Skeleton from 'react-loading-skeleton';
import toast from 'react-hot-toast';
import type { FlashSaleProps } from '@barakath/shared/types';
import { useAppDispatch, useAppSelector } from '@/stores/store';
import Icon from '@/components/icons/Icon';
import ConfirmDialog from '@/components/ConfirmDialog';
import { formatINR } from '@/utils/format';
import { fetchFlashSales } from '../api/fetchFlashSales';
import { deleteFlashSale } from '../api/deleteFlashSale';
import { toggleFlashSaleActive } from '../api/toggleFlashSaleActive';

/** Discount column label: "{value}% off" (percentage) or "₹{value} flat" (fixed price). */
function discountLabel(fs: FlashSaleProps): string {
  return fs.discountType === 'Percentage' ? `${fs.discountValue}% off` : `${formatINR(fs.discountValue)} flat`;
}

/** Compact date+time — e.g. "12 Jul, 12:00 PM". */
function shortDT(ms: number): string {
  return new Date(ms).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

/** Window column label: the start→end range, or "ended {date}" once the sale has finished. */
function windowLabel(fs: FlashSaleProps): string {
  const end = fs.endDate.toMillis();
  if (end <= Date.now()) return `ended ${shortDT(end)}`;
  return `${shortDT(fs.startDate.toMillis())} → ${shortDT(end)}`;
}

/** True when the sale's window has ended (its toggle can no longer make it live). */
const isEnded = (fs: FlashSaleProps): boolean => fs.endDate.toMillis() <= Date.now();

/**
 * FlashSalePage — the flash-sale list (spec §1.16 / prototype "Growth › Flash Sale"): a table of Sale name
 * · Products · Discount · Window · On/off · delete. There is no edit after creation (spec §1.16) — only
 * the On/off toggle and delete, each confirmed (§1.22). Cursor-paginated with View More.
 */
const FlashSalePage: FC = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { flashSales, hasMore, loading, loadingMore, error, lastVisible, filters } = useAppSelector(
    (s) => s.flashSale,
  );

  useEffect(() => {
    void dispatch(fetchFlashSales({ filters, cursor: null }));
  }, [dispatch, filters]);

  return (
    <div className="p-6">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[24px] font-extrabold tracking-tight text-foreground">Flash Sale</h1>
          <p className="mt-1.5 text-[13px] text-muted">Time-boxed discounts · toggle on/off</p>
        </div>
        <button
          type="button"
          onClick={() => navigate('/flash-sale/create')}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-primary px-4 py-2.5 text-[14px] font-semibold text-white hover:bg-primary-dark"
        >
          <Icon name="AddLine" size={16} /> Add flash sale
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
            onClick={() => dispatch(fetchFlashSales({ filters, cursor: null }))}
            className="mt-3 rounded-md bg-primary px-4 py-2 text-[14px] font-semibold text-white hover:bg-primary-dark"
          >
            Retry
          </button>
        </div>
      ) : flashSales.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface p-12 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-primary-subtle text-primary">
            <Icon name="FlashlightLine" size={28} />
          </div>
          <h2 className="text-[16px] font-bold text-foreground">No flash sales</h2>
          <button
            type="button"
            onClick={() => navigate('/flash-sale/create')}
            className="mt-4 inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-[14px] font-semibold text-white hover:bg-primary-dark"
          >
            <Icon name="AddLine" size={16} /> Create your first flash sale
          </button>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-surface shadow-sm">
          <table className="w-full min-w-[820px]">
            <thead className="border-b border-border bg-subtle/50">
              <tr>
                {['Sale name', 'Products', 'Discount', 'Window', 'On / off', ''].map((h, i) => (
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
              {flashSales.map((fs) => (
                <tr key={fs.id} className="border-b border-border last:border-0 hover:bg-subtle/40">
                  <td className="px-5 py-3 text-[13px] font-bold text-foreground">{fs.name}</td>
                  <td className="px-5 py-3 text-[13px] text-muted">{fs.products.length}</td>
                  <td className="px-5 py-3 text-[13px] font-semibold text-foreground">{discountLabel(fs)}</td>
                  <td className="whitespace-nowrap px-5 py-3 text-[13px] text-muted">{windowLabel(fs)}</td>
                  <td className="px-5 py-3">
                    <OnOffToggle flashSale={fs} />
                  </td>
                  <td className="px-5 py-3">
                    <DeleteAction flashSale={fs} />
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
                onClick={() => dispatch(fetchFlashSales({ filters, cursor: lastVisible }))}
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

/**
 * OnOffToggle — the On/off switch for one sale (spec §1.16 + §1.22: confirmed). An ended sale's toggle is
 * shown off + disabled (its window has passed). WHY its own component reading the store: keeps the per-row
 * toggle spinner + confirm-dialog state local.
 */
const OnOffToggle: FC<{ flashSale: FlashSaleProps }> = ({ flashSale }) => {
  const dispatch = useAppDispatch();
  const toggleLoading = useAppSelector((s) => s.flashSale.toggleLoading);
  const [confirm, setConfirm] = useState(false);
  const toggling = toggleLoading === flashSale.id;
  const ended = isEnded(flashSale);
  const on = flashSale.isActive && !ended;

  const onToggle = async () => {
    const next = !flashSale.isActive;
    const res = await dispatch(toggleFlashSaleActive({ flashSaleId: flashSale.id, isActive: next }));
    setConfirm(false);
    if (toggleFlashSaleActive.fulfilled.match(res)) toast.success(next ? 'Flash sale activated' : 'Flash sale deactivated');
    else toast.error((res.payload as string) ?? 'Could not update flash sale');
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setConfirm(true)}
        disabled={toggling || ended}
        aria-label={on ? 'Deactivate flash sale' : 'Activate flash sale'}
        className="flex items-center disabled:cursor-not-allowed disabled:opacity-60"
      >
        {toggling ? (
          <Icon name="Loader4Line" size={18} className="animate-spin text-muted" />
        ) : (
          <span
            className={`relative h-6 w-11 shrink-0 rounded-pill transition-colors ${on ? 'bg-primary' : 'bg-border-strong'}`}
          >
            <span
              className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-all ${on ? 'left-[22px]' : 'left-0.5'}`}
            />
          </span>
        )}
      </button>

      <ConfirmDialog
        isOpen={confirm}
        title={flashSale.isActive ? 'Deactivate flash sale?' : 'Activate flash sale?'}
        message={
          flashSale.isActive
            ? 'This removes flash pricing from every product in the sale until reactivated.'
            : 'This applies flash pricing to every product in the sale.'
        }
        confirmLabel={flashSale.isActive ? 'Deactivate' : 'Activate'}
        confirmVariant={flashSale.isActive ? 'danger' : 'primary'}
        loading={toggling}
        onConfirm={onToggle}
        onCancel={() => setConfirm(false)}
      />
    </>
  );
};

/** DeleteAction — the delete ✕ for one sale, confirmed (spec §1.22); reverts pricing on all its products. */
const DeleteAction: FC<{ flashSale: FlashSaleProps }> = ({ flashSale }) => {
  const dispatch = useAppDispatch();
  const deleteLoading = useAppSelector((s) => s.flashSale.deleteLoading);
  const [confirm, setConfirm] = useState(false);

  const onDelete = async () => {
    const res = await dispatch(deleteFlashSale(flashSale.id));
    setConfirm(false);
    if (deleteFlashSale.fulfilled.match(res)) toast.success('Flash sale deleted');
    else toast.error((res.payload as string) ?? 'Could not delete flash sale');
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setConfirm(true)}
        aria-label="Delete flash sale"
        className="inline-flex rounded-md p-1.5 text-error hover:bg-error-subtle"
      >
        <Icon name="CloseLine" size={18} />
      </button>

      <ConfirmDialog
        isOpen={confirm}
        title="Delete flash sale?"
        message="This removes flash pricing from every product in the sale and deletes it. Continue?"
        confirmLabel="Delete"
        confirmVariant="danger"
        loading={deleteLoading}
        onConfirm={onDelete}
        onCancel={() => setConfirm(false)}
      />
    </>
  );
};

export default FlashSalePage;
