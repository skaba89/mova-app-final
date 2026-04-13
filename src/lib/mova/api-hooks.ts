import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseQueryOptions,
  type UseMutationOptions,
} from '@tanstack/react-query'
import type {
  ApiResponse,
  PaginatedResponse,
  AnalyticsData,
  ZoneData,
  RideData,
  RidesResponse,
  RidesQueryParams,
  CreateRideInput,
  UpdateRideInput,
  DriverData,
  DriversQueryParams,
  UpdateDriverInput,
  WalletData,
  WalletTopUpInput,
  WalletTopUpResponse,
  WalletTransferInput,
  WalletTransferResponse,
  BookingData,
  BookingsQueryParams,
  CreateBookingInput,
  UpdateBookingInput,
  DeliveryData,
  DeliveriesQueryParams,
  CreateDeliveryInput,
  CreateDeliveryResponse,
  UpdateDeliveryInput,
  IncidentData,
  IncidentsQueryParams,
  ReportIncidentInput,
  UpdateIncidentInput,
  PromotionData,
  RedeemPromotionInput,
  RedeemPromotionResponse,
  UserPromotionsData,
  ReferralsData,
  CreateReferralInput,
  CreateReferralResponse,
  ReferralLeaderboardEntry,
  BusinessData,
  CreateBusinessInput,
  BusinessAnalyticsData,
  PricingInput,
  PricingData,
  SendMessageInput,
  AssistantResponse,
  MobileMoneyPaymentInput,
  MobileMoneyPaymentResponse,
  MobileMoneyPaymentStatus,
  UpdateZoneInput,
} from './api-types'

// ─── Query Key Factory ─────────────────────────────────────────────────────────

export const queryKeys = {
  analytics: ['analytics'] as const,
  zones: ['zones'] as const,
  rides: (params?: RidesQueryParams) => ['rides', params] as const,
  ride: (id: string) => ['rides', id] as const,
  drivers: (params?: DriversQueryParams) => ['drivers', params] as const,
  wallet: (userId: string) => ['wallet', userId] as const,
  bookings: (params?: BookingsQueryParams) => ['bookings', params] as const,
  deliveries: (params?: DeliveriesQueryParams) => ['deliveries', params] as const,
  incidents: (params?: IncidentsQueryParams) => ['incidents', params] as const,
  promotions: (active?: boolean) => ['promotions', active] as const,
  userPromotions: (userId: string) => ['promotions', 'user', userId] as const,
  referrals: (userId: string) => ['referrals', userId] as const,
  referralLeaderboard: ['referrals', 'leaderboard'] as const,
  business: (businessId: string) => ['business', businessId] as const,
  businessAnalytics: (businessId: string) => ['business', businessId, 'analytics'] as const,
  paymentStatus: (transactionId: string) => ['payments', 'mobile-money', transactionId] as const,
} as const

// ─── Helpers ───────────────────────────────────────────────────────────────────

function getAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = {}
  const token =
    typeof window !== 'undefined' ? localStorage.getItem('mova_token') : null
  if (token) headers['Authorization'] = `Bearer ${token}`
  return headers
}

function handleAuthError(status: number): void {
  if (status === 401 && typeof window !== 'undefined') {
    localStorage.removeItem('mova_token')
    localStorage.removeItem('mova_user')
    window.dispatchEvent(new CustomEvent('mova:auth-expired'))
  }
}

async function apiGet<T>(url: string): Promise<T> {
  const headers = getAuthHeaders()
  const res = await fetch(url, { headers })
  if (!res.ok) {
    handleAuthError(res.status)
    const body = await res.json().catch(() => ({ error: 'Erreur reseau' }))
    throw new Error(body.error ?? `Erreur ${res.status}`)
  }
  const json: ApiResponse<T> = await res.json()
  if (!json.success) {
    throw new Error(json.error ?? 'Erreur inconnue')
  }
  return json.data as T
}

