import { createAsyncThunk } from '@reduxjs/toolkit';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { FirestoreCollections } from '@barakath/shared/config/collections';
import { UserStatus } from '@barakath/shared/config/enums';
import { db } from '@/lib/firebaseConfig';

/**
 * toggleCustomerStatus — block or unblock a customer (spec §1.8: "Customers are blocked, not deleted").
 *
 * WHY a direct updateDoc (not a Cloud Function): this flips a single non-financial status field on a
 * doc the admin is authorised to write (gated by the `admin` claim in Security Rules), so it doesn't
 * need the server trust boundary that money/stock writes do. Returns the id + new status so the slice
 * patches both the list row and the open detail without a refetch.
 */
export const toggleCustomerStatus = createAsyncThunk<
  { userId: string; status: 'Active' | 'Blocked' },
  { userId: string; newStatus: 'Active' | 'Blocked' },
  { rejectValue: string }
>('customers/toggleStatus', async ({ userId, newStatus }, { rejectWithValue }) => {
  try {
    await updateDoc(doc(db, FirestoreCollections.users, userId), {
      status: newStatus,
      updatedAt: serverTimestamp(),
    });
    return { userId, status: newStatus };
  } catch (err) {
    return rejectWithValue(
      err instanceof Error
        ? err.message
        : `Could not ${newStatus === UserStatus.BLOCKED ? 'block' : 'unblock'} customer`,
    );
  }
});
