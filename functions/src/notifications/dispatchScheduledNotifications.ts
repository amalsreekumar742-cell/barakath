import { onSchedule } from 'firebase-functions/v2/scheduler';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions';
import { Collections } from '../config/collections';
import { markSentAndDispatch } from './service/dispatchNotification';

/**
 * dispatchScheduledNotifications — fire notifications the admin scheduled for a future time
 * (spec §1.18 "Schedule"), the second TODO left in `createNotification.ts`.
 *
 * Until now a scheduled notification was written with `isScheduled: true` and then nothing ever
 * looked at it again: the chosen time passed in silence and the notification sat unsent forever.
 *
 * WHY every 5 minutes: it matches `flashSaleManager` and `expireUnpaidOrders`, so the project has
 * one scheduling cadence rather than three. It also bounds how late a send can be to 5 minutes,
 * which is well inside what "scheduled at 9:00 AM" means for a marketing push. A per-notification
 * Cloud Task would be exact, but it would need a second delivery mechanism and a cancellation path
 * for every reschedule and delete — a lot of machinery to buy minutes that nobody is counting.
 *
 * WHY `<= now` rather than a window: a run that fails, or a function cold-start that overruns, must
 * not leave a notification permanently in the past and therefore permanently unsent. Anything due
 * and still unsent is picked up by the next run, however late.
 */
export const dispatchScheduledNotifications = onSchedule(
  { schedule: 'every 5 minutes', timeZone: 'Asia/Kolkata' },
  async () => {
    const db = getFirestore();
    const now = Timestamp.now();

    // Bounded so one run can never fan out an unbounded number of broadcasts; the remainder is
    // picked up 5 minutes later. Ordered by the due time so the oldest backlog drains first.
    const due = await db
      .collection(Collections.notifications)
      .where('isScheduled', '==', true)
      .where('isSent', '==', false)
      .where('scheduledAt', '<=', now)
      .orderBy('scheduledAt', 'asc')
      .limit(20)
      .get();

    if (due.empty) return;

    logger.info(`dispatchScheduledNotifications: ${due.size} due`);

    for (const doc of due.docs) {
      try {
        const outcome = await markSentAndDispatch(doc.id, doc.data());
        logger.info('dispatchScheduledNotifications: dispatched', { id: doc.id, ...outcome });
      } catch (err) {
        // One bad notification must not stop the rest of the batch draining.
        logger.error('dispatchScheduledNotifications: failed', { id: doc.id, err });
      }
    }
  },
);
