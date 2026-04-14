import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/mova/auth-middleware'
import db from '@/lib/db'
import { getDistance, getFare } from '@/lib/mova/zone-distances'
import { rateLimiter } from '@/lib/mova/rate-limit'
import { logAction } from '@/lib/mova/audit-logger'
import { z } from 'zod/v4'

// Schema de validation pour la creation d'une livraison
const createDeliverySchema = z.object({
  packageType: z.string().min(1, 'Le type de colis est requis'),
  pickupAddress: z.string().min(1, "L'adresse de depart est requise"),
  pickupLat: z.number(),
  pickupLng: z.number(),
  pickupZone: z.string().min(1, 'La zone de depart est requise'),
  dropoffAddress: z.string().min(1, "L'adresse de destination est requise"),
  dropoffLat: z.number(),
  dropoffLng: z.number(),
  dropoffZone: z.string().min(1, 'La zone de destination est requise'),
  recipientName: z.string().min(1, 'Le nom du destinataire est requis'),
  recipientPhone: z.string().min(1, 'Le telephone du destinataire est requis'),
  paymentMethod: z.enum(['cash', 'card', 'wallet', 'orange_money', 'mtn_momo', 'wave']),
  packageWeight: z.number().optional(),
  declaredValue: z.number().optional(),
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

// GET /api/mova/deliveries - Lister les livraisons de l'utilisateur
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (auth instanceof NextResponse) return auth

    const { searchParams } = new URL(request.url)
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') ?? '20', 10)))
    const skip = (page - 1) * limit
    const status = searchParams.get('status')

    const where: Record<string, unknown> = { customerId: auth.id }
    if (status) {
      const statuses = status.split(',').map(s => s.trim()).filter(Boolean)
      if (statuses.length === 1) {
        where.status = statuses[0]
      } else if (statuses.length > 1) {
        where.status = { in: statuses }
      }
    }

    const [deliveries, total] = await Promise.all([
      db.delivery.findMany({
        where,
        include: {
          courier: {
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
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      db.delivery.count({ where }),
    ])

    // Conversion des champs Decimal
    const convertedDeliveries = deliveries.map((d) => ({
      ...d,
      estimatedPrice: num(d.estimatedPrice),
      actualPrice: num(d.actualPrice),
      declaredValue: num(d.declaredValue),
      pickupLat: num(d.pickupLat),
      pickupLng: num(d.pickupLng),
      dropoffLat: num(d.dropoffLat),
      dropoffLng: num(d.dropoffLng),
      packageWeight: num(d.packageWeight),
    }))

    return NextResponse.json({
      success: true,
      data: {
        deliveries: convertedDeliveries,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    })
  } catch (error) {
    console.error('[DELIVERIES] Erreur lors de la recuperation:', error)
    return NextResponse.json(
      { success: false, error: 'Erreur interne du serveur' },
      { status: 500 }
    )
  }
}

// POST /api/mova/deliveries - Creer une livraison
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (auth instanceof NextResponse) return auth

    const body = await request.json()
    const parsed = createDeliverySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues[0].message },
        { status: 400 }
      )
    }

    const data = parsed.data

    // Calculer le prix estime a partir des zones
    const distance = getDistance(data.pickupZone, data.dropoffZone)
    const estimatedPrice = getFare(data.pickupZone, data.dropoffZone, 'livraison')

    // Generer l'OTP
    const otp = generateOTP()

    const delivery = await db.delivery.create({
      data: {
        customerId: auth.id,
        status: 'pending',
        packageType: data.packageType,
        packageWeight: data.packageWeight ?? null,
        declaredValue: data.declaredValue ?? null,
        pickupAddress: data.pickupAddress,
        pickupLat: data.pickupLat,
        pickupLng: data.pickupLng,
        pickupZone: data.pickupZone,
        dropoffAddress: data.dropoffAddress,
        dropoffLat: data.dropoffLat,
        dropoffLng: data.dropoffLng,
        dropoffZone: data.dropoffZone,
        estimatedPrice,
        estimatedDistance: distance,
        paymentMethod: data.paymentMethod,
        otp,
        recipientName: data.recipientName,
        recipientPhone: data.recipientPhone,
      },
      include: {
        courier: {
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
      },
    })

    const convertedDelivery = {
      ...delivery,
      estimatedPrice: num(delivery.estimatedPrice),
      actualPrice: num(delivery.actualPrice),
      declaredValue: num(delivery.declaredValue),
      pickupLat: num(delivery.pickupLat),
      pickupLng: num(delivery.pickupLng),
      dropoffLat: num(delivery.dropoffLat),
      dropoffLng: num(delivery.dropoffLng),
      packageWeight: num(delivery.packageWeight),
    }

    await logAction({ userId: auth.id, action: 'delivery_created', resource: 'delivery', resourceId: delivery.id, details: { pickup: data.pickupZone, dropoff: data.dropoffZone, packageType: data.packageType, paymentMethod: data.paymentMethod } })

    return NextResponse.json(
      { success: true, data: { delivery: convertedDelivery } },
      { status: 201 }
    )
  } catch (error) {
    console.error('[DELIVERIES] Erreur lors de la creation:', error)
    return NextResponse.json(
      { success: false, error: 'Erreur interne du serveur' },
      { status: 500 }
    )
  }
}
