import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/mova/auth-middleware'

// Instance demarree au chargement du module
const startTime = Date.now()

// GET /api/mova/admin/monitoring - Donnees de surveillance (admin)
export async function GET(request: NextRequest) {
  try {
    const admin = await requireAdmin(request)
    if (admin instanceof NextResponse) return admin

    const uptimeMs = Date.now() - startTime

    // Statistiques du cache
    let cacheStats = { hits: 0, misses: 0, keys: 0, hitRate: 0 }
    try {
      const cache = (await import('@/lib/mova/cache')).default
      cacheStats = cache.getStats()
    } catch {
      // Cache non disponible
    }

    // Statistiques du limiteur de debit
    let rateLimitStats = { totalChecks: 0, totalBlocked: 0, topViolators: [] }
    try {
      const rateLimiter = (await import('@/lib/mova/rate-limit')).default
      rateLimitStats = rateLimiter.getStats()
    } catch {
      // Limiteur non disponible
    }

    // Statistiques de la file d'attente des travaux
    let jobQueueStats = { pending: 0, processing: 0, completed: 0, failed: 0 }
    try {
      const jobQueue = (await import('@/lib/mova/job-queue')).jobQueue
      jobQueueStats = jobQueue.getStats()
    } catch {
      // File non disponible
    }

    // Informations memoire et systeme
    const memoryUsage = process.memoryUsage()

    return NextResponse.json({
      success: true,
      data: {
        system: {
          uptime: {
            ms: uptimeMs,
            seconds: Math.floor(uptimeMs / 1000),
          },
          runtime: process.version,
          platform: process.platform,
          nodeEnv: process.env.NODE_ENV ?? 'development',
          cpuCount: typeof process !== 'undefined' && typeof (process as unknown as Record<string, unknown>).cpuUsage === 'function'
            ? 'disponible'
            : 'N/A',
        },
        memory: {
          rss: Math.round(memoryUsage.rss / 1024 / 1024),
          heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024),
          heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024),
          external: Math.round(memoryUsage.external / 1024 / 1024),
          arrayBuffers: Math.round((memoryUsage as unknown as Record<string, number>).arrayBuffers / 1024 / 1024) || 0,
        },
        cache: cacheStats,
        rateLimiter: rateLimitStats,
        jobQueue: jobQueueStats,
        timestamp: new Date().toISOString(),
      },
    })
  } catch (error) {
    console.error('[ADMIN/MONITORING] Erreur:', error)
    return NextResponse.json(
      { success: false, error: 'Erreur interne du serveur' },
      { status: 500 }
    )
  }
}
