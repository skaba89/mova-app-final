'use client'

import { useState, useMemo, useEffect, useCallback } from 'react'
import { useAppStore } from '@/lib/mova/store'
import { toast } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  ArrowLeft,
  MapPin,
  Clock,
  Bus,
  Car,
  CheckCircle2,
  ArrowRight,
  Route,
  Star,
  Shield,
  Zap,
  ChevronLeft,
  ChevronRight,
  Loader2,
  AlertCircle,
  Plane,
  Users,
  CreditCard,
  Wallet,
  Smartphone,
  X,
  Calendar,
  Navigation,
  Search,
  History,
  Trash2,
  Copy,
  ChevronDown,
  Ticket,
  TrendingUp,
} from 'lucide-react'

// ─── Constants ───────────────────────────────────────────────────────────────────

const GUINEAN_CITIES = [
  'Conakry', 'Kindia', 'Labe', 'Kankan', 'Mamou', 'Nzerekore', 'Boke', 'Faranah', 'Siguiri', 'Kissidougou',
]

const DISTANCE_MATRIX: Record<string, Record<string, number>> = {
  Conakry:     { Kindia: 135, Labe: 450, Kankan: 590, Mamou: 310, Nzerekore: 970, Boke: 250, Faranah: 500, Siguiri: 700, Kissidougou: 515 },
  Kindia:      { Conakry: 135, Labe: 315, Kankan: 455, Mamou: 175, Nzerekore: 835, Boke: 310, Faranah: 370, Siguiri: 570, Kissidougou: 380 },
  Labe:        { Conakry: 450, Kindia: 315, Kankan: 200, Mamou: 140, Nzerekore: 520, Boke: 200, Faranah: 260, Siguiri: 400, Kissidougou: 300 },
  Kankan:      { Conakry: 590, Kindia: 455, Labe: 200, Mamou: 280, Nzerekore: 380, Boke: 400, Faranah: 140, Siguiri: 210, Kissidougou: 200 },
  Mamou:       { Conakry: 310, Kindia: 175, Labe: 140, Kankan: 280, Nzerekore: 660, Boke: 310, Faranah: 190, Siguiri: 420, Kissidougou: 260 },
  Nzerekore:   { Conakry: 970, Kindia: 835, Labe: 520, Kankan: 380, Mamou: 660, Boke: 780, Faranah: 470, Siguiri: 340, Kissidougou: 310 },
  Boke:        { Conakry: 250, Kindia: 310, Labe: 200, Kankan: 400, Mamou: 310, Nzerekore: 780, Faranah: 340, Siguiri: 530, Kissidougou: 500 },
  Faranah:     { Conakry: 500, Kindia: 370, Labe: 260, Kankan: 140, Mamou: 190, Nzerekore: 470, Boke: 340, Siguiri: 250, Kissidougou: 170 },
  Siguiri:     { Conakry: 700, Kindia: 570, Labe: 400, Kankan: 210, Mamou: 420, Nzerekore: 340, Boke: 530, Faranah: 250, Kissidougou: 250 },
  Kissidougou: { Conakry: 515, Kindia: 380, Labe: 300, Kankan: 200, Mamou: 260, Nzerekore: 310, Boke: 500, Faranah: 170, Siguiri: 250 },
}

const VEHICLE_TYPES = [
  { id: 'bus_climatise', label: 'Bus climatise', icon: Bus, multiplier: 1, seats: 49, desc: 'Climatise, confortable', basePerKm: 150 },
  { id: 'minibus', label: 'Minibus', icon: Users, multiplier: 1.4, seats: 18, desc: 'Rapide et flexible', basePerKm: 250 },
  { id: '4x4', label: '4x4', icon: Car, multiplier: 2.2, seats: 6, desc: 'Tout-terrain, premium', basePerKm: 500 },
  { id: 'partage', label: 'Partage', icon: Users, multiplier: 0.8, seats: 4, desc: 'Economique, 4 passagers', basePerKm: 120 },
]

const DEPARTURE_TIMES = [
  '05:00', '06:00', '07:00', '08:00', '09:00', '10:00', '11:00', '12:00',
  '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00',
]

const POPULAR_ROUTES = [
  { from: 'Conakry', to: 'Kindia', demand: 'high' },
  { from: 'Conakry', to: 'Labe', demand: 'high' },
  { from: 'Conakry', to: 'Kankan', demand: 'medium' },
  { from: 'Conakry', to: 'Mamou', demand: 'medium' },
  { from: 'Conakry', to: 'Boke', demand: 'high' },
  { from: 'Conakry', to: 'Nzerekore', demand: 'low' },
  { from: 'Kindia', to: 'Labe', demand: 'medium' },
  { from: 'Labe', to: 'Kankan', demand: 'low' },
  { from: 'Kankan', to: 'Nzerekore', demand: 'low' },
  { from: 'Faranah', to: 'Kissidougou', demand: 'medium' },
]

const PAYMENT_METHODS = [
  { id: 'cash', label: 'Cash', icon: CreditCard },
  { id: 'mobile_money', label: 'Mobile Money', icon: Smartphone },
  { id: 'wallet', label: 'Wallet MOVA', icon: Wallet },
]

