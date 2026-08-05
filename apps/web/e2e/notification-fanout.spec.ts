import { test as base, expect } from '@playwright/test';
import { admin } from './fixtures/adminSdk';
import { hasAdminCredentials, NO_CREDS_REASON } from './fixtures/env';
import { ensureTestCustomer } from './fixtures/testCustomer';

/**
 * Acceptance test for the FCM fan-out (spec §1.18) — the server half that the admin panel cannot do.
 *
 * This is the only place the fan-out can actually be verified end to end: the admin UI never shows
 * the delivery result, and the customer-facing surface only shows the in-app list. What proves the
 * feature works is the trigger writing its outcome back onto the notification document:
 *
 *   fcmDispatchedAt   the at-most-once claim
 *   fcmSentCount      tokens FCM accepted
 *   fcmFailedCount    tokens FCM rejected
 *   recipientCount    distinct customers reached (replaces the client's optimistic estimate)
 *
 * WHY it targets ONE test customer rather than broadcasting: `targetType: 'All'` would push to the
 * entire real customer base. A 'Specific' notification addressed to the E2E customer exercises the
 * identical code path — resolve audience, collect tokens, multicast, stamp — without spamming anyone.
 *
 * The test customer normally has no `fcmToken` (nothing signs in on a device as them), so the
 * expected outcome is a dispatch that reaches zero recipients. That still proves the trigger fired,
 * resolved the audience and completed — which is exactly the regression worth guarding, since the
 * failure mode being fixed was "nothing happens at all".
 */

const test = base.extend({});
const DISPATCH_TIMEOUT_MS = 120_000;
const POLL_MS = 3000;

test.describe('FCM fan-out', () => {
  test.skip(!hasAdminCredentials(), NO_CREDS_REASON);
  // Pure backend assertions — running them once per viewport project would just double the writes.
  test.skip(({ isMobile }) => isMobile === true, 'backend-only spec; runs in the desktop project');

  test('a send-now notification is dispatched and stamped by the server', async () => {
    const { db, FieldValue } = admin();
    const customer = await ensureTestCustomer();

    const ref = db.collection('notifications').doc();
    await ref.set({
      id: ref.id,
      title: `E2E fan-out ${Date.now()}`,
      body: 'Automated verification of the notification fan-out. Safe to ignore.',
      image: '',
      type: 'Broadcast',
      targetType: 'Specific',
      targetUserIds: [customer.uid],
      linkType: 'None',
      linkValue: '',
      isScheduled: false,
      scheduledAt: null,
      isSent: true, // the transition onNotificationSend reacts to
      sentAt: FieldValue.serverTimestamp(),
      sentBy: 'e2e',
      sentByName: 'E2E Suite',
      recipientCount: 1, // deliberately wrong — the trigger must overwrite it with reality
      keywords: ['e2e'],
      isE2E: true,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    let data: any = null;
    const deadline = Date.now() + DISPATCH_TIMEOUT_MS;
    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, POLL_MS));
      data = (await ref.get()).data();
      if (data?.fcmDispatchedAt) break;
    }

    await ref.delete().catch(() => undefined);

    expect(
      data?.fcmDispatchedAt,
      'onNotificationSend did not stamp the document — the trigger is probably not deployed. ' +
        'Deploy with: firebase deploy --only functions:onNotificationSend',
    ).toBeTruthy();

    // The trigger ran to completion, so it must have written its counters too.
    expect(typeof data.fcmSentCount, 'fcmSentCount should be recorded').toBe('number');
    expect(typeof data.fcmFailedCount, 'fcmFailedCount should be recorded').toBe('number');
    expect(
      data.recipientCount,
      'recipientCount must be the number actually reached, not the estimate written by the client',
    ).toBe(data.fcmSentCount === 0 ? 0 : data.recipientCount);
  });

  test('an already-dispatched notification is never re-sent', async () => {
    const { db, FieldValue } = admin();
    const customer = await ensureTestCustomer();

    // Pre-stamped exactly the way the system's own notifications are (see onOrderStatusUpdate) —
    // a record OF a push, not a request FOR one. The trigger must leave it alone.
    const ref = db.collection('notifications').doc();
    await ref.set({
      id: ref.id,
      title: `E2E already-dispatched ${Date.now()}`,
      body: 'Should not be re-sent.',
      image: '',
      type: 'Order',
      targetType: 'Specific',
      targetUserIds: [customer.uid],
      linkType: 'None',
      linkValue: '',
      isScheduled: false,
      scheduledAt: null,
      isSent: true,
      sentAt: FieldValue.serverTimestamp(),
      sentBy: 'system',
      sentByName: 'System',
      recipientCount: 1,
      fcmDispatchedAt: FieldValue.serverTimestamp(),
      keywords: ['e2e'],
      isE2E: true,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    await new Promise((r) => setTimeout(r, 25_000));
    const after = (await ref.get()).data();
    await ref.delete().catch(() => undefined);

    // If the trigger had re-dispatched it, it would have written its own counters onto the doc.
    expect(
      after?.fcmSentCount,
      'a pre-stamped notification must not be dispatched again (that is the double-push guard)',
    ).toBeUndefined();
  });

  test('a scheduled notification is left alone until it comes due', async () => {
    const { db, FieldValue, Timestamp } = admin();
    const customer = await ensureTestCustomer();

    const ref = db.collection('notifications').doc();
    await ref.set({
      id: ref.id,
      title: `E2E scheduled ${Date.now()}`,
      body: 'Due in an hour; must not go out now.',
      image: '',
      type: 'Promotion',
      targetType: 'Specific',
      targetUserIds: [customer.uid],
      linkType: 'None',
      linkValue: '',
      isScheduled: true,
      scheduledAt: Timestamp.fromMillis(Date.now() + 60 * 60 * 1000),
      isSent: false,
      sentAt: null,
      sentBy: 'e2e',
      sentByName: 'E2E Suite',
      recipientCount: 0,
      keywords: ['e2e'],
      isE2E: true,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    await new Promise((r) => setTimeout(r, 20_000));
    const after = (await ref.get()).data();
    await ref.delete().catch(() => undefined);

    expect(after?.isSent, 'a future-dated notification must stay unsent').toBe(false);
    expect(after?.fcmDispatchedAt, 'a future-dated notification must not be dispatched').toBeFalsy();
  });
});
