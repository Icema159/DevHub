import { describe, expect, it } from 'vitest';

import { formatCompactRelativeDate, formatRelativeDate } from './date-format';

describe('formatRelativeDate', () => {
  const now = new Date('2026-07-29T12:00:00.000Z');

  it('formats recent and calendar-relative dates without a date dependency', () => {
    expect(formatRelativeDate('2026-07-29T10:00:00.000Z', now)).toBe('2 hours ago');
    expect(formatRelativeDate('2026-07-28T10:00:00.000Z', now)).toBe('yesterday');
  });

  it('falls back safely for invalid values', () => {
    expect(formatRelativeDate('not-a-date', now)).toBe('Date unavailable');
  });
});

describe('formatCompactRelativeDate', () => {
  const now = new Date('2026-07-29T12:00:00.000Z');

  it('keeps dense conversation-list timestamps compact', () => {
    expect(formatCompactRelativeDate('2026-07-29T11:58:00.000Z', now)).toBe('2 min');
    expect(formatCompactRelativeDate('2026-07-29T10:00:00.000Z', now)).toBe('2 h');
    expect(formatCompactRelativeDate('2026-07-28T10:00:00.000Z', now)).toBe('yesterday');
  });

  it('falls back safely for invalid values', () => {
    expect(formatCompactRelativeDate('not-a-date', now)).toBe('Date unavailable');
  });
});
