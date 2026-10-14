import type { FC } from 'react';
import Icon from '@/components/icons/Icon';
import { bulkActionLabel, canCancel } from '../utils/orderFlow';

interface Props {
  count: number;
  /** The status every selected order shares (same-status selection). */
  status: string;
  /** Selected orders that are not Paid — advancing skips them (see `unpaidAdvanceReason`). */
  unpaidCount: number;
  progress: { done: number; total: number } | null;
  onAdvance: () => void;
  onCancel: () => void;
  onClear: () => void;
}

/**
 * BulkActionBar — the strip shown above the orders table while orders are ticked (spec §1.7). Offers the
 * selection's single next step and, for Pending orders, Cancel. While a bulk run is in flight the actions
 * give way to an "Updating 3/5…" counter so nothing can be double-submitted.
 */
const BulkActionBar: FC<Props> = ({ count, status, unpaidCount, progress, onAdvance, onCancel, onClear }) => {
  const advanceLabel = bulkActionLabel(status);
  const busy = progress !== null;

  return (
    <div className="mb-3 flex flex-wrap items-center gap-3 rounded-xl border border-primary/30 bg-primary-subtle px-4 py-3">
      <p className="text-[13px] font-semibold text-foreground">
        {count} {status.toLowerCase()} order{count === 1 ? '' : 's'} selected
      </p>
      {unpaidCount > 0 && advanceLabel && !busy && (
        <p className="text-[12px] text-muted">
          {unpaidCount} unpaid will be skipped
        </p>
      )}

      <div className="ml-auto flex flex-wrap items-center gap-2">
        {busy ? (
          <span className="inline-flex items-center gap-2 text-[13px] font-semibold text-primary">
            <Icon name="Loader4Line" size={16} className="animate-spin" />
            Updating {progress.done}/{progress.total}…
          </span>
        ) : (
          <>
            {advanceLabel && (
              <button
                type="button"
                onClick={onAdvance}
                className="rounded-md bg-primary px-4 py-2 text-[13px] font-semibold text-white hover:bg-primary-dark"
              >
                {advanceLabel}
              </button>
            )}
            {canCancel(status) && (
              <button
                type="button"
                onClick={onCancel}
                className="rounded-md border border-error px-4 py-2 text-[13px] font-semibold text-error hover:bg-error-subtle"
              >
                Cancel orders
              </button>
            )}
            <button
              type="button"
              onClick={onClear}
              className="rounded-md border border-border-strong bg-surface px-4 py-2 text-[13px] font-semibold text-foreground hover:bg-subtle"
            >
              Clear
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default BulkActionBar;
