import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth, AuthError } from '@/lib/mova/auth-middleware';
import { z } from 'zod/v4';

const updateRideSchema = z.object({
  status: z.enum([
    'accepted',
    'arrived',
    'in_progress',
    'completed',
    'cancelled',
    'passenger_cancelled',
  ]).optional(),
  driverNote: z.string().max(500).optional(),
  passengerNote: z.string().max(500).optional(),
  otp: z.string().length(4).optional(),
});

/** Convertit les champs Decimal de Prisma en nombre */
function convertRideDecimals(ride: Record<string, unknown>): Record<string, unknown> {
  const converted = { ...ride };
  const decimalFields = [
    'estimatedFare',
    'finalFare',
    'pickupLat',
    'pickupLng',
    'dropoffLat',
    'dropoffLng',
    'driverRating',
    'passengerRating',
  ];
  for (const field of decimalFields) {
    if (converted[field] !== null && converted[field] !== undefined) {
      (converted as Record<string, unknown>)[field] = Number(converted[field]);
    }
  }
  return converted;
}

// GET /api/mova/rides/[id]
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(request);
    const { id } = await params;

    const ride = await db.ride.findUnique({
      where: { id },
      include: {
        passenger: {
          select: {
            id: true,
            name: true,
            phone: true,
          },
        },
        driver: {
          select: {
            id: true,
            name: true,
            phone: true,
            rating: true,
            vehicle: {
              select: {
                plateNumber: true,
                vehicleType: true,
                color: true,
                brand: true,
                model: true,
              },
            },
          },
        },
        payment: true,
      },
    });

    if (!ride) {
      return NextResponse.json(
        { success: false, error: 'Course non trouvee' },
        { status: 404 }
      );
    }

    // Verification des droits : passager, chauffeur ou admin
    const isPassenger = ride.passengerId === auth.user.id;
    const isDriver = ride.driverId === auth.user.id;
    const isAdmin = auth.user.role === 'admin';

    if (!isPassenger && !isDriver && !isAdmin) {
      return NextResponse.json(
        { success: false, error: 'Acces refuse a cette course' },
        { status: 403 }
      );
    }

    const converted = convertRideDecimals(ride as unknown as Record<string, unknown>);

    return NextResponse.json({
      success: true,
      data: { ride: converted },
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: error.statusCode }
      );
    }

    console.error('[RIDE] Erreur interne:', error);
    return NextResponse.json(
      { success: false, error: 'Erreur interne du serveur' },
      { status: 500 }
    );
  }
}

// PATCH /api/mova/rides/[id]
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(request);
    const { id } = await params;
    const body = await request.json();

    const parsed = updateRideSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }

    const data = parsed.data;

    // Recuperer la course actuelle
    const existingRide = await db.ride.findUnique({
      where: { id },
    });

    if (!existingRide) {
      return NextResponse.json(
        { success: false, error: 'Course non trouvee' },
        { status: 404 }
      );
    }

    // Verification des droits
    const isPassenger = existingRide.passengerId === auth.user.id;
    const isDriver = existingRide.driverId === auth.user.id;
    const isAdmin = auth.user.role === 'admin';

    if (!isPassenger && !isDriver && !isAdmin) {
      return NextResponse.json(
        { success: false, error: 'Acces refuse a cette course' },
        { status: 403 }
      );
    }

    const updateData: Record<string, unknown> = {};

    // Notes optionnelles (mises a jour sans changement de statut)
    if (data.driverNote !== undefined && isDriver) {
      updateData.driverNote = data.driverNote;
    }
    if (data.passengerNote !== undefined && isPassenger) {
      updateData.passengerNote = data.passengerNote;
    }

    // Transitions de statut
    if (data.status) {
      const newStatus = data.status;

      // accepte : attribution du chauffeur
      if (newStatus === 'accepted') {
        if (existingRide.status !== 'requested') {
          return NextResponse.json(
            { success: false, error: 'Cette course ne peut plus etre acceptee' },
            { status: 400 }
          );
        }
        updateData.driverId = auth.user.id;
        updateData.status = 'accepted';
        updateData.acceptedAt = new Date();
      }

      // arrive : le chauffeur est arrive au point de depart
      else if (newStatus === 'arrived') {
        if (existingRide.status !== 'accepted') {
          return NextResponse.json(
            { success: false, error: 'Le chauffeur doit d\'abord accepter la course' },
            { status: 400 }
          );
        }
        updateData.status = 'arrived';
        updateData.arrivedAt = new Date();
      }

      // en cours : debut de la course
      else if (newStatus === 'in_progress') {
        if (existingRide.status !== 'arrived') {
          return NextResponse.json(
            { success: false, error: 'Le chauffeur doit d\'abord arriver au point de depart' },
            { status: 400 }
          );
        }
        if (data.otp && data.otp !== existingRide.otp) {
          return NextResponse.json(
            { success: false, error: 'Code OTP invalide' },
            { status: 400 }
          );
        }
        updateData.status = 'in_progress';
        updateData.startedAt = new Date();
      }

      // terminee : fin de la course
      else if (newStatus === 'completed') {
        if (existingRide.status !== 'in_progress') {
          return NextResponse.json(
            { success: false, error: 'La course doit etre en cours pour etre terminee' },
            { status: 400 }
          );
        }
        updateData.status = 'completed';
        updateData.completedAt = new Date();

        // Creation du paiement si ce n'est pas deja fait
        const existingPayment = await db.payment.findUnique({
          where: { rideId: id },
        });

        if (!existingPayment) {
          const finalFare = existingRide.estimatedFare;
          await db.payment.create({
            data: {
              rideId: id,
              amount: finalFare,
              method: existingRide.paymentMethod,
              status: 'pending',
            },
          });
          updateData.finalFare = finalFare;
        }
      }

      // annulee par le chauffeur
      else if (newStatus === 'cancelled') {
        if (!['requested', 'accepted'].includes(existingRide.status)) {
          return NextResponse.json(
            { success: false, error: 'Cette course ne peut plus etre annulee' },
            { status: 400 }
          );
        }
        updateData.status = 'cancelled';
        updateData.cancelledAt = new Date();
      }

      // annulee par le passager
      else if (newStatus === 'passenger_cancelled') {
        if (!['requested', 'accepted', 'arrived'].includes(existingRide.status)) {
          return NextResponse.json(
            { success: false, error: 'Cette course ne peut plus etre annulee' },
            { status: 400 }
          );
        }
        updateData.status = 'passenger_cancelled';
        updateData.cancelledAt = new Date();
      }
    }

    // Mise a jour en base
    const updatedRide = await db.ride.update({
      where: { id },
      data: updateData,
      include: {
        passenger: {
          select: { id: true, name: true, phone: true },
        },
        driver: {
          select: {
            id: true,
            name: true,
            phone: true,
            rating: true,
            vehicle: true,
          },
        },
        payment: true,
      },
    });

    const converted = convertRideDecimals(updatedRide as unknown as Record<string, unknown>);

    return NextResponse.json({
      success: true,
      data: { ride: converted },
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: error.statusCode }
      );
    }

    console.error('[RIDE] Erreur interne:', error);
    return NextResponse.json(
      { success: false, error: 'Erreur interne du serveur' },
      { status: 500 }
    );
  }
}
