import { type FC, useEffect, useState } from 'react';
import Modal from '@/components/Modal';
import Icon from '@/components/icons/Icon';

/**
 * PhotoViewerModal (reviews-local) — a full-size viewer for a review's photo strip (spec §1.11).
 *
 * WHY feature-local (not the shared components/ one): a sibling agent owns
 * `src/components/PhotoViewerModal.tsx`; this reviews copy is self-contained so the two never collide.
 * WHY internal index state seeded from `initialIndex`: the strip opens at the clicked thumbnail, then
 * prev/next navigate locally (wrapping at the ends) without the parent tracking the position.
 */
interface PhotoViewerModalProps {
  isOpen: boolean;
  photos: string[];
  initialIndex?: number;
  onClose: () => void;
}

const PhotoViewerModal: FC<PhotoViewerModalProps> = ({ isOpen, photos, initialIndex = 0, onClose }) => {
  const [index, setIndex] = useState(initialIndex);

  // Re-seed the position each time the viewer (re)opens or a different thumbnail is clicked.
  useEffect(() => {
    if (isOpen) setIndex(initialIndex);
  }, [isOpen, initialIndex]);

  if (photos.length === 0) return null;

  const total = photos.length;
  const safeIndex = ((index % total) + total) % total; // guard against out-of-range after prop change
  // Wrap around at both ends so navigation is continuous.
  const prev = () => setIndex((i) => (i - 1 + total) % total);
  const next = () => setIndex((i) => (i + 1) % total);

  return (
    <Modal isOpen={isOpen} onClose={onClose} maxWidth="max-w-3xl">
      <div className="relative overflow-hidden rounded-xl border border-border bg-surface shadow-lg">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 z-10 rounded-md bg-ink/45 p-1.5 text-white hover:bg-ink/60"
          aria-label="Close"
        >
          <Icon name="CloseLine" size={18} />
        </button>

        <div className="flex items-center justify-center bg-ink/90 p-4">
          <img
            src={photos[safeIndex]}
            alt={`Review photo ${safeIndex + 1} of ${total}`}
            className="max-h-[70vh] w-auto max-w-full object-contain"
          />
        </div>

        {total > 1 && (
          <>
            <button
              type="button"
              onClick={prev}
              className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-ink/45 p-2 text-white hover:bg-ink/60"
              aria-label="Previous photo"
            >
              <Icon name="ArrowLeftLine" size={20} />
            </button>
            <button
              type="button"
              onClick={next}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-ink/45 p-2 text-white hover:bg-ink/60"
              aria-label="Next photo"
            >
              <Icon name="ArrowRightLine" size={20} />
            </button>
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-pill bg-ink/45 px-3 py-1 text-[12px] font-semibold text-white tabular-nums">
              {safeIndex + 1} / {total}
            </div>
          </>
        )}
      </div>
    </Modal>
  );
};

export default PhotoViewerModal;
