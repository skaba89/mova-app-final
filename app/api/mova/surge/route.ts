import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, requireAdmin, AuthError } from '@/lib/mova/auth-middleware'
import { logAction } from '@/lib/mova/audit-logger'
import { z } from 'zod/v4'

// ============================================================
// Stockage en memoire pour la configuration de surge pricing
// Structure: Map<zone, { multiplier, reason, updatedAt, updatedBy }>
// ============================================================
interface SurgeConfig {
  multiplier: number
  reason: string
  updatedAt: string
  updatedBy: string
}

const surgeStore = new Map<string, SurgeConfig>()

// Schema de validation pour la mise a jour du surge
const updateSurgeSchema = z.object({
  zone: z.string().min(1, 'La zone est requise'),
  multiplier: z.number().min(1.0, 'Le multiplicateur minimum est 1.0x').max(3.0, 'Le multiplicateur maximum est 3.0x'),
  reason: z.string().min(1, 'La raison est requise').max(500, 'La raison ne doit pas depasser 500 caracteres'),
})

// Zones de Conakry avec multiplicateurs par defaut
const DEFAULT_ZONES = [
  'Dixinn',
  'Kaloum',
  'Matam',
  'Matoto',
  'Ratoma',
]

// GET /api/mova/surge?zone=xxx - Obtenir le multiplicateur de surge pour une zone
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (auth instanceof NextResponse) return auth

    const { searchParams } = new URL(request.url)
    const zone = searchParams.get('zone')

    if (zone) {
      // Retourner le surge pour une zone specifique
      const config = surgeStore.get(zone)
      const multiplier = config?.multiplier ?? 1.0

      return NextResponse.json({
        success: true,
        data: {
          zone,
          multiplier,
          isActive: multiplier > 1.0,
          reason: config?.reason ?? null,
          updatedAt: config?.updatedAt ?? null,
        },
      })
    }

    // Retourner le surge pour toutes les zones
    const allZones = DEFAULT_ZONES.map((z) => {
      const config = surgeStore.get(z)
      return {
        zone: z,
        multiplier: config?.multiplier ?? 1.0,
        isActive: (config?.multiplier ?? 1.0) > 1.0,
        reason: config?.reason ?? null,
        updatedAt: config?.updatedAt ?? null,
      }
    })

    // Ajouter les zones custom qui ne sont pas dans DEFAULT_ZONES
    for (const [zoneName, config] of surgeStore.entries()) {
      if (!DEFAULT_ZONES.includes(zoneName)) {
        allZones.push({
          zone: zoneName,
          multiplier: config.multiplier,
          isActive: config.multiplier > 1.0,
          reason: config.reason,
          updatedAt: config.updatedAt,
        })
      }
    }

    const activeSurgeCount = allZones.filter((z) => z.isActive).length

    return NextResponse.json({
      success: true,
      data: {
        zones: allZones,
        activeSurgeCount,
      },
    })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: error.statusCode }
      )
    }

    console.error('[SURGE] Erreur lors de la recuperation:', error)
    return NextResponse.json(
      { success: false, error: 'Erreur interne du serveur' },
      { status: 500 }
    )
  }
}

// POST /api/mova/surge (admin uniquement) - Mettre a jour le multiplicateur de surge
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdmin(request)
    if (auth instanceof NextResponse) return auth

    const body = await request.json()
    const parsed = updateSurgeSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues[0].message },
        { status: 400 }
      )
    }

    const { zone, multiplier, reason } = parsed.data
    const now = new Date().toISOString()

    const previousConfig = surgeStore.get(zone)
    const previousMultiplier = previousConfig?.multiplier ?? 1.0

    // Mettre a jour le store
    surgeStore.set(zone, {
      multiplier,
      reason,
      updatedAt: now,
      updatedBy: auth.id,
    })

    // Journaliser le changement
    await logAction({
      userId: auth.id,
      action: 'surge_updated',
      resource: 'surge',
      resourceId: zone,
      severity: multiplier >= 2.0 ? 'warning' : 'info',
      details: {
        zone,
        multiplier,
        reason,
        previousMultiplier,
      },
    })

    return NextResponse.json({
      success: true,
      data: {
        message: `Multiplicateur de surge mis a jour pour ${zone}`,
        zone,
        multiplier,
        previousMultiplier,
        reason,
        updatedAt: now,
      },
    })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: error.statusCode }
      )
    }

    console.error('[SURGE] Erreur lors de la mise a jour:', error)
    return NextResponse.json(
      { success: false, error: 'Erreur interne du serveur' },
      { status: 500 }
    )
  }
}
