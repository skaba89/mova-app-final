// ─── Generic API Response Wrapper ───────────────────────────────────────────────

export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
}

export interface PaginatedResponse<T> {
  success: boolean
  data: T[]
  pagination: Pagination
  error?: string
}

export interface Pagination {
  total: number
  limit: number
  offset: number
  hasMore: boolean
}

// ─── User / Driver / Passenger ─────────────────────────────────────────────────

export interface UserBasic {
  id: string
  name: string
  phone: string
  avatar?: string | null
  rating?: number | null
  email?: string
}

export interface DriverData {
  id: string
  name: string
  phone: string
  email: string
  avatar?: string | null
  rating?: number | null
  role: 'driver'
  isOnline: boolean
  isActive?: boolean
  zone?: string | null
  currentLat?: number | null
  currentLng?: number | null
  vehicles: VehicleData[]
  completedRides?: number
}

export interface VehicleData {
  id: string
  type: string
  make?: string
  model?: string
  year?: number
  color?: string
  plateNumber?: string
  isActive: boolean
}

// ─── Ride ──────────────────────────────────────────────────────────────────────

export interface RideData {
  id: string
  passengerId: string
  driverId?: string | null
  vehicleId?: string | null
  pickupAddress: string
  pickupLat: number
  pickupLng: number
  pickupZone: string
  dropoffAddress: string
  dropoffLat: number
  dropoffLng: number
  dropoffZone: string
  estimatedFare: number
  actualFare?: number | null
  distance?: number | null
  duration?: number | null
  status: RideStatus
  passengerRating?: number | null
  driverRating?: number | null
  passengerNote?: string | null
  driverNote?: string | null
  startedAt?: Date | string | null
  completedAt?: Date | string | null
  cancelledAt?: Date | string | null
  createdAt: Date | string
  passenger?: UserBasic
  driver?: DriverData & { ridesAsDriver?: unknown }
  vehicle?: VehicleData
  payments?: PaymentData[]
}

export type RideStatus =
  | 'pending'
  | 'accepted'
  | 'in_progress'
  | 'completed'
  | 'cancelled'

export interface RidesResponse {
  rides: RideData[]
  total: number
  pagination: Pagination
}

export interface CreateRideInput {
  passengerId: string
  pickupAddress: string
  pickupLat?: number | string
  pickupLng?: number | string
  pickupZone?: string
  dropoffAddress: string
  dropoffLat?: number | string
  dropoffLng?: number | string
  dropoffZone?: string
  estimatedFare?: number | string
  preferences?: {
    silent?: boolean
    luggage?: boolean
    womenOnly?: boolean
    splitFare?: boolean
    priceLock?: boolean
    temperature?: number
  }
}

export interface UpdateRideInput {
  status?: RideStatus
  driverId?: string
  vehicleId?: string
  actualFare?: number | string
  distance?: number | string
  duration?: number | string
  passengerRating?: number | string
  driverRating?: number | string
  passengerNote?: string
  driverNote?: string
}

export interface RidesQueryParams {
  status?: string
  zone?: string
  passengerId?: string
  driverId?: string
  limit?: number
  offset?: number
}

// ─── Driver Query ──────────────────────────────────────────────────────────────

export interface DriversQueryParams {
  zone?: string
  online?: boolean
}

export interface UpdateDriverInput {
  isOnline?: boolean
  isActive?: boolean
  currentLat?: number | string
  currentLng?: number | string
  zone?: string
  vehicle?: {
    brand?: string
    model?: string
    plate?: string
    color?: string
    year?: string | number
    type?: string
  }
}

// ─── Zone ──────────────────────────────────────────────────────────────────────

export interface ZoneData {
  id: string
  name: string
  description?: string | null
  lat?: number | null
  lng?: number | null
  radius?: number | null
  isActive: boolean
  sortOrder: number
  createdAt: Date | string
}

export interface UpdateZoneInput {
  isActive?: boolean
}

// ─── Analytics ─────────────────────────────────────────────────────────────────

export interface AnalyticsStats {
  totalRides: number
  activeDrivers: number
  totalPassengers: number
  totalRevenue: number
  averageRating: number
}

