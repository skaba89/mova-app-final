import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const runtime = 'nodejs';

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;

    const ride = await db.ride.findUnique({
      where: { id },
      include: {
        passenger: {
          select: { id: true, name: true, phone: true, avatar: true, rating: true },
        },
        driver: {
          select: {
            id: true, name: true, phone: true, avatar: true, rating: true,
            isOnline: true, zone: true, currentLat: true, currentLng: true,
            vehicles: { where: { isActive: true } },
          },
        },
        vehicle: true,
        payments: true,
      },
    });

    if (!ride) {
      return NextResponse.json(
        { success: false, error: 'Course non trouvée' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: ride });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erreur serveur';
    console.error('Get ride error:', error instanceof Error ? error.message : error);
    return NextResponse.json(
      { success: false, error: 'Erreur lors de la récupération de la course' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    const { status, driverId, vehicleId, actualFare, distance, duration, passengerRating, driverRating, passengerNote, driverNote } = body;

    const existingRide = await db.ride.findUnique({ where: { id } });

    if (!existingRide) {
      return NextResponse.json(
        { success: false, error: 'Course non trouvée' },
        { status: 404 }
      );
    }

    const updateData: Record<string, unknown> = {};

    if (status !== undefined) {
      updateData.status = status;

      // Set timestamps based on status changes
      if (status === 'in_progress' && !existingRide.startedAt) {
        updateData.startedAt = new Date();
      }
      if (status === 'completed' && !existingRide.completedAt) {
        updateData.completedAt = new Date();
      }
      if (status === 'cancelled' && !existingRide.cancelledAt) {
        updateData.cancelledAt = new Date();
      }
    }

    if (driverId !== undefined) updateData.driverId = driverId;
    if (vehicleId !== undefined) updateData.vehicleId = vehicleId;
    if (actualFare !== undefined) updateData.actualFare = parseFloat(actualFare);
    if (distance !== undefined) updateData.distance = parseFloat(distance);
    if (duration !== undefined) updateData.duration = parseInt(duration, 10);
    if (passengerRating !== undefined) updateData.passengerRating = parseFloat(passengerRating);
    if (driverRating !== undefined) updateData.driverRating = parseFloat(driverRating);
    if (passengerNote !== undefined) updateData.passengerNote = passengerNote;
    if (driverNote !== undefined) updateData.driverNote = driverNote;

    const ride = await db.ride.update({
      where: { id },
      data: updateData,
      include: {
        passenger: {
          select: { id: true, name: true, phone: true, avatar: true, rating: true },
        },
        driver: {
          select: {
            id: true, name: true, phone: true, avatar: true, rating: true,
            isOnline: true, zone: true,
            vehicles: { where: { isActive: true } },
          },
        },
        vehicle: true,
        payments: true,
      },
    });

    return NextResponse.json({ success: true, data: ride });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erreur serveur';
    console.error('Update ride error:', error instanceof Error ? error.message : error);
    return NextResponse.json(
      { success: false, error: 'Erreur lors de la mise à jour de la course' },
      { status: 500 }
    );
  }
}
