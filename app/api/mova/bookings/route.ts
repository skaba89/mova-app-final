import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/mova/auth-middleware'
import db from '@/lib/db'
import { z } from 'zod/v4'
import { getDistance, getFare } from '@/lib/mova/zone-distances'

// Schema de validation pour la creation d'une reservation
const createBookingSchema = z.object({
  vehicleType: z.enum(['standard', 'premium', 'van', 'moto', 'bicycle', 'camion', 'pickup']),
  pickupAddress: z.string().min(1, "L'adresse de depart est requise"),
  pickupLat: z.number(),
  pickupLng: z.number(),
  pickupZone: z.string().min(1, 'La zone de depart est requise'),
  dropoffAddress: z.string().min(1, "L'adresse de destination est requise"),
  dropoffLat: z.number(),
  dropoffLng: z.number(),
  dropoffZone: z.string().min(1, 'La zone de destination est requise'),
  scheduledAt: z.string().min(1, "La date de reservation est requise"),
  passengerCount: z.number().int().min(1).max(8).optional().default(1),
  notes: z.string().max(500).optional(),
})

// Utilitaire de conversion Decimal vers Number
function num(value: unknown): number | null {
  if (value === null || value === undefined) return null
  return Number(value)
}

// GET /api/mova/bookings - Lister les reservations de l'utilisateur
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (auth instanceof NextResponse) return auth

    const { searchParams } = new URL(request.url)
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') ?? '20', 10)))
    const skip = (page - 1) * limit
    const status = searchParams.get('status')

    const where: Record<string, unknown> = { userId: auth.id }
    if (status) {
      where.status = status
    }

    const [bookings, total] = await Promise.all([
      db.booking.findMany({
        where,
        orderBy: { scheduledAt: 'asc' },
        skip,
        take: limit,
      }),
      db.booking.count({ where }),
    ])

    const convertedBookings = bookings.map((b) => ({
      ...b,
      estimatedFare: num(b.estimatedFare),
      pickupLat: num(b.pickupLat),
      pickupLng: num(b.pickupLng),
      dropoffLat: num(b.dropoffLat),
      dropoffLng: num(b.dropoffLng),
    }))

    return NextResponse.json({
      success: true,
      data: {
        bookings: convertedBookings,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    })
  } catch (error) {
    console.error('[BOOKINGS] Erreur lors de la recuperation:', error)
    return NextResponse.json(
      { success: false, error: 'Erreur interne du serveur' },
      { status: 500 }
    )
  }
}

// POST /api/mova/bookings - Creer une reservation programmee
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (auth instanceof NextResponse) return auth

    const body = await request.json()
    const parsed = createBookingSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues[0].message },
        { status: 400 }
      )
    }

    const data = parsed.data

    // Verifier que la date de reservation est dans le futur
    const scheduledDate = new Date(data.scheduledAt)
    if (scheduledDate <= new Date()) {
      return NextResponse.json(
        { success: false, error: 'La date de reservation doit etre dans le futur' },
        { status: 400 }
      )
    }

    // Calculer le tarif estime
    const estimatedFare = getFare(data.pickupZone, data.dropoffZone, data.vehicleType)
    const distance = getDistance(data.pickupZone, data.dropoffZone)

    const booking = await db.booking.create({
      data: {
        userId: auth.id,
        vehicleType: data.vehicleType,
        pickupAddress: data.pickupAddress,
        pickupLat: data.pickupLat,
        pickupLng: data.pickupLng,
        pickupZone: data.pickupZone,
        dropoffAddress: data.dropoffAddress,
        dropoffLat: data.dropoffLat,
        dropoffLng: data.dropoffLng,
        dropoffZone: data.dropoffZone,
        scheduledAt: scheduledDate,
        estimatedFare,
        passengerCount: data.passengerCount,
        notes: data.notes ?? null,
        status: 'pending',
      },
    })

    const convertedBooking = {
      ...booking,
      estimatedFare: num(booking.estimatedFare),
      pickupLat: num(booking.pickupLat),
      pickupLng: num(booking.pickupLng),
      dropoffLat: num(booking.dropoffLat),
      dropoffLng: num(booking.dropoffLng),
    }

    return NextResponse.json(
      { success: true, data: { booking: convertedBooking } },
      { status: 201 }
    )
  } catch (error) {
    console.error('[BOOKINGS] Erreur lors de la creation:', error)
    return NextResponse.json(
      { success: false, error: 'Erreur interne du serveur' },
      { status: 500 }
    )
  }
}
