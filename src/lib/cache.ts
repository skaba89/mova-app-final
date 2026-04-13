/**
 * ═══════════════════════════════════════════════════════════════════════════
 * MOVA — Cache Manager (Redis + In-Memory Fallback)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * A unified cache layer that tries Redis first (when REDIS_URL is set),
 * otherwise falls back to an in-memory Map-based cache with TTL expiration.
 *
 * Features:
 * - Namespace prefix support (default: "mova:")
 * - TTL support on all set operations
 * - JSON serialization for Redis (Redis stores strings only)
 * - Stats tracking (hits/misses/hitRate)
 * - incr, decr, mget, mset utility methods
 * - Health check via isConnected()
 *
 * @example
 * ```ts
 * import { cache } from '@/lib/cache';
 *
 * // Store with TTL
 * await cache.set('user:123', { name: 'Mamadou' }, 60);
 *
 * // Retrieve
 * const user = await cache.get<{ name: string }>('user:123');
 *
 * // Increment counter
 * await cache.incr('rate:user:123');
 *
 * // Check Redis availability
 * if (cache.isConnected()) {
 *   console.log('Redis is available');
 * }
 *
 * // Get Redis instance directly
 * const redis = cache.getRedis();
 * ```
 */

// ─── Types ─────────────────────────────────────────────────────────────

/** Cache statistics snapshot */
export interface CacheStats {
  /** Total number of non-expired keys currently stored */
  keys: number;
  /** Total number of successful get() calls */
  hits: number;
  /** Total number of get() calls that returned null */
  misses: number;
  /** Hit rate as a percentage string (e.g. "89.5%") */
  hitRate: string;
}

/** A single in-memory cache entry with optional expiration */
interface MemoryEntry<T = unknown> {
  /** Stored value */
  value: T;
  /** Expiration timestamp in ms (null = no expiry) */
  expires: number | null;
}

/** Options for CacheManager constructor */
export interface CacheManagerOptions {
  /** Namespace prefix for all keys (default: "mova:") */
  prefix?: string;
  /** Redis connection URL (falls back to env REDIS_URL) */
  redisUrl?: string;
}

// ─── Constants ─────────────────────────────────────────────────────────

/** Default TTL in seconds (5 minutes) */
const DEFAULT_TTL = 300;

/** Cleanup interval in milliseconds (60 seconds) */
const CLEANUP_INTERVAL_MS = 60_000;

// ─── Redis Type (dynamic import) ───────────────────────────────────────

/** Type pour l'instance Redis (ioredis) — utilisé uniquement côté serveur */
type RedisInstance = {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ...args: unknown[]): Promise<string | null>;
  del(...keys: string[]): Promise<number>;
  exists(key: string): Promise<number>;
  keys(pattern: string): Promise<string[]>;
  incr(key: string): Promise<number>;
  decr(key: string): Promise<number>;
  mget(...keys: string[]): Promise<(string | null)[]>;
  mset(...args: [string, string, ...Array<string | string>]): Promise<'OK'>;
  ping(): Promise<string>;
  flushdb(): Promise<'OK'>;
  disconnect(): void;
  on(event: string, callback: (...args: unknown[]) => void): unknown;
  status: string;
};

// ─── In-Memory Store (fallback) ────────────────────────────────────────

/** Internal Map storage for in-memory cache entries */
const memStore = new Map<string, MemoryEntry>();

/** Running total of cache hits */
let hits = 0;

/** Running total of cache misses */
let misses = 0;

/** Reference to the auto-cleanup interval timer */
let cleanupTimer: ReturnType<typeof setInterval> | null = null;

// ─── In-Memory Helpers ─────────────────────────────────────────────────

/**
 * Starts the periodic cleanup timer if not already running.
 * Scans all entries and removes any that have expired.
 */
function ensureCleanup(): void {
  if (cleanupTimer) return;

  cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of memStore) {
      if (entry.expires !== null && entry.expires <= now) {
        memStore.delete(key);
      }
    }
  }, CLEANUP_INTERVAL_MS);

  // Allow Node.js process to exit even if timer is running
  if (cleanupTimer.unref) {
    cleanupTimer.unref();
  }
}

/**
 * Manually removes all expired entries from the cache.
 */
function cleanupNow(): void {
  const now = Date.now();
  for (const [key, entry] of memStore) {
    if (entry.expires !== null && entry.expires <= now) {
      memStore.delete(key);
    }
  }
}

// ─── CacheManager Class ────────────────────────────────────────────────

/**
 * CacheManager — classe unifiée avec backend Redis + fallback en mémoire.
 *
 * Si REDIS_URL est configuré, toutes les opérations passent par Redis.
 * Sinon, on utilise un cache en mémoire pur (Map avec TTL).
 */
