'use client'

import { useState, useMemo, useEffect } from 'react'
import { useTheme } from 'next-themes'
import { motion } from 'framer-motion'
import { useAppStore } from '@/lib/mova/store'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import {
  ArrowLeft, Bell, Car, Users, Navigation, Clock, Star, Search,
  Check, X, MessageCircle, Calendar, Route,
  Shield, VolumeX, Music, Briefcase, Filter,
  Moon, Sun
} from 'lucide-react'

import NotificationPanel from "@/components/mova/notification-panel"
import ChatPanel from "@/components/mova/chat-panel"
import { CONAKRY_LOCATIONS } from '@/lib/mova/regions'

// ── Constants ──────────────────────────────────────────────

const conakryLocations = CONAKRY_LOCATIONS

const fmt = (n: number) => new Intl.NumberFormat('fr-GN').format(n) + ' GNF'

type CarpoolStatus = 'upcoming' | 'in_progress' | 'completed' | 'cancelled'

interface AvailableTrip {
  id: string
  driver: { name: string; avatar: string; rating: number; rides: number; verified: boolean }
  from: string
  fromZone: string
  to: string
  toZone: string
  departure: string
  departureDate: string
  totalSeats: number
  seatsLeft: number
  price: number
  preferences: string[]
  vehicle: string
  vehicleType: 'standard' | 'premium' | 'suv'
}

interface PublishedTrip {
  id: string
  from: string
  fromZone: string
  to: string
  toZone: string
  date: string
  time: string
  totalSeats: number
  reservedSeats: number
  pricePerSeat: number
  status: CarpoolStatus
  preferences: string[]
  vehicle: string
  earnings: number
}

interface Booking {
  id: string
  driverName: string
  driverAvatar: string
  driverPhone: string
  from: string
  to: string
  date: string
  time: string
  seatNumber: number
  price: number
  status: 'confirmed' | 'pending' | 'cancelled'
}

// ── Helpers ──────────────────────────────────────────────

function getPrefColor(pref: string): string {
  if (pref.includes('Silencieux') || pref.includes('Silence')) return 'bg-blue-100 text-blue-700 border-blue-200'
  if (pref.includes('Fumeur')) return 'bg-orange-100 text-orange-700 border-orange-200'
  if (pref.includes('Musique')) return 'bg-purple-100 text-purple-700 border-purple-200'
  if (pref.includes('Femmes')) return 'bg-pink-100 text-pink-700 border-pink-200'
  return 'bg-gray-100 text-gray-700 border-gray-200'
}

function getPrefIcon(pref: string) {
  if (pref.includes('Silencieux') || pref.includes('Silence')) return VolumeX
  if (pref.includes('Fumeur')) return Car
  if (pref.includes('Musique')) return Music
  return Shield
}