export interface RevenueByDay {
  day: string
  revenue: number
}

export interface RidesByStatus {
  status: string
  count: number
}

export interface RidesByZone {
  zone: string
  count: number
}

export interface AnalyticsData {
  stats: AnalyticsStats
  recentRides: RideData[]
  revenueByDay: RevenueByDay[]
  ridesByStatus: RidesByStatus[]
  ridesByZone: RidesByZone[]
}

// ─── Wallet ────────────────────────────────────────────────────────────────────

export interface WalletData {
  id: string
  balance: number
  currency: string
  isActive: boolean
  user?: UserBasic
  recentTransactions?: WalletTransactionData[]
}

export interface WalletTransactionData {
  id: string
  walletId: string
  type: 'credit' | 'debit' | 'transfer_in' | 'transfer_out'
  amount: number
  balance: number
  description?: string | null
  method?: string | null
  provider?: string | null
  reference?: string | null
  status: string
  createdAt: Date | string
}

export interface WalletTopUpInput {
  userId: string
  amount: number
  method: 'mobile_money' | 'card' | 'transfer'
  provider?: string
}

export interface WalletTopUpResponse {
  transactionId: string
  type: string
  amount: number
  reference: string
  status: string
  newBalance: number
  currency: string
  createdAt: Date | string
}

export interface WalletTransferInput {
  fromUserId: string
  toUserId: string
  amount: number
}

export interface WalletTransferResponse {
  reference: string
  amount: number
  currency: string
  sender: {
    userId: string
    name?: string | null
    newBalance: number
  }
  recipient: {
    userId: string
    name?: string | null
  }
  debitTransaction: string
  creditTransaction: string
  completedAt: string
}

// ─── Booking ───────────────────────────────────────────────────────────────────

export interface BookingData {
  id: string
  passengerId: string
  vehicleType: string
  pickupAddress: string
  pickupLat: number
  pickupLng: number
  pickupZone: string
  dropoffAddress: string
  dropoffLat: number
  dropoffLng: number
  dropoffZone: string
  scheduledFor: Date | string
  estimatedFare: number
  actualFare?: number | null
  status: BookingStatus
  notes?: string | null
  createdAt: Date | string
  passenger?: UserBasic
  estimatedFareFormatted?: string
}

export type BookingStatus =
  | 'scheduled'
  | 'confirmed'
  | 'in_progress'
  | 'completed'
  | 'cancelled'

export interface CreateBookingInput {
  passengerId: string
  vehicleType?: string
  pickupAddress: string
  pickupLat: number | string
  pickupLng: number | string
  pickupZone: string
  dropoffAddress: string
  dropoffLat: number | string
  dropoffLng: number | string
  dropoffZone: string
  scheduledFor: string
  notes?: string
}

export interface UpdateBookingInput {
  status: BookingStatus
}

export interface BookingsQueryParams {
  passengerId?: string
  status?: string
  limit?: number
  offset?: number
}

// ─── Delivery ──────────────────────────────────────────────────────────────────

export interface DeliveryData {
  id: string
  senderId: string
  courierId?: string | null
  pickupName: string
  pickupPhone: string
  pickupAddress: string
  pickupLat: number
  pickupLng: number
  pickupZone: string
  deliveryName: string
  deliveryPhone: string
  deliveryAddress: string
  deliveryLat: number
  deliveryLng: number
  deliveryZone: string
  packageType: string
  packageSize?: string | null
  weight?: number | null
  declaredValue?: number | null
  status: DeliveryStatus
  estimatedPrice: number
  actualPrice?: number | null
  otp?: string
  deliveryPhoto?: string | null
  startedAt?: Date | string | null
  deliveredAt?: Date | string | null
  createdAt: Date | string
  sender?: UserBasic
  courier?: UserBasic
}

export type DeliveryStatus =
  | 'pending'
  | 'picked_up'
  | 'in_transit'
  | 'delivered'
  | 'cancelled'

export interface CreateDeliveryInput {
  senderId: string
  pickupName: string
  pickupPhone: string
  pickupAddress: string
  pickupLat: number
  pickupLng: number
  pickupZone: string
  deliveryName: string
  deliveryPhone: string
  deliveryAddress: string
  deliveryLat: number
  deliveryLng: number
  deliveryZone: string
  packageType?: string
  packageSize?: string
  weight?: number
  declaredValue?: number
}

