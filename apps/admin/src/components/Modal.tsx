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

  useEffect(() => {
    if (!isOpen) return;
    lastFocused.current = document.activeElement as HTMLElement; // remember trigger to restore later
    document.body.style.overflow = 'hidden'; // lock background scroll while open
    panelRef.current?.focus(); // move focus into the dialog
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = ''; // release scroll lock
      lastFocused.current?.focus(); // restore focus to the trigger
    };
  }, [isOpen, onClose]);

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
