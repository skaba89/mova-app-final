/**
 * ═══════════════════════════════════════════════════════════════════════════
 * MOVA — Endpoint de préparation (Readiness Probe)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * GET /api/mova/health/ready → Diagnostic détaillé pour Kubernetes / orchestrateur
 *
 * Vérifie que toutes les dépendances critiques sont opérationnelles.
 * Utilisé par les load balancers et les orchestrateurs pour décider
 * si ce pod peut recevoir du trafic.
 */

import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { cache } from '@/lib/cache'

export const runtime = 'nodejs'

/** Sondage approfondi de la base de données */
async function probeDatabase() {
  const start = Date.now()
  try {
    // Requête de test avec des métadonnées
    const result = await db.$queryRaw<Array<{ ok: number }>>`SELECT 1 as ok`

    return {
      status: 'ok' as const,
      latencyMs: Date.now() - start,
      detail: result?.[0]?.ok === 1 ? 'Base de données opérationnelle' : 'Réponse inattendue',
      engine: 'sqlite' as const,
    }
  } catch (err) {
    return {
      status: 'down' as const,
      latencyMs: Date.now() - start,
      detail: err instanceof Error ? err.message : 'Erreur de connexion à la base de données',
      engine: 'sqlite' as const,
    }
  }
}

/** Sondage approfondi du cache (mémoire ou Redis) */
async function probeCache() {
  const start = Date.now()
  try {
    // Vérifier isConnected() si disponible (pour la migration future vers Redis)
    if (typeof cache.isConnected === 'function') {
      const connected = cache.isConnected()
      if (!connected) {
        return {
          status: 'degraded' as const,
          latencyMs: Date.now() - start,
          detail: 'Cache signalé comme déconnecté',
          type: 'memory' as const,
        }
      }
    }

    // Test complet lecture/écriture
    const testData = { probeTime: Date.now(), nonce: Math.random() }
    await cache.set('_health', testData, 10)
    const result = await cache.get<{ probeTime: number; nonce: number }>('_health')
    cache.del('_health')

    if (!result || result.probeTime !== testData.probeTime) {
      return {
        status: 'degraded' as const,
        latencyMs: Date.now() - start,
        detail: 'Incohérence dans les opérations de lecture/écriture',
        type: 'memory' as const,
      }
    }

    const stats = await cache.stats()

    return {
      status: 'ok' as const,
      latencyMs: Date.now() - start,
      detail: 'Cache opérationnel',
      type: 'memory' as const,
      stats: {
        keys: stats.keys,
        hitRate: stats.hitRate,
      },
    }
  } catch (err) {
    return {
      status: 'degraded' as const,
      latencyMs: Date.now() - start,
      detail: err instanceof Error ? err.message : 'Erreur de sondage du cache',
      type: 'memory' as const,
    }
  }
}

export async function GET() {
  const startTime = Date.now()

  // Sondes en parallèle pour minimiser le temps de réponse
  const [dbResult, cacheResult] = await Promise.all([
    probeDatabase(),
    probeCache(),
  ])

  // Utilisation mémoire et CPU
  const memUsage = process.memoryUsage()
  const cpuUsage = process.cpuUsage()
  const uptime = process.uptime()

  // Statut global : critical si DB en panne, degraded si cache dégradé
  const hasCritical = dbResult.status === 'down'
  const hasDegraded = cacheResult.status !== 'ok'

  const overallStatus = hasCritical ? 'not_ready' : hasDegraded ? 'degraded' : 'ready'

  // Compteur d'entrées du cache comme proxy d'activité
  let activeConnections = 0
  try {
    const stats = await cache.stats()
    activeConnections = stats.keys
  } catch {
    // Ignorer
  }

  // Construction de la réponse avec typage explicite
  const data: Record<string, unknown> = {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    uptime: Math.floor(uptime),
    version: '2.1.0',
    environment: process.env.NODE_ENV || 'development',
    probeDurationMs: Date.now() - startTime,
    checks: {
      database: dbResult,
      cache: cacheResult,
    },
    system: {
      memory: {
        heapUsed: `${(memUsage.heapUsed / (1024 * 1024)).toFixed(2)} MB`,
        heapTotal: `${(memUsage.heapTotal / (1024 * 1024)).toFixed(2)} MB`,
        rss: `${(memUsage.rss / (1024 * 1024)).toFixed(2)} MB`,
        external: `${(memUsage.external / (1024 * 1024)).toFixed(2)} MB`,
        arrayBuffers: `${(memUsage.arrayBuffers / (1024 * 1024)).toFixed(2)} MB`,
      },
      cpu: {
        userTime: `${(cpuUsage.user / 1_000_000).toFixed(2)}s`,
        systemTime: `${(cpuUsage.system / 1_000_000).toFixed(2)}s`,
      },
      activeConnections,
      pid: process.pid,
    },
  }

  // En développement, inclure plus de détails de diagnostic
  if (process.env.NODE_ENV === 'development') {
    data.diagnostics = {
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      cwd: process.cwd(),
      env: {
        DATABASE_URL: process.env.DATABASE_URL ? '***configured***' : 'not set',
        NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN ? '***configured***' : 'not set',
        LOG_LEVEL: process.env.LOG_LEVEL || 'not set',
      },
      dependencies: {
        next: process.env.npm_package_dependencies_next || 'unknown',
        prisma: process.env.npm_package_dependencies_prisma || 'unknown',
      },
    }
  }

  // Code HTTP : 503 si non prêt, 200 si prêt ou dégradé
  const statusCode = hasCritical ? 503 : 200

  return NextResponse.json(
    {
      success: !hasCritical,
      data,
    },
    { status: statusCode },
  )
}