export interface UpdateDeliveryInput {
  status: DeliveryStatus
  courierId?: string
  deliveryPhoto?: string
}

export interface DeliveriesQueryParams {
  senderId?: string
  status?: string
  limit?: number
  offset?: number
}

export interface CreateDeliveryResponse {
  id: string
  otp: string
  estimatedPrice: number
  estimatedPriceFormatted: string
  status: string
  pickup: {
    name: string
    phone: string
    address: string
    zone: string
  }
  delivery: {
    name: string
    phone: string
    address: string
    zone: string
  }
  package: {
    type: string
    size?: string | null
    weight?: number | null
    declaredValue?: number | null
  }
  createdAt: Date | string
}

// ─── Incident ──────────────────────────────────────────────────────────────────

export interface IncidentData {
  id: string
  reporterId: string
  reportedId?: string | null
  rideId?: string | null
  deliveryId?: string | null
  type: IncidentType
  severity: IncidentSeverity
  description: string
  status: IncidentStatus
  resolution?: string | null
  createdAt: Date | string
  updatedAt?: Date | string | null
  reporter?: UserBasic
  reported?: UserBasic & { role?: string }
}

export type IncidentType =
  | 'accident'
  | 'dispute'
  | 'damage'
  | 'lost_item'
  | 'safety'
  | 'other'

export type IncidentSeverity = 'low' | 'medium' | 'high' | 'critical'

export type IncidentStatus = 'open' | 'investigating' | 'resolved' | 'closed'

export interface ReportIncidentInput {
  reporterId: string
  rideId?: string
  deliveryId?: string
  reportedId?: string
  type: IncidentType
  severity?: IncidentSeverity
  description: string
}

export interface UpdateIncidentInput {
  status: IncidentStatus
  resolution?: string
}

export interface IncidentsQueryParams {
  status?: string
  type?: string
  severity?: string
  reporterId?: string
  limit?: number
  offset?: number
}

// ─── Promotion ─────────────────────────────────────────────────────────────────

export interface PromotionData {
  id: string
  code: string
  description: string
  discountType: 'percentage' | 'fixed'
  discountValue: number
  minAmount: number
  maxDiscount?: number | null
  usageLimit?: number | null
  usageCount: number
  remainingUses: number | null
  startDate: Date | string
  endDate: Date | string
  isActive: boolean
  totalRedemptions: number
  createdAt: Date | string
}

export interface RedeemPromotionInput {
  code: string
  userId: string
}

export interface RedeemPromotionResponse {
  redemptionId: string
  code: string
  discountType: string
  discountValue: number
  savings: number
  currency: string
  message: string
  redeemedAt: Date | string
}

export interface UserPromotionRedemption {
  id: string
  code: string
  promotion: {
    id: string
    code: string
    description: string
    discountType: string
    discountValue: number
  }
  savings: number
  redeemedAt: Date | string
}

export interface UserPromotionsData {
  redemptions: UserPromotionRedemption[]
  totalRedemptions: number
  totalSavings: number
  currency: string
}

// ─── Referral ──────────────────────────────────────────────────────────────────

export interface ReferralData {
  id: string
  referredUser: {
    id: string
    name: string
    phone: string
  }
  bonusAmount: number
  isPaid: boolean
  referredAt: Date | string
}

export interface ReferralsData {
  user: {
    id: string
    name: string
    memberSince: Date | string
  }
  referralCode: string
  stats: {
    totalReferred: number
    earnedTotal: number
    paidTotal: number
    pendingTotal: number
    currency: string
  }
  referrals: ReferralData[]
}

export interface CreateReferralInput {
  referrerId: string
  code: string
}

export interface CreateReferralResponse {
  referralId: string
  code: string
  referrer: {
    id: string
    name: string
  }
  bonusAmount: number
  currency: string
  isPaid: boolean
  message: string
  createdAt: Date | string
}

export interface ReferralLeaderboardEntry {
  rank: number
  user: {
    id: string
    name: string
    phone?: string | null
    avatar?: string | null
    memberSince: Date | string
  } | null
  totalReferred: number
  totalEarned: number
  totalPaid: number
  referralCode: string | null
}