async function apiPost<T>(url: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...getAuthHeaders(),
  }
  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: body != null ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    handleAuthError(res.status)
    const body = await res.json().catch(() => ({ error: 'Erreur réseau' }))
    throw new Error(body.error ?? `Erreur ${res.status}`)
  }
  const json: ApiResponse<T> = await res.json().catch(() => ({ success: false, error: 'Erreur réseau' }))
  if (!json.success) {
    throw new Error(json.error ?? 'Erreur inconnue')
  }
  return json.data as T
}

async function apiPatch<T>(url: string, body: unknown): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...getAuthHeaders(),
  }
  const res = await fetch(url, {
    method: 'PATCH',
    headers,
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    handleAuthError(res.status)
    const errBody = await res.json().catch(() => ({ error: 'Erreur réseau' }))
    throw new Error(errBody.error ?? `Erreur ${res.status}`)
  }
  const json: ApiResponse<T> = await res.json().catch(() => ({ success: false, error: 'Erreur réseau' }))
  if (!json.success) {
    throw new Error(json.error ?? 'Erreur inconnue')
  }
  return json.data as T
}

async function apiDelete<T>(url: string): Promise<T> {
  const headers = getAuthHeaders()
  const res = await fetch(url, { method: 'DELETE', headers })
  if (!res.ok) {
    handleAuthError(res.status)
    const body = await res.json().catch(() => ({ error: 'Erreur réseau' }))
    throw new Error(body.error ?? `Erreur ${res.status}`)
  }
  const json: ApiResponse<T> = await res.json().catch(() => ({ success: false, error: 'Erreur réseau' }))
  if (!json.success) {
    throw new Error(json.error ?? 'Erreur inconnue')
  }
  return json.data as T
}

function buildQueryString(params?: Record<string, unknown>): string {
  if (!params) return ''
  const entries = Object.entries(params).filter(
    ([, v]) => v !== undefined && v !== null && v !== '',
  )
  if (entries.length === 0) return ''
  const sp = new URLSearchParams()
  for (const [k, v] of entries) {
    sp.set(k, String(v))
  }
  return `?${sp.toString()}`
}

// ─── Query Hooks (GET) ─────────────────────────────────────────────────────────

/**
 * Fetch platform analytics (admin dashboard).
 * GET /api/mova/analytics
 */
export function useAnalytics(options?: Partial<UseQueryOptions<AnalyticsData>>) {
  return useQuery({
    queryKey: queryKeys.analytics,
    queryFn: () => apiGet<AnalyticsData>('/api/mova/analytics'),
    ...options,
  })
}

/**
 * Fetch active zones.
 * GET /api/mova/zones
 */
export function useZones(options?: Partial<UseQueryOptions<ZoneData[]>>) {
  return useQuery({
    queryKey: queryKeys.zones,
    queryFn: () => apiGet<ZoneData[]>('/api/mova/zones'),
    staleTime: 5 * 60_000, // zones change rarely
    ...options,
  })
}

/**
 * Fetch rides list with optional filters.
 * GET /api/mova/rides?status=&zone=&passengerId=&driverId=&limit=&offset=
 */
export function useRides(
  params?: RidesQueryParams,
  options?: Partial<UseQueryOptions<RidesResponse>>,
) {
  const qs = buildQueryString(params as Record<string, unknown>)
  return useQuery({
    queryKey: queryKeys.rides(params),
    queryFn: () => apiGet<RidesResponse>(`/api/mova/rides${qs}`),
    ...options,
  })
}

/**
 * Fetch a single ride by ID.
 * GET /api/mova/rides/[id]
 */
export function useRide(
  id: string,
  options?: Partial<UseQueryOptions<RideData>>,
) {
  return useQuery({
    queryKey: queryKeys.ride(id),
    queryFn: () => apiGet<RideData>(`/api/mova/rides/${id}`),
    enabled: !!id,
    ...options,
  })
}

/**
 * Fetch drivers list with optional filters.
 * GET /api/mova/drivers?zone=&online=
 */