function getPublishStatusInfo(status: CarpoolStatus) {
  const map: Record<CarpoolStatus, { label: string; className: string }> = {
    upcoming: { label: 'A venir', className: 'bg-blue-100 text-blue-800 border-blue-200' },
    in_progress: { label: 'En cours', className: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
    completed: { label: 'Terminé', className: 'bg-gray-100 text-gray-600 border-gray-200' },
    cancelled: { label: 'Annulé', className: 'bg-red-100 text-red-800 border-red-200' },
  }
  return map[status]
}

function getBookingStatusInfo(status: Booking['status']) {
  const map: Record<Booking['status'], { label: string; className: string }> = {
    confirmed: { label: 'Confirmée', className: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
    pending: { label: 'En attente', className: 'bg-amber-100 text-amber-800 border-amber-200' },
    cancelled: { label: 'Annulée', className: 'bg-red-100 text-red-800 border-red-200' },
  }
  return map[status]
}

function getVehicleTypeBadge(type: string) {
  if (type === 'premium') return { label: 'Premium', className: 'bg-amber-100 text-amber-700 border-amber-200' }
  if (type === 'suv') return { label: 'SUV', className: 'bg-emerald-100 text-emerald-700 border-emerald-200' }
  return { label: 'Standard', className: 'bg-gray-100 text-gray-600 border-gray-200' }
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
}

// ── Main Component ─────────────────────────────────────────

export default function CarpoolView() {
  const { user, setView, goBack } = useAppStore()
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  // Navigation
  const [activeTab, setActiveTab] = useState("search")
  const [showNotifications, setShowNotifications] = useState(false)
  const [showChat, setShowChat] = useState(false)
  const [chatContact, setChatContact] = useState({ name: 'Conducteur', phone: '+224 6XX XX XX XX' })

  // Search state
  const [searchFrom, setSearchFrom] = useState('')
  const [searchTo, setSearchTo] = useState('')
  const [searchDate, setSearchDate] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() + 1)
    return d.toISOString().split('T')[0]
  })
  const [searchTime, setSearchTime] = useState('')
  const [searchSeats, setSearchSeats] = useState(1)
  const [searchDone, setSearchDone] = useState(false)

  // Publish form state
  const [publishFrom, setPublishFrom] = useState('')
  const [publishTo, setPublishTo] = useState('')
  const [publishDate, setPublishDate] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() + 1)
    return d.toISOString().split('T')[0]
  })
  const [publishTime, setPublishTime] = useState('')
  const [publishSeats, setPublishSeats] = useState(3)
  const [publishPrice, setPublishPrice] = useState('')
  const [publishPrefSilent, setPublishPrefSilent] = useState(false)
  const [publishPrefSmoking, setPublishPrefSmoking] = useState(false)
  const [publishPrefMusic, setPublishPrefMusic] = useState(false)
  const [publishPrefLuggage, setPublishPrefLuggage] = useState(false)
  const [publishPrefWomen, setPublishPrefWomen] = useState(false)
  const [publishSuccess, setPublishSuccess] = useState(false)
  const [showPublishSuccess, setShowPublishSuccess] = useState(false)

  // My trips
  const [publishedTrips, setPublishedTrips] = useState<PublishedTrip[]>([])
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loadingCarpool, setLoadingCarpool] = useState(true)

  // Confirm reservation dialog
  const [selectedTrip, setSelectedTrip] = useState<AvailableTrip | null>(null)
  const [confirmReserve, setConfirmReserve] = useState(false)

  useEffect(() => { queueMicrotask(() => setMounted(true)) }, [])

  // Fetch carpools from API on mount
  useEffect(() => {
    async function fetchCarpools() {
      try {
        const token = localStorage.getItem('mova_token')
        const res = await fetch('/api/mova/carpool', {
          headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        })
        if (!res.ok) throw new Error('Erreur serveur')
        const data = await res.json()
        if (data.carpools && data.carpools.length > 0) {
          const mapped = data.carpools.map((ride: Record<string, unknown>) => {
            const cp = (ride.carpoolData as Record<string, unknown>) || {}
            const driver = (ride.driver as Record<string, unknown>) || {}
            return {
              id: ride.id as string,
              from: ride.pickupAddress as string,
              fromZone: ride.pickupZone as string,
              to: ride.dropoffAddress as string,
              toZone: ride.dropoffZone as string,
              date: ride.createdAt ? new Date(ride.createdAt as string).toISOString().split('T')[0] : '',
              time: (cp.departureTime as string) ? new Date(cp.departureTime as string).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '',
              totalSeats: (cp.availableSeats as number) || 1,
              reservedSeats: 0,
              pricePerSeat: (cp.perSeatFare as number) || 0,
              status: ride.status === 'completed' ? 'completed' as CarpoolStatus
                : ride.status === 'cancelled' ? 'cancelled' as CarpoolStatus
                : ride.status === 'in_progress' ? 'in_progress' as CarpoolStatus
                : 'upcoming' as CarpoolStatus,
              preferences: [] as string[],
              vehicle: (driver.name as string) ? `${driver.name} - Covoiturage` : 'Conducteur',
              earnings: (cp.perSeatFare as number) || 0,
            } as PublishedTrip
          })
          setPublishedTrips(mapped)
        }
      } catch (err) {
        console.error('Erreur chargement covoiturages:', err)
        // Fall back to demo data (already set as initial state)
      } finally {
        queueMicrotask(() => setLoadingCarpool(false))
      }
    }
    fetchCarpools()
  }, [])


  const [availableTrips, setAvailableTrips] = useState<AvailableTrip[]>([
    {
      id: 'cp-001',
      driver: { name: 'Mamadou Bah', avatar: 'MB', rating: 4.9, rides: 234, verified: true },
      from: 'Centre-ville Kaloum',
      fromZone: 'Kaloum',
      to: 'Aeroport Gbessia',
      toZone: 'Gbessia',
      departure: '08:00',
      departureDate: new Date(Date.now() + 86400000).toISOString().split('T')[0],
      totalSeats: 3,
      seatsLeft: 2,
      price: 5000,
      preferences: ['Silencieux'],
      vehicle: 'Toyota Corolla 2022',
      vehicleType: 'standard',
    },
    {
      id: 'cp-002',
      driver: { name: 'Fatoumata Diallo', avatar: 'FD', rating: 4.8, rides: 187, verified: true },
      from: 'Marche Madina',
      fromZone: 'Matam',
      to: 'Simbaya 2',
      toZone: 'Matoto',
      departure: '07:30',
      departureDate: new Date(Date.now() + 86400000).toISOString().split('T')[0],
      totalSeats: 4,
      seatsLeft: 1,
      price: 3500,
      preferences: ['Femmes uniquement'],
      vehicle: 'Hyundai Accent',
      vehicleType: 'standard',
    },
    {
      id: 'cp-003',
      driver: { name: 'Ibrahima Soumah', avatar: 'IS', rating: 4.7, rides: 142, verified: true },
      from: 'Taouyah',
      fromZone: 'Ratoma',
      to: 'Palais du Peuple',
      toZone: 'Dixinn',
      departure: '07:00',
      departureDate: new Date(Date.now() + 2 * 86400000).toISOString().split('T')[0],
      totalSeats: 3,
      seatsLeft: 3,
      price: 4000,
      preferences: ['Musique'],
      vehicle: 'Toyota Yaris',
      vehicleType: 'standard',
    },
    {
      id: 'cp-004',
      driver: { name: 'Sekou Conde', avatar: 'SC', rating: 5.0, rides: 310, verified: true },
      from: 'Cite des Enseignants',
      fromZone: 'Ratoma',
      to: 'Centre-ville Kaloum',
      toZone: 'Kaloum',
      departure: '07:45',
      departureDate: new Date(Date.now() + 86400000).toISOString().split('T')[0],
      totalSeats: 3,
      seatsLeft: 2,
      price: 4500,
      preferences: ['Silencieux', 'Bagages autorises'],
      vehicle: 'Mercedes Classe C',
      vehicleType: 'premium',
    },
    {
      id: 'cp-005',
      driver: { name: 'Aminata Camara', avatar: 'AC', rating: 4.6, rides: 98, verified: true },
      from: 'Sonfonia Centre',
      fromZone: 'Sonfonia',
      to: 'Marche Madina',
      toZone: 'Matam',
      departure: '06:30',
      departureDate: new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0],
      totalSeats: 4,
      seatsLeft: 4,
      price: 3000,
      preferences: [],
      vehicle: 'Dacia Logan',
      vehicleType: 'standard',
    },
    {
      id: 'cp-006',
      driver: { name: 'Abdoulaye Barry', avatar: 'AB', rating: 4.9, rides: 276, verified: true },
      from: 'Corniche Nord',
      fromZone: 'Dixinn',
      to: 'Cite des Ministres',
      toZone: 'Tombolia',
      departure: '17:30',
      departureDate: new Date(Date.now() + 86400000).toISOString().split('T')[0],
      totalSeats: 3,
      seatsLeft: 1,
      price: 5500,
      preferences: ['Climatise'],
      vehicle: 'Toyota RAV4',
      vehicleType: 'suv',
    },
    {
      id: 'cp-007',
      driver: { name: 'Mariama Toure', avatar: 'MT', rating: 4.8, rides: 156, verified: true },
      from: 'Koloma',
      fromZone: 'Matoto',
      to: 'Hotel Riviera',
      toZone: 'Kaloum',
      departure: '07:15',
      departureDate: new Date(Date.now() + 2 * 86400000).toISOString().split('T')[0],
      totalSeats: 2,
      seatsLeft: 2,
      price: 6000,
      preferences: ['Silencieux'],
      vehicle: 'Peugeot 3008',
      vehicleType: 'premium',
    },
    {
      id: 'cp-008',
      driver: { name: 'Fode Bangoura', avatar: 'FB', rating: 4.7, rides: 203, verified: true },
      from: 'Lambanyi Centre',
      fromZone: 'Lambanyi',
      to: 'Port de Conakry',
      toZone: 'Kaloum',
      departure: '06:00',
      departureDate: new Date(Date.now() + 86400000).toISOString().split('T')[0],
      totalSeats: 4,
      seatsLeft: 3,
      price: 4000,
      preferences: ['Musique', 'Fumeur'],
      vehicle: 'Nissan Patrol',
      vehicleType: 'suv',
    },
    {
      id: 'cp-009',
      driver: { name: 'Hawa Sylla', avatar: 'HS', rating: 4.9, rides: 89, verified: true },
      from: 'Belle Vue',
      fromZone: 'Dixinn',
      to: 'Taouyah',
      toZone: 'Ratoma',
      departure: '18:00',
      departureDate: new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0],
      totalSeats: 3,
      seatsLeft: 3,
      price: 3500,
      preferences: ['Femmes uniquement', 'Silencieux'],
      vehicle: 'Kia Rio',
      vehicleType: 'standard',
    },
    {
      id: 'cp-010',
      driver: { name: 'Ousmane Keita', avatar: 'OK', rating: 4.6, rides: 168, verified: true },
      from: 'Cite de l\'Air',
      fromZone: 'Gbessia',
      to: 'Marche Niger',
      toZone: 'Matam',
      departure: '08:30',
      departureDate: new Date(Date.now() + 86400000).toISOString().split('T')[0],
      totalSeats: 3,
      seatsLeft: 2,
      price: 3000,
      preferences: ['Bagages autorises'],
      vehicle: 'Toyota Hilux',
      vehicleType: 'suv',
    },
  ])

  // Search filtering
  const filteredTrips = useMemo(() => {
    if (!searchDone) return availableTrips
    return availableTrips.filter(trip => {
      const matchFrom = !searchFrom || trip.from.toLowerCase().includes(searchFrom.toLowerCase()) || trip.fromZone.toLowerCase().includes(searchFrom.toLowerCase())
      const matchTo = !searchTo || trip.to.toLowerCase().includes(searchTo.toLowerCase()) || trip.toZone.toLowerCase().includes(searchTo.toLowerCase())
      const matchSeats = searchSeats <= trip.seatsLeft
      return matchFrom && matchTo && matchSeats
    })
  }, [searchFrom, searchTo, searchDone, searchSeats, availableTrips])

  // Suggested price for publish (deterministic: base + seat factor + distance factor)
  const suggestedPrice = useMemo(() => {
    if (!publishFrom || !publishTo) return 3000
    const fromLoc = conakryLocations.find(l => l.name === publishFrom)
    const toLoc = conakryLocations.find(l => l.name === publishTo)
    if (!fromLoc || !toLoc) return 5000 + (publishSeats * 1500)
    const R = 6371
    const dLat = (toLoc.lat - fromLoc.lat) * Math.PI / 180
    const dLng = (toLoc.lng - fromLoc.lng) * Math.PI / 180
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(fromLoc.lat * Math.PI / 180) * Math.cos(toLoc.lat * Math.PI / 180) * Math.sin(dLng / 2) ** 2
    const distanceKm = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    return Math.round(5000 + (publishSeats * 1500) + (distanceKm * 200))
  }, [publishFrom, publishTo, publishSeats])

  // Handlers
  function handleSearch() {
    setSearchDone(true)
    if (!searchFrom && !searchTo) {
      toast.success(`${availableTrips.length} trajets disponibles`)
    } else {
      toast.success(`${filteredTrips.length} trajet(s) trouve(s)`)
    }
  }

  async function handleReserve() {
    if (!selectedTrip) return
    const newBooking: Booking = {
      id: `bk-${Date.now()}`,
      driverName: selectedTrip.driver.name,
      driverAvatar: selectedTrip.driver.avatar,
      driverPhone: '+224 6XX XX XX XX',
      from: selectedTrip.from,
      to: selectedTrip.to,
      date: selectedTrip.departureDate,
      time: selectedTrip.departure,
      seatNumber: selectedTrip.totalSeats - selectedTrip.seatsLeft + 1,
      price: selectedTrip.price,
      status: 'confirmed',
    }
    // Optimistic UI update
    setBookings(prev => [newBooking, ...prev])
    setConfirmReserve(false)
    setSelectedTrip(null)
    toast.success('Réservation confirmée!', { description: `${fmt(selectedTrip.price)} — ${selectedTrip.from} vers ${selectedTrip.to}` })
    // Persist to API
    try {
      const token = localStorage.getItem('mova_token')
      await fetch('/api/mova/bookings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          type: 'carpool',
          action: 'reserve',
          tripId: selectedTrip.id,
          passengerId: user?.id,
          from: selectedTrip.from,
          to: selectedTrip.to,
          date: selectedTrip.departureDate,
          time: selectedTrip.departure,
          seats: 1,
          price: selectedTrip.price,
        }),
      })
    } catch (err) {
      console.error('Failed to persist reservation:', err)
      toast.error('Erreur de connexion — réservation sauvegardée localement')
    }
  }

  async function handlePublish() {
    if (!publishFrom || !publishTo || !publishDate || !publishTime || !publishPrice) {
      toast.error('Veuillez remplir tous les champs obligatoires')
      return
    }
    const prefs: string[] = []
    if (publishPrefSilent) prefs.push('Silencieux')
    if (publishPrefSmoking) prefs.push('Fumeur')
    if (publishPrefMusic) prefs.push('Musique')
    if (publishPrefLuggage) prefs.push('Bagages autorisés')
    if (publishPrefWomen) prefs.push('Femmes uniquement')

    const newTrip: PublishedTrip = {
      id: `pub-${Date.now()}`,
      from: publishFrom,
      fromZone: conakryLocations.find(l => l.name === publishFrom)?.zone || '',
      to: publishTo,
      toZone: conakryLocations.find(l => l.name === publishTo)?.zone || '',
      date: publishDate,
      time: publishTime,
      totalSeats: publishSeats,
      reservedSeats: 0,
      pricePerSeat: Number(publishPrice),
      status: 'upcoming',
      preferences: prefs,
      vehicle: user ? `${user.name} - Toyota Corolla` : 'Mon véhicule',
      earnings: 0,
    }
    // Optimistic UI update
    setPublishedTrips(prev => [newTrip, ...prev])
    setPublishSuccess(true)
    setShowPublishSuccess(true)
    toast.success('Trajet publié avec succès!')
    // Persist to API
    try {
      const token = localStorage.getItem('mova_token')
      await fetch('/api/mova/bookings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          type: 'carpool',
          action: 'publish',
          driverId: user?.id,
          from: publishFrom,
          fromZone: conakryLocations.find(l => l.name === publishFrom)?.zone || '',
          to: publishTo,
          toZone: conakryLocations.find(l => l.name === publishTo)?.zone || '',
          date: publishDate,
          time: publishTime,
          totalSeats: publishSeats,
          pricePerSeat: Number(publishPrice),
          preferences: prefs,
          prefLuggage: publishPrefLuggage,
          prefWomen: publishPrefWomen,
          vehicle: user ? `${user.name} - Toyota Corolla` : 'Mon véhicule',
        }),
      })
    } catch (err) {
      console.error('Failed to persist published trip:', err)
      toast.error('Erreur de connexion — trajet sauvegardé localement')
    }
  }

  function handleCancelTrip(id: string) {
    setPublishedTrips(prev => prev.map(t => t.id === id ? { ...t, status: 'cancelled' as CarpoolStatus } : t))
    toast.success('Trajet annulé')
  }

  function handleCancelBooking(id: string) {
    setBookings(prev => prev.map(b => b.id === id ? { ...b, status: 'cancelled' as const } : b))
    toast.success('Réservation annulée')
  }

  if (!mounted) return null

  return (
    <div className="min-h-screen pb-20 sm:pb-8">
      {/* ── Header ── */}
      <header className="sticky top-0 z-50 mova-glass border-b border-border/50">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="icon" className="rounded-full" onClick={() => goBack()}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-lg font-bold flex items-center gap-2">
              <Users className="h-5 w-5 text-emerald-600" />
              Covoiturage MOVA
            </h1>
            <p className="text-xs text-muted-foreground">Partagez vos trajets à Conakry</p>
          </div>
          <button
            type="button"
            onClick={() => setShowNotifications(true)}
            className="relative p-2 rounded-full hover:bg-muted transition-colors"
            aria-label="Notifications"
          >
            <Bell className="h-5 w-5" />
            <span className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-red-500 text-[10px] text-white flex items-center justify-center font-bold leading-none">2</span>
          </button>
          {mounted && (
            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="p-2 rounded-full hover:bg-muted transition-colors"
              aria-label="Changer de theme"
            >
              {theme === 'dark' ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4 text-slate-600" />}
            </button>
          )}
        </div>
      </header>

      {/* ── Content ── */}
      <main className="max-w-4xl mx-auto px-4 py-4">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full flex mb-4 bg-muted/50 p-1 rounded-xl h-auto">
            {[
              { value: "search", label: "Rechercher", icon: Search },
              { value: "publish", label: "Publier", icon: Car },
              { value: "mytrips", label: "Mes trajets", icon: Route },
              { value: "bookings", label: "Réservations", icon: Calendar },
            ].map(tab => (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                aria-label={tab.label}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-1 rounded-lg data-[state=active]:bg-emerald-500 data-[state=active]:text-white data-[state=active]:shadow-md text-xs sm:text-sm transition-all"
              >
                <tab.icon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                <span className="hidden sm:inline">{tab.label}</span>
              </TabsTrigger>
            ))}
          </TabsList>

          {/* ═══ TAB 1: Rechercher ═══════════════════════ */}
          <TabsContent value="search" className="mt-0 space-y-4">
            {/* Search Form */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <Card className="p-4 border-emerald-200 bg-emerald-50/50">
                <div className="flex items-center gap-2 mb-3">
                  <Search className="h-4 w-4 text-emerald-600" />
                  <span className="text-sm font-semibold text-emerald-800">Rechercher un trajet</span>
                </div>

                <div className="space-y-3">
                  {/* Route Inputs */}
                  <div className="flex flex-col sm:flex-row gap-2">
                    <div className="flex-1">
                      <Label className="text-xs mb-1 block">Départ</Label>
                      <Select value={searchFrom} onValueChange={setSearchFrom}>
                        <SelectTrigger><SelectValue placeholder="Départ..." /></SelectTrigger>
                        <SelectContent>
                          {conakryLocations.map(l => <SelectItem key={l.name} value={l.name}>{l.name} ({l.zone})</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center justify-center pt-4">
                      <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center">
                        <Navigation className="h-4 w-4 text-emerald-600" />
                      </div>
                    </div>
                    <div className="flex-1">
                      <Label className="text-xs mb-1 block">Arrivée</Label>
                      <Select value={searchTo} onValueChange={setSearchTo}>
                        <SelectTrigger><SelectValue placeholder="Arrivée..." /></SelectTrigger>
                        <SelectContent>
                          {conakryLocations.map(l => <SelectItem key={l.name} value={l.name}>{l.name} ({l.zone})</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Date, Time, Seats */}
                  <div className="grid grid-cols-3 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs">Date</Label>
                      <Input type="date" value={searchDate} onChange={e => setSearchDate(e.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Heure</Label>
                      <Input type="time" value={searchTime} onChange={e => setSearchTime(e.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Places</Label>
                      <div className="flex gap-1">
                        {[1, 2, 3].map(n => (
                          <button
                            key={n}
                            type="button"
                            onClick={() => setSearchSeats(n)}
                            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all border ${
                              searchSeats === n
                                ? 'bg-emerald-500 text-white border-emerald-500'
                                : 'bg-background border-border hover:border-emerald-300'
                            }`}
                          >
                            {n}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <Button onClick={handleSearch} className="w-full mova-gradient text-white hover:opacity-90 rounded-xl font-semibold">
                    <Search className="h-4 w-4 mr-2" />
                    Rechercher
                  </Button>
                </div>
              </Card>
            </motion.div>

            {/* Results */}
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }}>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-muted-foreground">
                  {filteredTrips.length} trajet{filteredTrips.length > 1 ? 's' : ''} disponible{filteredTrips.length > 1 ? 's' : ''}
                </h2>
              </div>

              {filteredTrips.length === 0 ? (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex flex-col items-center justify-center py-12 text-center"
                >
                  <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                    <Search className="w-8 h-8 text-muted-foreground" />
                  </div>
                  <h3 className="font-semibold text-base mb-1">Aucun covoiturage disponible</h3>
                  <p className="text-sm text-muted-foreground max-w-xs">Aucun covoiturage disponible pour cette route. Essayez une autre recherche.</p>
                </motion.div>
              ) : (
                <div className="space-y-3 max-h-[65vh] overflow-y-auto mova-scrollbar">
                  {filteredTrips.map((trip, i) => {
                    const vBadge = getVehicleTypeBadge(trip.vehicleType)
                    return (
                      <motion.div
                        key={trip.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.15 + i * 0.05 }}
                      >
                        <Card className="mova-card-hover overflow-hidden" onClick={() => setSelectedTrip(trip)}>
                          <CardContent className="p-4 space-y-3">
                            {/* Driver row */}
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <Avatar className="h-10 w-10">
                                  <AvatarFallback className="bg-emerald-100 text-emerald-700 text-sm font-bold">
                                    {trip.driver.avatar}
                                  </AvatarFallback>
                                </Avatar>
                                <div>
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-sm font-semibold">{trip.driver.name}</span>
                                    {trip.driver.verified && (
                                      <Badge className="bg-emerald-100 text-emerald-700 text-[10px] px-1.5 py-0 border-0">
                                        <Check className="h-2.5 w-2.5 mr-0.5" /> Vérifié
                                      </Badge>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                    <span className="flex items-center gap-0.5">
                                      <Star className="h-3 w-3 text-amber-500 fill-amber-500" /> {trip.driver.rating}
                                    </span>
                                    <span>{trip.driver.rides} trajets</span>
                                  </div>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="text-base font-bold text-emerald-700">{fmt(trip.price)}</p>
                                <p className="text-[10px] text-muted-foreground">/place</p>
                              </div>
                            </div>

                            {/* Route */}
                            <div className="flex items-start gap-2">
                              <div className="flex flex-col items-center gap-0.5 pt-1">
                                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                                <div className="w-0.5 h-8 bg-border" />
                                <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                              </div>
                              <div className="flex-1">
                                <p className="text-sm font-medium">{trip.from}</p>
                                <div className="py-1" />
                                <p className="text-sm font-medium">{trip.to}</p>
                              </div>
                              <div className="text-right space-y-1">
                                <Badge variant="outline" className="text-[10px]">
                                  <Clock className="h-3 w-3 mr-1" /> {trip.departure}
                                </Badge>
                              </div>
                            </div>

                            {/* Meta */}
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge variant="outline" className="text-[10px]">
                                <Calendar className="h-3 w-3 mr-1" />
                                {new Date(trip.departureDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                              </Badge>
                              <Badge variant="outline" className="text-[10px]">
                                <Users className="h-3 w-3 mr-1" /> {trip.seatsLeft}/{trip.totalSeats} places
                              </Badge>
                              <Badge className={`${vBadge.className} text-[10px] border`}>
                                {vBadge.label}
                              </Badge>
                              {trip.preferences.map((pref, j) => {
                                const PrefIcon = getPrefIcon(pref)
                                return (
                                  <Badge key={j} className={`${getPrefColor(pref)} text-[10px] border`}>
                                    <PrefIcon className="h-2.5 w-2.5 mr-0.5" />
                                    {pref}
                                  </Badge>
                                )
                              })}
                            </div>

                            {/* Reserve button */}
                            <Button
                              className="w-full mova-gradient text-white hover:opacity-90 text-sm"
                              onClick={(e) => { e.stopPropagation(); setSelectedTrip(trip); setConfirmReserve(true) }}
                            >
                              Réserver — {fmt(trip.price)}
                            </Button>
                          </CardContent>
                        </Card>
                      </motion.div>
                    )
                  })}
                </div>
              )}
            </motion.div>
          </TabsContent>

          {/* ═══ TAB 2: Publier ═══════════════════════════ */}
          <TabsContent value="publish" className="mt-0 space-y-4">
            {showPublishSuccess ? (
              <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="space-y-4">
                <Card className="p-6 border-emerald-200 bg-emerald-50 text-center">
                  <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
                    <Check className="w-8 h-8 text-emerald-600" />
                  </div>
                  <h3 className="text-lg font-bold text-emerald-800 mb-1">Trajet publié avec succès!</h3>
                  <p className="text-sm text-muted-foreground mb-4">Les passagers peuvent maintenant réserver votre trajet. Vous recevrez une notification à chaque réservation.</p>
                  <Button onClick={() => setShowPublishSuccess(false)} className="mova-gradient text-white hover:opacity-90 rounded-xl">
                    Publier un autre trajet
                  </Button>
                </Card>
              </motion.div>
            ) : (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                <div className="text-center mb-2">
                  <h2 className="text-xl font-bold">Proposer un trajet</h2>
                  <p className="text-sm text-muted-foreground mt-1">Partagez vos trajets et économisez</p>
                </div>

                {/* Route */}
                <Card className="mova-card-hover">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <Route className="w-4 h-4 text-emerald-600" />
                      Trajet
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex flex-col sm:flex-row gap-2">
                      <div className="flex-1 space-y-1">
                        <Label className="text-xs">Départ *</Label>
                        <Select value={publishFrom} onValueChange={setPublishFrom}>
                          <SelectTrigger><SelectValue placeholder="Départ..." /></SelectTrigger>
                          <SelectContent>
                            {conakryLocations.map(l => <SelectItem key={l.name} value={l.name}>{l.name} ({l.zone})</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex items-center justify-center pt-4">
                        <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center">
                          <Navigation className="h-4 w-4 text-emerald-600" />
                        </div>
                      </div>
                      <div className="flex-1 space-y-1">
                        <Label className="text-xs">Arrivée *</Label>
                        <Select value={publishTo} onValueChange={setPublishTo}>
                          <SelectTrigger><SelectValue placeholder="Arrivée..." /></SelectTrigger>
                          <SelectContent>
                            {conakryLocations.map(l => <SelectItem key={l.name} value={l.name}>{l.name} ({l.zone})</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">Date *</Label>
                        <Input type="date" value={publishDate} onChange={e => setPublishDate(e.target.value)} />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Heure *</Label>
                        <Input type="time" value={publishTime} onChange={e => setPublishTime(e.target.value)} />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Seats and Price */}
                <Card className="mova-card-hover">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <Users className="w-4 h-4 text-emerald-600" />
                      Places et tarif
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label className="text-xs font-medium">Places disponibles</Label>
                      <div className="flex gap-2">
                        {[1, 2, 3, 4].map(n => (
                          <button
                            key={n}
                            type="button"
                            onClick={() => setPublishSeats(n)}
                            className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all border ${
                              publishSeats === n
                                ? 'bg-emerald-500 text-white border-emerald-500 shadow-md'
                                : 'bg-background border-border hover:border-emerald-300'
                            }`}
                          >
                            {n} place{n > 1 ? 's' : ''}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs font-medium">Prix par place (GNF) *</Label>
                        <button
                          type="button"
                          onClick={() => setPublishPrice(String(suggestedPrice))}
                          className="text-[10px] text-emerald-600 hover:underline"
                        >
                          Prix suggéré: {fmt(suggestedPrice)}
                        </button>
                      </div>
                      <Input
                        type="number"
                        placeholder="Ex: 3500"
                        value={publishPrice}
                        onChange={e => setPublishPrice(e.target.value)}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium">Véhicule</Label>
                      <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 text-sm text-muted-foreground">
                        <Car className="w-4 h-4" />
                        Toyota Corolla — Blanc — GN-4821-A
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Preferences */}
                <Card className="mova-card-hover">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <Filter className="w-4 h-4 text-emerald-600" />
                      Préférences
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {[
                      { label: 'Trajet silencieux', icon: VolumeX, checked: publishPrefSilent, onChange: setPublishPrefSilent },
                      { label: 'Fumeur autorisé', icon: Car, checked: publishPrefSmoking, onChange: setPublishPrefSmoking },
                      { label: 'Musique', icon: Music, checked: publishPrefMusic, onChange: setPublishPrefMusic },
                      { label: 'Bagages autorisés', icon: Briefcase, checked: publishPrefLuggage, onChange: setPublishPrefLuggage },
                      { label: 'Femmes uniquement', icon: Shield, checked: publishPrefWomen, onChange: setPublishPrefWomen },
                    ].map(pref => (
                      <div key={pref.label} className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <pref.icon className="w-4 h-4 text-muted-foreground" />
                          <Label className="text-sm cursor-pointer" htmlFor={`pref-${pref.label}`}>{pref.label}</Label>
                        </div>
                        <Switch
                          id={`pref-${pref.label}`}
                          checked={pref.checked}
                          onCheckedChange={pref.onChange}
                        />
                      </div>
                    ))}
                  </CardContent>
                </Card>

                {/* Publish Button */}
                <Button
                  onClick={handlePublish}
                  className="w-full mova-gradient text-white hover:opacity-90 py-6 text-base font-semibold rounded-xl shadow-lg shadow-emerald-500/20"
                >
                  <Car className="h-4 w-4 mr-2" />
                  Publier le trajet
                </Button>
              </motion.div>
            )}
          </TabsContent>

          {/* ═══ TAB 3: Mes trajets ═══════════════════════ */}
          <TabsContent value="mytrips" className="mt-0 space-y-4">
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              {loadingCarpool ? (
                <div className="space-y-3">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Card key={i} className="p-4">
                      <div className="space-y-3">
                        <Skeleton className="h-4 w-24" />
                        <div className="flex items-start gap-2">
                          <div className="flex flex-col items-center gap-0.5 pt-1">
                            <Skeleton className="w-2 h-2 rounded-full" />
                            <Skeleton className="w-0.5 h-8" />
                            <Skeleton className="w-2 h-2 rounded-full" />
                          </div>
                          <div className="flex-1 space-y-3">
                            <Skeleton className="h-4 w-40" />
                            <Skeleton className="h-4 w-32" />
                          </div>
                        </div>
                        <Skeleton className="h-3 w-full" />
                      </div>
                    </Card>
                  ))}
                </div>
              ) : (
              <>
              {/* Stats */}
              <div className="grid grid-cols-3 gap-3 mb-4">
                <Card className="text-center p-3">
                  <p className="text-lg font-bold text-emerald-700">{publishedTrips.filter(t => t.status === 'upcoming' || t.status === 'in_progress').length}</p>
                  <p className="text-[10px] text-muted-foreground">Actifs</p>
                </Card>
                <Card className="text-center p-3">
                  <p className="text-lg font-bold text-emerald-700">{fmt(publishedTrips.filter(t => t.status === 'completed').reduce((s, t) => s + t.earnings, 0))}</p>
                  <p className="text-[10px] text-muted-foreground">Gains totaux</p>
                </Card>
                <Card className="text-center p-3">
                  <p className="text-lg font-bold text-amber-600">{publishedTrips.filter(t => t.status === 'completed').length}</p>
                  <p className="text-[10px] text-muted-foreground">Terminés</p>
                </Card>
              </div>

              {/* Trips List */}
              <div className="space-y-3 max-h-[65vh] overflow-y-auto mova-scrollbar">
                {publishedTrips.length === 0 ? (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex flex-col items-center justify-center py-12 text-center"
                  >
                    <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                      <Route className="w-8 h-8 text-muted-foreground" />
                    </div>
                    <h3 className="font-semibold text-base mb-1">Aucun trajet publié</h3>
                    <p className="text-sm text-muted-foreground max-w-xs">Commencez par publier un trajet pour gagner de l&apos;argent.</p>
                    <Button className="mt-4 mova-gradient text-white" onClick={() => setActiveTab('publish')}>
                      Publier un trajet
                    </Button>
                  </motion.div>
                ) : (
                  publishedTrips.map((trip, i) => {
                    const statusInfo = getPublishStatusInfo(trip.status)
                    const isActive = trip.status === 'upcoming' || trip.status === 'in_progress'
                    return (
                      <motion.div
                        key={trip.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.05 }}
                      >
                        <Card className={`mova-card-hover overflow-hidden ${isActive ? 'border-l-4 border-l-emerald-500' : ''}`}>
                          <CardContent className="p-4 space-y-3">
                            {/* Header */}
                            <div className="flex items-start justify-between">
                              <div className="flex items-center gap-2">
                                <Badge className={`${statusInfo.className} text-[10px] border font-medium`}>
                                  {statusInfo.label}
                                </Badge>
                              </div>
                              {trip.status !== 'cancelled' && (
                                <span className="text-sm font-bold text-emerald-700">
                                  Gains: {fmt(trip.earnings)}
                                </span>
                              )}
                            </div>

                            {/* Route */}
                            <div className="flex items-start gap-2">
                              <div className="flex flex-col items-center gap-0.5 pt-1">
                                <div className="w-2 h-2 rounded-full bg-emerald-500" />
                                <div className="w-0.5 h-8 bg-border" />
                                <div className="w-2 h-2 rounded-full bg-amber-500" />
                              </div>
                              <div className="flex-1 space-y-4">
                                <div>
                                  <p className="text-sm font-medium">{trip.from}</p>
                                  <Badge variant="outline" className="text-[10px] mt-0.5">{trip.fromZone}</Badge>
                                </div>
                                <div>
                                  <p className="text-sm font-medium">{trip.to}</p>
                                  <Badge variant="outline" className="text-[10px] mt-0.5">{trip.toZone}</Badge>
                                </div>
                              </div>
                            </div>

                            {/* Details */}
                            <div className="flex items-center gap-3 flex-wrap">
                              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                <Calendar className="w-3.5 h-3.5" />
                                <span>{formatDate(trip.date)}</span>
                              </div>
                              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                <Clock className="w-3.5 h-3.5" />
                                <span>{trip.time}</span>
                              </div>
                              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                <Users className="w-3.5 h-3.5" />
                                <span>{trip.reservedSeats}/{trip.totalSeats} places réservées</span>
                              </div>
                              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                <Star className="w-3.5 h-3.5 text-amber-500" />
                                <span>{fmt(trip.pricePerSeat)}/place</span>
                              </div>
                            </div>

                            {/* Preferences */}
                            {trip.preferences.length > 0 && (
                              <div className="flex gap-1.5 flex-wrap">
                                {trip.preferences.map((pref, j) => {
                                  const PrefIcon = getPrefIcon(pref)
                                  return (
                                    <Badge key={j} className={`${getPrefColor(pref)} text-[10px] border`}>
                                      <PrefIcon className="h-2.5 w-2.5 mr-0.5" />
                                      {pref}
                                    </Badge>
                                  )
                                })}
                              </div>
                            )}

                            {/* Actions */}
                            {trip.status === 'upcoming' && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="w-full text-xs text-red-600 border-red-300 hover:bg-red-50"
                                onClick={() => handleCancelTrip(trip.id)}
                              >
                                <X className="w-3.5 h-3.5 mr-1" />
                                Annuler le trajet
                              </Button>
                            )}
                          </CardContent>
                        </Card>
                      </motion.div>
                    )
                  })
                )}
              </div>
              </>
              )}
            </motion.div>
          </TabsContent>

          {/* ═══ TAB 4: Réservations ═════════════════════ */}
          <TabsContent value="bookings" className="mt-0 space-y-4">
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <div className="space-y-3 max-h-[70vh] overflow-y-auto mova-scrollbar">
                {bookings.length === 0 ? (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex flex-col items-center justify-center py-12 text-center"
                  >
                    <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                      <Calendar className="w-8 h-8 text-muted-foreground" />
                    </div>
                    <h3 className="font-semibold text-base mb-1">Aucune réservation</h3>
                    <p className="text-sm text-muted-foreground max-w-xs">Vos réservations de covoiturage apparaîtront ici.</p>
                    <Button className="mt-4 mova-gradient text-white" onClick={() => setActiveTab('search')}>
                      <Search className="w-4 h-4 mr-2" />
                      Rechercher un trajet
                    </Button>
                  </motion.div>
                ) : (
                  bookings.map((booking, i) => {
                    const statusInfo = getBookingStatusInfo(booking.status)
                    return (
                      <motion.div
                        key={booking.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.05 }}
                      >
                        <Card className="mova-card-hover overflow-hidden">
                          <CardContent className="p-4 space-y-3">
                            {/* Header */}
                            <div className="flex items-start justify-between">
                              <div className="flex items-center gap-2">
                                <Badge className={`${statusInfo.className} text-[10px] border font-medium`}>
                                  {statusInfo.label}
                                </Badge>
                              </div>
                              <span className="text-sm font-bold text-emerald-700">{fmt(booking.price)}</span>
                            </div>

                            {/* Driver */}
                            <div className="flex items-center gap-3">
                              <Avatar className="h-9 w-9">
                                <AvatarFallback className="bg-emerald-100 text-emerald-700 text-xs font-bold">
                                  {booking.driverAvatar}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <p className="text-sm font-medium">{booking.driverName}</p>
                                <p className="text-[10px] text-muted-foreground">{booking.driverPhone}</p>
                              </div>
                            </div>

                            {/* Route */}
                            <div className="flex items-start gap-2">
                              <div className="flex flex-col items-center gap-0.5 pt-1">
                                <div className="w-2 h-2 rounded-full bg-emerald-500" />
                                <div className="w-0.5 h-6 bg-border" />
                                <div className="w-2 h-2 rounded-full bg-amber-500" />
                              </div>
                              <div className="flex-1 space-y-3">
                                <p className="text-sm font-medium">{booking.from}</p>
                                <p className="text-sm font-medium">{booking.to}</p>
                              </div>
                            </div>

                            {/* Details */}
                            <div className="flex items-center gap-3 flex-wrap">
                              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                <Calendar className="w-3 h-3" />
                                <span>{formatDate(booking.date)}</span>
                              </div>
                              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                <Clock className="w-3 h-3" />
                                <span>{booking.time}</span>
                              </div>
                              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                <Users className="w-3 h-3" />
                                <span>Place {booking.seatNumber}</span>
                              </div>
                            </div>

                            <Separator />

                            {/* Actions */}
                            {booking.status !== 'cancelled' && (
                              <div className="flex gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="flex-1 text-xs"
                                  onClick={() => {
                                    setChatContact({ name: booking.driverName, phone: booking.driverPhone })
                                    setShowChat(true)
                                  }}
                                >
                                  <MessageCircle className="w-3.5 h-3.5 mr-1" />
                                  Contacter
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="flex-1 text-xs text-red-600 border-red-300 hover:bg-red-50"
                                  onClick={() => handleCancelBooking(booking.id)}
                                >
                                  <X className="w-3.5 h-3.5 mr-1" />
                                  Annuler
                                </Button>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      </motion.div>
                    )
                  })
                )}
              </div>
            </motion.div>
          </TabsContent>
        </Tabs>
      </main>

      {/* ── Confirm Reservation Dialog ── */}
      <Dialog open={confirmReserve} onOpenChange={setConfirmReserve}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-lg text-center">Confirmer la réservation</DialogTitle>
          </DialogHeader>
          {selectedTrip && (
            <div className="space-y-4">
              <Card className="p-3 bg-muted/50">
                <div className="flex items-center gap-2 mb-2">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-emerald-100 text-emerald-700 text-xs font-bold">
                      {selectedTrip.driver.avatar}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-sm font-medium">{selectedTrip.driver.name}</p>
                    <p className="text-[10px] text-muted-foreground">{selectedTrip.vehicle}</p>
                  </div>
                </div>
                <div className="flex items-start gap-2 mt-2">
                  <div className="flex flex-col items-center gap-0.5 pt-0.5">
                    <div className="w-2 h-2 rounded-full bg-emerald-500" />
                    <div className="w-0.5 h-6 bg-border" />
                    <div className="w-2 h-2 rounded-full bg-amber-500" />
                  </div>
                  <div className="flex-1 space-y-3">
                    <p className="text-sm">{selectedTrip.from}</p>
                    <p className="text-sm">{selectedTrip.to}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                  <span className="flex items-center gap-0.5"><Clock className="h-3 w-3" /> {selectedTrip.departure}</span>
                  <span className="flex items-center gap-0.5"><Users className="h-3 w-3" /> {searchSeats} place{searchSeats > 1 ? 's' : ''}</span>
                </div>
              </Card>
              <div className="text-center">
                <p className="text-sm text-muted-foreground">Total à payer</p>
                <p className="text-2xl font-bold text-emerald-700">{fmt(selectedTrip.price * searchSeats)}</p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1 rounded-xl" onClick={() => setConfirmReserve(false)}>Annuler</Button>
                <Button className="flex-1 mova-gradient text-white rounded-xl font-semibold" onClick={handleReserve}>
                  <Check className="h-4 w-4 mr-1" /> Confirmer
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Panels */}
      <NotificationPanel open={showNotifications} onOpenChange={setShowNotifications} />
      <ChatPanel
        open={showChat}
        onOpenChange={setShowChat}
        contactName={chatContact.name}
        contactPhone={chatContact.phone}
      />
    </div>
  )
}