// ─── Business ──────────────────────────────────────────────────────────────────

export interface BusinessData {
  id: string
  name: string
  email: string
  phone?: string | null
  plan: 'starter' | 'pro' | 'enterprise'
  isActive: boolean
  createdAt: Date | string
  employees: BusinessEmployeeData[]
  employeeCount: number
  costCenters: BusinessCostCenterData[]
  financialSummary: {
    totalBudget: number
    totalSpent: number
    totalRemaining: number
    utilizationPercent: number
    currency: string
  }
}

export interface BusinessEmployeeData {
  id: string
  department: string
  monthlyBudget: number
  user: UserBasic
  costCenter: {
    id: string
    name: string
    budget: number
    spent: number
  } | null
}

export interface BusinessCostCenterData {
  id: string
  name: string
  budget: number
  spent: number
  remaining: number
  employeeCount: number
}

export interface CreateBusinessInput {
  name: string
  email: string
  phone: string
  plan?: 'starter' | 'pro' | 'enterprise'
}

export interface BusinessAnalyticsData {
  business: {
    id: string
    name: string
    plan: string
    memberSince: Date | string
  }
  overview: {
    totalEmployees: number
    activeEmployees: number
    totalRides: number
    totalSpent: number
    totalBudget: number
    budgetUtilization: number
    currency: string
  }
  spendByDepartment: Record<string, number>
  monthlyTrend: {
    month: string
    rides: number
    spend: number
  }[]
  topEmployees: {
    userId: string
    name: string
    department: string
    rides: number
  }[]
  recentRides: {
    id: string
    passenger: string
    pickupZone: string
    dropoffZone: string
    fare: number
    status: string
    scheduledFor: Date | string
    createdAt: Date | string
  }[]
  costCenters: BusinessCostCenterData[]
}

// ─── Pricing ───────────────────────────────────────────────────────────────────

export interface PricingInput {
  pickupZone: string
  dropoffZone: string
  vehicleType?: 'standard' | 'premium' | 'van' | 'moto'
  paymentMethod?: 'cash' | 'wallet' | 'mobile_money'
  weather?: 'normal' | 'rainy'
  scheduledAt?: string
}

export interface FareBreakdown {
  baseFare: number
  distanceFare: number
  distance: number
  duration: number
  timeMultiplier: number
  surgeMultiplier: number
  weatherMultiplier: number
  serviceFee: number
  discount: number
  finalFare: number
}

export interface PricingMeta {
  isSurge: boolean
  surgePercent: number
  savingsWithWallet: number
  priceLockAvailable: boolean
}

export interface PricingData {
  fare: number
  currency: string
  breakdown: FareBreakdown
  meta: PricingMeta
}

// ─── Assistant (Chat) ──────────────────────────────────────────────────────────

export interface SendMessageInput {
  message: string
  context?: {
    userId?: string
    currentView?: string
    lastRide?: string
  }
}

export interface AssistantResponse {
  response: string
  messageCount: number
  fallback?: boolean
}

// ─── Mobile Money Payment ──────────────────────────────────────────────────────

export interface MobileMoneyPaymentInput {
  userId: string
  amount: number
  provider: 'orange_money' | 'mtn'
  phoneNumber: string
  purpose: string
}

export interface MobileMoneyPaymentResponse {
  transactionId: string
  provider: string
  amount: number
  currency: string
  phoneNumber: string
  status: 'processing'
  message: string
  reference: string
  estimatedWaitSeconds: number
}

export interface MobileMoneyPaymentStatus {
  transactionId: string
  provider: string
  amount: number
  currency: string
  phoneNumber: string
  status: 'processing' | 'completed' | 'failed'
  reference: string
  purpose: string
  newBalance?: number
  estimatedWaitRemaining: number
  createdAt: number
  completedAt?: number
}

// ─── Payment (generic) ─────────────────────────────────────────────────────────

export interface PaymentData {
  id: string
  rideId?: string | null
  amount: number
  method: string
  status: string
  reference?: string | null
  provider?: string | null
  createdAt: Date | string
}
