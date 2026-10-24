import { describe, it, expect } from 'vitest';
import { compareVersions, isValidVersion } from './appVersion';

describe('appVersion', () => {
  it('accepts store version names and rejects anything else', () => {
    expect(isValidVersion('1')).toBe(true);
    expect(isValidVersion('1.2')).toBe(true);
    expect(isValidVersion(' 1.2.3 ')).toBe(true);
    expect(isValidVersion('1.2.3.4')).toBe(false);
    expect(isValidVersion('1.2.3+4')).toBe(false);
    expect(isValidVersion('v1.2')).toBe(false);
    expect(isValidVersion('')).toBe(false);
  });

  it('compares numerically, not as text', () => {
    expect(compareVersions('1.10.0', '1.9.0')).toBeGreaterThan(0);
    expect(compareVersions('1.2.0', '1.2.1')).toBeLessThan(0);
  });

  it('treats missing segments as zero', () => {
    expect(compareVersions('1.2', '1.2.0')).toBe(0);
    expect(compareVersions('2', '1.9.9')).toBeGreaterThan(0);
  });
});
