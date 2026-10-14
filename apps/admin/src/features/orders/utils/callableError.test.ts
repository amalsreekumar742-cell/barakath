import { describe, it, expect } from 'vitest';
import { callableErrorMessage } from './callableError';

/** Shaped like the SDK's FunctionsError: an Error with a `functions/<code>` code. */
const fnError = (code: string, message: string) =>
  Object.assign(new Error(message), { code: `functions/${code}` });

describe('callableErrorMessage', () => {
  it("passes the server's HttpsError message through", () => {
    expect(
      callableErrorMessage(fnError('failed-precondition', 'Only a Pending order can be cancelled.'), 'x'),
    ).toBe('Only a Pending order can be cancelled.');
  });

  it('replaces a code-only message with a sentence', () => {
    expect(callableErrorMessage(fnError('permission-denied', 'PERMISSION_DENIED'), 'x')).toBe(
      'You do not have permission to do this.',
    );
    expect(callableErrorMessage(fnError('unavailable', 'unavailable'), 'x')).toMatch(/could not be reached/);
  });

  it('falls back for a bare "internal" (e.g. the function is unreachable)', () => {
    expect(callableErrorMessage(fnError('internal', 'internal'), 'Could not cancel the order')).toBe(
      'Could not cancel the order',
    );
  });

  it('keeps a plain Error message and falls back for non-errors', () => {
    expect(callableErrorMessage(new Error('Network down'), 'x')).toBe('Network down');
    expect(callableErrorMessage('boom', 'fallback')).toBe('fallback');
  });
});
