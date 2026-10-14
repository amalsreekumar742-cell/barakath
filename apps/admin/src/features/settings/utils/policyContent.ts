/**
 * True when Quill HTML has no visible text — e.g. `''`, `<p><br></p>` or `<p>&nbsp;</p>`.
 *
 * WHY strip tags instead of checking `html === ''`: an emptied Quill editor still emits `<p><br></p>`,
 * so a plain emptiness check would let an admin publish a blank policy page. The toolbar has no image
 * or embed buttons, so "no text" really does mean "nothing to read".
 */
export function isBlankHtml(html: string): boolean {
  const text = html
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .trim();
  return text.length === 0;
}
