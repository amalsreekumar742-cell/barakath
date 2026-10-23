import { type FC, type ReactNode, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import Skeleton from 'react-loading-skeleton';
import { POLICY_LIST_LIMIT } from '@barakath/shared/config/policies';
import { useAppDispatch, useAppSelector } from '@/stores/store';
import Icon from '@/components/icons/Icon';
import { fetchPolicies } from '../api/fetchPolicies';
import { fetchPolicy } from '../api/fetchPolicy';
import { resetPolicyEditor } from '../stores/settingsSlice';
import { useBackToPolicies } from '../hooks/useBackToPolicies';
import PolicyForm from './PolicyForm';

/**
 * PolicyEditorPage — `/settings/policies/new` (Add policy) and `/settings/policies/:policyId` (edit).
 * Owns the loading / error / not-found states and mounts the form only once its starting values are
 * known, so the form can seed react-hook-form's `defaultValues` once instead of resetting mid-edit.
 *
 * Edit: always re-reads the policy (fresh content beats a possibly stale list row) and clears it on
 * unmount. Add: needs the list only to default "Display order" to count + 1 and to warn at the
 * POLICY_LIST_LIMIT cap — it reuses the list if the Policies tab already loaded it.
 *
 * WHY the form is keyed by policy id: both routes render this same component, so React would otherwise
 * keep one form instance (and its typed-in state) when navigating between two policies.
 */
const PolicyEditorPage: FC = () => {
  const { policyId } = useParams();
  const isNew = !policyId;
  const dispatch = useAppDispatch();
  const back = useBackToPolicies();
  const { policy, policies } = useAppSelector((s) => s.settings);

  useEffect(() => {
    if (!policyId) return;
    void dispatch(fetchPolicy(policyId));
    return () => {
      dispatch(resetPolicyEditor());
    };
  }, [dispatch, policyId]);

  const listMissing = !policies.loaded && !policies.loading;
  useEffect(() => {
    if (isNew && listMissing) void dispatch(fetchPolicies());
    // Only on entering Add mode — a failed fetch is retried by the button, not by an effect loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatch, isNew]);

  const header = (title: string) => (
    <div className="mb-5">
      <button
        type="button"
        onClick={back}
        className="mb-2 inline-flex items-center gap-1.5 text-[13px] font-semibold text-muted hover:text-foreground"
      >
        <Icon name="ArrowLeftLine" size={15} /> Policies
      </button>
      <h1 className="text-[22px] font-extrabold tracking-tight text-foreground">{title}</h1>
    </div>
  );

  const errorCard = (message: string, onRetry: () => void) => (
    <div className="max-w-3xl rounded-xl border border-border bg-surface p-10 text-center">
      <p className="text-[14px] text-error">{message}</p>
      <div className="mt-3 flex justify-center gap-2.5">
        <button
          type="button"
          onClick={back}
          className="rounded-md border border-border-strong px-4 py-2 text-[14px] font-semibold text-foreground hover:bg-subtle"
        >
          Back to policies
        </button>
        <button
          type="button"
          onClick={onRetry}
          className="rounded-md bg-primary px-4 py-2 text-[14px] font-semibold text-white hover:bg-primary-dark"
        >
          Retry
        </button>
      </div>
    </div>
  );

  const skeleton = (
    <div className="max-w-3xl space-y-4">
      <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
        <Skeleton height={18} width={120} />
        <div className="mt-5 space-y-4">
          <Skeleton height={42} />
          <Skeleton height={42} width="40%" />
          <Skeleton height={26} width="55%" />
        </div>
      </div>
      <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
        <Skeleton height={18} width={100} />
        <Skeleton height={280} className="mt-5" />
      </div>
    </div>
  );

  // ---------- Add ----------
  if (isNew) {
    let body: ReactNode;
    if (policies.error && !policies.loading && !policies.loaded) {
      body = errorCard(policies.error, () => void dispatch(fetchPolicies()));
    } else if (!policies.loaded) {
      body = skeleton;
    } else {
      const count = policies.items.length;
      body = (
        <PolicyForm
          key="new"
          policy={null}
          defaultOrder={Math.min(count + 1, POLICY_LIST_LIMIT)}
          atLimit={count >= POLICY_LIST_LIMIT}
        />
      );
    }
    return (
      <div className="p-6">
        {header('Add policy')}
        {body}
      </div>
    );
  }

  // ---------- Edit ----------
  const ready = policy.id === policyId && !policy.loading;
  let body: ReactNode;
  let title = 'Edit policy';
  if (ready && policy.error) {
    body = errorCard(policy.error, () => void dispatch(fetchPolicy(policyId)));
  } else if (ready && policy.notFound) {
    title = 'Policy not found';
    body = (
      <div className="max-w-3xl rounded-xl border border-border bg-surface p-10 text-center">
        <p className="text-[14px] font-semibold text-foreground">This policy doesn’t exist.</p>
        <p className="mt-1 text-[13px] text-muted">The link may be wrong. Policies are never deleted — check the list.</p>
        <button
          type="button"
          onClick={back}
          className="mt-4 rounded-md bg-primary px-4 py-2 text-[14px] font-semibold text-white hover:bg-primary-dark"
        >
          Back to policies
        </button>
      </div>
    );
  } else if (ready && policy.data) {
    title = policy.data.name || title;
    body = <PolicyForm key={policy.data.id} policy={policy.data} defaultOrder={policy.data.order} atLimit={false} />;
  } else {
    body = skeleton;
  }

  return (
    <div className="p-6">
      {header(title)}
      {body}
    </div>
  );
};

export default PolicyEditorPage;
