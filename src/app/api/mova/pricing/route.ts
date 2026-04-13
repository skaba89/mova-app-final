import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PricingRequestBody {
  pickupZone: string;
  dropoffZone: string;
  vehicleType?: 'standard' | 'premium' | 'van';
  paymentMethod?: 'cash' | 'wallet' | 'mobile_money';
  weather?: 'normal' | 'rainy';
  /** ISO-8601 datetime override (defaults to now). Useful for scheduled rides. */
  scheduledAt?: string;
}

interface FareBreakdown {
  baseFare: number;
  distanceFare: number;
  distance: number;
  duration: number;
  timeMultiplier: number;
  surgeMultiplier: number;
  weatherMultiplier: number;
  serviceFee: number;
  discount: number;
  finalFare: number;
}

interface PricingMeta {
  isSurge: boolean;
  surgePercent: number;
  savingsWithWallet: number;
  priceLockAvailable: boolean;
}

interface PricingResponse {
  success: true;
  data: {
    fare: number;
    currency: string;
    breakdown: FareBreakdown;
    meta: PricingMeta;
  };
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CURRENCY = 'GNF';

const VEHICLE_CONFIG: Record<
  'standard' | 'premium' | 'van',
  { baseFare: number; perKm: number; label: string }
> = {
  standard: { baseFare: 3000, perKm: 800, label: 'Standard' },
  premium: { baseFare: 8000, perKm: 1200, label: 'Premium' },
  van: { baseFare: 15000, perKm: 1800, label: 'Van' },
};

// Approximate distance matrix between Conakry zones (km) — 13 communes CNT (Law L/2024/003/CNT)
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

// Zone popularity seed weights for deterministic-ish surge simulation
const ZONE_POPULARITY: Record<string, number> = {
  Kaloum: 1.4,
  Dixinn: 1.3,
  Matam: 1.2,
  Ratoma: 1.2,
  Matoto: 1.1,
  Gbessia: 1.15,
  Tombolia: 1.05,
  Lambanyi: 1.1,
  Sonfonia: 1.1,
  Kagbelene: 1.0,
  Dubreka: 1.05,
  Maneah: 1.0,
  Sanoyah: 1.0,
};

const SERVICE_FEE_RATE = 0.05; // 5%
const WALLET_DISCOUNT_RATE = 0.03; // 3%
const MOBILE_MONEY_DISCOUNT_RATE = 0.03; // 3%
const SURGE_THRESHOLD = 1.05; // Surge indicator threshold
const AVERAGE_SPEED_KMH = 20; // Conakry traffic average

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

function getDistance(pickupZone: string, dropoffZone: string): number {
  const pickup = capitalize(pickupZone);
  const dropoff = capitalize(dropoffZone);
  return ZONE_DISTANCES[pickup]?.[dropoff] ?? 8;
}

function getDuration(distanceKm: number): number {
  return Math.round((distanceKm / AVERAGE_SPEED_KMH) * 60);
}

/**
 * Determine time-of-day multiplier based on current/scheduled hour in Conakry (GMT+0).
 */
function getTimeMultiplier(date: Date): number {
  const hour = date.getUTCHours(); // Conakry is UTC+0
  const dayOfWeek = date.getUTCDay(); // 0=Sun … 6=Sat

  // Peak hours: 7-9 AM and 17-19 PM
  if ((hour >= 7 && hour < 9) || (hour >= 17 && hour < 19)) {
    return 1.3;
  }

  // Night: 22-6 AM
  if (hour >= 22 || hour < 6) {
    return 1.2;
  }

  // Weekend: Sat (6) or Sun (0)
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    return 1.15;
  }

  return 1.0;
}

/**
 * Get a human-readable label for the current time period.
 */
function getTimePeriodLabel(date: Date): string {
  const hour = date.getUTCHours();
  const dayOfWeek = date.getUTCDay();

  if ((hour >= 7 && hour < 9) || (hour >= 17 && hour < 19)) {
    return 'Heures de pointe';
  }
  if (hour >= 22 || hour < 6) {
    return 'Tarif de nuit';
  }
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    return 'Tarif week-end';
  }
  return 'Tarif normal';
}

/**
 * Simulate demand surge based on zone popularity and a deterministic pseudo-random
 * factor derived from the current minute + zone names.
 * Returns a multiplier between 0.9 and 1.5.
 */
function getDemandSurge(pickupZone: string, dropoffZone: string, date: Date): number {
  const basePopularity =
    (ZONE_POPULARITY[capitalize(pickupZone)] ?? 1.0) +
    (ZONE_POPULARITY[capitalize(dropoffZone)] ?? 1.0);

  // Pseudo-random factor using minute + zone name hash
  const minute = date.getUTCMinutes();
  const seed =
    pickupZone.length * 17 + dropoffZone.length * 31 + minute;
  const pseudoRandom = ((Math.sin(seed) + 1) / 2); // 0..1

  // Scale: base popularity + random variance -> clamp to [0.9, 1.5]
  const raw = 0.7 + basePopularity * 0.3 + pseudoRandom * 0.3;
  return Math.round(Math.min(1.5, Math.max(0.9, raw)) * 100) / 100;
}

