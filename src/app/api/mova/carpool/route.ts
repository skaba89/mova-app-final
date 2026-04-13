import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const runtime = 'nodejs';

// ─── Fare calculation helpers ───────────────────────────────────────────────

/**
 * Carpool fare = standard fare / max(availableSeats, 1) + 20% platform fee
 * The standard fare is computed using the zone-based distance matrix.
 */
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

function computeStandardFare(pickupZone: string, dropoffZone: string): number {
  const distance = ZONE_DISTANCES[pickupZone]?.[dropoffZone] ?? 8;
  const base = 3000;
  const perKm = 800;
  return Math.round(base + distance * perKm);
}

function computeCarpoolFare(standardFare: number, availableSeats: number): number {
  const perSeat = standardFare / Math.max(availableSeats, 1);
  const withFee = perSeat * 1.2; // +20% platform fee
  return Math.round(withFee);
}

// ─── GET: List carpools ────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id');

    if (!userId) {
      return NextResponse.json({ success: false, error: 'Non autorisé' }, { status: 401 });
    }

    const { searchParams } = request.nextUrl;
    const pickupZone = searchParams.get('pickupZone');
    const dropoffZone = searchParams.get('dropoffZone');
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    // List that user's carpools
    const [myCarpools, total] = await Promise.all([
      db.ride.findMany({
        where: {
          passengerId: userId,
          passengerNote: { startsWith: 'CARPOOL:' },
        },
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
      db.ride.count({
        where: {
          passengerId: userId,
          passengerNote: { startsWith: 'CARPOOL:' },
        },
      }),
    ]);

    // Enrich with carpool-specific data parsed from passengerNote
    const enriched = myCarpools.map((ride) => {
      const carpoolData = parseCarpoolNote(ride.passengerNote || '');
      const standardFare = computeStandardFare(ride.pickupZone, ride.dropoffZone);
      const perSeatFare = computeCarpoolFare(standardFare, carpoolData.availableSeats);
      return {
        ...ride,
        carpoolData,
        standardFare,
        perSeatFare,
      };
    });

    return NextResponse.json({ carpools: enriched, total });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erreur serveur';
    return NextResponse.json(
      { error: `Erreur lors de la récupération des covoiturages: ${message}` },
      { status: 500 }
    );
  }
}

// ─── POST: Create a carpool ride ────────────────────────────────────────────

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
      availableSeats,
      estimatedFare,
    } = body;

    // Validate required fields
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

    // Validate available seats (1-4)
    const seats = parseInt(availableSeats, 10) || 1;
    if (seats < 1 || seats > 4) {
      return NextResponse.json(
        { error: 'Le nombre de places doit être entre 1 et 4' },
        { status: 400 }
      );
    }

    // Calculate carpool fare
    const standardFare = computeStandardFare(pickupZone, dropoffZone);
    const carpoolFare = computeCarpoolFare(standardFare, seats);

    // Estimate distance and duration
    const distance = ZONE_DISTANCES[pickupZone]?.[dropoffZone] ?? 8;
    const duration = Math.round(distance * 3.5); // ~3.5 min per km in Conakry traffic

    // Store carpool metadata in passengerNote field
    // Format: CARPOOL:seats={N},departure={ISO datetime}
    const departureTime = body.departureTime || new Date(Date.now() + 30 * 60000).toISOString();
    const carpoolNote = `CARPOOL:seats=${seats},departure=${departureTime}`;

    // Try to find an available carpool-compatible vehicle (any active vehicle)
    const activeVehicle = await db.vehicle.findFirst({
      where: { isActive: true },
    });

    const rideData: Record<string, unknown> = {
      passengerId: userId,
      pickupAddress,
      pickupLat: parseFloat(pickupLat) || 9.5092,
      pickupLng: parseFloat(pickupLng) || -13.7122,
      pickupZone,
      dropoffAddress,
      dropoffLat: parseFloat(dropoffLat) || 9.6412,
      dropoffLng: parseFloat(dropoffLng) || -13.5784,
      dropoffZone,
      estimatedFare: parseFloat(estimatedFare) || carpoolFare,
      status: 'pending',
      passengerNote: carpoolNote,
      distance,
      duration,
    };

    if (activeVehicle) {
      rideData.vehicleId = activeVehicle.id;
    }

    const ride = await db.ride.create({
      data: rideData as any,
      include: {
        passenger: {
          select: { id: true, name: true, phone: true, avatar: true, rating: true },
        },
        vehicle: true,
      },
    });

    return NextResponse.json(
      {
        ride,
        carpoolData: {
          availableSeats: seats,
          departureTime,
          standardFare,
          perSeatFare: carpoolFare,
          totalFare: carpoolFare * seats,
        },
        success: true,
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erreur serveur';
    return NextResponse.json(
      { error: `Erreur lors de la création du covoiturage: ${message}` },
      { status: 500 }
    );
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Parse carpool metadata from the passengerNote field.
 * Format: CARPOOL:seats={N},departure={ISO datetime}
 */
function parseCarpoolNote(note: string): {
  availableSeats: number;
  departureTime: string;
} {
  const defaultData = { availableSeats: 1, departureTime: new Date().toISOString() };

  if (!note || !note.startsWith('CARPOOL:')) return defaultData;

  try {
    const meta = note.replace('CARPOOL:', '');
    const seatsMatch = meta.match(/seats=(\d+)/);
    const departureMatch = meta.match(/departure=([^,]+)/);

    return {
      availableSeats: seatsMatch ? parseInt(seatsMatch[1], 10) : 1,
      departureTime: departureMatch ? departureMatch[1] : defaultData.departureTime,
    };
  } catch {
    return defaultData;
  }
}
