/**
 * File size formatting utilities.
 * Converts raw byte counts into human-readable binary unit strings.
 */

const UNITS = ['Bytes', 'KB', 'MB', 'GB', 'TB'] as const;

/**
 * Formats a byte count into a human-readable size string (e.g., "4.2 MB").
 */
export function formatFileSize(
  bytes: number | string | null | undefined,
  decimals: number = 2
): string {
  if (bytes === null || bytes === undefined || bytes === '') {
    return '0 Bytes';
  }

  const numBytes = typeof bytes === 'number' ? bytes : Number(bytes);

  if (!Number.isFinite(numBytes) || numBytes <= 0) {
    return '0 Bytes';
  }

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const i = Math.floor(Math.log(numBytes) / Math.log(k));
  const safeIndex = Math.min(i, UNITS.length - 1);

  if (safeIndex === 0) {
    return `${numBytes} Bytes`;
  }

  const formattedValue = (numBytes / Math.pow(k, safeIndex)).toFixed(dm);
  return `${formattedValue} ${UNITS[safeIndex]}`;
}
