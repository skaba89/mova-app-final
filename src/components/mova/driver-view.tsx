'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useTheme } from 'next-themes'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { useAppStore, type Ride } from '@/lib/mova/store'
import { useNotifications } from '@/lib/mova/use-notifications'
import { useTracking, type RideAvailableData, type NearbyDriver } from '@/hooks/use-tracking'
import { useRides, useUpdateRide, useUpdateDriver, useDrivers } from '@/lib/mova/api-hooks'
import DriverLeaderboard from '@/components/mova/driver-leaderboard'
import NotificationPanel from '@/components/mova/notification-panel'
import { DynamicMovaMap } from '@/components/mova/mova-map'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { Progress } from '@/components/ui/progress'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Bell,
  Car,
  MapPin,
  Navigation,
  Star,
  Clock,
  DollarSign,
  TrendingUp,
  Award,
  Flame,
  Phone,
  MessageCircle,
  Shield,
  FileText,
  Settings,
  LogOut,
  ChevronRight,
  Home,
  Check,
  X,
  Zap,
  Trophy,
  Target,
  BarChart3,
  Wallet,
  CreditCard,
  ArrowUp,
  ArrowDown,
  Route,
  Moon,
  Sun,
  AlertCircle,
  AlertTriangle,
  RefreshCw,
  Wifi,
  WifiOff,
  LocateFixed,
  Users,
} from 'lucide-react'

// ── Constants & Demo Data ───────────────────────────────────────────

import { CONAKRY_COMMUNE_NAMES } from '@/lib/mova/regions'

const DEMO_LOCATIONS = [
  // ── Kaloum ──
  { name: 'Centre-ville Kaloum', zone: 'Kaloum' },
  { name: 'Hotel Riviera', zone: 'Kaloum' },
 { name: 'Sandervalia', zone: 'Kaloum' },
  // ── Dixinn ──
  { name: 'Palais du Peuple', zone: 'Dixinn' },
  { name: 'Belle Vue', zone: 'Dixinn' },
  { name: 'Universite Gammal', zone: 'Dixinn' },
  // ── Matam ──
  { name: 'Marche Madina', zone: 'Matam' },
  { name: 'Coronthie', zone: 'Matam' },
  { name: 'Taady', zone: 'Matam' },
  // ── Ratoma (chef-lieu: Taouyah) ──
  { name: 'Cite des Enseignants', zone: 'Ratoma' },
  { name: 'Taouyah', zone: 'Ratoma' },
  // ── Matoto (chef-lieu: Simbaya 2) ──
  { name: 'Simbaya 2', zone: 'Matoto' },
  { name: 'Koloma', zone: 'Matoto' },
  // ── NEW communes (Law L/2024/003/CNT) ──
  // From Matoto
  { name: 'Aeroport Gbessia', zone: 'Gbessia' },
  { name: 'Tombolia Centre', zone: 'Tombolia' },
  // From Ratoma
  { name: 'Lambanyi Centre', zone: 'Lambanyi' },
  { name: 'Sonfonia Centre', zone: 'Sonfonia' },
  // From Dubreka
  { name: 'Kagbelene Plateau', zone: 'Kagbelene' },
  { name: 'Dubreka Centre', zone: 'Dubreka' },
  // From Maneah
  { name: 'Tanene 1', zone: 'Maneah' },
  { name: 'Sanoyah Km 36', zone: 'Sanoyah' },
]

// Demo fallback rides — used when API returns empty or errors
const DEMO_COMPLETED_RIDES = [
  { id: 'demo-1', pickupAddress: 'Marche Madina', pickupZone: 'Matam', dropoffAddress: 'Aeroport Gbessia', dropoffZone: 'Gbessia', estimatedFare: 15000, actualFare: 15000, distance: 12, duration: 25, completedAt: new Date().toISOString(), passengerRating: 5, driverRating: 5 },
  { id: 'demo-2', pickupAddress: 'Kaloum Centre', pickupZone: 'Kaloum', dropoffAddress: 'Simbaya 2', dropoffZone: 'Matoto', estimatedFare: 8000, actualFare: 8000, distance: 7, duration: 18, completedAt: new Date(Date.now() - 86400000).toISOString(), passengerRating: 4, driverRating: 5 },
  { id: 'demo-3', pickupAddress: 'Cite des Enseignants', pickupZone: 'Ratoma', dropoffAddress: 'Palais du Peuple', dropoffZone: 'Dixinn', estimatedFare: 5000, actualFare: 5500, distance: 4, duration: 12, completedAt: new Date(Date.now() - 172800000).toISOString(), passengerRating: 5, driverRating: 4 },
  { id: 'demo-4', pickupAddress: 'Koloma', pickupZone: 'Matoto', dropoffAddress: 'Hotel Riviera', dropoffZone: 'Kaloum', estimatedFare: 12000, actualFare: 12000, distance: 10, duration: 22, completedAt: new Date(Date.now() - 259200000).toISOString(), passengerRating: 4, driverRating: 5 },
  { id: 'demo-5', pickupAddress: 'Taouyah', pickupZone: 'Ratoma', dropoffAddress: 'Dubreka Centre', dropoffZone: 'Dubreka', estimatedFare: 25000, actualFare: 25000, distance: 22, duration: 45, completedAt: new Date(Date.now() - 345600000).toISOString(), passengerRating: 5, driverRating: 5 },
] as const

// Heatmap zones removed — data comes from /api/mova/zones API

type Mission = {
  id: string
  title: string
  description: string
  progress: number
  target: number
  reward: number
  icon: 'target' | 'dollar' | 'zap' | 'star' | 'route'
  status: 'pending' | 'completed' | 'claimed'
}

type GamificationTier = {
  name: string
  minRides: number
  maxRides: number
  color: string
  bg: string
  perks: string[]
}

