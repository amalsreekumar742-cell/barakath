import { ref, listAll, deleteObject } from 'firebase/storage';
import { storage } from '@/lib/firebaseConfig';

/**
 * deleteStorageFolder — recursively delete every object under a Storage "folder" path.
 * WHY: Cloud Storage has no folders and no cascade — deleting a variant/product must enumerate and
 * delete its images explicitly (spec §1.22 hard deletes). Individual failures are swallowed so one
 * missing object can't abort the whole cleanup.
 */
export async function deleteStorageFolder(path: string): Promise<void> {
  try {
    const dir = ref(storage, path);
    const res = await listAll(dir);
    await Promise.all([
      ...res.items.map((item) => deleteObject(item).catch(() => {})),
      ...res.prefixes.map((p) => deleteStorageFolder(p.fullPath)),
    ]);
  } catch {
    /* nothing to clean up */
  }
}
