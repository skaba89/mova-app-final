import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const runtime = 'nodejs';

// ─── Moto-Taxi Pricing ──────────────────────────────────────────────────
// Moto is ~60% cheaper than standard car rides

const MOTO_PRICING = {
  base: 1500,    // GNF
  perKm: 500,    // GNF per km
};

// Approximate distance matrix between Conakry zones (in km) — 13 communes CNT (Law L/2024/003/CNT)
const ZONE_DISTANCES: Record<string, Record<string, number>> = {
  Kaloum:    { Kaloum: 3, Dixinn: 4, Matam: 6, Ratoma: 12, Matoto: 14, Gbessia: 15, Tombolia: 16, Lambanyi: 11, Sonfonia: 13, Kagbelene: 18, Dubreka: 22, Maneah: 20, Sanoyah: 22 },
  Dixinn:    { Kaloum: 4, Dixinn: 3, Matam: 4, Ratoma: 9, Matoto: 11, Gbessia: 12, Tombolia: 13, Lambanyi: 8, Sonfonia: 10, Kagbelene: 15, Dubreka: 19, Maneah: 17, Sanoyah: 19 },
  Matam:     { Kaloum: 6, Dixinn: 4, Matam: 3, Ratoma: 6, Matoto: 7, Gbessia: 8, Tombolia: 9, Lambanyi: 5, Sonfonia: 7, Kagbelene: 12, Dubreka: 16, Maneah: 14, Sanoyah: 16 },
  Ratoma:    { Kaloum: 12, Dixinn: 9, Matam: 6, Ratoma: 3, Matoto: 5, Gbessia: 6, Tombolia: 4, Lambanyi: 3, Sonfonia: 5, Kagbelene: 10, Dubreka: 14, Maneah: 12, Sanoyah: 14 },
  Matoto:    { Kaloum: 14, Dixinn: 11, Matam: 7, Ratoma: 5, Matoto: 3, Gbessia: 4, Tombolia: 5, Lambanyi: 5, Sonfonia: 6, Kagbelene: 11, Dubreka: 15, Maneah: 13, Sanoyah: 15 },
  Gbessia:   { Kaloum: 15, Dixinn: 12, Matam: 8, Ratoma: 6, Matoto: 4, Gbessia: 2, Tombolia: 3, Lambanyi: 5, Sonfonia: 7, Kagbelene: 12, Dubreka: 16, Maneah: 14, Sanoyah: 16 },
  Tombolia:  { Kaloum: 16, Dixinn: 13, Matam: 9, Ratoma: 4, Matoto: 5, Gbessia: 3, Tombolia: 2, Lambanyi: 4, Sonfonia: 6, Kagbelene: 11, Dubreka: 15, Maneah: 13, Sanoyah: 15 },
  Lambanyi:  { Kaloum: 11, Dixinn: 8, Matam: 5, Ratoma: 3, Matoto: 5, Gbessia: 5, Tombolia: 4, Lambanyi: 2, Sonfonia: 3, Kagbelene: 9, Dubreka: 13, Maneah: 11, Sanoyah: 13 },
  Sonfonia:  { Kaloum: 13, Dixinn: 10, Matam: 7, Ratoma: 5, Matoto: 6, Gbessia: 7, Tombolia: 6, Lambanyi: 3, Sonfonia: 2, Kagbelene: 10, Dubreka: 14, Maneah: 12, Sanoyah: 14 },
  Kagbelene: { Kaloum: 18, Dixinn: 15, Matam: 12, Ratoma: 10, Matoto: 11, Gbessia: 12, Tombolia: 11, Lambanyi: 9, Sonfonia: 10, Kagbelene: 2, Dubreka: 5, Maneah: 4, Sanoyah: 6 },
  Dubreka:   { Kaloum: 22, Dixinn: 19, Matam: 16, Ratoma: 14, Matoto: 15, Gbessia: 16, Tombolia: 15, Lambanyi: 13, Sonfonia: 14, Kagbelene: 5, Dubreka: 2, Maneah: 6, Sanoyah: 8 },
  Maneah:    { Kaloum: 20, Dixinn: 17, Matam: 14, Ratoma: 12, Matoto: 13, Gbessia: 14, Tombolia: 13, Lambanyi: 11, Sonfonia: 12, Kagbelene: 4, Dubreka: 6, Maneah: 2, Sanoyah: 4 },
  Sanoyah:   { Kaloum: 22, Dixinn: 19, Matam: 16, Ratoma: 14, Matoto: 15, Gbessia: 16, Tombolia: 15, Lambanyi: 13, Sonfonia: 14, Kagbelene: 6, Dubreka: 8, Maneah: 4, Sanoyah: 2 },
};

function getDistance(pickupZone: string, dropoffZone: string): number {
  const pickup = pickupZone.charAt(0).toUpperCase() + pickupZone.slice(1);
  const dropoff = dropoffZone.charAt(0).toUpperCase() + dropoffZone.slice(1);

  if (ZONE_DISTANCES[pickup]?.[dropoff]) {
    return ZONE_DISTANCES[pickup][dropoff];
  }

  return 8; // default fallback
}

function getDuration(distanceKm: number): number {
  // Moto avg speed in Conakry traffic: ~25 km/h (faster than cars in traffic)
  const avgSpeed = 25;
  return Math.round((distanceKm / avgSpeed) * 60);
}

