/**
 * MOVA API helper functions
 * Typed fetch wrappers for all MOVA backend endpoints.
 */

// ─── Types ──────────────────────────────────────────────────────────────────

export interface FareEstimate {
  fare: number
  distance: number
  duration: number
  breakdown?: {
    base: number
    distanceKm: number
    perKmRate: number
    distanceCost: number
    vehicleType: string
  }
}

export interface RideCreatePayload {
  passengerId: string
  pickupAddress: string
  pickupLat: number
  pickupLng: number
  pickupZone: string
  dropoffAddress: string
  dropoffLat: number
  dropoffLng: number
  dropoffZone: string
  estimatedFare?: number
  vehicleType?: string
  passengerNote?: string
  distance?: number
  duration?: number
}

export interface BookingCreatePayload {
  passengerId: string
  pickupAddress: string
  pickupLat: number
  pickupLng: number
  pickupZone: string
  dropoffAddress: string
  dropoffLat: number
  dropoffLng: number
  dropoffZone: string
  vehicleType?: string
  scheduledFor: string
  notes?: string
}

export interface ApiResponse<T = unknown> {
  success?: boolean
  data?: T
  error?: string
  message?: string
  [key: string]: unknown
}

export interface PaginatedResponse<T = unknown> {
  data?: T[]
  pagination?: {
    total: number
    limit: number
    offset: number
    hasMore: boolean
  }
  success?: boolean
  error?: string
}

// ─── Auth Token Helper ──────────────────────────────────────────────────────

function getAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('mova_token')
    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }
  }
  return headers
}

// ─── Generic fetch helper ───────────────────────────────────────────────────

async function apiFetch<T = unknown>(
  url: string,
  options?: RequestInit
): Promise<{ data: T | null; error: string | null }> {
  try {
    const headers = getAuthHeaders();
    const res = await fetch(url, {
      headers,
      ...options,
    })

    // If 401 with a real token, trigger logout only once per session
    if (res.status === 401) {
      const token = headers['Authorization'];
      // Don't logout for demo tokens or missing tokens
      if (token && token !== 'Bearer demo-token' && typeof window !== 'undefined') {
        const alreadyLoggedOut = sessionStorage.getItem('mova_logout_triggered');
        if (!alreadyLoggedOut) {
          sessionStorage.setItem('mova_logout_triggered', 'true');
          localStorage.removeItem('mova_token')
          localStorage.removeItem('mova_user')
          window.dispatchEvent(new CustomEvent('mova:auth-expired'))
        }
      }
      return { data: null, error: 'Session expirée. Veuillez vous reconnecter.' }
    }

    const json = await res.json()

    if (!res.ok) {
      return { data: null, error: json.error || `Erreur ${res.status}` }
    }

    return { data: json as T, error: null }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur de connexion'
    return { data: null, error: message }
  }
}

// ─── Fare Estimation ────────────────────────────────────────────────────────

export async function fetchFare(
  pickupZone: string,
  dropoffZone: string,
  vehicleType: string = 'standard'
): Promise<{ data: FareEstimate | null; error: string | null }> {
  return apiFetch<FareEstimate>('/api/mova/fare', {
    method: 'POST',
    body: JSON.stringify({ pickupZone, dropoffZone, vehicleType }),
  })
}

// ─── Rides ──────────────────────────────────────────────────────────────────

export async function createRide(
  payload: RideCreatePayload
): Promise<{ data: ApiResponse | null; error: string | null }> {
  return apiFetch<ApiResponse>('/api/mova/rides', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function getRides(
  passengerId?: string,
  status?: string,
  limit: number = 20,
  offset: number = 0
): Promise<{ data: { rides: unknown[]; total: number } | null; error: string | null }> {
  const params = new URLSearchParams()
  if (passengerId) params.set('passengerId', passengerId)
  if (status) params.set('status', status)
  params.set('limit', String(limit))
  params.set('offset', String(offset))

  return apiFetch(`/api/mova/rides?${params.toString()}`)
}

export async function getRide(
  rideId: string
): Promise<{ data: ApiResponse | null; error: string | null }> {
  return apiFetch<ApiResponse>(`/api/mova/rides/${encodeURIComponent(rideId)}`)
}

export async function updateRideStatus(
  rideId: string,
  status: string,
  extra?: Record<string, unknown>
): Promise<{ data: ApiResponse | null; error: string | null }> {
  return apiFetch<ApiResponse>(`/api/mova/rides/${encodeURIComponent(rideId)}`, {
    method: 'PATCH',
    body: JSON.stringify({ status, ...extra }),
  })
}

// ─── Bookings (Scheduled Rides) ─────────────────────────────────────────────

export async function createBooking(
  payload: BookingCreatePayload
): Promise<{ data: ApiResponse | null; error: string | null }> {
  return apiFetch<ApiResponse>('/api/mova/bookings', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function getBookings(
  passengerId?: string,
  status?: string,
  limit: number = 20,
  offset: number = 0
): Promise<{ data: PaginatedResponse | null; error: string | null }> {
  const params = new URLSearchParams()
  if (passengerId) params.set('passengerId', passengerId)
  if (status) params.set('status', status)
  params.set('limit', String(limit))
  params.set('offset', String(offset))

  return apiFetch(`/api/mova/bookings?${params.toString()}`)
}

// ─── Wallet ─────────────────────────────────────────────────────────────────

export async function getWallet(
  userId: string
): Promise<{ data: ApiResponse | null; error: string | null }> {
  return apiFetch<ApiResponse>(`/api/mova/wallet?userId=${encodeURIComponent(userId)}`)
}

export async function topupWallet(
  userId: string,
  amount: number,
  method: string = 'mobile_money',
  provider?: string
): Promise<{ data: ApiResponse | null; error: string | null }> {
  return apiFetch<ApiResponse>('/api/mova/wallet/topup', {
    method: 'POST',
    body: JSON.stringify({ userId, amount, method, provider }),
  })
}

// ─── GNF Formatter ──────────────────────────────────────────────────────────

const gnfFormatter = new Intl.NumberFormat('fr-GN')

export function formatGNF(amount: number): string {
  return gnfFormatter.format(amount) + ' GNF'
}
