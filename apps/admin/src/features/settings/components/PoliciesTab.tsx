import { type FC, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Skeleton from 'react-loading-skeleton';
import toast from 'react-hot-toast';
import type { Timestamp } from 'firebase/firestore';
import { PolicyStatus } from '@barakath/shared/config/enums';
import { POLICY_LIST_LIMIT } from '@barakath/shared/config/policies';
import type { PolicyProps } from '@barakath/shared/types';
import { useAppDispatch, useAppSelector } from '@/stores/store';
import ConfirmDialog from '@/components/ConfirmDialog';
import Icon from '@/components/icons/Icon';
import { fetchPolicies } from '../api/fetchPolicies';
import { reorderPolicies } from '../api/reorderPolicies';
import { setPolicyStatus } from '../api/setPolicyStatus';
import { policyMoveChanges } from '../utils/policyOrder';
import { NEW_POLICY_PATH, policyEditPath } from '../utils/settingsNav';
import { Toggle } from './ui';

/** "12 Oct 2026", or null when the stamp is missing / not a Timestamp yet. */
function formatUpdated(at: Timestamp | null | undefined): string | null {
  if (!at || typeof at.toDate !== 'function') return null;
  try {
    return at.toDate().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return null;
  }
}

/**
 * PoliciesTab — Settings › Policies: every customer-facing policy (Privacy, Terms, Refund…) in display
 * order, with ▲/▼ reorder, an enable/disable switch, Edit, and "+ Add policy" (the editor is its own
 * route, `/settings/policies/new` · `/settings/policies/:policyId`).
 *
 * WHY there is no Delete: a policy URL is linked from outside (payment gateway, search engines, old app
 * builds), so the rules deny delete outright. Disabling hides it from customers but keeps it here.
 * WHY a move needs no confirmation but a status change does: a move is instantly reversible with the
 * opposite arrow and changes nothing customers read; enabling/disabling publishes or hides a page.
 * WHY every row action is disabled while any write is in flight: two overlapping moves would each
 * compute their swap from the same pre-move list and could leave two policies on the same order.
 * WHY refetch on every mount: the editor saves on another route; refetching here (≤50 docs, one read)
 * is simpler and fresher than threading the saved document back into the list.
 */
const PoliciesTab: FC = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { policies, policyReorderLoading, policyStatusUpdatingId } = useAppSelector((s) => s.settings);

  const [movingId, setMovingId] = useState<string | null>(null);
  const [pendingToggle, setPendingToggle] = useState<PolicyProps | null>(null);

  useEffect(() => {
    void dispatch(fetchPolicies());
  }, [dispatch]);

  const busy = policyReorderLoading || policyStatusUpdatingId !== null;
  const atLimit = policies.items.length >= POLICY_LIST_LIMIT;

  const move = async (index: number, dir: -1 | 1) => {
    const target = policies.items[index];
    const changes = policyMoveChanges(policies.items, index, dir);
    if (!target || changes.length === 0 || busy) return;
    setMovingId(target.id);
    try {
      const res = await dispatch(reorderPolicies(changes));
      if (reorderPolicies.rejected.match(res)) toast.error(res.payload ?? 'Could not reorder the policies');
    } finally {
      setMovingId(null);
    }
  };

  const confirmToggle = async () => {
    if (!pendingToggle) return;
    const { id, name, status } = pendingToggle;
    const next = status === PolicyStatus.ENABLED ? PolicyStatus.DISABLED : PolicyStatus.ENABLED;
    const res = await dispatch(setPolicyStatus({ id, status: next }));
    setPendingToggle(null);
    if (setPolicyStatus.fulfilled.match(res)) {
      toast.success(next === PolicyStatus.ENABLED ? `${name} is now visible` : `${name} hidden — kept in admin`);
    } else {
      toast.error(res.payload ?? 'Could not update the policy');
    }
  };

  const enabling = pendingToggle?.status !== PolicyStatus.ENABLED;

  const renderBody = () => {
    if (policies.error && !policies.loading) {
      return (
        <div className="border-t border-border px-6 py-10 text-center">
          <p className="text-[14px] text-error">{policies.error}</p>
          <button
            type="button"
            onClick={() => void dispatch(fetchPolicies())}
            className="mt-3 rounded-md bg-primary px-4 py-2 text-[14px] font-semibold text-white hover:bg-primary-dark"
          >
            Retry
          </button>
        </div>
      );
    }

    if (!policies.loaded) {
      return (
        <div aria-busy="true" data-testid="policies-skeleton">
          {[0, 1, 2].map((k) => (
            <div key={k} className="flex items-center gap-3 border-t border-border px-6 py-3.5">
              <Skeleton width={18} height={34} />
              <div className="flex-1">
                <Skeleton width="40%" height={14} />
                <Skeleton width="25%" height={11} />
              </div>
              <Skeleton width={44} height={24} borderRadius={999} />
              <Skeleton width={56} height={30} />
            </div>
          ))}
        </div>
      );
    }

    if (policies.items.length === 0) {
      return (
        <div className="border-t border-border px-6 py-12 text-center">
          <p className="text-[14px] font-semibold text-foreground">No policies yet</p>
          <p className="mt-1 text-[13px] text-muted">
            Add your privacy policy, terms and any other policy customers should be able to read.
          </p>
        </div>
      );
    }

    const last = policies.items.length - 1;
    return (
      <ol>
        {policies.items.map((p, i) => {
          const enabled = p.status === PolicyStatus.ENABLED;
          const updated = formatUpdated(p.updatedAt);
          return (
            <li
              key={p.id}
              className={`flex items-center gap-3 border-t border-border px-4 py-3 sm:px-6 ${enabled ? '' : 'opacity-60'}`}
            >
              <div className="flex flex-col">
                <ArrowButton
                  dir="up"
                  label={`Move ${p.name} up`}
                  disabled={busy || i === 0}
                  onClick={() => void move(i, -1)}
                />
                <ArrowButton
                  dir="down"
                  label={`Move ${p.name} down`}
                  disabled={busy || i === last}
                  onClick={() => void move(i, 1)}
                />
              </div>

              <span className="flex w-5 shrink-0 justify-center text-[13px] font-semibold text-faint">
                {movingId === p.id ? <Icon name="Loader4Line" size={14} className="animate-spin" /> : i + 1}
              </span>

              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 items-center gap-2">
                  <h3 className="truncate text-[14px] font-semibold text-foreground">{p.name}</h3>
                  {!enabled && (
                    <span className="shrink-0 rounded-pill border border-border-strong px-2 py-0.5 text-[11px] font-semibold text-muted">
                      Hidden
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-[12px] text-faint">{updated ? `Updated ${updated}` : 'Not yet saved'}</p>
              </div>

              {policyStatusUpdatingId === p.id && (
                <Icon name="Loader4Line" size={16} className="shrink-0 animate-spin text-faint" />
              )}
              <Toggle
                on={enabled}
                onChange={() => setPendingToggle(p)}
                ariaLabel={`${p.name} visible to customers`}
                disabled={busy}
              />

              <button
                type="button"
                onClick={() => navigate(policyEditPath(p.id))}
                aria-label={`Edit ${p.name}`}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[13px] font-semibold text-primary hover:bg-primary-subtle"
              >
                <Icon name="EditLine" size={15} />
                <span className="hidden sm:inline">Edit</span>
              </button>
            </li>
          );
        })}
      </ol>
    );
  };

  return (
    <section className="overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3 p-6 pb-4">
        <div className="min-w-0">
          <h2 className="text-[16px] font-bold tracking-tight text-foreground">Policies</h2>
          <p className="mt-1 text-[13px] text-muted">
            Enabled policies are shown to customers on the website and in the app. Disable one to hide it —
            it stays here.
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigate(NEW_POLICY_PATH)}
          disabled={atLimit}
          title={atLimit ? `You can have at most ${POLICY_LIST_LIMIT} policies` : undefined}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-[14px] font-semibold text-white transition-colors hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Icon name="AddLine" size={16} /> Add policy
        </button>
      </div>

      {renderBody()}

      <ConfirmDialog
        isOpen={pendingToggle !== null}
        title={enabling ? `Show ${pendingToggle?.name ?? 'policy'}?` : `Hide ${pendingToggle?.name ?? 'policy'}?`}
        message={
          enabling
            ? 'Customers will see this policy on the website and in the app.'
            : 'Customers will no longer see this policy on the website or in the app. It stays here and you can enable it again any time.'
        }
        confirmLabel={enabling ? 'Enable' : 'Disable'}
        loading={pendingToggle !== null && policyStatusUpdatingId === pendingToggle.id}
        onConfirm={() => void confirmToggle()}
        onCancel={() => setPendingToggle(null)}
      />
    </section>
  );
};

/** One ▲/▼ reorder control. */
const ArrowButton: FC<{ dir: 'up' | 'down'; label: string; disabled: boolean; onClick: () => void }> = ({
  dir,
  label,
  disabled,
  onClick,
}) => (
  <button
    type="button"
    aria-label={label}
    title={dir === 'up' ? 'Move up' : 'Move down'}
    disabled={disabled}
    onClick={onClick}
    className="flex h-[17px] w-6 items-center justify-center rounded text-faint transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-30"
  >
    <Icon name={dir === 'up' ? 'ArrowUpLine' : 'ArrowDownLine'} size={14} />
  </button>
);

export default PoliciesTab;