const GAMIFICATION_TIERS: GamificationTier[] = [
  { name: 'Bronze', minRides: 0, maxRides: 49, color: 'text-amber-700 dark:text-amber-500', bg: 'bg-amber-100 dark:bg-amber-900/30', perks: ['Commission standard', 'Support email'] },
  { name: 'Argent', minRides: 50, maxRides: 199, color: 'text-gray-500 dark:text-gray-300', bg: 'bg-gray-100 dark:bg-gray-800', perks: ['Commission -5%', 'Support prioritaire', 'Bonus parrainage +20%'] },
  { name: 'Or', minRides: 200, maxRides: 499, color: 'text-amber-500 dark:text-amber-400', bg: 'bg-amber-100 dark:bg-amber-900/30', perks: ['Commission -10%', 'Acces anticipé aux nouvelles fonctionnalités', 'Bonus missions x2'] },
  { name: 'Platine', minRides: 500, maxRides: 9999, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-100 dark:bg-emerald-900/30', perks: ['Commission -15%', 'Support dedie 24/7', 'Retrait gratuit', 'Badge chauffeur elite'] },
]

// localStorage helper for claimed missions
function getClaimedMissions(): Set<string> {
  if (typeof window === 'undefined') return new Set()
  try {
    const stored = localStorage.getItem('mova_claimed_missions')
    return new Set(stored ? JSON.parse(stored) as string[] : [])
  } catch {
    return new Set()
  }
}

function saveClaimedMission(missionId: string) {
  if (typeof window === 'undefined') return
  try {
    const claimed = getClaimedMissions()
    claimed.add(missionId)
    localStorage.setItem('mova_claimed_missions', JSON.stringify([...claimed]))
  } catch {
    // silently fail
  }
}

// Weekly earnings, rides, payment breakdown, and documents removed — data comes from API or is empty

// (GAMIFICATION_TIERS defined above with Mission type)

// ── Helpers ─────────────────────────────────────────────────────────

function formatGNF(amount: number): string {
  return new Intl.NumberFormat('fr-GN').format(amount) + ' GNF'
}

function formatShortGNF(amount: number): string {
  if (amount >= 1000000) return (amount / 1000000).toFixed(1) + 'M'
  if (amount >= 1000) return Math.round(amount / 1000) + 'K'
  return amount.toString()
}

function formatTimer(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (h > 0) return `${h}h${m.toString().padStart(2, '0')}`
  return `${m}min`
}

function formatCountdown(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}min ${s}s`
}

function demandColor(demand: number): string {
  if (demand >= 8) return 'bg-emerald-500'
  if (demand >= 5) return 'bg-amber-500'
  return 'bg-red-400'
}

function demandBg(demand: number): string {
  if (demand >= 8) return 'bg-emerald-100 dark:bg-emerald-900/30'
  if (demand >= 5) return 'bg-amber-100 dark:bg-amber-900/30'
  return 'bg-red-100 dark:bg-red-900/30'
}

// ── Animation Variants ──────────────────────────────────────────────

const tabVariants = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -12 },
}

const cardVariants = {
  initial: { opacity: 0, scale: 0.97 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.97 },
}

const staggerContainer = {
  animate: { transition: { staggerChildren: 0.06 } },
}

const staggerItem = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
}

// ── Sub-Components ──────────────────────────────────────────────────

function StatCard({ icon: Icon, label, value, color = 'emerald', trend }: {
  icon: React.ElementType
  label: string
  value: string | number
  color?: 'emerald' | 'amber'
  trend?: 'up' | 'down'
}) {
  const colorClasses = color === 'emerald'
    ? { iconBg: 'bg-emerald-100 dark:bg-emerald-900/30', iconText: 'text-emerald-600 dark:text-emerald-400', valueText: 'text-emerald-700 dark:text-emerald-400' }
    : { iconBg: 'bg-amber-100 dark:bg-amber-900/30', iconText: 'text-amber-600 dark:text-amber-400', valueText: 'text-amber-700 dark:text-amber-400' }

  return (
    <motion.div variants={staggerItem}>
      <Card className="border-0 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className={`w-11 h-11 rounded-xl ${colorClasses.iconBg} flex items-center justify-center shrink-0`}>
              <Icon className={`w-5 h-5 ${colorClasses.iconText}`} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted-foreground font-medium truncate">{label}</p>
              <div className="flex items-center gap-1.5">
                <p className={`text-xl font-bold ${colorClasses.valueText}`}>{value}</p>
                {trend === 'up' && <ArrowUp className="w-3.5 h-3.5 text-emerald-500" />}
                {trend === 'down' && <ArrowDown className="w-3.5 h-3.5 text-red-500" />}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

// ── Main Component ──────────────────────────────────────────────────

export default function DriverView() {
  const {
    user,
    isDriverOnline,
    driverEarnings,
    setIsDriverOnline,
    setDriverEarnings,
    setView,
    logout,
  } = useAppStore()
  const { unreadCount } = useNotifications()

  // ── API hooks ──
  const currentDriverId = user?.id ?? 'demo'
  const updateRide = useUpdateRide()
  const updateDriver = useUpdateDriver()

  // Fetch driver profile from API for real rating
  const { data: driversData } = useDrivers()
  const apiDriver = useMemo(() => {
    if (!driversData || !Array.isArray(driversData)) return null
    return driversData.find((d) => d.id === currentDriverId) ?? null
  }, [driversData, currentDriverId])
  const apiDriverRating = apiDriver?.rating ?? user?.rating ?? 4.8

  // ── Local state ──
  const [activeTab, setActiveTab] = useState('dashboard')
  const [onlineSeconds, setOnlineSeconds] = useState(16320) // ~4h32
  const [rideTimers, setRideTimers] = useState<Record<string, number>>({})
  const [currentRideStep, setCurrentRideStep] = useState<'pickup' | 'ride' | 'complete'>('pickup')
  const [availableRides, setAvailableRides] = useState<Ride[]>([])
  const [acceptedRide, setAcceptedRide] = useState<Ride | null>(null)
  const [showCurrentRide, setShowCurrentRide] = useState(true)
  const [editVehicle, setEditVehicle] = useState(false)
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const [showNotifications, setShowNotifications] = useState(false)
  const [prefLongDistance, setPrefLongDistance] = useState(true)
  const [prefShared, setPrefShared] = useState(false)
  const [prefSound, setPrefSound] = useState(true)
  const [prefZone, setPrefZone] = useState('ratoma')
  const [showLeaderboard, setShowLeaderboard] = useState(false)
  const [showPayoutDialog, setShowPayoutDialog] = useState(false)
  const [payoutAmount, setPayoutAmount] = useState('')
  const [payoutMethod, setPayoutMethod] = useState('orange_money')
  const [showFullHistory, setShowFullHistory] = useState(false)
  const [historyFilter, setHistoryFilter] = useState('all')

  // ── Tracking service integration ──
  const tracking = useTracking()
  const [nearbyDrivers, setNearbyDrivers] = useState<NearbyDriver[]>([])
  const [nearbyDriversCount, setNearbyDriversCount] = useState(0)
  const [isSharingLocation, setIsSharingLocation] = useState(false)
  const [currentPosition, setCurrentPosition] = useState<{ lat: number; lng: number }>({ lat: 9.5092, lng: -13.7122 })
  const locationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const nearbyIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const geoWatchRef = useRef<number | null>(null)

  // ── Vehicle data ──
  const [vehicleData, setVehicleData] = useState({
    brand: 'Toyota',
    model: 'Corolla',
    plate: 'GX-1234-AB',
    color: 'Blanc',
    year: '2020',
    type: 'Berline',
  })

  // ── Effects ──

  useEffect(() => { queueMicrotask(() => setMounted(true)) }, [])

  // ── Geolocation watch for real coordinates ──
  useEffect(() => {
    if (!isDriverOnline) {
      if (geoWatchRef.current !== null) {
        navigator.geolocation.clearWatch(geoWatchRef.current)
        geoWatchRef.current = null
      }
      return
    }
    if (!navigator.geolocation) return

    geoWatchRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        setCurrentPosition({ lat: pos.coords.latitude, lng: pos.coords.longitude })
      },
      () => {
        // Silently fail - use default Conakry coordinates
      },
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 10000 }
    )

    return () => {
      if (geoWatchRef.current !== null) {
        navigator.geolocation.clearWatch(geoWatchRef.current)
        geoWatchRef.current = null
      }
    }
  }, [isDriverOnline])

  // ── Socket event listeners ──
  useEffect(() => {
    if (!isDriverOnline) {
      tracking.off()
      return
    }

    tracking.on({
      onRideAvailable: (data: RideAvailableData) => {
        // Convert tracking ride data to local Ride format
        const newRide: Ride = {
          id: data.rideId,
          status: 'pending',
          passengerId: data.passengerId,
          pickupAddress: data.pickupZone,
          pickupLat: data.pickupLat,
          pickupLng: data.pickupLng,
          pickupZone: data.pickupZone,
          dropoffAddress: data.dropoffZone,
          dropoffLat: data.dropoffLat,
          dropoffLng: data.dropoffLng,
          dropoffZone: data.dropoffZone,
          estimatedFare: 0,
          distance: 0,
          duration: 0,
          createdAt: new Date(data.requestedAt).toISOString(),
        }
        // Only add if not already in list
        setAvailableRides((prev) => {
          if (prev.some((r) => r.id === data.rideId)) return prev
          const next = [newRide, ...prev]
          // Keep max 10 rides
          return next.slice(0, 10)
        })
        timerIdsRef.current.add(data.rideId)
        queueMicrotask(() => setRideTimers((prev) => ({ ...prev, [data.rideId]: 0 })))
        toast('Nouvelle demande de course', { description: `Course dans la zone ${data.pickupZone}` })
      },

      onRideStatusUpdate: (data) => {
        if (data.status === 'started') {
          queueMicrotask(() => setCurrentRideStep('ride'))
          toast.success('Course demarree', { description: data.message ?? 'Le trajet a commence' })
        } else if (data.status === 'completed') {
          const fare = data.fare ?? 0
          setAcceptedRide(null)
          setShowCurrentRide(false)
          setIsSharingLocation(false)
          if (fare > 0) {
            setDriverEarnings(driverEarnings + fare)
            toast.success('Course terminee !', { description: `+${formatGNF(fare)}` })
          } else {
            toast.success('Course terminee', { description: data.message ?? 'Trajet termine avec succes' })
          }
        } else if (data.status === 'accepted') {
          queueMicrotask(() => setCurrentRideStep('pickup'))
          toast.success('Course acceptee', { description: data.message ?? 'En route vers le passager' })
        }
      },

      onRideCancelled: (data) => {
        if (acceptedRide && acceptedRide.id === data.rideId) {
          setAcceptedRide(null)
          setShowCurrentRide(false)
          setIsSharingLocation(false)
          setCurrentRideStep('pickup')
          toast.info('Course annulee', { description: data.message ?? 'Le passager a annule la course' })
        } else {
          setAvailableRides((prev) => prev.filter((r) => r.id !== data.rideId))
        }
      },

      onDriverNearby: (data) => {
        setNearbyDrivers(data.drivers ?? [])
        setNearbyDriversCount(data.count ?? 0)
      },

      onError: (data) => {
        toast.error('Erreur de connexion', { description: data.message ?? 'Probleme de connexion au service de suivi' })
      },

      onDriverJoined: (data) => {
        if (data.success) {
          toast.success('Connecte au suivi', { description: `Zone: ${data.zone}` })
        } else {
          toast.error('Erreur de suivi', { description: data.message ?? 'Impossible de se connecter au service' })
        }
      },
    })

    return () => {
      tracking.off()
    }
  }, [isDriverOnline])

  // ── Location updates during active ride (every 5 seconds) ──
  useEffect(() => {
    if (!acceptedRide || !isDriverOnline || !tracking.isConnected) {
      if (locationIntervalRef.current) {
        clearInterval(locationIntervalRef.current)
        locationIntervalRef.current = null
        if (!acceptedRide) queueMicrotask(() => setIsSharingLocation(false))
      }
      return
    }

    queueMicrotask(() => setIsSharingLocation(true))
    locationIntervalRef.current = setInterval(() => {
      tracking.updateLocation({
        driverId: currentDriverId,
        lat: currentPosition.lat,
        lng: currentPosition.lng,
      })
    }, 1500)

    // Send initial location immediately
    tracking.updateLocation({
      driverId: currentDriverId,
      lat: currentPosition.lat,
      lng: currentPosition.lng,
    })

    return () => {
      if (locationIntervalRef.current) {
        clearInterval(locationIntervalRef.current)
        locationIntervalRef.current = null
      }
    }
  }, [acceptedRide, isDriverOnline, tracking.isConnected, currentDriverId, currentPosition])

  // ── Nearby drivers: now received via WebSocket push (driver:positions) ──
  // No polling needed — the tracking service pushes updates every 3 seconds

  // ── Cleanup on unmount ──
  useEffect(() => {
    return () => {
      if (locationIntervalRef.current) clearInterval(locationIntervalRef.current)
      if (nearbyIntervalRef.current) clearInterval(nearbyIntervalRef.current)
      if (geoWatchRef.current !== null) navigator.geolocation.clearWatch(geoWatchRef.current)
      tracking.off()
    }
  }, [])

  // Timer for online duration
  useEffect(() => {
    if (!isDriverOnline) return
    const interval = setInterval(() => setOnlineSeconds((p) => p + 1), 1000)
    return () => clearInterval(interval)
  }, [isDriverOnline])

  // Ride countdown timers
  useEffect(() => {
    const interval = setInterval(() => {
      setRideTimers((prev) => {
        const next: Record<string, number> = {}
        for (const [id, s] of Object.entries(prev)) next[id] = s + 1
        return next
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  // Init ride timers when availableRides change
  const timerIdsRef = useRef<Set<string>>(new Set())
  useEffect(() => {
    if (availableRides.length === 0) return
    for (const ride of availableRides) {
      if (!timerIdsRef.current.has(ride.id)) {
        const elapsed = Math.floor((Date.now() - new Date(ride.createdAt).getTime()) / 1000)
        queueMicrotask(() => setRideTimers((prev) => ({ ...prev, [ride.id]: elapsed })))
        timerIdsRef.current.add(ride.id)
      }
    }
  }, [availableRides])

  // Fetch real pending/accepted rides from API when online
  const { data: pendingResponse, isLoading: isLoadingPending, isError: isPendingError, refetch: refetchPending } = useRides({ status: 'pending', limit: 20 })
  const { data: acceptedResponse } = useRides({ status: 'accepted', limit: 20 })

  // Fetch completed rides for earnings/statistics calculation
  const { data: completedResponse, isLoading: isLoadingCompleted, isError: isCompletedError, error: completedError, refetch: refetchCompleted } = useRides({ status: 'completed', driverId: currentDriverId, limit: 50 })

  // Use API data when available, fallback to demo data on error
  const completedRides = completedResponse?.rides?.length
    ? completedResponse.rides
    : isCompletedError
      ? [...DEMO_COMPLETED_RIDES]
      : []

  // Loading/error flags for UI
  const isLoadingRides = isLoadingCompleted
  const ridesError = isCompletedError ? (completedError as Error | null) : null

  // ── Derived earnings data from completed rides ──
  const { computedEarnings, computedWeeklyEarnings, computedPaymentBreakdown, completedRidesCount } = useMemo(() => {
    const dayLabels = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']

    if (completedRides.length === 0) {
      // No completed rides — return zero-based defaults
      return {
        computedEarnings: 0,
        computedWeeklyEarnings: dayLabels.map((day) => ({ day, amount: 0 })),
        computedPaymentBreakdown: [],
        completedRidesCount: 0,
      }
    }

    // Total earnings: sum of actualFare (or estimatedFare if null)
    const totalEarnings = completedRides.reduce((sum, r) => {
      return sum + (r.actualFare ?? r.estimatedFare ?? 0)
    }, 0)

    // Today's earnings: rides completed today
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayEarnings = completedRides
      .filter((r) => {
        const completedDate = r.completedAt ? new Date(r.completedAt) : null
        return completedDate && completedDate >= today
      })
      .reduce((sum, r) => sum + (r.actualFare ?? r.estimatedFare ?? 0), 0)

    // Weekly earnings: group by day of week for the current week (Monday start)
    const now = new Date()
    const dayOfWeek = now.getDay() // 0=Sun, 1=Mon, ...
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
    const monday = new Date(now)
    monday.setDate(now.getDate() + mondayOffset)
    monday.setHours(0, 0, 0, 0)

    const weeklyEarnings = dayLabels.map((day, idx) => {
      const dayStart = new Date(monday)
      dayStart.setDate(monday.getDate() + idx)
      dayStart.setHours(0, 0, 0, 0)
      const dayEnd = new Date(dayStart)
      dayEnd.setDate(dayStart.getDate() + 1)

      const dayTotal = completedRides
        .filter((r) => {
          const completedDate = r.completedAt ? new Date(r.completedAt) : null
          return completedDate && completedDate >= dayStart && completedDate < dayEnd
        })
        .reduce((sum, r) => sum + (r.actualFare ?? r.estimatedFare ?? 0), 0)

      return { day, amount: dayTotal }
    })

    // Payment breakdown: group by payment method
    const methodMap: Record<string, { amount: number; color: string; textColor: string }> = {
      cash: { amount: 0, color: 'bg-amber-500', textColor: 'text-amber-600 dark:text-amber-400' },
      mobile_money: { amount: 0, color: 'bg-orange-500', textColor: 'text-orange-600 dark:text-orange-400' },
      wallet: { amount: 0, color: 'bg-emerald-500', textColor: 'text-emerald-600 dark:text-emerald-400' },
    }

    let hasPaymentData = false
    for (const ride of completedRides) {
      const ridePayments = (ride as Record<string, unknown>).payments as Array<{ method?: string; amount: number }> | undefined
      if (ridePayments && ridePayments.length > 0) {
        hasPaymentData = true
        for (const payment of ridePayments) {
          const method = (payment.method || 'cash').toLowerCase()
          if (methodMap[method]) {
            methodMap[method].amount += payment.amount
          } else {
            methodMap.cash.amount += payment.amount
          }
        }
      }
    }

    const paymentBreakdown = hasPaymentData
      ? Object.entries(methodMap)
          .filter(([, v]) => v.amount > 0)
          .map(([key, v]) => ({
            type: key === 'cash' ? 'Especes' : key === 'mobile_money' ? 'Mobile Money' : 'Portefeuille MOVA',
            amount: v.amount,
            color: v.color,
            textColor: v.textColor,
          }))
      : []

    return {
      computedEarnings: todayEarnings > 0 ? todayEarnings : totalEarnings,
      computedWeeklyEarnings: weeklyEarnings,
      computedPaymentBreakdown: paymentBreakdown,
      completedRidesCount: completedRides.length,
    }
  }, [completedRides])

  // Sync store earnings with computed API earnings
  useEffect(() => {
    if (computedEarnings > 0 && driverEarnings !== computedEarnings) {
      queueMicrotask(() => setDriverEarnings(computedEarnings))
    }
  }, [computedEarnings, driverEarnings, setDriverEarnings])

  // Sync API accepted rides into acceptedRide state
  useEffect(() => {
    const apiAcceptedRides = (acceptedResponse?.rides ?? []) as unknown as Ride[]
    if (apiAcceptedRides.length > 0) {
      const existingId = acceptedRide?.id
      if (!existingId || !apiAcceptedRides.some((r) => r.id === existingId)) {
        queueMicrotask(() => {
          setAcceptedRide(apiAcceptedRides[0])
          setShowCurrentRide(true)
        })
      }
    }
  }, [acceptedResponse?.rides, acceptedRide?.id])

  // Sync API rides with local state (pending rides only)
  useEffect(() => {
    if (isDriverOnline && pendingResponse?.rides?.length) {
      const apiRides = pendingResponse.rides as unknown as Ride[]
      if (apiRides.length > 0) {
        queueMicrotask(() => setAvailableRides(apiRides))
      }
    }
  }, [isDriverOnline, pendingResponse?.rides])

  // Fallback: if API returns no pending rides and not accepted, keep empty
  // (removed mock fallback to MOCK_AVAILABLE_RIDES)

  // Clear available rides when going offline via handler
  useEffect(() => {
    if (!isDriverOnline && availableRides.length > 0) {
      timerIdsRef.current.clear()
      const timer = setTimeout(() => {
        setRideTimers({})
        setAvailableRides([])
      }, 0)
      return () => clearTimeout(timer)
    }
  }, [isDriverOnline, availableRides.length])

  // ── Handlers ──

  const handleToggleOnline = useCallback(() => {
    const next = !isDriverOnline
    // Optimistic UI: toggle immediately
    setIsDriverOnline(next)
    timerIdsRef.current.clear()
    setRideTimers({})

    if (next) {
      toast.success('Vous êtes en ligne', { description: 'Vous recevrez les demandes de course.' })
      // Emit joinAsDriver via tracking service
      if (tracking.isConnected) {
        tracking.joinAsDriver({
          driverId: currentDriverId,
          zone: prefZone,
          lat: currentPosition.lat,
          lng: currentPosition.lng,
          name: user?.name,
          vehicleType: vehicleData.type,
          vehiclePlate: vehicleData.plate,
          rating: apiDriverRating,
        })
      }
    } else {
      toast.info('Vous êtes hors ligne', { description: 'Vous ne recevrez plus de demandes.' })
      // Emit goOffline via tracking service
      if (tracking.isConnected) {
        tracking.goOffline({ driverId: currentDriverId })
      }
      setNearbyDrivers([])
      setNearbyDriversCount(0)
      setIsSharingLocation(false)
    }

    // Persist to API, revert on error
    updateDriver.mutate(
      { id: currentDriverId, data: { isOnline: next } },
      {
        onError: () => {
          // Revert optimistic update
          setIsDriverOnline(isDriverOnline)
          toast.error('Erreur', { description: 'Impossible de changer le statut. Veuillez réessayer.' })
        },
      },
    )
  }, [isDriverOnline, setIsDriverOnline, updateDriver, currentDriverId, tracking, prefZone, currentPosition, user?.name, vehicleData.type, vehicleData.plate, apiDriverRating])

  const handleAcceptRide = useCallback((ride: Ride) => {
    // Emit acceptRide via tracking service first
    if (tracking.isConnected) {
      tracking.acceptRide({ rideId: ride.id, driverId: currentDriverId })
    }
    updateRide.mutate(
      { id: ride.id, data: { status: 'accepted', driverId: currentDriverId } },
      {
        onSuccess: () => {
          setAvailableRides((prev) => prev.filter((r) => r.id !== ride.id))
          setAcceptedRide(ride)
          setShowCurrentRide(true)
          setCurrentRideStep('pickup')
          toast.success('Course acceptée !', { description: `Destination: ${ride.dropoffAddress}` })
        },
        onError: (err) => {
          toast.error('Erreur', { description: err.message || 'Impossible d\'accepter la course' })
        },
      },
    )
  }, [updateRide, currentDriverId, tracking])

  const handleDeclineRide = useCallback((ride: Ride) => {
    updateRide.mutate(
      { id: ride.id, data: { status: 'cancelled' } },
      {
        onSuccess: () => {
          setAvailableRides((prev) => prev.filter((r) => r.id !== ride.id))
          toast('Course refusee', { description: 'Vous ne recevrez plus cette demande.' })
        },
        onError: (err) => {
          toast.error('Erreur', { description: err.message || 'Impossible de refuser la course' })
        },
      },
    )
  }, [updateRide])

  const handleRideAction = useCallback((step: 'pickup' | 'ride' | 'complete') => {
    setCurrentRideStep(step)
    if (step === 'pickup') {
      toast('Vous approchez du point de départ')
    } else if (step === 'ride') {
      // Emit startRide via tracking service
      if (acceptedRide && tracking.isConnected) {
        tracking.startRide({ rideId: acceptedRide.id })
      }
      toast.success('Course démarrée !', { description: 'Conduisez en toute sécurité.' })
    } else {
      const activeRide = acceptedRide
      if (!activeRide) {
        toast.error('Aucune course active')
        return
      }
      const fare = activeRide.estimatedFare
      // Emit completeRide via tracking service
      if (tracking.isConnected) {
        tracking.completeRide({ rideId: activeRide.id, fare })
      }
      updateRide.mutate(
        { id: activeRide.id, data: { status: 'completed', actualFare: fare } },
        {
          onSuccess: () => {
            setAcceptedRide(null)
            setDriverEarnings(driverEarnings + fare)
            setShowCurrentRide(false)
            setIsSharingLocation(false)
            toast.success('Course terminee !', { description: `+${formatGNF(fare)}` })
          },
          onError: (err) => {
            toast.error('Erreur', { description: err.message || 'Impossible de terminer la course' })
          },
        },
      )
    }
  }, [setDriverEarnings, driverEarnings, updateRide, acceptedRide, tracking])

  const handlePayout = useCallback(() => {
    setPayoutAmount('')
    setPayoutMethod('orange_money')
    setShowPayoutDialog(true)
  }, [])

  const confirmPayout = useCallback(() => {
    const amount = parseInt(payoutAmount)
    if (!amount || amount <= 0) {
      toast.error('Montant invalide', { description: 'Veuillez entrer un montant superieur a 0.' })
      return
    }
    if (amount > driverEarnings) {
      toast.error('Solde insuffisant', { description: `Votre solde disponible est de ${formatGNF(driverEarnings)}.` })
      return
    }
    const methodLabels: Record<string, string> = {
      orange_money: 'Orange Money',
      mtn_mobile_money: 'MTN Mobile Money',
      wave: 'Wave',
    }
    toast.success('Retrait en cours', { description: `${formatGNF(amount)} sera envoye vers ${methodLabels[payoutMethod]} sous 24h.` })
    setShowPayoutDialog(false)
  }, [payoutAmount, payoutMethod, driverEarnings])

  const handleLogout = useCallback(() => {
    setIsDriverOnline(false)
    // Emit goOffline via tracking before logout
    if (tracking.isConnected) {
      tracking.goOffline({ driverId: currentDriverId })
    }
    logout()
    toast.success('Déconnecté')
  }, [logout, setIsDriverOnline, tracking, currentDriverId])

  const handleSaveVehicle = useCallback(() => {
    updateDriver.mutate(
      { id: currentDriverId, data: { vehicle: { ...vehicleData } } },
      {
        onSuccess: () => {
          setEditVehicle(false)
          toast.success('Informations du véhicule mises à jour', { description: 'Les informations ont été enregistrées.' })
        },
        onError: (err) => {
          toast.error('Erreur', { description: err.message || 'Impossible de mettre à jour le véhicule' })
        },
      },
    )
  }, [updateDriver, currentDriverId, vehicleData])

  // ── Claimed missions from localStorage ──
  const [claimedMissions, setClaimedMissions] = useState<Set<string>>(new Set())
  useEffect(() => { queueMicrotask(() => setClaimedMissions(getClaimedMissions())) }, [])

  // ── Dynamic missions based on ride data ──
  const dynamicMissions = useMemo<Mission[]>(() => {
    const claimed = claimedMissions
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // Today's completed rides
    const todayCompleted = completedRides.filter((r) => {
      const cd = r.completedAt ? new Date(r.completedAt) : null
      return cd && cd >= today
    })
    const todayRidesCount = todayCompleted.length

    // This week's earnings (Monday start)
    const now = new Date()
    const dow = now.getDay()
    const mondayOffset = dow === 0 ? -6 : 1 - dow
    const monday = new Date(now)
    monday.setDate(now.getDate() + mondayOffset)
    monday.setHours(0, 0, 0, 0)
    const weekEarnings = completedRides
      .filter((r) => {
        const cd = r.completedAt ? new Date(r.completedAt) : null
        return cd && cd >= monday
      })
      .reduce((sum, r) => sum + (r.actualFare ?? r.estimatedFare ?? 0), 0)

    // Driver rating (from user or default)
    const driverRating = user?.rating ?? 4.8

    // Accepted / declined counts (estimate from completed vs total)
    const acceptedCount = completedRides.length + (todayCompleted.length > 0 ? 2 : 0)
    const totalRequested = acceptedCount + 3 // 3 mock declined
    const acceptRate = totalRequested > 0 ? acceptedCount / totalRequested : 0

    // Long rides (>10km)
    const longRides = completedRides.filter((r) => (r.distance ?? 0) > 10).length

    return [
      {
        id: 'm1',
        title: 'Completez 5 courses aujourd\'hui',
        description: `Realisez 5 courses avant minuit pour gagner le bonus`,
        progress: todayRidesCount,
        target: 5,
        reward: 10000,
        icon: 'target',
        status: claimed.has('m1') ? 'claimed' : todayRidesCount >= 5 ? 'completed' : 'pending',
      },
      {
        id: 'm2',
        title: 'Gagnez 50 000 GNF cette semaine',
        description: `Atteignez 50 000 GNF de revenus hebdomadaires`,
        progress: weekEarnings,
        target: 50000,
        reward: 15000,
        icon: 'dollar',
        status: claimed.has('m2') ? 'claimed' : weekEarnings >= 50000 ? 'completed' : 'pending',
      },
      {
        id: 'm3',
        title: 'Maintenir une note 4.5+',
        description: `Gardez votre note moyenne au-dessus de 4.5`,
        progress: driverRating,
        target: 4.5,
        reward: 5000,
        icon: 'star',
        status: claimed.has('m3') ? 'claimed' : driverRating >= 4.5 ? 'completed' : 'pending',
      },
      {
        id: 'm4',
        title: 'Accepter 90% des courses',
        description: `Taux d\'acceptation eleve pour un meilleur score`,
        progress: acceptRate,
        target: 0.9,
        reward: 8000,
        icon: 'zap',
        status: claimed.has('m4') ? 'claimed' : acceptRate >= 0.9 ? 'completed' : 'pending',
      },
      {
        id: 'm5',
        title: 'Completez 3 longs trajets (>10 km)',
        description: `Realisez 3 courses de plus de 10 km cette semaine`,
        progress: longRides,
        target: 3,
        reward: 12000,
        icon: 'route',
        status: claimed.has('m5') ? 'claimed' : longRides >= 3 ? 'completed' : 'pending',
      },
    ]
  }, [completedRides, claimedMissions, user?.rating])

  // ── Gamification tier based on total completed rides ──
  const { currentTier, nextTier, tierProgress } = useMemo(() => {
    const totalRides = completedRides.length || (user?.totalRides ?? 50)
    let current: (typeof GAMIFICATION_TIERS)[number] = GAMIFICATION_TIERS[0]
    let next: (typeof GAMIFICATION_TIERS)[number] | null = GAMIFICATION_TIERS[1]
    let progress = 0

    for (let i = 0; i < GAMIFICATION_TIERS.length; i++) {
      const tier = GAMIFICATION_TIERS[i]
      if (totalRides >= tier.minRides && totalRides <= tier.maxRides) {
        current = tier
        next = GAMIFICATION_TIERS[i + 1] ?? null
        const range = tier.maxRides - tier.minRides + 1
        const ridesIntoTier = totalRides - tier.minRides
        progress = Math.min((ridesIntoTier / range) * 100, 100)
        break
      }
    }

    // If beyond last tier, set current to last
    if (totalRides > GAMIFICATION_TIERS[GAMIFICATION_TIERS.length - 1].maxRides) {
      current = GAMIFICATION_TIERS[GAMIFICATION_TIERS.length - 1]
      next = null
      progress = 100
    }

    return { currentTier: current, nextTier: next, tierProgress: progress, totalRides }
  }, [completedRides.length, user?.totalRides])

  // ── Claim mission handler ──
  const handleClaimMission = useCallback((mission: Mission) => {
    if (mission.status !== 'completed') return
    saveClaimedMission(mission.id)
    setClaimedMissions((prev) => new Set([...prev, mission.id]))
    setDriverEarnings(driverEarnings + mission.reward)
    toast.success('Bonus récupéré !', { description: `+${formatGNF(mission.reward)} ajouté à vos revenus` })
  }, [driverEarnings, setDriverEarnings])

  // ── Computed ──

  // ── Profile completion calculation ──
  const profileCompletion = useMemo(() => {
    let pct = 0
    // Vehicle info filled: 25%
    const hasVehicle = vehicleData.brand && vehicleData.model && vehicleData.plate
    if (hasVehicle) pct += 25
    // First ride completed: 25%
    const hasCompletedRide = completedRidesCount > 0
    if (hasCompletedRide) pct += 25
    // 10+ rides completed: 25%
    if (completedRidesCount >= 10 || (user?.totalRides ?? 0) >= 10) pct += 25
    return Math.min(pct, 100)
  }, [vehicleData, completedRidesCount, user?.totalRides])

  const driverInitials = user?.name?.split(' ').map((n) => n[0]).join('').toUpperCase() ?? 'DC'
  const maxWeeklyEarnings = Math.max(...computedWeeklyEarnings.map((d) => d.amount), 1)
  const totalWeeklyEarnings = computedWeeklyEarnings.reduce((sum, d) => sum + d.amount, 0)
  const totalPayments = computedPaymentBreakdown.reduce((sum, p) => sum + p.amount, 0)
  const validDocs = 0

  // Transform completedRides into rideHistory format for RidesTab
  const rideHistory = completedRides.slice(0, 10).map((r) => ({
    id: r.id,
    date: r.completedAt ? new Date(r.completedAt).toLocaleDateString('fr-FR') : '---',
    from: r.pickupAddress,
    fromZone: r.pickupZone,
    to: r.dropoffAddress,
    toZone: r.dropoffZone,
    fare: r.actualFare ?? r.estimatedFare ?? 0,
    ratingGiven: r.driverRating ?? 5,
    ratingReceived: r.passengerRating ?? 5,
  }))

  // ── Zone map: compute driver markers for MovaMap ──
  const zoneDriverMarkers = useMemo(() => {
    const markers: Array<{ lat: number; lng: number; id: string; name?: string }> = []
    // Add driver's own position as the first marker
    markers.push({ lat: currentPosition.lat, lng: currentPosition.lng, id: currentDriverId, name: user?.name ?? 'Vous' })
    // Add other drivers from tracking positions map
    tracking.driverPositions.forEach((pos, driverId) => {
      if (driverId !== currentDriverId) {
        markers.push({ lat: pos.lat, lng: pos.lng, id: driverId })
      }
    })
    return markers
  }, [tracking.driverPositions, currentPosition, currentDriverId, user?.name])

  // First available ride pickup location for map pin
  const firstRidePickup = useMemo(() => {
    if (availableRides.length === 0) return null
    const ride = availableRides[0]
    if (!ride.pickupLat || !ride.pickupLng) return null
    return { lat: ride.pickupLat, lng: ride.pickupLng, name: ride.pickupAddress }
  }, [availableRides])

  // Retry handler for API errors
  const handleRetryRides = () => {
    refetchCompleted()
    refetchPending()
  }

  // ── Render ──

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* ═══════════════════ TOP BAR ═══════════════════ */}
      <header className="sticky top-0 z-50 mova-glass border-b border-border">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between gap-3">
          {/* Logo */}
          <button onClick={() => setView('landing')} className="flex items-center gap-2 shrink-0">
            <div className="w-8 h-8 rounded-lg mova-gradient flex items-center justify-center">
              <Car className="w-4 h-4 text-white" />
            </div>
            <span className="text-lg font-bold mova-gradient-text tracking-tight hidden sm:inline">MOVA</span>
          </button>

          {/* Center: driver name + rating */}
          <div className="hidden sm:flex items-center gap-2">
            <Avatar className="w-7 h-7 border border-emerald-200 dark:border-emerald-800">
              <AvatarFallback className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200 text-[10px] font-bold">
                {driverInitials}
              </AvatarFallback>
            </Avatar>
            <div className="leading-tight">
              <p className="text-xs font-semibold">{user?.name ?? 'Chauffeur'}</p>
              <div className="flex items-center gap-0.5">
                <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
                <span className="text-[10px] font-medium text-muted-foreground">{apiDriverRating.toFixed(1)}</span>
              </div>
            </div>
          </div>

          {/* Right: status + notifications + profile */}
          <div className="flex items-center gap-2">
            {/* Connection status indicator */}
            <div className="relative flex items-center gap-1.5 bg-muted/60 rounded-full px-2.5 py-1">
              <div className="relative">
                <div className={`w-2 h-2 rounded-full transition-colors duration-500 ${isDriverOnline ? 'bg-emerald-500' : 'bg-red-500'}`} />
                {isDriverOnline && (
                  <div className="absolute inset-0 w-2 h-2 rounded-full bg-emerald-500 mova-pulse-dot" />
                )}
              </div>
              <span className={`text-[10px] font-medium ${isDriverOnline ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                {isDriverOnline ? 'En ligne' : 'Hors ligne'}
              </span>
            </div>

            {/* Tracking service connection badge */}
            <div className={`flex items-center gap-1 rounded-full px-1.5 py-0.5 ${tracking.connectionStatus === 'connected' ? 'bg-emerald-50 dark:bg-emerald-900/20' : tracking.connectionStatus === 'connecting' ? 'bg-amber-50 dark:bg-amber-900/20' : 'bg-red-50 dark:bg-red-900/20'}`}>
              {tracking.connectionStatus === 'connected' ? (
                <Wifi className="w-3 h-3 text-emerald-500" />
              ) : tracking.connectionStatus === 'connecting' ? (
                <WifiOff className="w-3 h-3 text-amber-500" />
              ) : (
                <WifiOff className="w-3 h-3 text-red-400" />
              )}
            </div>

            {/* Theme Toggle */}
            {mounted && (
              <button
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                className="p-1.5 rounded-lg hover:bg-muted/60 transition-colors"
                aria-label="Changer de theme"
              >
                {theme === 'dark' ? <Sun className="w-4.5 h-4.5 text-amber-400" /> : <Moon className="w-4.5 h-4.5 text-slate-600" />}
              </button>
            )}

            {/* Notifications */}
            <button onClick={() => setShowNotifications(true)} className="relative p-1.5 rounded-lg hover:bg-muted/60 transition-colors">
              <Bell className="w-4.5 h-4.5 text-muted-foreground" />
              {unreadCount > 0 && <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-red-500 text-[9px] text-white flex items-center justify-center font-bold">{unreadCount > 9 ? '9+' : unreadCount}</span>}
            </button>

            {/* Profile */}
            <Avatar className="w-8 h-8 border-2 border-emerald-200 dark:border-emerald-800 cursor-pointer" onClick={() => setActiveTab('profile')}>
              <AvatarFallback className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200 text-xs font-bold">
                {driverInitials}
              </AvatarFallback>
            </Avatar>
          </div>
        </div>
      </header>

      {/* ═══════════════════ MAIN CONTENT ═══════════════════ */}
      <main className="flex-1 max-w-2xl w-full mx-auto px-4 py-3 pb-24">
        <AnimatePresence mode="wait">
          {activeTab === 'dashboard' && (
            <motion.div key="dashboard" variants={tabVariants} initial="initial" animate="animate" exit="exit" transition={{ duration: 0.25 }} className="space-y-4">
              <DashboardTab
                isDriverOnline={isDriverOnline}
                onToggleOnline={handleToggleOnline}
                onlineSeconds={onlineSeconds}
                heatmapZones={[]}
                missions={dynamicMissions}
                weeklyEarnings={computedWeeklyEarnings}
                maxWeeklyEarnings={maxWeeklyEarnings}
                todayEarnings={computedEarnings}
                todayRides={completedRidesCount}
                onShowLeaderboard={() => setShowLeaderboard(true)}
                onClaimMission={handleClaimMission}
                driverRating={apiDriverRating}
                isLoading={isLoadingRides}
                isError={!!isCompletedError}
                error={ridesError}
                onRetry={handleRetryRides}
                nearbyDriversCount={nearbyDriversCount}
                isTrackingConnected={tracking.connectionStatus === 'connected'}
                connectionStatus={tracking.connectionStatus}
                zoneDriverMarkers={zoneDriverMarkers}
                firstRidePickup={firstRidePickup}
                trackingWarning={tracking.lastWarning}
                onClearWarning={() => tracking.clearWarning()}
                hasActiveRide={!!acceptedRide}
                activeRideStep={currentRideStep}
              />
              <DriverLeaderboard open={showLeaderboard} onOpenChange={setShowLeaderboard} />
            </motion.div>
          )}

          {activeTab === 'rides' && (
            <motion.div key="rides" variants={tabVariants} initial="initial" animate="animate" exit="exit" transition={{ duration: 0.25 }} className="space-y-4">
              <RidesTab
                availableRides={availableRides}
                rideTimers={rideTimers}
                showCurrentRide={showCurrentRide}
                currentRide={acceptedRide!}
                currentRideStep={currentRideStep}
                onAccept={handleAcceptRide}
                onDecline={handleDeclineRide}
                onRideAction={handleRideAction}
                rideHistory={rideHistory}
                isDriverOnline={isDriverOnline}
                onShowFullHistory={() => setShowFullHistory(true)}
                isLoadingHistory={isLoadingRides}
                isError={!!isCompletedError}
                onRetry={handleRetryRides}
                isSharingLocation={isSharingLocation}
                isTrackingConnected={tracking.connectionStatus === 'connected'}
              />
            </motion.div>
          )}

          {activeTab === 'earnings' && (
            <motion.div key="earnings" variants={tabVariants} initial="initial" animate="animate" exit="exit" transition={{ duration: 0.25 }} className="space-y-4">
              <EarningsTab
                driverEarnings={driverEarnings}
                weeklyEarnings={computedWeeklyEarnings}
                maxWeeklyEarnings={maxWeeklyEarnings}
                totalWeeklyEarnings={totalWeeklyEarnings}
                paymentBreakdown={computedPaymentBreakdown}
                totalPayments={totalPayments}
                onPayout={handlePayout}
                completedRidesCount={completedRidesCount}
              />
            </motion.div>
          )}

          {activeTab === 'profile' && (
            <motion.div key="profile" variants={tabVariants} initial="initial" animate="animate" exit="exit" transition={{ duration: 0.25 }} className="space-y-4">
              <ProfileTab
                user={user}
                driverInitials={driverInitials}
                vehicleData={vehicleData}
                editVehicle={editVehicle}
                setEditVehicle={setEditVehicle}
                setVehicleData={setVehicleData}
                onSaveVehicle={handleSaveVehicle}
                documents={[]}
                validDocs={validDocs}
                currentTier={currentTier}
                nextTier={nextTier}
                tierProgress={tierProgress}
                totalRides={tierProgress >= 100 ? (currentTier.minRides) : (user?.totalRides ?? completedRides.length)}
                prefLongDistance={prefLongDistance}
                setPrefLongDistance={setPrefLongDistance}
                prefShared={prefShared}
                setPrefShared={setPrefShared}
                prefSound={prefSound}
                setPrefSound={setPrefSound}
                prefZone={prefZone}
                setPrefZone={setPrefZone}
                onLogout={handleLogout}
                driverRating={apiDriverRating}
                profileCompletion={profileCompletion}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* ═══════════════════ NOTIFICATION PANEL ═══════════════════ */}
      <NotificationPanel open={showNotifications} onOpenChange={setShowNotifications} />

      {/* ═══════════════════ PAYOUT DIALOG ═══════════════════ */}
      <Dialog open={showPayoutDialog} onOpenChange={setShowPayoutDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wallet className="w-5 h-5 text-emerald-600" />
              Retrait de fonds
            </DialogTitle>
            <DialogDescription>
              Solde disponible : {formatGNF(driverEarnings)}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800">
              <p className="text-xs text-muted-foreground">Solde disponible</p>
              <p className="text-lg font-bold text-emerald-700 dark:text-emerald-400">{formatGNF(driverEarnings)}</p>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Montant du retrait (GNF)</label>
              <Input
                type="number"
                placeholder="Ex: 50000"
                value={payoutAmount}
                onChange={(e) => setPayoutAmount(e.target.value)}
                className="h-10"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Methode de retrait</label>
              <Select value={payoutMethod} onValueChange={setPayoutMethod}>
                <SelectTrigger className="h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="orange_money">Orange Money</SelectItem>
                  <SelectItem value="mtn_mobile_money">MTN Mobile Money</SelectItem>
                  <SelectItem value="wave">Wave</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setShowPayoutDialog(false)}>Annuler</Button>
            <Button onClick={confirmPayout} className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5">
              <Wallet className="w-4 h-4" /> Confirmer le retrait
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══════════════════ FULL HISTORY DIALOG ═══════════════════ */}
      <Dialog open={showFullHistory} onOpenChange={setShowFullHistory}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-emerald-600" />
              Historique complet des courses
            </DialogTitle>
            <DialogDescription>
              {isLoadingRides ? 'Chargement...' : `${completedRides.length} courses terminees au total`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 flex-1 overflow-hidden">
            {/* Error banner */}
            {isCompletedError && (
              <div className="flex items-center gap-3 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                <p className="text-[10px] text-red-600 dark:text-red-400 flex-1">Erreur de chargement - donnees de demonstration affichees</p>
                <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px] text-red-600 dark:text-red-400" onClick={handleRetryRides}>
                  <RefreshCw className="w-3 h-3 mr-1" />
                  Reessayer
                </Button>
              </div>
            )}
            <div className="flex items-center gap-2">
              <Select value={historyFilter} onValueChange={setHistoryFilter}>
                <SelectTrigger className="w-[180px] h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes les courses</SelectItem>
                  <SelectItem value="7d">7 derniers jours</SelectItem>
                  <SelectItem value="30d">30 derniers jours</SelectItem>
                  <SelectItem value="3m">3 derniers mois</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="max-h-[50vh] overflow-y-auto mova-scrollbar rounded-lg border border-border/50">
              {isLoadingRides ? (
                <div className="divide-y divide-border p-4 space-y-4">
                  {[0, 1, 2, 3, 4].map((i) => (
                    <div key={i} className="flex items-center gap-3">
                      <Skeleton className="w-9 h-9 rounded-full" />
                      <div className="flex-1 space-y-1.5">
                        <Skeleton className="h-3 w-full max-w-[200px]" />
                        <Skeleton className="h-2.5 w-28" />
                      </div>
                      <Skeleton className="h-4 w-16" />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="divide-y divide-border">
                {(() => {
                  const now = new Date()
                  let cutoff: Date | null = null
                  if (historyFilter === '7d') cutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
                  else if (historyFilter === '30d') cutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
                  else if (historyFilter === '3m') { cutoff = new Date(now); cutoff.setMonth(cutoff.getMonth() - 3) }
                  const filtered = completedRides.filter((r) => {
                    if (!cutoff) return true
                    const d = r.completedAt ? new Date(r.completedAt) : null
                    return d && d >= cutoff
                  })
                  if (filtered.length === 0) {
                    return (
                      <div className="py-8 text-center">
                        <Clock className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                        <p className="text-sm text-muted-foreground">Aucune course trouvee pour cette periode</p>
                      </div>
                    )
                  }
                  return filtered.map((ride) => (
                    <div key={ride.id} className="px-4 py-3 flex items-center gap-3 hover:bg-muted/30 transition-colors">
                      <div className="w-9 h-9 rounded-full bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center shrink-0">
                        <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-medium truncate">{ride.pickupAddress}</span>
                          <ChevronRight className="w-3 h-3 text-muted-foreground shrink-0" />
                          <span className="text-xs font-medium truncate">{ride.dropoffAddress}</span>
                        </div>
                        <span className="text-[10px] text-muted-foreground">
                          {ride.completedAt ? new Date(ride.completedAt).toLocaleDateString('fr-FR') : '---'}
                        </span>
                      </div>
                      <span className="text-sm font-bold text-amber-600 dark:text-amber-400 shrink-0">
                        {formatShortGNF(ride.actualFare ?? ride.estimatedFare)}
                      </span>
                    </div>
                  ))
                })()}
              </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowFullHistory(false)}>Fermer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══════════════════ BOTTOM TAB BAR ═══════════════════ */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-md border-t border-border safe-area-bottom">
        <div className="max-w-2xl mx-auto px-2">
          <div className="flex items-center justify-around h-16">
            {[
              { id: 'dashboard', label: 'Tableau de bord', icon: Home },
              { id: 'rides', label: 'Courses', icon: Navigation },
              { id: 'earnings', label: 'Revenus', icon: BarChart3 },
              { id: 'profile', label: 'Profil', icon: Settings },
            ].map((tab) => {
              const isActive = activeTab === tab.id
              const rideCount = tab.id === 'rides' && isDriverOnline ? availableRides.length : 0
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`relative flex flex-col items-center justify-center gap-0.5 px-3 py-1.5 rounded-xl transition-all duration-200 min-w-[64px] ${
                    isActive
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <div className="relative">
                    <tab.icon className={`w-5 h-5 transition-all ${isActive ? 'scale-110' : ''}`} />
                    {rideCount > 0 && (
                      <span className="absolute -top-1.5 -right-2.5 w-4 h-4 rounded-full bg-amber-500 text-[9px] text-white flex items-center justify-center font-bold">
                        {rideCount}
                      </span>
                    )}
                  </div>
                  <span className={`text-[10px] font-medium transition-all ${isActive ? 'font-semibold' : ''}`}>
                    {tab.label}
                  </span>
                  {isActive && (
                    <motion.div
                      layoutId="activeTabIndicator"
                      className="absolute -bottom-1 left-2 right-2 h-0.5 rounded-full bg-emerald-500"
                      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                    />
                  )}
                </button>
              )
            })}
          </div>
        </div>
      </nav>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════
