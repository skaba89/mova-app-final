// ---------------------------------------------------------------------------
// MOVA Smart Pricing Engine — Client-side utility
// ---------------------------------------------------------------------------
//
// Provides `calculateSmartFare()` for use in components. It:
// 1. Calls the /api/mova/pricing endpoint when the network is available.
// 2. Falls back to local calculation when the API is unreachable.
// 3. Caches recent estimates (LRU, max 20 entries, 5 min TTL).
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PricingParams {
  pickupZone: string;
  dropoffZone: string;
  vehicleType: 'standard' | 'premium' | 'van' | 'moto';
  paymentMethod?: 'cash' | 'wallet' | 'mobile_money';
  weather?: 'normal' | 'rainy';
  /** ISO-8601 datetime string for scheduled rides */
  scheduledAt?: string;
}

export interface FareBreakdown {
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

export interface PricingMeta {
  isSurge: boolean;
  surgePercent: number;
  savingsWithWallet: number;
  priceLockAvailable: boolean;
}

export interface PricingResult {
  fare: number;
  currency: string;
  breakdown: FareBreakdown;
  meta: PricingMeta;
}

interface PricingErrorResponse {
  success: false;
  error: string;
}

interface CacheEntry {
  result: PricingResult;
  timestamp: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const API_ENDPOINT = '/api/mova/pricing';
const CACHE_MAX_ENTRIES = 20;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

const VEHICLE_CONFIG: Record<
  'standard' | 'premium' | 'van' | 'moto',
  { baseFare: number; perKm: number }
> = {
  standard: { baseFare: 3000, perKm: 800 },
  premium: { baseFare: 8000, perKm: 1200 },
  van: { baseFare: 15000, perKm: 1800 },
  moto: { baseFare: 1500, perKm: 500 },
};

// ── 13 communes de Conakry (Law L/2024/003/CNT) ──
// 5 original + 8 from scission
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

const SERVICE_FEE_RATE = 0.05;
const WALLET_DISCOUNT_RATE = 0.03;
const SURGE_THRESHOLD = 1.05;
const AVERAGE_SPEED_KMH = 20;

// ---------------------------------------------------------------------------
// Cache (in-memory LRU)
// ---------------------------------------------------------------------------

const cache = new Map<string, CacheEntry>();

function getCacheKey(params: PricingParams): string {
  return `${params.pickupZone}-${params.dropoffZone}-${params.vehicleType}-${params.paymentMethod ?? 'cash'}-${params.weather ?? 'normal'}-${params.scheduledAt ?? ''}`;
}

function getCached(key: string): PricingResult | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  // Move to end (most recently used)
  cache.delete(key);
  cache.set(key, entry);
  return entry.result;
}

function setCache(key: string, result: PricingResult): void {
  // Evict oldest if at capacity
  if (cache.size >= CACHE_MAX_ENTRIES) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey !== undefined) {
      cache.delete(oldestKey);
    }
  }
  cache.set(key, { result, timestamp: Date.now() });
}

// ---------------------------------------------------------------------------
// Local fallback calculation (mirrors API logic)
// ---------------------------------------------------------------------------

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

function localGetDistance(pickupZone: string, dropoffZone: string): number {
  const pickup = capitalize(pickupZone);
  const dropoff = capitalize(dropoffZone);
  return ZONE_DISTANCES[pickup]?.[dropoff] ?? 8;
}

function localGetDuration(distanceKm: number): number {
  return Math.round((distanceKm / AVERAGE_SPEED_KMH) * 60);
}

function localGetTimeMultiplier(date: Date): number {
  const hour = date.getUTCHours();
  const dayOfWeek = date.getUTCDay();
  if ((hour >= 7 && hour < 9) || (hour >= 17 && hour < 19)) return 1.3;
  if (hour >= 22 || hour < 6) return 1.2;
  if (dayOfWeek === 0 || dayOfWeek === 6) return 1.15;
  return 1.0;
}

