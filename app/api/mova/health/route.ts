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

    const uptimeMs = Date.now() - startTime

    return NextResponse.json({
      success: true,
      data: {
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: {
          seconds: Math.floor(uptimeMs / 1000),
        },
        database: {
          status: dbStatus,
          latencyMs: dbLatencyMs,
        },
      },
    })
  } catch (error) {
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
