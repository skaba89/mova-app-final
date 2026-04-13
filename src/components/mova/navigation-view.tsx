'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  MapPin, Navigation, Car, Bike, Footprints, Clock, Route,
  ArrowLeft, LocateFixed, ChevronRight, Loader2, Search,
  Home, Building2, Plane, Hospital, ShoppingBag, Volume2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { toast } from 'sonner'
import { useAppStore } from '@/lib/mova/store'
import { DynamicMovaMap } from '@/components/mova/mova-map'

// ── Types ──────────────────────────────────────────────────

type TransportMode = 'walking' | 'cycling' | 'driving'

interface NominatimResult {
  place_id: number
  display_name: string
  lat: string
  lon: string
  type: string
}

interface GeoLocation {
  lat: number
  lng: number
  name: string
}

interface OSRMStep {
  distance: number
  duration: number
  name: string
  maneuver: {
    type: string
    modifier?: string
    location: [number, number]
    bearing_before: number
    bearing_after: number
  }
}

interface RouteData {
  distance: number   // meters
  duration: number   // seconds
  instructions: StepInstruction[]
}

interface StepInstruction {
  id: string
  icon: React.ReactNode
  text: string
  distance: string
}

interface TransportOption {
  id: TransportMode
  label: string
  icon: React.ReactNode
  osrmProfile: string
}

interface QuickDestination {
  id: string
  label: string
  icon: React.ReactNode
  address: string
  lat: number
  lng: number
}

// ── Constants ──────────────────────────────────────────────

const TRANSPORT_MODES: TransportOption[] = [
  { id: 'walking', label: 'À pied', icon: <Footprints className="h-5 w-5" />, osrmProfile: 'foot' },
  { id: 'cycling', label: 'Vélo', icon: <Bike className="h-5 w-5" />, osrmProfile: 'bike' },
  { id: 'driving', label: 'Voiture', icon: <Car className="h-5 w-5" />, osrmProfile: 'driving' },
]

const QUICK_DESTINATIONS: QuickDestination[] = [
  { id: 'home', label: 'Maison', icon: <Home className="h-4 w-4" />, address: 'Kaloum, Centre-ville', lat: 9.509, lng: -13.712 },
  { id: 'office', label: 'Bureau', icon: <Building2 className="h-4 w-4" />, address: 'Ratoma, Kipé', lat: 9.630, lng: -13.595 },
  { id: 'airport', label: 'Aéroport', icon: <Plane className="h-4 w-4" />, address: 'Aéroport Gbessia', lat: 9.592, lng: -13.610 },
  { id: 'hospital', label: 'Hôpital', icon: <Hospital className="h-4 w-4" />, address: 'Matam, Ignace Deen', lat: 9.556, lng: -13.670 },
  { id: 'mall', label: 'Centre commercial', icon: <ShoppingBag className="h-4 w-4" />, address: 'Ratoma, Niger', lat: 9.554, lng: -13.672 },
]

const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org/search'
const OSRM_BASE = 'https://router.project-osrm.org/route/v1'
const NOMINATIM_HEADERS = { 'User-Agent': 'MOVA-App/1.0' }

// Default origin: centre-ville Conakry
const DEFAULT_ORIGIN: GeoLocation = { lat: 9.509, lng: -13.712, name: 'Centre-ville, Conakry' }

// ── French Instruction Builder ────────────────────────────

function getTurnDirection(modifier: string | undefined): string {
  switch (modifier) {
    case 'left': return 'Tournez à gauche'
    case 'right': return 'Tournez à droite'
    case 'slight left': return 'Tournez légèrement à gauche'
    case 'slight right': return 'Tournez légèrement à droite'
    case 'sharp left': return 'Tournez fortement à gauche'
    case 'sharp right': return 'Tournez fortement à droite'
    case 'straight': return 'Continuez tout droit'
    case 'uturn': return 'Faites demi-tour'
    default: return 'Continuez'
  }
}