export class CacheManager {
  /** Préfixe d'espace de noms pour toutes les clés */
  private prefix: string;

  /** Instance Redis (null si indisponible) */
  private redis: RedisInstance | null = null;

  /** Indique si Redis est disponible */
  private redisReady = false;

  constructor(options: CacheManagerOptions = {}) {
    this.prefix = options.prefix ?? 'mova:';
    this.initRedis(options.redisUrl);
  }

  /**
   * Initialise la connexion Redis si REDIS_URL est défini.
   * Import dynamique pour éviter les erreurs de build quand Redis n'est pas installé.
   */
  private initRedis(url?: string): void {
    const redisUrl = url ?? process.env.REDIS_URL;
    if (!redisUrl) {
      // Pas d'URL Redis configurée → mode mémoire uniquement
      return;
    }

    try {
      // Importation dynamique de ioredis
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const Redis = require('ioredis');
      this.redis = new Redis(redisUrl, {
        maxRetriesPerRequest: 3,
        retryStrategy(times: number) {
          const delay = Math.min(times * 200, 2000);
          return delay;
        },
        lazyConnect: true,
      }) as RedisInstance;

      // Gestion des événements de connexion
      this.redis.on('ready', () => {
        this.redisReady = true;
      });

      this.redis.on('error', (err: unknown) => {
        this.redisReady = false;
        const message = err instanceof Error ? err.message : String(err);
        console.warn(`[MOVA Cache] Erreur Redis: ${message}`);
      });

      this.redis.on('close', () => {
        this.redisReady = false;
      });
    } catch {
      console.warn('[MOVA Cache] Impossible de charger ioredis — mode mémoire activé');
      this.redis = null;
    }
  }

  /**
   * Préfixe une clé avec l'espace de noms configuré.
   */
  private ns(key: string): string {
    return `${this.prefix}${key}`;
  }

  /**
   * Sérialise une valeur en chaîne JSON pour Redis.
   */
  private serialize(value: unknown): string {
    return JSON.stringify(value);
  }