/**
 * Weather multiplier.
 */
function getWeatherMultiplier(weather: 'normal' | 'rainy'): number {
  return weather === 'rainy' ? 1.2 : 1.0;
}

/**
 * Format a number with French-style thousands separator (space).
 */
function formatGNF(amount: number): string {
  return amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

// ---------------------------------------------------------------------------
// POST Handler
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest): Promise<NextResponse<PricingResponse | { success: false; error: string }>> {
  try {
    const body: PricingRequestBody = await request.json();
    const {
      pickupZone,
      dropoffZone,
      vehicleType = 'standard',
      paymentMethod = 'cash',
      weather = 'normal',
      scheduledAt,
    } = body;

    // --- Validation --------------------------------------------------------
    if (!pickupZone || !dropoffZone) {
      return NextResponse.json(
        { success: false, error: "Zones de depart et d'arrivee requises" },
        { status: 400 },
      );
    }

    if (!VEHICLE_CONFIG[vehicleType]) {
      return NextResponse.json(
        {
          success: false,
          error: `Type de vehicule invalide. Choix: ${Object.keys(VEHICLE_CONFIG).join(', ')}`,
        },
        { status: 400 },
      );
    }

    if (!['cash', 'wallet', 'mobile_money'].includes(paymentMethod)) {
      return NextResponse.json(
        { success: false, error: "Methode de paiement invalide. Choix: cash, wallet, mobile_money" },
        { status: 400 },
      );
    }

    if (!['normal', 'rainy'].includes(weather)) {
      return NextResponse.json(
        { success: false, error: "Conditions meteo invalides. Choix: normal, rainy" },
        { status: 400 },
      );
    }

    // --- Core Calculation --------------------------------------------------
    const config = VEHICLE_CONFIG[vehicleType];
    const tripDate = scheduledAt ? new Date(scheduledAt) : new Date();
    const distance = getDistance(pickupZone, dropoffZone);
    const duration = getDuration(distance);

    const baseFare = config.baseFare;
    const distanceFare = Math.round(distance * config.perKm);
    const subtotalBeforeMultipliers = baseFare + distanceFare;

    // Multipliers
    const timeMultiplier = getTimeMultiplier(tripDate);
    const surgeMultiplier = getDemandSurge(pickupZone, dropoffZone, tripDate);
    const weatherMultiplier = getWeatherMultiplier(weather as 'normal' | 'rainy');

    // Combined multiplier (multiplicative)
    const combinedMultiplier = timeMultiplier * surgeMultiplier * weatherMultiplier;
    const fareAfterMultipliers = Math.round(subtotalBeforeMultipliers * combinedMultiplier);

    // Service fee
    const serviceFee = Math.round(fareAfterMultipliers * SERVICE_FEE_RATE);
    const fareAfterService = fareAfterMultipliers + serviceFee;

    // Discount
    const isWalletOrMobileMoney = paymentMethod === 'wallet' || paymentMethod === 'mobile_money';
    const discount = isWalletOrMobileMoney
      ? Math.round(fareAfterService * WALLET_DISCOUNT_RATE)
      : 0;

    const finalFare = fareAfterService - discount;

    // Savings with wallet (always calculated for meta, even if paying cash)
    const savingsWithWallet = Math.round(fareAfterService * WALLET_DISCOUNT_RATE);

    // --- Build Response ----------------------------------------------------
    const breakdown: FareBreakdown = {
      baseFare,
      distanceFare,
      distance: Math.round(distance * 10) / 10,
      duration,
      timeMultiplier,
      surgeMultiplier,
      weatherMultiplier,
      serviceFee,
      discount,
      finalFare,
    };

    const isSurge = surgeMultiplier >= SURGE_THRESHOLD;
    const surgePercent = Math.round((surgeMultiplier - 1) * 100);

    const meta: PricingMeta = {
      isSurge,
      surgePercent,
      savingsWithWallet,
      priceLockAvailable: !isSurge || surgeMultiplier < 1.3,
    };

    return NextResponse.json({
      success: true,
      data: {
        fare: finalFare,
        currency: CURRENCY,
        breakdown,
        meta,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erreur serveur';
    console.error('[PRICING] Erreur de calcul dynamique:', message);
    return NextResponse.json(
      { success: false, error: 'Erreur lors du calcul du tarif dynamique' },
      { status: 500 },
    );
  }
}
