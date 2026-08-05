import { getMessaging } from 'firebase-admin/messaging';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions';
import { Collections } from '../config/collections';

/**
 * FCM delivery helpers.
 *
 * Two shapes live here because the product genuinely has two: a targeted push to ONE customer
 * (order moved, refund landed) and a broadcast fan-out to an AUDIENCE (an admin's campaign). The
 * single-user path predates the fan-out and is used by half a dozen callers, so it is kept exactly
 * as it was and re-expressed in terms of the multi-token primitive rather than replaced.
 */

/** A token plus enough context to prune it from the right user document if FCM rejects it. */
export interface UserToken {
  userId: string;
  token: string;
  /**
   * Which field on `users/{uid}` this token came from. Pruning differs: the legacy single-token
   * field is blanked, whereas one dead entry in the multi-device array must be removed WITHOUT
   * disturbing that user's other live devices.
   */
  field: 'fcmToken' | 'fcmTokens';
}

/** FCM's hard cap for one `sendEachForMulticast` call. */
const MULTICAST_CHUNK = 500;

/** Error codes that mean "this token is dead, stop trying it" — anything else may be transient. */
const DEAD_TOKEN_CODES = new Set([
  'messaging/invalid-registration-token',
  'messaging/registration-token-not-registered',
  'messaging/invalid-argument',
]);

export interface FanOutResult {
  /** Tokens FCM accepted. Delivery to the handset is still best-effort after this point. */
  sent: number;
  /** Tokens FCM rejected (dead or transient). */
  failed: number;
  /** Dead tokens removed from user documents as a result of this send. */
  pruned: number;
  /** Distinct users at least one token was accepted for — what `recipientCount` should mean. */
  reached: number;
}

/**
 * Read every usable FCM token for a set of users.
 *
 * WHY it reads BOTH `fcmToken` and `fcmTokens`: today the Flutter app writes a single `fcmToken`
 * string, which structurally allows only one device per customer — signing in on a second phone
 * silently steals the first one's pushes, and adding web push later would steal them from the app.
 * Reading an optional `fcmTokens` array as well means the day either client starts appending to an
 * array, multi-device delivery works with no change here. Until then the array is simply absent.
 */
function extractTokens(userId: string, data: FirebaseFirestore.DocumentData | undefined): UserToken[] {
  if (!data) return [];
  // A blocked customer must not receive marketing or transactional pushes.
  if (data.status === 'Blocked') return [];

  const out: UserToken[] = [];
  const single = data.fcmToken;
  if (typeof single === 'string' && single.trim()) {
    out.push({ userId, token: single.trim(), field: 'fcmToken' });
  }
  const many = data.fcmTokens;
  if (Array.isArray(many)) {
    for (const t of many) {
      if (typeof t === 'string' && t.trim() && !out.some((e) => e.token === t.trim())) {
        out.push({ userId, token: t.trim(), field: 'fcmTokens' });
      }
    }
  }
  return out;
}

/**
 * Collect tokens for an explicit list of user ids. Firestore caps `getAll` generously but the id
 * list comes from an admin's hand-picked selection, so it is chunked defensively rather than
 * assumed small.
 */
export async function collectTokensForUsers(userIds: string[]): Promise<UserToken[]> {
  if (userIds.length === 0) return [];
  const db = getFirestore();
  const unique = [...new Set(userIds)];
  const targets: UserToken[] = [];

  for (let i = 0; i < unique.length; i += 300) {
    const refs = unique
      .slice(i, i + 300)
      .map((id) => db.collection(Collections.users).doc(id));
    const snaps = await db.getAll(...refs, {
      // Projection: this can span the whole customer base, and the rest of the user document
      // (addresses, balances, keywords) is irrelevant to delivery. Fetching it would multiply the
      // egress of every broadcast for nothing.
      fieldMask: ['fcmToken', 'fcmTokens', 'status'],
    });
    for (const snap of snaps) {
      if (snap.exists) targets.push(...extractTokens(snap.id, snap.data()));
    }
  }
  return targets;
}

/**
 * Collect tokens for EVERY customer, paged so a large user base never has to fit in one query
 * result. Ordered by document id because that is the only field guaranteed present on every user
 * doc — ordering by anything else would silently drop customers missing that field (the Firestore
 * `orderBy` trap this codebase has been bitten by before).
 */
