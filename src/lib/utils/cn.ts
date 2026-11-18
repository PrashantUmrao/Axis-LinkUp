/**
 * Zero-dependency class name merging utility (AUD-H18).
 * Safely merges conditional CSS / Tailwind class inputs (strings, arrays, records, falsy values)
 * without requiring external stray `cn` npm dependencies.
 */

export type ClassValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | ClassValue[]
  | Record<string, boolean | null | undefined>;

function appendClassTokens(input: ClassValue, tokens: string[]): void {
  if (!input || typeof input === 'boolean') return;

  if (typeof input === 'string' || typeof input === 'number') {
    const trimmed = String(input).trim();
    if (trimmed) tokens.push(trimmed);
    return;
  }

  if (Array.isArray(input)) {
    for (const item of input) {
      appendClassTokens(item, tokens);
    }
    return;
  }

  if (typeof input === 'object') {
    for (const [key, value] of Object.entries(input)) {
      if (value && key.trim()) {
        tokens.push(key.trim());
      }
    }
  }
}

export function cn(...inputs: ClassValue[]): string {
  const tokens: string[] = [];
  for (const input of inputs) {
    appendClassTokens(input, tokens);
  }
  return tokens.join(' ');
}

export default cn;
