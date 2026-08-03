import { useEffect, useRef, type FC, type ReactNode } from 'react';
import ReactDOM from 'react-dom';

/**
 * Modal — the ONE reusable portal-based modal; reuse for every dialog/pop-up in the admin panel.
 *
 * WHY a portal: renders at document.body so the overlay escapes parent overflow/z-index/stacking
 *   contexts — a modal nested in a scrolled/clipped container would otherwise be cut off.
 * WHY outside-click via a ref boundary (not a backdrop-only onClick): a click that starts inside the
 *   panel but drags out shouldn't dismiss; checking panelRef.contains(target) closes only on a true
 *   outside click.
 * WHY the effect: Escape-to-close + body-scroll-lock + focus move/restore are baseline a11y a dialog
 *   must have — without them the background scrolls under the modal and keyboard focus is lost.
 */
interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  maxWidth?: string; // Tailwind width cap for the panel, e.g. 'max-w-lg'
  children: ReactNode;
}

const Modal: FC<ModalProps> = ({ isOpen, onClose, maxWidth = 'max-w-lg', children }) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const lastFocused = useRef<HTMLElement | null>(null);

  /**
   * `onClose` is held in a ref so the effect below can depend on `isOpen` ALONE.
   *
   * WHY that matters: callers pass an inline arrow (`onClose={loading ? () => {} : close}`), so its
   * identity changes on every render of the caller. With `onClose` in the dependency array, every
   * keystroke in a modal's own input re-ran the effect — cleanup fired `lastFocused.current.focus()`,
   * yanking focus back to the button that opened the dialog, and the re-run then moved it to the panel
   * div. Typing one character into a field made focus leave it, so nothing longer than one character
   * could be typed. Every dialog in the panel with a text field had this.
   *
   * Fixing it here rather than asking callers to memoize their handler: a component that breaks unless
   * every caller remembers `useCallback` is a trap, and there are a dozen callers.
   */
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!isOpen) return;
    lastFocused.current = document.activeElement as HTMLElement; // remember trigger to restore later
    document.body.style.overflow = 'hidden'; // lock background scroll while open
    panelRef.current?.focus(); // move focus into the dialog — once, on open
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseRef.current();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = ''; // release scroll lock
      lastFocused.current?.focus(); // restore focus to the trigger
    };
  }, [isOpen]);

  if (!isOpen) return null;
  return ReactDOM.createPortal(
    <div
      className="fixed inset-0 z-[999] flex items-center justify-center bg-ink/45 p-4 backdrop-blur-sm"
      onClick={(e) => {
        e.stopPropagation();
        if (panelRef.current && !panelRef.current.contains(e.target as Node)) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        className={`w-full ${maxWidth} outline-none animate-fade-in`}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
};

export default Modal;
