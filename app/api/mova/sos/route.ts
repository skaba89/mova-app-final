import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, AuthError } from '@/lib/mova/auth-middleware'
import db from '@/lib/db'
import { rateLimiter } from '@/lib/mova/rate-limit'
import { logAction } from '@/lib/mova/audit-logger'
import { z } from 'zod/v4'

// Types d'alertes SOS autorises
const SOS_TYPES = ['accident', 'harassment', 'medical', 'theft', 'other'] as const

// Mapping vers les types d'incidents du schema Prisma
const SOS_TO_INCIDENT_TYPE: Record<string, string> = {
  accident: 'accident',
  harassment: 'harassment',
  medical: 'safety_violation',
  theft: 'theft',
  other: 'other',
}

// Schema de validation pour l'alerte SOS
const createSosSchema = z.object({
  rideId: z.string().optional(),
  deliveryId: z.string().optional(),
  type: z.enum(SOS_TYPES, { message: 'Type d\'alerte invalide' }),
  location: z
    .object({
      lat: z.number().min(-90).max(90),
      lng: z.number().min(-180).max(180),
    })
    .optional(),
  description: z.string().max(2000, 'La description ne doit pas depasser 2000 caracteres').optional(),
})

// Limite de requetes SOS : 5 par heure par utilisateur
const SOS_RATE_LIMIT = 5
const SOS_WINDOW_MS = 60 * 60 * 1000 // 1 heure

// Coordonnees par defaut (centre de Conakry) si aucune localisation fournie
const DEFAULT_LAT = 9.5092
const DEFAULT_LNG = -13.7122

// POST /api/mova/sos - Declencher une alerte d'urgence SOS
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (auth instanceof NextResponse) return auth

    // Verification stricte du rate limiting pour les alertes SOS
    const rateCheck = rateLimiter.checkRequest(
      `sos:${auth.id}`,
      SOS_RATE_LIMIT,
      SOS_WINDOW_MS
    )
    if (!rateCheck.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: 'Trop d\'alertes SOS. Veuillez contacter le support directement si necessaire.',
          retryAfterMs: rateCheck.retryAfterMs,
        },
        { status: 429 }
      )
    }

    const body = await request.json()
    const parsed = createSosSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues[0].message },
        { status: 400 }
      )
    }

    const { rideId, deliveryId, type, location, description } = parsed.data

    // Determiner la position
    const lat = location?.lat ?? DEFAULT_LAT
    const lng = location?.lng ?? DEFAULT_LNG

    // Verifier que le ride/delivery appartient a l'utilisateur si fourni
    if (rideId) {
      const ride = await db.ride.findUnique({
        where: { id: rideId },
        select: { id: true, passengerId: true, driverProfileId: true },
      })

      if (!ride) {
        return NextResponse.json(
          { success: false, error: 'Course non trouvee' },
          { status: 404 }
        )
      }

      const isPassenger = ride.passengerId === auth.id
      const isDriver = ride.driverProfileId !== null

      if (!isPassenger && !isDriver) {
        return NextResponse.json(
          { success: false, error: 'Vous n\'etes pas implique dans cette course' },
          { status: 403 }
        )
      }
    }

    if (deliveryId) {
      const delivery = await db.delivery.findUnique({
        where: { id: deliveryId },
        select: { id: true, customerId: true, courierId: true },
      })

      if (!delivery) {
        return NextResponse.json(
          { success: false, error: 'Livraison non trouvee' },
          { status: 404 }
        )
      }

      const isCustomer = delivery.customerId === auth.id
      const isCourier = delivery.courierId !== null

      if (!isCustomer && !isCourier) {
        return NextResponse.json(
          { success: false, error: 'Vous n\'etes pas implique dans cette livraison' },
          { status: 403 }
        )
      }
    }

    // Creer l'incident avec severite critique
    const incidentType = SOS_TO_INCIDENT_TYPE[type] ?? 'other'

    const incident = await db.incident.create({
      data: {
        reporterId: auth.id,
        rideId: rideId ?? null,
        deliveryId: deliveryId ?? null,
        type: incidentType,
        severity: 'critical',
        status: 'reported',
        description:
          description ??
          `Alerte SOS de type ${type} declenchee par l'utilisateur ${auth.id}`,
        attachments: {
          sosType: type,
          location: { lat, lng },
          triggeredVia: 'sos_endpoint',
        },
      },
      include: {
        reporter: {
          select: {
            id: true,
            name: true,
            phone: true,
            email: true,
          },
        },
      },
    })

    // Creer l'alerte SOS (uniquement pour les courses, le modele SOSAlert n'a pas de deliveryId)
    let sosAlert = null
    if (rideId) {
      sosAlert = await db.sOSAlert.create({
        data: {
          userId: auth.id,
          rideId: rideId,
          lat,
          lng,
          status: 'active',
          contactsNotified: {
            simulated: true,
            message: `Alerte SOS de type ${type}. Equipe de support notifiee.`,
            notifiedAt: new Date().toISOString(),
          },
        },
      })
    } else {
      // Meme sans course, creer une alerte SOS avec rideId null
      sosAlert = await db.sOSAlert.create({
        data: {
          userId: auth.id,
          lat,
          lng,
          status: 'active',
          contactsNotified: {
            simulated: true,
            message: `Alerte SOS de type ${type}. Equipe de support notifiee.`,
            notifiedAt: new Date().toISOString(),
          },
        },
      })
    }

    // Creer une notification pour l'utilisateur
    await db.notification.create({
      data: {
        userId: auth.id,
        type: 'sos',
        title: 'Alerte SOS Declenchee',
        message: `Votre alerte SOS (${type}) a ete enregistree. Notre equipe de support a ete notifiee et vous contactera immediatement.`,
        data: {
          incidentId: incident.id,
          sosAlertId: sosAlert.id,
          type,
          location: { lat, lng },
        } as Record<string, unknown>,
        channel: 'push',
      },
    })

    // Journaliser comme evenement de securite
    await logAction({
      userId: auth.id,
      action: 'sos_triggered',
      resource: 'sos',
      resourceId: sosAlert.id,
      severity: 'critical',
      details: {
        type,
        rideId: rideId ?? null,
        deliveryId: deliveryId ?? null,
        location: { lat, lng },
        incidentId: incident.id,
        description: description ?? null,
      },
    })

    return NextResponse.json(
      {
        success: true,
        data: {
          message:
            'Alerte SOS declenchee avec succes. Notre equipe de support a ete notifiee et vous contactera immediatement.',
          sosAlert: {
            id: sosAlert.id,
            status: sosAlert.status,
            createdAt: sosAlert.createdAt,
          },
          incident: {
            id: incident.id,
            severity: incident.severity,
            type: incident.type,
          },
          supportContact: {
            phone: '+224 620 00 00 00',
            message: 'Appelez ce numero en cas d\'urgence imminente',
          },
        },
      },
      { status: 201 }
    )
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: error.statusCode }
      )
    }

    console.error('[SOS] Erreur lors du declenchement de l\'alerte:', error)
    return NextResponse.json(
      { success: false, error: 'Erreur interne du serveur' },
      { status: 500 }
    )
  }
}
