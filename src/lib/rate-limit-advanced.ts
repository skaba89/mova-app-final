/**
 * ═══════════════════════════════════════════════════════════════════════════
 * MOVA — Advanced Rate Limiter
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * A production-grade sliding window rate limiter with per-user/IP tracking,
 * auto-ban after repeated violations, and configurable block durations.
 * Uses the in-memory cache for TTL-based storage.
 *
 * Extends the basic rate-limit.ts with:
 * - Sliding window counter algorithm (more accurate than fixed window)
 * - Per-user and per-IP tracking with independent limits
 * - Auto-ban system after configurable violation thresholds
 * - Block/unblock management with TTL
 * - Comprehensive statistics
 *
 * @example
 * ```ts
 * import { rateLimiter } from '@/lib/rate-limit-advanced';
 *
 * // Check if a request is allowed
 * const result = rateLimiter.checkLimit('user:123', {
 *   maxRequests: 100,
 *   windowMs: 60_000,
 * });
 *
 * if (!result.allowed) {
 *   return new Response('Rate limited', {
 *     status: 429,
 *     headers: { 'Retry-After': String(Math.ceil((result.resetAt - Date.now()) / 1000)) },
 *   });
 * }
 *
 * console.log(`Remaining: ${result.remaining}`);
 *
 * // Check if someone is blocked
 * if (rateLimiter.getBlocked('user:123')) {
 *   console.log('This user is banned');
 * }
 *
 * // Unblock a user manually
 * rateLimiter.unblock('user:123');
 *
 * // View statistics
 * console.log(rateLimiter.getStats());
 * ```
 *
 * No external dependencies — uses cache.ts for storage.
 */

import { cache } from './cache';

// ─── Types ─────────────────────────────────────────────────────────────

/** Options for rate limit checking */
export interface RateLimitAdvancedOptions {
  /** Maximum number of requests allowed within the window (default: 60) */
  maxRequests?: number;
  /** Window duration in milliseconds (default: 60_000 = 1 minute) */
  windowMs?: number;
  /** Duration to block the identifier after repeated violations in ms (default: 300_000 = 5 min) */
  blockDurationMs?: number;
  /** Number of violations before auto-ban is triggered (default: 5) */
  banThreshold?: number;
  /** Ban duration multiplier - each successive ban increases by this factor (default: 2) */
  banMultiplier?: number;
}

/** Result of a rate limit check */
export interface RateLimitCheckResult {
  /** Whether the request is allowed */
  allowed: boolean;
  /** Number of remaining requests in the current window */
  remaining: number;
  /** Timestamp (ms) when the rate limit window resets */
  resetAt: number;
  /** Whether the identifier is currently blocked/banned */
  blocked: boolean;
  /** Reason for the block (if applicable) */
  reason?: 'rate_limit' | 'banned';
  /** Number of violations accumulated */
  violations: number;
}

/** Internal sliding window counter entry */
interface SlidingWindowEntry {
  /** Timestamp of each individual request (for sliding window calculation) */
  timestamps: number[];
  /** Current violation count (consecutive limit hits) */
  violations: number;
  /** Number of times this identifier has been banned */
  banCount: number;
}

/** Statistics about the rate limiter */
export interface RateLimitAdvancedStats {
  /** Total number of limit checks performed */
  totalChecks: number;
  /** Total number of requests that were blocked */
  totalBlocked: number;
  /** Total number of currently active rate limit entries */
  activeLimits: number;
  /** Total number of currently banned identifiers */
  totalBanned: number;
  /** Top violators (identifiers with most violations) */
  topViolators: Array<{ identifier: string; violations: number; banCount: number }>;
}

// ─── Constants ─────────────────────────────────────────────────────────

const DEFAULT_OPTIONS: Required<RateLimitAdvancedOptions> = {
  maxRequests: 60,
  windowMs: 60_000,
  blockDurationMs: 300_000,
  banThreshold: 5,
  banMultiplier: 2,
};

/** Cache key prefix for sliding window data */
const WINDOW_PREFIX = 'rl:window:';

/** Cache key prefix for blocked identifiers */
const BLOCK_PREFIX = 'rl:block:';

