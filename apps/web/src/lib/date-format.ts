const relativeFormatter = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
const absoluteFormatter = new Intl.DateTimeFormat('en', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});
const accessibleFormatter = new Intl.DateTimeFormat('en', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

function parseDate(value: string): Date | null {
  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatAbsoluteDate(value: string): string {
  const date = parseDate(value);

  return date ? accessibleFormatter.format(date) : 'Date unavailable';
}

export function formatRelativeDate(value: string, now = new Date()): string {
  const date = parseDate(value);

  if (!date || Number.isNaN(now.getTime())) {
    return 'Date unavailable';
  }

  const differenceMs = date.getTime() - now.getTime();
  const absoluteDifferenceMs = Math.abs(differenceMs);
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (absoluteDifferenceMs < minute) {
    return 'Just now';
  }

  if (absoluteDifferenceMs < hour) {
    return relativeFormatter.format(Math.round(differenceMs / minute), 'minute');
  }

  if (absoluteDifferenceMs < day) {
    return relativeFormatter.format(Math.round(differenceMs / hour), 'hour');
  }

  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfDate = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const calendarDayDifference = Math.round((startOfDate - startOfToday) / day);

  if (calendarDayDifference >= -6 && calendarDayDifference <= 6) {
    return relativeFormatter.format(calendarDayDifference, 'day');
  }

  return absoluteFormatter.format(date);
}

export function formatCompactRelativeDate(value: string, now = new Date()): string {
  const date = parseDate(value);

  if (!date || Number.isNaN(now.getTime())) {
    return 'Date unavailable';
  }

  const differenceMs = date.getTime() - now.getTime();
  const absoluteDifferenceMs = Math.abs(differenceMs);
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (absoluteDifferenceMs < minute) {
    return 'now';
  }

  if (absoluteDifferenceMs < hour) {
    return `${Math.max(1, Math.round(absoluteDifferenceMs / minute))} min`;
  }

  if (absoluteDifferenceMs < day) {
    return `${Math.max(1, Math.round(absoluteDifferenceMs / hour))} h`;
  }

  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfDate = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const calendarDayDifference = Math.round((startOfDate - startOfToday) / day);

  if (calendarDayDifference === -1) {
    return 'yesterday';
  }

  if (calendarDayDifference < -1 && calendarDayDifference >= -6) {
    return `${Math.abs(calendarDayDifference)} days`;
  }

  if (calendarDayDifference > 0 && calendarDayDifference <= 6) {
    return `in ${calendarDayDifference} days`;
  }

  return absoluteFormatter.format(date);
}