  /**
   * Désérialise une chaîne JSON depuis Redis.
   */
  private deserialize<T = unknown>(raw: string | null): T | null {
    if (raw === null) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  // ─── Public API ──────────────────────────────────────────────────────

  /**
   * Retrieve a value from the cache by key.
   * Returns null if the key does not exist or has expired.
   *
   * @typeParam T - Expected type of the cached value
   * @param key - Cache key to look up
   * @returns The cached value cast to T, or null if missing/expired
   */
  async get<T = unknown>(key: string): Promise<T | null> {
    if (this.redis && this.redisReady) {
      try {
        const raw = await this.redis.get(this.ns(key));
        if (raw === null) {
          misses++;
          return null;
        }
        hits++;
        return this.deserialize<T>(raw);
      } catch {
        // Erreur Redis → fallback en mémoire
        return this.getFromMemory<T>(key);
      }
    }
    return this.getFromMemory<T>(key);
  }

  /**
   * Store a value in the cache.
   *
   * @param key - Cache key
   * @param value - Value to cache (any serializable type)
   * @param ttlSeconds - Time-to-live in seconds (default: 300 = 5 min). Pass 0 or undefined for no expiration.
   */
  async set(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
    if (this.redis && this.redisReady) {
      try {
        const serialized = this.serialize(value);
        const nsKey = this.ns(key);
        if (ttlSeconds && ttlSeconds > 0) {
          await this.redis.set(nsKey, serialized, 'EX', ttlSeconds);
        } else {
          await this.redis.set(nsKey, serialized);
        }
        return;
      } catch {
        // Erreur Redis → fallback en mémoire
      }
    }
    this.setToMemory(key, value, ttlSeconds);
  }

  /**
   * Delete a specific key from the cache.
   */
  async del(key: string): Promise<void> {
    if (this.redis && this.redisReady) {
      try {
        await this.redis.del(this.ns(key));
        return;
      } catch {
        // Fallback
      }
    }
    memStore.delete(this.ns(key));
  }

  /**
   * Check if a non-expired key exists in the cache.
   */
  async has(key: string): Promise<boolean> {
    if (this.redis && this.redisReady) {
      try {
        const exists = await this.redis.exists(this.ns(key));
        return exists === 1;
      } catch {
        // Fallback
      }
    }
    return this.hasInMemory(key);
  }

  /**
   * Remove all entries from the cache (current namespace only).
   * Does NOT reset hit/miss statistics.
   */
  async clear(): Promise<void> {
    if (this.redis && this.redisReady) {
      try {
        const keys = await this.redis.keys(`${this.prefix}*`);
        if (keys.length > 0) {
          await this.redis.del(...keys);
        }
        return;
      } catch {
        // Fallback
      }
    }
    memStore.clear();
  }

  /**
   * Alias for clear(). Matches the Redis FLUSHDB command pattern.
   */
  async flush(): Promise<void> {
    await this.clear();
  }

  /**
   * Get all cache keys (within namespace), optionally filtered by a simple glob pattern.
   * Expired entries are cleaned up before returning keys.
   *
   * Supports a single `*` wildcard that matches any substring.
   * Note: For Redis, the pattern is applied to the unprefixed keys.
   */
  async keys(pattern?: string): Promise<string[]> {
    if (this.redis && this.redisReady) {
      try {
        const redisPattern = pattern
          ? `${this.prefix}${pattern}`
          : `${this.prefix}*`;
        const allKeys = await this.redis.keys(redisPattern);
        // Retirer le préfixe des clés retournées
        return allKeys.map((k) => k.slice(this.prefix.length));
      } catch {
        // Fallback
      }
    }
    return this.keysInMemory(pattern);
  }

  /**
   * Get cache performance statistics.
   */
  async stats(): Promise<CacheStats> {
    let keyCount: number;

    if (this.redis && this.redisReady) {
      try {
        const allKeys = await this.redis.keys(`${this.prefix}*`);
        keyCount = allKeys.length;
      } catch {
        cleanupNow();
        keyCount = memStore.size;
      }
    } else {
      cleanupNow();
      keyCount = memStore.size;
    }

    const total = hits + misses;
    const hitRate = total === 0 ? '0.0%' : `${((hits / total) * 100).toFixed(1)}%`;

    return {
      keys: keyCount,
      hits,
      misses,
      hitRate,
    };
  }

  /**
   * Reset all statistics (hits, misses) and clear the cache.
   */
  async resetStats(): Promise<void> {
    hits = 0;
    misses = 0;
    await this.clear();
  }

  /**
   * Incrémente un compteur de 1. Si la clé n'existe pas, elle est initialisée à 0
   * puis incrémentée (résultat: 1).
   *
   * @param key - Clé du compteur
   * @returns La nouvelle valeur du compteur
   */
  async incr(key: string): Promise<number> {
    if (this.redis && this.redisReady) {
      try {
        return await this.redis.incr(this.ns(key));
      } catch {
        // Fallback
      }
    }
    return this.incrInMemory(key);
  }

  /**
   * Décrémente un compteur de 1. Si la clé n'existe pas, elle est initialisée à 0
   * puis décrémentée (résultat: -1).
   *
   * @param key - Clé du compteur
   * @returns La nouvelle valeur du compteur
   */
  async decr(key: string): Promise<number> {
    if (this.redis && this.redisReady) {
      try {
        return await this.redis.decr(this.ns(key));
      } catch {
        // Fallback
      }
    }
    return this.decrInMemory(key);
  }

  /**
   * Récupère plusieurs valeurs en une seule opération.
   *
   * @param keys - Liste des clés à récupérer
   * @returns Tableau de valeurs (null pour les clés manquantes)
   */
  async mget<T = unknown>(keys: string[]): Promise<(T | null)[]> {
    if (keys.length === 0) return [];

    if (this.redis && this.redisReady) {
      try {
        const nsKeys = keys.map((k) => this.ns(k));
        const rawValues = await this.redis.mget(...nsKeys);
        return rawValues.map((raw) => this.deserialize<T>(raw));
      } catch {
        // Fallback
      }
    }

    return keys.map((key) => this.getFromMemory<T>(key));
  }

  /**
   * Définit plusieurs valeurs en une seule opération.
   *
   * @param entries - Paires clé/valeur à définir
   * @param ttlSeconds - TTL optionnel appliqué à toutes les entrées
   */
  async mset(entries: Record<string, unknown>, ttlSeconds?: number): Promise<void> {
    const keys = Object.keys(entries);
    if (keys.length === 0) return;

    if (this.redis && this.redisReady) {
      try {
        if (ttlSeconds && ttlSeconds > 0) {
          // Redis ne supporte pas TTL avec MSET → utiliser SET individuel avec pipeline
          const pipeline = (this.redis as unknown as { pipeline(): { set(k: string, v: string, ...a: unknown[]): unknown; exec(): Promise<unknown[]> } }).pipeline();
          for (const [k, v] of Object.entries(entries)) {
            pipeline.set(this.ns(k), this.serialize(v), 'EX', ttlSeconds);
          }
          await pipeline.exec();
          return;
        } else {
          // MSET natif (sans TTL)
          const args: [string, string, ...Array<string | string>] = ['' as string, '' as string];
          args.length = 0;
          for (const [k, v] of Object.entries(entries)) {
            args.push(this.ns(k), this.serialize(v));
          }
          await (this.redis as unknown as { mset(...a: [string, string, ...Array<string | string>]): Promise<'OK'> }).mset(...args);
          return;
        }
      } catch {
        // Fallback
      }
    }

    // Fallback en mémoire
    for (const [k, v] of Object.entries(entries)) {
      this.setToMemory(k, v, ttlSeconds);
    }
  }

  /**
   * Retourne l'instance Redis sous-jacente, ou null si indisponible.
   * Utile pour les opérations avancées non couvertes par CacheManager.
   */
  getRedis(): RedisInstance | null {
    return this.redis;
  }

  /**
   * Vérifie si Redis est connecté et prêt.
   */
  isConnected(): boolean {
    return this.redisReady && this.redis !== null;
  }

  // ─── In-Memory Fallback Methods ──────────────────────────────────────

  private getFromMemory<T = unknown>(key: string): T | null {
    ensureCleanup();
    const nsKey = this.ns(key);
    const entry = memStore.get(nsKey);
    if (!entry) {
      misses++;
      return null;
    }
    if (entry.expires !== null && entry.expires <= Date.now()) {
      memStore.delete(nsKey);
      misses++;
      return null;
    }
    hits++;
    return entry.value as T;
  }

  private setToMemory(key: string, value: unknown, ttlSeconds?: number): void {
    ensureCleanup();
    const nsKey = this.ns(key);
    const entry: MemoryEntry = {
      value,
      expires: ttlSeconds && ttlSeconds > 0
        ? Date.now() + ttlSeconds * 1000
        : null,
    };
    memStore.set(nsKey, entry);
  }

  private hasInMemory(key: string): boolean {
    ensureCleanup();
    const nsKey = this.ns(key);
    const entry = memStore.get(nsKey);
    if (!entry) return false;
    if (entry.expires !== null && entry.expires <= Date.now()) {
      memStore.delete(nsKey);
      return false;
    }
    return true;
  }

  private keysInMemory(pattern?: string): string[] {
    cleanupNow();
    if (!pattern) {
      return Array.from(memStore.keys()).map((k) => k.slice(this.prefix.length));
    }

    // Convertir le motif glob en RegExp (supporte seulement *)
    const fullPattern = this.ns(pattern);
    const regexStr = fullPattern
      .replace(/[.+^${}()|[\]\\]/g, '\\$&')
      .replace(/\*/g, '.*');

    const regex = new RegExp(`^${regexStr}$`);
    return Array.from(memStore.keys())
      .filter((key) => regex.test(key))
      .map((k) => k.slice(this.prefix.length));
  }

  // ─── Synchronous In-Memory API (for rate limiting) ────────────────
  /** Synchronous get — operates on in-memory store only */
  getSync<T = unknown>(key: string): T | null {
    return this.getFromMemory<T>(key);
  }

  /** Synchronous set — operates on in-memory store only */
  setSync(key: string, value: unknown, ttlSeconds?: number): void {
    this.setToMemory(key, value, ttlSeconds);
  }

  /** Synchronous delete — operates on in-memory store only */
  delSync(key: string): void {
    memStore.delete(this.ns(key));
  }

  /** Synchronous keys — operates on in-memory store only */
  keysSync(pattern?: string): string[] {
    return this.keysInMemory(pattern);
  }

  private incrInMemory(key: string): number {
    ensureCleanup();
    const nsKey = this.ns(key);
    const entry = memStore.get(nsKey);

    let current = 0;
    if (entry && (entry.expires === null || entry.expires > Date.now())) {
      current = typeof entry.value === 'number' ? entry.value : 0;
    }

    const newVal = current + 1;
    memStore.set(nsKey, {
      value: newVal,
      expires: entry?.expires ?? null,
    });
    return newVal;
  }

  private decrInMemory(key: string): number {
    ensureCleanup();
    const nsKey = this.ns(key);
    const entry = memStore.get(nsKey);

    let current = 0;
    if (entry && (entry.expires === null || entry.expires > Date.now())) {
      current = typeof entry.value === 'number' ? entry.value : 0;
    }

    const newVal = current - 1;
    memStore.set(nsKey, {
      value: newVal,
      expires: entry?.expires ?? null,
    });
    return newVal;
  }
}

// ─── Singleton Instance ────────────────────────────────────────────────

/** Instance singleton du gestionnaire de cache MOVA */
export const cache = new CacheManager();

// ─── Type Exports ──────────────────────────────────────────────────────

export type { MemoryEntry };
