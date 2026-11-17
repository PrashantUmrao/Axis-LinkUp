/**
 * Memory-Bounded Sliding-Window API Rate Limiter (NFR-SEC-06 / Phase 6.1).
 * Protects sensitive authentication, public lookup, and institutional broadcast endpoints
 * against brute-force enumeration and abuse without external runtime dependencies.
 */

import { NextResponse } from 'next/server';

export interface RateLimitOptions {
  maxRequests: number;
  windowMs: number;
}

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
  retryAfterSeconds: number;
}

interface BucketEntry {
  timestamps: number[];
  windowMs: number;
  lastSeenAt: number;
}

const MAX_TRACKED_KEYS = 10_000;
const EVICTION_SWEEP_INTERVAL_MS = 60_000;

const buckets = new Map<string, BucketEntry>();
let lastSweepAt = Date.now();

/**
 * Evicts expired or stale keys so in-memory usage stays strictly bounded.
 */
function evictStaleBuckets(now: number): void {
  if (now - lastSweepAt < EVICTION_SWEEP_INTERVAL_MS && buckets.size < MAX_TRACKED_KEYS) {
    return;
  }
  lastSweepAt = now;

  for (const [key, entry] of buckets.entries()) {
    if (now - entry.lastSeenAt > entry.windowMs) {
      buckets.delete(key);
    }
  }

  // Hard cap: drop oldest entries if cardinality still exceeds MAX_TRACKED_KEYS
  if (buckets.size >= MAX_TRACKED_KEYS) {
    const excess = buckets.size - Math.floor(MAX_TRACKED_KEYS * 0.8);
    let removed = 0;
    for (const key of buckets.keys()) {
      buckets.delete(key);
      removed += 1;
      if (removed >= excess) break;
    }
  }
}

/**
 * Evaluates whether a request identified by `key` is permitted under a sliding window.
 */
export function checkRateLimit(
  key: string,
  options: RateLimitOptions,
  now: number = Date.now()
): RateLimitResult {
  const { maxRequests, windowMs } = options;
  evictStaleBuckets(now);

  const windowStart = now - windowMs;
  const existing = buckets.get(key);
  const recentTimestamps = existing
    ? existing.timestamps.filter((ts) => ts > windowStart)
    : [];

  if (recentTimestamps.length >= maxRequests) {
    const oldestInWindow = recentTimestamps[0] ?? now;
    const resetAt = oldestInWindow + windowMs;
    const retryAfterSeconds = Math.max(1, Math.ceil((resetAt - now) / 1000));

    buckets.set(key, {
      timestamps: recentTimestamps,
      windowMs,
      lastSeenAt: now,
    });

    return {
      allowed: false,
      limit: maxRequests,
      remaining: 0,
      resetAt,
      retryAfterSeconds,
    };
  }

  recentTimestamps.push(now);
  const oldestInWindow = recentTimestamps[0] ?? now;
  const resetAt = oldestInWindow + windowMs;

  buckets.set(key, {
    timestamps: recentTimestamps,
    windowMs,
    lastSeenAt: now,
  });

  return {
    allowed: true,
    limit: maxRequests,
    remaining: Math.max(0, maxRequests - recentTimestamps.length),
    resetAt,
    retryAfterSeconds: 0,
  };
}

/**
 * Safely extracts the client IP from reverse proxy headers without trusting spoofed chains blindly.
 */
export function getClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    const firstIp = forwarded.split(',')[0]?.trim();
    if (firstIp && firstIp.length > 0 && firstIp.length <= 64) {
      return firstIp;
    }
  }

  const realIp = request.headers.get('x-real-ip')?.trim();
  if (realIp && realIp.length > 0 && realIp.length <= 64) {
    return realIp;
  }

  return 'unknown';
}

/**
 * Creates a standardized HTTP 429 Too Many Requests API response with RFC rate-limit headers.
 */
export function createRateLimitErrorResponse(result: RateLimitResult): NextResponse {
  const message = 'Too many requests. Please try again later.';

  return NextResponse.json(
    {
      success: false,
      message,
      data: null,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message,
        details: {
          retryAfterSeconds: result.retryAfterSeconds,
          limit: result.limit,
        },
      },
      timestamp: new Date().toISOString(),
    },
    {
      status: 429,
      headers: {
        'Retry-After': String(result.retryAfterSeconds),
        'X-RateLimit-Limit': String(result.limit),
        'X-RateLimit-Remaining': String(result.remaining),
        'X-RateLimit-Reset': String(Math.ceil(result.resetAt / 1000)),
      },
    }
  );
}

/**
 * Resets all rate-limiter buckets. Intended exclusively for deterministic automated testing.
 */
export function resetRateLimiter(): void {
  buckets.clear();
  lastSweepAt = Date.now();
}
