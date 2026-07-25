'use client';

import { useEffect, useRef, type ReactElement } from 'react';
import ReactDOM from 'react-dom';

/**
 * The ONE reusable modal. Every dialog, sheet and image viewer on this site goes through it —
 * never hand-roll a second one. Mirrors the admin panel's API so the pattern is shared across apps.
 *
 * WHY a portal: rendering at document.body lets the overlay escape parent overflow, z-index and
 * stacking contexts. A modal opened from inside a scrolled or clipped container would otherwise be
 * cut off by it.
 *
 * WHY outside-click is checked against a panel ref rather than a backdrop-only onClick: a click that
 * STARTS inside the panel and drags out (selecting text, dragging a slider) must not dismiss.
 * Testing `panelRef.contains(target)` closes only on a true outside click.
 *
 * WHY the effect does four things at once: Escape-to-close, background scroll-lock, moving focus
 * into the dialog and restoring it to the trigger are the baseline a dialog is expected to have, not
 * extras. Without them the page scrolls under the modal and keyboard users lose their place.
 */
export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Tailwind width cap for the panel, e.g. 'max-w-lg'. */
  maxWidth?: string;
  /** Labels the dialog for screen readers. Point it at the heading's id. */
  labelledBy?: string;
  children: React.ReactNode;
}

function ModalImpl({
  isOpen,
  onClose,
  maxWidth = 'max-w-lg',
  labelledBy,
  children,
}: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const lastFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    lastFocused.current = document.activeElement as HTMLElement | null;
    document.body.style.overflow = 'hidden';
    panelRef.current?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);

    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
      lastFocused.current?.focus();
    };
  }, [isOpen, onClose]);

  // Rendered only in the browser: document.body does not exist during SSR, and a dialog has no
  // business in the server-rendered HTML anyway — it is by definition an interaction.
  if (!isOpen || typeof document === 'undefined') return null;

  return ReactDOM.createPortal(
    <div
      className="fixed inset-0 z-[999] flex items-center justify-center bg-black/40 p-4 backdrop-blur-md"
      onClick={(e) => {
        e.stopPropagation();
        if (panelRef.current && !panelRef.current.contains(e.target as Node)) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        tabIndex={-1}
        className={`w-full ${maxWidth} animate-fade-in outline-none`}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}

// ReactDOM.createPortal returns ReactPortal, which @types/react's current type definitions treat as
// incompatible with a component's JSX return type (a DefinitelyTyped inconsistency in how ReactPortal
// relates to ReactNode, not a real runtime issue — a portal is a valid renderable node). Casting the
// exported symbol to a plain function type sidesteps re-verifying that broken relationship at every
// call site; behavior is unchanged.
export const Modal = ModalImpl as (props: ModalProps) => ReactElement | null;
