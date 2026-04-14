import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth, AuthError } from '@/lib/mova/auth-middleware';
import { estimateFare } from '@/lib/mova/zone-distances';
import { rateLimiter } from '@/lib/mova/rate-limit';
import { logAction } from '@/lib/mova/audit-logger';
import { z } from 'zod/v4';

const createRideSchema = z.object({
  pickupAddress: z.string().min(1, 'L\'adresse de depart est requise'),
  pickupLat: z.number(),
  pickupLng: z.number(),
  pickupZone: z.string().min(1, 'La zone de depart est requise'),
  dropoffAddress: z.string().min(1, 'L\'adresse d\'arrivee est requise'),
  dropoffLat: z.number(),
  dropoffLng: z.number(),
  dropoffZone: z.string().min(1, 'La zone d\'arrivee est requise'),
  paymentMethod: z.enum(['wallet', 'cash', 'orange_money', 'card', 'mtn_momo', 'wave']),
  vehicleType: z.enum(['moto', 'standard', 'van', 'premium']).optional().default('standard'),
  passengerNote: z.string().max(500).optional(),
  scheduledAt: z.string().optional(),
});

/** Convertit les champs Decimal de Prisma en nombre */
function convertRideDecimals(ride: Record<string, unknown>): Record<string, unknown> {
  const converted = { ...ride };
  const decimalFields = [
    'estimatedFare',
    'actualFare',
    'pickupLat',
    'pickupLng',
    'dropoffLat',
    'dropoffLng',
    'rating',
    'passengerRating',
  ];
  for (const field of decimalFields) {
    if (converted[field] !== null && converted[field] !== undefined) {
      (converted as Record<string, unknown>)[field] = Number(converted[field]);
    }
  }
  return converted;
}

/** Genere un code OTP a 4 chiffres */
function generateOTP(): string {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

// GET /api/mova/rides
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;
    const { searchParams } = new URL(request.url);

    const status = searchParams.get('status');
    const userId = searchParams.get('userId');
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') ?? '20', 10)));
    const skip = (page - 1) * limit;

    // Seuls les admins peuvent voir les courses d'autres utilisateurs
    const filterUserId = userId && auth.role === 'admin' ? userId : auth.id;

    const where: Record<string, unknown> = { passengerId: filterUserId };
    if (status) {
      const statuses = status.split(',').map(s => s.trim()).filter(Boolean);
      if (statuses.length === 1) {
        where.status = statuses[0];
      } else if (statuses.length > 1) {
        where.status = { in: statuses };
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
                },
              },
              rating: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      db.ride.count({ where }),
    ]);

    const convertedRides = rides.map((ride) => convertRideDecimals(ride as unknown as Record<string, unknown>));

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
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: error.statusCode }
      );
    }

    console.error('[RIDES] Erreur interne:', error);
    return NextResponse.json(
      { success: false, error: 'Erreur interne du serveur' },
      { status: 500 }
    );
  }
}

// POST /api/mova/rides
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;
    const body = await request.json();

    const parsed = createRideSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }

    const data = parsed.data;

    // Verification de l'existence du portefeuille si paiement par wallet
    if (data.paymentMethod === 'wallet') {
      const wallet = await db.wallet.findUnique({
        where: { userId: auth.id },
      });
      if (!wallet) {
        return NextResponse.json(
          { success: false, error: 'Portefeuille non trouve. Veuillez creer un portefeuille.' },
          { status: 400 }
        );
      }
    }

    // Estimation du tarif
    const fareEstimate = estimateFare(data.pickupZone, data.dropoffZone, data.vehicleType);

    // Generation de l'OTP
    const otp = generateOTP();

    // Creation de la course
    const ride = await db.ride.create({
      data: {
        passengerId: auth.id,
        pickupAddress: data.pickupAddress,
        pickupLat: data.pickupLat,
        pickupLng: data.pickupLng,
        pickupZone: data.pickupZone,
        dropoffAddress: data.dropoffAddress,
        dropoffLat: data.dropoffLat,
        dropoffLng: data.dropoffLng,
        dropoffZone: data.dropoffZone,
        paymentMethod: data.paymentMethod,
        passengerNote: data.passengerNote ?? null,
        scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : null,
        status: 'requested',
        estimatedFare: fareEstimate.fareAmount,
        estimatedDistance: fareEstimate.distanceKm,
        estimatedDuration: fareEstimate.durationMinutes,
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
            rating: true,
          },
        },
      },
    });

    const convertedRide = convertRideDecimals(ride as unknown as Record<string, unknown>);

    await logAction({ userId: auth.id, action: 'ride_created', resource: 'ride', resourceId: ride.id, details: { pickup: data.pickupZone, dropoff: data.dropoffZone, vehicleType: data.vehicleType, paymentMethod: data.paymentMethod } });

    return NextResponse.json(
      { success: true, data: { ride: convertedRide } },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: error.statusCode }
      );
    }

    console.error('[RIDES] Erreur interne:', error);
    return NextResponse.json(
      { success: false, error: 'Erreur interne du serveur' },
      { status: 500 }
    );
  }
}
