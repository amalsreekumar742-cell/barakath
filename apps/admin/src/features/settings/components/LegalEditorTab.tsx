import { type FC, useEffect, useMemo, useState } from 'react';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import toast from 'react-hot-toast';
import type { Timestamp } from 'firebase/firestore';
import { useAppSelector } from '@/stores/store';
import ConfirmDialog from '@/components/ConfirmDialog';
import Modal from '@/components/Modal';
import Icon from '@/components/icons/Icon';
import { SaveButton, SettingsCard } from './ui';

/**
 * The React Quill toolbar shared by the Privacy Policy and Terms & Conditions tabs (spec §1.21).
 * WHY a fixed toolbar (not the default): the legal copy only needs headings, emphasis, lists and
 * links — a constrained toolbar keeps the stored HTML predictable for the storefront to render.
 */
const quillModules = {
  toolbar: [
    [{ header: [1, 2, 3, false] }],
    ['bold', 'italic', 'underline'],
    [{ list: 'ordered' }, { list: 'bullet' }],
    ['link', 'clean'],
  ],
};

interface Props {
  /** Rich-text HTML currently stored for this document. */
  value: string;
  /** Server "Last updated" stamp for this document (null before the first save). */
  updatedAt: Timestamp | null;
  title: string;
  description: string;
  /** Persist the edited HTML; resolves true on success. */
  onSave: (html: string) => Promise<boolean>;
  onDirtyChange: (dirty: boolean) => void;
}

/**
 * LegalEditorTab — shared body for Tab 4 (Privacy Policy) and Tab 5 (Terms & Conditions). A React Quill
 * editor + a sandboxed HTML preview, saved via a confirmation dialog with a "Last updated" stamp.
 */
const LegalEditorTab: FC<Props> = ({ value, updatedAt, title, description, onSave, onDirtyChange }) => {
  const { saveLoading } = useAppSelector((s) => s.settings);
  const [html, setHtml] = useState(value);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  // Re-seed when the underlying document changes (e.g. after a successful save re-reads the doc).
  useEffect(() => setHtml(value), [value]);

  const dirty = useMemo(() => html !== value, [html, value]);
  useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange]);

  const lastUpdated = useMemo(() => {
    if (!updatedAt) return null;
    try {
      return updatedAt.toDate().toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return null;
    }
  }, [updatedAt]);

  const doSave = async () => {
    const ok = await onSave(html);
    setConfirmOpen(false);
    if (ok) toast.success(`${title} updated`);
    else toast.error(`Could not save ${title.toLowerCase()}`);
  };

  return (
    <SettingsCard title={title} description={description}>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-[12px] text-faint">
          {lastUpdated ? `Last updated ${lastUpdated}` : 'Not yet saved'}
        </p>
        <button
          type="button"
          onClick={() => setPreviewOpen(true)}
          className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-primary hover:underline"
        >
          <Icon name="EyeLine" size={16} /> Preview
        </button>
      </div>

      <div className="settings-quill rounded-lg border border-border-strong bg-surface">
        <ReactQuill theme="snow" value={html} onChange={setHtml} modules={quillModules} />
      </div>

      <div className="mt-6 flex justify-end">
        <SaveButton onClick={() => setConfirmOpen(true)} loading={saveLoading} disabled={!dirty} />
      </div>

      <ConfirmDialog
        isOpen={confirmOpen}
        title={`Save ${title.toLowerCase()}?`}
        message={`This ${title.toLowerCase()} is shown to customers in the app and website.`}
        confirmLabel="Save"
        loading={saveLoading}
        onConfirm={doSave}
        onCancel={() => setConfirmOpen(false)}
      />

      <Modal isOpen={previewOpen} onClose={() => setPreviewOpen(false)} maxWidth="max-w-2xl">
        <div className="max-h-[80vh] overflow-y-auto rounded-xl border border-border bg-surface p-6 shadow-lg">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-[16px] font-bold text-foreground">{title} — preview</h3>
            <button
              type="button"
              onClick={() => setPreviewOpen(false)}
              className="text-faint hover:text-foreground"
              aria-label="Close preview"
            >
              <Icon name="CloseLine" size={20} />
            </button>
          </div>
          {/* WHY sandboxed container: Quill emits trusted-editor HTML, but we still scope it to a
              safe-html block so its styles can't leak into the app chrome. */}
          <div
            className="safe-html text-[14px] leading-relaxed text-foreground"
            dangerouslySetInnerHTML={{ __html: html || '<p class="text-muted">Nothing to preview.</p>' }}
          />
        </div>
      </Modal>
    </SettingsCard>
  );
};

export default LegalEditorTab;
