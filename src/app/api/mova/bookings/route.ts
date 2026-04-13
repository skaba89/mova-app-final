export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { validateRequest } from '@/lib/mova/auth-middleware';

// GET /api/mova/bookings?passengerId=xxx&status=scheduled&type=car_rental
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const passengerId = searchParams.get('passengerId');
    const status = searchParams.get('status');
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    const where: Record<string, unknown> = {};

    if (passengerId) {
      where.passengerId = passengerId;
    }

    if (status) {
      where.status = status;
    }

    const [bookings, total] = await Promise.all([
      db.booking.findMany({
        where,
        include: {
          passenger: {
            select: { id: true, name: true, phone: true, avatar: true },
          },
        },
        orderBy: { scheduledFor: 'desc' },
        take: limit,
        skip: offset,
      }),
      db.booking.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: bookings,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erreur serveur';
    return NextResponse.json(
      { success: false, error: `Erreur lors de la récupération des réservations: ${message}` },
      { status: 500 }
    );
  }
}

// POST /api/mova/bookings
// Supports both ride bookings (authenticated) and car_rental (demo/optional auth)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, passengerId, vehicleType, pickupAddress, scheduledFor, preferences, notes } = body;

    // ── Car Rental Flow ──
    if (type === 'car_rental') {
      if (!pickupAddress || !scheduledFor) {
        return NextResponse.json(
          { success: false, error: 'Lieu de récupération et date de début sont requis.' },
          { status: 400 }
        );
      }

      const scheduledDate = new Date(scheduledFor);
      if (scheduledDate <= new Date()) {
        return NextResponse.json(
          { success: false, error: 'La date de réservation doit être dans le futur.' },
          { status: 400 }
        );
      }

      if (!preferences?.endDate) {
        return NextResponse.json(
          { success: false, error: 'La date de fin est requise.' },
          { status: 400 }
        );
      }

      const endDate = new Date(preferences.endDate);
      if (endDate <= scheduledDate) {
        return NextResponse.json(
          { success: false, error: 'La date de fin doit être après la date de début.' },
          { status: 400 }
        );
      }

      // Conakry center coordinates as defaults for car rental
      const defaultLat = 9.5092;
      const defaultLng = -13.7122;
      const defaultZone = 'Kaloum';

      const bookingNotes = JSON.stringify({
        bookingType: 'car_rental',
        endDate: preferences.endDate,
        totalAmount: preferences.totalAmount,
        paymentMethod: preferences.paymentMethod,
        customerName: preferences.customerName || null,
        customerPhone: preferences.customerPhone || null,
        notes: notes || null,
      });

      // Calculate total fare from preferences
      const totalAmount = preferences.totalAmount || 0;

      const booking = await db.booking.create({
        data: {
          passengerId: passengerId || 'demo',
          vehicleType: vehicleType || 'standard',
          pickupAddress,
          pickupLat: defaultLat,
          pickupLng: defaultLng,
          pickupZone: defaultZone,
          dropoffAddress: pickupAddress,
          dropoffLat: defaultLat,
          dropoffLng: defaultLng,
          dropoffZone: defaultZone,
          scheduledFor: scheduledDate,
          estimatedFare: totalAmount,
          notes: bookingNotes,
        },
        include: {
          passenger: {
            select: { id: true, name: true, phone: true },
          },
        },
      });

      return NextResponse.json({
        success: true,
        data: {
          ...booking,
          estimatedFareFormatted: `${totalAmount.toLocaleString('fr-GN')} GNF`,
        },
        message: 'Réservation de véhicule créée avec succès !',
      });
    }

    // ── Standard Ride Flow (requires auth) ──
    const auth = await validateRequest(request);
    if (!auth.success) return auth.response;

    const {
      pickupLat,
      pickupLng,
      pickupZone,
      dropoffAddress,
      dropoffLat,
      dropoffLng,
      dropoffZone,
    } = body;

    if (!passengerId || !pickupAddress || !pickupLat || !pickupLng || !pickupZone ||
        !dropoffAddress || !dropoffLat || !dropoffLng || !dropoffZone || !scheduledFor) {
      return NextResponse.json(
        { success: false, error: 'Tous les champs obligatoires doivent être remplis' },
        { status: 400 }
      );
    }

    // Validate vehicle type
    const validVehicleTypes = ['standard', 'premium', 'van'];
    const selectedVehicleType = vehicleType || 'standard';
    if (!validVehicleTypes.includes(selectedVehicleType)) {
      return NextResponse.json(
        { success: false, error: 'Type de véhicule invalide' },
        { status: 400 }
      );
    }

    // Simple fare estimation based on vehicle type
    const fareMap: Record<string, number> = {
      standard: 5000,
      premium: 12000,
      van: 20000,
    };
    const estimatedFare = fareMap[selectedVehicleType] || 5000;

    const scheduledDate = new Date(scheduledFor);
    if (scheduledDate <= new Date()) {
      return NextResponse.json(
        { success: false, error: 'La date de réservation doit être dans le futur' },
        { status: 400 }
      );
    }

    // Create booking
    const booking = await db.booking.create({
      data: {
        passengerId,
        vehicleType: selectedVehicleType,
        pickupAddress,
        pickupLat,
        pickupLng,
        pickupZone,
        dropoffAddress,
        dropoffLat,
        dropoffLng,
        dropoffZone,
        scheduledFor: scheduledDate,
        estimatedFare,
        notes: notes || null,
      },
      include: {
        passenger: {
          select: { id: true, name: true, phone: true },
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        ...booking,
        estimatedFareFormatted: `${estimatedFare.toLocaleString('fr-GN')} GNF`,
      },
      message: 'Réservation créée avec succès',
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erreur serveur';
    return NextResponse.json(
      { success: false, error: `Erreur lors de la création de la réservation: ${message}` },
      { status: 500 }
    );
  }
}
