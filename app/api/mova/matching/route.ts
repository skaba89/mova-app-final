import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, AuthError } from '@/lib/mova/auth-middleware'
import db from '@/lib/db'
import { rateLimiter } from '@/lib/mova/rate-limit'
import { logAction } from '@/lib/mova/audit-logger'
import { z } from 'zod/v4'

// Schema de validation pour la demande de correspondance
const matchingRequestSchema = z.object({
  rideId: z.string().optional(),
  deliveryId: z.string().optional(),
})

// Limite de requetes : 10 demandes de matching par minute
const MATCHING_RATE_LIMIT = 10
const MATCHING_WINDOW_MS = 60 * 1000 // 1 minute

/** Calcule un ETA simule en minutes entre deux coordonnees */
function simulateETA(driverLat: number | null, driverLng: number | null, pickupLat: number, pickupLng: number): number {
  if (driverLat === null || driverLng === null) {
    // Si le chauffeur n'a pas de position, retourner un ETA aleatoire entre 5 et 15 min
    return Math.floor(Math.random() * 10) + 5
  }

  // Distance approximative en km (formule de Haversine simplifiee)
  const R = 6371 // Rayon de la Terre en km
  const dLat = ((pickupLat - driverLat) * Math.PI) / 180
  const dLng = ((pickupLng - driverLng) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((driverLat * Math.PI) / 180) *
      Math.cos((pickupLat * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  const distanceKm = R * c

  // Vitesse moyenne en ville a Conakry : ~20 km/h
  const speedKmPerMin = 20 / 60
  const etaMinutes = Math.ceil(distanceKm / speedKmPerMin)

  // Arrondir et ajouter une marge de 1-3 minutes pour le trafic
  return Math.max(2, etaMinutes + Math.floor(Math.random() * 3) + 1)
}

// POST /api/mova/matching - Demander la correspondance chauffeur pour une course ou livraison
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (auth instanceof NextResponse) return auth

    // Verification du rate limiting
    const rateCheck = rateLimiter.checkRequest(
      `matching:${auth.id}`,
      MATCHING_RATE_LIMIT,
      MATCHING_WINDOW_MS
    )
    if (!rateCheck.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: 'Trop de demandes de correspondance. Veuillez patienter.',
          retryAfterMs: rateCheck.retryAfterMs,
        },
        { status: 429 }
      )
    }

    const body = await request.json()
    const parsed = matchingRequestSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues[0].message },
        { status: 400 }
      )
    }

    const { rideId, deliveryId } = parsed.data

    if (!rideId && !deliveryId) {
      return NextResponse.json(
        { success: false, error: 'Vous devez fournir un rideId ou un deliveryId' },
        { status: 400 }
      )
    }

    let pickupLat = 0
    let pickupLng = 0
    let pickupZone: string | null = null
    let matchedItemType: string | null = null

    // Verifier la course ou la livraison
    if (rideId) {
      const ride = await db.ride.findUnique({
        where: { id: rideId },
        select: {
          id: true,
          passengerId: true,
          status: true,
          pickupLat: true,
          pickupLng: true,
          pickupZone: true,
          driverProfileId: true,
        },
      })

      if (!ride) {
        return NextResponse.json(
          { success: false, error: 'Course non trouvee' },
          { status: 404 }
        )
      }

      if (ride.passengerId !== auth.id) {
        return NextResponse.json(
          { success: false, error: 'Vous n\'etes pas le passager de cette course' },
          { status: 403 }
        )
      }

      if (ride.driverProfileId) {
        return NextResponse.json(
          { success: false, error: 'Un chauffeur est deja assigne a cette course' },
          { status: 400 }
        )
      }

      if (ride.status !== 'requested') {
        return NextResponse.json(
          { success: false, error: `La course ne peut pas etre mise en correspondance (statut: ${ride.status})` },
          { status: 400 }
        )
      }

      pickupLat = Number(ride.pickupLat)
      pickupLng = Number(ride.pickupLng)
      pickupZone = ride.pickupZone
      matchedItemType = 'ride'
    } else if (deliveryId) {
      const delivery = await db.delivery.findUnique({
        where: { id: deliveryId },
        select: {
          id: true,
          customerId: true,
          status: true,
          pickupLat: true,
          pickupLng: true,
          pickupZone: true,
          courierId: true,
        },
      })

      if (!delivery) {
        return NextResponse.json(
          { success: false, error: 'Livraison non trouvee' },
          { status: 404 }
        )
      }

      if (delivery.customerId !== auth.id) {
        return NextResponse.json(
          { success: false, error: 'Vous n\'etes pas l\'expediteur de cette livraison' },
          { status: 403 }
        )
      }

      if (delivery.courierId) {
        return NextResponse.json(
          { success: false, error: 'Un coursier est deja assigne a cette livraison' },
          { status: 400 }
        )
      }

      if (delivery.status !== 'pending') {
        return NextResponse.json(
          { success: false, error: `La livraison ne peut pas etre mise en correspondance (statut: ${delivery.status})` },
          { status: 400 }
        )
      }

      pickupLat = Number(delivery.pickupLat)
      pickupLng = Number(delivery.pickupLng)
      pickupZone = delivery.pickupZone
      matchedItemType = 'delivery'
    }

    // Rechercher les chauffeurs disponibles
    const driversWhere: Record<string, unknown> = {
      isActive: true,
      isOnline: true,
      user: {
        status: 'active',
      },
    }

    // Filtrer par zone si disponible (SQLite : pas de mode: 'insensitive')
    if (pickupZone) {
      driversWhere.zone = pickupZone
    }

    const availableDrivers = await db.driverProfile.findMany({
      where: driversWhere,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            phone: true,
            avatar: true,
            rating: true,
          },
        },
        vehicles: {
          where: { isActive: true },
          take: 1,
          select: {
            type: true,
            brand: true,
            model: true,
            color: true,
            plateNumber: true,
          },
        },
      },
      take: 20,
    })

    if (availableDrivers.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          message: 'Aucun chauffeur disponible dans votre zone pour le moment',
          candidates: [],
          totalAvailable: 0,
          searchZone: pickupZone,
        },
      })
    }

    // Calculer l'ETA pour chaque chauffeur et trier
    const candidatesWithETA = availableDrivers.map((driver) => ({
      driverId: driver.id,
      userId: driver.user.id,
      name: driver.user.name,
      phone: driver.user.phone,
      avatar: driver.user.avatar,
      rating: Number(driver.user.rating),
      vehicle: driver.vehicles[0] ?? null,
      etaMinutes: simulateETA(
        driver.currentLocationLat,
        driver.currentLocationLng,
        pickupLat,
        pickupLng
      ),
      zone: driver.zone,
      totalTrips: driver.totalTrips,
    }))

    // Trier par ETA croissant et prendre les 3 meilleurs
    candidatesWithETA.sort((a, b) => a.etaMinutes - b.etaMinutes)
    const topCandidates = candidatesWithETA.slice(0, 3)

    // Journaliser la demande de correspondance
    await logAction({
      userId: auth.id,
      action: 'matching_requested',
      resource: matchedItemType ?? 'unknown',
      resourceId: rideId ?? deliveryId ?? undefined,
      details: {
        type: matchedItemType,
        pickupZone,
        candidatesFound: availableDrivers.length,
        topCandidateETA: topCandidates[0]?.etaMinutes,
      },
    })

    return NextResponse.json({
      success: true,
      data: {
        message: `${topCandidates.length} chauffeur(s) trouve(s) pres de vous`,
        candidates: topCandidates,
        totalAvailable: availableDrivers.length,
        searchZone: pickupZone,
      },
    })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: error.statusCode }
      )
    }

    console.error('[MATCHING] Erreur lors de la correspondance:', error)
    return NextResponse.json(
      { success: false, error: 'Erreur interne du serveur' },
      { status: 500 }
    )
  }
}
