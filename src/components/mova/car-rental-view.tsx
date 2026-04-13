'use client'

import { useState, useMemo, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Car, Calendar, MapPin, Search, Filter, Star, Fuel, Users, Settings2,
  ChevronDown, X, Check, CreditCard, Banknote, Wallet, Phone, User,
  Clock, ArrowRight, ArrowLeft, ListChecks, Shield, Sparkles, SlidersHorizontal,
  Crown, Truck, UsersRound, ChevronRight, CheckCircle2, Loader2, AlertCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area'
import { toast } from 'sonner'
import { useAppStore } from '@/lib/mova/store'

// ── Types ──────────────────────────────────────────────────

interface Vehicle {
  id: string
  name: string
  type: string
  pricePerDay: number
  seats: number
  transmission: string
  fuelType: string
  rating: number
  icon: React.ReactNode
  color: string
  bgColor: string
  badge: string
  badgeColor: string
}

interface BookingRecord {
  id: string
  vehicleType: string
  pickupAddress: string
  scheduledFor: string
  estimatedFare: number
  status: string
  notes: string | null
  createdAt: string
}

// ── Constants ──────────────────────────────────────────────

const VEHICLES: Vehicle[] = [
  {
    id: 'eco',
    name: 'Économique',
    type: 'economique',
    pricePerDay: 50000,
    seats: 4,
    transmission: 'Manuelle',
    fuelType: 'Essence',
    rating: 4.5,
    icon: <Car className="h-12 w-12" />,
    color: 'text-emerald-500 dark:text-emerald-400',
    bgColor: 'from-emerald-50 to-emerald-100 dark:from-emerald-950/30 dark:to-emerald-900/20',
    badge: 'Populaire',
    badgeColor: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400',
  },
  {
    id: 'berline',
    name: 'Berline Confort',
    type: 'berline',
    pricePerDay: 85000,
    seats: 5,
    transmission: 'Automatique',
    fuelType: 'Diesel',
    rating: 4.7,
    icon: <Car className="h-12 w-12" />,
    color: 'text-sky-500 dark:text-sky-400',
    bgColor: 'from-sky-50 to-sky-100 dark:from-sky-950/30 dark:to-sky-900/20',
    badge: 'Confort',
    badgeColor: 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-400',
  },
  {
    id: 'suv',
    name: 'SUV 4x4',
    type: 'suv',
    pricePerDay: 150000,
    seats: 7,
    transmission: 'Automatique',
    fuelType: 'Diesel',
    rating: 4.8,
    icon: <Truck className="h-12 w-12" />,
    color: 'text-amber-500 dark:text-amber-400',
    bgColor: 'from-amber-50 to-amber-100 dark:from-amber-950/30 dark:to-amber-900/20',
    badge: 'Tout-terrain',
    badgeColor: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400',
  },
  {
    id: 'premium',
    name: 'Premium Luxe',
    type: 'premium',
    pricePerDay: 250000,
    seats: 5,
    transmission: 'Automatique',
    fuelType: 'Diesel',
    rating: 4.9,
    icon: <Crown className="h-12 w-12" />,
    color: 'text-violet-500 dark:text-violet-400',
    bgColor: 'from-violet-50 to-violet-100 dark:from-violet-950/30 dark:to-violet-900/20',
    badge: 'Luxe',
    badgeColor: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-400',
  },
  {
    id: 'utilitaire',
    name: 'Utilitaire',
    type: 'utilitaire',
    pricePerDay: 75000,
    seats: 3,
    transmission: 'Manuelle',
    fuelType: 'Diesel',
    rating: 4.3,
    icon: <Truck className="h-12 w-12" />,
    color: 'text-orange-500 dark:text-orange-400',
    bgColor: 'from-orange-50 to-orange-100 dark:from-orange-950/30 dark:to-orange-900/20',
    badge: 'Chargement',
    badgeColor: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400',
  },
  {
    id: 'van',
    name: 'Van / Minibus',
    type: 'van',
    pricePerDay: 120000,
    seats: 15,
    transmission: 'Manuelle',
    fuelType: 'Diesel',
    rating: 4.6,
    icon: <Users className="h-12 w-12" />,
    color: 'text-teal-500 dark:text-teal-400',
    bgColor: 'from-teal-50 to-teal-100 dark:from-teal-950/30 dark:to-teal-900/20',
    badge: 'Groupe',
    badgeColor: 'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-400',
  },
]

const CONAKRY_LOCATIONS = [
  'Aéroport Gbessia',
  'Kaloum - Centre-ville',
  'Dixinn - Belle Vue',
  'Matam - Marché Madina',
  'Ratoma - Kipé',
  'Matoto - Hamdallaye',
  'Ratoma - Lambanyi',
  'Matoto - Cimenterie',
]

const PRICE_RANGES = [
  { value: 'all', label: 'Tous les prix' },
  { value: '0-75000', label: '< 75 000 GNF' },
  { value: '75000-150000', label: '75 000 - 150 000 GNF' },
  { value: '150000-250000', label: '150 000 - 250 000 GNF' },
  { value: '250000+', label: '> 250 000 GNF' },
]

const VEHICLE_TYPES = [
  { value: 'all', label: 'Tous les types' },
  { value: 'economique', label: 'Économique' },
  { value: 'berline', label: 'Berline' },
  { value: 'suv', label: 'SUV' },
  { value: 'premium', label: 'Premium' },
  { value: 'utilitaire', label: 'Utilitaire' },
  { value: 'van', label: 'Van / Minibus' },
]

const PAYMENT_METHODS = [
  { value: 'cash', label: 'Espèces', icon: <Banknote className="h-4 w-4" />, color: 'text-green-600' },
  { value: 'orange_money', label: 'Orange Money', icon: <Phone className="h-4 w-4" />, color: 'text-orange-500' },
  { value: 'mtn_momo', label: 'MTN MoMo', icon: <Phone className="h-4 w-4" />, color: 'text-yellow-500' },
  { value: 'wallet', label: 'Wallet MOVA', icon: <Wallet className="h-4 w-4" />, color: 'text-emerald-600' },
]

const HOW_IT_WORKS = [
  { step: 1, title: 'Choisissez', description: 'Sélectionnez votre véhicule et vos dates', icon: <Search className="h-5 w-5" /> },
  { step: 2, title: 'Réservez', description: 'Confirmez votre réservation en ligne', icon: <Calendar className="h-5 w-5" /> },
  { step: 3, title: 'Payez', description: 'Paiement sécurisé via Mobile Money', icon: <CreditCard className="h-5 w-5" /> },
  { step: 4, title: 'Roulez', description: 'Récupérez votre véhicule et prenez la route', icon: <Car className="h-5 w-5" /> },
]

// ── Helpers ────────────────────────────────────────────────

function formatGNF(amount: number): string {
  return new Intl.NumberFormat('fr-FR').format(amount) + ' GNF'
}

function getTodayString(): string {
  return new Date().toISOString().split('T')[0]
}

function calcDays(start: string, end: string): number {
  if (!start || !end) return 0
  const s = new Date(start)
  const e = new Date(end)
  const diff = Math.ceil((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24))
  return diff > 0 ? diff : 0
}

function formatDateFR(dateStr: string): string {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function getStatusBadge(status: string) {
  switch (status) {
    case 'scheduled':
      return <Badge variant="secondary" className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 text-xs">Planifiée</Badge>
    case 'confirmed':
      return <Badge variant="secondary" className="bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400 text-xs">Confirmée</Badge>
    case 'in_progress':
      return <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 text-xs">En cours</Badge>
    case 'completed':
      return <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 text-xs">Terminée</Badge>
    case 'cancelled':
      return <Badge variant="secondary" className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 text-xs">Annulée</Badge>
    default:
      return <Badge variant="secondary" className="text-xs">{status}</Badge>
  }
}

// Deterministic "availability" based on vehicle id + date hash
function isVehicleAvailable(vehicleId: string, startDate: string): boolean {
  if (!startDate) return true
  const hash = (vehicleId + startDate).split('').reduce((a, c) => a + c.charCodeAt(0), 0)
  return hash % 5 !== 0 // ~80% availability
}

// ── Main Component ─────────────────────────────────────────

export default function CarRentalView() {
  const { goBack, user } = useAppStore()

  // ── Search / Filter state ──
  const [pickupLocation, setPickupLocation] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [vehicleTypeFilter, setVehicleTypeFilter] = useState('all')
  const [priceRange, setPriceRange] = useState('all')
  const [showFilters, setShowFilters] = useState(false)

  // ── Booking dialog state ──
  const [bookingDialogOpen, setBookingDialogOpen] = useState(false)
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null)
  const [bookingStep, setBookingStep] = useState<'summary' | 'confirm' | 'success'>('summary')
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('')
  const [bookingNotes, setBookingNotes] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [bookingRef, setBookingRef] = useState('')

  // ── Tab state ──
  const [activeTab, setActiveTab] = useState('browse')

  // ── Booking history ──
  const [bookings, setBookings] = useState<BookingRecord[]>([])
  const [isLoadingBookings, setIsLoadingBookings] = useState(false)

  // ── Derived values ──
  const numberOfDays = useMemo(() => calcDays(startDate, endDate), [startDate, endDate])
  const totalPrice = useMemo(() => {
    if (!selectedVehicle || numberOfDays <= 0) return 0
    return selectedVehicle.pricePerDay * numberOfDays
  }, [selectedVehicle, numberOfDays])

  // Filter vehicles
  const filteredVehicles = useMemo(() => {
    let result = [...VEHICLES]

    if (vehicleTypeFilter !== 'all') {
      result = result.filter(v => v.type === vehicleTypeFilter)
    }

    if (priceRange !== 'all') {
      switch (priceRange) {
        case '0-75000':
          result = result.filter(v => v.pricePerDay <= 75000)
          break
        case '75000-150000':
          result = result.filter(v => v.pricePerDay > 75000 && v.pricePerDay <= 150000)
          break
        case '150000-250000':
          result = result.filter(v => v.pricePerDay > 150000 && v.pricePerDay <= 250000)
          break
        case '250000+':
          result = result.filter(v => v.pricePerDay > 250000)
          break
      }
    }

    return result
  }, [vehicleTypeFilter, priceRange])

  // ── Fetch bookings ──
  const fetchBookings = useCallback(async () => {
    setIsLoadingBookings(true)
    try {
      const passengerId = user?.id || 'demo'
      const res = await fetch(`/api/mova/bookings?passengerId=${passengerId}&limit=50`)
      const json = await res.json()
      if (json.success && Array.isArray(json.data)) {
        // Parse notes to find car_rental bookings
        const carRentals: BookingRecord[] = json.data
          .filter((b: Record<string, unknown>) => {
            try {
              const parsed = b.notes ? JSON.parse(b.notes as string) : null
              return parsed?.bookingType === 'car_rental'
            } catch {
              return false
            }
          })
          .map((b: Record<string, unknown>) => ({
            id: b.id as string,
            vehicleType: b.vehicleType as string,
            pickupAddress: b.pickupAddress as string,
            scheduledFor: b.scheduledFor as string,
            estimatedFare: Number(b.estimatedFare) || 0,
            status: b.status as string,
            notes: b.notes as string | null,
            createdAt: b.createdAt as string,
          }))
        setBookings(carRentals)
      }
    } catch {
      toast.error('Erreur lors du chargement des réservations')
    } finally {
      setIsLoadingBookings(false)
    }
  }, [user?.id])

  useEffect(() => {
    if (activeTab === 'history') {
      fetchBookings()
    }
  }, [activeTab, fetchBookings])

  // ── Pre-fill customer info from store ──
  useEffect(() => {
    if (user?.name) setCustomerName(user.name)
    if (user?.phone) setCustomerPhone(user.phone)
  }, [user])

  // ── Handlers ──
  function handleOpenBooking(vehicle: Vehicle) {
    if (!pickupLocation) {
      toast.error('Veuillez sélectionner un lieu de récupération')
      return
    }
    if (!startDate || !endDate) {
      toast.error('Veuillez sélectionner les dates de location')
      return
    }
    if (new Date(endDate) <= new Date(startDate)) {
      toast.error('La date de fin doit être après la date de début')
      return
    }
    if (new Date(startDate) < new Date(getTodayString())) {
      toast.error('Les dates doivent être dans le futur')
      return
    }
    setSelectedVehicle(vehicle)
    setBookingStep('summary')
    setBookingRef('')
    setBookingNotes('')
    setPaymentMethod('')
    setBookingDialogOpen(true)
  }

  async function handleSubmitBooking() {
    if (!selectedVehicle) return
    if (!paymentMethod) {
      toast.error('Veuillez choisir un mode de paiement')
      return
    }
    if (!customerName.trim()) {
      toast.error('Veuillez entrer votre nom')
      return
    }

    setIsSubmitting(true)
    try {
      const payload = {
        type: 'car_rental',
        passengerId: user?.id || 'demo',
        pickupAddress: pickupLocation,
        vehicleType: selectedVehicle.name,
        scheduledFor: startDate,
        preferences: {
          endDate,
          totalAmount: totalPrice,
          paymentMethod,
          customerName: customerName.trim(),
          customerPhone: customerPhone.trim(),
        },
        notes: bookingNotes.trim() || undefined,
      }

      const res = await fetch('/api/mova/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const json = await res.json()

      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Erreur lors de la réservation')
      }

      // Success
      const ref = json.data?.id || 'N/A'
      setBookingRef(ref)
      setBookingStep('success')
      toast.success('Réservation confirmée !', {
        description: `Référence: ${ref.slice(0, 8).toUpperCase()}`,
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erreur serveur'
      toast.error('Échec de la réservation', { description: msg })
    } finally {
      setIsSubmitting(false)
    }
  }

  function handleCloseDialog() {
    setBookingDialogOpen(false)
    if (bookingStep === 'success') {
      // Reset search state after successful booking
      setStartDate('')
      setEndDate('')
      setPickupLocation('')
      setSelectedVehicle(null)
    }
    // Small delay to allow dialog animation to finish
    setTimeout(() => setBookingStep('summary'), 300)
  }

  // ── Render ──

  return (
    <div className="min-h-screen bg-background">
      {/* ── Header ── */}
      <header className="sticky top-0 z-50 mova-glass border-b border-border/50">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="icon" className="rounded-full" onClick={goBack}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2 flex-1">
            <div className="w-9 h-9 rounded-xl bg-emerald-600 flex items-center justify-center">
              <Car className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold leading-tight">Location de Voiture</h1>
              <p className="text-xs text-muted-foreground">Explorez Conakry en voiture</p>
            </div>
          </div>
        </div>
      </header>

      <ScrollArea className="h-[calc(100vh-64px)]">
        <div className="max-w-4xl mx-auto px-4 py-4 space-y-5 pb-24">

          {/* ── Tabs ── */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-2 h-11 rounded-xl">
              <TabsTrigger value="browse" className="rounded-lg text-sm gap-1.5 data-[state=active]:bg-emerald-600 data-[state=active]:text-white">
                <Search className="h-4 w-4" />
                Parcourir
              </TabsTrigger>
              <TabsTrigger value="history" className="rounded-lg text-sm gap-1.5 data-[state=active]:bg-emerald-600 data-[state=active]:text-white">
                <ListChecks className="h-4 w-4" />
                Mes réservations
                {bookings.length > 0 && (
                  <span className="ml-1 text-[10px] bg-white/20 dark:bg-black/20 rounded-full px-1.5 py-0.5 font-bold">
                    {bookings.length}
                  </span>
                )}
              </TabsTrigger>
            </TabsList>

            {/* ═══════════════════ BROWSE TAB ═══════════════════ */}
            <TabsContent value="browse" className="space-y-5 mt-5">
              {/* ── Search Section ── */}
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                <Card>
                  <CardContent className="p-4 space-y-3">
                    <h2 className="text-sm font-semibold flex items-center gap-2">
                      <Search className="h-4 w-4 text-emerald-600" />
                      Rechercher un véhicule
                    </h2>

                    <div className="space-y-2">
                      <Label className="text-xs font-medium flex items-center gap-1">
                        <MapPin className="h-3 w-3 text-emerald-600" />
                        Lieu de récupération
                      </Label>
                      <Select value={pickupLocation} onValueChange={setPickupLocation}>
                        <SelectTrigger className="h-10 rounded-xl">
                          <SelectValue placeholder="Choisir un lieu" />
                        </SelectTrigger>
                        <SelectContent>
                          {CONAKRY_LOCATIONS.map((loc) => (
                            <SelectItem key={loc} value={loc}>{loc}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label className="text-xs font-medium flex items-center gap-1">
                          <Calendar className="h-3 w-3 text-emerald-600" />
                          Date de début
                        </Label>
                        <Input
                          type="date"
                          value={startDate}
                          min={getTodayString()}
                          onChange={(e) => {
                            setStartDate(e.target.value)
                            if (endDate && e.target.value >= endDate) setEndDate('')
                          }}
                          className="h-10 rounded-xl"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs font-medium flex items-center gap-1">
                          <Calendar className="h-3 w-3 text-emerald-600" />
                          Date de fin
                        </Label>
                        <Input
                          type="date"
                          value={endDate}
                          min={startDate || getTodayString()}
                          onChange={(e) => setEndDate(e.target.value)}
                          className="h-10 rounded-xl"
                        />
                      </div>
                    </div>

                    {/* Duration & price preview */}
                    {numberOfDays > 0 && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 p-3"
                      >
                        <div className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4 text-emerald-600" />
                            <span className="font-medium text-emerald-700 dark:text-emerald-400">
                              {numberOfDays} jour{numberOfDays > 1 ? 's' : ''} de location
                            </span>
                          </div>
                          {selectedVehicle && (
                            <span className="font-bold text-emerald-600 dark:text-emerald-400">
                              Total: {formatGNF(selectedVehicle.pricePerDay * numberOfDays)}
                            </span>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>

              {/* ── Filter Bar ── */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 }}
              >
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className={`rounded-lg text-xs gap-1.5 ${showFilters ? 'border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300' : ''}`}
                    onClick={() => setShowFilters(!showFilters)}
                  >
                    <SlidersHorizontal className="h-3.5 w-3.5" />
                    Filtres
                    {(vehicleTypeFilter !== 'all' || priceRange !== 'all') && (
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    )}
                  </Button>
                  <div className="flex-1" />
                  <span className="text-xs text-muted-foreground">
                    {filteredVehicles.length} véhicule{filteredVehicles.length > 1 ? 's' : ''}
                  </span>
                </div>
              </motion.div>

              {/* ── Expanded Filters ── */}
              <AnimatePresence>
                {showFilters && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <Card className="p-4 space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label className="text-xs font-medium">Type de véhicule</Label>
                          <Select value={vehicleTypeFilter} onValueChange={setVehicleTypeFilter}>
                            <SelectTrigger className="h-9 text-xs rounded-lg">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {VEHICLE_TYPES.map((opt) => (
                                <SelectItem key={opt.value} value={opt.value} className="text-xs">
                                  {opt.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs font-medium">Tranche de prix</Label>
                          <Select value={priceRange} onValueChange={setPriceRange}>
                            <SelectTrigger className="h-9 text-xs rounded-lg">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {PRICE_RANGES.map((opt) => (
                                <SelectItem key={opt.value} value={opt.value} className="text-xs">
                                  {opt.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-xs rounded-lg"
                          onClick={() => {
                            setVehicleTypeFilter('all')
                            setPriceRange('all')
                            toast.success('Filtres réinitialisés')
                          }}
                        >
                          Réinitialiser
                        </Button>
                      </div>
                    </Card>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* ── Vehicle Cards Grid ── */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredVehicles.map((vehicle, idx) => {
                  const available = isVehicleAvailable(vehicle.id, startDate)
                  return (
                    <motion.div
                      key={vehicle.id}
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.05 }}
                    >
                      <Card className={`overflow-hidden mova-card-hover group ${!available && startDate ? 'opacity-60' : ''}`}>
                        {/* Vehicle image area */}
                        <div className={`relative bg-gradient-to-br ${vehicle.bgColor} flex items-center justify-center h-40 overflow-hidden`}>
                          <svg className="absolute inset-0 w-full h-full opacity-[0.06] pointer-events-none" xmlns="http://www.w3.org/2000/svg">
                            <defs>
                              <pattern id={`dots-${vehicle.id}`} x="0" y="0" width="16" height="16" patternUnits="userSpaceOnUse">
                                <circle cx="2" cy="2" r="1.2" fill="currentColor" />
                              </pattern>
                            </defs>
                            <rect width="100%" height="100%" fill={`url(#dots-${vehicle.id})`} className="text-gray-500" />
                          </svg>
                          <div className={`${vehicle.color} opacity-60 group-hover:scale-110 group-hover:opacity-80 transition-all duration-300 relative z-10`}>
                            {vehicle.icon}
                          </div>
                          <Badge className={`absolute top-3 right-3 text-[10px] font-bold border-0 ${vehicle.badgeColor}`}>
                            {vehicle.badge}
                          </Badge>
                          {/* Availability indicator */}
                          {startDate && (
                            <Badge
                              className={`absolute top-3 left-3 text-[10px] font-bold border-0 ${
                                available
                                  ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400'
                                  : 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400'
                              }`}
                            >
                              <span className={`w-1.5 h-1.5 rounded-full mr-1 ${available ? 'bg-green-500' : 'bg-red-500'}`} />
                              {available ? 'Disponible' : 'Indisponible'}
                            </Badge>
                          )}
                        </div>

                        <CardContent className="p-4 space-y-3">
                          {/* Name & Price */}
                          <div className="flex items-start justify-between">
                            <div>
                              <h3 className="font-semibold text-sm">{vehicle.name}</h3>
                              <div className="flex items-center gap-1 mt-0.5">
                                <Star className="h-3 w-3 text-amber-500 fill-amber-500" />
                                <span className="text-xs text-muted-foreground">{vehicle.rating}</span>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-base font-bold text-emerald-600 dark:text-emerald-400">
                                {formatGNF(vehicle.pricePerDay)}
                              </p>
                              <p className="text-[10px] text-muted-foreground">/jour</p>
                            </div>
                          </div>

                          <Separator />

                          {/* Specs */}
                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <div className="flex items-center gap-1.5">
                              <UsersRound className="h-3.5 w-3.5" />
                              <span>{vehicle.seats} places</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <Settings2 className="h-3.5 w-3.5" />
                              <span>{vehicle.transmission}</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <Fuel className="h-3.5 w-3.5" />
                              <span>{vehicle.fuelType}</span>
                            </div>
                          </div>

                          {/* Book button */}
                          <Button
                            className="w-full bg-emerald-600 hover:bg-emerald-700 text-sm mova-gradient disabled:opacity-50 disabled:cursor-not-allowed"
                            onClick={() => handleOpenBooking(vehicle)}
                            disabled={!available && !!startDate}
                          >
                            <Sparkles className="h-4 w-4 mr-1.5" />
                            {(!available && startDate) ? 'Indisponible' : 'Réserver'}
                          </Button>
                        </CardContent>
                      </Card>
                    </motion.div>
                  )
                })}
              </div>

              {/* ── No Results ── */}
              {filteredVehicles.length === 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex flex-col items-center justify-center py-16 text-center"
                >
                  <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                    <Car className="w-8 h-8 text-muted-foreground" />
                  </div>
                  <h3 className="font-semibold text-base mb-1">Aucun véhicule trouvé</h3>
                  <p className="text-sm text-muted-foreground max-w-xs">
                    Aucun véhicule ne correspond à vos critères. Modifiez vos filtres.
                  </p>
                </motion.div>
              )}

              {/* ── How It Works ── */}
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
              >
                <Card className="border-emerald-200 bg-gradient-to-br from-emerald-50/50 to-amber-50/30 dark:from-emerald-950/10 dark:to-amber-950/10">
                  <CardContent className="p-5">
                    <h2 className="text-base font-bold mb-4 flex items-center gap-2">
                      <Sparkles className="h-5 w-5 text-amber-500" />
                      Comment ça marche ?
                    </h2>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                      {HOW_IT_WORKS.map((item) => (
                        <div key={item.step} className="text-center space-y-2">
                          <div className="w-10 h-10 mx-auto rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                            {item.icon}
                          </div>
                          <div className="relative">
                            <span className="absolute -top-4 -right-1 text-[10px] font-bold text-emerald-500">
                              {item.step}
                            </span>
                            <p className="text-xs font-semibold">{item.title}</p>
                          </div>
                          <p className="text-[10px] text-muted-foreground leading-tight">{item.description}</p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

              {/* ── Trust Banner ── */}
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 }}
              >
                <Card className="border-amber-200 bg-amber-50/30 dark:bg-amber-950/10">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <Shield className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
                      <div className="space-y-1">
                        <p className="text-sm font-semibold">Location sécurisée avec MOVA</p>
                        <p className="text-xs text-muted-foreground">
                          Tous nos véhicules sont assurés, vérifiés et entretenus régulièrement.
                          Assistance 24h/7j et paiement sécurisé via Mobile Money.
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            </TabsContent>

            {/* ═══════════════════ HISTORY TAB ═══════════════════ */}
            <TabsContent value="history" className="space-y-4 mt-5">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold flex items-center gap-2">
                  <ListChecks className="h-5 w-5 text-emerald-600" />
                  Mes réservations
                </h2>
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-lg text-xs gap-1"
                  onClick={fetchBookings}
                  disabled={isLoadingBookings}
                >
                  {isLoadingBookings ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <ArrowRight className="h-3.5 w-3.5" />
                  )}
                  Actualiser
                </Button>
              </div>

              {/* Loading */}
              {isLoadingBookings && (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
                </div>
              )}

              {/* Empty state */}
              {!isLoadingBookings && bookings.length === 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex flex-col items-center justify-center py-16 text-center"
                >
                  <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                    <Calendar className="w-8 h-8 text-muted-foreground" />
                  </div>
                  <h3 className="font-semibold text-base mb-1">Aucune réservation</h3>
                  <p className="text-sm text-muted-foreground max-w-xs">
                    Vous n&apos;avez pas encore de réservation de véhicule. Commencez par parcourir les véhicules disponibles.
                  </p>
                  <Button
                    className="mt-4 bg-emerald-600 hover:bg-emerald-700 text-sm rounded-xl"
                    onClick={() => setActiveTab('browse')}
                  >
                    <Search className="h-4 w-4 mr-1.5" />
                    Parcourir les véhicules
                  </Button>
                </motion.div>
              )}

              {/* Bookings list */}
              {!isLoadingBookings && bookings.length > 0 && (
                <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
                  {bookings.map((booking, idx) => {
                    let parsedNotes: Record<string, unknown> | null = null
                    try {
                      parsedNotes = booking.notes ? JSON.parse(booking.notes) : null
                    } catch { /* ignore */ }

                    return (
                      <motion.div
                        key={booking.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.03 }}
                      >
                        <Card className="overflow-hidden">
                          <CardContent className="p-4 space-y-3">
                            <div className="flex items-start justify-between">
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                                    <Car className="h-4 w-4 text-emerald-600" />
                                  </div>
                                  <div>
                                    <p className="text-sm font-semibold">{booking.vehicleType}</p>
                                    <p className="text-xs text-muted-foreground">
                                      Réf: {booking.id.slice(0, 8).toUpperCase()}
                                    </p>
                                  </div>
                                </div>
                              </div>
                              {getStatusBadge(booking.status)}
                            </div>

                            <Separator />

                            <div className="grid grid-cols-2 gap-2 text-xs">
                              <div className="flex items-center gap-1.5 text-muted-foreground">
                                <MapPin className="h-3.5 w-3.5 shrink-0" />
                                <span className="truncate">{booking.pickupAddress}</span>
                              </div>
                              <div className="flex items-center gap-1.5 text-muted-foreground">
                                <Calendar className="h-3.5 w-3.5 shrink-0" />
                                <span>{formatDateFR(booking.scheduledFor)}</span>
                              </div>
                              {parsedNotes?.endDate && (
                                <div className="flex items-center gap-1.5 text-muted-foreground">
                                  <Clock className="h-3.5 w-3.5 shrink-0" />
                                  <span>Retour: {formatDateFR(parsedNotes.endDate as string)}</span>
                                </div>
                              )}
                              <div className="flex items-center gap-1.5 font-semibold text-emerald-600 dark:text-emerald-400">
                                <CreditCard className="h-3.5 w-3.5 shrink-0" />
                                <span>{formatGNF(booking.estimatedFare)}</span>
                              </div>
                            </div>

                            {parsedNotes?.paymentMethod && (
                              <div className="flex items-center gap-1.5">
                                <span className="text-[10px] text-muted-foreground">Paiement:</span>
                                <Badge variant="outline" className="text-[10px] h-5">
                                  {PAYMENT_METHODS.find(m => m.value === parsedNotes?.paymentMethod)?.label || String(parsedNotes.paymentMethod)}
                                </Badge>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      </motion.div>
                    )
                  })}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </ScrollArea>

      {/* ═══════════════════ BOOKING DIALOG ═══════════════════ */}
      <Dialog open={bookingDialogOpen} onOpenChange={(open) => !open && handleCloseDialog()}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto p-0 gap-0 rounded-2xl">

          {/* ── Step 1: Summary ── */}
          {bookingStep === 'summary' && selectedVehicle && (
            <>
              <DialogHeader className="p-5 pb-3">
                <DialogTitle className="flex items-center gap-2 text-lg">
                  <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                    <Car className="h-4 w-4 text-emerald-600" />
                  </div>
                  Réserver votre véhicule
                </DialogTitle>
              </DialogHeader>

              <div className="px-5 pb-5 space-y-4">
                {/* Vehicle summary */}
                <div className={`rounded-xl bg-gradient-to-br ${selectedVehicle.bgColor} p-4 flex items-center gap-4`}>
                  <div className={`${selectedVehicle.color} shrink-0`}>
                    {selectedVehicle.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-sm">{selectedVehicle.name}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {selectedVehicle.seats} places · {selectedVehicle.transmission} · {selectedVehicle.fuelType}
                    </p>
                  </div>
                  <Badge className={`text-[10px] font-bold border-0 ${selectedVehicle.badgeColor}`}>
                    {selectedVehicle.badge}
                  </Badge>
                </div>

                {/* Trip details */}
                <Card className="p-3 space-y-2.5">
                  <div className="flex items-center gap-2 text-sm">
                    <MapPin className="h-4 w-4 text-emerald-600 shrink-0" />
                    <span className="truncate">{pickupLocation}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="h-4 w-4 text-emerald-600 shrink-0" />
                    <span>{formatDateFR(startDate)} → {formatDateFR(endDate)}</span>
                    <Badge variant="secondary" className="text-[10px] ml-auto shrink-0">
                      {numberOfDays} jour{numberOfDays > 1 ? 's' : ''}
                    </Badge>
                  </div>
                </Card>

                {/* Price breakdown */}
                <Card className="p-3">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Prix par jour</span>
                      <span>{formatGNF(selectedVehicle.pricePerDay)}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Nombre de jours</span>
                      <span>× {numberOfDays}</span>
                    </div>
                    <Separator />
                    <div className="flex items-center justify-between text-base font-bold text-emerald-600 dark:text-emerald-400">
                      <span>Total</span>
                      <span>{formatGNF(totalPrice)}</span>
                    </div>
                  </div>
                </Card>

                {/* Customer info */}
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    <User className="h-4 w-4 text-emerald-600" />
                    Vos informations
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Nom complet *</Label>
                      <Input
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        placeholder="Votre nom"
                        className="h-9 text-sm rounded-lg"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Téléphone</Label>
                      <Input
                        value={customerPhone}
                        onChange={(e) => setCustomerPhone(e.target.value)}
                        placeholder="+224 6XX XX XX XX"
                        className="h-9 text-sm rounded-lg"
                      />
                    </div>
                  </div>
                </div>

                {/* Payment method */}
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    <CreditCard className="h-4 w-4 text-emerald-600" />
                    Mode de paiement *
                  </h3>
                  <div className="grid grid-cols-2 gap-2">
                    {PAYMENT_METHODS.map((method) => (
                      <button
                        key={method.value}
                        type="button"
                        onClick={() => setPaymentMethod(method.value)}
                        className={`flex items-center gap-2 p-3 rounded-xl border-2 text-left transition-all text-sm ${
                          paymentMethod === method.value
                            ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/20'
                            : 'border-border hover:border-muted-foreground/30'
                        }`}
                      >
                        <span className={paymentMethod === method.value ? method.color : 'text-muted-foreground'}>
                          {method.icon}
                        </span>
                        <span className="font-medium text-xs flex-1">{method.label}</span>
                        {paymentMethod === method.value && (
                          <Check className="h-4 w-4 text-emerald-600 shrink-0" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Notes */}
                <div className="space-y-1.5">
                  <Label className="text-xs">Notes (optionnel)</Label>
                  <textarea
                    value={bookingNotes}
                    onChange={(e) => setBookingNotes(e.target.value)}
                    placeholder="Demandes spéciales, préférences..."
                    className="w-full min-h-[60px] rounded-lg border border-input bg-background px-3 py-2 text-sm resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                  />
                </div>

                {/* Action buttons */}
                <div className="flex gap-2 pt-1">
                  <Button
                    variant="outline"
                    className="flex-1 rounded-xl"
                    onClick={() => setBookingDialogOpen(false)}
                  >
                    Annuler
                  </Button>
                  <Button
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 rounded-xl"
                    onClick={() => setBookingStep('confirm')}
                    disabled={!paymentMethod || !customerName.trim()}
                  >
                    Continuer
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </div>
            </>
          )}

          {/* ── Step 2: Confirmation ── */}
          {bookingStep === 'confirm' && selectedVehicle && (
            <>
              <DialogHeader className="p-5 pb-3">
                <DialogTitle className="flex items-center gap-2 text-lg">
                  <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                    <CheckCircle2 className="h-4 w-4 text-amber-600" />
                  </div>
                  Confirmer la réservation
                </DialogTitle>
              </DialogHeader>

              <div className="px-5 pb-5 space-y-4">
                <p className="text-sm text-muted-foreground">
                  Vérifiez les détails de votre réservation avant de confirmer.
                </p>

                {/* Confirmation summary card */}
                <Card className="p-4 space-y-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${selectedVehicle.bgColor} flex items-center justify-center ${selectedVehicle.color}`}>
                      {selectedVehicle.icon}
                    </div>
                    <div>
                      <p className="font-semibold text-sm">{selectedVehicle.name}</p>
                      <p className="text-xs text-muted-foreground">{selectedVehicle.seats} places · {selectedVehicle.transmission}</p>
                    </div>
                  </div>
                  <Separator />
                  <div className="space-y-1.5 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Lieu de récupération</span>
                      <span className="font-medium text-right max-w-[60%] truncate">{pickupLocation}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Début</span>
                      <span className="font-medium">{formatDateFR(startDate)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Fin</span>
                      <span className="font-medium">{formatDateFR(endDate)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Durée</span>
                      <span className="font-medium">{numberOfDays} jour{numberOfDays > 1 ? 's' : ''}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Client</span>
                      <span className="font-medium">{customerName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Paiement</span>
                      <span className="font-medium">
                        {PAYMENT_METHODS.find(m => m.value === paymentMethod)?.label || paymentMethod}
                      </span>
                    </div>
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between text-base font-bold text-emerald-600 dark:text-emerald-400">
                    <span>Total à payer</span>
                    <span>{formatGNF(totalPrice)}</span>
                  </div>
                </Card>

                {/* Warning */}
                <div className="flex items-start gap-2 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 p-3">
                  <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                  <p className="text-xs text-amber-700 dark:text-amber-400">
                    Le paiement sera effectué lors de la récupération du véhicule. Une confirmation vous sera envoyée par SMS.
                  </p>
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1 rounded-xl"
                    onClick={() => setBookingStep('summary')}
                    disabled={isSubmitting}
                  >
                    <ArrowLeft className="h-4 w-4 mr-1" />
                    Retour
                  </Button>
                  <Button
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 rounded-xl"
                    onClick={handleSubmitBooking}
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                        Réservation...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="h-4 w-4 mr-1.5" />
                        Confirmer
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </>
          )}

          {/* ── Step 3: Success ── */}
          {bookingStep === 'success' && (
            <>
              <DialogHeader className="p-5 pb-3">
                <DialogTitle className="flex items-center gap-2 text-lg">
                  <div className="w-8 h-8 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  </div>
                  Réservation confirmée !
                </DialogTitle>
              </DialogHeader>

              <div className="px-5 pb-5 space-y-4">
                {/* Success animation area */}
                <div className="flex flex-col items-center text-center py-4">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 200, damping: 15 }}
                    className="w-20 h-20 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mb-4"
                  >
                    <Check className="h-10 w-10 text-green-600" />
                  </motion.div>
                  <h3 className="text-lg font-bold text-green-600 dark:text-green-400">
                    Votre véhicule est réservé !
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1 max-w-xs">
                    Présentez-vous à l&apos;agence le jour prévu avec votre pièce d&apos;identité.
                  </p>
                </div>

                {/* Reference card */}
                <Card className="p-4 border-green-200 bg-green-50/50 dark:bg-green-950/10">
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Référence</span>
                      <span className="font-mono font-bold text-emerald-600">{bookingRef.slice(0, 8).toUpperCase()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Véhicule</span>
                      <span className="font-medium">{selectedVehicle?.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Dates</span>
                      <span className="font-medium">{formatDateFR(startDate)} → {formatDateFR(endDate)}</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between font-bold text-emerald-600">
                      <span>Total payé</span>
                      <span>{formatGNF(totalPrice)}</span>
                    </div>
                  </div>
                </Card>

                {/* Next steps */}
                <Card className="p-4">
                  <h4 className="text-sm font-semibold mb-2">Prochaines étapes</h4>
                  <ul className="space-y-2">
                    <li className="flex items-start gap-2 text-xs text-muted-foreground">
                      <span className="w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 text-[10px] font-bold shrink-0 mt-0.5">1</span>
                      <span>Vous recevrez un SMS de confirmation avec les détails</span>
                    </li>
                    <li className="flex items-start gap-2 text-xs text-muted-foreground">
                      <span className="w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 text-[10px] font-bold shrink-0 mt-0.5">2</span>
                      <span>Présentez-vous à <strong>{pickupLocation}</strong> le {formatDateFR(startDate)}</span>
                    </li>
                    <li className="flex items-start gap-2 text-xs text-muted-foreground">
                      <span className="w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 text-[10px] font-bold shrink-0 mt-0.5">3</span>
                      <span>Apportez votre pièce d&apos;identité et effectuez le paiement</span>
                    </li>
                  </ul>
                </Card>

                <Button
                  className="w-full bg-emerald-600 hover:bg-emerald-700 rounded-xl"
                  onClick={handleCloseDialog}
                >
                  <Check className="h-4 w-4 mr-1.5" />
                  Terminé
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