function estimateMotoFare(pickupZone: string, dropoffZone: string) {
  const distance = getDistance(pickupZone, dropoffZone);
  const duration = getDuration(distance);
  const fare = MOTO_PRICING.base + distance * MOTO_PRICING.perKm;

  return {
    fare: Math.round(fare),
    distance,
    duration,
    breakdown: {
      base: MOTO_PRICING.base,
      distanceKm: distance,
      perKmRate: MOTO_PRICING.perKm,
      distanceCost: Math.round(distance * MOTO_PRICING.perKm),
      vehicleType: 'moto',
    },
  };
}

// ─── GET: List moto rides ───────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id');

    if (!userId) {
      return NextResponse.json({ success: false, error: 'Non autorisé' }, { status: 401 });
    }

    const { searchParams } = request.nextUrl;
    const status = searchParams.get('status');
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    const where: Record<string, unknown> = { passengerId: userId };

    if (status) {
      where.status = status;
    }

    // Look for moto vehicles linked to rides
    const vehicleWhere: Record<string, unknown> = { ...(status ? { status } : {}), passengerId: userId };

    // Look for moto vehicles linked to rides
    const motoVehicles = await db.vehicle.findMany({
      where: { type: 'moto', isActive: true },
      select: { id: true },
    });
    const motoVehicleIds = motoVehicles.map((v) => v.id);

    if (motoVehicleIds.length > 0) {
      vehicleWhere.vehicleId = { in: motoVehicleIds };
    } else {
      // Fallback: if no moto vehicles, look for rides tagged in passengerNote
      vehicleWhere.passengerNote = { contains: '[MOTO]' };
    }

    const [rides, total] = await Promise.all([
      db.ride.findMany({
        where: vehicleWhere,
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
        orderBy: { createdAt: 'desc' },
        take: Math.min(limit, 100),
        skip: offset,
      }),
      db.ride.count({ where: vehicleWhere }),
    ]);

    return NextResponse.json({ rides, total, vehicleType: 'moto' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erreur serveur';
    return NextResponse.json(
      { error: `Erreur lors de la récupération des courses moto: ${message}` },
      { status: 500 }
    );
  }
}

// ─── POST: Create a moto-taxi ride ──────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id');

    if (!userId) {
      return NextResponse.json({ success: false, error: 'Non autorisé' }, { status: 401 });
    }

    const body = await request.json();
    const {
      pickupAddress,
      pickupLat,
      pickupLng,
      pickupZone,
      dropoffAddress,
      dropoffLat,
      dropoffLng,
      dropoffZone,
      estimatedFare,
      passengerNote,
      distance,
      duration,
    } = body;

    if (!pickupAddress || !dropoffAddress) {
      return NextResponse.json(
        { error: 'Champs requis manquants: pickupAddress, dropoffAddress' },
        { status: 400 }
      );
    }

    if (!pickupZone || !dropoffZone) {
      return NextResponse.json(
        { error: 'Zones de départ et d\'arrivée requises' },
        { status: 400 }
      );
    }

    // Auto-estimate fare if not provided
    const fareEstimate = estimatedFare
      ? { fare: parseFloat(estimatedFare) }
      : estimateMotoFare(pickupZone, dropoffZone);

    const distanceKm = distance
      ? parseFloat(distance)
      : (fareEstimate as any).distance || getDistance(pickupZone, dropoffZone);

    const durationMin = duration
      ? parseInt(duration, 10)
      : (fareEstimate as any).duration || getDuration(distanceKm);

    // Build ride data — use userId from headers
    const rideData: Record<string, unknown> = {
      passengerId: userId,
      pickupAddress,
      pickupLat: parseFloat(pickupLat) || 0,
      pickupLng: parseFloat(pickupLng) || 0,
      pickupZone,
      dropoffAddress,
      dropoffLat: parseFloat(dropoffLat) || 0,
      dropoffLng: parseFloat(dropoffLng) || 0,
      dropoffZone,
      estimatedFare: fareEstimate.fare,
      distance: distanceKm,
      duration: durationMin,
      status: 'pending',
      passengerNote: passengerNote
        ? `[MOTO] ${passengerNote}`
        : '[MOTO] Course moto-taxi',
    };

    // Try to find an active moto vehicle
    const activeMoto = await db.vehicle.findFirst({
      where: { type: 'moto', isActive: true },
    });

    if (activeMoto) {
      rideData.vehicleId = activeMoto.id;
      // Also assign the vehicle's driver
      rideData.driverId = activeMoto.driverId;
    }

    const ride = await db.ride.create({
      data: rideData as any,
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
      },
    });

    return NextResponse.json({
      ride,
      fare: {
        fare: fareEstimate.fare,
        distance: distanceKm,
        duration: durationMin,
        breakdown: {
          base: MOTO_PRICING.base,
          distanceKm: distanceKm,
          perKmRate: MOTO_PRICING.perKm,
          distanceCost: Math.round(distanceKm * MOTO_PRICING.perKm),
          vehicleType: 'moto',
        },
      },
      success: true,
    }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erreur serveur';
    return NextResponse.json(
      { error: `Erreur lors de la création de la course moto: ${message}` },
      { status: 500 }
    );
  }
}