function localGetDemandSurge(pickupZone: string, dropoffZone: string, date: Date): number {
  const basePopularity =
    (ZONE_POPULARITY[capitalize(pickupZone)] ?? 1.0) +
    (ZONE_POPULARITY[capitalize(dropoffZone)] ?? 1.0);
  const minute = date.getUTCMinutes();
  const seed = pickupZone.length * 17 + dropoffZone.length * 31 + minute;
  const pseudoRandom = (Math.sin(seed) + 1) / 2;
  const raw = 0.7 + basePopularity * 0.3 + pseudoRandom * 0.3;
  return Math.round(Math.min(1.5, Math.max(0.9, raw)) * 100) / 100;
}

function calculateLocally(params: PricingParams): PricingResult {
  const {
    pickupZone,
    dropoffZone,
    vehicleType = 'standard',
    paymentMethod = 'cash',
    weather = 'normal',
    scheduledAt,
  } = params;

  const config = VEHICLE_CONFIG[vehicleType];
  const tripDate = scheduledAt ? new Date(scheduledAt) : new Date();
  const distance = localGetDistance(pickupZone, dropoffZone);
  const duration = localGetDuration(distance);

  const baseFare = config.baseFare;
  const distanceFare = Math.round(distance * config.perKm);
  const subtotalBeforeMultipliers = baseFare + distanceFare;

  const timeMultiplier = localGetTimeMultiplier(tripDate);
  const surgeMultiplier = localGetDemandSurge(pickupZone, dropoffZone, tripDate);
  const weatherMultiplier = weather === 'rainy' ? 1.2 : 1.0;

  const combinedMultiplier = timeMultiplier * surgeMultiplier * weatherMultiplier;
  const fareAfterMultipliers = Math.round(subtotalBeforeMultipliers * combinedMultiplier);
  const serviceFee = Math.round(fareAfterMultipliers * SERVICE_FEE_RATE);
  const fareAfterService = fareAfterMultipliers + serviceFee;

  const isWalletOrMobileMoney = paymentMethod === 'wallet' || paymentMethod === 'mobile_money';
  const discount = isWalletOrMobileMoney
    ? Math.round(fareAfterService * WALLET_DISCOUNT_RATE)
    : 0;
  const finalFare = fareAfterService - discount;
  const savingsWithWallet = Math.round(fareAfterService * WALLET_DISCOUNT_RATE);

  const isSurge = surgeMultiplier >= SURGE_THRESHOLD;
  const surgePercent = Math.round((surgeMultiplier - 1) * 100);

  return {
    fare: finalFare,
    currency: 'GNF',
    breakdown: {
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
    },
    meta: {
      isSurge,
      surgePercent,
      savingsWithWallet,
      priceLockAvailable: !isSurge || surgeMultiplier < 1.3,
    },
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

// Public API is available via the exported interfaces and calculateFare() function below.

/**
 * Calculate a smart fare estimate for the given parameters.
 */
export async function calculateSmartFare(
  params: PricingParams,
  options?: { forceRefresh?: boolean; signal?: AbortSignal },
): Promise<PricingResult> {
  const key = getCacheKey(params);

  // 1. Cache check (skip if forceRefresh)
  if (!options?.forceRefresh) {
    const cached = getCached(key);
    if (cached) return cached;
  }

  // 2. Try the API
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    if (options?.signal) {
      options.signal.addEventListener('abort', () => controller.abort(), { once: true });
    }

    const response = await fetch(API_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(`API responded with status ${response.status}`);
    }

    const json = await response.json();

    if (!json.success || !json.data) {
      throw new Error(json.error ?? 'Reponse API invalide');
    }

    const result: PricingResult = json.data as PricingResult;
    setCache(key, result);
    return result;
  } catch {
    // 3. Local fallback
    console.warn('[PricingEngine] API indisponible, calcul local utilise.');
    const result = calculateLocally(params);
    setCache(key, result);
    return result;
  }
}

/**
 * Clear all cached pricing estimates.
 */
export function clearPricingCache(): void {
  cache.clear();
}

/**
 * Get the number of cached entries (useful for debugging).
 */
export function getPricingCacheSize(): number {
  // Purge expired first
  const now = Date.now();
  for (const [key, entry] of cache.entries()) {
    if (now - entry.timestamp > CACHE_TTL_MS) {
      cache.delete(key);
    }
  }
  return cache.size;
}
