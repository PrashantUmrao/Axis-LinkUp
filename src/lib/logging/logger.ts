/**
 * Centralized, production-safe logger for Axis LinkUp.
 * Provides structured logging with automatic redaction of sensitive credentials.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
  [key: string]: unknown;
}

const LOG_LEVEL_SEVERITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

/**
 * Sensitive key patterns automatically redacted from log payloads.
 */
const SENSITIVE_KEY_PATTERNS = [
  /password/i,
  /token/i,
  /secret/i,
  /authorization/i,
  /cookie/i,
  /api[_-]?key/i,
  /private[_-]?key/i,
  /credential/i,
  /mongodb_uri/i,
  /uri/i,
];

/**
 * Cycle-safe JSON serializer using a WeakSet so circular references in error
 * or context payloads never crash the logger with TypeError (AUD-H15).
 */
export function safeJsonStringify(value: unknown): string {
  const seen = new WeakSet<object>();
  return JSON.stringify(value, (_key, val: unknown) => {
    if (typeof val === 'bigint') {
      return val.toString();
    }
    if (typeof val === 'object' && val !== null) {
      if (seen.has(val)) {
        return '[Circular]';
      }
      seen.add(val);
    }
    return val;
  });
}

/**
 * Deeply sanitizes objects to replace sensitive keys with '[REDACTED]'
 * while breaking circular object references cleanly via WeakSet (AUD-H15).
 */
export function sanitizeLogData(
  data: unknown,
  depth: number = 0,
  seen: WeakSet<object> = new WeakSet<object>()
): unknown {
  if (depth > 6 || data === null || data === undefined) {
    return data;
  }

  if (typeof data !== 'object') {
    return data;
  }

  if (seen.has(data)) {
    return '[Circular]';
  }
  seen.add(data);

  if (data instanceof Error) {
    return {
      name: data.name,
      message: data.message,
      stack: process.env.NODE_ENV === 'production' ? undefined : data.stack,
    };
  }

  if (Array.isArray(data)) {
    return data.map((item) => sanitizeLogData(item, depth + 1, seen));
  }

  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
    const isSensitive = SENSITIVE_KEY_PATTERNS.some((pattern) => pattern.test(key));
    if (isSensitive) {
      sanitized[key] = '[REDACTED]';
    } else {
      sanitized[key] = sanitizeLogData(value, depth + 1, seen);
    }
  }

  return sanitized;
}

class Logger {
  private readonly defaultContext: LogContext;
  private readonly minLevel: LogLevel;

  constructor(defaultContext: LogContext = {}) {
    this.defaultContext = defaultContext;
    const isProd = process.env.NODE_ENV === 'production';
    this.minLevel = isProd ? 'info' : 'debug';
  }

  /**
   * Creates a scoped child logger with permanent contextual tags (e.g., module: 'auth').
   */
  public child(context: LogContext): Logger {
    return new Logger({ ...this.defaultContext, ...context });
  }

  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVEL_SEVERITY[level] >= LOG_LEVEL_SEVERITY[this.minLevel];
  }

  private formatEntry(
    level: LogLevel,
    message: string,
    context?: LogContext,
    error?: unknown
  ): string {
    const isProd = process.env.NODE_ENV === 'production';
    const timestamp = new Date().toISOString();
    const mergedContext = { ...this.defaultContext, ...context };
    const sanitizedContext = sanitizeLogData(mergedContext);

    let formattedError: unknown = undefined;
    if (error !== undefined) {
      formattedError = sanitizeLogData(error);
    }

    if (isProd) {
      // Structured JSON format in production (cycle-safe)
      return safeJsonStringify({
        timestamp,
        level: level.toUpperCase(),
        message,
        ...(Object.keys(mergedContext).length > 0 ? { context: sanitizedContext } : {}),
        ...(formattedError !== undefined ? { error: formattedError } : {}),
      });
    }

    // Human-readable format in development (cycle-safe)
    const prefix = `[${timestamp}] [${level.toUpperCase()}]`;
    const contextStr =
      Object.keys(mergedContext).length > 0
        ? ` | context=${safeJsonStringify(sanitizedContext)}`
        : '';
    const errorStr =
      formattedError !== undefined ? ` | error=${safeJsonStringify(formattedError)}` : '';

    return `${prefix} ${message}${contextStr}${errorStr}`;
  }

  public debug(message: string, context?: LogContext): void {
    if (!this.shouldLog('debug')) return;
    // eslint-disable-next-line no-console
    console.debug(this.formatEntry('debug', message, context));
  }

  public info(message: string, context?: LogContext): void {
    if (!this.shouldLog('info')) return;
    console.info(this.formatEntry('info', message, context));
  }

  public warn(message: string, context?: LogContext): void {
    if (!this.shouldLog('warn')) return;
    console.warn(this.formatEntry('warn', message, context));
  }

  public error(message: string, error?: unknown, context?: LogContext): void {
    if (!this.shouldLog('error')) return;
    console.error(this.formatEntry('error', message, context, error));
  }
}

export const logger = new Logger();
export default logger;