function buildFrenchInstruction(step: OSRMStep): string {
  const { type, modifier } = step.maneuver
  const streetName = step.name ? `sur ${step.name}` : ''

  switch (type) {
    case 'depart':
      return step.name ? `Partez sur ${step.name}` : 'Partez en direction de votre destination'
    case 'arrive':
      return 'Vous êtes arrivé à destination'
    case 'turn':
    case 'end of road':
    case 'fork':
      return streetName
        ? `${getTurnDirection(modifier)} ${streetName}`
        : getTurnDirection(modifier)
    case 'continue':
    case 'new name':
      return streetName
        ? `Continuez ${streetName}`
        : 'Continuez tout droit'
    case 'merge':
      return streetName
        ? `Rejoignez ${streetName}`
        : 'Rejoignez la route'
    case 'on ramp':
      return streetName
        ? `Prenez l'accès ${streetName}`
        : "Prenez l'autoroute"
    case 'off ramp':
      return streetName
        ? `Prenez la sortie vers ${streetName}`
        : 'Prenez la sortie'
    case 'roundabout':
    case 'rotary':
      return streetName
        ? `Prenez le rond-point puis ${streetName}`
        : 'Prenez le rond-point'
    default:
      return streetName
        ? `Continuez ${streetName}`
        : 'Continuez'
  }
}

function getStepIcon(type: string, modifier: string | undefined, isLast: boolean): React.ReactNode {
  if (isLast || type === 'arrive') {
    return <Navigation className="h-4 w-4 text-red-500" />
  }
  if (type === 'depart') {
    return <LocateFixed className="h-4 w-4 text-emerald-600" />
  }
  if (type === 'roundabout' || type === 'rotary') {
    return <Route className="h-4 w-4 text-amber-500" />
  }
  if (modifier === 'uturn') {
    return <ArrowLeft className="h-4 w-4 text-amber-500" />
  }
  if (modifier === 'left' || modifier === 'sharp left' || modifier === 'slight left') {
    return <ChevronRight className="h-4 w-4 text-emerald-600 -rotate-90" />
  }
  if (modifier === 'right' || modifier === 'sharp right' || modifier === 'slight right') {
    return <ChevronRight className="h-4 w-4 text-emerald-600 rotate-90" />
  }
  // straight / continue / merge / etc.
  return <ChevronRight className="h-4 w-4 text-emerald-600" />
}

