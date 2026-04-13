/**
 * ═══════════════════════════════════════════════════════════════════════════
 * MOVA — Point de santé principal (Health Check)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * GET /api/mova/health → Statut global avec sondes DB + Cache
 * GET /api/mova/health/ready → Diagnostic détaillé de préparation
 * GET /api/mova/health/live → Vérification de vivacité (simple 200 OK)
 */

import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { cache } from '@/lib/cache'

export const runtime = 'nodejs'

// ─── Helpers internes ──────────────────────────────────────────────────

/** Résultat d'une sonde de dépendance */
interface ProbeResult {
  status: 'ok' | 'degraded' | 'down'
  latencyMs: number
  detail?: string
}

/** Sondage de la base de données */
async function probeDatabase(): Promise<ProbeResult> {
  try {
    const start = Date.now()
    await db.$queryRaw`SELECT 1 as ok`
    return { status: 'ok', latencyMs: Date.now() - start }
  } catch (err) {
    return {
      status: 'down',
      latencyMs: 0,
      detail: err instanceof Error ? err.message : 'Erreur de connexion à la base de données',
    }
  }
}

/** Sondage du cache (mémoire ou Redis) */
async function probeCache(): Promise<ProbeResult> {
  try {
    const start = Date.now()

    // Vérifier isConnected() si disponible (cache étendu avec Redis)
    if (typeof cache.isConnected === 'function') {
      const connected = cache.isConnected()
      if (!connected) {
        return { status: 'degraded', latencyMs: Date.now() - start, detail: 'Cache signalé comme déconnecté' }
      }
    }

    // Test de lecture/écriture pour vérifier le fonctionnement
    await cache.set('_health', 'ok', 10)
    const result = await cache.get<string>('_health')
    cache.del('_health')

    if (result !== 'ok') {
      return { status: 'degraded', latencyMs: Date.now() - start, detail: 'Cache ne répond pas correctement' }
    }

    return { status: 'ok', latencyMs: Date.now() - start }
  } catch (err) {
    return {
      status: 'degraded',
      latencyMs: 0,
      detail: err instanceof Error ? err.message : 'Erreur de sondage du cache',
    }
  }
}

/** Calcul approximatif de l'utilisation CPU */
function getCpuUsage(): string {
  try {
    const usage = process.cpuUsage()
    // Approximation basée sur le temps utilisateur + système
    const totalUs = usage.user + usage.system
    return `${(totalUs / 1_000_000).toFixed(2)}s`
  } catch {
    return 'N/A'
  }
}

/** Formater les octets en chaîne lisible */
function formatBytes(bytes: number): string {
  const mb = bytes / (1024 * 1024)
  return `${mb.toFixed(2)} MB`
}

// ─── Route principale GET /api/mova/health ─────────────────────────────

export async function GET() {
  const startTime = Date.now()

  // Sondes en parallèle
  const [dbProbe, cacheProbe] = await Promise.all([
    probeDatabase(),
    probeCache(),
  ])

  // Détermination du statut global
  const isDbDown = dbProbe.status === 'down'
  const isCacheDegraded = cacheProbe.status !== 'ok'
  const overallStatus = isDbDown ? 'critical' : isCacheDegraded ? 'degraded' : 'ok'

  // Informations mémoire
  const memUsage = process.memoryUsage()
  const uptime = process.uptime()

  // Statistiques du cache
  let cacheStats: Record<string, unknown> = {}
  try {
    const stats = await cache.stats()
    cacheStats = { keys: stats.keys, hitRate: stats.hitRate }
  } catch {
    // Ignorer les erreurs de stats
  }

  // Réponse de base
  const data: Record<string, unknown> = {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    uptime: Math.floor(uptime),
    version: '2.1.0',
    environment: process.env.NODE_ENV || 'development',
    responseTimeMs: Date.now() - startTime,
    checks: {
      database: {
        status: dbProbe.status,
        latencyMs: dbProbe.latencyMs,
      },
      cache: {
        status: cacheProbe.status,
        latencyMs: cacheProbe.latencyMs,
      },
    },
    system: {
      memoryUsed: formatBytes(memUsage.heapUsed),
      memoryTotal: formatBytes(memUsage.heapTotal),
      memoryRss: formatBytes(memUsage.rss),
      cpuTime: getCpuUsage(),
    },
  }

  // Infos supplémentaires en mode développement
  if (process.env.NODE_ENV === 'development') {
    data.diagnostics = {
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      pid: process.pid,
      cacheStats,
    }
  }

  // Code HTTP : 503 si la DB est indisponible, 200 sinon
  const statusCode = isDbDown ? 503 : 200

  return NextResponse.json(
    {
      success: !isDbDown,
      data,
    },
    { status: statusCode },
  )
}