interface DemoBooking {
  id: string
  from: string
  to: string
  date: string
  time: string
  vehicleType: string
  seats: number
  price: number
  status: 'confirmed' | 'completed' | 'cancelled'
  ref: string
  passengerName: string
  passengerPhone: string
}

const DEMO_BOOKINGS: DemoBooking[] = [
  { id: 'b1', from: 'Conakry', to: 'Kindia', date: '2025-01-10', time: '07:00', vehicleType: 'bus_climatise', seats: 1, price: 37500, status: 'completed', ref: 'INT-CKK-7842', passengerName: 'Abdoulaye Camara', passengerPhone: '+224 661 00 01 00' },
  { id: 'b2', from: 'Conakry', to: 'Labe', date: '2025-01-15', time: '06:00', vehicleType: 'minibus', seats: 2, price: 315000, status: 'completed', ref: 'INT-CKL-3917', passengerName: 'Abdoulaye Camara', passengerPhone: '+224 661 00 01 00' },
  { id: 'b3', from: 'Conakry', to: 'Boke', date: '2025-01-22', time: '08:00', vehicleType: '4x4', seats: 1, price: 110000, status: 'cancelled', ref: 'INT-CKB-5521', passengerName: 'Abdoulaye Camara', passengerPhone: '+224 661 00 01 00' },
  { id: 'b4', from: 'Conakry', to: 'Mamou', date: '2025-02-05', time: '07:00', vehicleType: 'bus_climatise', seats: 1, price: 46500, status: 'completed', ref: 'INT-CKM-1289', passengerName: 'Abdoulaye Camara', passengerPhone: '+224 661 00 01 00' },
]

// ─── Helpers ─────────────────────────────────────────────────────────────────────

function formatGNF(amount: number) {
  return new Intl.NumberFormat('fr-FR').format(amount) + ' GNF'
}

function getDistance(from: string, to: string): number {
  if (from === to) return 0
  return DISTANCE_MATRIX[from]?.[to] ?? 300
}

function getDuration(distance: number): string {
  const hours = Math.max(1, Math.round(distance / 60))
  if (hours >= 8) {
    const h = Math.floor(hours / 1)
    const m = Math.round((distance / 60 - h) * 60)
    return m > 0 ? `${h}h${m.toString().padStart(2, '0')}` : `${h}h`
  }
  return `${hours}h`
}

function calculatePrice(distance: number, vehicleId: string, seats: number): number {
  const v = VEHICLE_TYPES.find(vt => vt.id === vehicleId) ?? VEHICLE_TYPES[0]
  const base = 15000 + distance * v.basePerKm
  return Math.round(base * v.multiplier * seats)
}

function generateRef(): string {
  const chars = '0123456789'
  let num = ''
  for (let i = 0; i < 4; i++) num += chars[Math.floor(Math.random() * chars.length)]
  return `INT-MVA-${num}`
}

// ─── Types ───────────────────────────────────────────────────────────────────────

interface ApiRoute {
  route: string
  departure: string
  arrival: string
  distance: number
  fares: Record<string, number>
}

interface AvailableTrip {
  id: string
  from: string
  to: string
  distance: number
  duration: string
  vehicleType: string
  departureTime: string
  availableSeats: number
  pricePerSeat: number
  operator: string
}

// ─── Component ───────────────────────────────────────────────────────────────────

