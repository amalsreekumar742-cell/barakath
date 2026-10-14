import { describe, it, expect, vi } from 'vitest';

// Mock the Firebase client so importing the slice (which pulls in the api thunks -> firebaseConfig)
// never initializes a real Firebase app. The thunks are not executed; only the reducer is exercised.
vi.mock('@/lib/firebaseConfig', () => ({ auth: {}, db: {}, storage: {}, functions: {} }));

import { Timestamp } from 'firebase/firestore';
import { PolicyStatus } from '@barakath/shared/config/enums';
import type { PolicyProps } from '@barakath/shared/types';
import reducer, { resetPolicyEditor } from './settingsSlice';
import { fetchPolicies } from '../api/fetchPolicies';
import { fetchPolicy } from '../api/fetchPolicy';
import { reorderPolicies } from '../api/reorderPolicies';
import { savePolicy } from '../api/savePolicy';
import { setPolicyStatus } from '../api/setPolicyStatus';

const at = Timestamp.fromMillis(1_700_000_000_000);
const policy = (id: string, order: number, name = id): PolicyProps => ({
  id,
  name,
  order,
  content: `<p>${name}</p>`,
  status: PolicyStatus.ENABLED,
  createdAt: at,
  updatedAt: at,
  updatedBy: 'admin-1',
});

const loaded = (items: PolicyProps[]) =>
  reducer(undefined, { type: fetchPolicies.fulfilled.type, payload: items });

describe('settingsSlice — policies list', () => {
  it('starts unloaded (so "empty" is never inferred from an unfetched list)', () => {
    const s = reducer(undefined, { type: '@@INIT' });
    expect(s.policies).toEqual({ items: [], loading: false, error: null, loaded: false });
  });

  it('fetch fulfilled sorts by order with a name tie-break and marks loaded', () => {
    const s = loaded([policy('c', 2), policy('b', 1, 'Terms'), policy('a', 1, 'Privacy')]);
    expect(s.policies.items.map((p) => p.id)).toEqual(['a', 'b', 'c']);
    expect(s.policies.loaded).toBe(true);
  });

  it('fetch rejected keeps the error for the retry state', () => {
    const s = reducer(undefined, { type: fetchPolicies.rejected.type, payload: 'denied' });
    expect(s.policies.error).toBe('denied');
    expect(s.policies.loading).toBe(false);
  });

  it('reorder patches the moved rows in place and re-sorts', () => {
    let s = loaded([policy('a', 1), policy('b', 2), policy('c', 3)]);
    s = reducer(s, { type: reorderPolicies.pending.type });
    expect(s.policyReorderLoading).toBe(true);
    s = reducer(s, {
      type: reorderPolicies.fulfilled.type,
      payload: [
        { id: 'c', from: 3, to: 2 },
        { id: 'b', from: 2, to: 3 },
      ],
    });
    expect(s.policyReorderLoading).toBe(false);
    expect(s.policies.items.map((p) => [p.id, p.order])).toEqual([
      ['a', 1],
      ['c', 2],
      ['b', 3],
    ]);
  });

  it('status change patches only that row and clears the in-flight id', () => {
    const later = Timestamp.fromMillis(1_800_000_000_000);
    let s = loaded([policy('a', 1), policy('b', 2)]);
    s = reducer(s, { type: setPolicyStatus.pending.type, meta: { arg: { id: 'b', status: 'disabled' } } });
    expect(s.policyStatusUpdatingId).toBe('b');
    s = reducer(s, {
      type: setPolicyStatus.fulfilled.type,
      payload: { id: 'b', status: PolicyStatus.DISABLED, updatedAt: later, updatedBy: 'admin-2' },
    });
    expect(s.policyStatusUpdatingId).toBeNull();
    expect(s.policies.items.find((p) => p.id === 'b')?.status).toBe(PolicyStatus.DISABLED);
    expect(s.policies.items.find((p) => p.id === 'b')?.updatedBy).toBe('admin-2');
    expect(s.policies.items.find((p) => p.id === 'a')?.status).toBe(PolicyStatus.ENABLED);
  });

  it('a successful save marks the list unloaded so the tab refetches behind a skeleton', () => {
    let s = loaded([policy('a', 1)]);
    s = reducer(s, { type: savePolicy.pending.type });
    expect(s.policySaveLoading).toBe(true);
    s = reducer(s, { type: savePolicy.fulfilled.type, payload: { id: 'a' } });
    expect(s.policySaveLoading).toBe(false);
    expect(s.policies.loaded).toBe(false);
  });
});

describe('settingsSlice — policy editor', () => {
  it('a missing document resolves to the not-found state', () => {
    let s = reducer(undefined, { type: fetchPolicy.pending.type, meta: { arg: 'x' } });
    expect(s.policy.loading).toBe(true);
    s = reducer(s, { type: fetchPolicy.fulfilled.type, payload: null, meta: { arg: 'x' } });
    expect(s.policy).toMatchObject({ id: 'x', data: null, loading: false, notFound: true });
  });

  it('ignores a response for a policy the editor is no longer showing', () => {
    let s = reducer(undefined, { type: fetchPolicy.pending.type, meta: { arg: 'new-one' } });
    s = reducer(s, { type: fetchPolicy.fulfilled.type, payload: policy('old-one', 1), meta: { arg: 'old-one' } });
    expect(s.policy.id).toBe('new-one');
    expect(s.policy.data).toBeNull();
    expect(s.policy.loading).toBe(true);
  });

  it('reset clears the editor so a re-visit never renders the previous copy', () => {
    let s = reducer(undefined, { type: fetchPolicy.pending.type, meta: { arg: 'a' } });
    s = reducer(s, { type: fetchPolicy.fulfilled.type, payload: policy('a', 1), meta: { arg: 'a' } });
    s = reducer(s, resetPolicyEditor());
    expect(s.policy).toEqual({ id: null, data: null, loading: false, error: null, notFound: false });
  });
});
