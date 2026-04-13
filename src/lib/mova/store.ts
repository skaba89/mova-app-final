import { create } from "zustand"

export type View = "landing" | "passenger" | "driver" | "admin" | "auth" | "wallet" | "corporate" | "delivery" | "carpool" | "hub" | "moto" | "intercity" | "school" | "promotions" | "referral" | "profile" | "settings" | "support" | "beta" | "marketplace" | "carrental" | "transfer" | "navigation"

export interface User {
  id: string
  name: string
  email: string
  phone: string
  role: "passenger" | "driver" | "livreur" | "admin"
  avatar?: string | null
  isOnline: boolean
  rating: number
  totalRides: number
  zone?: string | null
  currentLat?: number | null
  currentLng?: number | null
  createdAt?: string | null
}

export interface Ride {
  id: string
  status: "pending" | "accepted" | "in_progress" | "completed" | "cancelled"
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
  passengerRating?: number | null
  driverRating?: number | null
  passengerNote?: string | null
  driverNote?: string | null
  startedAt?: string | null
  completedAt?: string | null
  cancelledAt?: string | null
  createdAt: string
  passenger?: User
  driver?: User
  vehicle?: {
    id: string
    type: string
    brand: string
    model: string
    plate: string
    color?: string | null
  } | null
}

export interface Zone {
  id: string
  name: string
  nameFr: string
  lat: number
  lng: number
  radius: number
}

export interface AppStats {
  totalRides: number
  activeDrivers: number
  totalPassengers: number
  totalRevenue: number
  averageRating: number
}

interface AppState {
  // Navigation
  currentView: View
  previousView: View
  history: string[]
  setView: (view: View) => void
  goBack: () => void

  // Auth
  user: User | null
  isAuthenticated: boolean
  token: string | null
  setUser: (user: User | null) => void
  setToken: (token: string | null) => void
  loginAs: (role: "passenger" | "driver" | "livreur" | "admin") => void
  logout: () => void

  // Booking
  pickupAddress: string
  dropoffAddress: string
  selectedVehicleType: "standard" | "premium" | "van" | "moto"
  estimatedFare: number | null
  currentRide: Ride | null
  rideHistory: Ride[]
  setPickupAddress: (address: string) => void
  setDropoffAddress: (address: string) => void
  setSelectedVehicleType: (type: "standard" | "premium" | "van" | "moto") => void
  setEstimatedFare: (fare: number | null) => void
  setCurrentRide: (ride: Ride | null) => void
  setRideHistory: (rides: Ride[]) => void

  // Driver
  isDriverOnline: boolean
  availableRides: Ride[]
  driverEarnings: number
  setIsDriverOnline: (online: boolean) => void
  setAvailableRides: (rides: Ride[]) => void
  setDriverEarnings: (earnings: number) => void

  // Admin
  stats: AppStats
  allRides: Ride[]
  allDrivers: User[]
  allPassengers: User[]
  zones: Zone[]
  setStats: (stats: AppStats) => void
  setAllRides: (rides: Ride[]) => void
  setAllDrivers: (drivers: User[]) => void
  setAllPassengers: (passengers: User[]) => void
  setZones: (zones: Zone[]) => void

  // Notifications
  notifications: Array<{
    id: string
    type: 'ride' | 'delivery' | 'rating' | 'system' | 'promo' | 'safety'
    category: 'courses' | 'livraisons' | 'systeme'
    title: string
    description: string
    timestamp: Date
    read: boolean
  }>
  addNotification: (notification: AppState['notifications'][0]) => void
  removeNotification: (id: string) => void
  markNotificationRead: (id: string) => void
  markAllNotificationsRead: () => void
  clearNotifications: () => void

  // Scheduled Rides
  scheduledRides: Array<{
    id: string
    pickupAddress: string
    dropoffAddress: string
    date: string
    time: string
    recurring: string
    vehicleType: string
  }>
  addScheduledRide: (ride: AppState['scheduledRides'][0]) => void
  removeScheduledRide: (id: string) => void
  setScheduledRides: (rides: AppState['scheduledRides']) => void

  // Promo
  promoCode: string
  promoApplied: boolean
  promoDiscount: number
  setPromoCode: (code: string) => void
  setPromoApplied: (applied: boolean) => void
  setPromoDiscount: (discount: number) => void
  clearPromo: () => void

  // Loyalty
  loyaltyPoints: number
  loyaltyTier: 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond'
  loyaltyTransactions: Array<{
    id: string
    type: 'earned' | 'spent' | 'bonus'
    points: number
    description: string
    timestamp: string
  }>
  loyaltyStreak: number
  setLoyaltyPoints: (points: number) => void
  addLoyaltyTransaction: (tx: AppState['loyaltyTransactions'][0]) => void
  setLoyaltyTier: (tier: AppState['loyaltyTier']) => void
  setLoyaltyStreak: (streak: number) => void

  // Navigation extras
  pendingViewTab: string | null
  setPendingViewTab: (tab: string | null) => void

  // UI
  isLoading: boolean
  sidebarOpen: boolean
  setIsLoading: (loading: boolean) => void
  setSidebarOpen: (open: boolean) => void

  // Locale
  locale: 'fr' | 'pul' | 'sus'
  setLocale: (locale: 'fr' | 'pul' | 'sus') => void
}