export function useDrivers(
  params?: DriversQueryParams,
  options?: Partial<UseQueryOptions<DriverData[]>>,
) {
  const qs = buildQueryString(params as Record<string, unknown>)
  return useQuery({
    queryKey: queryKeys.drivers(params),
    queryFn: () => apiGet<DriverData[]>(`/api/mova/drivers${qs}`),
    ...options,
  })
}

/**
 * Fetch wallet data for a user.
 * GET /api/mova/wallet?userId=xxx
 */
export function useWallet(
  userId: string,
  options?: Partial<UseQueryOptions<WalletData>>,
) {
  return useQuery({
    queryKey: queryKeys.wallet(userId),
    queryFn: () => apiGet<WalletData>(`/api/mova/wallet?userId=${userId}`),
    enabled: !!userId,
    ...options,
  })
}

/**
 * Fetch bookings list with optional filters.
 * GET /api/mova/bookings?passengerId=&status=&limit=&offset=
 */
export function useBookings(
  params?: BookingsQueryParams,
  options?: Partial<UseQueryOptions<PaginatedResponse<BookingData>>>,
) {
  const qs = buildQueryString(params as Record<string, unknown>)
  return useQuery({
    queryKey: queryKeys.bookings(params),
    queryFn: async () => {
      const headers = getAuthHeaders()
      const res = await fetch(`/api/mova/bookings${qs}`, { headers })
      if (!res.ok) {
        handleAuthError(res.status)
        const body = await res.json().catch(() => ({ error: 'Erreur reseau' }))
        throw new Error(body.error ?? `Erreur ${res.status}`)
      }
      return res.json() as Promise<PaginatedResponse<BookingData>>
    },
    ...options,
  })
}

/**
 * Fetch deliveries list with optional filters.
 * GET /api/mova/deliveries?senderId=&status=&limit=&offset=
 */
export function useDeliveries(
  params?: DeliveriesQueryParams,
  options?: Partial<UseQueryOptions<PaginatedResponse<DeliveryData>>>,
) {
  const qs = buildQueryString(params as Record<string, unknown>)
  return useQuery({
    queryKey: queryKeys.deliveries(params),
    queryFn: async () => {
      const headers = getAuthHeaders()
      const res = await fetch(`/api/mova/deliveries${qs}`, { headers })
      if (!res.ok) {
        handleAuthError(res.status)
        const body = await res.json().catch(() => ({ error: 'Erreur reseau' }))
        throw new Error(body.error ?? `Erreur ${res.status}`)
      }
      return res.json() as Promise<PaginatedResponse<DeliveryData>>
    },
    ...options,
  })
}

/**
 * Fetch incidents list with optional filters.
 * GET /api/mova/incidents?status=&type=&severity=&reporterId=&limit=&offset=
 */
export function useIncidents(
  params?: IncidentsQueryParams,
  options?: Partial<UseQueryOptions<PaginatedResponse<IncidentData>>>,
) {
  const qs = buildQueryString(params as Record<string, unknown>)
  return useQuery({
    queryKey: queryKeys.incidents(params),
    queryFn: async () => {
      const headers = getAuthHeaders()
      const res = await fetch(`/api/mova/incidents${qs}`, { headers })
      if (!res.ok) {
        handleAuthError(res.status)
        const body = await res.json().catch(() => ({ error: 'Erreur reseau' }))
        throw new Error(body.error ?? `Erreur ${res.status}`)
      }
      return res.json() as Promise<PaginatedResponse<IncidentData>>
    },
    ...options,
  })
}

/**
 * Fetch promotions list, optionally filtered to active only.
 * GET /api/mova/promotions?active=true
 */
export function usePromotions(
  active?: boolean,
  options?: Partial<UseQueryOptions<PromotionData[]>>,
) {
  const qs = active !== undefined ? `?active=${active}` : ''
  return useQuery({
    queryKey: queryKeys.promotions(active),
    queryFn: () => apiGet<PromotionData[]>(`/api/mova/promotions${qs}`),
    ...options,
  })
}

