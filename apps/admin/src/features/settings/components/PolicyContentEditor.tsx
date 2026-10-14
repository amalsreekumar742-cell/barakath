import type { FC } from 'react';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';

/**
 * The React Quill toolbar for policy content (spec §1.21).
 * WHY a fixed toolbar (not the default): policy copy only needs headings, emphasis, lists and links — a
 * constrained toolbar keeps the stored HTML predictable for the website (DOMPurify) and the app (WebView)
 * to render. WHY module scope: Quill re-initialises when `modules` changes identity, which would wipe the
 * editor on every render if this were built inline.
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
  /** Rich-text HTML. */
  value: string;
  onChange: (html: string) => void;
  onBlur?: () => void;
  disabled?: boolean;
  /** Paints the error border (the message itself is rendered by the caller). */
  invalid?: boolean;
}

/**
 * PolicyContentEditor — the Quill editor used by the policy editor page; a controlled field for
 * react-hook-form's Controller. Styled by the global `.settings-quill` overrides (warm borders, radius,
 * font) so it matches the rest of Settings.
 *
 * WHY only `source === 'user'` changes are forwarded: Quill also emits a change when it loads `value`
 * (source `api`) and may normalise the markup while doing so. Forwarding that would mark a freshly
 * opened, untouched policy as edited — and trip the "discard changes?" prompt on Cancel. Toolbar
 * formatting and typing are both `user` changes, so every real edit still reaches the form.
 */
const PolicyContentEditor: FC<Props> = ({ value, onChange, onBlur, disabled = false, invalid = false }) => (
  <div
    className={`settings-quill rounded-lg border bg-surface ${invalid ? 'border-error' : 'border-border-strong'} ${
      disabled ? 'opacity-60' : ''
    }`}
  >
    <ReactQuill
      theme="snow"
      value={value}
      readOnly={disabled}
      modules={quillModules}
      placeholder="Write the policy content…"
      onChange={(html, _delta, source) => {
        if (source === 'user') onChange(html);
      }}
      onBlur={() => onBlur?.()}
    />
  </div>
);

export default PolicyContentEditor;
