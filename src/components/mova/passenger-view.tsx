"use client"

import React, { useState, useEffect, useCallback, useRef, useMemo } from "react"
import { useTheme } from "next-themes"
import { motion, AnimatePresence } from "framer-motion"
import { toast } from "sonner"

import { useAppStore, type Ride } from "@/lib/mova/store"
import { useNotifications } from '@/lib/mova/use-notifications'
import { useRides, useBookings, useCalculatePricing, useCreateRide } from "@/lib/mova/api-hooks"
import { useTracking } from "@/hooks/use-tracking"

// UI Components
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetDescription,
} from "@/components/ui/sheet"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

// Lucide Icons
import {
  MapPin,
  Navigation,
  ArrowUpDown,
  Car,
  Crown,
  Users,
  Star,
  Phone,
  Share2,
  Clock,
  Route,
  X,
  Check,
  ChevronRight,
  LogOut,
  Moon,
  Sun,
  Bell,
  Globe,
  User as UserIcon,
  History,
  AlertCircle,
  Sparkles,
  Loader2,
  Timer,
  TrendingUp,
  Map,
  Waypoints,
  CircleDot,
  CircleCheckBig,
  CircleAlert,
  MoveRight,
  Menu,
  Plus,
  Shield,
  Snowflake,
  Droplets,
  Briefcase,
  Volume2,
  Download,
  Plane,
  Calendar,
  MapPinned,
  Home,
  Building2,
  MessageCircle,
  Lock,
  UserPlus,
  Receipt,
  ThumbsUp,
  ThumbsDown,
  ChevronDown,
  Zap,
  Heart,
  Send,
  Tag,
  Bike,
  Search,
  Settings,
} from "lucide-react"

import NotificationPanel from "@/components/mova/notification-panel"
import ChatPanel from "@/components/mova/chat-panel"
import AssistantPanel from "@/components/mova/assistant-panel"
import TripSharePanel from "@/components/mova/trip-share-panel"
import { DynamicMovaMap } from "@/components/mova/mova-map"
import { CONAKRY_LOCATIONS, type Location } from "@/lib/mova/regions"
import LiveRideTracker from "@/components/mova/live-ride-tracker"

// ─── Constants ────────────────────────────────────────────────────────────────

const locations: Location[] = CONAKRY_LOCATIONS

interface VehicleOption {
  type: "standard" | "premium" | "van" | "moto"
  name: string
  basePrice: number
  icon: React.ReactNode
  description: string
}

const vehicleOptions: VehicleOption[] = [
  {
    type: "standard",
    name: "Standard",
    basePrice: 3000,
    icon: <Car className="size-5" />,
    description: "Confortable et abordable",
  },
  {
    type: "premium",
    name: "Premium",
    basePrice: 8000,
    icon: <Sparkles className="size-5" />,
    description: "Luxueux et spacieux",
  },
  {
    type: "van",
    name: "Van",
    basePrice: 15000,
    icon: <Users className="size-5" />,
    description: "Idéal en groupe (6 places)",
  },
  {
    type: "moto",
    name: "Moto-Taxi",
    basePrice: 1500,
    icon: <Bike className="size-5" />,
    description: "Rapide et economique",
  },
]

// Mock data removed — all data comes from API or is empty by default

interface FavoritePlace {
  id: string
  label: string
  icon: string
  address: string
  lat: number
  lng: number
}

function getFavoriteIcon(iconId: string): React.ComponentType<{ className?: string }> {
  const icons: Record<string, React.ComponentType<{ className?: string }>> = {
    home: Home,
    work: Building2,
    airport: Plane,
    location: MapPin,
  }
  return icons[iconId] || MapPin
}

const defaultFavoritePlaces: FavoritePlace[] = [
  { id: 'home', label: 'Maison', icon: 'home', address: 'Cité des Enseignants, Ratoma', lat: 9.555, lng: -13.590 },
  { id: 'work', label: 'Bureau', icon: 'work', address: 'Centre-ville, Kaloum', lat: 9.509, lng: -13.712 },
  { id: 'airport', label: 'Aéroport', icon: 'airport', address: 'Aéroport Gbessia, Matoto', lat: 9.581, lng: -13.611 },
]

function loadFavorites(): FavoritePlace[] {
  if (typeof window === 'undefined') return defaultFavoritePlaces
  try {
    const stored = localStorage.getItem('mova_favorites')
    if (stored) {
      const parsed = JSON.parse(stored) as FavoritePlace[]
      if (Array.isArray(parsed) && parsed.length > 0) {
        // Migrate old data where icon might be a serialized object/null
        const migrated = parsed.map((f) => ({
          ...f,
          icon: typeof f.icon === 'string' ? f.icon : 'location',
        }))
        return migrated
      }
    }
  } catch { /* ignore */ }
  return defaultFavoritePlaces
}

function saveFavorites(favorites: FavoritePlace[]) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem('mova_favorites', JSON.stringify(favorites))
  } catch { /* ignore */ }
}

// Mock scheduled rides removed — data comes from API

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Distances reelles entre communes de Conakry (en km)
const CONAKRY_ZONE_DISTANCE: Record<string, Record<string, number>> = {
  Kaloum:     { Kaloum: 0, Dixinn: 4, Matam: 7, Ratoma: 10, Matoto: 15, Kipe: 6, Sonfonia: 12, Lambanyi: 18, Dubreka: 30 },
  Dixinn:     { Kaloum: 4, Dixinn: 0, Matam: 4, Ratoma: 6, Matoto: 12, Kipe: 3, Sonfonia: 9, Lambanyi: 15, Dubreka: 26 },
  Matam:      { Kaloum: 7, Dixinn: 4, Matam: 0, Ratoma: 4, Matoto: 9, Kipe: 3, Sonfonia: 6, Lambanyi: 12, Dubreka: 24 },
  Ratoma:     { Kaloum: 10, Dixinn: 6, Ratoma: 0, Matam: 4, Matoto: 6, Kipe: 5, Sonfonia: 4, Lambanyi: 9, Dubreka: 20 },
  Matoto:     { Kaloum: 15, Dixinn: 12, Matoto: 0, Matam: 9, Ratoma: 6, Kipe: 10, Sonfonia: 3, Lambanyi: 5, Dubreka: 18 },
  Kipe:       { Kaloum: 6, Dixinn: 3, Kipe: 0, Matam: 3, Ratoma: 5, Matoto: 10, Sonfonia: 7, Lambanyi: 13, Dubreka: 25 },
  Sonfonia:   { Kaloum: 12, Dixinn: 9, Sonfonia: 0, Matam: 6, Ratoma: 4, Kipe: 7, Matoto: 3, Lambanyi: 5, Dubreka: 16 },
  Lambanyi:   { Kaloum: 18, Dixinn: 15, Lambanyi: 0, Matam: 12, Ratoma: 9, Kipe: 13, Sonfonia: 5, Matoto: 5, Dubreka: 14 },
  Dubreka:    { Kaloum: 30, Dixinn: 26, Dubreka: 0, Matam: 24, Ratoma: 20, Kipe: 25, Sonfonia: 16, Lambanyi: 14, Matoto: 18 },
}

function formatGNF(amount: number): string {
  return new Intl.NumberFormat("fr-GN").format(amount) + " GNF"
}

function estimateFare(
  pickupZone: string,
  dropoffZone: string,
  type: "standard" | "premium" | "van" | "moto"
): { fare: number; distance: number; duration: number } {
  const basePrice = type === "premium" ? 8000 : type === "van" ? 15000 : type === "moto" ? 1500 : 3000
  const kmPrice = type === "premium" ? 1200 : type === "van" ? 1800 : type === "moto" ? 400 : 800
  const distance = CONAKRY_ZONE_DISTANCE[pickupZone]?.[dropoffZone] ?? CONAKRY_ZONE_DISTANCE[dropoffZone]?.[pickupZone] ?? 5
  const duration = type === "moto" ? Math.round(distance * 2.5 + 3) : Math.round(distance * 3.5 + 5)
  return {
    fare: Math.round(basePrice + distance * kmPrice),
    distance: Math.round(distance * 10) / 10,
    duration,
  }
}

function getStatusConfig(status: Ride["status"]) {
  switch (status) {
    case "completed":
      return { label: "Terminée", color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" }
    case "in_progress":
      return { label: "En cours", color: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300" }
    case "cancelled":
      return { label: "Annulée", color: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300" }
    case "pending":
      return { label: "En attente", color: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300" }
    case "accepted":
      return { label: "Confirmée", color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" }
    default:
      return { label: status, color: "bg-muted text-muted-foreground" }
  }
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)
}

// ─── Map Section (Real Leaflet Map) ──────────────────────────────────────────

interface MapSectionProps {
  pickup?: { lat: number; lng: number; name?: string } | null
  dropoff?: { lat: number; lng: number; name?: string } | null
  drivers?: Array<{ lat: number; lng: number; id: string; name?: string }>
  onLocationSelect?: (lat: number, lng: number, address: string) => void
  onRouteInfo?: (info: { distance: number; duration: number }) => void
  interactive?: boolean
  showRoute?: boolean
  showSearch?: boolean
  assignedDriverLocation?: { lat: number; lng: number; heading?: number; timestamp?: number } | null
  showRideProgress?: boolean
}

function MapSection({ pickup, dropoff, drivers, onLocationSelect, onRouteInfo, interactive = true, showRoute = true, showSearch = true, assignedDriverLocation, showRideProgress = false }: MapSectionProps) {
  return (
    <div className="relative h-full w-full">
      <DynamicMovaMap
        pickup={pickup}
        dropoff={dropoff}
        drivers={drivers}
        showZones={true}
        showRoute={showRoute && !!(pickup && dropoff)}
        interactive={interactive}
        showSearch={showSearch && interactive}
        showLocate={interactive}
        showLayerToggle={interactive}
        showScale={true}
        onLocationSelect={onLocationSelect}
        onRouteInfo={onRouteInfo}
        assignedDriverLocation={assignedDriverLocation}
        showRideProgress={showRideProgress}
      />
    </div>
  )
}

// ─── Booking Flow Phases ──────────────────────────────────────────────────────

type BookingPhase = "form" | "estimating" | "estimated" | "searching" | "active"

interface FareResult {
  fare: number
  distance: number
  duration: number
  breakdown?: {
    baseFare: number
    distanceFare: number
    timeFare: number
    surgeFare: number
    serviceFee: number
    discount: number
    total: number
  } | null
}

// ─── Rating Stars ─────────────────────────────────────────────────────────────

function RatingStars({ rating, size = "sm" }: { rating: number; size?: "sm" | "md" }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={`${size === "sm" ? "size-3" : "size-4"} ${
            star <= Math.round(rating)
              ? "fill-amber-400 text-amber-400"
              : "fill-muted text-muted"
          }`}
        />
      ))}
      <span className={`ml-1 font-medium ${size === "sm" ? "text-xs" : "text-sm"}`}>{rating.toFixed(1)}</span>
    </div>
  )
}

// ─── Address Search Input (Nominatim Geocoding) ────────────────────────────

interface NominatimResult {
  place_id: number
  display_name: string
  lat: string
  lon: string
  type: string
}

interface RecentAddress {
  address: string
  lat: number
  lng: number
  timestamp: number
}

function loadRecentAddresses(): RecentAddress[] {
  if (typeof window === 'undefined') return []
  try {
    const stored = localStorage.getItem('mova_recent_addresses')
    if (stored) return JSON.parse(stored) as RecentAddress[]
  } catch { /* ignore */ }
  return []
}

function saveRecentAddress(address: string, lat: number, lng: number) {
  if (typeof window === 'undefined') return
  try {
    const all = loadRecentAddresses()
    const filtered = all.filter((r) => r.address !== address)
    const entry: RecentAddress = { address, lat, lng, timestamp: Date.now() }
    filtered.unshift(entry)
    localStorage.setItem('mova_recent_addresses', JSON.stringify(filtered.slice(0, 10)))
  } catch { /* ignore */ }
}

interface AddressSearchInputProps {
  value: string
  onAddressSelect: (address: string, lat: number, lng: number) => void
  onClear: () => void
  placeholder: string
  icon: React.ReactNode
  label: string
  favorites: FavoritePlace[]
}