export async function collectTokensForAllUsers(): Promise<UserToken[]> {
  const db = getFirestore();
  const targets: UserToken[] = [];
  const PAGE = 1000;
  let cursor: FirebaseFirestore.QueryDocumentSnapshot | undefined;

  for (;;) {
    let q = db
      .collection(Collections.users)
      .orderBy('__name__')
      .limit(PAGE)
      .select('fcmToken', 'fcmTokens', 'status');
    if (cursor) q = q.startAfter(cursor);

    const snap = await q.get();
    if (snap.empty) break;
    for (const doc of snap.docs) targets.push(...extractTokens(doc.id, doc.data()));
    if (snap.size < PAGE) break;
    cursor = snap.docs[snap.docs.length - 1];
  }
  return targets;
}

/** Remove tokens FCM has told us are dead, so the next broadcast does not pay for them again. */
async function pruneDeadTokens(dead: UserToken[]): Promise<number> {
  if (dead.length === 0) return 0;
  const db = getFirestore();
  let pruned = 0;

  // One batch per 400 updates (Firestore's limit is 500 writes; the margin absorbs a user who has
  // both a dead single token and a dead array entry, which is two writes to the same document).
  for (let i = 0; i < dead.length; i += 400) {
    const batch = db.batch();
    for (const t of dead.slice(i, i + 400)) {
      const ref = db.collection(Collections.users).doc(t.userId);
      batch.update(
        ref,
        t.field === 'fcmToken'
          ? { fcmToken: '' }
          : { fcmTokens: FieldValue.arrayRemove(t.token) },
      );
      pruned += 1;
    }
    // A prune failing must never fail the broadcast — the pushes have already gone out.
    await batch.commit().catch((err) => {
      logger.warn('sendFCM: token prune batch failed', err);
      pruned -= Math.min(400, dead.length - i);
    });
  }
  return pruned;
}

/**
 * Send one notification to many tokens.
 *
 * WHY `sendEachForMulticast` rather than a loop of `send`: it is one HTTP round trip per 500 tokens
 * instead of one per token, and it returns a per-token result so dead registrations can be pruned.
 * A broadcast to 10,000 customers is 20 calls, not 10,000.
 *
 * Failures never throw: a push is best-effort and must not abort the caller (a trigger that threw
 * here would be retried by Eventarc and re-send to everyone it already reached).
 */
export async function sendFCMToTokens(
  targets: UserToken[],
  title: string,
  body: string,
  data?: Record<string, string>,
  imageUrl?: string,
): Promise<FanOutResult> {
  if (targets.length === 0) return { sent: 0, failed: 0, pruned: 0, reached: 0 };

  const messaging = getMessaging();
  const dead: UserToken[] = [];
  const reachedUsers = new Set<string>();
  let sent = 0;
  let failed = 0;

  for (let i = 0; i < targets.length; i += MULTICAST_CHUNK) {
    const chunk = targets.slice(i, i + MULTICAST_CHUNK);
    try {
      const res = await messaging.sendEachForMulticast({
        tokens: chunk.map((t) => t.token),
        notification: { title, body, ...(imageUrl ? { imageUrl } : {}) },
        data: data ?? {},
        // Android needs the channel id to match the one the app registers, or the notification
        // lands on FCM's fallback channel with the default launcher icon.
        android: { notification: { channelId: 'barakath_default' }, priority: 'high' },
        apns: { payload: { aps: { sound: 'default' } } },
      });

      res.responses.forEach((r, idx) => {
        const target = chunk[idx];
        if (!target) return;
        if (r.success) {
          sent += 1;
          reachedUsers.add(target.userId);
          return;
        }
        failed += 1;
        const code = (r.error as { code?: string } | undefined)?.code;
        if (code && DEAD_TOKEN_CODES.has(code)) dead.push(target);
      });
    } catch (err) {
      // A whole chunk failing is transient (network/quota) — count it and carry on to the next.
      failed += chunk.length;
      logger.error('sendFCM: multicast chunk failed', err);
    }
  }

  const pruned = await pruneDeadTokens(dead);
  return { sent, failed, pruned, reached: reachedUsers.size };
}

/**
 * sendFCMToUser — send a push notification to one user (spec §1.18). Reads their token(s) from the
 * user doc; stale/invalid ones are pruned so we stop trying them. Failures are swallowed — a push is
 * best-effort and must never abort the caller's transaction.
 *
 * Unchanged in behaviour from the original single-token version; it now routes through the shared
 * multicast primitive so token extraction and pruning have exactly one implementation.
 */
export async function sendFCMToUser(
  userId: string,
  title: string,
  body: string,
  data?: Record<string, string>,
): Promise<void> {
  const targets = await collectTokensForUsers([userId]);
  if (targets.length === 0) return;
  await sendFCMToTokens(targets, title, body, data);
}