function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${Math.round(meters)} m`
  }
  return `${(meters / 1000).toFixed(1)} km`
}

function formatDuration(seconds: number): string {
  const minutes = Math.ceil(seconds / 60)
  if (minutes < 60) {
    return `${minutes} min`
  }
  const hours = Math.floor(minutes / 60)
  const remainingMin = minutes % 60
  return remainingMin > 0 ? `${hours} h ${remainingMin}` : `${hours} h`
}

function formatArrivalTime(durationSeconds: number): string {
  const arrival = new Date(Date.now() + durationSeconds * 1000)
  return arrival.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

// ── OSRM Route Fetcher ────────────────────────────────────

async function fetchOSRMRoute(
  origin: GeoLocation,
  destination: GeoLocation,
  profile: string,
  signal?: AbortSignal
): Promise<RouteData | null> {
  const url = `${OSRM_BASE}/${profile}/${origin.lng},${origin.lat};${destination.lng},${destination.lat}?overview=full&geometries=geojson&steps=true`

  const res = await fetch(url, { signal })
  if (!res.ok) {
    // If the profile is not available on the OSRM demo server, fall back to driving
    if (profile !== 'driving' && (res.status === 404 || res.status === 400)) {
      return fetchOSRMRoute(origin, destination, 'driving', signal)
    }
    return null
  }

  const data = await res.json()
  if (!data.routes || !data.routes[0]) return null

  const route = data.routes[0]
  const legs = route.legs?.[0]
  const steps: OSRMStep[] = legs?.steps || []

  const instructions: StepInstruction[] = steps
    .filter((step, idx) => {
      // Skip very short name-change steps (< 10m and no meaningful turn)
      if (step.distance < 10 && step.maneuver.type === 'new name') return false
      // Always keep depart and arrive
      if (step.maneuver.type === 'depart' || step.maneuver.type === 'arrive') return true
      return true
    })
    .map((step, idx) => {
      const isLast = step.maneuver.type === 'arrive'
      return {
        id: `step-${idx}`,
        icon: getStepIcon(step.maneuver.type, step.maneuver.modifier, isLast),
        text: buildFrenchInstruction(step),
        distance: step.maneuver.type === 'arrive' ? '' : formatDistance(step.distance),
      }
    })

  // If walking/biking and we fell back to driving, adjust duration by approximate speed ratio
  let duration = route.duration
  if (profile === 'foot' && !legs) {
    duration = (route.distance / 1000 / 5) * 3600 // ~5 km/h walking
  } else if (profile === 'bike' && !legs) {
    duration = (route.distance / 1000 / 15) * 3600 // ~15 km/h cycling
  }

  return {
    distance: route.distance,
    duration,
    instructions,
  }
}

// ── Nominatim Geocoder ────────────────────────────────────

async function geocodeAddress(query: string, signal?: AbortSignal): Promise<NominatimResult[]> {
  const url = `${NOMINATIM_BASE}?format=json&q=${encodeURIComponent(query + ' Conakry Guinée')}&countrycodes=gn&bounded=1&viewbox=-13.85,9.35,-13.55,9.70&limit=5&accept-language=fr`
  const res = await fetch(url, { signal, headers: NOMINATIM_HEADERS })
  if (!res.ok) return []
  return res.json() as Promise<NominatimResult[]>
}

// ── Main Component ─────────────────────────────────────────

export default function NavigationView() {
  const { goBack } = useAppStore()

  // Search state
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<NominatimResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [showSearchDropdown, setShowSearchDropdown] = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null)

  // Location state
  const [origin, setOrigin] = useState<GeoLocation | null>(null)
  const [destination, setDestination] = useState<GeoLocation | null>(null)
  const [isLocating, setIsLocating] = useState(false)
  const [locateTrigger, setLocateTrigger] = useState(0)

  // Route state
  const [selectedMode, setSelectedMode] = useState<TransportMode>('driving')
  const [routeData, setRouteData] = useState<RouteData | null>(null)
  const [isRouting, setIsRouting] = useState(false)
  const [routeError, setRouteError] = useState(false)
  const routingControllerRef = useRef<AbortController | null>(null)

  // UI state
  const [showInstructions, setShowInstructions] = useState(false)

  // ── Geolocate user on mount ──
  useEffect(() => {
    if (!navigator.geolocation) {
      setOrigin(DEFAULT_ORIGIN)
      return
    }
    setIsLocating(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords
        // Reverse geocode to get address name
        fetch(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=16&accept-language=fr`,
          { headers: NOMINATIM_HEADERS }
        )
          .then((r) => r.json())
          .then((data) => {
            const shortName = data.display_name
              ? data.display_name.split(',').slice(0, 2).join(',').trim()
              : 'Votre position'
            setOrigin({ lat: latitude, lng: longitude, name: shortName })
          })
          .catch(() => {
            setOrigin({ lat: latitude, lng: longitude, name: 'Votre position' })
          })
          .finally(() => setIsLocating(false))
      },
      () => {
        // Geolocation denied — use default
        setOrigin(DEFAULT_ORIGIN)
        setIsLocating(false)
        toast.info('Localisation non disponible', {
          description: 'Position par défaut : Centre-ville, Conakry',
        })
      },
      { enableHighAccuracy: true, timeout: 8000 }
    )
  }, [])

  // ── Close search dropdown on outside click ──
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowSearchDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // ── Debounced Nominatim search ──
  const handleSearchChange = useCallback((query: string) => {
    setSearchQuery(query)
    if (debounceRef.current) clearTimeout(debounceRef.current)

    if (!query.trim() || query.trim().length < 2) {
      setSearchResults([])
      setIsSearching(false)
      return
    }

    setIsSearching(true)
    debounceRef.current = setTimeout(async () => {
      try {
        const results = await geocodeAddress(query)
        setSearchResults(results)
      } catch {
        setSearchResults([])
      } finally {
        setIsSearching(false)
      }
    }, 400)
  }, [])

  // ── Select a destination ──
  const selectDestination = useCallback((lat: number, lng: number, name: string) => {
    setDestination({ lat, lng, name })
    setSearchQuery(name.split(',').slice(0, 2).join(',').trim())
    setShowSearchDropdown(false)
    setSearchResults([])
    setRouteData(null)
    setRouteError(false)
  }, [])

  // ── Search submit ──
  const handleSearch = useCallback(() => {
    if (!searchQuery.trim()) {
      toast.error('Veuillez entrer une destination')
      return
    }
    // If we have results and the first one matches closely, use it
    if (searchResults.length > 0) {
      const first = searchResults[0]
      selectDestination(
        parseFloat(first.lat),
        parseFloat(first.lon),
        first.display_name.split(',').slice(0, 2).join(',').trim()
      )
    } else {
      // Try geocoding the raw query
      setIsSearching(true)
      geocodeAddress(searchQuery)
        .then((results) => {
          if (results.length > 0) {
            const r = results[0]
            selectDestination(parseFloat(r.lat), parseFloat(r.lon), r.display_name.split(',').slice(0, 2).join(',').trim())
          } else {
            toast.error('Adresse introuvable', {
              description: `Aucun résultat pour "${searchQuery}" dans la région de Conakry`,
            })
          }
        })
        .catch(() => {
          toast.error('Erreur de recherche', { description: 'Impossible de contacter le service de géocodage.' })
        })
        .finally(() => setIsSearching(false))
    }
  }, [searchQuery, searchResults, selectDestination])

  // ── Quick destination ──
  const handleQuickDestination = useCallback((dest: QuickDestination) => {
    selectDestination(dest.lat, dest.lng, dest.address)
    toast.success(`Destination : ${dest.label}`)
  }, [selectDestination])

  // ── Fetch route when origin/destination/mode changes ──
  useEffect(() => {
    if (!origin || !destination) {
      setRouteData(null)
      return
    }

    // Abort previous request
    if (routingControllerRef.current) {
      routingControllerRef.current.abort()
    }
    const controller = new AbortController()
    routingControllerRef.current = controller

    setIsRouting(true)
    setRouteError(false)
    setRouteData(null)

    const modeConfig = TRANSPORT_MODES.find((m) => m.id === selectedMode)!
    const profile = modeConfig.osrmProfile

    fetchOSRMRoute(origin, destination, profile, controller.signal)
      .then((data) => {
        if (data) {
          setRouteData(data)
        } else {
          setRouteError(true)
          toast.error('Itinéraire introuvable', {
            description: 'Impossible de calculer un itinéraire pour ce trajet.',
          })
        }
      })
      .catch((err) => {
        if (err.name !== 'AbortError') {
          setRouteError(true)
          toast.error('Erreur de routage', {
            description: 'Le service de routage est temporairement indisponible.',
          })
        }
      })
      .finally(() => setIsRouting(false))

    return () => {
      controller.abort()
    }
  }, [origin, destination, selectedMode])

  // ── Handle mode change ──
  const handleModeChange = useCallback((mode: TransportMode) => {
    setSelectedMode(mode)
    setShowInstructions(false)
  }, [])

  // ── Relocate user ──
  const handleRelocate = useCallback(() => {
    setLocateTrigger((prev) => prev + 1)
  }, [])

  // ── Start navigation ──
  const handleStartNavigation = useCallback(() => {
    if (!routeData || !destination) return
    const modeLabel = TRANSPORT_MODES.find((m) => m.id === selectedMode)?.label
    toast.success('Navigation GPS activée', {
      description: `Mode : ${modeLabel} — Arrivée estimée à ${formatArrivalTime(routeData.duration)}`,
    })
  }, [routeData, destination, selectedMode])

  // ── Derived values ──
  const hasRoute = !!routeData
  const arrivalTime = routeData ? formatArrivalTime(routeData.duration) : '--:--'
  const distanceStr = routeData ? formatDistance(routeData.distance) : '-- km'
  const durationStr = routeData ? formatDuration(routeData.duration) : '-- min'
  const modeDurationStr = hasRoute ? formatDuration(routeData.duration) : ''
  const instructionCount = routeData?.instructions.length || 0

  return (
    <div className="min-h-screen bg-background">
      {/* ── Header ── */}
      <header className="sticky top-0 z-50 mova-glass border-b border-border/50">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="icon" className="rounded-full" onClick={goBack}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-emerald-600 flex items-center justify-center">
              <Navigation className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold">Navigation GPS</h1>
              <p className="text-xs text-muted-foreground">
                {origin && !isLocating ? `Départ : ${origin.name}` : 'Localisation en cours...'}
              </p>
            </div>
          </div>
          {isLocating && (
            <Loader2 className="h-4 w-4 animate-spin text-emerald-500 ml-auto" />
          )}
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-4 space-y-4 pb-24">
        {/* ── Search Bar ── */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div ref={searchRef} className="relative flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Où allez-vous ?"
                value={searchQuery}
                onChange={(e) => {
                  handleSearchChange(e.target.value)
                  setShowSearchDropdown(true)
                }}
                onFocus={() => setShowSearchDropdown(true)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    handleSearch()
                  }
                }}
                className="pl-9 pr-4 h-11 rounded-xl bg-muted/50 border-border/50"
              />
              {isSearching && (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-emerald-500" />
              )}
            </div>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700 rounded-xl px-4"
              onClick={handleSearch}
              disabled={isSearching}
            >
              <Navigation className="h-4 w-4" />
            </Button>

            {/* ── Search Dropdown ── */}
            <AnimatePresence>
              {showSearchDropdown && (isSearching || searchResults.length > 0) && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.15 }}
                  className="absolute top-full left-0 right-14 mt-1 z-50 rounded-xl border bg-popover shadow-lg max-h-64 overflow-y-auto mova-scrollbar"
                >
                  {searchResults.map((result, idx) => {
                    const shortName = result.display_name.split(',').slice(0, 2).join(',').trim()
                    const details = result.display_name.split(',').slice(2, 4).join(',').trim()
                    return (
                      <button
                        key={`${result.place_id}-${idx}`}
                        onClick={() => selectDestination(parseFloat(result.lat), parseFloat(result.lon), shortName)}
                        className="w-full text-left px-4 py-3 hover:bg-muted/60 transition-colors border-b border-border/30 last:border-0"
                      >
                        <p className="text-xs font-medium text-foreground line-clamp-1">{shortName}</p>
                        {details && (
                          <p className="text-[10px] text-muted-foreground line-clamp-1 mt-0.5">{details}</p>
                        )}
                      </button>
                    )
                  })}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>

        {/* ── Quick Destinations ── */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
        >
          <ScrollArea className="w-full">
            <div className="flex gap-2 pb-2">
              {QUICK_DESTINATIONS.map((dest) => (
                <button
                  key={dest.id}
                  onClick={() => handleQuickDestination(dest)}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all border ${
                    destination?.lat === dest.lat && destination?.lng === dest.lng
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-500/20'
                      : 'bg-card border-border hover:border-emerald-300 text-foreground'
                  }`}
                >
                  {dest.icon}
                  <span className="hidden sm:inline">{dest.label}</span>
                </button>
              ))}
            </div>
          </ScrollArea>
        </motion.div>

        {/* ── Map ── */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="h-[50vh] sm:h-[55vh] rounded-xl overflow-hidden border border-border/50"
        >
          <DynamicMovaMap
            pickup={origin ? { lat: origin.lat, lng: origin.lng, name: origin.name } : null}
            dropoff={destination ? { lat: destination.lat, lng: destination.lng, name: destination.name } : null}
            showZones={true}
            showRoute={!!(origin && destination)}
            interactive={true}
            showSearch={false}
            showLocate={false}
            showLayerToggle={true}
            showScale={true}
          />

          {/* Relocate button overlay */}
          <div className="absolute top-3 left-3 z-[1000]">
            <button
              onClick={handleRelocate}
              className="mova-glass rounded-xl shadow-md w-9 h-9 flex items-center justify-center hover:bg-white/90 dark:hover:bg-slate-800/90 transition-colors"
              title="Ma position"
            >
              <LocateFixed className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            </button>
          </div>

          {/* Routing loading overlay */}
          {isRouting && (
            <div className="absolute inset-0 z-[1000] bg-background/40 backdrop-blur-[1px] flex items-center justify-center rounded-xl">
              <div className="flex flex-col items-center gap-3 bg-background/90 px-6 py-4 rounded-2xl shadow-lg">
                <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
                <p className="text-sm font-medium">Calcul de l'itinéraire...</p>
              </div>
            </div>
          )}
        </motion.div>

        {/* ── Route Info ── */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
        >
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <Route className="h-4 w-4 text-emerald-600" />
                <h2 className="text-sm font-semibold">Itinéraire</h2>
                {hasRoute && (
                  <Badge variant="secondary" className="text-[10px] bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400 border-0 ml-auto">
                    Calculé
                  </Badge>
                )}
                {isRouting && (
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground ml-auto" />
                )}
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center">
                  <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                    <Route className="h-3 w-3" />
                    Distance
                  </p>
                  <p className="text-lg font-bold text-emerald-700 dark:text-emerald-400">
                    {hasRoute ? distanceStr : '-- km'}
                  </p>
                </div>
                <div className="text-center border-x border-border/50">
                  <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                    <Clock className="h-3 w-3" />
                    Durée
                  </p>
                  <p className="text-lg font-bold text-emerald-700 dark:text-emerald-400">
                    {hasRoute ? durationStr : '-- min'}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                    <Navigation className="h-3 w-3" />
                    Arrivée
                  </p>
                  <p className="text-lg font-bold text-emerald-700 dark:text-emerald-400">
                    {hasRoute ? arrivalTime : '--:--'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* ── Transport Mode Selector ── */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card>
            <CardContent className="p-4">
              <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <Footprints className="h-4 w-4 text-emerald-600" />
                Mode de transport
              </h2>
              <div className="grid grid-cols-3 gap-2">
                {TRANSPORT_MODES.map((mode) => (
                  <button
                    key={mode.id}
                    onClick={() => handleModeChange(mode.id)}
                    disabled={isRouting}
                    className={`flex flex-col items-center gap-2 p-3 rounded-xl text-xs font-medium transition-all border ${
                      selectedMode === mode.id
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-500/20'
                        : 'bg-card border-border hover:border-emerald-300 text-foreground disabled:opacity-50'
                    }`}
                  >
                    {mode.icon}
                    <span>{mode.label}</span>
                    {selectedMode === mode.id && modeDurationStr && (
                      <span className="text-[9px] text-emerald-100">{modeDurationStr}</span>
                    )}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* ── Turn-by-turn Instructions ── */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
        >
          <Card>
            <CardContent className="p-4">
              <button
                className="w-full flex items-center justify-between"
                onClick={() => setShowInstructions(!showInstructions)}
                disabled={!hasRoute}
              >
                <div className="flex items-center gap-2">
                  <Volume2 className="h-4 w-4 text-emerald-600" />
                  <h2 className="text-sm font-semibold">Instructions</h2>
                  {hasRoute && (
                    <Badge variant="secondary" className="text-[10px]">{instructionCount} étapes</Badge>
                  )}
                  {!hasRoute && !isRouting && destination && (
                    <span className="text-[10px] text-muted-foreground">Sélectionnez un trajet</span>
                  )}
                </div>
                {hasRoute && (
                  <ChevronRight className={`h-4 w-4 transition-transform ${showInstructions ? 'rotate-90' : ''}`} />
                )}
              </button>

              <AnimatePresence>
                {showInstructions && routeData && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="mt-3 space-y-0 max-h-64 overflow-y-auto mova-scrollbar">
                      {routeData.instructions.map((step, idx) => (
                        <div key={step.id}>
                          <div className="flex items-center gap-3 py-2.5">
                            <div className="flex items-center justify-center w-6 h-6 rounded-full bg-muted shrink-0">
                              {step.icon}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium leading-relaxed">{step.text}</p>
                            </div>
                            {step.distance && (
                              <span className="text-[10px] text-muted-foreground shrink-0 font-medium">
                                {step.distance}
                              </span>
                            )}
                          </div>
                          {idx < routeData.instructions.length - 1 && (
                            <Separator className="ml-8" />
                          )}
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </CardContent>
          </Card>
        </motion.div>

        {/* ── Start Navigation Button ── */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Button
            className="w-full bg-emerald-600 hover:bg-emerald-700 h-14 text-base font-semibold mova-gradient gap-2"
            onClick={handleStartNavigation}
            disabled={!hasRoute}
          >
            <Navigation className="h-5 w-5" />
            {hasRoute
              ? `Commencer la navigation — ${arrivalTime}`
              : destination
                ? 'Calcul en cours...'
                : 'Sélectionnez une destination'
            }
          </Button>
        </motion.div>
      </div>
    </div>
  )
}
