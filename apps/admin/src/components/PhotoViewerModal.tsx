import { type FC, useEffect, useState } from 'react';
import Modal from './Modal';
import Icon from './icons/Icon';

/**
 * PhotoViewerModal — the ONE reusable full-size image lightbox for the admin panel (first used by the
 * Replacement detail page's customer-photo grid, spec §1.10).
 *
 * WHY built on the shared Modal: Escape-to-close, backdrop-click close, body-scroll-lock and focus
 * handling all come free — this component only adds the image + prev/next navigation on top.
 * WHY local `index` state seeded from `initialIndex`: the caller opens the viewer on the thumbnail that
 * was clicked, then the user pages through with the arrows; the effect re-syncs whenever the opened set
 * or the starting index changes so re-opening on a different photo lands correctly. Navigation wraps
 * around (last → first) so there is never a dead end.
 */
interface PhotoViewerModalProps {
  isOpen: boolean;
  photos: string[];
  initialIndex?: number;
  onClose: () => void;
}

const PhotoViewerModal: FC<PhotoViewerModalProps> = ({
  isOpen,
  photos,
  initialIndex = 0,
  onClose,
}) => {
  const [index, setIndex] = useState(initialIndex);

  // Re-seed the active photo whenever the viewer is (re)opened or the source set changes.
  useEffect(() => {
    if (isOpen) setIndex(initialIndex);
  }, [isOpen, initialIndex, photos]);

  if (!isOpen || photos.length === 0) return null;

  const total = photos.length;
  const safeIndex = ((index % total) + total) % total; // guard against out-of-range
  const go = (delta: number) => setIndex((i) => (((i + delta) % total) + total) % total);

  return (
    <Modal isOpen={isOpen} onClose={onClose} maxWidth="max-w-3xl">
      <div className="relative rounded-xl border border-border bg-surface p-3 shadow-lg">
        {/* Close */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-pill bg-ink/50 text-white hover:bg-ink/70"
        >
          <Icon name="CloseLine" size={18} />
        </button>

        {/* Current image */}
        <div className="flex items-center justify-center">
          <img
            src={photos[safeIndex]}
            alt={`Photo ${safeIndex + 1} of ${total}`}
            className="max-h-[70vh] w-auto max-w-full rounded-lg object-contain"
          />
        </div>

        {/* Prev / next — only when there is more than one photo */}
        {total > 1 && (
          <>
            <button
              type="button"
              onClick={() => go(-1)}
              aria-label="Previous photo"
              className="absolute left-4 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-pill bg-ink/50 text-white hover:bg-ink/70"
            >
              <Icon name="ArrowLeftLine" size={18} />
            </button>
            <button
              type="button"
              onClick={() => go(1)}
              aria-label="Next photo"
              className="absolute right-4 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-pill bg-ink/50 text-white hover:bg-ink/70"
            >
              <Icon name="ArrowRightLine" size={18} />
            </button>
            <div className="mt-3 text-center text-[13px] font-semibold text-muted">
              {safeIndex + 1} / {total}
            </div>
          </>
        )}
      </div>
    </Modal>
  );
};

export default PhotoViewerModal;
