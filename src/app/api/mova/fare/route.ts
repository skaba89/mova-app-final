import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

// Pricing configuration
const PRICING: Record<string, { base: number; perKm: number }> = {
  standard: { base: 3000, perKm: 800 },
  premium: { base: 8000, perKm: 1200 },
  van: { base: 15000, perKm: 1800 },
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

  // Default for unknown zones
  return 8;
}

function getDuration(distanceKm: number): number {
  // Average speed in Conakry traffic: ~20 km/h
  const avgSpeed = 20;
  return Math.round((distanceKm / avgSpeed) * 60);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { pickupZone, dropoffZone, vehicleType } = body;

    if (!pickupZone || !dropoffZone) {
      return NextResponse.json(
        { success: false, error: 'Zones de départ et d\'arrivée requises' },
        { status: 400 }
      );
    }

    const type = vehicleType || 'standard';
    const pricing = PRICING[type] || PRICING.standard;
    const distance = getDistance(pickupZone, dropoffZone);
    const duration = getDuration(distance);
    const fare = pricing.base + distance * pricing.perKm;

    return NextResponse.json({
      success: true,
      data: {
        fare: Math.round(fare),
        distance,
        duration,
        breakdown: {
          base: pricing.base,
          distanceKm: distance,
          perKmRate: pricing.perKm,
          distanceCost: distance * pricing.perKm,
          vehicleType: type,
        },
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erreur serveur';
    console.error('Fare estimation error:', error instanceof Error ? error.message : error);
    return NextResponse.json(
      { success: false, error: 'Erreur lors du calcul du tarif' },
      { status: 500 }
    );
  }
}