/**
 * Fetch user-specific promotion redemptions.
 * GET /api/mova/promotions/user/[userId]
 */
export function useUserPromotions(
  userId: string,
  options?: Partial<UseQueryOptions<UserPromotionsData>>,
) {
  return useQuery({
    queryKey: queryKeys.userPromotions(userId),
    queryFn: () => apiGet<UserPromotionsData>(`/api/mova/promotions/user/${userId}`),
    enabled: !!userId,
    ...options,
  })
}

/**
 * Fetch referral data for a user.
 * GET /api/mova/referrals?userId=xxx
 */
export function useReferrals(
  userId: string,
  options?: Partial<UseQueryOptions<ReferralsData>>,
) {
  return useQuery({
    queryKey: queryKeys.referrals(userId),
    queryFn: () => apiGet<ReferralsData>(`/api/mova/referrals?userId=${userId}`),
    enabled: !!userId,
    ...options,
  })
}

/**
 * Fetch referral leaderboard (top 10).
 * GET /api/mova/referrals/leaderboard
 */
export function useReferralLeaderboard(
  options?: Partial<UseQueryOptions<ReferralLeaderboardEntry[]>>,
) {
  return useQuery({
    queryKey: queryKeys.referralLeaderboard,
    queryFn: () => apiGet<ReferralLeaderboardEntry[]>('/api/mova/referrals/leaderboard'),
    ...options,
  })
}

/**
 * Fetch business account data.
 * GET /api/mova/business?businessId=xxx
 */
export function useBusiness(
  businessId: string,
  options?: Partial<UseQueryOptions<BusinessData>>,
) {
  return useQuery({
    queryKey: queryKeys.business(businessId),
    queryFn: () => apiGet<BusinessData>(`/api/mova/business?businessId=${businessId}`),
    enabled: !!businessId,
    ...options,
  })
}

/**
 * Fetch business analytics.
 * GET /api/mova/business/[businessId]/analytics
 */
export function useBusinessAnalytics(
  businessId: string,
  options?: Partial<UseQueryOptions<BusinessAnalyticsData>>,
) {
  return useQuery({
    queryKey: queryKeys.businessAnalytics(businessId),
    queryFn: () =>
      apiGet<BusinessAnalyticsData>(`/api/mova/business/${businessId}/analytics`),
    enabled: !!businessId,
    ...options,
  })
}

/**
 * Poll mobile money payment status.
 * GET /api/mova/payments/mobile-money?transactionId=xxx
 */
export function usePaymentStatus(
  transactionId: string,
  options?: Partial<UseQueryOptions<MobileMoneyPaymentStatus>>,
) {
  return useQuery({
    queryKey: queryKeys.paymentStatus(transactionId),
    queryFn: () =>
      apiGet<MobileMoneyPaymentStatus>(
        `/api/mova/payments/mobile-money?transactionId=${transactionId}`,
      ),
    enabled: !!transactionId,
    refetchInterval: (query) => {
      const data = query.state.data
      if (!data) return 2_000
      return data.status === 'processing' ? 2_000 : false
    },
    ...options,
  })
}

// ─── Mutation Hooks (POST / PATCH / DELETE) ───────────────────────────────────

type MutationContext = unknown

/**
 * Create a new ride.
 * POST /api/mova/rides
 */
export function useCreateRide(
  options?: UseMutationOptions<RideData, Error, CreateRideInput, MutationContext>,
) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateRideInput) =>
      apiPost<RideData>('/api/mova/rides', input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.rides() })
    },
    ...options,
  })
}

/**
 * Update an existing ride (status, fare, ratings, etc.).
 * PATCH /api/mova/rides/[id]
 */
