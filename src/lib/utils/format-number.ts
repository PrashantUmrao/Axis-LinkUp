/**
 * Number and currency formatting utilities.
 * Uses standard Intl.NumberFormat with Indian locale conventions (en-IN).
 */

/**
 * Safely parses an input value into a number.
 * Returns null if the value is not a finite number.
 */
function toSafeNumber(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const num = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(num) ? num : null;
}

/**
 * Formats a number according to Indian grouping (e.g., 1,25,000).
 */
export function formatNumber(
  value: number | string | null | undefined,
  options?: Intl.NumberFormatOptions
): string {
  const num = toSafeNumber(value);
  if (num === null) return '0';

  return new Intl.NumberFormat('en-IN', options).format(num);
}

/**
 * Formats a monetary amount in Indian Rupees (INR) or specified currency (e.g., "₹1,500").
 */
export function formatCurrency(
  amount: number | string | null | undefined,
  currency: string = 'INR',
  maximumFractionDigits: number = 0
): string {
  const num = toSafeNumber(amount);
  if (num === null) return '₹0';

  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    maximumFractionDigits,
  }).format(num);
}

/**
 * Formats a fractional number or percentage value (e.g., 0.785 -> "78.5%").
 * If value > 1, treats it as an already-multiplied percentage (e.g., 78.5 -> "78.5%").
 */
export function formatPercentage(
  value: number | string | null | undefined,
  decimals: number = 1
): string {
  const num = toSafeNumber(value);
  if (num === null) return '0%';

  const percentage = Math.abs(num) <= 1 && num !== 0 ? num * 100 : num;
  return `${percentage.toFixed(decimals)}%`;
}

/**
 * Formats a large number into compact notation (e.g., 1200 -> "1.2K", 150000 -> "1.5L").
 */
export function formatCompactNumber(value: number | string | null | undefined): string {
  const num = toSafeNumber(value);
  if (num === null) return '0';

  return new Intl.NumberFormat('en-IN', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(num);
}
