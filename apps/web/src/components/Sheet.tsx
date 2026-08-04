'use client';

import type { ReactNode } from 'react';
import { Modal } from './Modal';

/**
 * The bottom sheet — the mobile counterpart to a centred dialog.
 *
 * Mirrors the Flutter app's sheets (`sort_bottom_sheet.dart`, `filter_bottom_sheet.dart`,
 * `login_prompt_sheet.dart`): a white panel pinned to the bottom edge with a 20px top radius, a
 * grab handle, and an optional bold title.
 *
 * WHY it delegates to <Modal variant="sheet"> instead of portalling itself: Modal already owns the
 * behaviour a sheet needs to share exactly — Escape, background scroll-lock, focus capture and
 * restore, and the outside-click test that ignores a drag started inside the panel. Duplicating
 * that is how the two drift apart (the old header drawer hand-rolled its own copy and had already
 * diverged). This file is purely the panel's chrome.
 *
 * Drag-to-dismiss is deliberately not implemented — backdrop tap and Escape cover it, and a
 * half-working drag that fights the panel's own scroll is worse than none.
 */
export interface SheetProps {
  isOpen: boolean;
  onClose: () => void;
  /** Bold heading rendered above the content, and the sheet's accessible name. */
  title?: string;
  /** Width cap on wide screens; a sheet is full-width on a phone regardless. */
  maxWidth?: string;
  /** Set false for sheets whose content scrolls itself (e.g. a long filter list). */
  scrollable?: boolean;
  children: ReactNode;
}

export function Sheet({
  isOpen,
  onClose,
  title,
  maxWidth = 'max-w-lg',
  scrollable = true,
  children,
}: SheetProps) {
  const titleId = title ? 'sheet-title' : undefined;

  return (
    <Modal isOpen={isOpen} onClose={onClose} variant="sheet" maxWidth={maxWidth} labelledBy={titleId}>
      <div
        className={`flex max-h-[85vh] flex-col rounded-t-[20px] bg-surface pb-[env(safe-area-inset-bottom)] shadow-lg ${
          scrollable ? '' : 'overflow-hidden'
        }`}
      >
        {/* Grab handle. Purely affordance — the sheet is dismissed by the backdrop or Escape, so it
            is hidden from assistive tech rather than announced as an interactive control. */}
        <div className="flex shrink-0 justify-center pb-1 pt-3" aria-hidden>
          <span className="h-1 w-10 rounded-full bg-border-strong" />
        </div>

        {title && (
          <h2
            id={titleId}
            className="shrink-0 px-4 pb-1 pt-2 text-lg font-extrabold tracking-[-0.36px] text-foreground"
          >
            {title}
          </h2>
        )}

        <div className={`min-h-0 px-4 pb-4 pt-2 ${scrollable ? 'overflow-y-auto' : ''}`}>
          {children}
        </div>
      </div>
    </Modal>
  );
}
