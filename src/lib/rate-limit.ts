// ─── In-Memory Sliding Window Rate Limiter ────────────────────────────
// No external dependencies. Stores state in a Map with auto-cleanup.

interface RateLimitEntry {
  count: number;
  resetTime: number; // timestamp in ms
}

interface RateLimitOptions {
  /** Max requests allowed within the window */
  maxRequests?: number;
  /** Window duration in milliseconds (default: 60_000 = 1 minute) */
  windowMs?: number;
  /** Cleanup interval in milliseconds (default: 300_000 = 5 minutes) */
  cleanupIntervalMs?: number;
}

interface RateLimitStatus {
  remaining: number;
  resetTime: number;
  limited: boolean;
}

const DEFAULT_OPTIONS: Required<RateLimitOptions> = {
  maxRequests: 60,
  windowMs: 60_000,
  cleanupIntervalMs: 300_000,
};

// ─── Store ────────────────────────────────────────────────────────────
const store = new Map<string, RateLimitEntry>();

// ─── Auto-Cleanup Expired Entries ─────────────────────────────────────
let cleanupTimer: ReturnType<typeof setInterval> | null = null;

function startCleanup(intervalMs: number): void {
  if (cleanupTimer) return; // already running
  cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store) {
      if (entry.resetTime <= now) {
        store.delete(key);
      }
    }
  }, intervalMs);

  // Allow the Node.js process to exit even if the timer is running
  if (cleanupTimer.unref) {
    cleanupTimer.unref();
  }
}

// ─── Core: Get / Update Rate Limit Status ─────────────────────────────
function getRateLimitStatus(
  ip: string,
  options: Required<RateLimitOptions>
): RateLimitStatus {
  const now = Date.now();

  const entry = store.get(ip);
  if (!entry || entry.resetTime <= now) {
    // New window
    const newEntry: RateLimitEntry = {
      count: 1,
      resetTime: now + options.windowMs,
    };
    store.set(ip, newEntry);
    return {
      remaining: options.maxRequests - 1,
      resetTime: newEntry.resetTime,
      limited: false,
    };
  }

  // Existing window
  const newCount = entry.count + 1;
  entry.count = newCount;

  const limited = newCount > options.maxRequests;

  return {
    remaining: Math.max(0, options.maxRequests - newCount),
    resetTime: entry.resetTime,
    limited,
  };
}

// ─── Public API ───────────────────────────────────────────────────────

/**
 * Get the rate limit status for a given IP.
 */
export function getRateLimitStatusForIp(
  ip: string,
  options?: RateLimitOptions
): RateLimitStatus {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  startCleanup(opts.cleanupIntervalMs);
  return getRateLimitStatus(ip, opts);
}

/**
 * Check if an IP is rate limited.
 */
export function isRateLimited(ip: string, options?: RateLimitOptions): boolean {
  return getRateLimitStatusForIp(ip, options).limited;
}

/**
 * Rate limit middleware for Next.js API routes / middleware.
 * Returns a NextResponse if limited, or null if allowed.
 *
 * Usage in middleware:
 *   const limited = rateLimitMiddleware(request, { maxRequests: 5 });
 *   if (limited) return limited;
 */
export function rateLimitMiddleware(
  request: Request,
  options?: RateLimitOptions & { identifier?: string }
): Response | null {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  startCleanup(opts.cleanupIntervalMs);

  // Get client IP from common headers, fallback to unknown
  const forwarded = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');
  const ip = options?.identifier || forwarded?.split(',')[0]?.trim() || realIp || 'unknown';

  const status = getRateLimitStatus(ip, opts);

  if (status.limited) {
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Trop de requêtes. Veuillez réessayer dans un instant.',
      }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': String(Math.ceil((status.resetTime - Date.now()) / 1000)),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': String(status.resetTime),
        },
      }
    );
  }

  // Not limited — attach rate limit headers to the request (caller can forward)
  return null;
}

/**
 * Separate login rate limiter (5 attempts per minute per IP).
 * Stricter than the general rate limiter.
 */
export function loginRateLimiter(request: Request): Response | null {
  return rateLimitMiddleware(request, {
    maxRequests: 5,
    windowMs: 60_000,
    identifier: 'login:' + (request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') || 'unknown'),
  });
}
