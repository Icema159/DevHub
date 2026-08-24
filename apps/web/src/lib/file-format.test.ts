import { describe, expect, it } from 'vitest';

import { formatFileSize } from './file-format';

describe('formatFileSize', () => {
  it.each([
    [0, '0 B'],
    [842 * 1024, '842 KB'],
    [2.4 * 1024 * 1024, '2.4 MB'],
  ])('formats %s bytes as %s', (bytes, expected) => {
    expect(formatFileSize(bytes)).toBe(expected);
  });

  it('handles invalid sizes safely', () => {
    expect(formatFileSize(Number.NaN)).toBe('Size unavailable');
    expect(formatFileSize(-1)).toBe('Size unavailable');
  });
});
