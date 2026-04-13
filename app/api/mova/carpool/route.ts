import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/mova/auth-middleware'
import db from '@/lib/db'
import { z } from 'zod/v4'
import { getDistance, getFare } from '@/lib/mova/zone-distances'

// Schema de validation pour la creation d'un trajet covoiturage
const createCarpoolSchema = z.object({
  pickupAddress: z.string().min(1, "L'adresse de depart est requise"),
  pickupLat: z.number(),
  pickupLng: z.number(),
  pickupZone: z.string().min(1, 'La zone de depart est requise'),
  dropoffAddress: z.string().min(1, "L'adresse de destination est requise"),
  dropoffLat: z.number(),
  dropoffLng: z.number(),
  dropoffZone: z.string().min(1, 'La zone de destination est requise'),
  seats: z.number().int().min(1).max(4).optional().default(1),
  departureTime: z.string().min(1, "L'heure de depart est requise"),
})

// Utilitaire de conversion Decimal vers Number
function num(value: unknown): number | null {
  if (value === null || value === undefined) return null
  return Number(value)
}

// Generer un code OTP a 4 chiffres
function generateOTP(): string {
  return Math.floor(1000 + Math.random() * 9000).toString()
}

// Generer une reference de paiement unique
function generatePaymentReference(): string {
  return `PAY-CARP-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`
}

// GET /api/mova/carpool - Lister les trajets de covoiturage disponibles
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (auth instanceof NextResponse) return auth

    const { searchParams } = new URL(request.url)
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') ?? '20', 10)))
    const skip = (page - 1) * limit

    // Recuperer les courses programmeees qui peuvent accueillir des passagers
    const now = new Date()
    const [rides, total] = await Promise.all([
      db.ride.findMany({
        where: {
          status: 'scheduled',
          scheduledAt: { gte: now },
        },
        include: {
          passenger: {
            select: {
              id: true,
              name: true,
              avatar: true,
              rating: true,
            },
          },
          vehicle: {
            select: {
              brand: true,
              model: true,
              color: true,
              plateNumber: true,
            },
          },
        },
        orderBy: { scheduledAt: 'asc' },
        skip,
        take: limit,
      }),
      db.ride.count({
        where: {
          status: 'scheduled',
          scheduledAt: { gte: now },
        },
      }),
    ])

    // Conversion des champs Decimal
    const convertedRides = rides.map((ride) => ({
      ...ride,
      estimatedFare: num(ride.estimatedFare),
      actualFare: num(ride.actualFare),
      pickupLat: num(ride.pickupLat),
      pickupLng: num(ride.pickupLng),
      dropoffLat: num(ride.dropoffLat),
      dropoffLng: num(ride.dropoffLng),
    }))

    return NextResponse.json({
      success: true,
      data: {
        rides: convertedRides,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    })
  } catch (error) {
    console.error('[CARPOOL] Erreur lors de la recuperation:', error)
    return NextResponse.json(
      { success: false, error: 'Erreur interne du serveur' },
      { status: 500 }
    )
  }
}

// POST /api/mova/carpool - Creer un trajet covoiturage
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (auth instanceof NextResponse) return auth

    const body = await request.json()
    const parsed = createCarpoolSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues[0].message },
        { status: 400 }
      )
    }

    const data = parsed.data

    // Verifier que l'heure de depart est dans le futur
    const departureDate = new Date(data.departureTime)
    if (departureDate <= new Date()) {
      return NextResponse.json(
        { success: false, error: "L'heure de depart doit etre dans le futur" },
        { status: 400 }
      )
    }

    // Calculer le tarif estime avec le type clando
    const estimatedFare = getFare(data.pickupZone, data.dropoffZone, 'clando')
    const otp = generateOTP()

    // Creer un trajet programmee avec les metadonnees covoiturage
    const ride = await db.ride.create({
      data: {
        passengerId: auth.id,
        status: 'scheduled',
        pickupAddress: data.pickupAddress,
        pickupLat: data.pickupLat,
        pickupLng: data.pickupLng,
        pickupZone: data.pickupZone,
        dropoffAddress: data.dropoffAddress,
        dropoffLat: data.dropoffLat,
        dropoffLng: data.dropoffLng,
        dropoffZone: data.dropoffZone,
        estimatedFare,
        paymentMethod: 'cash',
        scheduledAt: departureDate,
        otp,
      },
    })

    const convertedRide = {
      ...ride,
      estimatedFare: num(ride.estimatedFare),
      actualFare: num(ride.actualFare),
      pickupLat: num(ride.pickupLat),
      pickupLng: num(ride.pickupLng),
      dropoffLat: num(ride.dropoffLat),
      dropoffLng: num(ride.dropoffLng),
    }

    return NextResponse.json(
      { success: true, data: { ride: convertedRide } },
      { status: 201 }
    )
  } catch (error) {
    console.error('[CARPOOL] Erreur lors de la creation:', error)
    return NextResponse.json(
      { success: false, error: 'Erreur interne du serveur' },
      { status: 500 }
    )
  }
}