// TAB 1: TABLEAU DE BORD
// ═══════════════════════════════════════════════════════════════════════

function DashboardTab({ isDriverOnline, onToggleOnline, onlineSeconds, heatmapZones, missions, weeklyEarnings, maxWeeklyEarnings, todayEarnings, todayRides, onShowLeaderboard, onClaimMission, driverRating, isLoading, isError, error, onRetry, nearbyDriversCount, isTrackingConnected, connectionStatus, zoneDriverMarkers, firstRidePickup, trackingWarning, onClearWarning, hasActiveRide, activeRideStep }: {
  isDriverOnline: boolean
  onToggleOnline: () => void
  onlineSeconds: number
  heatmapZones: { name: string; demand: number; waitMin: number; label: string }[]
  missions: Mission[]
  weeklyEarnings: { day: string; amount: number }[]
  maxWeeklyEarnings: number
  todayEarnings: number
  todayRides: number
  onShowLeaderboard: () => void
  onClaimMission: (mission: Mission) => void
  driverRating: number
  isLoading?: boolean
  isError?: boolean
  error?: Error | null
  onRetry?: () => void
  nearbyDriversCount: number
  isTrackingConnected: boolean
  connectionStatus: string
  zoneDriverMarkers: Array<{ lat: number; lng: number; id: string; name?: string }>
  firstRidePickup: { lat: number; lng: number; name: string } | null
  trackingWarning: string | null
  onClearWarning: () => void
  hasActiveRide: boolean
  activeRideStep: 'pickup' | 'ride' | 'complete'
}) {
  const [showMissions, setShowMissions] = useState(true)

  return (
    <motion.div variants={staggerContainer} initial="initial" animate="animate" className="space-y-4">
      {/* ══ GPS Warning Banner ══ */}
      <AnimatePresence>
        {trackingWarning && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25 }}
          >
            <div className="flex items-center gap-3 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
              <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
              <p className="text-[11px] text-amber-700 dark:text-amber-300 flex-1">{trackingWarning}</p>
              <button
                onClick={onClearWarning}
                className="text-amber-400 hover:text-amber-600 dark:hover:text-amber-200 transition-colors shrink-0"
                aria-label="Fermer l'avertissement"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ══ Real-Time Zone Map (when driver is online) ══ */}
      <AnimatePresence>
        {isDriverOnline && (
          <motion.div
            variants={staggerItem}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
          >
            <Card className="border-0 shadow-sm overflow-hidden">
              <CardHeader className="px-4 pt-3 pb-0">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <CardTitle className="text-sm font-semibold">Carte de la zone</CardTitle>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {zoneDriverMarkers.length > 1 && (
                      <Badge variant="secondary" className="text-[9px] bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 border-0 gap-1">
                        <Users className="w-2.5 h-2.5" />
                        {zoneDriverMarkers.length} chauffeur{zoneDriverMarkers.length > 1 ? 's' : ''}
                      </Badge>
                    )}
                    {firstRidePickup && (
                      <Badge variant="secondary" className="text-[9px] bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 border-0 gap-1">
                        <Navigation className="w-2.5 h-2.5" />
                        Demande
                      </Badge>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="px-0 pb-0">
                <div className="h-52 sm:h-64">
                  <DynamicMovaMap
                    drivers={zoneDriverMarkers}
                    pickup={firstRidePickup}
                    showZones={true}
                    showSearch={false}
                    showRoute={false}
                    showScale={false}
                    showLocate={true}
                    showLayerToggle={false}
                    interactive={true}
                    className="rounded-none"
                  />
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ══ Compact Driver Status Bar (when online) ══ */}
      {isDriverOnline && (
        <motion.div variants={staggerItem}>
          <div className="flex items-center gap-2 px-1">
            {/* Connection status indicator */}
            <div className="flex items-center gap-1.5 bg-muted/60 rounded-full px-2.5 py-1.5">
              <div className="relative">
                <div className={`w-2 h-2 rounded-full transition-colors duration-500 ${
                  connectionStatus === 'connected' ? 'bg-emerald-500' :
                  connectionStatus === 'connecting' ? 'bg-amber-500' :
                  'bg-red-500'
                }`} />
                {connectionStatus === 'connected' && (
                  <div className="absolute inset-0 w-2 h-2 rounded-full bg-emerald-500 mova-pulse-dot" />
                )}
              </div>
              <span className={`text-[10px] font-medium ${
                connectionStatus === 'connected' ? 'text-emerald-700 dark:text-emerald-400' :
                connectionStatus === 'connecting' ? 'text-amber-700 dark:text-amber-400' :
                'text-red-600 dark:text-red-400'
              }`}>
                {connectionStatus === 'connected' ? 'Connecté' :
                 connectionStatus === 'connecting' ? 'Reconnexion...' :
                 'Déconnecté'}
              </span>
            </div>

            {/* Active drivers in zone */}
            {nearbyDriversCount > 0 && (
              <div className="flex items-center gap-1.5 bg-muted/60 rounded-full px-2.5 py-1.5">
                <Users className="w-3 h-3 text-muted-foreground" />
                <span className="text-[10px] font-medium text-muted-foreground">
                  {nearbyDriversCount} dans la zone
                </span>
              </div>
            )}

            {/* Current ride status (if active) */}
            {hasActiveRide && (
              <div className="flex items-center gap-1.5 bg-emerald-50 dark:bg-emerald-900/20 rounded-full px-2.5 py-1.5 ml-auto">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mova-pulse-dot" />
                <span className="text-[10px] font-medium text-emerald-700 dark:text-emerald-400">
                  {activeRideStep === 'pickup' ? 'En route vers le passager' :
                   activeRideStep === 'ride' ? 'Course en cours' : 'Terminée'}
                </span>
              </div>
            )}
          </div>
        </motion.div>
      )}

      {/* Online/Offline Toggle Card */}
      <motion.div variants={staggerItem}>
        <Card className="overflow-hidden border-0 shadow-md">
          <div className={`p-6 transition-all duration-500 ${isDriverOnline ? 'mova-gradient text-white' : 'bg-muted text-foreground'}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-500 ${isDriverOnline ? 'bg-white/20 border-2 border-white/30' : 'bg-muted-foreground/10 border-2 border-muted-foreground/20'}`}>
                  <Navigation className={`w-7 h-7 transition-colors ${isDriverOnline ? 'text-white' : 'text-muted-foreground'}`} />
                </div>
                <div>
                  <h2 className="text-lg font-bold">
                    {isDriverOnline ? 'Vous êtes en ligne' : 'Vous êtes hors ligne'}
                  </h2>
                  <p className={`text-sm mt-0.5 ${isDriverOnline ? 'text-white/70' : 'text-muted-foreground'}`}>
                    {isDriverOnline ? 'Vous recevez les demandes de course' : 'Activez pour recevoir des courses'}
                  </p>
                </div>
              </div>
              <button
                onClick={onToggleOnline}
                className={`relative w-14 h-8 rounded-full transition-colors duration-300 ${isDriverOnline ? 'bg-white/30' : 'bg-red-400'}`}
              >
                <motion.div
                  className="absolute top-1 w-6 h-6 rounded-full bg-white shadow-md"
                  animate={{ left: isDriverOnline ? 30 : 4 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                />
              </button>
            </div>
            {isDriverOnline && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="mt-4 space-y-2"
              >
                <div className="flex items-center gap-2 bg-white/10 rounded-lg px-4 py-2 w-fit">
                  <Clock className="w-4 h-4 text-white/70" />
                  <span className="text-sm text-white/90">Connecte depuis {formatTimer(onlineSeconds)}</span>
                </div>
                {/* Location sharing + nearby drivers info when online */}
                <div className="flex items-center gap-3 flex-wrap">
                  {isTrackingConnected && (
                    <div className="flex items-center gap-1.5 bg-white/10 rounded-lg px-3 py-1.5">
                      <Wifi className="w-3.5 h-3.5 text-emerald-300" />
                      <span className="text-[11px] text-white/80">Suivi actif</span>
                    </div>
                  )}
                  {nearbyDriversCount > 0 && (
                    <div className="flex items-center gap-1.5 bg-white/10 rounded-lg px-3 py-1.5">
                      <Users className="w-3.5 h-3.5 text-white/70" />
                      <span className="text-[11px] text-white/80">{nearbyDriversCount} chauffeur{nearbyDriversCount > 1 ? 's' : ''} a proximite</span>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </div>
        </Card>
      </motion.div>

      {/* API Error Banner */}
      {isError && (
        <motion.div variants={staggerItem}>
          <div className="flex items-center gap-3 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
            <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-red-700 dark:text-red-400">
                Impossible de charger les donnees
              </p>
              <p className="text-[10px] text-red-600/70 dark:text-red-400/70 truncate">
                {error?.message ?? 'Erreur de connexion au serveur'}
              </p>
            </div>
            {onRetry && (
              <Button
                variant="outline"
                size="sm"
                className="shrink-0 h-7 px-2.5 text-[10px] border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30"
                onClick={onRetry}
              >
                <RefreshCw className="w-3 h-3 mr-1" />
                Reessayer
              </Button>
            )}
          </div>
        </motion.div>
      )}

      {/* Daily Stats Grid */}
      <motion.div variants={staggerItem} className="grid grid-cols-2 gap-3">
        {isLoading ? (
          <>
            {[0, 1, 2, 3].map((i) => (
              <Card key={i} className="border-0 shadow-sm overflow-hidden">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <Skeleton className="w-11 h-11 rounded-xl" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-3 w-16" />
                      <Skeleton className="h-6 w-24" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </>
        ) : (
          <>
            <StatCard icon={Navigation} label="Courses" value={todayRides > 0 ? todayRides : 5} color="emerald" trend={todayRides > 0 ? 'up' : undefined} />
            <StatCard icon={DollarSign} label="Revenus" value={todayEarnings > 0 ? formatGNF(todayEarnings) : '125 000 GNF'} color="amber" trend={todayEarnings > 0 ? 'up' : undefined} />
            <StatCard icon={Clock} label="Temps" value={formatTimer(onlineSeconds)} color="emerald" />
            <StatCard icon={Star} label="Note" value={driverRating} color="amber" />
          </>
        )}
      </motion.div>

      {/* Heatmap Zone Card */}
      <motion.div variants={staggerItem}>
        <Card className="border-0 shadow-sm overflow-hidden">
          <CardHeader className="px-5 pt-4 pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MapPin className="w-4.5 h-4.5 text-emerald-600 dark:text-emerald-400" />
                <CardTitle className="text-sm font-semibold">Demande par zone</CardTitle>
              </div>
              <Badge variant="outline" className="text-[10px] text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800">
                <Zap className="w-3 h-3 mr-1" />
                Temps reel
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="px-5 pb-4 space-y-2.5">
            {heatmapZones.map((zone) => (
              <div key={zone.name} className="flex items-center gap-3">
                <span className="text-xs font-medium w-16 shrink-0">{zone.name}</span>
                <div className="flex-1 h-6 bg-muted/50 rounded-md overflow-hidden relative">
                  <motion.div
                    className={`h-full rounded-md ${demandColor(zone.demand)}`}
                    initial={{ width: 0 }}
                    animate={{ width: `${(zone.demand / 10) * 100}%` }}
                    transition={{ duration: 0.8, ease: 'easeOut' }}
                  />
                </div>
                <div className="flex items-center gap-1.5 shrink-0 w-28">
                  <Badge className={`text-[9px] px-1.5 py-0 ${demandBg(zone.demand)} border-0 font-medium`}>
                    {zone.label}
                  </Badge>
                  <span className="text-[10px] text-muted-foreground whitespace-nowrap">{zone.waitMin} min</span>
                </div>
              </div>
            ))}
            <div className="flex items-center gap-2 mt-2 p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800">
              <Navigation className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span className="text-xs text-emerald-700 dark:text-emerald-300 font-medium">
                Zone recommandee: Ratoma - forte demande, 2 min d&apos;attente
              </span>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Missions / Incentives */}
      <motion.div variants={staggerItem}>
        <Card className="border-0 shadow-sm overflow-hidden">
          <button
            onClick={() => setShowMissions(!showMissions)}
            className="w-full px-5 pt-4 pb-2 flex items-center justify-between"
          >
            <div className="flex items-center gap-2">
              <Target className="w-4.5 h-4.5 text-amber-600 dark:text-amber-400" />
              <CardTitle className="text-sm font-semibold">Missions &amp; Bonus</CardTitle>
            </div>
            <ChevronRight className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${showMissions ? 'rotate-90' : ''}`} />
          </button>
          <AnimatePresence>
            {showMissions && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <CardContent className="px-5 pb-4 space-y-3.5">
                  {missions.map((mission) => {
                    const progressPct = Math.min((mission.progress / mission.target) * 100, 100)
                    const isComplete = mission.status === 'completed'
                    const isClaimed = mission.status === 'claimed'
                    return (
                      <div key={mission.id}>
                        <div className="flex items-start justify-between mb-1.5">
                          <div className="flex items-center gap-2 min-w-0 flex-1 mr-2">
                            {mission.icon === 'target' && <Target className="w-3.5 h-3.5 text-emerald-500 shrink-0" />}
                            {mission.icon === 'dollar' && <DollarSign className="w-3.5 h-3.5 text-amber-500 shrink-0" />}
                            {mission.icon === 'zap' && <Zap className="w-3.5 h-3.5 text-orange-500 shrink-0" />}
                            {mission.icon === 'star' && <Star className="w-3.5 h-3.5 text-amber-500 shrink-0" />}
                            {mission.icon === 'route' && <Route className="w-3.5 h-3.5 text-blue-500 shrink-0" />}
                            <div className="min-w-0">
                              <span className="text-xs font-medium">{mission.title}</span>
                              <p className="text-[10px] text-muted-foreground truncate">{mission.description}</p>
                            </div>
                          </div>
                          {isClaimed ? (
                            <Badge variant="secondary" className="text-[9px] shrink-0 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                              <Check className="w-2.5 h-2.5 mr-0.5" />Récupéré
                            </Badge>
                          ) : isComplete ? (
                            <Button
                              size="sm"
                              className="h-6 px-2 text-[10px] bg-amber-500 hover:bg-amber-600 text-white shrink-0"
                              onClick={() => onClaimMission(mission)}
                            >
                              Récupérer +{formatGNF(mission.reward)}
                            </Button>
                          ) : (
                            <Badge variant="secondary" className="text-[9px] shrink-0 bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                              +{formatGNF(mission.reward)}
                            </Badge>
                          )}
                        </div>
                        <div className="w-full bg-muted rounded-full h-2 mb-1">
                          <motion.div
                            className={`h-2 rounded-full ${isClaimed ? 'bg-emerald-500' : isComplete ? 'bg-emerald-500' : 'mova-gradient'}`}
                            initial={{ width: 0 }}
                            animate={{ width: `${progressPct}%` }}
                            transition={{ duration: 0.6, ease: 'easeOut' }}
                          />
                        </div>
                        <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                          <span>
                            {mission.icon === 'dollar'
                              ? `${formatGNF(mission.progress)} / ${formatGNF(mission.target)}`
                              : mission.icon === 'zap'
                                ? `${Math.round(mission.progress * 100)}% / ${Math.round(mission.target * 100)}%`
                                : mission.icon === 'star'
                                  ? `${mission.progress.toFixed(1)} / ${mission.target}`
                                  : `${mission.progress} / ${mission.target}`}
                          </span>
                          <span className={`font-medium ${isClaimed ? 'text-emerald-600 dark:text-emerald-400' : isComplete ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
                            {isClaimed ? 'Bonus obtenu' : isComplete ? 'Prêt à récupérer !' : `Bonus: ${formatGNF(mission.reward)}`}
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </CardContent>
              </motion.div>
            )}
          </AnimatePresence>
        </Card>
      </motion.div>

      {/* Leaderboard Card */}
      <motion.div variants={staggerItem}>
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={onShowLeaderboard}>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center">
              <Trophy className="h-5 w-5 text-white" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold">Classement MOVA</p>
              <p className="text-xs text-muted-foreground">Votre position et les meilleurs chauffeurs</p>
            </div>
            <ChevronRight className="size-5 text-muted-foreground" />
          </CardContent>
        </Card>
      </motion.div>

      {/* Weekly Earnings Trend (Mini Chart) */}
      <motion.div variants={staggerItem}>
        <Card className="border-0 shadow-sm">
          <CardHeader className="px-5 pt-4 pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4.5 h-4.5 text-emerald-600 dark:text-emerald-400" />
                <CardTitle className="text-sm font-semibold">Tendance hebdomadaire</CardTitle>
              </div>
              <span className="text-[10px] text-muted-foreground">Revenus</span>
            </div>
          </CardHeader>
          <CardContent className="px-5 pb-4">
            <div className="flex items-end justify-between gap-1.5 h-28">
              {weeklyEarnings.map((d, i) => {
                const isToday = i === new Date().getDay() - 1 || (new Date().getDay() === 0 && i === 6)
                const pct = (d.amount / maxWeeklyEarnings) * 100
                return (
                  <div key={i} className="flex flex-col items-center gap-1 flex-1">
                    <span className="text-[9px] font-medium text-muted-foreground">{formatShortGNF(d.amount)}</span>
                    <motion.div
                      className={`w-full rounded-t-md transition-all ${isToday ? 'bg-gradient-to-t from-emerald-600 to-emerald-400' : 'bg-emerald-200 dark:bg-emerald-800/60'}`}
                      initial={{ height: 0 }}
                      animate={{ height: `${pct}%`, minHeight: '6px' }}
                      transition={{ duration: 0.6, delay: i * 0.08, ease: 'easeOut' }}
                    />
                    <span className={`text-[10px] font-medium ${isToday ? 'text-emerald-600 dark:text-emerald-400 font-bold' : 'text-muted-foreground'}`}>
                      {d.day}
                    </span>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  )
}

// ═══════════════════════════════════════════════════════════════════════
// TAB 2: COURSES
// ═══════════════════════════════════════════════════════════════════════

function RidesTab({ availableRides, rideTimers, showCurrentRide, currentRide, currentRideStep, onAccept, onDecline, onRideAction, rideHistory, isDriverOnline, onShowFullHistory, isLoadingHistory, isError, onRetry, isSharingLocation, isTrackingConnected }: {
  availableRides: Ride[]
  rideTimers: Record<string, number>
  showCurrentRide: boolean
  currentRide: Ride | null
  currentRideStep: 'pickup' | 'ride' | 'complete'
  onAccept: (ride: Ride) => void
  onDecline: (ride: Ride) => void
  onRideAction: (step: 'pickup' | 'ride' | 'complete') => void
  rideHistory: { id: string; date: string; from: string; fromZone: string; to: string; toZone: string; fare: number; ratingGiven: number; ratingReceived: number }[]
  isDriverOnline: boolean
  onShowFullHistory: () => void
  isLoadingHistory?: boolean
  isError?: boolean
  onRetry?: () => void
  isSharingLocation: boolean
  isTrackingConnected: boolean
}) {
  return (
    <motion.div variants={staggerContainer} initial="initial" animate="animate" className="space-y-4">
      {/* Current Active Ride */}
      {showCurrentRide && currentRide && (
        <motion.div variants={cardVariants}>
          <Card className="border-0 shadow-md overflow-hidden border-l-4 border-l-emerald-500">
            <CardHeader className="px-5 pt-4 pb-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 mova-pulse-dot" />
                  <CardTitle className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">Course en cours</CardTitle>
                </div>
                <div className="flex items-center gap-2">
                  {isSharingLocation && isTrackingConnected && (
                    <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 text-[10px] border-0 gap-1">
                      <LocateFixed className="w-3 h-3" />
                      Partage de position active
                    </Badge>
                  )}
                  <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 text-[10px] border-0">
                    {currentRideStep === 'pickup' ? 'En route' : currentRideStep === 'ride' ? 'En course' : 'Terminee'}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="px-5 pb-4 space-y-3">
              {/* Route */}
              <div className="space-y-2">
                <div className="flex items-start gap-2">
                  <div className="w-3 h-3 rounded-full bg-emerald-500 mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{currentRide.pickupAddress}</p>
                    <Badge variant="outline" className="text-[9px] mt-0.5">{currentRide.pickupZone}</Badge>
                  </div>
                </div>
                <div className="ml-1.5 border-l-2 border-dashed border-muted-foreground/30 h-4" />
                <div className="flex items-start gap-2">
                  <div className="w-3 h-3 rounded-sm bg-red-500 mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{currentRide.dropoffAddress}</p>
                    <Badge variant="outline" className="text-[9px] mt-0.5">{currentRide.dropoffZone}</Badge>
                  </div>
                </div>
              </div>

              {/* Info row */}
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-muted/50 rounded-lg p-2 text-center">
                  <Clock className="w-3.5 h-3.5 mx-auto text-muted-foreground mb-0.5" />
                  <p className="text-xs font-bold">{currentRide.duration} min</p>
                  <p className="text-[9px] text-muted-foreground">ETA</p>
                </div>
                <div className="bg-muted/50 rounded-lg p-2 text-center">
                  <Route className="w-3.5 h-3.5 mx-auto text-muted-foreground mb-0.5" />
                  <p className="text-xs font-bold">{currentRide.distance} km</p>
                  <p className="text-[9px] text-muted-foreground">Distance</p>
                </div>
                <div className="bg-muted/50 rounded-lg p-2 text-center">
                  <DollarSign className="w-3.5 h-3.5 mx-auto text-amber-500 mb-0.5" />
                  <p className="text-xs font-bold text-amber-600 dark:text-amber-400">{formatShortGNF(currentRide.estimatedFare)}</p>
                  <p className="text-[9px] text-muted-foreground">Tarif</p>
                </div>
              </div>

              {/* Passenger info */}
              {currentRide.passenger && (
                <div className="flex items-center justify-between p-2.5 bg-muted/40 rounded-lg">
                  <div className="flex items-center gap-2.5">
                    <Avatar className="w-8 h-8">
                      <AvatarFallback className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200 text-[10px] font-bold">
                        {currentRide.passenger.name.split(' ').map((n) => n[0]).join('')}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-xs font-semibold">{currentRide.passenger.name}</p>
                      <div className="flex items-center gap-0.5">
                        <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
                        <span className="text-[10px] text-muted-foreground">{currentRide.passenger.rating}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Button size="icon" variant="outline" className="w-8 h-8 rounded-full">
                      <Phone className="w-3.5 h-3.5 text-emerald-600" />
                    </Button>
                    <Button size="icon" variant="outline" className="w-8 h-8 rounded-full">
                      <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
                    </Button>
                  </div>
                </div>
              )}

              {/* Action buttons */}
              <div className="flex gap-2">
                {currentRideStep === 'pickup' && (
                  <Button onClick={() => onRideAction('ride')} className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white">
                    <Navigation className="w-4 h-4 mr-2" />
                    Arrive au point de depart
                  </Button>
                )}
                {currentRideStep === 'ride' && (
                  <Button onClick={() => onRideAction('complete')} className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white">
                    <Check className="w-4 h-4 mr-2" />
                    Terminer la course
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Available Rides */}
      <motion.div variants={staggerItem}>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Zap className="w-4 h-4 text-amber-500" />
            Courses disponibles
          </h3>
          {availableRides.length > 0 && (
            <Badge variant="secondary" className="text-[10px] bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
              {availableRides.length} courses
            </Badge>
          )}
        </div>

        {!isDriverOnline ? (
          <Card className="border-0 shadow-sm">
            <CardContent className="py-8 text-center">
              <Car className="w-10 h-10 mx-auto text-muted-foreground/40 mb-2" />
              <p className="text-sm text-muted-foreground">Connectez-vous pour voir les courses disponibles</p>
            </CardContent>
          </Card>
        ) : availableRides.length === 0 ? (
          <Card className="border-0 shadow-sm">
            <CardContent className="py-8 text-center">
              <Clock className="w-10 h-10 mx-auto text-muted-foreground/40 mb-2" />
              <p className="text-sm text-muted-foreground">Aucune course disponible pour le moment</p>
              <p className="text-xs text-muted-foreground/60 mt-1">Patientez, de nouvelles courses arrivent bientot</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3 max-h-[400px] overflow-y-auto mova-scrollbar pr-1">
            {availableRides.map((ride, idx) => (
              <motion.div
                key={ride.id}
                variants={cardVariants}
                initial="initial"
                animate="animate"
                transition={{ delay: idx * 0.1 }}
              >
                <Card className="border-0 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
                  <CardContent className="p-4 space-y-3">
                    {/* Route */}
                    <div className="space-y-1.5">
                      <div className="flex items-start gap-2">
                        <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 mt-0.5 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{ride.pickupAddress}</p>
                          <Badge variant="outline" className="text-[8px] px-1 py-0">{ride.pickupZone}</Badge>
                        </div>
                      </div>
                      <div className="ml-1 border-l-2 border-dashed border-muted-foreground/30 h-3" />
                      <div className="flex items-start gap-2">
                        <div className="w-2.5 h-2.5 rounded-sm bg-red-500 mt-0.5 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{ride.dropoffAddress}</p>
                          <Badge variant="outline" className="text-[8px] px-1 py-0">{ride.dropoffZone}</Badge>
                        </div>
                      </div>
                    </div>

                    {/* Info row */}
                    <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />{ride.duration} min
                      </span>
                      <span className="flex items-center gap-1">
                        <Route className="w-3 h-3" />{ride.distance} km
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />{formatCountdown(rideTimers[ride.id] ?? 0)}
                      </span>
                    </div>

                    {/* Bottom row: fare + actions */}
                    <div className="flex items-center justify-between">
                      <span className="text-base font-bold text-amber-600 dark:text-amber-400">
                        {formatGNF(ride.estimatedFare)}
                      </span>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => onDecline(ride)}
                          className="text-xs h-8 px-3"
                        >
                          <X className="w-3.5 h-3.5 mr-1" />
                          Refuser
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => onAccept(ride)}
                          className="text-xs h-8 px-3 bg-emerald-600 hover:bg-emerald-700 text-white"
                        >
                          <Check className="w-3.5 h-3.5 mr-1" />
                          Accepter
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>

      {/* Ride History */}
      <motion.div variants={staggerItem}>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Clock className="w-4 h-4 text-muted-foreground" />
            Historique des courses
          </h3>
          <Button variant="ghost" size="sm" className="text-[10px] text-muted-foreground h-7" onClick={() => onShowFullHistory()}>
            Voir tout <ChevronRight className="w-3 h-3 ml-0.5" />
          </Button>
        </div>

        {/* Error banner for ride history */}
        {isError && (
          <div className="flex items-center gap-3 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 mb-2">
            <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
            <p className="text-[10px] text-red-600 dark:text-red-400 flex-1">Erreur de chargement - donnees de demonstration affichees</p>
            {onRetry && (
              <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px] text-red-600 dark:text-red-400" onClick={onRetry}>
                <RefreshCw className="w-3 h-3 mr-1" />
                Reessayer
              </Button>
            )}
          </div>
        )}

        <Card className="border-0 shadow-sm">
          <CardContent className="p-0">
            {isLoadingHistory ? (
              <div className="divide-y divide-border p-4 space-y-4">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="flex items-center gap-3">
                    <Skeleton className="w-9 h-9 rounded-full" />
                    <div className="flex-1 space-y-1.5">
                      <Skeleton className="h-3 w-full max-w-[180px]" />
                      <Skeleton className="h-2.5 w-24" />
                    </div>
                    <Skeleton className="h-4 w-14" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="divide-y divide-border">
                {rideHistory.length === 0 ? (
                  <div className="py-8 text-center">
                    <Clock className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">Aucune course terminee</p>
                    <p className="text-xs text-muted-foreground/60 mt-1">Vos courses terminees apparaitront ici</p>
                  </div>
                ) : (
                  rideHistory.map((ride) => (
                    <div key={ride.id} className="px-4 py-3 flex items-center gap-3 hover:bg-muted/30 transition-colors">
                      <div className="w-9 h-9 rounded-full bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center shrink-0">
                        <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-medium truncate">{ride.from}</span>
                          <ChevronRight className="w-3 h-3 text-muted-foreground shrink-0" />
                          <span className="text-xs font-medium truncate">{ride.to}</span>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] text-muted-foreground">{ride.date}</span>
                          <div className="flex items-center gap-0.5">
                            <Star className="w-2.5 h-2.5 text-amber-500 fill-amber-500" />
                            <span className="text-[10px] text-muted-foreground">Donne: {ride.ratingGiven} / Recu: {ride.ratingReceived}</span>
                          </div>
                        </div>
                      </div>
                      <span className="text-sm font-bold text-amber-600 dark:text-amber-400 shrink-0">
                        {formatShortGNF(ride.fare)}
                      </span>
                    </div>
                  ))
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  )
}

// ═══════════════════════════════════════════════════════════════════════
// TAB 3: REVENUS
// ═══════════════════════════════════════════════════════════════════════

function EarningsTab({ driverEarnings, weeklyEarnings, maxWeeklyEarnings, totalWeeklyEarnings, paymentBreakdown, totalPayments, onPayout, completedRidesCount }: {
  driverEarnings: number
  weeklyEarnings: { day: string; amount: number }[]
  maxWeeklyEarnings: number
  totalWeeklyEarnings: number
  paymentBreakdown: { type: string; amount: number; color: string; textColor: string }[]
  totalPayments: number
  onPayout: () => void
  completedRidesCount: number
}) {
  return (
    <motion.div variants={staggerContainer} initial="initial" animate="animate" className="space-y-4">
      {/* Today's Earnings - Big Card */}
      <motion.div variants={staggerItem}>
        <Card className="border-0 shadow-md overflow-hidden">
          <div className="mova-gradient p-6 text-white">
            <p className="text-sm text-white/70 font-medium">Revenus aujourd&apos;hui</p>
            <div className="flex items-end gap-2 mt-1">
              <span className="text-3xl font-bold">{formatGNF(driverEarnings)}</span>
              <div className="flex items-center gap-0.5 mb-1.5 bg-white/20 rounded-full px-2 py-0.5">
                <ArrowUp className="w-3 h-3" />
                <span className="text-[11px] font-medium">+12%</span>
              </div>
            </div>
            <p className="text-xs text-white/60 mt-1">vs hier a la meme heure</p>
          </div>
        </Card>
      </motion.div>

      {/* Weekly Chart */}
      <motion.div variants={staggerItem}>
        <Card className="border-0 shadow-sm">
          <CardHeader className="px-5 pt-4 pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4.5 h-4.5 text-emerald-600 dark:text-emerald-400" />
                <CardTitle className="text-sm font-semibold">Revenus hebdomadaires</CardTitle>
              </div>
              <Badge variant="secondary" className="text-[10px] font-semibold">
                Total: {formatGNF(totalWeeklyEarnings)}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="px-5 pb-4">
            <div className="flex items-end justify-between gap-2 h-36">
              {weeklyEarnings.map((d, i) => {
                const isToday = i === new Date().getDay() - 1 || (new Date().getDay() === 0 && i === 6)
                const pct = (d.amount / maxWeeklyEarnings) * 100
                return (
                  <div key={i} className="flex flex-col items-center gap-1 flex-1">
                    <span className="text-[9px] font-medium text-muted-foreground">{formatShortGNF(d.amount)}</span>
                    <motion.div
                      className="w-full rounded-t-lg relative group cursor-pointer"
                      initial={{ height: 0 }}
                      animate={{ height: `${Math.max(pct, 6)}%` }}
                      transition={{ duration: 0.7, delay: i * 0.08, ease: 'easeOut' }}
                    >
                      <div className={`absolute inset-0 rounded-t-lg ${isToday ? 'bg-gradient-to-t from-emerald-600 to-emerald-400' : 'bg-gradient-to-t from-emerald-500/60 to-emerald-400/40'}`} />
                      {isToday && (
                        <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-emerald-300" />
                      )}
                    </motion.div>
                    <span className={`text-[10px] font-medium ${isToday ? 'text-emerald-600 dark:text-emerald-400 font-bold' : 'text-muted-foreground'}`}>
                      {d.day}
                    </span>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Payment Breakdown (Donut-style) */}
      <motion.div variants={staggerItem}>
        <Card className="border-0 shadow-sm">
          <CardHeader className="px-5 pt-4 pb-2">
            <div className="flex items-center gap-2">
              <Wallet className="w-4.5 h-4.5 text-amber-600 dark:text-amber-400" />
              <CardTitle className="text-sm font-semibold">Repartition des paiements</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="px-5 pb-4">
            <div className="flex items-center gap-6">
              {/* Donut chart */}
              <div className="relative w-28 h-28 shrink-0">
                <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                  {paymentBreakdown.map((p, i) => {
                    const pct = totalPayments > 0 ? (p.amount / totalPayments) * 100 : 0
                    const offset = i === 0 ? 0 : paymentBreakdown.slice(0, i).reduce((sum, prev) => sum + (totalPayments > 0 ? (prev.amount / totalPayments) * 100 : 0), 0)
                    return (
                      <circle
                        key={i}
                        cx="18" cy="18" r="14"
                        fill="none"
                        stroke={p.color === 'bg-amber-500' ? '#f59e0b' : p.color === 'bg-orange-500' ? '#f97316' : '#10b981'}
                        strokeWidth="5"
                        strokeDasharray={`${pct} ${100 - pct}`}
                        strokeDashoffset={`${-offset}`}
                        strokeLinecap="round"
                      />
                    )
                  })}
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-xs font-bold">{formatShortGNF(totalPayments)}</span>
                  <span className="text-[9px] text-muted-foreground">Total</span>
                </div>
              </div>
              {/* Legend */}
              <div className="flex-1 space-y-2.5">
                {paymentBreakdown.map((p, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-sm ${p.color}`} />
                      <span className="text-xs font-medium">{p.type}</span>
                    </div>
                    <div className="text-right">
                      <span className={`text-xs font-bold ${p.textColor}`}>{formatGNF(p.amount)}</span>
                      <span className="text-[10px] text-muted-foreground ml-1">{Math.round((p.amount / totalPayments) * 100)}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Bonus Section */}
      <motion.div variants={staggerItem}>
        <Card className="border-0 shadow-sm">
          <CardHeader className="px-5 pt-4 pb-2">
            <div className="flex items-center gap-2">
              <Trophy className="w-4.5 h-4.5 text-amber-600 dark:text-amber-400" />
              <CardTitle className="text-sm font-semibold">Bonus &amp; Gains</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="px-5 pb-4 space-y-2">
            {[
              { label: 'Bonus parrainage', amount: 25000, icon: <Flame className="w-4 h-4 text-orange-500" /> },
              { label: 'Bonus serie (5 jours)', amount: 15000, icon: <Award className="w-4 h-4 text-amber-500" /> },
              { label: 'Bonus missions', amount: 10000, icon: <Target className="w-4 h-4 text-emerald-500" /> },
            ].map((bonus, i) => (
              <div key={i} className="flex items-center justify-between p-2.5 rounded-lg bg-muted/40 hover:bg-muted/60 transition-colors">
                <div className="flex items-center gap-2.5">
                  {bonus.icon}
                  <span className="text-xs font-medium">{bonus.label}</span>
                </div>
                <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">+{formatGNF(bonus.amount)}</span>
              </div>
            ))}
            <Separator />
            <div className="flex items-center justify-between px-1">
              <span className="text-xs font-semibold">Total bonus</span>
              <span className="text-sm font-bold text-amber-600 dark:text-amber-400">{formatGNF(50000)}</span>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Payout Button */}
      <motion.div variants={staggerItem}>
        <Button
          onClick={onPayout}
          className="w-full h-12 bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold rounded-xl shadow-md"
        >
          <Wallet className="w-4.5 h-4.5 mr-2" />
          Retrait disponible: 80 000 GNF
        </Button>
      </motion.div>

      {/* Monthly Summary Grid */}
      <motion.div variants={staggerItem}>
        <div className="flex items-center gap-2 mb-2">
          <BarChart3 className="w-4 h-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">Resume mensuel</h3>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: 'Total courses', value: String(completedRidesCount > 0 ? completedRidesCount : 59), icon: <Navigation className="w-4 h-4 text-emerald-500" /> },
            { label: 'Total revenus', value: completedRidesCount > 0 ? formatGNF(totalWeeklyEarnings) : '1 395 000 GNF', icon: <DollarSign className="w-4 h-4 text-amber-500" /> },
            { label: 'Moyenne / course', value: completedRidesCount > 0 && totalWeeklyEarnings > 0 ? formatGNF(Math.round(totalWeeklyEarnings / completedRidesCount)) : '23 644 GNF', icon: <TrendingUp className="w-4 h-4 text-emerald-500" /> },
            { label: 'Meilleur jour', value: completedRidesCount > 0 ? formatGNF(Math.max(...weeklyEarnings.map((d) => d.amount))) : '320 000 GNF', icon: <Trophy className="w-4 h-4 text-amber-500" /> },
          ].map((item, i) => (
            <Card key={i} className="border-0 shadow-sm">
              <CardContent className="p-3.5">
                <div className="flex items-center gap-2 mb-1.5">
                  {item.icon}
                  <span className="text-[10px] text-muted-foreground font-medium">{item.label}</span>
                </div>
                <p className="text-sm font-bold">{item.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </motion.div>
    </motion.div>
  )
}

// ═══════════════════════════════════════════════════════════════════════
// TAB 4: PROFIL
// ═══════════════════════════════════════════════════════════════════════

function ProfileTab({ user, driverInitials, vehicleData, editVehicle, setEditVehicle, setVehicleData, onSaveVehicle, documents, validDocs, currentTier, nextTier, tierProgress, totalRides, prefLongDistance, setPrefLongDistance, prefShared, setPrefShared, prefSound, setPrefSound, prefZone, setPrefZone, onLogout, driverRating, profileCompletion }: {
  user: { name: string; rating: number; totalRides: number } | null
  driverInitials: string
  vehicleData: { brand: string; model: string; plate: string; color: string; year: string; type: string }
  editVehicle: boolean
  setEditVehicle: (v: boolean) => void
  setVehicleData: React.Dispatch<React.SetStateAction<{ brand: string; model: string; plate: string; color: string; year: string; type: string }>>
  onSaveVehicle: () => void
  documents: { name: string; status: string; expiry: string }[]
  validDocs: number
  currentTier: GamificationTier
  nextTier: GamificationTier | null
  tierProgress: number
  totalRides: number
  prefLongDistance: boolean
  setPrefLongDistance: (v: boolean) => void
  prefShared: boolean
  setPrefShared: (v: boolean) => void
  prefSound: boolean
  setPrefSound: (v: boolean) => void
  prefZone: string
  setPrefZone: (v: string) => void
  onLogout: () => void
  driverRating: number
  profileCompletion: number
}) {
  const [showEmergency, setShowEmergency] = useState(false)

  return (
    <motion.div variants={staggerContainer} initial="initial" animate="animate" className="space-y-4">
      {/* Driver Card */}
      <motion.div variants={staggerItem}>
        <Card className="border-0 shadow-md overflow-hidden">
          <div className="mova-gradient p-5 text-white">
            <div className="flex items-center gap-4">
              <Avatar className="w-16 h-16 border-3 border-white/30 shadow-lg">
                <AvatarFallback className="bg-white/20 text-white text-lg font-bold">
                  {driverInitials}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <h2 className="text-lg font-bold">{user?.name ?? 'Chauffeur MOVA'}</h2>
                <div className="flex items-center gap-1 mt-0.5">
                  <Star className="w-4 h-4 text-amber-300 fill-amber-300" />
                  <span className="text-sm font-medium">{driverRating.toFixed(1)}</span>
                  <span className="text-xs text-white/60">({user?.totalRides ?? 50} courses)</span>
                </div>
                <div className="flex items-center gap-2 mt-1.5">
                  <Badge className="bg-white/20 text-white border-white/30 text-[10px]">
                    <Car className="w-3 h-3 mr-1" />
                    {vehicleData.brand} {vehicleData.model}
                  </Badge>
                  <Badge className="bg-white/20 text-white border-white/30 text-[10px]">
                    {vehicleData.plate}
                  </Badge>
                </div>
              </div>
            </div>
            {/* Profile completion bar */}
            <div className="mt-4 bg-white/15 rounded-lg px-4 py-3">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-medium text-white/90">Completion du profil</span>
                <span className={`text-xs font-bold ${profileCompletion >= 100 ? 'text-emerald-300' : profileCompletion >= 50 ? 'text-amber-300' : 'text-white/70'}`}>
                  {profileCompletion}%
                </span>
              </div>
              <div className="w-full bg-white/20 rounded-full h-2">
                <motion.div
                  className={`h-2 rounded-full ${profileCompletion >= 100 ? 'bg-emerald-400' : profileCompletion >= 50 ? 'bg-amber-400' : 'bg-white/60'}`}
                  initial={{ width: 0 }}
                  animate={{ width: `${profileCompletion}%` }}
                  transition={{ duration: 0.8, ease: 'easeOut' }}
                />
              </div>
              {profileCompletion < 100 && (
                <p className="text-[10px] text-white/60 mt-1.5">
                  {profileCompletion < 25 && 'Complétez les informations de votre véhicule pour commencer'}
                  {profileCompletion >= 25 && profileCompletion < 50 && 'Validez vos documents pour augmenter votre score'}
                  {profileCompletion >= 50 && profileCompletion < 75 && 'Complétez votre première course pour progresser'}
                  {profileCompletion >= 75 && 'Presque terminé ! Complétez 10 courses pour atteindre 100%'}
                </p>
              )}
              {profileCompletion >= 100 && (
                <p className="text-[10px] text-emerald-300 mt-1.5">
                  Profil complet ! Vous êtes un chauffeur MOVA vérifié.
                </p>
              )}
            </div>
          </div>
        </Card>
      </motion.div>

      {/* Vehicle Section */}
      <motion.div variants={staggerItem}>
        <Card className="border-0 shadow-sm">
          <CardHeader className="px-5 pt-4 pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Car className="w-4.5 h-4.5 text-emerald-600 dark:text-emerald-400" />
                <CardTitle className="text-sm font-semibold">Vehicule</CardTitle>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => editVehicle ? onSaveVehicle() : setEditVehicle(true)}
                className="text-[10px] h-7 text-emerald-600 dark:text-emerald-400"
              >
                {editVehicle ? (
                  <><Check className="w-3 h-3 mr-1" /> Enregistrer</>
                ) : (
                  <><Settings className="w-3 h-3 mr-1" /> Modifier</>
                )}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="px-5 pb-4">
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Marque', field: 'brand' as const },
                { label: 'Modele', field: 'model' as const },
                { label: 'Immatriculation', field: 'plate' as const },
                { label: 'Couleur', field: 'color' as const },
                { label: 'Annee', field: 'year' as const },
                { label: 'Type', field: 'type' as const },
              ].map((item) => (
                <div key={item.field} className="bg-muted/40 rounded-lg p-2.5">
                  <p className="text-[10px] text-muted-foreground">{item.label}</p>
                  {editVehicle ? (
                    <input
                      value={vehicleData[item.field]}
                      onChange={(e) => setVehicleData((prev) => ({ ...prev, [item.field]: e.target.value }))}
                      className="text-xs font-medium bg-transparent border-b border-emerald-300 focus:border-emerald-500 outline-none w-full mt-0.5 dark:text-foreground"
                    />
                  ) : (
                    <p className="text-xs font-semibold mt-0.5">{vehicleData[item.field]}</p>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Documents Section */}
      <motion.div variants={staggerItem}>
        <Card className="border-0 shadow-sm">
          <CardHeader className="px-5 pt-4 pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="w-4.5 h-4.5 text-emerald-600 dark:text-emerald-400" />
                <CardTitle className="text-sm font-semibold">Documents</CardTitle>
              </div>
              <Badge variant="secondary" className={`text-[10px] ${validDocs === documents.length ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'}`}>
                {validDocs}/{documents.length} valides
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="px-5 pb-4 space-y-2">
            <Progress value={(validDocs / documents.length) * 100} className="h-1.5 mb-3" />
            {documents.map((doc, i) => (
              <div key={i} className="flex items-center justify-between p-2.5 rounded-lg bg-muted/40">
                <div className="flex items-center gap-2.5">
                  {doc.status === 'valid' ? (
                    <div className="w-7 h-7 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                      <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    </div>
                  ) : doc.status === 'expiring' ? (
                    <div className="w-7 h-7 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                      <Shield className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                    </div>
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                      <X className="w-4 h-4 text-red-600 dark:text-red-400" />
                    </div>
                  )}
                  <div>
                    <p className="text-xs font-medium">{doc.name}</p>
                    {doc.expiry && (
                      <p className="text-[10px] text-muted-foreground">Expire: {doc.expiry}</p>
                    )}
                  </div>
                </div>
                <Badge variant="outline" className={`text-[9px] ${
                  doc.status === 'valid'
                    ? 'border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400'
                    : doc.status === 'expiring'
                      ? 'border-amber-200 dark:border-amber-800 text-amber-600 dark:text-amber-400'
                      : 'border-red-200 dark:border-red-800 text-red-600 dark:text-red-400'
                }`}>
                  {doc.status === 'valid' ? 'Valide' : doc.status === 'expiring' ? 'Expire bientot' : 'Manquant'}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </motion.div>

      {/* Preferences */}
      <motion.div variants={staggerItem}>
        <Card className="border-0 shadow-sm">
          <CardHeader className="px-5 pt-4 pb-2">
            <div className="flex items-center gap-2">
              <Settings className="w-4.5 h-4.5 text-muted-foreground" />
              <CardTitle className="text-sm font-semibold">Preferences</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="px-5 pb-4 space-y-3">
            {[
              { label: 'Course longue distance', checked: prefLongDistance, onChange: setPrefLongDistance, desc: 'Accepter les trajets de plus de 15 km' },
              { label: 'Course partagee', checked: prefShared, onChange: setPrefShared, desc: 'Partager votre trajet avec d\'autres passagers' },
              { label: 'Notifications sonores', checked: prefSound, onChange: setPrefSound, desc: 'Son pour les nouvelles demandes de course' },
            ].map((pref, i) => (
              <div key={i} className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium">{pref.label}</p>
                  <p className="text-[10px] text-muted-foreground">{pref.desc}</p>
                </div>
                <Switch checked={pref.checked} onCheckedChange={pref.onChange} className="data-[state=checked]:bg-emerald-500" />
              </div>
            ))}
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium">Zone de preference</p>
                <p className="text-[10px] text-muted-foreground">Zone de travail principale</p>
              </div>
              <Select value={prefZone} onValueChange={setPrefZone}>
                <SelectTrigger className="w-[140px] h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="kaloum">Kaloum</SelectItem>
                  <SelectItem value="ratoma">Ratoma</SelectItem>
                  <SelectItem value="matam">Matam</SelectItem>
                  <SelectItem value="matoto">Matoto</SelectItem>
                  <SelectItem value="dixinn">Dixinn</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Gamification Tier */}
      <motion.div variants={staggerItem}>
        <Card className="border-0 shadow-sm">
          <CardHeader className="px-5 pt-4 pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Award className="w-4.5 h-4.5 text-amber-600 dark:text-amber-400" />
                <CardTitle className="text-sm font-semibold">Niveau chauffeur</CardTitle>
              </div>
              <Badge className={`text-[9px] border-0 ${currentTier.bg} ${currentTier.color}`}>
                {currentTier.name}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="px-5 pb-4">
            <div className="flex items-center gap-3 mb-3">
              <div className={`w-12 h-12 rounded-xl ${currentTier.bg} flex items-center justify-center`}>
                <Trophy className={`w-6 h-6 ${currentTier.color}`} />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <p className={`text-sm font-bold ${currentTier.color}`}>{currentTier.name}</p>
                  <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 text-[9px] border-0">
                    <Navigation className="w-3 h-3 mr-1" />{totalRides} courses
                  </Badge>
                </div>
                {nextTier ? (
                  <p className="text-[10px] text-muted-foreground mt-0.5">{totalRides} / {nextTier.minRides} courses pour {nextTier.name}</p>
                ) : (
                  <p className="text-[10px] text-muted-foreground mt-0.5">Niveau maximum atteint !</p>
                )}
              </div>
            </div>
            <div className="w-full bg-muted rounded-full h-2.5 mb-3">
              <motion.div
                className={`h-2.5 rounded-full ${tierProgress >= 100 ? 'bg-gradient-to-r from-emerald-500 to-emerald-400' : 'bg-gradient-to-r from-amber-500 to-amber-400'}`}
                initial={{ width: 0 }}
                animate={{ width: `${tierProgress}%` }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
              />
            </div>
            <div className="grid grid-cols-4 gap-1 mb-3">
              {GAMIFICATION_TIERS.map((tier, i) => {
                const isActive = tier.name === currentTier.name
                const isPast = GAMIFICATION_TIERS.indexOf(currentTier) > i
                return (
                  <div key={i} className={`flex flex-col items-center gap-0.5 p-1.5 rounded-lg ${isActive ? tier.bg : isPast ? 'bg-muted/50' : 'bg-muted/20'}`}>
                    <Trophy className={`w-3.5 h-3.5 ${isActive ? tier.color : isPast ? 'text-muted-foreground' : 'text-muted-foreground/50'}`} />
                    <span className={`text-[8px] font-medium ${isActive ? tier.color : 'text-muted-foreground'}`}>{tier.name}</span>
                  </div>
                )
              })}
            </div>
            {/* Perks for current tier */}
            <div className="bg-muted/30 rounded-lg p-3">
              <p className={`text-[10px] font-semibold mb-1.5 ${currentTier.color}`}>Avantages {currentTier.name}</p>
              <div className="space-y-1">
                {currentTier.perks.map((perk, i) => (
                  <div key={i} className="flex items-center gap-1.5">
                    <Check className="w-3 h-3 text-emerald-500 shrink-0" />
                    <span className="text-[10px] text-muted-foreground">{perk}</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Support */}
      <motion.div variants={staggerItem}>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4 space-y-2">
            <Button variant="outline" className="w-full justify-start h-10 text-xs gap-2.5">
              <Shield className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              Centre d&apos;aide
              <ChevronRight className="w-3.5 h-3.5 ml-auto text-muted-foreground" />
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start h-10 text-xs gap-2.5 border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
              onClick={() => setShowEmergency(true)}
            >
              <Shield className="w-4 h-4" />
              Alerte d&apos;urgence
              <ChevronRight className="w-3.5 h-3.5 ml-auto" />
            </Button>
            <Button variant="outline" className="w-full justify-start h-10 text-xs gap-2.5">
              <MessageCircle className="w-4 h-4 text-muted-foreground" />
              Signaler un probleme
              <ChevronRight className="w-3.5 h-3.5 ml-auto text-muted-foreground" />
            </Button>
          </CardContent>
        </Card>
      </motion.div>

      {/* Logout */}
      <motion.div variants={staggerItem}>
        <Button
          variant="outline"
          className="w-full h-10 text-xs gap-2 border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
          onClick={onLogout}
        >
          <LogOut className="w-4 h-4" />
          Deconnexion
        </Button>
      </motion.div>

      {/* Emergency Dialog */}
      <Dialog open={showEmergency} onOpenChange={setShowEmergency}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-red-600 flex items-center gap-2">
              <Shield className="w-5 h-5" />
              Alerte d&apos;urgence
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <p className="text-sm text-muted-foreground">Choisissez un service d&apos;urgence à contacter :</p>
            <Button
              className="w-full justify-start gap-3 h-12 text-sm font-medium"
              variant="outline"
              onClick={() => { window.open('tel:117', '_self'); setShowEmergency(false) }}
            >
              <div className="w-9 h-9 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
                <Shield className="w-4 h-4 text-blue-600" />
              </div>
              <div className="text-left">
                <p className="font-semibold">Appeler la Police</p>
                <p className="text-xs text-muted-foreground">117</p>
              </div>
            </Button>
            <Button
              className="w-full justify-start gap-3 h-12 text-sm font-medium"
              variant="outline"
              onClick={() => { window.open('tel:115', '_self'); setShowEmergency(false) }}
            >
              <div className="w-9 h-9 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center shrink-0">
                <Shield className="w-4 h-4 text-red-600" />
              </div>
              <div className="text-left">
                <p className="font-semibold">Appeler le SAMU</p>
                <p className="text-xs text-muted-foreground">115</p>
              </div>
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </motion.div>
  )
}