export const useAppStore = create<AppState>((set) => ({
  // Navigation
  currentView: "landing",
  previousView: "landing",
  history: [],
  setView: (view) =>
    set((state) => ({
      currentView: view,
      previousView: state.currentView,
      history: [...state.history.slice(-10), state.currentView],
    })),
  goBack: () =>
    set((state) => {
      const previousViews = state.history
      if (previousViews.length > 0) {
        const newHistory = [...previousViews]
        const lastView = newHistory.pop()!
        return { currentView: lastView as View, previousView: state.currentView, history: newHistory }
      }
      return { currentView: 'hub', previousView: state.currentView }
    }),

  // Auth
  user: null,
  isAuthenticated: false,
  token: null,
  setUser: (user) => set({ user, isAuthenticated: !!user }),
  setToken: (token) => set({ token }),
  loginAs: (role) => set({ isAuthenticated: true, user: { id: "demo", name: role === "admin" ? "Admin MOVA" : role === "driver" ? "Mamadou Diallo" : "Abdoulaye Camara", email: `${role}@mova.gn`, phone: "+224621000000", role, isOnline: true, rating: 4.8, totalRides: 50, zone: "Kaloum" } }),
  logout: () => set({
    user: null,
    isAuthenticated: false,
    token: null,
    currentView: "landing",
    previousView: "landing",
    history: [],
    currentRide: null,
    rideHistory: [],
    promoCode: '',
    promoApplied: false,
    promoDiscount: 0,
    scheduledRides: [],
    notifications: [],
    loyaltyPoints: 0,
    loyaltyTier: 'bronze',
    loyaltyTransactions: [],
    loyaltyStreak: 0,
    driverEarnings: 0,
    availableRides: [],
    stats: { totalRides: 0, activeDrivers: 0, totalPassengers: 0, totalRevenue: 0, averageRating: 0 },
    allRides: [],
    allDrivers: [],
    allPassengers: [],
    zones: [],
  }),

  // Booking
  pickupAddress: "",
  dropoffAddress: "",
  selectedVehicleType: "standard",
  estimatedFare: null,
  currentRide: null,
  rideHistory: [],
  setPickupAddress: (pickupAddress) => set({ pickupAddress }),
  setDropoffAddress: (dropoffAddress) => set({ dropoffAddress }),
  setSelectedVehicleType: (selectedVehicleType) => set({ selectedVehicleType }),
  setEstimatedFare: (estimatedFare) => set({ estimatedFare }),
  setCurrentRide: (currentRide) => set({ currentRide }),
  setRideHistory: (rideHistory) => set({ rideHistory }),

  // Driver
  isDriverOnline: false,
  availableRides: [],
  driverEarnings: 0,
  setIsDriverOnline: (isDriverOnline) => set({ isDriverOnline }),
  setAvailableRides: (availableRides) => set({ availableRides }),
  setDriverEarnings: (driverEarnings) => set({ driverEarnings }),

  // Admin
  stats: { totalRides: 0, activeDrivers: 0, totalPassengers: 0, totalRevenue: 0, averageRating: 0 },
  allRides: [],
  allDrivers: [],
  allPassengers: [],
  zones: [],
  setStats: (stats) => set({ stats }),
  setAllRides: (allRides) => set({ allRides }),
  setAllDrivers: (allDrivers) => set({ allDrivers }),
  setAllPassengers: (allPassengers) => set({ allPassengers }),
  setZones: (zones) => set({ zones }),

  // Notifications
  notifications: [],
  addNotification: (notification) => set((state) => ({
    notifications: [notification, ...state.notifications]
  })),
  removeNotification: (id) => set((state) => ({
    notifications: state.notifications.filter((n) => n.id !== id)
  })),
  markNotificationRead: (id) => set((state) => ({
    notifications: state.notifications.map((n) => n.id === id ? { ...n, read: true } : n)
  })),
  markAllNotificationsRead: () => set((state) => ({
    notifications: state.notifications.map((n) => ({ ...n, read: true }))
  })),
  clearNotifications: () => set({ notifications: [] }),

  // Scheduled Rides
  scheduledRides: [],
  addScheduledRide: (ride) => set((state) => ({
    scheduledRides: [...state.scheduledRides, ride]
  })),
  removeScheduledRide: (id) => set((state) => ({
    scheduledRides: state.scheduledRides.filter((r) => r.id !== id)
  })),
  setScheduledRides: (rides) => set({ scheduledRides: rides }),

  // Promo
  promoCode: '',
  promoApplied: false,
  promoDiscount: 0,
  setPromoCode: (code) => set({ promoCode: code }),
  setPromoApplied: (applied) => set({ promoApplied: applied }),
  setPromoDiscount: (discount) => set({ promoDiscount: discount }),
  clearPromo: () => set({ promoCode: '', promoApplied: false, promoDiscount: 0 }),

  // Loyalty
  loyaltyPoints: 0,
  loyaltyTier: 'bronze',
  loyaltyTransactions: [],
  loyaltyStreak: 0,
  setLoyaltyPoints: (points) => set({ loyaltyPoints: points }),
  addLoyaltyTransaction: (tx) => set((state) => ({ loyaltyTransactions: [tx, ...state.loyaltyTransactions] })),
  setLoyaltyTier: (tier) => set({ loyaltyTier: tier }),
  setLoyaltyStreak: (streak) => set({ loyaltyStreak: streak }),

  // Navigation extras
  pendingViewTab: null,
  setPendingViewTab: (tab) => set({ pendingViewTab: tab }),

  // UI
  isLoading: false,
  sidebarOpen: false,
  setIsLoading: (isLoading) => set({ isLoading }),
  setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),

  // Locale
  locale: ((typeof window !== 'undefined' ? localStorage.getItem('mova-locale') : null) as 'fr' | 'pul' | 'sus' | null) ?? 'fr',
  setLocale: (locale) => {
    if (typeof window !== 'undefined') localStorage.setItem('mova-locale', locale)
    set({ locale })
  },
}))