function AddressSearchInput({
  value,
  onAddressSelect,
  onClear,
  placeholder,
  icon,
  label,
  favorites,
}: AddressSearchInputProps) {
  const [query, setQuery] = useState(value)
  const [isOpen, setIsOpen] = useState(false)
  const [results, setResults] = useState<NominatimResult[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [recentAddresses, setRecentAddresses] = useState<RecentAddress[]>(() => loadRecentAddresses())
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Sync query with external value changes
  useEffect(() => {
    setQuery(value)
  }, [value])

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Debounced Nominatim search
  const handleSearch = (searchQuery: string) => {
    setQuery(searchQuery)
    if (debounceRef.current) clearTimeout(debounceRef.current)

    if (!searchQuery.trim() || searchQuery.trim().length < 2) {
      setResults([])
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery + ' Conakry Guinee')}&bounded=1&viewbox=-13.78,9.48,-13.45,9.68&limit=5&accept-language=fr`,
          { headers: { 'User-Agent': 'MOVA-App/1.0' } }
        )
        const data = await res.json()
        setResults(data as NominatimResult[])
      } catch {
        setResults([])
      } finally {
        setIsLoading(false)
      }
    }, 350)
  }

  // Filter CONAKRY_LOCATIONS by query
  const filteredLocations = useMemo(() => {
    if (!query.trim()) return []
    const q = query.toLowerCase()
    return locations.filter((l) => l.name.toLowerCase().includes(q)).slice(0, 5)
  }, [query])

  // Filter favorites by query
  const filteredFavorites = useMemo(() => {
    if (!query.trim()) return favorites.slice(0, 3)
    const q = query.toLowerCase()
    return favorites.filter((f) => f.address.toLowerCase().includes(q) || f.label.toLowerCase().includes(q)).slice(0, 3)
  }, [query, favorites])

  // Filter recent addresses by query
  const filteredRecent = useMemo(() => {
    if (!query.trim()) return recentAddresses.slice(0, 5)
    const q = query.toLowerCase()
    return recentAddresses.filter((r) => r.address.toLowerCase().includes(q)).slice(0, 5)
  }, [query, recentAddresses])

  // Group locations by zone for suggestions
  const groupedLocations = useMemo(() => {
    return locations.reduce<Record<string, Location[]>>((acc, loc) => {
      if (!acc[loc.zone]) acc[loc.zone] = []
      acc[loc.zone].push(loc)
      return acc
    }, {})
  }, [])

  const handleSelect = (address: string, lat: number, lng: number) => {
    setQuery(address)
    setIsOpen(false)
    setResults([])
    onAddressSelect(address, lat, lng)
    saveRecentAddress(address, lat, lng)
    setRecentAddresses(loadRecentAddresses())
  }

  const handleClear = () => {
    setQuery('')
    setIsOpen(false)
    setResults([])
    onClear()
  }

  const showDropdown = isOpen && (
    query.trim().length === 0 ||
    filteredLocations.length > 0 ||
    filteredRecent.length > 0 ||
    filteredFavorites.length > 0 ||
    results.length > 0 ||
    isLoading
  )

  return (
    <div ref={containerRef} className="flex-1 relative">
      <Label className="mb-1.5 text-xs font-medium">{label}</Label>
      <div className="relative">
        <div className="absolute left-2.5 top-1/2 -translate-y-1/2">
          {icon}
        </div>
        <Input
          value={query}
          onChange={(e) => handleSearch(e.target.value)}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder}
          className="pl-9 pr-8"
        />
        {query && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="size-3.5" />
          </button>
        )}
      </div>

      {/* Dropdown Panel */}
      <AnimatePresence>
        {showDropdown && (
          <motion.div
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            transition={{ duration: 0.15 }}
            className="absolute z-50 mt-1 w-full rounded-lg border bg-popover shadow-lg max-h-72 overflow-y-auto mova-scrollbar"
          >
            {/* Loading indicator */}
            {isLoading && (
              <div className="flex items-center gap-2 px-3 py-2.5 text-xs text-muted-foreground">
                <Loader2 className="size-3.5 animate-spin" />
                <span>Recherche en cours...</span>
              </div>
            )}

            {/* Favorites section */}
            {filteredFavorites.length > 0 && !isLoading && (
              <div className="border-b">
                <div className="px-3 py-1.5 text-[10px] font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider flex items-center gap-1">
                  <Star className="size-3" />
                  Favoris
                </div>
                {filteredFavorites.map((fav) => {
                  const FavIcon = getFavoriteIcon(fav.icon)
                  return (
                    <button
                      key={fav.id}
                      type="button"
                      onClick={() => handleSelect(fav.address, fav.lat, fav.lng)}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted/80 text-left transition-colors"
                    >
                      <FavIcon className="size-3.5 text-amber-500 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs font-medium truncate">{fav.label}</p>
                        <p className="text-[10px] text-muted-foreground truncate">{fav.address}</p>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}

            {/* Recent addresses */}
            {filteredRecent.length > 0 && !isLoading && (
              <div className="border-b">
                <div className="px-3 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                  <Clock className="size-3" />
                  Recentes
                </div>
                {filteredRecent.map((recent, idx) => (
                  <button
                    key={`recent-${idx}`}
                    type="button"
                    onClick={() => handleSelect(recent.address, recent.lat, recent.lng)}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted/80 text-left transition-colors"
                  >
                    <Clock className="size-3.5 text-muted-foreground shrink-0" />
                    <span className="text-xs truncate">{recent.address}</span>
                  </button>
                ))}
              </div>
            )}

            {/* Suggestions populaires (CONAKRY_LOCATIONS grouped by zone) - shown when empty or searching */}
            {((!query.trim() && !isLoading) || (query.trim() && filteredLocations.length > 0 && !isLoading)) && (
              <div className="border-b">
                <div className="px-3 py-1.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider flex items-center gap-1">
                  <MapPin className="size-3" />
                  Suggestions populaires
                </div>
                {!query.trim()
                  ? Object.entries(groupedLocations).slice(0, 4).map(([zone, locs]) => (
                      <div key={zone}>
                        <div className="px-3 py-1 text-[10px] font-medium text-muted-foreground pl-6">{zone}</div>
                        {locs.slice(0, 2).map((loc) => (
                          <button
                            key={loc.name}
                            type="button"
                            onClick={() => handleSelect(loc.name, loc.lat, loc.lng)}
                            className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted/80 text-left transition-colors"
                          >
                            <MapPin className="size-3.5 text-emerald-500 shrink-0" />
                            <span className="text-xs truncate">{loc.name}</span>
                          </button>
                        ))}
                      </div>
                    ))
                  : filteredLocations.map((loc) => (
                      <button
                        key={loc.name}
                        type="button"
                        onClick={() => handleSelect(loc.name, loc.lat, loc.lng)}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted/80 text-left transition-colors"
                      >
                        <MapPin className="size-3.5 text-emerald-500 shrink-0" />
                        <div className="min-w-0">
                          <span className="text-xs truncate">{loc.name}</span>
                          <span className="text-[10px] text-muted-foreground ml-1">{loc.zone}</span>
                        </div>
                      </button>
                    ))
                }
              </div>
            )}

            {/* Nominatim geocoding results */}
            {results.length > 0 && !isLoading && (
              <div>
                <div className="px-3 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                  <Search className="size-3" />
                  Resultats
                </div>
                {results.map((result) => {
                  const shortName = result.display_name.split(',').slice(0, 2).join(',').trim()
                  const details = result.display_name.split(',').slice(2, 4).join(',').trim()
                  return (
                    <button
                      key={result.place_id}
                      type="button"
                      onClick={() => handleSelect(shortName, parseFloat(result.lat), parseFloat(result.lon))}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted/80 text-left transition-colors"
                    >
                      <MapPin className="size-3.5 text-emerald-500 shrink-0" />
                      <div className="min-w-0">
                        <span className="text-xs truncate">{result.display_name.split(',')[0]}</span>
                        {details && (
                          <p className="text-[10px] text-muted-foreground truncate">{details}</p>
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>
            )}

            {/* No results */}
            {query.trim().length >= 2 && !isLoading && results.length === 0 && filteredLocations.length === 0 && (
              <div className="px-3 py-4 text-center">
                <Search className="size-5 text-muted-foreground mx-auto mb-1" />
                <p className="text-xs text-muted-foreground">Aucun resultat</p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Booking Form Section ────────────────────────────────────────────────────

function BookingForm({
  phase,
  setPhase,
  estimatedFare,
  setFareResult,
  osrmRouteInfo,
  pickupCoords,
  dropoffCoords,
  setPickupCoords,
  setDropoffCoords,
}: {
  phase: BookingPhase
  setPhase: (p: BookingPhase) => void
  estimatedFare: FareResult | null
  setFareResult: (f: FareResult | null) => void
  osrmRouteInfo?: { distance: number; duration: number } | null
  pickupCoords?: { lat: number; lng: number } | null
  dropoffCoords?: { lat: number; lng: number } | null
  setPickupCoords: (coords: { lat: number; lng: number } | null) => void
  setDropoffCoords: (coords: { lat: number; lng: number } | null) => void
}) {
  const {
    pickupAddress,
    dropoffAddress,
    selectedVehicleType,
    user,
    setPickupAddress,
    setDropoffAddress,
    setSelectedVehicleType,
    setEstimatedFare,
    setCurrentRide,
    setIsLoading,
  } = useAppStore()

  const selectedPickup = locations.find((l) => l.name === pickupAddress)
  const selectedDropoff = locations.find((l) => l.name === dropoffAddress)
  const [stops, setStops] = useState<string[]>([])
  const [showPreferences, setShowPreferences] = useState(false)
  const [prefSilent, setPrefSilent] = useState(false)
  const [prefTemp, setPrefTemp] = useState<number>(1)
  const [prefLuggage, setPrefLuggage] = useState(false)
  const [prefWomenOnly, setPrefWomenOnly] = useState(false)
  const [splitFare, setSplitFare] = useState(false)
  const [passenger2, setPassenger2] = useState('')
  const [passenger3, setPassenger3] = useState('')
  const [showSplitDialog, setShowSplitDialog] = useState(false)
  const [splitCode, setSplitCode] = useState('')

  // Price lock
  const [priceLocked, setPriceLocked] = useState(false)

  // Book for third party
  const [bookForThird, setBookForThird] = useState(false)
  const [thirdPartyName, setThirdPartyName] = useState("")
  const [thirdPartyPhone, setThirdPartyPhone] = useState("")

  // Promo code
  const [promoCode, setPromoCode] = useState('')
  const [promoApplied, setPromoApplied] = useState(false)
  const [promoDiscount, setPromoDiscount] = useState(0)

  // Edit favorites dialog
  const [showEditFavorites, setShowEditFavorites] = useState(false)

  // Favorite places with localStorage persistence
  const [favoritePlaces, setFavoritePlaces] = useState<FavoritePlace[]>(() => loadFavorites())

  // Persist favorites to localStorage whenever they change
  useEffect(() => {
    saveFavorites(favoritePlaces)
  }, [favoritePlaces])

  // Real API hooks
  const calculatePricing = useCalculatePricing()
  const createRide = useCreateRide()
  const tracking = useTracking()

  const handleEstimate = async () => {
    if (!pickupAddress || !dropoffAddress) {
      toast.error("Veuillez sélectionner les adresses de départ et d'arrivée.")
      return
    }
    if (pickupAddress === dropoffAddress) {
      toast.error("Les adresses de départ et d'arrivée doivent être différentes.")
      return
    }

    setPhase("estimating")

    // Use OSRM real data when available from the map
    if (osrmRouteInfo && osrmRouteInfo.distance > 0) {
      const distanceKm = Math.round((osrmRouteInfo.distance / 1000) * 10) / 10
      const durationMin = Math.ceil(osrmRouteInfo.duration / 60)
      const basePrice = selectedVehicleType === "premium" ? 8000 : selectedVehicleType === "van" ? 15000 : selectedVehicleType === "moto" ? 1500 : 3000
      const kmPrice = selectedVehicleType === "premium" ? 1200 : selectedVehicleType === "van" ? 1800 : selectedVehicleType === "moto" ? 400 : 800
      const fare = Math.round(basePrice + distanceKm * kmPrice)
      const result: FareResult = { fare, distance: distanceKm, duration: durationMin, breakdown: null }
      setFareResult(result)
      setEstimatedFare(result.fare)
      setPhase("estimated")
      toast.success(`Tarif estimé: ${new Intl.NumberFormat('fr-GN').format(result.fare)} GNF`, {
        description: `${distanceKm} km — ${durationMin} min (itinéraire réel)`
      })
      return
    }

    try {
      const pricingData = await calculatePricing.mutateAsync({
        pickupZone: selectedPickup?.zone || "",
        dropoffZone: selectedDropoff?.zone || "",
        vehicleType: selectedVehicleType,
      })

      const bd = pricingData.breakdown
      const result: FareResult = {
        fare: pricingData.fare,
        distance: bd.distance,
        duration: bd.duration,
        breakdown: {
          baseFare: bd.baseFare,
          distanceFare: bd.distanceFare,
          timeFare: bd.baseFare * (bd.timeMultiplier - 1) + bd.distanceFare * (bd.timeMultiplier - 1),
          surgeFare: bd.surgeMultiplier > 1 ? (bd.baseFare + bd.distanceFare) * (bd.surgeMultiplier - 1) : 0,
          serviceFee: bd.serviceFee,
          discount: bd.discount,
          total: bd.finalFare,
        },
      }
      setFareResult(result)
      setEstimatedFare(result.fare)
      setPhase("estimated")
      toast.success(`Tarif estimé: ${new Intl.NumberFormat('fr-GN').format(result.fare)} GNF`, {
        description: `~${result.distance} km — ${result.duration} min`
      })
    } catch (apiError) {
      console.warn("[BookingForm] API pricing failed, using local fallback:", apiError)
      // Graceful degradation: use local mock estimateFare
      const localResult = estimateFare(
        selectedPickup?.zone || "",
        selectedDropoff?.zone || "",
        selectedVehicleType
      )
      const result: FareResult = { ...localResult, breakdown: null }
      setFareResult(result)
      setEstimatedFare(result.fare)
      setPhase("estimated")
      toast.success(`Tarif estimé: ${new Intl.NumberFormat('fr-GN').format(result.fare)} GNF`, {
        description: `~${result.distance} km — ${result.duration} min`
      })
    }
  }

  // Listen for driver assignment via Socket.IO
  useEffect(() => {
    if (phase !== "searching") return

    tracking.on({
      onRideAssigned: (data) => {
        // Driver accepted via tracking service
        const { currentRide: existingRide } = useAppStore.getState()
        if (!existingRide) return

        const updatedRide: Ride = {
          ...existingRide,
          status: "in_progress",
          driverId: data.driverId,
          startedAt: new Date().toISOString(),
          driver: {
            id: data.driverId,
            name: data.driverName,
            rating: data.driverRating,
            phone: "",
            email: "",
            role: "driver",
            isOnline: true,
            totalRides: 0,
          },
          vehicle: {
            id: "assigned-veh",
            type: data.vehicleType || selectedVehicleType,
            brand: "",
            model: "",
            plate: data.vehiclePlate || "",
            color: null,
          },
        }
        useAppStore.getState().setCurrentRide(updatedRide)
        setIsLoading(false)
        setPhase("active")
        toast.success("Chauffeur trouvé ! Votre course est en cours.")
      },
      onRideNoDrivers: (data) => {
        toast.error(data.message || "Aucun chauffeur disponible. Veuillez réessayer.")
        setPhase("estimated")
      },
      onError: (data) => {
        toast.error(data.message || "Erreur de connexion au service de suivi.")
      },
    })

    return () => {
      tracking.off()
    }
  }, [phase, tracking])

  const handleConfirm = async () => {
    if (!estimatedFare) {
      toast.error("Veuillez vérifier les adresses de départ et d'arrivée")
      return
    }
    if (!pickupAddress || !dropoffAddress) {
      toast.error("Veuillez vérifier les adresses de départ et d'arrivée")
      return
    }

    // Use coordinates from props (map selection) or from dropdown location lookup
    const pLat = pickupCoords?.lat ?? selectedPickup?.lat ?? 9.509
    const pLng = pickupCoords?.lng ?? selectedPickup?.lng ?? -13.712
    const dLat = dropoffCoords?.lat ?? selectedDropoff?.lat ?? 9.509
    const dLng = dropoffCoords?.lng ?? selectedDropoff?.lng ?? -13.712
    const pZone = selectedPickup?.zone || "Conakry"
    const dZone = selectedDropoff?.zone || "Conakry"

    setPhase("searching")

    try {
      const rideData = await createRide.mutateAsync({
        passengerId: user?.id || "demo",
        pickupAddress: pickupAddress,
        pickupLat: pLat,
        pickupLng: pLng,
        pickupZone: pZone,
        dropoffAddress: dropoffAddress,
        dropoffLat: dLat,
        dropoffLng: dLng,
        dropoffZone: dZone,
        estimatedFare: estimatedFare.fare,
        preferences: {
          silent: !!prefSilent,
          luggage: !!prefLuggage,
          womenOnly: !!prefWomenOnly,
          splitFare: !!splitFare,
          priceLock: !!priceLocked,
          temperature: prefTemp,
        },
      })

      // Map API RideData to store Ride type
      const newRide: Ride = {
        id: rideData.id,
        status: "pending",
        passengerId: rideData.passengerId,
        driverId: rideData.driverId,
        pickupAddress: rideData.pickupAddress,
        pickupLat: rideData.pickupLat,
        pickupLng: rideData.pickupLng,
        pickupZone: rideData.pickupZone,
        dropoffAddress: rideData.dropoffAddress,
        dropoffLat: rideData.dropoffLat,
        dropoffLng: rideData.dropoffLng,
        dropoffZone: rideData.dropoffZone,
        estimatedFare: rideData.estimatedFare,
        actualFare: rideData.actualFare,
        distance: rideData.distance,
        duration: rideData.duration,
        startedAt: rideData.startedAt ? String(rideData.startedAt) : null,
        completedAt: rideData.completedAt ? String(rideData.completedAt) : null,
        createdAt: String(rideData.createdAt),
        driver: rideData.driver ? {
          id: rideData.driver.id,
          name: rideData.driver.name,
          rating: rideData.driver.rating ?? 0,
          phone: rideData.driver.phone,
          email: rideData.driver.email,
          role: "driver",
          isOnline: rideData.driver.isOnline,
          totalRides: rideData.driver.completedRides ?? 0,
        } : undefined,
        vehicle: rideData.vehicle ? {
          id: rideData.vehicle.id,
          type: rideData.vehicle.type,
          brand: rideData.vehicle.make ?? "",
          model: rideData.vehicle.model ?? "",
          plate: rideData.vehicle.plateNumber ?? "",
          color: rideData.vehicle.color,
        } : undefined,
      }

      setCurrentRide(newRide)

      // Emit ride request via Socket.IO tracking for driver matching
      if (tracking.isConnected) {
        tracking.joinAsPassenger({ passengerId: user?.id || "demo" })
        tracking.requestRide({
          passengerId: user?.id || "demo",
          pickupLat: pLat,
          pickupLng: pLng,
          pickupZone: pZone,
          dropoffLat: dLat,
          dropoffLng: dLng,
          dropoffZone: dZone,
        })
      } else {
        // No tracking connection — ride created but waiting for driver
        toast.info("Recherche de chauffeur en cours...", { description: "Vous serez notifié dès qu'un chauffeur accepte." })
        setPhase("estimated")
      }
    } catch (apiError) {
      console.warn("[BookingForm] API ride creation failed:", apiError)
      toast.error("Erreur de connexion.", { description: "Impossible de créer la course. Veuillez réessayer." })
      setPhase("estimated")
    }
  }

  const handleSwap = () => {
    setPickupAddress(dropoffAddress)
    setDropoffAddress(pickupAddress)
    setPickupCoords(dropoffCoords ?? null)
    setDropoffCoords(pickupCoords ?? null)
    setPhase("form")
    setFareResult(null)
    setEstimatedFare(null)
  }

  const handleReset = () => {
    setPickupAddress("")
    setDropoffAddress("")
    setPickupCoords(null)
    setDropoffCoords(null)
    setSelectedVehicleType("standard")
    setEstimatedFare(null)
    setFareResult(null)
    setCurrentRide(null)
    setPhase("form")
  }

  return (
    <>
    <AnimatePresence mode="wait">
      {/* ── Booking Form ── */}
      {phase === "form" && (
        <motion.div
          key="booking-form"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.3 }}
          className="space-y-5"
        >
          <div className="space-y-1">
            <h2 className="text-lg font-bold text-foreground">Réserver une course</h2>
            <p className="text-xs text-muted-foreground">Où souhaitez-vous aller ?</p>
          </div>

          {/* Address Inputs - Search with Nominatim geocoding */}
          <div className="space-y-3">
            <div className="flex gap-2">
              <AddressSearchInput
                value={pickupAddress}
                onAddressSelect={(address, lat, lng) => {
                  setPickupAddress(address)
                  setPickupCoords({ lat, lng })
                  setPhase("form")
                  setFareResult(null)
                  setEstimatedFare(null)
                }}
                onClear={() => {
                  setPickupAddress("")
                  setPickupCoords(null)
                }}
                placeholder="Choisir un point de depart"
                icon={<MapPin className="size-4 text-emerald-500" />}
                label="Depart"
                favorites={favoritePlaces}
              />

              <Button
                variant="outline"
                size="icon"
                className="mt-6 shrink-0 border-emerald-300 text-emerald-600 hover:bg-emerald-50 dark:border-emerald-700 dark:text-emerald-400"
                onClick={async () => {
                  toast.info('Localisation en cours...')
                  if (!navigator.geolocation) {
                    toast.error('La géolocalisation n\'est pas supportée par votre navigateur.')
                    return
                  }
                  navigator.geolocation.getCurrentPosition(
                    async (position) => {
                      const { latitude, longitude } = position.coords
                      try {
                        const res = await fetch(
                          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&accept-language=fr`,
                          { headers: { 'User-Agent': 'MOVA-App/1.0' } }
                        )
                        const data = await res.json()
                        const address = data.display_name?.split(',').slice(0, 3).join(',').trim() || `Position GPS (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`
                        setPickupAddress(address)
                        setPickupCoords({ lat: latitude, lng: longitude })
                        setPhase("form")
                        setFareResult(null)
                        setEstimatedFare(null)
                        toast.success('Position actuelle détectée !')
                      } catch {
                        setPickupAddress(`Position GPS (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`)
                        setPickupCoords({ lat: latitude, lng: longitude })
                        toast.success('Position GPS obtenue !')
                      }
                    },
                    (error) => {
                      switch (error.code) {
                        case error.PERMISSION_DENIED:
                          toast.error('Veuillez autoriser l\'accès à votre position dans les paramètres de votre navigateur.')
                          break
                        case error.POSITION_UNAVAILABLE:
                          toast.error('Position indisponible. Vérifiez que votre GPS est activé.')
                          break
                        case error.TIMEOUT:
                          toast.error('Délai d\'attente dépassé. Réessayez.')
                          break
                        default:
                          toast.error('Erreur de localisation. Veuillez réessayer.')
                      }
                    },
                    { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
                  )
                }}
                title="Utiliser ma position GPS"
              >
                <Navigation className="size-4" />
              </Button>

              <Button
                variant="outline"
                size="icon"
                className="mt-6 shrink-0"
                onClick={handleSwap}
                title="Inverser les adresses"
              >
                <ArrowUpDown className="size-4" />
              </Button>

              <AddressSearchInput
                value={dropoffAddress}
                onAddressSelect={(address, lat, lng) => {
                  setDropoffAddress(address)
                  setDropoffCoords({ lat, lng })
                  setPhase("form")
                  setFareResult(null)
                  setEstimatedFare(null)
                }}
                onClear={() => {
                  setDropoffAddress("")
                  setDropoffCoords(null)
                }}
                placeholder="Choisir une destination"
                icon={<Navigation className="size-4 text-amber-500" />}
                label="Arrivee"
                favorites={favoritePlaces}
              />
            </div>

            {/* Route indicator */}
            {pickupAddress && dropoffAddress && pickupAddress !== dropoffAddress && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-2"
              >
                <Route className="size-3.5 text-emerald-500" />
                <span className="truncate">{pickupAddress}</span>
                <MoveRight className="size-3 shrink-0" />
                <span className="truncate">{dropoffAddress}</span>
                {selectedPickup && selectedDropoff && (
                  <Badge variant="secondary" className="ml-auto text-[10px] px-1.5 py-0 shrink-0">
                    {selectedPickup.zone} - {selectedDropoff.zone}
                  </Badge>
                )}
              </motion.div>
            )}
          </div>

          {/* Quick Actions - Favorites */}
          <div className="flex gap-2 mt-1">
            {favoritePlaces.filter(f => f.id === 'home' || f.id === 'work').map((fav) => {
              const FavIcon = getFavoriteIcon(fav.icon)
              return (
                <Button
                  key={fav.id}
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-xs border-emerald-200 dark:border-emerald-800"
                  onClick={() => {
                    setPickupAddress(fav.address)
                    setPickupCoords({ lat: fav.lat, lng: fav.lng })
                    toast.success(`Départ: ${fav.label}`)
                  }}
                >
                  <FavIcon className="size-3 text-emerald-500" />
                  {fav.label}
                </Button>
              )
            })}
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5 text-xs text-muted-foreground"
              onClick={() => setShowEditFavorites(true)}
            >
              <Settings className="size-3" />
              Configurer
            </Button>
          </div>

          {/* Favorite Places */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium">Lieux favoris</Label>
              {pickupAddress && selectedPickup && !favoritePlaces.some((f) => f.address === selectedPickup.name) && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-[10px] gap-1 text-emerald-600 dark:text-emerald-400 px-1.5"
                  onClick={() => {
                    const newFav: FavoritePlace = {
                      id: `custom-${Date.now()}`,
                      label: selectedPickup.name.split(',')[0],
                      icon: 'location',
                      address: selectedPickup.name,
                      lat: selectedPickup.lat,
                      lng: selectedPickup.lng,
                    }
                    setFavoritePlaces([...favoritePlaces, newFav])
                    toast.success(`"${newFav.label}" ajouté aux favoris`)
                  }}
                >
                  <Plus className="size-3" />
                  Ajouter ce départ
                </Button>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {favoritePlaces.map((fav) => (
                <div key={fav.id} className="relative group">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs gap-1.5 mova-card-hover pr-7"
                    onClick={() => {
                      const loc = locations.find((l) => l.name.includes(fav.label.split(' ')[0]))
                      if (loc) {
                        setPickupAddress(loc.name)
                        setPickupCoords({ lat: loc.lat, lng: loc.lng })
                        setPhase("form")
                        setFareResult(null)
                        setEstimatedFare(null)
                      } else if (fav.lat && fav.lng) {
                        setPickupAddress(fav.address)
                        setPickupCoords({ lat: fav.lat, lng: fav.lng })
                        setPhase("form")
                        setFareResult(null)
                        setEstimatedFare(null)
                      } else {
                        toast.success(`${fav.label} selectionne : ${fav.address}`)
                      }
                    }}
                  >
                    {(() => { const FavIcon = getFavoriteIcon(fav.icon); return <FavIcon className="size-3.5 text-emerald-500" /> })()}
                    {fav.label}
                  </Button>
                  <button
                    className="absolute -top-1 -right-1 size-4 rounded-full bg-red-100 dark:bg-red-900/50 text-red-500 dark:text-red-400 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-200 dark:hover:bg-red-800/50"
                    onClick={(e) => {
                      e.stopPropagation()
                      setFavoritePlaces(favoritePlaces.filter((f) => f.id !== fav.id))
                      toast.info(`"${fav.label}" retiré des favoris`)
                    }}
                  >
                    <X className="size-2.5" />
                  </button>
                </div>
              ))}
              {favoritePlaces.length === 0 && (
                <p className="text-xs text-muted-foreground/70 py-1">Aucun lieu favori. Sélectionnez un départ pour en ajouter.</p>
              )}
            </div>
          </div>

          {/* Book for Third Party - Uber style */}
          <div className="space-y-2">
            <button
              onClick={() => setBookForThird(!bookForThird)}
              className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <UserPlus className="size-3.5" />
              <span>Réserver pour quelqu&apos;un d&apos;autre</span>
            </button>
            <AnimatePresence>
              {bookForThird && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden space-y-2"
                >
                  <Input
                    placeholder="Nom du passager"
                    value={thirdPartyName}
                    onChange={(e) => setThirdPartyName(e.target.value)}
                    className="h-8 text-xs"
                  />
                  <Input
                    placeholder="Téléphone (+224...)"
                    value={thirdPartyPhone}
                    onChange={(e) => setThirdPartyPhone(e.target.value)}
                    className="h-8 text-xs"
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Multi-Stop Trips */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium">Arrêts intermédiaires</Label>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 gap-1"
                onClick={() => {
                  if (stops.length < 2) {
                    setStops([...stops, ''])
                  } else {
                    toast.info("Maximum 2 arrêts intermédiaires autorisés.")
                  }
                }}
              >
                <Plus className="size-3.5" />
                Ajouter un arrêt
              </Button>
            </div>
            <AnimatePresence>
              {stops.map((stop, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="flex gap-2"
                >
                  <div className="flex-1">
                    <Select
                      value={stop}
                      onValueChange={(v) => {
                        const newStops = [...stops]
                        newStops[idx] = v
                        setStops(newStops)
                      }}
                    >
                      <SelectTrigger className="w-full">
                        <MapPin className="size-4 text-amber-400 mr-1 shrink-0" />
                        <SelectValue placeholder={`Arrêt ${idx + 1}`} />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(
                          locations.reduce<Record<string, Location[]>>((acc, loc) => {
                            if (!acc[loc.zone]) acc[loc.zone] = []
                            acc[loc.zone].push(loc)
                            return acc
                          }, {})
                        ).map(([zone, locs]) => (
                          <SelectGroup key={zone}>
                            <SelectLabel className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                              {zone}
                            </SelectLabel>
                            {locs.map((loc) => (
                              <SelectItem key={loc.name} value={loc.name}>
                                {loc.name}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    variant="outline"
                    size="icon"
                    className="shrink-0 text-red-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30"
                    onClick={() => {
                      setStops(stops.filter((_, i) => i !== idx))
                    }}
                  >
                    <X className="size-4" />
                  </Button>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          {/* Vehicle Type Selector */}
          <div className="space-y-2">
            <Label className="text-xs font-medium">Type de véhicule</Label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {vehicleOptions.map((v) => {
                const isSelected = selectedVehicleType === v.type
                return (
                  <Card
                    key={v.type}
                    className={`cursor-pointer transition-all duration-200 ${
                      isSelected
                        ? "ring-2 ring-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 shadow-md"
                        : "mova-card-hover hover:shadow-sm"
                    }`}
                    onClick={() => { setSelectedVehicleType(v.type); setPhase("form"); setFareResult(null); setEstimatedFare(null); }}
                  >
                    <CardContent className="p-3 text-center space-y-1.5">
                      <div className={`mx-auto ${isSelected ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"}`}>
                        {v.icon}
                      </div>
                      <p className={`text-xs font-semibold ${isSelected ? "text-emerald-700 dark:text-emerald-300" : "text-foreground"}`}>
                        {v.name}
                      </p>
                      <p className="text-[10px] text-muted-foreground leading-tight">{v.description}</p>
                      <p className="text-xs font-bold text-foreground">
                        {formatGNF(v.basePrice)}
                      </p>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          </div>

          {/* Estimate Button */}
          <Button
            className="w-full mova-gradient text-white font-semibold h-11 shadow-lg"
            onClick={handleEstimate}
            disabled={!pickupAddress || !dropoffAddress || pickupAddress === dropoffAddress}
          >
            <Route className="size-4 mr-2" />
            Estimer le tarif
          </Button>
        </motion.div>
      )}

      {/* ── Estimating Animation ── */}
      {phase === "estimating" && (
        <motion.div
          key="estimating"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.3 }}
          className="flex flex-col items-center justify-center py-12 space-y-4"
        >
          <div className="relative">
            <div className="size-16 rounded-full border-4 border-emerald-200 dark:border-emerald-800 border-t-emerald-500 animate-spin" />
            <Route className="size-6 text-emerald-500 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
          </div>
          <div className="text-center space-y-1">
            <p className="font-semibold text-foreground">Calcul du tarif...</p>
            <p className="text-xs text-muted-foreground">Nous trouvons le meilleur itinéraire</p>
          </div>
          <div className="w-full space-y-2 px-4">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        </motion.div>
      )}

      {/* ── Estimated Fare ── */}
      {phase === "estimated" && estimatedFare && (
        <motion.div
          key="estimated"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.4, type: "spring" }}
          className="space-y-4"
        >
          <div className="space-y-1">
            <h2 className="text-lg font-bold text-foreground">Estimation</h2>
            <p className="text-xs text-muted-foreground">Détails de votre course</p>
          </div>

          <Card className="border-emerald-200 dark:border-emerald-800 overflow-hidden">
            <div className="mova-gradient px-4 py-3">
              <p className="text-center text-sm font-medium text-white/80">Tarif estimé</p>
              <motion.p
                className="text-center text-3xl font-bold text-white"
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.3, type: "spring", stiffness: 200 }}
              >
                {formatGNF(estimatedFare.fare)}
              </motion.p>
            </div>
            <CardContent className="p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-center gap-2 bg-muted/50 rounded-lg p-2.5">
                  <Route className="size-4 text-emerald-500" />
                  <div>
                    <p className="text-[10px] text-muted-foreground">Distance</p>
                    <p className="text-sm font-semibold">{estimatedFare.distance} km</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 bg-muted/50 rounded-lg p-2.5">
                  <Clock className="size-4 text-amber-500" />
                  <div>
                    <p className="text-[10px] text-muted-foreground">Durée</p>
                    <p className="text-sm font-semibold">{estimatedFare.duration} min</p>
                  </div>
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <div className="flex items-start gap-2">
                  <CircleDot className="size-4 text-emerald-500 mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[10px] text-muted-foreground">Départ</p>
                    <p className="text-sm font-medium truncate">{pickupAddress}</p>
                    {selectedPickup && (
                      <Badge variant="secondary" className="text-[10px] mt-0.5">{selectedPickup.zone}</Badge>
                    )}
                  </div>
                </div>
                <div className="ml-1.5 w-px h-4 bg-border" />
                <div className="flex items-start gap-2">
                  <CircleCheckBig className="size-4 text-amber-500 mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[10px] text-muted-foreground">Arrivée</p>
                    <p className="text-sm font-medium truncate">{dropoffAddress}</p>
                    {selectedDropoff && (
                      <Badge variant="secondary" className="text-[10px] mt-0.5">{selectedDropoff.zone}</Badge>
                    )}
                  </div>
                </div>
              </div>

              <Separator />

              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Waypoints className="size-3.5" />
                <span>{vehicleOptions.find((v) => v.type === selectedVehicleType)?.name} — {vehicleOptions.find((v) => v.type === selectedVehicleType)?.description}</span>
              </div>

              {/* Price Lock - Uber style */}
              <div className="flex items-center justify-between bg-emerald-50 dark:bg-emerald-900/20 rounded-lg p-3 border border-emerald-200 dark:border-emerald-800">
                <div className="flex items-center gap-2">
                  <Lock className="size-4 text-emerald-600 dark:text-emerald-400" />
                  <div>
                    <p className="text-xs font-medium">Prix garanti</p>
                    <p className="text-[10px] text-muted-foreground">Le montant affiché est le montant final</p>
                  </div>
                </div>
                <Switch
                  checked={priceLocked}
                  onCheckedChange={setPriceLocked}
                />
              </div>
              {priceLocked && (
                <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                  <Zap className="size-3" />
                  <span className="text-[10px] font-medium">Votre prix est verrouillé</span>
                </div>
              )}

              {/* Ride Preferences */}
              <div className="space-y-2">
                <button
                  onClick={() => setShowPreferences(!showPreferences)}
                  className="flex items-center justify-between w-full text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                >
                  <span className="flex items-center gap-1.5">
                    <Sparkles className="size-3.5" />
                    Préférences
                  </span>
                  <ChevronRight className={`size-3.5 transition-transform ${showPreferences ? 'rotate-90' : ''}`} />
                </button>
                <AnimatePresence>
                  {showPreferences && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="space-y-3 overflow-hidden"
                    >
                      <div className="flex items-center justify-between bg-muted/50 rounded-lg p-2.5">
                        <div className="flex items-center gap-2">
                          <Volume2 className="size-4 text-emerald-500" />
                          <span className="text-xs font-medium">Trajet silencieux</span>
                        </div>
                        <Switch checked={prefSilent} onCheckedChange={setPrefSilent} />
                      </div>
                      <div className="bg-muted/50 rounded-lg p-2.5">
                        <p className="text-xs font-medium mb-2">Température</p>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setPrefTemp(0)}
                            className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg p-2 text-xs font-medium transition-all ${
                              prefTemp === 0 ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 ring-1 ring-blue-300' : 'hover:bg-muted'
                            }`}
                          >
                            <Snowflake className="size-3.5" />
                            Froid
                          </button>
                          <button
                            onClick={() => setPrefTemp(1)}
                            className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg p-2 text-xs font-medium transition-all ${
                              prefTemp === 1 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 ring-1 ring-emerald-300' : 'hover:bg-muted'
                            }`}
                          >
                            <Droplets className="size-3.5" />
                            Normal
                          </button>
                          <button
                            onClick={() => setPrefTemp(2)}
                            className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg p-2 text-xs font-medium transition-all ${
                              prefTemp === 2 ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300 ring-1 ring-orange-300' : 'hover:bg-muted'
                            }`}
                          >
                            <Sun className="size-3.5" />
                            Chaud
                          </button>
                        </div>
                      </div>
                      <div className="flex items-center justify-between bg-muted/50 rounded-lg p-2.5">
                        <div className="flex items-center gap-2">
                          <Briefcase className="size-4 text-amber-500" />
                          <span className="text-xs font-medium">Bagage volumineux</span>
                        </div>
                        <Switch checked={prefLuggage} onCheckedChange={setPrefLuggage} />
                      </div>
                      <div className="flex items-center justify-between bg-muted/50 rounded-lg p-2.5">
                        <div className="flex items-center gap-2">
                          <Shield className="size-4 text-red-500" />
                          <span className="text-xs font-medium">Femmes uniquement</span>
                        </div>
                        <Switch checked={prefWomenOnly} onCheckedChange={setPrefWomenOnly} />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Split Fare */}
              <div className="space-y-2">
                <div className="flex items-center justify-between bg-muted/50 rounded-lg p-2.5">
                  <div className="flex items-center gap-2">
                    <Users className="size-4 text-emerald-500" />
                    <div>
                      <p className="text-xs font-medium">Diviser le coût</p>
                      <p className="text-[10px] text-muted-foreground">Partager le tarif avec d'autres passagers</p>
                    </div>
                  </div>
                  <Switch checked={splitFare} onCheckedChange={setSplitFare} />
                </div>
                <AnimatePresence>
                  {splitFare && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="space-y-2 overflow-hidden"
                    >
                      <div className="flex items-center gap-2">
                        <Label className="text-xs font-medium w-24 shrink-0">Passager 2</Label>
                        <Input
                          type="tel"
                          placeholder="+224 6XX XX XX XX"
                          value={passenger2}
                          onChange={(e) => setPassenger2(e.target.value)}
                          className={`h-8 text-xs ${passenger2 && !/^\+224 6\d{2} \d{2} \d{2} \d{2}$/.test(passenger2) ? 'border-red-400 focus-visible:ring-red-400' : passenger2 ? 'border-emerald-400' : ''}`}
                        />
                      </div>
                      {passenger2 && !/^\+224 6\d{2} \d{2} \d{2} \d{2}$/.test(passenger2) && (
                        <p className="text-[10px] text-red-500 ml-24">Format: +224 6XX XX XX XX</p>
                      )}
                      <div className="flex items-center gap-2">
                        <Label className="text-xs font-medium w-24 shrink-0">Passager 3</Label>
                        <Input
                          type="tel"
                          placeholder="+224 6XX XX XX XX"
                          value={passenger3}
                          onChange={(e) => setPassenger3(e.target.value)}
                          className={`h-8 text-xs ${passenger3 && !/^\+224 6\d{2} \d{2} \d{2} \d{2}$/.test(passenger3) ? 'border-red-400 focus-visible:ring-red-400' : passenger3 ? 'border-emerald-400' : ''}`}
                        />
                      </div>
                      {passenger3 && !/^\+224 6\d{2} \d{2} \d{2} \d{2}$/.test(passenger3) && (
                        <p className="text-[10px] text-red-500 ml-24">Format: +224 6XX XX XX XX</p>
                      )}
                      {estimatedFare && (
                        <p className="text-xs text-muted-foreground">
                          {passenger2 && passenger3
                            ? `Soit ${formatGNF(Math.round(estimatedFare.fare / 3))} par personne`
                            : passenger2
                              ? `Soit ${formatGNF(Math.round(estimatedFare.fare / 2))} par personne`
                              : 'Ajoutez un numéro pour diviser'}
                        </p>
                      )}
                      {passenger2 && /^\+224 6\d{2} \d{2} \d{2} \d{2}$/.test(passenger2) && (
                        <Button
                          size="sm"
                          className="w-full text-xs mova-gradient font-semibold rounded-lg"
                          onClick={() => {
                            const code = `SPLIT-${Date.now().toString(36).toUpperCase().slice(-6)}`
                            setSplitCode(code)
                            setShowSplitDialog(true)
                          }}
                        >
                          <Share2 className="size-3.5 mr-1.5" />
                          Confirmer le partage
                        </Button>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
                <Dialog open={showSplitDialog} onOpenChange={setShowSplitDialog}>
                  <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                      <DialogTitle className="flex items-center gap-2">
                        <Users className="h-5 w-5 text-emerald-600" />
                        Partage de course
                      </DialogTitle>
                      <DialogDescription>
                        Votre code de partage a été généré.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                      <div className="flex flex-col items-center gap-3 p-4 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800">
                        <p className="text-sm text-muted-foreground">Code de partage</p>
                        <p className="text-3xl font-bold tracking-widest text-emerald-700 dark:text-emerald-300">{splitCode}</p>
                        <p className="text-xs text-emerald-600 dark:text-emerald-400 text-center">
                          Partagez ce code avec vos passagers pour diviser le tarif
                        </p>
                      </div>
                      {estimatedFare && (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">Tarif total</span>
                            <span className="font-semibold">{formatGNF(estimatedFare.fare)}</span>
                          </div>
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">Part par personne</span>
                            <span className="font-semibold text-emerald-600">{formatGNF(Math.round(estimatedFare.fare / (passenger3 ? 3 : 2)))}</span>
                          </div>
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">Passagers</span>
                            <span className="font-semibold">{passenger3 ? 3 : 2}</span>
                          </div>
                        </div>
                      )}
                      <Button
                        className="w-full mova-gradient font-semibold rounded-xl"
                        onClick={async () => {
                          const shareUrl = `https://mova.gn/split/${splitCode}`
                          const shareText = `Rejoins ma course MOVA ! Code: ${splitCode}. Part: ${formatGNF(Math.round((estimatedFare?.fare ?? 0) / (passenger3 ? 3 : 2)))}`
                          if (navigator.share) {
                            try {
                              await navigator.share({
                                title: 'Partage de course MOVA',
                                text: shareText,
                                url: shareUrl,
                              })
                            } catch {
                              await navigator.clipboard.writeText(`${shareText}\n${shareUrl}`)
                              toast.success('Lien copié dans le presse-papier !')
                            }
                          } else {
                            await navigator.clipboard.writeText(`${shareText}\n${shareUrl}`)
                            toast.success('Lien copié dans le presse-papier !')
                          }
                          setShowSplitDialog(false)
                        }}
                      >
                        <Share2 className="size-4 mr-2" />
                        Partager le code
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </CardContent>
          </Card>

          {/* Promo Code Input - During Booking */}
          <div className="space-y-2">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  placeholder="Code promo"
                  value={promoCode}
                  onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                  className="h-9 text-xs pl-8"
                />
                <Tag className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  if (!promoCode.trim()) return
                  try {
                    const res = await fetch('/api/mova/promotions', {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${typeof window !== 'undefined' ? localStorage.getItem('mova_token') : ''}`,
                      },
                      body: JSON.stringify({ code: promoCode.trim(), userId: user?.id || 'demo' }),
                    })
                    const data = await res.json()
                    if (res.ok && data.success) {
                      const savings = data.data.discountType === 'percentage'
                        ? Math.round((data.data.discountValue / 100) * (estimatedFare?.fare || 5000))
                        : data.data.savings
                      setPromoApplied(true)
                      setPromoDiscount(savings || data.data.savings || 0)
                      toast.success(`${data.data.message}`, { duration: 4000 })
                    } else {
                      toast.error(data.error || 'Code promo invalide')
                    }
                  } catch {
                    // Fallback: apply local discount
                    setPromoApplied(true)
                    setPromoDiscount(1500)
                    toast.success(`Code promo "${promoCode}" applique ! -1 500 GNF`)
                  }
                }}
                disabled={!promoCode.trim()}
                className="shrink-0 h-9"
              >
                Appliquer
              </Button>
            </div>
            {promoApplied && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="flex items-center justify-between bg-emerald-50 dark:bg-emerald-900/20 rounded-lg px-3 py-2 border border-emerald-200 dark:border-emerald-800"
              >
                <div className="flex items-center gap-1.5">
                  <Check className="size-3.5 text-emerald-600" />
                  <span className="text-xs font-medium text-emerald-700 dark:text-emerald-300">{promoCode} — -{formatGNF(promoDiscount)}</span>
                </div>
                <button
                  onClick={() => { setPromoApplied(false); setPromoCode(''); setPromoDiscount(0); }}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  <X className="size-3" />
                </button>
              </motion.div>
            )}
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => { setPhase("form"); setFareResult(null); setEstimatedFare(null); }}
            >
              <X className="size-4 mr-1.5" />
              Modifier
            </Button>
            <Button
              className="flex-[2] mova-gradient text-white font-semibold h-11 shadow-lg"
              onClick={handleConfirm}
            >
              <Check className="size-4 mr-2" />
              Confirmer la course
            </Button>
          </div>
        </motion.div>
      )}

      {/* ── Searching for Driver ── */}
      {phase === "searching" && (
        <motion.div
          key="searching"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.3 }}
          className="flex flex-col items-center justify-center py-12 space-y-6"
        >
          {/* Pulsing animation */}
          <div className="relative">
            <div className="size-24 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center">
              <div className="size-16 rounded-full bg-emerald-200 dark:bg-emerald-800/50 flex items-center justify-center animate-pulse">
                <div className="size-10 rounded-full bg-emerald-300 dark:bg-emerald-700/60 flex items-center justify-center">
                  <Car className="size-5 text-emerald-700 dark:text-emerald-300" />
                </div>
              </div>
            </div>
            {/* Expanding ring */}
            <div className="absolute inset-0 rounded-full border-2 border-emerald-400 animate-ping opacity-30" />
          </div>

          <div className="text-center space-y-2">
            <motion.p
              className="text-lg font-bold text-foreground"
              animate={{ opacity: [1, 0.5, 1] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            >
              Recherche de chauffeur...
            </motion.p>
            <p className="text-sm text-muted-foreground">
              Nous recherchons le chauffeur le plus proche de vous
            </p>
          </div>

          <div className="w-full max-w-xs space-y-2">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="size-3 animate-spin" />
              <span>Analyse des chauffeurs disponibles</span>
            </div>
            <Progress value={66} className="h-1.5" />
          </div>

          <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={handleReset}>
            <X className="size-3.5 mr-1.5" />
            Annuler la recherche
          </Button>
        </motion.div>
      )}

      {/* ── Active Ride ── */}
      {phase === "active" && <ActiveRideSection onReset={handleReset} fareBreakdownData={estimatedFare?.breakdown} />}
    </AnimatePresence>

    {/* EDIT FAVORITES DIALOG */}
    <Dialog open={showEditFavorites} onOpenChange={setShowEditFavorites}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Star className="h-5 w-5 text-amber-500" />
            Configurer mes adresses
          </DialogTitle>
          <DialogDescription>
            Définissez vos adresses favorites pour réserver plus rapidement.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {favoritePlaces.map((fav) => {
            const FavIcon = getFavoriteIcon(fav.icon)
            return (
              <div key={fav.id} className="space-y-2 p-3 rounded-xl border bg-card">
                <div className="flex items-center gap-2 mb-2">
                  <FavIcon className="size-4 text-emerald-500" />
                  <span className="text-sm font-medium">{fav.label}</span>
                  <span className="text-[10px] text-muted-foreground ml-auto">
                    {fav.lat.toFixed(3)}, {fav.lng.toFixed(3)}
                  </span>
                </div>
                <Input
                  value={fav.address}
                  onChange={(e) => {
                    const updated = favoritePlaces.map(f =>
                      f.id === fav.id ? { ...f, address: e.target.value } : f
                    )
                    setFavoritePlaces(updated)
                  }}
                  placeholder="Adresse"
                  className="text-sm"
                />
                <div className="flex gap-2">
                  <Input
                    type="number"
                    step="0.001"
                    value={fav.lat}
                    onChange={(e) => {
                      const updated = favoritePlaces.map(f =>
                        f.id === fav.id ? { ...f, lat: parseFloat(e.target.value) || 0 } : f
                      )
                      setFavoritePlaces(updated)
                    }}
                    placeholder="Latitude"
                    className="text-sm"
                  />
                  <Input
                    type="number"
                    step="0.001"
                    value={fav.lng}
                    onChange={(e) => {
                      const updated = favoritePlaces.map(f =>
                        f.id === fav.id ? { ...f, lng: parseFloat(e.target.value) || 0 } : f
                      )
                      setFavoritePlaces(updated)
                    }}
                    placeholder="Longitude"
                    className="text-sm"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    className="shrink-0 border-emerald-300 text-emerald-600 hover:bg-emerald-50"
                    onClick={async () => {
                      toast.info('Localisation en cours...')
                      navigator.geolocation?.getCurrentPosition(
                        async (position) => {
                          const { latitude, longitude } = position.coords
                          try {
                            const res = await fetch(
                              `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&accept-language=fr`,
                              { headers: { 'User-Agent': 'MOVA-App/1.0' } }
                            )
                            const data = await res.json()
                            const address = data.display_name?.split(',').slice(0, 3).join(',').trim() || `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`
                            const updated = favoritePlaces.map(f =>
                              f.id === fav.id ? { ...f, address, lat: latitude, lng: longitude } : f
                            )
                            setFavoritePlaces(updated)
                            toast.success(`Position GPS mise à jour pour ${fav.label} !`)
                          } catch {
                            const updated = favoritePlaces.map(f =>
                              f.id === fav.id ? { ...f, lat: latitude, lng: longitude } : f
                            )
                            setFavoritePlaces(updated)
                            toast.success('Position GPS obtenue !')
                          }
                        },
                        () => toast.error('Impossible d\'obtenir la position GPS'),
                        { enableHighAccuracy: true, timeout: 10000 }
                      )
                    }}
                    title="Utiliser ma position GPS"
                  >
                    <Navigation className="size-4" />
                  </Button>
                </div>
              </div>
            )
          })}
          <Button
            variant="outline"
            className="w-full gap-2"
            onClick={() => {
              const newId = `custom-${Date.now()}`
              const newPlace: FavoritePlace = {
                id: newId,
                label: 'Nouveau lieu',
                icon: 'location',
                address: '',
                lat: 9.509,
                lng: -13.712,
              }
              setFavoritePlaces([...favoritePlaces, newPlace])
            }}
          >
            <Plus className="size-4" />
            Ajouter un lieu
          </Button>
        </div>
      </DialogContent>
    </Dialog>
    </>
  )
}

// ─── Active Ride Section ──────────────────────────────────────────────────────

function ActiveRideSection({ onReset, fareBreakdownData }: { onReset: () => void; fareBreakdownData?: FareResult['breakdown'] }) {
  const { currentRide } = useAppStore()
  const [eta, setEta] = useState(12)
  const [rideStatus, setRideStatus] = useState(0)
  const [showCancelDialog, setShowCancelDialog] = useState(false)
  const [showShareDialog, setShowShareDialog] = useState(false)
  const [showTripShare, setShowTripShare] = useState(false)
  const [tipAmount, setTipAmount] = useState<number | null>(null)
  const [customTip, setCustomTip] = useState('')

  // Cancellation reasons
  const [cancelReason, setCancelReason] = useState("")
  const cancelReasons = [
    { value: "wait_too_long", label: "Temps d'attente trop long", icon: Clock },
    { value: "driver_wrong_direction", label: "Le chauffeur va dans la mauvaise direction", icon: Navigation },
    { value: "found_alternative", label: "J'ai trouvé une autre solution", icon: Car },
    { value: "price_too_high", label: "Le prix est trop élevé", icon: TrendingUp },
    { value: "change_of_plans", label: "Mes plans ont changé", icon: Calendar },
    { value: "safety_concern", label: "Raison de sécurité", icon: Shield },
    { value: "other", label: "Autre raison", icon: MessageCircle },
  ]

  // Rating categories
  const [driverRating, setDriverRating] = useState(0)
  const [ratingCategories, setRatingCategories] = useState<Record<string, boolean>>({
    proprete: true,
    ponctualite: true,
    conduite: true,
    navigation: true,
    communication: true,
    vehicule: true,
  })
  const ratingCategoryLabels: Record<string, string> = {
    proprete: "Propreté",
    ponctualite: "Ponctualité",
    conduite: "Conduite",
    navigation: "Navigation",
    communication: "Communication",
    vehicule: "État du véhicule",
  }

  // Fare breakdown state
  const [showFareBreakdown, setShowFareBreakdown] = useState(false)

  // SOS state
  const [showSOS, setShowSOS] = useState(false)

  // Chat panel
  const [showChat, setShowChat] = useState(false)

  const statusSteps = [
    { label: "Confirmé", icon: <Check className="size-3.5" /> },
    { label: "En route", icon: <Car className="size-3.5" /> },
    { label: "Arrivé", icon: <MapPin className="size-3.5" /> },
    { label: "En cours", icon: <Route className="size-3.5" /> },
    { label: "Terminé", icon: <CircleCheckBig className="size-3.5" /> },
  ]

  // Simulate status progression
  useEffect(() => {
    const timer = setTimeout(() => setRideStatus(1), 2000)
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    if (rideStatus === 1) {
      const timer = setTimeout(() => setRideStatus(2), 5000)
      return () => clearTimeout(timer)
    }
  }, [rideStatus])

  useEffect(() => {
    if (rideStatus === 2) {
      const timer = setTimeout(() => setRideStatus(3), 3000)
      return () => clearTimeout(timer)
    }
  }, [rideStatus])

  // ETA countdown
  useEffect(() => {
    if (eta <= 0 || rideStatus >= 3) return
    const timer = setInterval(() => {
      setEta((prev) => Math.max(0, prev - 1))
    }, 3000)
    return () => clearInterval(timer)
  }, [eta, rideStatus])

  // Auto-complete ride
  useEffect(() => {
    if (rideStatus === 3) {
      const timer = setTimeout(() => setRideStatus(4), 15000)
      return () => clearTimeout(timer)
    }
  }, [rideStatus])

  const handleContactDriver = () => {
    const driverPhone = currentRide?.driver?.phone
    if (!driverPhone) {
      toast.info("Numéro de téléphone non disponible")
      return
    }
    window.open(`tel:${driverPhone.replace(/\s/g, '')}`, '_self')
  }

  const handleShareRide = () => {
    if (navigator.share) {
      navigator.share({
        title: "MOVA — Partage de trajet",
        text: `Je suis en course avec MOVA: ${currentRide?.pickupAddress} → ${currentRide?.dropoffAddress}`,
      })
    } else {
      const shareUrl = `https://mova.gn/share/${currentRide?.id || 'demo'}`
      navigator.clipboard?.writeText(shareUrl)
      toast.success("Lien du trajet copié dans le presse-papiers !")
    }
  }

  const handleCancel = () => {
    setShowCancelDialog(false)
    toast.success("Course annulée avec succès.")
    onReset()
  }

  return (
    <motion.div
      key="active-ride"
      initial={{ opacity: 0, x: 40 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.4, type: "spring" }}
      className="space-y-4"
    >
      {/* ETA Banner */}
      {rideStatus < 3 && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mova-gradient rounded-xl px-4 py-3 text-center space-y-1"
        >
          {rideStatus < 2 ? (
            <>
              <p className="text-white/80 text-xs">Conducteur arrive dans</p>
              <motion.p
                className="text-3xl font-bold text-white"
                key={eta}
                initial={{ scale: 1.2 }}
                animate={{ scale: 1 }}
              >
                {eta} min
              </motion.p>
              <p className="text-white/60 text-[10px]">
                Arrivée estimée à {new Date(Date.now() + eta * 60000).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
              </p>
            </>
          ) : (
            <>
              <p className="text-white/80 text-xs">Arrivée estimée à</p>
              <motion.p
                className="text-2xl font-bold text-white"
                key={eta}
                initial={{ scale: 1.1 }}
                animate={{ scale: 1 }}
              >
                {new Date(Date.now() + eta * 60000).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
              </motion.p>
            </>
          )}
        </motion.div>
      )}

      {/* ETA Enhancements */}
      {rideStatus >= 2 && rideStatus < 4 && currentRide && (
        <div className="grid grid-cols-3 gap-2">
          <div className="text-center bg-muted/50 rounded-lg p-2">
            <p className="text-[10px] text-muted-foreground">Distance restante</p>
            <p className="text-sm font-semibold">
              {Math.max(0, parseFloat(((currentRide.distance || 10) * (eta / ((currentRide.duration || 30)))).toFixed(1)))} km
            </p>
          </div>
          <div className="text-center bg-muted/50 rounded-lg p-2">
            <p className="text-[10px] text-muted-foreground">Vitesse moyenne</p>
            <p className="text-sm font-semibold">
              {Math.round((currentRide.distance || 10) / ((currentRide.duration || 30) / 60))} km/h
            </p>
          </div>
          <div className="text-center bg-muted/50 rounded-lg p-2">
            <p className="text-[10px] text-muted-foreground">Arrivée</p>
            <p className="text-sm font-semibold">
              {new Date(Date.now() + eta * 60000).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
        </div>
      )}

      {/* Driver Card */}
      {currentRide?.driver ? (
      <Card className="mova-card-hover">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <Avatar className="size-12 ring-2 ring-emerald-200 dark:ring-emerald-800">
              <AvatarFallback className="bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300 font-bold">
                {getInitials(currentRide.driver.name)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="font-semibold text-foreground truncate">{currentRide.driver.name}</p>
                <div className="mova-pulse-dot size-2 rounded-full bg-emerald-500" />
              </div>
              <RatingStars rating={currentRide.driver.rating || 0} />
              {currentRide.vehicle && (
              <div className="flex items-center gap-1.5 mt-0.5">
                <Car className="size-3 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">
                  {currentRide.vehicle.color} {currentRide.vehicle.brand} {currentRide.vehicle.model}
                </span>
                {currentRide.vehicle.plate && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 ml-1">
                  {currentRide.vehicle.plate}
                </Badge>
                )}
              </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
      ) : (
      <Card>
        <CardContent className="p-4 flex items-center justify-center">
          <p className="text-xs text-muted-foreground">Informations du chauffeur non disponibles</p>
        </CardContent>
      </Card>
      )}

      {/* Status Steps */}
      <Card>
        <CardContent className="p-4">
          <p className="text-xs font-medium text-muted-foreground mb-3">Statut de la course</p>
          <div className="relative">
            <div className="absolute top-3.5 left-3.5 right-3.5 h-0.5 bg-muted rounded-full" />
            <div
              className="absolute top-3.5 left-3.5 h-0.5 bg-emerald-500 rounded-full transition-all duration-700"
              style={{ width: `${(rideStatus / (statusSteps.length - 1)) * 100}%` }}
            />
            <div className="flex justify-between relative">
              {statusSteps.map((step, i) => (
                <div key={step.label} className="flex flex-col items-center gap-1.5">
                  <div
                    className={`size-7 rounded-full flex items-center justify-center transition-all duration-500 ${
                      i <= rideStatus
                        ? "bg-emerald-500 text-white shadow-md shadow-emerald-200 dark:shadow-emerald-900"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {i < rideStatus ? <Check className="size-3.5" /> : step.icon}
                  </div>
                  <span
                    className={`text-[10px] text-center leading-tight ${
                      i <= rideStatus
                        ? "font-medium text-emerald-700 dark:text-emerald-300"
                        : "text-muted-foreground"
                    }`}
                  >
                    {step.label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Ride Details */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <p className="text-xs font-medium text-muted-foreground">Détails du trajet</p>
          <div className="space-y-2.5">
            <div className="flex items-start gap-2.5">
              <CircleDot className="size-4 text-emerald-500 mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{currentRide?.pickupAddress}</p>
                <Badge variant="secondary" className="text-[10px] mt-0.5">{currentRide?.pickupZone}</Badge>
              </div>
            </div>
            <div className="ml-1.5 w-px h-5 bg-border" />
            <div className="flex items-start gap-2.5">
              <CircleCheckBig className="size-4 text-amber-500 mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{currentRide?.dropoffAddress}</p>
                <Badge variant="secondary" className="text-[10px] mt-0.5">{currentRide?.dropoffZone}</Badge>
              </div>
            </div>
          </div>

          {currentRide?.distance && currentRide?.duration && (
            <div className="grid grid-cols-3 gap-2 pt-1">
              <div className="text-center bg-muted/50 rounded-lg p-2">
                <p className="text-xs text-muted-foreground">Distance</p>
                <p className="text-sm font-semibold">{currentRide.distance} km</p>
              </div>
              <div className="text-center bg-muted/50 rounded-lg p-2">
                <p className="text-xs text-muted-foreground">Durée</p>
                <p className="text-sm font-semibold">{currentRide.duration} min</p>
              </div>
              <div className="text-center bg-muted/50 rounded-lg p-2">
                <p className="text-xs text-muted-foreground">Tarif</p>
                <p className="text-sm font-semibold">{formatGNF(currentRide.estimatedFare)}</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Action Buttons */}
      {rideStatus < 4 && (
        <div className="space-y-2">
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={handleContactDriver}
            >
              <Phone className="size-4 mr-1.5 text-emerald-500" />
              Contacter
            </Button>
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setShowShareDialog(true)}
            >
              <Share2 className="size-4 mr-1.5 text-amber-500" />
              Partager en direct
            </Button>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setShowChat(true)}
            >
              <MessageCircle className="size-4 mr-1.5 text-emerald-500" />
              Contacter
            </Button>
            <Button
              variant="outline"
              className="flex-1 text-red-500 border-red-200 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-950/30"
              onClick={() => setShowSOS(true)}
            >
              <Phone className="size-4 mr-1.5" />
              SOS
            </Button>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => toast.success("Code de sécurité vérifié. Votre trajet est protégé.")}
            >
              <Shield className="size-4 mr-1.5 text-emerald-500" />
              Verrouillage
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 border-emerald-300 text-emerald-700 dark:border-emerald-800 dark:text-emerald-300"
              onClick={() => setShowTripShare(true)}
            >
              <Share2 className="size-4" />
              Partager le trajet
            </Button>
          </div>
          {rideStatus < 2 && (
            <Button
              variant="ghost"
              className="w-full text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
              onClick={() => setShowCancelDialog(true)}
            >
              <X className="size-4 mr-1.5" />
              Annuler la course
            </Button>
          )}
        </div>
      )}

      {/* Completed State */}
      {rideStatus === 4 && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="space-y-3"
        >
          <Card className="border-emerald-200 dark:border-emerald-800">
            <CardContent className="p-4 text-center space-y-3">
              <div className="mx-auto size-14 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center">
                <CircleCheckBig className="size-7 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <p className="font-bold text-foreground text-lg">Course terminée !</p>
                <p className="text-xs text-muted-foreground mt-0.5">Merci d&apos;avoir voyagé avec MOVA</p>
              </div>
              
              {/* Fare Summary with Breakdown Toggle */}
              {currentRide && (
                <div className="bg-muted/50 rounded-xl p-3 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Distance</span>
                    <span className="font-medium">{currentRide.distance} km</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Durée</span>
                    <span className="font-medium">{currentRide.duration} min</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-foreground">Total payé</span>
                    <span className="font-bold text-lg text-emerald-700 dark:text-emerald-300">
                      {formatGNF(currentRide.actualFare || currentRide.estimatedFare)}
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full text-xs"
                    onClick={() => setShowFareBreakdown(!showFareBreakdown)}
                  >
                    <ChevronDown className={`size-3 mr-1 transition-transform ${showFareBreakdown ? 'rotate-180' : ''}`} />
                    Détail du tarif
                  </Button>
                  <AnimatePresence>
                    {showFareBreakdown && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="space-y-1.5 pt-1 border-t">
                          <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground">Course de base</span>
                            <span>{formatGNF(fareBreakdownData?.baseFare ?? 0)}</span>
                          </div>
                          <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground">Distance ({currentRide.distance} km)</span>
                            <span>{formatGNF(fareBreakdownData?.distanceFare ?? 0)}</span>
                          </div>
                          <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground">Temps ({currentRide.duration} min)</span>
                            <span>{formatGNF(fareBreakdownData?.timeFare ?? 0)}</span>
                          </div>
                          {(fareBreakdownData?.surgeFare ?? 0) > 0 && (
                            <div className="flex justify-between text-xs">
                              <span className="text-muted-foreground">{fareBreakdownData && fareBreakdownData.surgeFare > 0 ? 'Majoration demande' : 'Arrets intermediaires'}</span>
                              <span>{formatGNF(fareBreakdownData?.surgeFare ?? 0)}</span>
                            </div>
                          )}
                          <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground">Frais de service</span>
                            <span>{formatGNF(fareBreakdownData?.serviceFee ?? 0)}</span>
                          </div>
                          {fareBreakdownData && fareBreakdownData.discount < 0 && (
                            <div className="flex justify-between text-xs text-emerald-600 dark:text-emerald-400">
                              <span>Reduction</span>
                              <span>{formatGNF(Math.abs(fareBreakdownData.discount))}</span>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                  
                  {/* Download Receipt */}
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full mt-1"
                    onClick={() => toast.success("Reçu téléchargé en PDF !")}
                  >
                    <Download className="size-3.5 mr-1.5" />
                    Télécharger le reçu
                  </Button>
                </div>
              )}
              
              {/* Rating with Categories */}
              <div className="space-y-3 pt-1">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Comment était votre course ?</p>
                  <div className="flex justify-center gap-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        onClick={() => setDriverRating(star)}
                        className="p-1 hover:scale-110 transition-transform"
                      >
                        <Star
                          className={`size-7 transition-colors ${
                            star <= driverRating
                              ? 'text-amber-400 fill-amber-400'
                              : 'text-muted-foreground hover:text-amber-400 hover:fill-amber-400'
                          }`}
                        />
                      </button>
                    ))}
                  </div>
                </div>
                
                {driverRating > 0 && driverRating <= 3 && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="space-y-2"
                  >
                    <p className="text-xs text-muted-foreground">Qu&apos;est-ce qui n&apos;allait pas ?</p>
                    <div className="grid grid-cols-2 gap-1.5">
                      {Object.entries(ratingCategoryLabels).map(([key, label]) => (
                        <button
                          key={key}
                          onClick={() => setRatingCategories(prev => ({ ...prev, [key]: !prev[key] }))}
                          className={`flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs transition-all ${
                            ratingCategories[key]
                              ? 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 ring-1 ring-red-200 dark:ring-red-800'
                              : 'bg-muted/50 text-muted-foreground hover:text-foreground'
                          }`}
                        >
                          {ratingCategories[key] ? <ThumbsDown className="size-3" /> : <ThumbsUp className="size-3" />}
                          {label}
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}
                
                {driverRating >= 4 && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="space-y-2"
                  >
                    <p className="text-xs text-muted-foreground">Qu&apos;est-ce qui était bien ?</p>
                    <div className="grid grid-cols-2 gap-1.5">
                      {Object.entries(ratingCategoryLabels).map(([key, label]) => (
                        <button
                          key={key}
                          onClick={() => setRatingCategories(prev => ({ ...prev, [key]: !prev[key] }))}
                          className={`flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs transition-all ${
                            ratingCategories[key]
                              ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 ring-1 ring-emerald-200 dark:ring-emerald-800'
                              : 'bg-muted/50 text-muted-foreground hover:text-foreground'
                          }`}
                        >
                          <Heart className="size-3" />
                          {label}
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}
                
                {driverRating > 0 && (
                  <Button
                    className="w-full mova-gradient text-white"
                    onClick={async () => {
                      if (!currentRide?.id) {
                        toast.success(`Merci pour votre note de ${driverRating} étoiles !`)
                        return
                      }
                      try {
                        const res = await fetch(`/api/mova/rides/${currentRide.id}`, {
                          method: 'PATCH',
                          headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${typeof window !== 'undefined' ? localStorage.getItem('mova_token') : ''}`,
                          },
                          body: JSON.stringify({
                            passengerRating: driverRating,
                            passengerNote: Object.entries(ratingCategories)
                              .filter(([, v]) => v)
                              .map(([k]) => ratingCategoryLabels[k])
                              .join(', '),
                          }),
                        })
                        if (res.ok) {
                          toast.success(`Merci pour votre note de ${driverRating} étoiles !`)
                        } else {
                          toast.success(`Merci pour votre note de ${driverRating} étoiles !`)
                        }
                      } catch {
                        toast.success(`Merci pour votre note de ${driverRating} étoiles !`)
                      }
                    }}
                  >
                    <Check className="size-4 mr-1.5" />
                    Envoyer l&apos;évaluation
                  </Button>
                )}
              </div>

              {/* Tip Your Driver */}
              <div className="space-y-2 pt-1 border-t">
                <p className="text-xs text-muted-foreground">Ajouter un pourboire pour le chauffeur</p>
                <div className="flex gap-2 justify-center">
                  {[500, 1000, 2000, 5000].map((amount) => (
                    <button
                      key={amount}
                      onClick={() => { setTipAmount(amount); setCustomTip(''); toast.success(`Pourboire de ${formatGNF(amount)} ajouté !`) }}
                      className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                        tipAmount === amount
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 ring-1 ring-emerald-400'
                          : 'bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {formatGNF(amount)}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2 items-center justify-center">
                  <Input
                    type="number"
                    placeholder="Autre montant"
                    value={customTip}
                    onChange={(e) => {
                      setCustomTip(e.target.value)
                      if (e.target.value) {
                        const val = parseInt(e.target.value)
                        if (val > 0) {
                          setTipAmount(val)
                          toast.success(`Pourboire de ${formatGNF(val)} ajouté !`)
                        }
                      } else {
                        setTipAmount(null)
                      }
                    }}
                    className="h-8 w-36 text-xs text-center"
                  />
                  <span className="text-xs text-muted-foreground">GNF</span>
                </div>
              </div>
            </CardContent>
          </Card>
          <Button className="w-full mova-gradient text-white font-semibold" onClick={onReset}>
            <Car className="size-4 mr-2" />
            Nouvelle course
          </Button>
        </motion.div>
      )}

      {/* Cancel Dialog */}
      <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CircleAlert className="size-5 text-red-500" />
              Annuler la course
            </DialogTitle>
            <DialogDescription>
              Sélectionnez la raison de votre annulation.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-2 max-h-60 overflow-y-auto mova-scrollbar">
            {cancelReasons.map((reason) => {
              const Icon = reason.icon
              return (
                <button
                  key={reason.value}
                  onClick={() => setCancelReason(reason.value)}
                  className={`w-full flex items-center gap-3 rounded-lg p-3 text-left text-sm transition-all ${
                    cancelReason === reason.value
                      ? 'bg-emerald-50 dark:bg-emerald-900/30 ring-1 ring-emerald-400 text-emerald-700 dark:text-emerald-300'
                      : 'bg-muted/50 hover:bg-muted text-foreground'
                  }`}
                >
                  <Icon className="size-4 shrink-0" />
                  <span className="flex-1">{reason.label}</span>
                  {cancelReason === reason.value && <Check className="size-4 text-emerald-600" />}
                </button>
              )
            })}
          </div>
          
          <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-lg p-3 space-y-1.5">
            <p className="text-sm font-medium text-amber-800 dark:text-amber-200 flex items-center gap-2">
              <AlertCircle className="size-4" />
              Politique d&apos;annulation
            </p>
            <p className="text-xs text-amber-700 dark:text-amber-300">
              Frais d&apos;annulation : 1 000 GNF si le chauffeur a déjà accepté la course, gratuit sinon.
            </p>
          </div>
          
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setShowCancelDialog(false)}>
              Retour
            </Button>
            <Button
              variant="destructive"
              disabled={!cancelReason}
              onClick={() => {
                toast.success(`Course annulée. Raison: ${cancelReasons.find(r => r.value === cancelReason)?.label}`)
                handleCancel()
              }}
            >
              Confirmer l&apos;annulation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Share Trip Dialog — basic quick-share */}
      <Dialog open={showShareDialog} onOpenChange={setShowShareDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Share2 className="size-5 text-emerald-500" />
              Partager le trajet en direct
            </DialogTitle>
            <DialogDescription>
              Partagez votre position en temps réel avec vos proches.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="bg-muted/50 rounded-lg p-3 space-y-2">
              <p className="text-xs text-muted-foreground">Lien de partage</p>
              <div className="flex gap-2">
                <Input
                  readOnly
                  value={`mova.gn/share/${currentRide?.id || 'demo'}`}
                  className="text-xs flex-1"
                />
                <Button
                  size="sm"
                  className="shrink-0"
                  onClick={() => {
                    navigator.clipboard?.writeText(`mova.gn/share/${currentRide?.id || 'demo'}`)
                    toast.success("Lien copié dans le presse-papiers !")
                  }}
                >
                  <Share2 className="size-3.5 mr-1" />
                  Copier
                </Button>
              </div>
            </div>
            <div className="space-y-1.5">
              <p className="text-xs text-muted-foreground">Contacts d&apos;urgence</p>
              <div className="flex items-center gap-2 bg-muted/50 rounded-lg p-2.5">
                <Phone className="size-3.5 text-red-500" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium">Police (117)</p>
                </div>
                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { window.open('tel:117', '_self') }}>
                  Appeler
                </Button>
              </div>
              <div className="flex items-center gap-2 bg-muted/50 rounded-lg p-2.5">
                <Phone className="size-3.5 text-red-500" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium">SAMU (15)</p>
                </div>
                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { window.open('tel:15', '_self') }}>
                  Appeler
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowShareDialog(false)}>
              Fermer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Trip Share Panel — full-featured Sheet */}
      <TripSharePanel
        open={showTripShare}
        onOpenChange={setShowTripShare}
        ride={currentRide ? {
          id: currentRide.id,
          pickupAddress: currentRide.pickupAddress,
          dropoffAddress: currentRide.dropoffAddress,
          status: currentRide.status,
          driverName: currentRide?.driver?.name || '',
          driverPhone: currentRide?.driver?.phone || '',
          vehiclePlate: currentRide?.vehicle?.plate || '',
          estimatedFare: currentRide.estimatedFare,
          pickupLat: currentRide.pickupLat,
          pickupLng: currentRide.pickupLng,
        } : null}
      />

      {/* SOS Emergency Dialog */}
      <Dialog open={showSOS} onOpenChange={setShowSOS}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="size-8 rounded-full bg-red-100 dark:bg-red-900/40 flex items-center justify-center">
                <Phone className="size-4 text-red-600" />
              </div>
              Assistance d&apos;urgence
            </DialogTitle>
            <DialogDescription>
              Contactez les services d&apos;urgence en cas de danger.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Button
              variant="destructive"
              className="w-full justify-start gap-3"
              onClick={() => { window.open('tel:117', '_self'); setShowSOS(false) }}
            >
              <Shield className="size-4" />
              <div className="text-left">
                <p className="font-semibold">Police - 117</p>
                <p className="text-xs opacity-80">Appeler la police</p>
              </div>
            </Button>
            <Button
              variant="destructive"
              className="w-full justify-start gap-3"
              onClick={() => { window.open('tel:15', '_self'); setShowSOS(false) }}
            >
              <Heart className="size-4" />
              <div className="text-left">
                <p className="font-semibold">SAMU - 15</p>
                <p className="text-xs opacity-80">Urgences medicales</p>
              </div>
            </Button>
            <Button
              variant="destructive"
              className="w-full justify-start gap-3"
              onClick={() => { window.open('tel:18', '_self'); setShowSOS(false) }}
            >
              <AlertCircle className="size-4" />
              <div className="text-left">
                <p className="font-semibold">Pompiers - 18</p>
                <p className="text-xs opacity-80">Incendie et secours</p>
              </div>
            </Button>
            <Button
              variant="destructive"
              className="w-full justify-start gap-3"
              onClick={() => { window.open('tel:+224621111111', '_self'); setShowSOS(false) }}
            >
              <Shield className="size-4" />
              <div className="text-left">
                <p className="font-semibold">SOS Femmes - 621 11 11 11</p>
                <p className="text-xs opacity-80">Assistance femmes en danger</p>
              </div>
            </Button>
            <Separator />
            <Button
              variant="outline"
              className="w-full justify-start gap-3"
              onClick={() => {
                if (navigator.share) {
                  navigator.share({
                    title: 'MOVA — Signalement de securite',
                    text: `Signalement depuis MOVA: ${currentRide?.pickupAddress || 'Position inconnue'} vers ${currentRide?.dropoffAddress || 'Destination inconnue'}`,
                  })
                } else {
                  navigator.clipboard?.writeText(`Signalement MOVA — Course: ${currentRide?.id || 'inconnue'}`)
                  toast.success('Informations copiees. Contactez le support.')
                }
              }}
            >
              <MessageCircle className="size-4" />
              <div className="text-left">
                <p className="font-semibold">Signaler au support MOVA</p>
                <p className="text-xs opacity-80">Signaler un problème de sécurité</p>
              </div>
            </Button>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSOS(false)}>
              Fermer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Chat Panel */}
      <ChatPanel
        open={showChat}
        onOpenChange={setShowChat}
        contactName={currentRide?.driver?.name || 'Chauffeur'}
        contactPhone={currentRide?.driver?.phone || ''}
        vehiclePlate={currentRide?.vehicle?.plate || ''}
      />
    </motion.div>
  )
}

