import { type FC, useCallback, useEffect, useState } from 'react';
import {
  collection,
  doc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import toast from 'react-hot-toast';
import { FirestoreCollections } from '@barakath/shared/config/collections';
import { db } from '@/lib/firebaseConfig';

interface ReviewReport {
  id: string;
  reviewId: string;
  reviewUserName: string;
  productName: string;
  reviewTitle: string;
  reviewComment: string;
  reason: string;
}

/**
 * ReportedReviewsPanel — open customer reports against reviews (App Store guideline 1.2, which also expects
 * action within 24 hours). Renders nothing when no report is open. Hiding sets the review's `isPublished`
 * false, so it can be restored from the Hidden tab; onReviewUpdate refreshes the product's rating.
 */
const ReportedReviewsPanel: FC<{ onChanged: () => void }> = ({ onChanged }) => {
  const [reports, setReports] = useState<ReviewReport[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const snap = await getDocs(
        query(
          collection(db, FirestoreCollections.reviewReports),
          where('status', '==', 'Open'),
          limit(50),
        ),
      );
      setReports(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as ReviewReport));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not load reported reviews');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const resolve = async (report: ReviewReport, hide: boolean) => {
    setBusyId(report.id);
    try {
      const batch = writeBatch(db);
      batch.update(doc(db, FirestoreCollections.reviewReports, report.id), {
        status: hide ? 'Actioned' : 'Dismissed',
        resolvedAt: serverTimestamp(),
      });
      if (hide) {
        batch.update(doc(db, FirestoreCollections.reviews, report.reviewId), {
          isPublished: false,
          updatedAt: serverTimestamp(),
        });
      }
      await batch.commit();
      toast.success(hide ? 'Review hidden' : 'Report dismissed');
      setReports((current) => current.filter((r) => r.id !== report.id));
      if (hide) onChanged();
    } catch (err) {
      // The review may already be deleted, which makes the batch fail. The report still needs closing.
      if (hide) {
        await updateDoc(doc(db, FirestoreCollections.reviewReports, report.id), {
          status: 'Actioned',
          resolvedAt: serverTimestamp(),
        }).catch(() => undefined);
        void load();
      }
      toast.error(err instanceof Error ? err.message : 'Could not update the report');
    } finally {
      setBusyId(null);
    }
  };

  if (reports.length === 0) return null;

  return (
    <section className="mb-5 rounded-xl border border-border bg-surface p-4 shadow-sm">
      <h2 className="text-[15px] font-bold text-foreground">
        Reported reviews ({reports.length})
      </h2>
      <p className="mt-0.5 text-[12px] text-muted">Please act on each report within 24 hours.</p>
      <ul className="mt-3 divide-y divide-border">
        {reports.map((report) => (
          <li key={report.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-semibold text-foreground">
                {report.reason} · {report.productName}
              </p>
              <p className="mt-0.5 text-[12px] text-muted">By {report.reviewUserName || 'Customer'}</p>
              <p className="mt-1 text-[13px] text-foreground">
                {[report.reviewTitle, report.reviewComment].filter(Boolean).join(' — ') || 'Photo or rating only'}
              </p>
            </div>
            <div className="flex shrink-0 gap-2">
              <button
                type="button"
                disabled={busyId === report.id}
                onClick={() => void resolve(report, false)}
                className="rounded-md border border-border-strong px-3 py-1.5 text-[13px] font-semibold text-foreground hover:bg-subtle disabled:opacity-50"
              >
                Dismiss
              </button>
              <button
                type="button"
                disabled={busyId === report.id}
                onClick={() => void resolve(report, true)}
                className="rounded-md bg-primary px-3 py-1.5 text-[13px] font-semibold text-white hover:bg-primary-dark disabled:opacity-50"
              >
                Hide review
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
};

export default ReportedReviewsPanel;
