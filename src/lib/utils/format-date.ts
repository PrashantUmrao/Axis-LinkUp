/**
 * Date and time formatting utilities.
 * Pure TypeScript using standard Intl APIs with safe fallback handling.
 */

/**
 * Safely parses an input value into a valid Date object.
 * Returns null if the value is invalid or nullish.
 */
export function toSafeDate(value: Date | string | number | null | undefined): Date | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Formats a date value into a human-readable date string (e.g., "12 Nov 2026").
 * Uses Indian English ('en-IN') locale defaults appropriate for Axis Institute.
 */
export function formatDate(
  value: Date | string | number | null | undefined,
  options: Intl.DateTimeFormatOptions = {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }
): string {
  const date = toSafeDate(value);
  if (!date) return '';

  return new Intl.DateTimeFormat('en-IN', options).format(date);
}

/**
 * Formats a date value into date and time (e.g., "12 Nov 2026, 02:30 PM").
 */
export function formatDateTime(
  value: Date | string | number | null | undefined,
  options: Intl.DateTimeFormatOptions = {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }
): string {
  const date = toSafeDate(value);
  if (!date) return '';

  return new Intl.DateTimeFormat('en-IN', options).format(date);
}

/**
 * Formats a date value into time only (e.g., "02:30 PM").
 */
export function formatTime(
  value: Date | string | number | null | undefined,
  options: Intl.DateTimeFormatOptions = {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }
): string {
  const date = toSafeDate(value);
  if (!date) return '';

  return new Intl.DateTimeFormat('en-IN', options).format(date);
}

/**
 * Formats a date into a friendly relative time string (e.g., "just now", "5 minutes ago").
 */
export function formatRelativeTime(value: Date | string | number | null | undefined): string {
  const date = toSafeDate(value);
  if (!date) return '';

  const now = new Date();
  const diffInMs = date.getTime() - now.getTime();
  const diffInSeconds = Math.round(diffInMs / 1000);
  const absSeconds = Math.abs(diffInSeconds);

  // Within 30 seconds
  if (absSeconds < 30) {
    return 'just now';
  }

  // Under an hour
  if (absSeconds < 3600) {
    const minutes = Math.round(absSeconds / 60);
    return diffInSeconds < 0 ? `${minutes}m ago` : `in ${minutes}m`;
  }

  // Under a day
  if (absSeconds < 86400) {
    const hours = Math.round(absSeconds / 3600);
    return diffInSeconds < 0 ? `${hours}h ago` : `in ${hours}h`;
  }

  // Under 7 days
  if (absSeconds < 604800) {
    const days = Math.round(absSeconds / 86400);
    return diffInSeconds < 0 ? `${days}d ago` : `in ${days}d`;
  }

  // Greater than 7 days, fallback to standard date string
  return formatDate(date);
}

/**
 * Converts a date to an ISO string safely, returning empty string on invalid input.
 */
export function toISODateString(value: Date | string | number | null | undefined): string {
  const date = toSafeDate(value);
  return date ? date.toISOString() : '';
}
