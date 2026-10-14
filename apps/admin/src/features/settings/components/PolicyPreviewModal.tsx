import type { FC } from 'react';
import Modal from '@/components/Modal';
import Icon from '@/components/icons/Icon';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  /** Heading shown above the rendered content (the policy name, or a fallback). */
  title: string;
  html: string;
}

/**
 * PolicyPreviewModal — renders the policy HTML the way customers will read it, on the shared Modal.
 *
 * WHY a scoped `.safe-html` container: Quill emits trusted-editor HTML (only this admin's own input),
 * but scoping it keeps its headings/lists from inheriting — or leaking into — the app chrome, and the
 * global `.safe-html` rules restore the block spacing the CSS reset strips.
 */
const PolicyPreviewModal: FC<Props> = ({ isOpen, onClose, title, html }) => (
  <Modal isOpen={isOpen} onClose={onClose} maxWidth="max-w-2xl">
    <div className="max-h-[80vh] overflow-y-auto rounded-xl border border-border bg-surface p-6 shadow-lg">
      <div className="mb-4 flex items-center justify-between gap-4">
        <h3 className="min-w-0 truncate text-[16px] font-bold text-foreground">{title} — preview</h3>
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 text-faint hover:text-foreground"
          aria-label="Close preview"
        >
          <Icon name="CloseLine" size={20} />
        </button>
      </div>
      <div
        className="safe-html text-[14px] leading-relaxed text-foreground"
        dangerouslySetInnerHTML={{ __html: html || '<p class="text-muted">Nothing to preview.</p>' }}
      />
    </div>
  </Modal>
);

export default PolicyPreviewModal;