export default function IntercityView() {
  const { goBack, user } = useAppStore()

  // ─── State ─────────────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState('search')
  const [departureCity, setDepartureCity] = useState('Conakry')
  const [arrivalCity, setArrivalCity] = useState('')
  const [travelDate, setTravelDate] = useState('')
  const [travelTime, setTravelTime] = useState('')
  const [passengerCount, setPassengerCount] = useState(1)
  const [vehicleType, setVehicleType] = useState('bus_climatise')

  // Steps: search -> results -> booking -> confirmation
  const [step, setStep] = useState<'search' | 'results' | 'booking' | 'confirmation'>('search')
  const [selectedTrip, setSelectedTrip] = useState<AvailableTrip | null>(null)
  const [showBookingDialog, setShowBookingDialog] = useState(false)

  // Booking form
  const [passengerName, setPassengerName] = useState('')
  const [passengerPhone, setPassengerPhone] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('cash')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // API
  const [isLoadingRoutes, setIsLoadingRoutes] = useState(true)
  const [routesError, setRoutesError] = useState<string | null>(null)
  const [apiRoutes, setApiRoutes] = useState<ApiRoute[] | null>(null)

  // Booking history
  const [bookings, setBookings] = useState<DemoBooking[]>(DEMO_BOOKINGS)
  const [isLoadingHistory, setIsLoadingHistory] = useState(false)

  // Popular routes animation
  const [selectedPopularRoute, setSelectedPopularRoute] = useState<string | null>(null)

  // ─── API: Fetch Routes ────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false
    const fetchRoutes = async () => {
      setIsLoadingRoutes(true)
      setRoutesError(null)
      try {
        const token = localStorage.getItem('mova_token')
        const res = await fetch('/api/mova/intercity', {
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...(user?.id ? { 'x-user-id': user.id } : {}),
          },
        })
        if (!res.ok) throw new Error(`Erreur ${res.status}`)
        const data = await res.json()
        if (cancelled) return
        if (data.routes && Array.isArray(data.routes) && data.routes.length > 0) {
          setApiRoutes(data.routes)
        }
      } catch {
        if (!cancelled) setRoutesError('Impossible de charger les trajets depuis le serveur')
      } finally {
        if (!cancelled) setIsLoadingRoutes(false)
      }
    }
    fetchRoutes()
    return () => { cancelled = true }
  }, [user?.id])

  // ─── Computed ─────────────────────────────────────────────────────────────────
  const vehicleData = useMemo(() => VEHICLE_TYPES.find(v => v.id === vehicleType), [vehicleType])

  const availableArrivals = useMemo(() => {
    if (!departureCity) return GUINEAN_CITIES.filter(c => c !== departureCity)
    return GUINEAN_CITIES.filter(c => c !== departureCity)
  }, [departureCity])

  const distance = useMemo(() => {
    if (!departureCity || !arrivalCity || departureCity === arrivalCity) return 0
    return getDistance(departureCity, arrivalCity)
  }, [departureCity, arrivalCity])

  const duration = useMemo(() => getDuration(distance), [distance])

  const estimatedPrice = useMemo(() => {
    if (!distance) return 0
    return calculatePrice(distance, vehicleType, passengerCount)
  }, [distance, vehicleType, passengerCount])

  // Generate demo available trips based on search
  const availableTrips = useMemo((): AvailableTrip[] => {
    if (!departureCity || !arrivalCity || departureCity === arrivalCity) return []
    if (distance === 0) return []

    const operators = ['Trans Express', 'SATRAC', 'Gare Routiere', 'Mobiba Transport', 'Inter-City Plus']
    const trips: AvailableTrip[] = []
    const seed = (departureCity + arrivalCity).split('').reduce((a, c) => a + c.charCodeAt(0), 0)

    for (let i = 0; i < 8; i++) {
      const timeIdx = (seed + i * 3) % DEPARTURE_TIMES.length
      const vIdx = i % VEHICLE_TYPES.length
      const vt = VEHICLE_TYPES[vIdx]
      const seats = Math.max(1, Math.round(((seed * (i + 1) * 7) % 15) + 1))
      const price = Math.round((15000 + distance * vt.basePerKm) * vt.multiplier)
      trips.push({
        id: `trip-${departureCity.slice(0, 3)}-${arrivalCity.slice(0, 3)}-${i + 1}`,
        from: departureCity,
        to: arrivalCity,
        distance,
        duration: getDuration(distance),
        vehicleType: vt.id,
        departureTime: DEPARTURE_TIMES[timeIdx],
        availableSeats: seats,
        pricePerSeat: price,
        operator: operators[i % operators.length],
      })
    }
    return trips.sort((a, b) => a.departureTime.localeCompare(b.departureTime))
  }, [departureCity, arrivalCity, distance])

  // Popular route cards
  const popularRouteCards = useMemo(() => {
    return POPULAR_ROUTES.map(pr => {
      const dist = getDistance(pr.from, pr.to)
      const dur = getDuration(dist)
      const minPrice = calculatePrice(dist, 'partage', 1)
      const maxPrice = calculatePrice(dist, '4x4', 1)
      return { ...pr, distance: dist, duration: dur, minPrice, maxPrice }
    })
  }, [])

  // ─── Handlers ─────────────────────────────────────────────────────────────────
  const handleSearch = useCallback(() => {
    if (!departureCity || !arrivalCity) {
      toast.error('Veuillez selectionner une ville de depart et d\'arrivee')
      return
    }
    if (departureCity === arrivalCity) {
      toast.error('La ville de depart et d\'arrivee doivent etre differentes')
      return
    }
    if (!travelDate) {
      toast.error('Veuillez selectionner une date de depart')
      return
    }
    const selectedDate = new Date(travelDate)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    if (selectedDate < today) {
      toast.error('La date de depart doit etre dans le futur')
      return
    }
    setStep('results')
  }, [departureCity, arrivalCity, travelDate])

  const handleSelectTrip = useCallback((trip: AvailableTrip) => {
    setSelectedTrip(trip)
    setPassengerName(user?.name ?? '')
    setPassengerPhone(user?.phone ?? '')
    setShowBookingDialog(true)
  }, [user])

  const handleConfirmBooking = useCallback(async () => {
    if (!selectedTrip) return
    if (!passengerName.trim()) {
      toast.error('Veuillez saisir le nom du passager')
      return
    }
    if (!passengerPhone.trim() || passengerPhone.length < 8) {
      toast.error('Veuillez saisir un numero de telephone valide')
      return
    }
    setIsSubmitting(true)

    try {
      const token = localStorage.getItem('mova_token')
      const scheduledFor = `${travelDate}T${selectedTrip.departureTime}:00.000Z`
      const res = await fetch('/api/mova/intercity', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(user?.id ? { 'x-user-id': user.id } : {}),
        },
        body: JSON.stringify({
          departureCity: selectedTrip.from,
          arrivalCity: selectedTrip.to,
          scheduledDate: scheduledFor,
          vehicleType: selectedTrip.vehicleType,
          seats: passengerCount,
          estimatedFare: selectedTrip.pricePerSeat * passengerCount,
        }),
      })
      const data = await res.json()
      if (!data.success) {
        toast.error(data.error || 'Erreur lors de la reservation')
        return
      }
    } catch {
      // Continue with demo booking on API failure
    } finally {
      setIsSubmitting(false)
    }

    // Add to local bookings
    const newBooking: DemoBooking = {
      id: `b${Date.now()}`,
      from: selectedTrip.from,
      to: selectedTrip.to,
      date: travelDate,
      time: selectedTrip.departureTime,
      vehicleType: selectedTrip.vehicleType,
      seats: passengerCount,
      price: selectedTrip.pricePerSeat * passengerCount,
      status: 'confirmed',
      ref: generateRef(),
      passengerName,
      passengerPhone,
    }
    setBookings(prev => [newBooking, ...prev])
    setShowBookingDialog(false)
    setStep('confirmation')
    toast.success('Reservation confirmee ! Un SMS de confirmation sera envoye.')
  }, [selectedTrip, passengerName, passengerPhone, travelDate, passengerCount, user])

  const handleCancelBooking = useCallback((bookingId: string) => {
    setBookings(prev => prev.map(b => b.id === bookingId ? { ...b, status: 'cancelled' as const } : b))
    toast.success('Reservation annulee avec succes.')
  }, [])

  const handleReset = useCallback(() => {
    setStep('search')
    setSelectedTrip(null)
    setArrivalCity('')
    setTravelDate('')
    setTravelTime('')
    setPassengerCount(1)
    setVehicleType('bus_climatise')
  }, [])

  // ─── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background">
      {/* Sticky Header */}
      <div className="sticky top-0 z-40 mova-glass border-b">
        <div className="flex items-center gap-3 px-4 py-3">
          <Button variant="ghost" size="icon" onClick={goBack} className="shrink-0">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-emerald-600 flex items-center justify-center">
              <Plane className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold">Transport Interurbain</h1>
              <p className="text-xs text-muted-foreground">Voyagez partout en Guinee</p>
            </div>
          </div>
        </div>
        {/* Tabs */}
        <div className="px-4 pb-2">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="w-full">
              <TabsTrigger value="search" className="flex-1 gap-1.5">
                <Search className="h-3.5 w-3.5" />
                Rechercher
              </TabsTrigger>
              <TabsTrigger value="history" className="flex-1 gap-1.5">
                <History className="h-3.5 w-3.5" />
                Reservations
                {bookings.length > 0 && (
                  <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 py-0">{bookings.length}</Badge>
                )}
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      <ScrollArea className="h-[calc(100vh-120px)]">
        <div className="p-4 space-y-4 pb-24 max-w-2xl mx-auto">

          {/* SEARCH TAB */}
          {activeTab === 'search' && (
            <AnimatePresence mode="wait">
              {step === 'search' && (
                <motion.div key="search" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-4">

                  {/* Feature cards */}
                  <div className="grid grid-cols-3 gap-3">
                    <Card className="mova-card-hover">
                      <CardContent className="p-3 text-center">
                        <Route className="h-5 w-5 text-emerald-500 mx-auto mb-1" />
                        <p className="text-xs text-muted-foreground">10 destinations</p>
                      </CardContent>
                    </Card>
                    <Card className="mova-card-hover">
                      <CardContent className="p-3 text-center">
                        <Shield className="h-5 w-5 text-amber-500 mx-auto mb-1" />
                        <p className="text-xs text-muted-foreground">Assurance incluse</p>
                      </CardContent>
                    </Card>
                    <Card className="mova-card-hover">
                      <CardContent className="p-3 text-center">
                        <Star className="h-5 w-5 text-amber-500 mx-auto mb-1" />
                        <p className="text-xs text-muted-foreground">Meilleurs prix</p>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Search Form */}
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Search className="h-4 w-4 text-emerald-600" />
                        Rechercher un trajet
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {/* Loading skeleton */}
                      {isLoadingRoutes ? (
                        <div className="space-y-4">
                          <Skeleton className="h-10 w-full" />
                          <Skeleton className="h-10 w-full" />
                          <div className="grid grid-cols-2 gap-3">
                            <Skeleton className="h-10 w-full" />
                            <Skeleton className="h-10 w-full" />
                          </div>
                        </div>
                      ) : (
                        <>
                          {/* Error banner */}
                          {routesError && (
                            <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-xl p-3 flex items-start gap-2">
                              <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                              <p className="text-sm text-amber-700 dark:text-amber-400">{routesError}</p>
                            </div>
                          )}

                          {/* Departure */}
                          <div className="space-y-2">
                            <Label className="text-sm font-medium">Ville de depart</Label>
                            <Select value={departureCity} onValueChange={(v) => { setDepartureCity(v); if (v === arrivalCity) setArrivalCity('') }}>
                              <SelectTrigger className="w-full">
                                <SelectValue placeholder="Choisir la ville de depart" />
                              </SelectTrigger>
                              <SelectContent>
                                {GUINEAN_CITIES.map((city) => (
                                  <SelectItem key={city} value={city}>{city}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          {/* Arrival */}
                          <div className="space-y-2">
                            <Label className="text-sm font-medium">Ville d'arrivee</Label>
                            <Select value={arrivalCity} onValueChange={setArrivalCity}>
                              <SelectTrigger className="w-full">
                                <SelectValue placeholder="Choisir la destination" />
                              </SelectTrigger>
                              <SelectContent>
                                {availableArrivals.map((city) => (
                                  <SelectItem key={city} value={city}>{city}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          {/* Date and Time */}
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-2">
                              <Label className="text-sm font-medium">Date</Label>
                              <Input
                                type="date"
                                value={travelDate}
                                onChange={(e) => setTravelDate(e.target.value)}
                                min={new Date().toISOString().split('T')[0]}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label className="text-sm font-medium">Heure (optionnel)</Label>
                              <Select value={travelTime} onValueChange={setTravelTime}>
                                <SelectTrigger>
                                  <SelectValue placeholder="Toutes" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="all">Toutes les heures</SelectItem>
                                  {DEPARTURE_TIMES.map((t) => (
                                    <SelectItem key={t} value={t}>{t}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>

                          {/* Passengers */}
                          <div className="space-y-2">
                            <Label className="text-sm font-medium">Nombre de passagers</Label>
                            <div className="flex items-center gap-3">
                              <Button variant="outline" size="icon" onClick={() => setPassengerCount(Math.max(1, passengerCount - 1))} disabled={passengerCount <= 1}>
                                <ChevronLeft className="h-4 w-4" />
                              </Button>
                              <div className="flex-1 text-center">
                                <span className="text-2xl font-bold">{passengerCount}</span>
                                <p className="text-xs text-muted-foreground">passager{passengerCount > 1 ? 's' : ''}</p>
                              </div>
                              <Button variant="outline" size="icon" onClick={() => setPassengerCount(Math.min(9, passengerCount + 1))} disabled={passengerCount >= 9}>
                                <ChevronRight className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>

                          {/* Vehicle type */}
                          <div className="space-y-2">
                            <Label className="text-sm font-medium">Type de vehicule</Label>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                              {VEHICLE_TYPES.map((v) => (
                                <button
                                  key={v.id}
                                  onClick={() => setVehicleType(v.id)}
                                  className={`p-3 rounded-xl border-2 text-center transition-all ${
                                    vehicleType === v.id
                                      ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/20'
                                      : 'border-transparent bg-muted hover:bg-muted/80'
                                  }`}
                                >
                                  <v.icon className={`h-5 w-5 mx-auto mb-1 ${vehicleType === v.id ? 'text-emerald-600' : 'text-muted-foreground'}`} />
                                  <p className={`text-xs font-medium ${vehicleType === v.id ? 'text-emerald-700 dark:text-emerald-300' : ''}`}>{v.label}</p>
                                  <p className="text-[10px] text-muted-foreground">{v.seats} places</p>
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* Price estimate */}
                          {departureCity && arrivalCity && distance > 0 && (
                            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-emerald-50 dark:bg-emerald-950/30 rounded-xl p-4">
                              <div className="flex items-center justify-between">
                                <div className="space-y-1">
                                  <div className="flex items-center gap-2">
                                    <Zap className="h-4 w-4 text-emerald-600" />
                                    <span className="text-sm font-medium">Tarif estime</span>
                                  </div>
                                  <p className="text-xs text-muted-foreground">
                                    {departureCity} - {arrivalCity} ({distance} km, {duration})
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    {vehicleData?.label} x {passengerCount}
                                  </p>
                                </div>
                                <div className="text-right">
                                  <span className="text-xl font-bold text-emerald-700 dark:text-emerald-400">
                                    {formatGNF(estimatedPrice)}
                                  </span>
                                </div>
                              </div>
                            </motion.div>
                          )}

                          <Button
                            className="w-full bg-emerald-600 hover:bg-emerald-700 h-12 text-base font-semibold mova-gradient"
                            onClick={handleSearch}
                            disabled={!departureCity || !arrivalCity || !travelDate}
                          >
                            <Search className="h-5 w-5 mr-2" />
                            Rechercher {availableTrips.length > 0 ? `${availableTrips.length} trajets` : ''}
                          </Button>
                        </>
                      )}
                    </CardContent>
                  </Card>

                  {/* Popular Routes */}
                  {!isLoadingRoutes && (
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base flex items-center gap-2">
                          <TrendingUp className="h-4 w-4 text-amber-500" />
                          Trajets populaires
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        {popularRouteCards.map((route) => (
                          <motion.button
                            key={`${route.from}-${route.to}`}
                            initial={{ opacity: 0, x: -5 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: popularRouteCards.indexOf(route) * 0.05 }}
                            onClick={() => {
                              setDepartureCity(route.from)
                              setArrivalCity(route.to)
                              setSelectedPopularRoute(`${route.from}-${route.to}`)
                              toast.success(`${route.from} - ${route.to} selectionne`)
                            }}
                            className={`w-full flex items-center justify-between p-3 rounded-xl transition-all ${
                              selectedPopularRoute === `${route.from}-${route.to}`
                                ? 'bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800'
                                : 'hover:bg-muted border border-transparent'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center shrink-0">
                                <Navigation className="h-4 w-4 text-emerald-600" />
                              </div>
                              <div className="text-left">
                                <p className="text-sm font-medium">{route.from} - {route.to}</p>
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                  <span className="flex items-center gap-0.5"><Clock className="h-3 w-3" /> {route.duration}</span>
                                  <span>{route.distance} km</span>
                                </div>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-bold text-emerald-600">{formatGNF(route.minPrice)}</p>
                              <p className="text-[10px] text-muted-foreground">A partir de</p>
                            </div>
                          </motion.button>
                        ))}
                      </CardContent>
                    </Card>
                  )}
                </motion.div>
              )}

              {/* RESULTS STEP */}
              {step === 'results' && (
                <motion.div key="results" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-4">
                  {/* Route header */}
                  <Card className="mova-gradient text-white">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-4">
                        <div className="flex-1 text-center">
                          <MapPin className="h-5 w-5 text-white/80 mx-auto mb-1" />
                          <p className="font-bold text-white">{departureCity}</p>
                        </div>
                        <div className="flex flex-col items-center gap-1">
                          <ArrowRight className="h-5 w-5 text-white/60" />
                          <p className="text-xs text-white/70">{distance} km</p>
                          <p className="text-xs text-white/70">{duration}</p>
                        </div>
                        <div className="flex-1 text-center">
                          <MapPin className="h-5 w-5 text-amber-300 mx-auto mb-1" />
                          <p className="font-bold text-white">{arrivalCity}</p>
                        </div>
                      </div>
                      <div className="mt-3 pt-3 border-t border-white/20 flex items-center justify-between text-sm text-white/80">
                        <span>{travelDate ? new Date(travelDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : '-'}</span>
                        <span>{passengerCount} passager{passengerCount > 1 ? 's' : ''}</span>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Back + filter */}
                  <div className="flex items-center justify-between">
                    <Button variant="outline" size="sm" onClick={() => setStep('search')}>
                      <ChevronLeft className="h-4 w-4 mr-1" />
                      Modifier la recherche
                    </Button>
                    <Badge variant="secondary" className="text-xs">
                      {availableTrips.length} trajets disponibles
                    </Badge>
                  </div>

                  {/* Trips list */}
                  {availableTrips.length > 0 ? (
                    <div className="space-y-3">
                      {availableTrips.map((trip, idx) => {
                        const vt = VEHICLE_TYPES.find(v => v.id === trip.vehicleType)
                        const totalPrice = trip.pricePerSeat * passengerCount
                        return (
                          <motion.div
                            key={trip.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: idx * 0.05 }}
                          >
                            <Card className="mova-card-hover cursor-pointer hover:border-emerald-300 dark:hover:border-emerald-700 transition-all" onClick={() => handleSelectTrip(trip)}>
                              <CardContent className="p-4">
                                <div className="flex items-start justify-between gap-3">
                                  <div className="space-y-2">
                                    {/* Departure time */}
                                    <div className="flex items-center gap-2">
                                      <div className="w-12 h-12 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                                        <Clock className="h-5 w-5 text-emerald-600" />
                                      </div>
                                      <div>
                                        <p className="text-lg font-bold">{trip.departureTime}</p>
                                        <p className="text-xs text-muted-foreground">Depart</p>
                                      </div>
                                    </div>

                                    {/* Vehicle + operator */}
                                    <div className="flex items-center gap-2">
                                      {vt && <vt.icon className="h-4 w-4 text-muted-foreground" />}
                                      <span className="text-sm font-medium">{vt?.label ?? trip.vehicleType}</span>
                                    </div>
                                    <p className="text-xs text-muted-foreground">{trip.operator}</p>

                                    {/* Duration */}
                                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                      <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {trip.duration}</span>
                                      <span className="flex items-center gap-1"><Route className="h-3 w-3" /> {trip.distance} km</span>
                                    </div>
                                  </div>

                                  <div className="text-right space-y-2">
                                    {/* Price */}
                                    <p className="text-lg font-bold text-emerald-600">{formatGNF(trip.pricePerSeat)}</p>
                                    <p className="text-[10px] text-muted-foreground">par place</p>
                                    {passengerCount > 1 && (
                                      <p className="text-sm font-semibold text-amber-600">{formatGNF(totalPrice)}</p>
                                    )}

                                    {/* Seats */}
                                    <Badge variant={trip.availableSeats <= 5 ? 'destructive' : 'secondary'} className="text-xs">
                                      <Users className="h-3 w-3 mr-1" />
                                      {trip.availableSeats} place{trip.availableSeats > 1 ? 's' : ''}
                                    </Badge>

                                    <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-xs">
                                      Reserver
                                    </Button>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          </motion.div>
                        )
                      })}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                        <Plane className="w-8 h-8 text-muted-foreground" />
                      </div>
                      <h3 className="font-semibold text-base mb-1">Aucun trajet disponible</h3>
                      <p className="text-sm text-muted-foreground max-w-xs">Essayez une autre date ou un autre itineraire.</p>
                    </div>
                  )}
                </motion.div>
              )}

              {/* CONFIRMATION STEP */}
              {step === 'confirmation' && selectedTrip && (
                <motion.div key="confirmation" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}>
                  <Card className="border-emerald-200 bg-emerald-50/50 dark:bg-emerald-950/20">
                    <CardContent className="py-10 text-center space-y-4">
                      <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', bounce: 0.5 }}>
                        <div className="w-16 h-16 mx-auto rounded-full bg-emerald-100 flex items-center justify-center">
                          <CheckCircle2 className="h-8 w-8 text-emerald-600" />
                        </div>
                      </motion.div>
                      <div>
                        <h3 className="text-xl font-bold text-emerald-700 dark:text-emerald-400">Reservation confirmee !</h3>
                        <p className="text-sm text-muted-foreground mt-2">
                          Votre trajet {selectedTrip.from} - {selectedTrip.to} est reserve.
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Un SMS de confirmation sera envoye.
                        </p>
                      </div>
                      <div className="bg-white dark:bg-gray-900 rounded-xl p-4 text-left space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Route</span>
                          <span className="font-medium">{selectedTrip.from} - {selectedTrip.to}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Date</span>
                          <span className="font-medium">{travelDate ? new Date(travelDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : '-'}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Heure</span>
                          <span className="font-medium">{selectedTrip.departureTime}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Vehicule</span>
                          <span className="font-medium">{vehicleData?.label}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Passagers</span>
                          <span className="font-medium">{passengerCount}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Paiement</span>
                          <span className="font-medium">{PAYMENT_METHODS.find(pm => pm.id === paymentMethod)?.label}</span>
                        </div>
                        <Separator />
                        <div className="flex justify-between">
                          <span className="font-semibold">Total</span>
                          <span className="font-bold text-emerald-600">{formatGNF(selectedTrip.pricePerSeat * passengerCount)}</span>
                        </div>
                      </div>
                      <div className="flex gap-3">
                        <Button variant="outline" className="flex-1" onClick={() => setActiveTab('history')}>
                          <History className="h-4 w-4 mr-2" />
                          Mes reservations
                        </Button>
                        <Button className="flex-1 mova-gradient" onClick={handleReset}>
                          <Search className="h-4 w-4 mr-2" />
                          Nouvelle recherche
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              )}
            </AnimatePresence>
          )}

          {/* HISTORY TAB */}
          {activeTab === 'history' && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
              {isLoadingHistory ? (
                <div className="space-y-3">
                  {[0, 1, 2].map((i) => (
                    <Card key={i}>
                      <CardContent className="p-4 space-y-3">
                        <Skeleton className="h-4 w-48" />
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-4 w-20" />
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : bookings.length > 0 ? (
                <div className="space-y-3">
                  {bookings.map((booking, idx) => {
                    const vt = VEHICLE_TYPES.find(v => v.id === booking.vehicleType)
                    const statusConfig = {
                      confirmed: { label: 'Confirme', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
                      completed: { label: 'Termine', color: 'bg-muted text-muted-foreground' },
                      cancelled: { label: 'Annule', color: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400' },
                    }
                    const sc = statusConfig[booking.status]
                    return (
                      <motion.div
                        key={booking.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.05 }}
                      >
                        <Card className={`mova-card-hover ${booking.status === 'cancelled' ? 'opacity-60' : ''}`}>
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div className="space-y-2">
                                {/* Route */}
                                <div className="flex items-center gap-2">
                                  <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center shrink-0">
                                    <Navigation className="h-4 w-4 text-emerald-600" />
                                  </div>
                                  <div>
                                    <p className="text-sm font-medium">{booking.from} - {booking.to}</p>
                                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                      <span>{booking.date ? new Date(booking.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : '-'}</span>
                                      <span>{booking.time}</span>
                                    </div>
                                  </div>
                                </div>
                                {/* Details */}
                                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                  {vt && <span className="flex items-center gap-1"><vt.icon className="h-3 w-3" /> {vt.label}</span>}
                                  <span>{booking.seats} place{booking.seats > 1 ? 's' : ''}</span>
                                  <span className="font-mono text-[10px]">{booking.ref}</span>
                                </div>
                              </div>
                              <div className="text-right space-y-2">
                                <p className="text-sm font-bold text-emerald-600">{formatGNF(booking.price)}</p>
                                <Badge className={`text-[10px] ${sc.color}`}>{sc.label}</Badge>
                                {booking.status === 'confirmed' && (
                                  <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 text-xs h-7 px-2"
                                    onClick={() => handleCancelBooking(booking.id)}>
                                    <Trash2 className="h-3 w-3 mr-1" />
                                    Annuler
                                  </Button>
                                )}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </motion.div>
                    )
                  })}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                    <History className="w-8 h-8 text-muted-foreground" />
                  </div>
                  <h3 className="font-semibold text-base mb-1">Aucune reservation</h3>
                  <p className="text-sm text-muted-foreground max-w-xs">Vos reservations de transport interurbain apparaitront ici.</p>
                  <Button variant="outline" className="mt-4" onClick={() => setActiveTab('search')}>
                    <Search className="h-4 w-4 mr-2" />
                    Rechercher un trajet
                  </Button>
                </div>
              )}
            </motion.div>
          )}
        </div>
      </ScrollArea>

      {/* Booking Dialog */}
      <Dialog open={showBookingDialog} onOpenChange={setShowBookingDialog}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto mova-scrollbar">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Ticket className="h-5 w-5 text-emerald-600" />
              Confirmer la reservation
            </DialogTitle>
            <DialogDescription>
              Completez vos informations pour finaliser la reservation.
            </DialogDescription>
          </DialogHeader>

          {selectedTrip && (
            <div className="space-y-4 py-2">
              {/* Trip summary */}
              <div className="bg-emerald-50 dark:bg-emerald-950/20 rounded-xl p-3">
                <div className="flex items-center gap-3">
                  <div className="flex-1 text-center">
                    <p className="text-sm font-bold">{selectedTrip.from}</p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  <div className="flex-1 text-center">
                    <p className="text-sm font-bold">{selectedTrip.to}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground mt-2">
                  <span>{selectedTrip.departureTime} - {selectedTrip.duration}</span>
                  <span>{VEHICLE_TYPES.find(v => v.id === selectedTrip.vehicleType)?.label}</span>
                </div>
              </div>

              {/* Passenger name */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Nom complet</Label>
                <Input
                  placeholder="Ex: Mamadou Diallo"
                  value={passengerName}
                  onChange={(e) => setPassengerName(e.target.value)}
                />
              </div>

              {/* Phone */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Numero de telephone</Label>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground bg-muted rounded-lg px-3 h-10 flex items-center">+224</span>
                  <Input
                    placeholder="661 00 00 00"
                    value={passengerPhone.replace('+224 ', '').replace('+224', '')}
                    onChange={(e) => setPassengerPhone(e.target.value)}
                  />
                </div>
              </div>

              {/* Passengers count */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Nombre de passagers</Label>
                <div className="flex items-center gap-3">
                  <Button variant="outline" size="icon" onClick={() => setPassengerCount(Math.max(1, passengerCount - 1))} disabled={passengerCount <= 1}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <div className="flex-1 text-center">
                    <span className="text-xl font-bold">{passengerCount}</span>
                    <p className="text-xs text-muted-foreground">passager{passengerCount > 1 ? 's' : ''}</p>
                  </div>
                  <Button variant="outline" size="icon" onClick={() => setPassengerCount(Math.min(selectedTrip.availableSeats, passengerCount + 1))} disabled={passengerCount >= selectedTrip.availableSeats}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Payment method */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Mode de paiement</Label>
                <div className="grid grid-cols-3 gap-2">
                  {PAYMENT_METHODS.map((pm) => (
                    <button
                      key={pm.id}
                      onClick={() => setPaymentMethod(pm.id)}
                      className={`p-3 rounded-xl border-2 text-center transition-all ${
                        paymentMethod === pm.id
                          ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/20'
                          : 'border-transparent bg-muted hover:bg-muted/80'
                      }`}
                    >
                      <pm.icon className={`h-4 w-4 mx-auto mb-1 ${paymentMethod === pm.id ? 'text-emerald-600' : 'text-muted-foreground'}`} />
                      <p className={`text-xs font-medium ${paymentMethod === pm.id ? 'text-emerald-700 dark:text-emerald-300' : ''}`}>{pm.label}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Total */}
              <div className="bg-emerald-50 dark:bg-emerald-950/30 rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm font-medium">Total a payer</span>
                    <p className="text-xs text-muted-foreground">{formatGNF(selectedTrip.pricePerSeat)} x {passengerCount} place{passengerCount > 1 ? 's' : ''}</p>
                  </div>
                  <span className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">
                    {formatGNF(selectedTrip.pricePerSeat * passengerCount)}
                  </span>
                </div>
              </div>

              {/* Confirm button */}
              <Button
                className="w-full bg-emerald-600 hover:bg-emerald-700 h-12 text-base font-semibold mova-gradient"
                onClick={handleConfirmBooking}
                disabled={isSubmitting || !passengerName.trim() || !passengerPhone.trim()}
              >
                {isSubmitting ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Confirmation...</>
                ) : (
                  <><CheckCircle2 className="h-4 w-4 mr-2" /> Confirmer la reservation</>
                )}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Mobile Bottom Nav */}
      <nav className="fixed bottom-0 left-0 right-0 sm:hidden mova-glass border-t border-border/50 z-50">
        <div className="flex items-center justify-around py-2 px-4">
          {[
            { icon: <ArrowLeft className="h-5 w-5" />, label: 'Retour', action: goBack },
            { icon: <Search className="h-5 w-5" />, label: 'Rechercher', action: () => { setActiveTab('search'); setStep('search') } },
            { icon: <History className="h-5 w-5" />, label: 'Reservations', action: () => setActiveTab('history') },
            { icon: <Plane className="h-5 w-5" />, label: 'Trajets', action: () => { setActiveTab('search'); if (step === 'search') window.scrollTo({ top: 0, behavior: 'smooth' }) } },
          ].map((tab, i) => (
            <button
              key={i}
              onClick={tab.action}
              className="flex flex-col items-center gap-1 px-3 py-1"
            >
              <span className="text-muted-foreground">{tab.icon}</span>
              <span className="text-[10px] font-medium text-muted-foreground">{tab.label}</span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  )
}