export function useUpdateRide(
  options?: UseMutationOptions<
    RideData,
    Error,
    { id: string; data: UpdateRideInput },
    MutationContext
  >,
) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateRideInput }) =>
      apiPatch<RideData>(`/api/mova/rides/${id}`, data),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: queryKeys.ride(variables.id) })
      qc.invalidateQueries({ queryKey: queryKeys.rides() })
      qc.invalidateQueries({ queryKey: queryKeys.analytics })
    },
    ...options,
  })
}

/**
 * Update driver status (online/offline, location, zone).
 * PATCH /api/mova/drivers/[id]
 */
export function useUpdateDriver(
  options?: UseMutationOptions<
    DriverData,
    Error,
    { id: string; data: UpdateDriverInput },
    MutationContext
  >,
) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateDriverInput }) =>
      apiPatch<DriverData>(`/api/mova/drivers/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.drivers() })
      qc.invalidateQueries({ queryKey: queryKeys.analytics })
    },
    ...options,
  })
}

/**
 * Create a scheduled booking.
 * POST /api/mova/bookings
 */
export function useCreateBooking(
  options?: UseMutationOptions<BookingData, Error, CreateBookingInput, MutationContext>,
) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateBookingInput) =>
      apiPost<BookingData>('/api/mova/bookings', input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.bookings() })
    },
    ...options,
  })
}

/**
 * Update a booking status.
 * PATCH /api/mova/bookings/[id]
 */
export function useUpdateBooking(
  options?: UseMutationOptions<
    BookingData,
    Error,
    { id: string; data: UpdateBookingInput },
    MutationContext
  >,
) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateBookingInput }) =>
      apiPatch<BookingData>(`/api/mova/bookings/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.bookings() })
    },
    ...options,
  })
}

/**
 * Create a new delivery.
 * POST /api/mova/deliveries
 */
export function useCreateDelivery(
  options?: UseMutationOptions<
    CreateDeliveryResponse,
    Error,
    CreateDeliveryInput,
    MutationContext
  >,
) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateDeliveryInput) =>
      apiPost<CreateDeliveryResponse>('/api/mova/deliveries', input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.deliveries() })
    },
    ...options,
  })
}

/**
 * Update a delivery (status, courier, photo).
 * PATCH /api/mova/deliveries/[id]
 */
export function useUpdateDelivery(
  options?: UseMutationOptions<
    DeliveryData,
    Error,
    { id: string; data: UpdateDeliveryInput },
    MutationContext
  >,
) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateDeliveryInput }) =>
      apiPatch<DeliveryData>(`/api/mova/deliveries/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.deliveries() })
    },
    ...options,
  })
}

/**
 * Top up a wallet.
 * POST /api/mova/wallet
 */
export function useWalletTopUp(
  options?: UseMutationOptions<
    WalletTopUpResponse,
    Error,
    WalletTopUpInput,
    MutationContext
  >,
) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: WalletTopUpInput) =>
      apiPost<WalletTopUpResponse>('/api/mova/wallet', input),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: queryKeys.wallet(variables.userId) })
    },
    ...options,
  })
}

/**
 * Transfer wallet funds between users.
 * POST /api/mova/wallet/transfer
 */
export function useWalletTransfer(
  options?: UseMutationOptions<
    WalletTransferResponse,
    Error,
    WalletTransferInput,
    MutationContext
  >,
) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: WalletTransferInput) =>
      apiPost<WalletTransferResponse>('/api/mova/wallet/transfer', input),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: queryKeys.wallet(variables.fromUserId) })
      qc.invalidateQueries({ queryKey: queryKeys.wallet(variables.toUserId) })
    },
    ...options,
  })
}

/**
 * Redeem a promotion code.
 * POST /api/mova/promotions
 */
export function useRedeemPromotion(
  options?: UseMutationOptions<
    RedeemPromotionResponse,
    Error,
    RedeemPromotionInput,
    MutationContext
  >,
) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: RedeemPromotionInput) =>
      apiPost<RedeemPromotionResponse>('/api/mova/promotions', input),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: queryKeys.userPromotions(variables.userId) })
      qc.invalidateQueries({ queryKey: queryKeys.promotions() })
    },
    ...options,
  })
}

/**
 * Create a referral (a user applies a referral code).
 * POST /api/mova/referrals
 */
export function useCreateReferral(
  options?: UseMutationOptions<
    CreateReferralResponse,
    Error,
    CreateReferralInput,
    MutationContext
  >,
) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateReferralInput) =>
      apiPost<CreateReferralResponse>('/api/mova/referrals', input),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: queryKeys.referrals(variables.referrerId) })
      qc.invalidateQueries({ queryKey: queryKeys.referralLeaderboard })
    },
    ...options,
  })
}

/**
 * Report an incident.
 * POST /api/mova/incidents
 */
export function useReportIncident(
  options?: UseMutationOptions<
    IncidentData,
    Error,
    ReportIncidentInput,
    MutationContext
  >,
) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: ReportIncidentInput) =>
      apiPost<IncidentData>('/api/mova/incidents', input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.incidents() })
    },
    ...options,
  })
}

/**
 * Update an incident (status, resolution).
 * PATCH /api/mova/incidents/[id]
 */
export function useUpdateIncident(
  options?: UseMutationOptions<
    IncidentData,
    Error,
    { id: string; data: UpdateIncidentInput },
    MutationContext
  >,
) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateIncidentInput }) =>
      apiPatch<IncidentData>(`/api/mova/incidents/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.incidents() })
    },
    ...options,
  })
}

