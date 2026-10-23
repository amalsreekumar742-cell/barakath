import 'server-only';

import { cache } from 'react';
import {
  collection,
  doc,
  FirestoreError,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  where,
} from 'firebase/firestore';
import { FirestoreCollections, PolicyStatus } from '@barakath/shared';
import type { PolicyProps } from '@barakath/shared';
import { POLICY_LIST_LIMIT } from '@barakath/shared/config/policies';
import { serverDb } from './serverFirestore';

/**
 * policies — the customer-facing policy pages (`policies/{id}`, admin Settings › Policies).
 *
 * WHY every list read filters `status == 'enabled'`: `firestore.rules` grants public read on a policy
 * ONLY while it is enabled, and Firestore evaluates rules against the QUERY, not the result set. A list
 * query without that filter could match a disabled doc, so the whole query is rejected with
 * permission-denied — even when every doc it would actually return is enabled. The filter is what makes
 * the query provably safe; it is not an optimisation that can be dropped.
 *
 * WHY both reads are wrapped in React `cache()`: the footer (every page, via StorefrontShell) and the
 * /policies page both need the list, and `generateMetadata` + the detail page both need one policy.
 * `cache` dedupes those to one Firestore read per request without threading props through the layout.
 */

/**
 * Every enabled policy in the admin's display order — footer links, the /policies index and the sitemap.
 *
 * WHY it returns [] instead of throwing: the footer renders on every storefront page. A missing
 * composite index (status, order) or a transient read failure must cost the footer its policy links,
 * not take the whole site down with it. The error is logged so it still surfaces in Cloud Run logs
 * rather than reading as "the admin published no policies".
 */
export const getEnabledPolicies = cache(async (): Promise<PolicyProps[]> => {
  try {
    const snap = await getDocs(
      query(
        collection(serverDb, FirestoreCollections.policies),
        where('status', '==', PolicyStatus.ENABLED),
        orderBy('order'),
        limit(POLICY_LIST_LIMIT),
      ),
    );
    return snap.docs.map((d) => ({ ...d.data(), id: d.id }) as PolicyProps);
  } catch (err) {
    console.error('[policies] getEnabledPolicies failed', err);
    return [];
  }
});

/**
 * One policy by id, or null when it does not exist, is disabled, or the id is not a valid doc id.
 *
 * WHY permission-denied means "not found" here: the rules hide a disabled policy by refusing the read,
 * so from a signed-out reader a disabled policy and a deleted one are indistinguishable — both must 404.
 * The explicit status check below is belt-and-braces in case the rule is ever loosened.
 *
 * WHY any OTHER error is rethrown: a network blip or an unavailable backend is not "this policy does not
 * exist". Swallowing it would let ISR cache a 404 for a perfectly good policy for the next five minutes;
 * throwing hands it to `(shop)/error.tsx`, which offers a retry instead.
 */
export const getPolicy = cache(async (policyId: string): Promise<PolicyProps | null> => {
  // `doc()` throws synchronously on an id containing '/' (a decoded `%2F` in the URL can produce one),
  // which would surface as a 500 instead of a 404 for a malformed link.
  if (!policyId || policyId.includes('/')) return null;

  try {
    const snap = await getDoc(doc(serverDb, FirestoreCollections.policies, policyId));
    if (!snap.exists()) return null;
    const policy = { ...snap.data(), id: snap.id } as PolicyProps;
    return policy.status === PolicyStatus.ENABLED ? policy : null;
  } catch (err) {
    if (err instanceof FirestoreError && err.code === 'permission-denied') return null;
    throw err;
  }
});
