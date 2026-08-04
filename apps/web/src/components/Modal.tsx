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
  /**
   * 'center' (default) floats the panel in the middle — the desktop dialog.
   * 'sheet' anchors it to the bottom edge and slides it up — the mobile bottom sheet the Flutter
   * app uses for filters, sort, coupons and the login prompt.
   *
   * WHY a variant here rather than a second overlay component: everything BELOW the panel — the
   * portal, Escape, background scroll-lock, outside-click discrimination, focus capture and
   * restore — is identical for a sheet and a dialog, and it is the part that is easy to get subtly
   * wrong. Only the anchoring and the entrance animation actually differ, so those are all the
   * variant changes. See `Sheet.tsx` for the panel chrome that goes inside.
   */
  variant?: 'center' | 'sheet';
  children: React.ReactNode;
}

function ModalImpl({
  isOpen,
  onClose,
  maxWidth = 'max-w-lg',
  labelledBy,
  variant = 'center',
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

  const isSheet = variant === 'sheet';

  return ReactDOM.createPortal(
    <div
      className={`fixed inset-0 z-[999] flex justify-center bg-black/40 backdrop-blur-md ${
        isSheet ? 'items-end' : 'items-center p-4'
      }`}
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
        className={
          isSheet
            ? // A sheet spans the full width on a phone but must not stretch edge-to-edge on a wide
              // screen, so it keeps the same width cap and simply sits at the bottom.
              `w-full ${maxWidth} animate-slide-up outline-none`
            : `w-full ${maxWidth} animate-fade-in outline-none`
        }
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
