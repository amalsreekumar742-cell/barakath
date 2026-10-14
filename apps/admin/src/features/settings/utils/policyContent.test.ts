import { describe, it, expect } from 'vitest';
import { isBlankHtml } from './policyContent';

describe('isBlankHtml', () => {
  it('treats an empty or emptied Quill editor as blank', () => {
    expect(isBlankHtml('')).toBe(true);
    expect(isBlankHtml('<p><br></p>')).toBe(true);
    expect(isBlankHtml('<p>&nbsp;</p><h2> </h2>')).toBe(true);
  });

  it('treats any visible text as content', () => {
    expect(isBlankHtml('<p>We respect your privacy.</p>')).toBe(false);
    expect(isBlankHtml('<ul><li><strong>1</strong></li></ul>')).toBe(false);
  });
});
