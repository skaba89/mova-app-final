import { PrismaClient, type WalletTransaction } from '@prisma/client'

// Re-export du type WalletTransaction pour commodité
export type { WalletTransaction }

// ─── Decimal Serialization ──────────────────────────────────────────────

/**
 * Recursively walks through Prisma query results and converts
 * Decimal / BigNumber objects to plain JavaScript numbers.
 *
 * Prisma Decimal instances expose a `toFixed()` method, which is
 * the safest duck-typing check (works across all Prisma versions).
 * We intentionally avoid converting Date objects, strings, booleans,
 * plain numbers, or any other non-Decimal value.
 */
function serialize<T>(data: T): T {
  if (data === null || data === undefined) return data

  // bigint → Number
  if (typeof data === 'bigint') return Number(data) as unknown as T

  // Prisma Decimal / BigNumber → Number (toFixed is the canonical duck-typing trait)
  if (
    typeof data === 'object' &&
    data !== null &&
    typeof (data as any).toFixed === 'function'
  ) {
    // Use toFixed(2) to keep two decimal places, then convert to Number
    return Number((data as any).toFixed(2)) as unknown as T
  }

  // Arrays → recurse into each element
  if (Array.isArray(data)) {
    return data.map(serialize) as unknown as T
  }

  // Plain objects → recurse into each value, but skip Date instances
  if (typeof data === 'object' && !(data instanceof Date)) {
    const result: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
      result[key] = serialize(value)
    }
    return result as unknown as T
  }

  return data
}

// ─── Configuration ─────────────────────────────────────────────────────

/** Taille du pool de connexions (configurable via DB_POOL_SIZE, défaut: 10) */
const DB_POOL_SIZE = parseInt(process.env.DB_POOL_SIZE ?? '10', 10) || 10;

/** Timeout du pool en secondes (configurable via DB_POOL_TIMEOUT, défaut: 30) */
const DB_POOL_TIMEOUT = parseInt(process.env.DB_POOL_TIMEOUT ?? '30', 10) || 30;

/** Active les logs de requêtes uniquement en développement */
const ENABLE_QUERY_LOG = process.env.NODE_ENV !== 'production';

// ─── Client Prisma ─────────────────────────────────────────────────────

/**
 * Creates a PrismaClient with the Decimal serialization extension.
 * Uses `$extends` (Prisma 5+/6+ API) to intercept all query results
 * and convert Decimal fields to plain JavaScript numbers.
 */
function createPrismaClient() {
  const client = process.env.NODE_ENV === 'production'
    ? new PrismaClient({
        log: ENABLE_QUERY_LOG ? ['query'] : [],
        datasourceUrl: buildDatasourceUrl(),
      })
    : new PrismaClient({
        log: ENABLE_QUERY_LOG ? ['query'] : [],
        datasources: {
          db: {
            url: process.env.DATABASE_URL,
          },
        },
      })

  return client.$extends({
    query: {
      $allModels: {
        async $allOperations({ args, query }) {
          const result = await query(args)
          return serialize(result)
        },
      },
    },
  })
}

// Construction de l'URL avec paramètres de pool
function buildDatasourceUrl(baseUrl?: string): string | undefined {
  const url = baseUrl ?? process.env.DATABASE_URL;
  if (!url) return undefined;

  if (process.env.NODE_ENV === 'production') {
    // Ajout des paramètres de pool à l'URL en production
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}connection_limit=${DB_POOL_SIZE}&pool_timeout=${DB_POOL_TIMEOUT}`;
  }

  return url;
}

// ─── Global Singleton ─────────────────────────────────────────────────

type ExtendedPrismaClient = ReturnType<typeof createPrismaClient>

const globalForPrisma = globalThis as unknown as {
  prisma: ExtendedPrismaClient | undefined
}

export const db: ExtendedPrismaClient = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db

// ─── Health Check ──────────────────────────────────────────────────────

/**
 * Vérifie que la connexion à la base de données est fonctionnelle.
 * Exécute une requête simple `SELECT 1` pour valider la connexion.
 *
 * @returns `true` si la connexion est OK, `false` sinon
 *
 * @example
 * ```ts
 * import { healthCheck } from '@/lib/db';
 *
 * const isHealthy = await healthCheck();
 * if (!isHealthy) {
 *   console.error('Base de données indisponible');
 * }
 * ```
 */
export async function healthCheck(): Promise<boolean> {
  try {
    await db.$queryRaw`SELECT 1`
    return true
  } catch (error) {
    console.error('[MOVA DB] Erreur de santé de la base de données:', error)
    return false
  }
}