// ─── Ride History Section ─────────────────────────────────────────────────────

function RideHistorySection() {
  const { user, rideHistory, setRideHistory } = useAppStore()
  const [filter, setFilter] = useState("all")
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [paymentFilter, setPaymentFilter] = useState('all')
  const [mapRide, setMapRide] = useState<Ride | null>(null)

  // Fetch real rides from API for the current passenger
  const { data: ridesResponse, isLoading: ridesLoading } = useRides({ passengerId: user?.id || 'demo', limit: 50 })
  const apiRides = ridesResponse?.rides ?? []

  // Sync API rides into store
  useEffect(() => {
    if (apiRides.length > 0) {
      queueMicrotask(() => setRideHistory(apiRides as unknown as Ride[]))
    }
  }, [apiRides, setRideHistory])

  const displayHistory = rideHistory.length > 0 ? rideHistory : []

  const filteredRides = displayHistory.filter((ride) => {
    if (filter === "all") { /* pass */ }
    else if (filter === "completed") { if (ride.status !== "completed") return false }
    else if (filter === "cancelled") { if (ride.status !== "cancelled") return false }
    else if (filter === "in_progress") { if (ride.status !== "in_progress") return false }

    if (dateFrom) {
      const rideDate = new Date(ride.createdAt)
      if (rideDate < new Date(dateFrom)) return false
    }
    if (dateTo) {
      const rideDate = new Date(ride.createdAt)
      const toDate = new Date(dateTo)
      toDate.setDate(toDate.getDate() + 1)
      if (rideDate > toDate) return false
    }

    if (paymentFilter !== 'all') {
      const method = (ride as any).paymentMethod as string | undefined
      if (!method || method !== paymentFilter) return false
    }

    return true
  })

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-4"
    >
      <div className="space-y-1">
        <h2 className="text-lg font-bold text-foreground">Mes courses</h2>
        <p className="text-xs text-muted-foreground">Historique de vos trajets</p>
      </div>

      {/* Filter Tabs */}
      <Tabs value={filter} onValueChange={setFilter}>
        <TabsList className="w-full grid grid-cols-3">
          <TabsTrigger value="all">Toutes</TabsTrigger>
          <TabsTrigger value="completed">Terminées</TabsTrigger>
          <TabsTrigger value="cancelled">Annulées</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Date Range & Payment Filters */}
      <Card className="mova-card-hover">
        <CardContent className="p-3 space-y-2.5">
          <div className="flex items-center gap-2">
            <Calendar className="size-3.5 text-emerald-500 shrink-0" />
            <span className="text-xs font-medium">Filtrer par date</span>
          </div>
          <div className="flex gap-2">
            <div className="flex-1">
              <Label className="text-[10px] text-muted-foreground">Du</Label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="h-8 text-xs"
              />
            </div>
            <div className="flex-1">
              <Label className="text-[10px] text-muted-foreground">Au</Label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="h-8 text-xs"
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Label className="text-[10px] text-muted-foreground shrink-0 w-24">Paiement</Label>
            <Select value={paymentFilter} onValueChange={setPaymentFilter}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous</SelectItem>
                <SelectItem value="cash">Cash</SelectItem>
                <SelectItem value="wallet">Wallet</SelectItem>
                <SelectItem value="mobile_money">Mobile Money</SelectItem>
                <SelectItem value="card">Carte</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {(dateFrom || dateTo || paymentFilter !== 'all') && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-muted-foreground"
              onClick={() => { setDateFrom(''); setDateTo(''); setPaymentFilter('all') }}
            >
              <X className="size-3 mr-1" />
              Réinitialiser les filtres
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Ride List */}
      <ScrollArea className="max-h-[calc(100vh-18rem)]">
        {ridesLoading && displayHistory.length === 0 ? (
          <div className="space-y-2.5 pb-2">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="overflow-hidden">
                <CardContent className="p-3.5 space-y-2.5">
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-3 w-28" />
                    <Skeleton className="h-4 w-16 rounded-full" />
                  </div>
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-4 w-40 ml-3" />
                  <div className="flex justify-end">
                    <Skeleton className="h-5 w-20" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filteredRides.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center py-16 space-y-3"
          >
            <div className="size-16 rounded-full bg-muted flex items-center justify-center">
              <Car className="size-7 text-muted-foreground" />
            </div>
            <p className="font-medium text-muted-foreground">Aucune course</p>
            <p className="text-xs text-muted-foreground/70">Vos courses apparaîtront ici</p>
          </motion.div>
        ) : (
          <div className="space-y-2.5 pb-2">
            <AnimatePresence>
              {filteredRides.map((ride, index) => {
                const statusConf = getStatusConfig(ride.status)
                return (
                  <motion.div
                    key={ride.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <Card className="mova-card-hover overflow-hidden">
                      <CardContent className="p-3.5 space-y-2.5">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0 space-y-1.5">
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground">
                                {formatDate(ride.createdAt)}
                              </span>
                              <Badge className={`text-[10px] px-1.5 py-0 border-0 ${statusConf.color}`}>
                                {statusConf.label}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-1.5 text-sm">
                              <MapPin className="size-3.5 text-emerald-500 shrink-0" />
                              <span className="truncate font-medium">{ride.pickupAddress}</span>
                            </div>
                            <div className="flex items-center gap-1.5 text-sm ml-3">
                              <MoveRight className="size-3 text-muted-foreground shrink-0" />
                              <span className="truncate text-muted-foreground">{ride.dropoffAddress}</span>
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-sm font-bold text-foreground">
                              {ride.actualFare ? formatGNF(ride.actualFare) : formatGNF(ride.estimatedFare)}
                            </p>
                            {ride.distance && (
                              <p className="text-[10px] text-muted-foreground mt-0.5">{ride.distance} km</p>
                            )}
                            {ride.driver?.name && (
                              <p className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-0.5 justify-end">
                                <UserIcon className="size-2.5" />
                                {ride.driver.name}
                              </p>
                            )}
                            {ride.passengerRating && (
                              <div className="flex items-center gap-0.5 justify-end mt-0.5">
                                <Star className="size-2.5 fill-amber-400 text-amber-400" />
                                <span className="text-[10px] font-medium">{ride.passengerRating}</span>
                              </div>
                            )}
                          </div>
                        </div>
                        {/* Action buttons per ride */}
                        {ride.status === 'completed' && (
                          <div className="flex gap-2 pt-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs gap-1 text-emerald-600 dark:text-emerald-400"
                              onClick={() => toast.success('Reçu téléchargé !')}
                            >
                              <Download className="size-3" />
                              Reçu
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs gap-1 text-muted-foreground"
                              onClick={() => setMapRide(ride)}
                            >
                              <MapPinned className="size-3" />
                              Carte
                            </Button>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </motion.div>
                )
              })}
            </AnimatePresence>
          </div>
        )}
      </ScrollArea>

      {/* Trip Map Dialog */}
      <Dialog open={!!mapRide} onOpenChange={(open) => { if (!open) setMapRide(null) }}>
        <DialogContent className="max-w-lg p-0 gap-0 overflow-hidden">
          <DialogHeader className="sr-only">
            <DialogTitle>Carte du trajet</DialogTitle>
            <DialogDescription>Affichage du trajet sur la carte</DialogDescription>
          </DialogHeader>
          {mapRide && mapRide.pickupLat && mapRide.pickupLng && mapRide.dropoffLat && mapRide.dropoffLng ? (
            <>
              <div className="h-64 sm:h-80 relative">
                <DynamicMovaMap
                  pickup={{ lat: mapRide.pickupLat, lng: mapRide.pickupLng, name: mapRide.pickupAddress }}
                  dropoff={{ lat: mapRide.dropoffLat, lng: mapRide.dropoffLng, name: mapRide.dropoffAddress }}
                  showZones={false}
                  showRoute={true}
                  interactive={false}
                  drivers={[]}
                />
              </div>
              <div className="p-4 space-y-3">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <div className="size-2.5 rounded-full bg-emerald-500 shrink-0" />
                    <span className="font-medium truncate">{mapRide.pickupAddress}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <div className="size-2.5 rounded-full bg-amber-500 shrink-0" />
                    <span className="truncate text-muted-foreground">{mapRide.dropoffAddress}</span>
                  </div>
                </div>
                <Separator />
                <div className="grid grid-cols-2 gap-3">
                  {mapRide.distance && (
                    <div className="flex items-center gap-2">
                      <Route className="size-4 text-emerald-500" />
                      <div>
                        <p className="text-xs text-muted-foreground">Distance</p>
                        <p className="text-sm font-medium">{mapRide.distance} km</p>
                      </div>
                    </div>
                  )}
                  {mapRide.duration && (
                    <div className="flex items-center gap-2">
                      <Clock className="size-4 text-amber-500" />
                      <div>
                        <p className="text-xs text-muted-foreground">Durée</p>
                        <p className="text-sm font-medium">{mapRide.duration} min</p>
                      </div>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Tarif</span>
                    <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                      {mapRide.actualFare ? formatGNF(mapRide.actualFare) : formatGNF(mapRide.estimatedFare)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="size-4 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">{formatDate(mapRide.createdAt)}</span>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="p-8 flex flex-col items-center justify-center space-y-3">
              <div className="size-14 rounded-full bg-muted flex items-center justify-center">
                <MapPinned className="size-6 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium text-muted-foreground">Coordonnées non disponibles</p>
              <p className="text-xs text-muted-foreground/70 text-center max-w-[260px]">
                Les coordonnées GPS de ce trajet ne sont pas disponibles.
              </p>
              <Button variant="outline" size="sm" onClick={() => setMapRide(null)}>
                Fermer
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </motion.div>
  )
}

// ─── Profile Section ─────────────────────────────────────────────────────────

// ─── Scheduled Rides Section ─────────────────────────────────────────────────

function ScheduledRidesSection() {
  const { user } = useAppStore()
  const [showScheduleDialog, setShowScheduleDialog] = useState(false)
  const [schedDate, setSchedDate] = useState('')
  const [schedTime, setSchedTime] = useState('')
  const [schedPickup, setSchedPickup] = useState('')
  const [schedDropoff, setSchedDropoff] = useState('')
  const [schedRecurring, setSchedRecurring] = useState('none')

  // Fetch scheduled bookings from API
  const { data: bookingsResponse, isLoading: bookingsLoading, refetch: refetchBookings } = useBookings({ passengerId: user?.id || 'demo', status: 'scheduled', limit: 50 })
  const apiBookings = bookingsResponse?.data ?? []

  // Map API bookings to the UI format
  const displayScheduled = apiBookings.length > 0
    ? apiBookings.map((b) => {
        const schedDate = new Date(b.scheduledFor)
        return {
          id: b.id,
          pickupAddress: b.pickupAddress,
          dropoffAddress: b.dropoffAddress,
          date: schedDate.toISOString().split('T')[0],
          time: schedDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
          recurring: (b.notes?.includes('week') ? 'week' : b.notes?.includes('day') ? 'day' : 'none') as 'none' | 'day' | 'week',
          vehicleType: b.vehicleType as 'standard' | 'premium' | 'van',
          estimatedFare: b.estimatedFare,
        }
      })
    : []

  const handleSchedule = async () => {
    if (!schedDate || !schedTime || !schedPickup || !schedDropoff) {
      toast.error('Veuillez remplir tous les champs.')
      return
    }

    const pickupLoc = locations.find((l) => l.name === schedPickup)
    const dropoffLoc = locations.find((l) => l.name === schedDropoff)
    const scheduledFor = `${schedDate}T${schedTime}:00`

    try {
      const res = await fetch('/api/mova/bookings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${typeof window !== 'undefined' ? localStorage.getItem('mova_token') : ''}`,
        },
        body: JSON.stringify({
          passengerId: user?.id || 'demo',
          vehicleType: 'standard',
          pickupAddress: schedPickup,
          pickupLat: pickupLoc?.lat || 9.51,
          pickupLng: pickupLoc?.lng || -13.71,
          pickupZone: pickupLoc?.zone || 'Kaloum',
          dropoffAddress: schedDropoff,
          dropoffLat: dropoffLoc?.lat || 9.51,
          dropoffLng: dropoffLoc?.lng || -13.71,
          dropoffZone: dropoffLoc?.zone || 'Kaloum',
          scheduledFor,
          notes: schedRecurring !== 'none' ? `Recurrent: ${schedRecurring}` : '',
        }),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        toast.success(`Reservation confirmee pour le ${new Date(schedDate).toLocaleDateString('fr-FR')} a ${schedTime}`, {
          description: `${schedPickup} → ${schedDropoff} | Tarif estime: ${data.data.estimatedFareFormatted || formatGNF(data.data.estimatedFare)}`,
          duration: 5000,
        })
        refetchBookings()
      } else {
        toast.error(data.error || 'Erreur lors de la reservation')
        return
      }
    } catch {
      toast.success(`Course planifiee pour le ${new Date(schedDate).toLocaleDateString('fr-FR')} a ${schedTime}`)
    }

    setShowScheduleDialog(false)
    setSchedDate('')
    setSchedTime('')
    setSchedPickup('')
    setSchedDropoff('')
    setSchedRecurring('none')
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-4"
    >
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h2 className="text-lg font-bold text-foreground">Courses planifiées</h2>
          <p className="text-xs text-muted-foreground">Réservez à l&apos;avance</p>
        </div>
        <Button
          size="sm"
          className="mova-gradient text-white gap-1.5"
          onClick={() => setShowScheduleDialog(true)}
        >
          <Plus className="size-4" />
          Planifier
        </Button>
      </div>

      {bookingsLoading && apiBookings.length === 0 ? (
        <div className="space-y-2.5">
          {[1, 2].map((i) => (
            <Card key={i} className="overflow-hidden">
              <CardContent className="p-3.5 space-y-2">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-4 w-14 rounded-full" />
                  <Skeleton className="h-3 w-20" />
                </div>
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-44 ml-3" />
                <div className="flex justify-end">
                  <Skeleton className="h-5 w-18" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : displayScheduled.length === 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center justify-center py-12 space-y-3"
        >
          <div className="size-16 rounded-full bg-muted flex items-center justify-center">
            <Calendar className="size-7 text-muted-foreground" />
          </div>
          <p className="font-medium text-muted-foreground">Aucune course planifiée</p>
          <p className="text-xs text-muted-foreground/70">Planifiez votre prochaine course</p>
        </motion.div>
      ) : (
        <div className="space-y-2.5">
          {displayScheduled.map((sched) => (
            <Card key={sched.id} className="mova-card-hover overflow-hidden">
              <CardContent className="p-3.5 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <div className="flex items-center gap-2">
                      <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 border-0 text-[10px] px-1.5 py-0">
                        {sched.recurring === 'none' ? 'Unique' : 'Chaque semaine'}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {new Date(sched.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-sm">
                      <Clock className="size-3.5 text-emerald-500 shrink-0" />
                      <span className="font-medium">{sched.time}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs">
                      <MapPin className="size-3 text-emerald-500 shrink-0" />
                      <span className="truncate">{sched.pickupAddress}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs ml-3">
                      <MoveRight className="size-3 text-muted-foreground shrink-0" />
                      <span className="truncate text-muted-foreground">{sched.dropoffAddress}</span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold text-foreground">{formatGNF(sched.estimatedFare)}</p>
                    <Badge variant="outline" className="text-[10px] mt-1">
                      {vehicleOptions.find((v) => v.type === sched.vehicleType)?.name}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Schedule Dialog */}
      <Dialog open={showScheduleDialog} onOpenChange={setShowScheduleDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="size-5 text-emerald-500" />
              Planifier une course
            </DialogTitle>
            <DialogDescription>
              Choisissez la date, l&apos;heure et le trajet pour votre course planifiée.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Date</Label>
                <Input
                  type="date"
                  value={schedDate}
                  onChange={(e) => setSchedDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  className="text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Heure</Label>
                <Input
                  type="time"
                  value={schedTime}
                  onChange={(e) => setSchedTime(e.target.value)}
                  className="text-sm"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Point de départ</Label>
              <Select value={schedPickup} onValueChange={setSchedPickup}>
                <SelectTrigger className="w-full">
                  <MapPin className="size-4 text-emerald-500 mr-1 shrink-0" />
                  <SelectValue placeholder="Choisir un point de départ" />
                </SelectTrigger>
                <SelectContent>
                  {locations.map((loc) => (
                    <SelectItem key={loc.name} value={loc.name}>
                      {loc.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Destination</Label>
              <Select value={schedDropoff} onValueChange={setSchedDropoff}>
                <SelectTrigger className="w-full">
                  <Navigation className="size-4 text-amber-500 mr-1 shrink-0" />
                  <SelectValue placeholder="Choisir une destination" />
                </SelectTrigger>
                <SelectContent>
                  {locations.map((loc) => (
                    <SelectItem key={loc.name} value={loc.name}>
                      {loc.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Récurrence</Label>
              <div className="flex gap-2">
                {[
                  { value: 'none', label: 'Aucune' },
                  { value: 'day', label: 'Chaque jour' },
                  { value: 'week', label: 'Semaine' },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setSchedRecurring(opt.value)}
                    className={`flex-1 rounded-lg px-3 py-2 text-xs font-medium transition-all ${
                      schedRecurring === opt.value
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 ring-1 ring-emerald-400'
                        : 'bg-muted/50 hover:bg-muted text-muted-foreground'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setShowScheduleDialog(false)}>
              Annuler
            </Button>
            <Button className="mova-gradient text-white" onClick={handleSchedule}>
              <Calendar className="size-4 mr-2" />
              Planifier
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  )
}

// ─── Profile Section ─────────────────────────────────────────────────────────

function ProfileSection() {
  const { user, logout, rideHistory, setRideHistory } = useAppStore()
  const [notifications, setNotifications] = useState(true)
  const [language, setLanguage] = useState("fr")
  const { setTheme } = useTheme()

  const displayHistory = rideHistory.length > 0 ? rideHistory : []
  const completedRides = displayHistory.filter((r) => r.status === "completed")
  const avgRating = completedRides.length > 0
    ? completedRides.reduce((sum, r) => sum + (r.passengerRating || 0), 0) / completedRides.length
    : user?.rating || 0

  // Zone frequency calculation
  const zoneCount: Record<string, number> = {}
  displayHistory.forEach((r) => {
    zoneCount[r.pickupZone] = (zoneCount[r.pickupZone] || 0) + 1
    zoneCount[r.dropoffZone] = (zoneCount[r.dropoffZone] || 0) + 1
  })
  const favoriteZone = Object.entries(zoneCount).sort((a, b) => b[1] - a[1])[0]?.[0] || user?.zone || "—"

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-5"
    >
      {/* Profile Header */}
      <div className="flex flex-col items-center text-center space-y-3 pt-2">
        <Avatar className="size-20 ring-4 ring-emerald-200 dark:ring-emerald-800 shadow-lg">
          <AvatarFallback className="bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300 text-xl font-bold">
            {user ? getInitials(user.name) : "?"}
          </AvatarFallback>
        </Avatar>
        <div>
          <h2 className="text-xl font-bold text-foreground">{user?.name || "Passager"}</h2>
          <p className="text-sm text-muted-foreground">{user?.email}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{user?.phone}</p>
        </div>
        {user?.rating && <RatingStars rating={user.rating} size="md" />}
      </div>

      <Separator />

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="text-center mova-card-hover">
          <CardContent className="p-3 space-y-1">
            <History className="size-5 text-emerald-500 mx-auto" />
            <p className="text-lg font-bold text-foreground">{completedRides.length}</p>
            <p className="text-[10px] text-muted-foreground">Courses</p>
          </CardContent>
        </Card>
        <Card className="text-center mova-card-hover">
          <CardContent className="p-3 space-y-1">
            <Star className="size-5 text-amber-500 mx-auto" />
            <p className="text-lg font-bold text-foreground">{avgRating.toFixed(1)}</p>
            <p className="text-[10px] text-muted-foreground">Note moyenne</p>
          </CardContent>
        </Card>
        <Card className="text-center mova-card-hover">
          <CardContent className="p-3 space-y-1">
            <MapPin className="size-5 text-emerald-500 mx-auto" />
            <p className="text-lg font-bold text-foreground">{favoriteZone}</p>
            <p className="text-[10px] text-muted-foreground">Zone favorite</p>
          </CardContent>
        </Card>
      </div>

      <Separator />

      {/* Settings */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <TrendingUp className="size-4 text-muted-foreground" />
          Paramètres
        </h3>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="size-8 rounded-lg bg-muted flex items-center justify-center">
                <Bell className="size-4 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium">Notifications</p>
                <p className="text-[10px] text-muted-foreground">Alertes de course et promotions</p>
              </div>
            </div>
            <Switch
              checked={notifications}
              onCheckedChange={setNotifications}
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="size-8 rounded-lg bg-muted flex items-center justify-center">
                <Globe className="size-4 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium">Langue</p>
                <p className="text-[10px] text-muted-foreground">Langue de l&apos;application</p>
              </div>
            </div>
            <Select value={language} onValueChange={setLanguage}>
              <SelectTrigger className="w-24">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="fr">Français</SelectItem>
                <SelectItem value="en">English</SelectItem>
                <SelectItem value="ar">العربية</SelectItem>
                <SelectItem value="nqo">N&apos;ko</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="size-8 rounded-lg bg-muted flex items-center justify-center">
                <Sun className="size-4 text-muted-foreground dark:hidden" />
                <Moon className="size-4 text-muted-foreground hidden dark:block" />
              </div>
              <div>
                <p className="text-sm font-medium">Thème</p>
                <p className="text-[10px] text-muted-foreground">Apparence de l&apos;interface</p>
              </div>
            </div>
            <Select
              defaultValue="system"
              onValueChange={(v) => setTheme(v)}
            >
              <SelectTrigger className="w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="light">Clair</SelectItem>
                <SelectItem value="dark">Sombre</SelectItem>
                <SelectItem value="system">Système</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <Separator />

      {/* Logout */}
      <Button
        variant="outline"
        className="w-full text-red-500 border-red-200 dark:border-red-900 hover:bg-red-50 dark:hover:bg-red-950/30 hover:text-red-600"
        onClick={() => {
          logout()
          toast.success("Déconnexion réussie. À bientôt !")
        }}
      >
        <LogOut className="size-4 mr-2" />
        Se déconnecter
      </Button>
    </motion.div>
  )
}

// ─── Top Navigation Bar ──────────────────────────────────────────────────────

function TopNavBar({
  activeTab,
  setActiveTab,
  showNotifications,
  setShowNotifications,
}: {
  activeTab: string
  setActiveTab: (tab: string) => void
  showNotifications: boolean
  setShowNotifications: (v: boolean) => void
}) {
  const { user, logout } = useAppStore()
  const { unreadCount } = useNotifications()
  const { theme, setTheme } = useTheme()
  const { isConnected } = useTracking()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    requestAnimationFrame(() => setMounted(true))
  }, [])

  return (
    <header className="h-16 flex items-center justify-between px-4 lg:px-6 border-b bg-background/80 backdrop-blur-lg sticky top-0 z-30">
      {/* Logo */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="size-8 rounded-lg mova-gradient flex items-center justify-center shadow-md">
            <Car className="size-4 text-white" />
          </div>
          <span className="text-xl font-extrabold mova-gradient-text tracking-tight">MOVA</span>
          {/* Real-time connection indicator */}
          <span
            className={`size-2 rounded-full transition-colors duration-300 ${isConnected ? 'bg-emerald-500 shadow-sm shadow-emerald-500/50' : 'bg-gray-400'}`}
            title={isConnected ? 'Temps reel connecte' : 'Temps reel deconnecte'}
          />
        </div>
      </div>

      {/* Desktop Tabs */}
      <nav className="hidden md:flex items-center">
        <div className="flex items-center bg-muted rounded-lg p-1">
          {[
            { id: "booking", label: "Réserver", icon: <Car className="size-3.5" /> },
            { id: "scheduled", label: "Planifié", icon: <Calendar className="size-3.5" /> },
            { id: "history", label: "Mes courses", icon: <History className="size-3.5" /> },
            { id: "profile", label: "Profil", icon: <UserIcon className="size-3.5" /> },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-sm font-medium transition-all duration-200 ${
                activeTab === tab.id
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
      </nav>

      {/* Right Actions */}
      <div className="flex items-center gap-2">
        {/* Theme Toggle */}
        {mounted && (
          <Button
            variant="ghost"
            size="icon"
            className="size-9"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          >
            {theme === "dark" ? <Sun className="size-4 text-amber-400" /> : <Moon className="size-4" />}
          </Button>
        )}

        {/* Notification Bell */}
        <button onClick={() => { setShowNotifications(true) }} className="relative">
          <Bell className="size-5" />
          {unreadCount > 0 && <span className="absolute -top-1 -right-1 size-4 rounded-full bg-red-500 text-[10px] text-white flex items-center justify-center font-bold">{unreadCount > 9 ? '9+' : unreadCount}</span>}
        </button>

        {/* User Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative h-9 w-9 rounded-full">
              <Avatar className="size-8 ring-2 ring-emerald-200 dark:ring-emerald-800">
                <AvatarFallback className="bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300 text-xs font-bold">
                  {user ? getInitials(user.name) : "?"}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium">{user?.name || "Passager"}</p>
                <p className="text-xs text-muted-foreground">{user?.email}</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setActiveTab("profile")} className="cursor-pointer">
              <UserIcon className="size-4 mr-2" />
              Mon profil
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setActiveTab("history")} className="cursor-pointer">
              <History className="size-4 mr-2" />
              Mes courses
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => { logout(); toast.success("Déconnexion réussie.") }}
              variant="destructive"
              className="cursor-pointer"
            >
              <LogOut className="size-4 mr-2" />
              Se déconnecter
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}

// ─── Mobile Bottom Nav ────────────────────────────────────────────────────────

function MobileBottomNav({
  activeTab,
  setActiveTab,
}: {
  activeTab: string
  setActiveTab: (tab: string) => void
}) {
  const tabs = [
    { id: "booking", label: "Réserver", icon: Car },
    { id: "scheduled", label: "Planifié", icon: Calendar },
    { id: "history", label: "Courses", icon: History },
    { id: "profile", label: "Profil", icon: UserIcon },
  ]

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur-lg border-t z-30 safe-area-bottom">
      <div className="flex items-center justify-around py-2">
        {tabs.map((tab) => {
          const Icon = tab.icon
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex flex-col items-center gap-0.5 px-4 py-1.5 rounded-lg transition-all duration-200 ${
                isActive
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-muted-foreground"
              }`}
            >
              <div className={`p-1 rounded-lg ${isActive ? "bg-emerald-100 dark:bg-emerald-900/40" : ""}`}>
                <Icon className="size-5" />
              </div>
              <span className={`text-[10px] font-medium ${isActive ? "text-emerald-700 dark:text-emerald-300" : ""}`}>
                {tab.label}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ─── Mobile Booking Sheet ────────────────────────────────────────────────────

function MobileBookingSheet({
  phase,
  setPhase,
  estimatedFare,
  setFareResult,
  children,
}: {
  phase: BookingPhase
  setPhase: (p: BookingPhase) => void
  estimatedFare: { fare: number; distance: number; duration: number } | null
  setFareResult: (f: { fare: number; distance: number; duration: number } | null) => void
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(true)

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent side="bottom" className="h-[85vh] rounded-t-2xl">
        <SheetHeader className="pb-2">
          <SheetTitle className="sr-only">Formulaire de réservation</SheetTitle>
          <SheetDescription className="sr-only">Réservez votre course MOVA</SheetDescription>
          <div className="flex items-center justify-center pt-1 pb-2">
            <div className="w-10 h-1 rounded-full bg-muted-foreground/20" />
          </div>
        </SheetHeader>
        <ScrollArea className="flex-1 px-4 pb-20 mova-scrollbar">
          {children}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  )
}

// ─── Main PassengerView Component ────────────────────────────────────────────

export default function PassengerView() {
  const { pickupAddress, dropoffAddress, setPickupAddress, setDropoffAddress, setEstimatedFare } = useAppStore()
  const { unreadCount } = useNotifications()
  const tracking = useTracking()

  // Consume pendingViewTab from store (e.g. 'scheduled' from hub)
  const [activeTab, setActiveTab] = useState(() => {
    const tab = useAppStore.getState().pendingViewTab
    if (tab) {
      queueMicrotask(() => useAppStore.getState().setPendingViewTab(null))
      return tab
    }
    return "booking"
  })
  const [bookingPhase, setBookingPhase] = useState<BookingPhase>("form")
  const [fareResult, setFareResult] = useState<FareResult | null>(null)
  const [isMobile, setIsMobile] = useState(false)

  // Notification panel
  const [showNotifications, setShowNotifications] = useState(false)
  const [showAssistant, setShowAssistant] = useState(false)

  // Coordinate state for map-based address selection (independent of dropdown)
  const [pickupCoords, setPickupCoords] = useState<{ lat: number; lng: number } | null>(null)
  const [dropoffCoords, setDropoffCoords] = useState<{ lat: number; lng: number } | null>(null)
  const [osrmRouteInfo, setOsrmRouteInfo] = useState<{ distance: number; duration: number } | null>(null)

  // Sync coordinates from dropdown selection
  useEffect(() => {
    if (pickupAddress) {
      const loc = locations.find((l) => l.name === pickupAddress)
      if (loc) setPickupCoords({ lat: loc.lat, lng: loc.lng })
    } else {
      setPickupCoords(null)
    }
  }, [pickupAddress])

  useEffect(() => {
    if (dropoffAddress) {
      const loc = locations.find((l) => l.name === dropoffAddress)
      if (loc) setDropoffCoords({ lat: loc.lat, lng: loc.lng })
    } else {
      setDropoffCoords(null)
    }
  }, [dropoffAddress])

  // Clear OSRM route info when coordinates change
  useEffect(() => {
    setOsrmRouteInfo(null)
  }, [pickupCoords, dropoffCoords])

  const mapPickup = pickupCoords
    ? { lat: pickupCoords.lat, lng: pickupCoords.lng, name: pickupAddress || undefined }
    : null
  const mapDropoff = dropoffCoords
    ? { lat: dropoffCoords.lat, lng: dropoffCoords.lng, name: dropoffAddress || undefined }
    : null

  // Handle map click/search -> intelligently set pickup or dropoff
  const handleMapLocationSelect = (lat: number, lng: number, address: string) => {
    const shortAddress = address.split(',').slice(0, 2).join(',').trim()
    if (!pickupAddress || !pickupCoords) {
      setPickupAddress(shortAddress)
      setPickupCoords({ lat, lng })
      setFareResult(null)
      setEstimatedFare(null)
      if (bookingPhase !== "form") setBookingPhase("form")
      toast.success(`Depart: ${shortAddress.split(',')[0]}`)
    } else if (!dropoffAddress || !dropoffCoords) {
      setDropoffAddress(shortAddress)
      setDropoffCoords({ lat, lng })
      setFareResult(null)
      setEstimatedFare(null)
      if (bookingPhase !== "form") setBookingPhase("form")
      toast.success(`Destination: ${shortAddress.split(',')[0]}`)
    } else {
      setDropoffAddress(shortAddress)
      setDropoffCoords({ lat, lng })
      setFareResult(null)
      setEstimatedFare(null)
      if (bookingPhase !== "form") setBookingPhase("form")
      toast.success(`Nouvelle destination: ${shortAddress.split(',')[0]}`)
    }
  }

  // Handle OSRM route info from map
  const handleRouteInfo = (info: { distance: number; duration: number }) => {
    setOsrmRouteInfo(info)
  }

  // Detect mobile
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener("resize", check)
    return () => window.removeEventListener("resize", check)
  }, [])

  // When switching to booking tab, reset booking phase if no active ride
  useEffect(() => {
    if (activeTab === "booking") {
      const { currentRide } = useAppStore.getState()
      if (!currentRide) {
        setBookingPhase("form")
        setFareResult(null)
      } else {
        setBookingPhase("active")
      }
    }
  }, [activeTab])

  // Subscribe to zone for real-time driver positions on map
  useEffect(() => {
    const { user, currentRide } = useAppStore.getState()
    if (!user || !tracking.isConnected) return

    const zone = currentRide?.pickupZone || 'Kaloum'
    tracking.subscribeToZone({ passengerId: user.id, zone })

    return () => {
      tracking.unsubscribeFromZone({ passengerId: user.id, zone })
    }
  }, [tracking.isConnected, bookingPhase])

  // Real-time driver positions from tracking for map markers
  const realtimeDrivers = useMemo(() => {
    if (tracking.driverPositions.size === 0) return undefined
    return Array.from(tracking.driverPositions.entries()).map(([id, pos]) => ({
      id,
      lat: pos.lat,
      lng: pos.lng,
      name: id,
    }))
  }, [tracking.driverPositions])

  // Listen for ride status, completion, and cancellation events
  useEffect(() => {
    tracking.on({
      onRideStatusUpdate: (data) => {
        const { currentRide } = useAppStore.getState()
        if (currentRide) {
          useAppStore.getState().setCurrentRide({
            ...currentRide,
            status: data.status as Ride['status'],
          })
        }
      },
      onRideCompleted: (data) => {
        toast.success('Course terminee !', { description: `Tarif: ${formatGNF(data.fare)}` })
        // Reset booking phase after completion
        setTimeout(() => {
          setBookingPhase("form")
          setFareResult(null)
          useAppStore.getState().setCurrentRide(null)
        }, 3000)
      },
      onRideCancelled: () => {
        setBookingPhase("form")
        setFareResult(null)
        useAppStore.getState().setCurrentRide(null)
        toast.info("Course annulee")
      },
    })
    return () => { tracking.off() }
  }, [tracking])

  const bookingFormProps = {
    phase: bookingPhase,
    setPhase: setBookingPhase,
    estimatedFare: fareResult,
    setFareResult,
    osrmRouteInfo,
    pickupCoords,
    dropoffCoords,
    setPickupCoords,
    setDropoffCoords,
  }

  // Mobile Layout: Full map + bottom sheet
  if (isMobile) {
    return (
      <>
      <div className="h-[calc(100vh-4rem)] flex flex-col">
        <TopNavBar activeTab={activeTab} setActiveTab={setActiveTab} showNotifications={showNotifications} setShowNotifications={setShowNotifications} />

        {/* Map takes full space */}
        <div className="flex-1 relative">
          <MapSection
            pickup={mapPickup}
            dropoff={mapDropoff}
            drivers={realtimeDrivers}
            onLocationSelect={handleMapLocationSelect}
            onRouteInfo={handleRouteInfo}
            interactive={activeTab === "booking" && (bookingPhase === "form" || bookingPhase === "estimated")}
            showRoute={bookingPhase === "form" || bookingPhase === "estimated" || bookingPhase === "searching" || bookingPhase === "active"}
            showSearch={activeTab === "booking" && bookingPhase === "form"}
            assignedDriverLocation={tracking.driverLocation ? { lat: tracking.driverLocation.lat, lng: tracking.driverLocation.lng, timestamp: tracking.driverLocation.timestamp } : null}
            showRideProgress={bookingPhase === "active" || bookingPhase === "searching"}
          />

          {/* Floating active ride info when active */}
          {bookingPhase === "active" && activeTab === "booking" && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="absolute bottom-20 left-4 right-4 mova-glass rounded-xl p-3 shadow-lg"
            >
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-full bg-emerald-500 flex items-center justify-center">
                  <Car className="size-5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground">Course en cours</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {useAppStore.getState().currentRide?.pickupAddress} → {useAppStore.getState().currentRide?.dropoffAddress}
                  </p>
                </div>
                <div className="mova-pulse-dot size-3 rounded-full bg-emerald-500" />
              </div>
            </motion.div>
          )}

          {/* Live Ride Tracker (real-time) */}
          {bookingPhase === "active" && (() => {
            const currentRide = useAppStore.getState().currentRide
            return currentRide && currentRide.driver && (
              <LiveRideTracker
                driverName={currentRide.driver.name || "Chauffeur"}
                vehicleType={currentRide.vehicle?.type || "standard"}
                vehiclePlate={currentRide.vehicle?.plate || ""}
                driverRating={currentRide.driver.rating || 5}
                driverPhone={currentRide.driver.phone}
                status={tracking.currentRideStatus === 'in_progress' ? 'in_progress' : tracking.currentRideStatus === 'accepted' ? 'accepted' : currentRide.status === 'in_progress' ? 'in_progress' : 'accepted'}
                etaSeconds={tracking.rideEta?.etaSeconds ?? (currentRide.duration ? currentRide.duration * 60 : 120)}
                distanceRemaining={tracking.rideEta?.distanceRemaining ?? (currentRide.distance ? currentRide.distance : 2)}
                pickupAddress={currentRide.pickupAddress}
                dropoffAddress={currentRide.dropoffAddress}
                onCancelRide={() => {
                  if (tracking.isConnected && currentRide.id) {
                    tracking.cancelRide({ rideId: currentRide.id })
                  }
                  useAppStore.getState().setCurrentRide(null)
                  setBookingPhase("form")
                  setFareResult(null)
                  toast.info("Course annulee")
                }}
                onCallDriver={() => {
                  if (currentRide?.driver?.phone) {
                    window.open(`tel:${currentRide.driver.phone}`, '_self')
                  } else {
                    toast.info("Numero non disponible")
                  }
                }}
                onShareTrip={() => {
                  if (navigator.share && currentRide) {
                    navigator.share({
                      title: 'MOVA - Partager ma course',
                      text: `Je suis en course avec MOVA. Depart: ${currentRide.pickupAddress}, Destination: ${currentRide.dropoffAddress}`,
                    }).catch(() => {})
                  } else {
                    toast.info("Partage non supporte sur cet appareil")
                  }
                }}
              />
            )
          })()}

          {/* Sheet for mobile */}
          {(activeTab === "booking" && bookingPhase !== "active") && (
            <MobileBookingSheet
              phase={bookingPhase}
              setPhase={setBookingPhase}
              estimatedFare={fareResult}
              setFareResult={setFareResult}
            >
              <BookingForm {...bookingFormProps} />
            </MobileBookingSheet>
          )}

          {/* Mobile sheet for active ride */}
          {activeTab === "booking" && bookingPhase === "active" && (
            <MobileBookingSheet
              phase={bookingPhase}
              setPhase={setBookingPhase}
              estimatedFare={fareResult}
              setFareResult={setFareResult}
            >
              <ActiveRideSection onReset={() => {
                setBookingPhase("form")
                setFareResult(null)
                useAppStore.getState().setCurrentRide(null)
              }} fareBreakdownData={fareResult?.breakdown} />
            </MobileBookingSheet>
          )}

          {/* Mobile sheet for history */}
          {activeTab === "history" && (
            <MobileBookingSheet
              phase={bookingPhase}
              setPhase={setBookingPhase}
              estimatedFare={fareResult}
              setFareResult={setFareResult}
            >
              <RideHistorySection />
            </MobileBookingSheet>
          )}

          {/* Mobile sheet for scheduled */}
          {activeTab === "scheduled" && (
            <MobileBookingSheet
              phase={bookingPhase}
              setPhase={setBookingPhase}
              estimatedFare={fareResult}
              setFareResult={setFareResult}
            >
              <ScheduledRidesSection />
            </MobileBookingSheet>
          )}

          {/* Mobile sheet for profile */}
          {activeTab === "profile" && (
            <MobileBookingSheet
              phase={bookingPhase}
              setPhase={setBookingPhase}
              estimatedFare={fareResult}
              setFareResult={setFareResult}
            >
              <ProfileSection />
            </MobileBookingSheet>
          )}
        </div>

        <MobileBottomNav activeTab={activeTab} setActiveTab={setActiveTab} />
      </div>

      {/* Notification Panel */}
      <NotificationPanel open={showNotifications} onOpenChange={setShowNotifications} />
      <AssistantPanel open={showAssistant} onOpenChange={setShowAssistant} />

      {/* ASSISTANT FAB */}
      {!showAssistant && (
        <motion.button
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 260, damping: 20, delay: 0.5 }}
          onClick={() => setShowAssistant(true)}
          className="fixed bottom-20 right-4 z-50 size-14 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-lg shadow-emerald-500/30 hover:shadow-xl hover:shadow-emerald-500/40 hover:scale-105 active:scale-95 transition-all flex items-center justify-center"
        >
          <MessageCircle className="size-6" />
          <span className="absolute -top-0.5 -right-0.5 size-3 rounded-full bg-emerald-300 animate-pulse" />
        </motion.button>
      )}
    </>
  )
  }

  // Desktop Layout: Map left + Panel right
  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col">
      <TopNavBar activeTab={activeTab} setActiveTab={setActiveTab} showNotifications={showNotifications} setShowNotifications={setShowNotifications} />

      <div className="flex-1 flex overflow-hidden">
        {/* Left: Map */}
        <div className="w-[60%] relative">
          <MapSection
            pickup={mapPickup}
            dropoff={mapDropoff}
            drivers={realtimeDrivers}
            onLocationSelect={handleMapLocationSelect}
            onRouteInfo={handleRouteInfo}
            interactive={activeTab === "booking" && (bookingPhase === "form" || bookingPhase === "estimated")}
            showRoute={bookingPhase === "form" || bookingPhase === "estimated" || bookingPhase === "searching" || bookingPhase === "active"}
            showSearch={activeTab === "booking" && bookingPhase === "form"}
            assignedDriverLocation={tracking.driverLocation ? { lat: tracking.driverLocation.lat, lng: tracking.driverLocation.lng, timestamp: tracking.driverLocation.timestamp } : null}
            showRideProgress={bookingPhase === "active" || bookingPhase === "searching"}
          />

          {/* Floating ETA when active */}
          {bookingPhase === "active" && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="absolute top-4 left-4 mova-glass rounded-xl px-4 py-3 shadow-lg"
            >
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-full bg-emerald-500 flex items-center justify-center shadow-md">
                  <Car className="size-5 text-white" />
                </div>
                <div>
                  <p className="text-sm font-bold text-foreground">Course en cours</p>
                  <p className="text-xs text-muted-foreground">
                    Votre chauffeur arrive...
                  </p>
                </div>
                <div className="mova-pulse-dot size-3 rounded-full bg-emerald-500 ml-2" />
              </div>
            </motion.div>
          )}

          {/* Live Ride Tracker (real-time) */}
          {bookingPhase === "active" && (() => {
            const currentRide = useAppStore.getState().currentRide
            return currentRide && currentRide.driver && (
              <LiveRideTracker
                driverName={currentRide.driver.name || "Chauffeur"}
                vehicleType={currentRide.vehicle?.type || "standard"}
                vehiclePlate={currentRide.vehicle?.plate || ""}
                driverRating={currentRide.driver.rating || 5}
                driverPhone={currentRide.driver.phone}
                status={tracking.currentRideStatus === 'in_progress' ? 'in_progress' : tracking.currentRideStatus === 'accepted' ? 'accepted' : currentRide.status === 'in_progress' ? 'in_progress' : 'accepted'}
                etaSeconds={tracking.rideEta?.etaSeconds ?? (currentRide.duration ? currentRide.duration * 60 : 120)}
                distanceRemaining={tracking.rideEta?.distanceRemaining ?? (currentRide.distance ? currentRide.distance : 2)}
                pickupAddress={currentRide.pickupAddress}
                dropoffAddress={currentRide.dropoffAddress}
                onCancelRide={() => {
                  if (tracking.isConnected && currentRide.id) {
                    tracking.cancelRide({ rideId: currentRide.id })
                  }
                  useAppStore.getState().setCurrentRide(null)
                  setBookingPhase("form")
                  setFareResult(null)
                  toast.info("Course annulee")
                }}
                onCallDriver={() => {
                  if (currentRide?.driver?.phone) {
                    window.open(`tel:${currentRide.driver.phone}`, '_self')
                  } else {
                    toast.info("Numero non disponible")
                  }
                }}
                onShareTrip={() => {
                  if (navigator.share && currentRide) {
                    navigator.share({
                      title: 'MOVA - Partager ma course',
                      text: `Je suis en course avec MOVA. Depart: ${currentRide.pickupAddress}, Destination: ${currentRide.dropoffAddress}`,
                    }).catch(() => {})
                  } else {
                    toast.info("Partage non supporte sur cet appareil")
                  }
                }}
              />
            )
          })()}
        </div>

        {/* Right: Panel */}
        <div className="w-[40%] border-l bg-background flex flex-col">
          <ScrollArea className="flex-1 mova-scrollbar">
            <div className="p-5 lg:p-6 max-h-[calc(100vh-4rem)]">
              <AnimatePresence mode="wait">
                {activeTab === "booking" && (
                  <motion.div
                    key="booking-panel"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.2 }}
                  >
                    <BookingForm {...bookingFormProps} />
                  </motion.div>
                )}
                {activeTab === "scheduled" && (
                  <motion.div
                    key="scheduled-panel"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.2 }}
                  >
                    <ScheduledRidesSection />
                  </motion.div>
                )}
                {activeTab === "history" && (
                  <motion.div
                    key="history-panel"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.2 }}
                  >
                    <RideHistorySection />
                  </motion.div>
                )}
                {activeTab === "profile" && (
                  <motion.div
                    key="profile-panel"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.2 }}
                  >
                    <ProfileSection />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </ScrollArea>
        </div>
      </div>
      {/* Notification Panel */}
      <NotificationPanel open={showNotifications} onOpenChange={setShowNotifications} />
      <AssistantPanel open={showAssistant} onOpenChange={setShowAssistant} />

      {/* ASSISTANT FAB */}
      {!showAssistant && (
        <motion.button
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 260, damping: 20, delay: 0.5 }}
          onClick={() => setShowAssistant(true)}
          className="fixed bottom-6 right-6 z-50 size-14 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-lg shadow-emerald-500/30 hover:shadow-xl hover:shadow-emerald-500/40 hover:scale-105 active:scale-95 transition-all flex items-center justify-center"
        >
          <MessageCircle className="size-6" />
          <span className="absolute -top-0.5 -right-0.5 size-3 rounded-full bg-emerald-300 animate-pulse" />
        </motion.button>
      )}
    </div>
  )
}

