import { getMessaging } from 'firebase-admin/messaging';
import { getFirestore } from 'firebase-admin/firestore';
import { Collections } from '../config/collections';

/**
 * sendFCMToUser — send a push notification to one user by their stored fcmToken (spec §1.18). Reads the
 * token from the user doc; a stale/invalid token is cleared so we stop trying it. Failures are swallowed
 * (a push is best-effort — it must never abort the caller's transaction).
 */
export async function sendFCMToUser(
  userId: string,
  title: string,
  body: string,
  data?: Record<string, string>,
): Promise<void> {
  const db = getFirestore();
  const userDoc = await db.collection(Collections.users).doc(userId).get();
  const fcmToken = userDoc.data()?.fcmToken as string | undefined;
  if (!fcmToken) return;

  try {
    await getMessaging().send({
      token: fcmToken,
      notification: { title, body },
      data: data ?? {},
    });
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (
      code === 'messaging/invalid-registration-token' ||
      code === 'messaging/registration-token-not-registered'
    ) {
      await db.collection(Collections.users).doc(userId).update({ fcmToken: '' });
    }
  }
}
