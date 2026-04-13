import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, requireAdmin } from '@/lib/mova/auth-middleware'
import db from '@/lib/db'
import { z } from 'zod/v4'

// Types d'incidents autorises
const INCIDENT_TYPES = ['accident', 'harassment', 'theft', 'fraud', 'safety_violation', 'vehicle_damage', 'dispute', 'other'] as const
const SEVERITY_LEVELS = ['low', 'medium', 'high', 'critical'] as const

// Schema de validation pour la creation d'un incident
const createIncidentSchema = z.object({
  type: z.enum(INCIDENT_TYPES, { message: 'Type d\'incident invalide' }),
  severity: z.enum(SEVERITY_LEVELS, { message: 'Niveau de severite invalide' }),
  description: z.string().min(10, 'La description doit contenir au moins 10 caracteres').max(2000),
  rideId: z.string().optional(),
  deliveryId: z.string().optional(),
  relatedUserId: z.string().optional(),
})

// GET /api/mova/incidents - Lister les incidents (admin uniquement)
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdmin(request)
    if (auth instanceof NextResponse) return auth

    const { searchParams } = new URL(request.url)
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') ?? '20', 10)))
    const skip = (page - 1) * limit
    const status = searchParams.get('status')
    const severity = searchParams.get('severity')
    const type = searchParams.get('type')

    const where: Record<string, unknown> = {}

    if (status) {
      const statuses = status.split(',').map(s => s.trim()).filter(Boolean)
      if (statuses.length === 1) {
        where.status = statuses[0]
      } else if (statuses.length > 1) {
        where.status = { in: statuses }
      }
    }
    if (severity) {
      const severities = severity.split(',').map(s => s.trim()).filter(Boolean)
      if (severities.length === 1) {
        where.severity = severities[0]
      } else if (severities.length > 1) {
        where.severity = { in: severities }
      }
    }
    if (type) {
      const types = type.split(',').map(s => s.trim()).filter(Boolean)
      if (types.length === 1) {
        where.type = types[0]
      } else if (types.length > 1) {
        where.type = { in: types }
      }
    }

    const [incidents, total] = await Promise.all([
      db.incident.findMany({
        where,
        include: {
          reporter: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
              avatar: true,
            },
          },
          relatedUser: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      db.incident.count({ where }),
    ])

    return NextResponse.json({
      success: true,
      data: {
        incidents,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    })
  } catch (error) {
    console.error('[INCIDENTS] Erreur lors de la recuperation:', error)
    return NextResponse.json(
      { success: false, error: 'Erreur interne du serveur' },
      { status: 500 }
    )
  }
}

// POST /api/mova/incidents - Creer un incident
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (auth instanceof NextResponse) return auth

    const body = await request.json()
    const parsed = createIncidentSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues[0].message },
        { status: 400 }
      )
    }

    const data = parsed.data

    const incident = await db.incident.create({
      data: {
        reporterId: auth.id,
        type: data.type,
        severity: data.severity,
        description: data.description,
        rideId: data.rideId ?? null,
        deliveryId: data.deliveryId ?? null,
        relatedUserId: data.relatedUserId ?? null,
        status: 'reported',
      },
      include: {
        reporter: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          },
        },
        relatedUser: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          },
        },
      },
    })

    return NextResponse.json(
      {
        success: true,
        data: {
          message: 'Incident signale avec succes',
          incident,
        },
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('[INCIDENTS] Erreur lors de la creation:', error)
    return NextResponse.json(
      { success: false, error: 'Erreur interne du serveur' },
      { status: 500 }
    )
  }
}
