import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { requireAdmin } from '@/lib/mova/auth-middleware'

export const runtime = 'nodejs'

/**
 * GET /api/mova/admin/tracking-stats
 *
 * Proxy endpoint that fetches real-time tracking stats from the
 * Socket.IO tracking mini-service (port 3004) and returns them
 * to the admin dashboard frontend.
 *
 * Auth: Requires admin role via JWT Bearer token.
 * Errors: Returns 503 if the tracking service is unreachable.
 */
export async function GET(request: NextRequest) {
  try {
    // ── Admin authorization check ────────────────────────────────
    const authResult = await requireAdmin(request)
    if (!authResult.success) {
      return authResult.response
    }

    // ── Fetch from tracking service ──────────────────────────────
    const trackingServiceUrl =
      process.env.TRACKING_SERVICE_URL || 'http://localhost:3004'

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 5000) // 5s timeout

    let response: Response
    try {
      response = await fetch(`${trackingServiceUrl}/api/stats`, {
        method: 'GET',
        signal: controller.signal,
        headers: {
          Accept: 'application/json',
        },
      })
    } catch (fetchError) {
      clearTimeout(timeout)

      // Tracking service is unreachable
      return NextResponse.json(
        {
          success: false,
          error:
            'Service de suivi indisponible. Vérifiez que le service de tracking est en cours d\'exécution sur le port 3004.',
          code: 'TRACKING_SERVICE_UNREACHABLE',
        },
        { status: 503 }
      )
    }

    clearTimeout(timeout)

    if (!response.ok) {
      return NextResponse.json(
        {
          success: false,
          error: `Le service de suivi a renvoyé une erreur (HTTP ${response.status}).`,
          code: 'TRACKING_SERVICE_ERROR',
        },
        { status: 502 }
      )
    }

    // ── Forward the tracking data ────────────────────────────────
    const data = await response.json()

    return NextResponse.json(
      {
        success: true,
        data,
      },
      {
        headers: {
          'Cache-Control': 'no-store',
        },
      }
    )
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: 'Erreur interne du serveur lors de la récupération des statistiques de suivi.',
        code: 'INTERNAL_ERROR',
      },
      { status: 500 }
    )
  }
}