/** Cache key prefix for violation counters */
const VIOLATION_PREFIX = 'rl:violation:';

// ─── Internal State ────────────────────────────────────────────────────

/** Total checks counter */
let totalChecks = 0;

/** Total blocked counter */
let totalBlocked = 0;

// ─── Helpers ───────────────────────────────────────────────────────────

/**
 * Get the cache key for sliding window data.
 */
function windowKey(identifier: string): string {
  return `${WINDOW_PREFIX}${identifier}`;
}

/**
 * Get the cache key for block status.
 */
function blockKey(identifier: string): string {
  return `${BLOCK_PREFIX}${identifier}`;
}

/**
 * Get the cache key for violation counter.
 */
function violationKey(identifier: string): string {
  return `${VIOLATION_PREFIX}${identifier}`;
}

/**
 * Prune old timestamps outside the sliding window.
 * Returns only timestamps within the window.
 */
function pruneTimestamps(timestamps: number[], windowMs: number): number[] {
  const cutoff = Date.now() - windowMs;
  return timestamps.filter((ts) => ts > cutoff);
}

/**
 * Get or create a sliding window entry from cache.
 */
function getWindowEntry(identifier: string): SlidingWindowEntry {
  const cached = cache.getSync<SlidingWindowEntry>(windowKey(identifier));
  if (cached) return cached;
  return { timestamps: [], violations: 0, banCount: 0 };
}

/**
 * Save a sliding window entry to cache.
 * TTL is 2x the window duration to allow for natural expiry.
 */
function saveWindowEntry(identifier: string, entry: SlidingWindowEntry, windowMs: number): void {
  const ttlSeconds = Math.ceil((windowMs * 2) / 1000);
  cache.setSync(windowKey(identifier), entry, ttlSeconds);
}

/**
 * Get violation count from cache.
 */
function getViolations(identifier: string): number {
  return cache.getSync<number>(violationKey(identifier)) || 0;
}

/**
 * Increment and save violation count.
 */
function incrementViolations(identifier: string): number {
  const current = getViolations(identifier);
  const next = current + 1;
  // Store violations for 1 hour
  cache.setSync(violationKey(identifier), next, 3600);
  return next;
}

/**
 * Reset violation count for an identifier.
 */
function resetViolations(identifier: string): void {
  cache.delSync(violationKey(identifier));
}

/**
 * Calculate block duration based on ban count.
 * Uses exponential backoff: banDuration × multiplier^(banCount - 1)
 */
function calculateBlockDuration(baseDurationMs: number, banCount: number, multiplier: number): number {
  if (banCount <= 1) return baseDurationMs;
  return Math.min(
    baseDurationMs * Math.pow(multiplier, banCount - 1),
    // Cap at 24 hours
    86_400_000
  );
}

// ─── Rate Limiter API ─────────────────────────────────────────────────

/**
 * Advanced rate limiter singleton with sliding window, auto-ban, and per-user tracking.
 */
