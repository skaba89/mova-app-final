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
    'driver_cancelled',
    'no_show',
    'refunded',
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
    if (auth instanceof NextResponse) return auth;
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
    const isPassenger = ride.passengerId === auth.id;
    const isDriver = ride.driverId === auth.id;
    const isAdmin = auth.role === 'admin';

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
    if (auth instanceof NextResponse) return auth;
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
    const isPassenger = existingRide.passengerId === auth.id;
    const isDriver = existingRide.driverId === auth.id;
    const isAdmin = auth.role === 'admin';

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

    // Transitions de statut avec controle de role
    if (data.status) {
      const newStatus = data.status;

      // accepted : attribution du chauffeur (chauffeur uniquement)
      if (newStatus === 'accepted') {
        if (existingRide.status !== 'requested') {
          return NextResponse.json(
            { success: false, error: 'Cette course ne peut plus etre acceptee' },
            { status: 400 }
          );
        }
        if (!isDriver && !isAdmin) {
          return NextResponse.json(
            { success: false, error: 'Seul un chauffeur peut accepter une course' },
            { status: 403 }
          );
        }
        updateData.driverId = auth.id;
        updateData.status = 'accepted';
        updateData.acceptedAt = new Date();
      }

      // arrive : le chauffeur est arrive au point de depart (chauffeur uniquement)
      else if (newStatus === 'arrived') {
        if (existingRide.status !== 'accepted') {
          return NextResponse.json(
            { success: false, error: 'Le chauffeur doit d\'abord accepter la course' },
            { status: 400 }
          );
        }
        if (!isDriver && !isAdmin) {
          return NextResponse.json(
            { success: false, error: 'Seul le chauffeur peut signaler son arrivee' },
            { status: 403 }
          );
        }
        updateData.status = 'arrived';
        updateData.arrivedAt = new Date();
      }

      // en cours : debut de la course (chauffeur uniquement)
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
        if (!isDriver && !isAdmin) {
          return NextResponse.json(
            { success: false, error: 'Seul le chauffeur peut demarrer la course' },
            { status: 403 }
          );
        }
        updateData.status = 'in_progress';
        updateData.startedAt = new Date();
      }

      // terminee : fin de la course (chauffeur ou admin)
      else if (newStatus === 'completed') {
        if (existingRide.status !== 'in_progress') {
          return NextResponse.json(
            { success: false, error: 'La course doit etre en cours pour etre terminee' },
            { status: 400 }
          );
        }
        if (!isDriver && !isAdmin) {
          return NextResponse.json(
            { success: false, error: 'Seul le chauffeur ou un admin peut terminer la course' },
            { status: 403 }
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
          updateData.finalFare = finalFare;

          // Si paiement par wallet, debiter le portefeuille
          if (existingRide.paymentMethod === 'wallet') {
            const wallet = await db.wallet.findUnique({
              where: { userId: existingRide.passengerId },
            });
            if (wallet && Number(wallet.balance) >= Number(finalFare)) {
              await db.$transaction([
                db.payment.create({
                  data: {
                    userId: existingRide.passengerId,
                    rideId: id,
                    amount: finalFare,
                    method: 'wallet',
                    status: 'completed',
                    reference: `PAY-RIDE-${Date.now()}`,
                    description: `Course #${id.slice(-8).toUpperCase()}`,
                  },
                }),
                db.wallet.update({
                  where: { userId: existingRide.passengerId },
                  data: { balance: { decrement: finalFare } },
                }),
                db.walletTransaction.create({
                  data: {
                    walletId: wallet.id,
                    type: 'debit',
                    amount: Number(finalFare),
                    method: 'wallet',
                    description: `Course #${id.slice(-8).toUpperCase()}`,
                    status: 'completed',
                  },
                }),
              ]);
              updateData.paymentStatus = 'completed';
            } else {
              // Solde insuffisant : paiement en attente
              updateData.finalFare = finalFare;
              await db.payment.create({
                data: {
                  userId: existingRide.passengerId,
                  rideId: id,
                  amount: finalFare,
                  method: 'wallet',
                  status: 'failed',
                  reference: `PAY-RIDE-${Date.now()}`,
                  description: `Course #${id.slice(-8).toUpperCase()} - solde insuffisant`,
                },
              });
            }
          } else {
            await db.payment.create({
              data: {
                userId: existingRide.passengerId,
                rideId: id,
                amount: finalFare,
                method: existingRide.paymentMethod,
                status: 'pending',
                reference: `PAY-RIDE-${Date.now()}`,
                description: `Course #${id.slice(-8).toUpperCase()}`,
              },
            });
          }
        }
      }

      // annulee par le chauffeur
      else if (newStatus === 'cancelled' || newStatus === 'driver_cancelled') {
        if (!['requested', 'accepted'].includes(existingRide.status)) {
          return NextResponse.json(
            { success: false, error: 'Cette course ne peut plus etre annulee par le chauffeur' },
            { status: 400 }
          );
        }
        if (!isDriver && !isAdmin) {
          return NextResponse.json(
            { success: false, error: 'Seul le chauffeur peut annuler sa course' },
            { status: 403 }
          );
        }
        updateData.status = newStatus;
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
        if (!isPassenger && !isAdmin) {
          return NextResponse.json(
            { success: false, error: 'Seul le passager peut annuler sa course' },
            { status: 403 }
          );
        }
        updateData.status = 'passenger_cancelled';
        updateData.cancelledAt = new Date();
      }

      // client absent (chauffeur)
      else if (newStatus === 'no_show') {
        if (existingRide.status !== 'accepted' && existingRide.status !== 'arrived') {
          return NextResponse.json(
            { success: false, error: 'no_show uniquement possible depuis accepted ou arrived' },
            { status: 400 }
          );
        }
        if (!isDriver && !isAdmin) {
          return NextResponse.json(
            { success: false, error: 'Seul le chauffeur peut signaler un no_show' },
            { status: 403 }
          );
        }
        updateData.status = 'no_show';
        updateData.cancelledAt = new Date();
        updateData.cancellationReason = 'client_absent';
      }

      // remboursement (admin uniquement)
      else if (newStatus === 'refunded') {
        if (!['completed', 'cancelled', 'passenger_cancelled', 'driver_cancelled', 'no_show'].includes(existingRide.status)) {
          return NextResponse.json(
            { success: false, error: 'Remboursement impossible pour ce statut' },
            { status: 400 }
          );
        }
        if (!isAdmin) {
          return NextResponse.json(
            { success: false, error: 'Seul un admin peut traiter un remboursement' },
            { status: 403 }
          );
        }
        updateData.status = 'refunded';

        // Rembourser le portefeuille si paiement wallet
        if (existingRide.paymentMethod === 'wallet' || existingRide.paymentStatus === 'completed') {
          const finalFare = existingRide.finalFare ?? existingRide.estimatedFare;
          await db.$transaction([
            db.wallet.update({
              where: { userId: existingRide.passengerId },
              data: { balance: { increment: Number(finalFare) } },
            }),
            db.walletTransaction.create({
              data: {
                walletId: (await db.wallet.findUnique({ where: { userId: existingRide.passengerId } }))!.id,
                type: 'credit',
                amount: Number(finalFare),
                method: 'refund',
                description: `Remboursement course #${id.slice(-8).toUpperCase()}`,
                status: 'completed',
              },
            }),
          ]);
          updateData.paymentStatus = 'refunded';
        }
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
