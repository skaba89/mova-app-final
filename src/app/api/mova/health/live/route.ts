/**
 * ═══════════════════════════════════════════════════════════════════════════
 * MOVA — Endpoint de vivacité (Liveness Probe)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * GET /api/mova/health/live → Vérification minimale de vivacité
 *
 * Utilisé par Kubernetes et les orchestrateurs pour déterminer si le
 * processus est en vie et capable de répondre aux requêtes.
 * Ne vérifie PAS les dépendances externes — uniquement le process Node.js.
 */

import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

export async function GET() {
  return NextResponse.json({
    success: true,
    data: {
      status: 'alive',
      timestamp: new Date().toISOString(),
      pid: process.pid,
      uptime: Math.floor(process.uptime()),
    },
  })
}