/**
 * Update a zone (activate/deactivate).
 * PATCH /api/mova/zones/[id]
 */
export function useUpdateZone(
  options?: UseMutationOptions<
    ZoneData,
    Error,
    { id: string; data: UpdateZoneInput },
    MutationContext
  >,
) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateZoneInput }) =>
      apiPatch<ZoneData>(`/api/mova/zones/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.zones })
    },
    ...options,
  })
}

/**
 * Create a business account.
 * POST /api/mova/business
 */
export function useCreateBusiness(
  options?: UseMutationOptions<BusinessData, Error, CreateBusinessInput, MutationContext>,
) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateBusinessInput) =>
      apiPost<BusinessData>('/api/mova/business', input),
    ...options,
  })
}

/**
 * Calculate dynamic pricing for a ride.
 * POST /api/mova/pricing
 */
export function useCalculatePricing(
  options?: UseMutationOptions<PricingData, Error, PricingInput, MutationContext>,
) {
  return useMutation({
    mutationFn: (input: PricingInput) =>
      apiPost<PricingData>('/api/mova/pricing', input),
    ...options,
  })
}

/**
 * Send a message to the MOVA AI assistant.
 * POST /api/mova/assistant
 */
export function useSendMessage(
  options?: UseMutationOptions<AssistantResponse, Error, SendMessageInput, MutationContext>,
) {
  return useMutation({
    mutationFn: (input: SendMessageInput) =>
      apiPost<AssistantResponse>('/api/mova/assistant', input),
    ...options,
  })
}

/**
 * Clear assistant conversation history.
 * DELETE /api/mova/assistant?userId=xxx
 */
export function useClearConversation(
  options?: UseMutationOptions<{ message: string }, Error, string, MutationContext>,
) {
  return useMutation({
    mutationFn: (userId: string) =>
      apiDelete<{ message: string }>(`/api/mova/assistant?userId=${userId}`),
    ...options,
  })
}

/**
 * Initiate a mobile money payment.
 * POST /api/mova/payments/mobile-money
 */
export function useMobileMoneyPayment(
  options?: UseMutationOptions<
    MobileMoneyPaymentResponse,
    Error,
    MobileMoneyPaymentInput,
    MutationContext
  >,
) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: MobileMoneyPaymentInput) =>
      apiPost<MobileMoneyPaymentResponse>('/api/mova/payments/mobile-money', input),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: queryKeys.wallet(variables.userId) })
    },
    ...options,
  })
}