export const rateLimiter = {
  /**
   * Check if a request from the given identifier is allowed under the rate limit.
   * Implements a sliding window counter algorithm for accurate throttling.
   *
   * @param identifier - Unique identifier for the rate limit scope (e.g., "user:123", "ip:192.168.1.1")
   * @param options - Rate limit configuration options
   * @returns Check result with allowed status, remaining requests, and reset time
   *
   * @example
   * ```ts
   * const result = rateLimiter.checkLimit('user:123', {
   *   maxRequests: 100,
   *   windowMs: 60_000,
   *   blockDurationMs: 300_000,
   * });
   *
   * if (!result.allowed) {
   *   // Request is rate limited or user is banned
   *   console.log(`Blocked. Reason: ${result.reason}, Reset at: ${result.resetAt}`);
   * }
   * ```
   */
  checkLimit(identifier: string, options?: RateLimitAdvancedOptions): RateLimitCheckResult {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    totalChecks++;

    // Step 1: Check if identifier is already blocked/banned
    const blockedEntry = cache.getSync<{ until: number; reason: string }>(blockKey(identifier));
    if (blockedEntry) {
      if (blockedEntry.until > Date.now()) {
        totalBlocked++;
        return {
          allowed: false,
          remaining: 0,
          resetAt: blockedEntry.until,
          blocked: true,
          reason: 'banned',
          violations: getViolations(identifier),
        };
      }
      // Block has expired, clean it up
      cache.delSync(blockKey(identifier));
    }

    // Step 2: Sliding window counter check
    const entry = getWindowEntry(identifier);
    const now = Date.now();
    const cutoff = now - opts.windowMs;

    // Prune timestamps outside the window
    entry.timestamps = pruneTimestamps(entry.timestamps, opts.windowMs);

    // Add current request timestamp
    entry.timestamps.push(now);

    // Calculate request count within the sliding window
    const requestCount = entry.timestamps.length;

    // Calculate reset time (earliest timestamp + window)
    const oldestInWindow = entry.timestamps[0] || now;
    const resetAt = oldestInWindow + opts.windowMs;

    // Save updated entry
    saveWindowEntry(identifier, entry, opts.windowMs);

    // Check if limit exceeded
    if (requestCount > opts.maxRequests) {
      // Increment violation counter
      const violations = incrementViolations(identifier);
      entry.violations = violations;
      saveWindowEntry(identifier, entry, opts.windowMs);

      // Check if auto-ban threshold reached
      if (violations >= opts.banThreshold) {
        entry.banCount++;
        saveWindowEntry(identifier, entry, opts.windowMs);

        const blockDuration = calculateBlockDuration(
          opts.blockDurationMs,
          entry.banCount,
          opts.banMultiplier
        );

        cache.setSync(blockKey(identifier), {
          until: now + blockDuration,
          reason: 'auto_ban',
        }, Math.ceil(blockDuration / 1000));

        // Reset violation count after ban
        resetViolations(identifier);

        totalBlocked++;
        return {
          allowed: false,
          remaining: 0,
          resetAt: now + blockDuration,
          blocked: true,
          reason: 'banned',
          violations,
        };
      }

      totalBlocked++;
      return {
        allowed: false,
        remaining: 0,
        resetAt,
        blocked: false,
        reason: 'rate_limit',
        violations,
      };
    }

    // Request is allowed
    // Reset violation counter on successful (under-limit) requests
    // (violations only accumulate on consecutive limit hits)
    if (requestCount <= Math.floor(opts.maxRequests * 0.5)) {
      // Reset violations if usage drops below 50% of limit (grace period)
      const violations = getViolations(identifier);
      if (violations > 0) {
        resetViolations(identifier);
        entry.violations = 0;
        saveWindowEntry(identifier, entry, opts.windowMs);
      }
    }

    return {
      allowed: true,
      remaining: Math.max(0, opts.maxRequests - requestCount),
      resetAt,
      blocked: false,
      violations: getViolations(identifier),
    };
  },

  /**
   * Check if a specific identifier is currently blocked or banned.
   *
   * @param identifier - Unique identifier to check
   * @returns true if the identifier is currently blocked
   *
   * @example
   * ```ts
   * if (rateLimiter.getBlocked('user:123')) {
   *   return new Response('You are temporarily banned', { status: 403 });
   * }
   * ```
   */
  getBlocked(identifier: string): boolean {
    const blockedEntry = cache.getSync<{ until: number }>(blockKey(identifier));
    if (!blockedEntry) return false;

    if (blockedEntry.until <= Date.now()) {
      // Block has expired, clean up
      cache.delSync(blockKey(identifier));
      return false;
    }

    return true;
  },

  /**
   * Manually unblock a previously blocked identifier.
   * Clears the block status and resets violation count.
   *
   * @param identifier - Unique identifier to unblock
   *
   * @example
   * ```ts
   * rateLimiter.unblock('user:123');
   * ```
   */
  unblock(identifier: string): void {
    cache.delSync(blockKey(identifier));
    cache.delSync(violationKey(identifier));

    // Also clear the sliding window to give a fresh start
    cache.delSync(windowKey(identifier));
  },

  /**
   * Manually block an identifier for a specified duration.
   * Useful for admin actions against abusive users.
   *
   * @param identifier - Unique identifier to block
   * @param durationMs - How long to block for in milliseconds (default: 5 minutes)
   *
   * @example
   * ```ts
   * // Block for 1 hour
   * rateLimiter.block('user:456', 3_600_000);
   * ```
   */
  block(identifier: string, durationMs: number = 300_000): void {
    cache.setSync(
      blockKey(identifier),
      { until: Date.now() + durationMs, reason: 'manual' },
      Math.ceil(durationMs / 1000)
    );
  },

  /**
   * Get comprehensive statistics about the rate limiter.
   * Includes total checks, blocks, active limits, and top violators.
   *
   * @returns Stats object with current rate limiter metrics
   *
   * @example
   * ```ts
   * const stats = rateLimiter.getStats();
   * console.log(`Total checks: ${stats.totalChecks}`);
   * console.log(`Total blocked: ${stats.totalBlocked}`);
   * console.log(`Active limits: ${stats.activeLimits}`);
   * console.log(`Top violators:`, stats.topViolators);
   * ```
   */
  getStats(): RateLimitAdvancedStats {
    // Get all window keys
    const windowKeys = cache.keysSync(`${WINDOW_PREFIX}*`);
    // Get all block keys
    const blockKeys = cache.keysSync(`${BLOCK_PREFIX}*`);

    // Collect violators from window entries
    const violators: Array<{ identifier: string; violations: number; banCount: number }> = [];

    for (const key of windowKeys) {
      const identifier = key.slice(WINDOW_PREFIX.length);
      const entry = cache.getSync<SlidingWindowEntry>(key);
      if (entry && entry.violations > 0) {
        violators.push({
          identifier,
          violations: entry.violations,
          banCount: entry.banCount,
        });
      }
    }

    // Sort by violations descending and take top 10
    violators.sort((a, b) => b.violations - a.violations);
    const topViolators = violators.slice(0, 10);

    // Count currently active (non-expired) blocks
    let totalBanned = 0;
    for (const key of blockKeys) {
      const entry = cache.getSync<{ until: number }>(key);
      if (entry && entry.until > Date.now()) {
        totalBanned++;
      }
    }

    return {
      totalChecks,
      totalBlocked,
      activeLimits: windowKeys.length,
      totalBanned,
      topViolators,
    };
  },

  /**
   * Reset all rate limiter state including counters, blocks, and statistics.
   * WARNING: This will unblock all users and reset all tracking.
   * Primarily intended for testing and development use.
   *
   * @example
   * ```ts
   * rateLimiter.resetAll();
   * ```
   */
  resetAll(): void {
    // Clear all rate limiter cache keys
    const allKeys = [
      ...cache.keysSync(`${WINDOW_PREFIX}*`),
      ...cache.keysSync(`${BLOCK_PREFIX}*`),
      ...cache.keysSync(`${VIOLATION_PREFIX}*`),
    ];

    for (const key of allKeys) {
      cache.delSync(key);
    }

    // Reset statistics
    totalChecks = 0;
    totalBlocked = 0;
  },

  /**
   * Convenience method: extract IP from a Next.js Request and check rate limit.
   * Returns the check result. Uses common proxy headers (X-Forwarded-For, X-Real-IP).
   *
   * @param request - The incoming Next.js Request object
   * @param prefix - Key prefix (default: "ip:")
   * @param options - Rate limit options
   * @returns Rate limit check result
   *
   * @example
   * ```ts
   * export async function GET(request: NextRequest) {
   *   const result = rateLimiter.checkRequest(request, 'api:', { maxRequests: 30 });
   *   if (!result.allowed) {
   *     return NextResponse.json({ error: 'Rate limited' }, { status: 429 });
   *   }
   *   // ... handle request
   * }
   * ```
   */
  checkRequest(
    request: Request,
    prefix: string = 'ip:',
    options?: RateLimitAdvancedOptions
  ): RateLimitCheckResult {
    const forwarded = request.headers.get('x-forwarded-for');
    const realIp = request.headers.get('x-real-ip');
    const ip = forwarded?.split(',')[0]?.trim() || realIp || 'unknown';
    return this.checkLimit(`${prefix}${ip}`, options);
  },
};
