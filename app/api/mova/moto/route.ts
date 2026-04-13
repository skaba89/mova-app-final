import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/mova/auth-middleware'
import db from '@/lib/db'
import { z } from 'zod/v4'
import { getDistance, getFare } from '@/lib/mova/zone-distances'

// Schema de validation pour la creation d'une course moto
const createMotoRideSchema = z.object({
  pickupAddress: z.string().min(1, "L'adresse de depart est requise"),
  pickupLat: z.number(),
  pickupLng: z.number(),
  pickupZone: z.string().min(1, 'La zone de depart est requise'),
  dropoffAddress: z.string().min(1, "L'adresse de destination est requise"),
  dropoffLat: z.number(),
  dropoffLng: z.number(),
  dropoffZone: z.string().min(1, 'La zone de destination est requise'),
  paymentMethod: z.enum(['cash', 'card', 'wallet', 'orange_money', 'mtn_momo', 'wave']),
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

// GET /api/mova/moto - Lister les courses moto de l'utilisateur
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (auth instanceof NextResponse) return auth

    const { searchParams } = new URL(request.url)
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') ?? '20', 10)))
    const skip = (page - 1) * limit
    const status = searchParams.get('status')

    const where: Record<string, unknown> = { passengerId: auth.id }
    if (status) {
      const statuses = status.split(',').map(s => s.trim()).filter(Boolean)
      if (statuses.length === 1) {
        where.status = statuses[0]
      } else if (statuses.length > 1) {
        where.status = { in: statuses }
      }
    }

    const [rides, total] = await Promise.all([
      db.ride.findMany({
        where,
        include: {
          driverProfile: {
            select: {
              id: true,
              user: {
                select: {
                  id: true,
                  name: true,
                  phone: true,
                  avatar: true,
                },
              },
              vehicleType: true,
            },
          },
          vehicle: {
            select: {
              id: true,
              brand: true,
              model: true,
              color: true,
              plateNumber: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      db.ride.count({ where }),
    ])

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
    console.error('[MOTO] Erreur lors de la recuperation:', error)
    return NextResponse.json(
      { success: false, error: 'Erreur interne du serveur' },
      { status: 500 }
    )
  }
}

// POST /api/mova/moto - Creer une course moto
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (auth instanceof NextResponse) return auth

    const body = await request.json()
    const parsed = createMotoRideSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues[0].message },
        { status: 400 }
      )
    }

    const data = parsed.data

    // Calculer le tarif estime pour moto
    const distance = getDistance(data.pickupZone, data.dropoffZone)
    const estimatedFare = getFare(data.pickupZone, data.dropoffZone, 'moto')
    const otp = generateOTP()

    const ride = await db.ride.create({
      data: {
        passengerId: auth.id,
        status: 'requested',
        pickupAddress: data.pickupAddress,
        pickupLat: data.pickupLat,
        pickupLng: data.pickupLng,
        pickupZone: data.pickupZone,
        dropoffAddress: data.dropoffAddress,
        dropoffLat: data.dropoffLat,
        dropoffLng: data.dropoffLng,
        dropoffZone: data.dropoffZone,
        estimatedFare,
        estimatedDistance: distance,
        paymentMethod: data.paymentMethod,
        otp,
      },
      include: {
        driverProfile: {
          select: {
            id: true,
            user: {
              select: {
                id: true,
                name: true,
                phone: true,
              },
            },
            vehicleType: true,
          },
        },
        vehicle: {
          select: {
            id: true,
            brand: true,
            model: true,
            color: true,
            plateNumber: true,
          },
        },
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
    console.error('[MOTO] Erreur lors de la creation:', error)
    return NextResponse.json(
      { success: false, error: 'Erreur interne du serveur' },
      { status: 500 }
    )
  }
}
