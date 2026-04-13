import { NextResponse } from 'next/server'
import db from '@/lib/db'

// Instance demarree a l'initialisation du module
const startTime = Date.now()

// GET /api/mova/health - Verification de l'etat du systeme (public)
export async function GET() {
  try {
    // Verifier la connectivite a la base de donnees
    const dbStartTime = Date.now()
    let dbStatus: 'connected' | 'error' = 'connected'
    let dbLatencyMs = 0

    try {
      await db.$queryRaw`SELECT 1`
      dbLatencyMs = Date.now() - dbStartTime
    } catch {
      dbStatus = 'error'
      dbLatencyMs = Date.now() - dbStartTime
    }

    // Informations sur la memoire
    const memoryUsage = process.memoryUsage()
    const uptimeMs = Date.now() - startTime

    // Lire la version depuis package.json
    let appVersion = 'inconnue'
    try {
      const packageContent = await import('fs/promises')
      const packageJson = JSON.parse(
        await packageContent.readFile('/home/z/my-project/package.json', 'utf-8')
      )
      appVersion = packageJson.version ?? 'inconnue'
    } catch {
      // Ignorer si le fichier n'est pas accessible
    }

    return NextResponse.json({
      success: true,
      data: {
        status: 'ok',
        version: appVersion,
        timestamp: new Date().toISOString(),
        uptime: {
          ms: uptimeMs,
          seconds: Math.floor(uptimeMs / 1000),
          formatted: formatUptime(uptimeMs),
        },
        database: {
          status: dbStatus,
          latencyMs: dbLatencyMs,
        },
        memory: {
          rss: `${(memoryUsage.rss / 1024 / 1024).toFixed(2)} MB`,
          heapTotal: `${(memoryUsage.heapTotal / 1024 / 1024).toFixed(2)} MB`,
          heapUsed: `${(memoryUsage.heapUsed / 1024 / 1024).toFixed(2)} MB`,
          external: `${(memoryUsage.external / 1024 / 1024).toFixed(2)} MB`,
        },
        runtime: process.version,
        platform: process.platform,
      },
    })
  } catch (error) {
    console.error('[HEALTH] Erreur lors du diagnostic:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Erreur lors du diagnostic du systeme',
        data: {
          status: 'error',
          timestamp: new Date().toISOString(),
        },
      },
      { status: 503 }
    )
  }
}

// Formater le temps d'activite en format lisible
function formatUptime(ms: number): string {
  const seconds = Math.floor(ms / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  const parts: string[] = []
  if (days > 0) parts.push(`${days}j`)
  if (hours % 24 > 0) parts.push(`${hours % 24}h`)
  if (minutes % 60 > 0) parts.push(`${minutes % 60}m`)
  if (seconds % 60 > 0) parts.push(`${seconds % 60}s`)

  return parts.length > 0 ? parts.join(' ') : '< 1s'
}
