const fileSizeFormatter = new Intl.NumberFormat('en', {
  maximumFractionDigits: 1,
});

export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) {
    return 'Size unavailable';
  }

  if (bytes < 1024) {
    return `${Math.round(bytes)} B`;
  }

  const kilobytes = bytes / 1024;

  if (kilobytes < 1024) {
    return `${fileSizeFormatter.format(kilobytes)} KB`;
  }

  return `${fileSizeFormatter.format(kilobytes / 1024)} MB`;
}
