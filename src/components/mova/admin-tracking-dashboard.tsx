'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/lib/mova/store'

// shadcn/ui
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'

// Lucide icons
import {
  Radio,
  Users,
  Car,
  MapPin,
  Clock,
  RefreshCw,
  AlertCircle,
  Wifi,
  WifiOff,
  Loader2,
  Activity,
  User,
  Navigation,
  Zap,
  Timer,
  ChevronRight,
  Signal,
} from 'lucide-react'

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

interface TrackingDriver {
  driverId: string
  isOnline: boolean
  zone: string
  lastLocationUpdate: number
  hasActiveRide: boolean
}

interface TrackingPassenger {
  passengerId: string
  hasActiveRide: boolean
}

interface TrackingRide {
  rideId: string
  driverId: string
  passengerId: string
  status: 'accepted' | 'in_progress' | 'completed'
  pickupZone: string
  dropoffZone: string
  startedAt: number | null
}

interface TrackingStatsResponse {
  success: boolean
  data?: {
    timestamp: number
    uptime: number
    connectedDrivers: {
      count: number
      list: TrackingDriver[]
    }
    connectedPassengers: {
      count: number
      list: TrackingPassenger[]
    }
    activeRides: {
      count: number
      list: TrackingRide[]
    }
    pendingRides: {
      count: number
    }
    zones: Record<string, number>
    isShuttingDown: boolean
  }
  error?: string
  code?: string
}

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

function formatUptime(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const parts: string[] = []
  if (hours > 0) parts.push(`${hours}h`)
  parts.push(`${minutes}min`)
  return parts.join(' ')
}

function timeAgo(timestamp: number): string {
  const diff = Math.floor((Date.now() - timestamp) / 1000)
  if (diff < 5) return "À l'instant"
  if (diff < 60) return `il y a ${diff}s`
  if (diff < 3600) return `il y a ${Math.floor(diff / 60)}min`
  return `il y a ${Math.floor(diff / 3600)}h`
}

function timeAgoShort(timestamp: number): string {
  const diff = Math.floor((Date.now() - timestamp) / 1000)
  if (diff < 60) return `${diff}s`
  if (diff < 3600) return `${Math.floor(diff / 60)}min`
  return `${Math.floor(diff / 3600)}h`
}

function getRideStatusLabel(status: string): { label: string; className: string } {
  switch (status) {
    case 'accepted':
      return {
        label: 'Acceptée',
        className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
      }
    case 'in_progress':
      return {
        label: 'En cours',
        className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
      }
    case 'completed':
      return {
        label: 'Terminée',
        className: 'bg-gray-100 text-gray-600 dark:bg-gray-800/50 dark:text-gray-400',
      }
    default:
      return {
        label: status,
        className: 'bg-gray-100 text-gray-600',
      }
  }
}

function getDriverName(driverId: string): string {
  // Extract a readable name from driver ID (e.g. "driver_abc123" -> "Abc123")
  const parts = driverId.replace(/driver_/i, '').split('_')
  if (parts.length > 0 && parts[0].length >= 3) {
    const name = parts[0].charAt(0).toUpperCase() + parts[0].slice(1, 6)
    return name
  }
  return driverId.slice(0, 8)
}

// ──────────────────────────────────────────────
// Stat Card Sub-component
// ──────────────────────────────────────────────

function StatCard({
  value,
  label,
  icon: Icon,
  iconBg,
  iconColor,
  subtitle,
}: {
  value: number | string
  label: string
  icon: React.ElementType
  iconBg: string
  iconColor: string
  subtitle?: string
}) {
  return (
    <Card className="mova-card-hover">
      <CardContent className="p-4 md:p-5">
        <div className="flex items-center justify-between mb-3">
          <div className={cn('flex h-10 w-10 items-center justify-center rounded-xl', iconBg)}>
            <Icon className={cn('h-5 w-5', iconColor)} />
          </div>
        </div>
        <p className="text-2xl font-bold tabular-nums">{value}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
        {subtitle && (
          <p className="text-[10px] text-muted-foreground mt-1">{subtitle}</p>
        )}
      </CardContent>
    </Card>
  )
}

// ──────────────────────────────────────────────
// Main Component
// ──────────────────────────────────────────────

export default function AdminTrackingDashboard() {
  const { user } = useAppStore()

  // Data state
  const [stats, setStats] = useState<TrackingStatsResponse['data'] | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'error' | 'loading'>('loading')
  const [lastRefresh, setLastRefresh] = useState<number>(Date.now())
  const [refreshCount, setRefreshCount] = useState(0)

  // Time ago counter
  const [now, setNow] = useState(Date.now())
  const nowRef = useRef(now)
  nowRef.current = now

  // Tick every second for "time ago" display
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(interval)
  }, [])

  // ── Fetch function ──

  const fetchStats = useCallback(async () => {
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      }

      // Add auth header if token is available
      const token = localStorage.getItem('mova_token')
      if (token) {
        headers['Authorization'] = `Bearer ${token}`
      }
      // Fallback: pass role header for demo mode
      if (user?.role) {
        headers['x-user-role'] = user.role
      }

      const res = await fetch('/api/mova/admin/tracking-stats', { headers })

      if (!res.ok) {
        const body = await res.json().catch(() => null)
        throw new Error(body?.error || `Erreur ${res.status}`)
      }

      const data: TrackingStatsResponse = await res.json()

      if (data.success && data.data) {
        setStats(data.data)
        setError(null)
        setConnectionStatus('connected')
      } else {
        setError(data.error || 'Données indisponibles')
        setConnectionStatus('error')
      }

      setLastRefresh(Date.now())
      setRefreshCount((prev) => prev + 1)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur de chargement'
      setError(message)
      setConnectionStatus('error')
    } finally {
      setIsLoading(false)
    }
  }, [user?.role])

  // ── Initial load + polling (every 5 seconds) ──

  useEffect(() => {
    fetchStats()

    const interval = setInterval(fetchStats, 5000)

    return () => {
      clearInterval(interval)
    }
  }, [fetchStats])

  // ── Derived data ──

  const onlineDrivers = stats?.connectedDrivers?.list?.filter((d) => d.isOnline) ?? []
  const totalOnlineDrivers = onlineDrivers.length
  const totalPassengers = stats?.connectedPassengers?.count ?? 0
  const activeRidesCount = stats?.activeRides?.count ?? 0
  const pendingRidesCount = stats?.pendingRides?.count ?? 0
  const zones = stats?.zones ?? {}
  const uptime = stats?.uptime ?? 0
  const isShuttingDown = stats?.isShuttingDown ?? false
  const activeRides = stats?.activeRides?.list ?? []

  // ── Loading state ──

  if (isLoading && !stats) {
    return (
      <div className="space-y-6">
        {/* Header skeleton */}
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-muted animate-pulse" />
          <div className="space-y-2">
            <div className="h-5 w-48 rounded-lg bg-muted animate-pulse" />
            <div className="h-3 w-32 rounded-md bg-muted animate-pulse" />
          </div>
        </div>

        {/* Stat cards skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-5 space-y-3">
                <div className="h-10 w-10 rounded-xl bg-muted animate-pulse" />
                <div className="h-8 w-16 rounded-lg bg-muted animate-pulse" />
                <div className="h-3 w-24 rounded-md bg-muted animate-pulse" />
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Content skeletons */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardContent className="p-6 space-y-4">
              <div className="h-5 w-32 rounded-lg bg-muted animate-pulse" />
              <div className="h-20 w-full rounded-lg bg-muted animate-pulse" />
              <div className="h-20 w-full rounded-lg bg-muted animate-pulse" />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6 space-y-4">
              <div className="h-5 w-40 rounded-lg bg-muted animate-pulse" />
              <div className="h-16 w-full rounded-lg bg-muted animate-pulse" />
              <div className="h-16 w-full rounded-lg bg-muted animate-pulse" />
              <div className="h-16 w-full rounded-lg bg-muted animate-pulse" />
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  // ── Render ──

  return (
    <div className="space-y-6">
      {/* ═══ Header ═══ */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-900/30">
            <Radio className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <h3 className="text-base font-semibold flex items-center gap-2">
              Tableau de Bord Temps Réel
              {isShuttingDown && (
                <Badge variant="secondary" className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 text-[10px]">
                  <AlertCircle className="h-3 w-3 mr-1" />
                  Arrêt en cours
                </Badge>
              )}
            </h3>
            <p className="text-xs text-muted-foreground">
              Service de suivi en temps réel
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Connection status */}
          <Badge
            variant="secondary"
            className={cn(
              'flex items-center gap-1.5 text-xs font-medium',
              connectionStatus === 'connected'
                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                : connectionStatus === 'error'
                  ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                  : 'bg-gray-100 text-gray-600 dark:bg-gray-800/50 dark:text-gray-400'
            )}
          >
            {connectionStatus === 'connected' ? (
              <Wifi className="h-3 w-3" />
            ) : connectionStatus === 'error' ? (
              <WifiOff className="h-3 w-3" />
            ) : (
              <Loader2 className="h-3 w-3 animate-spin" />
            )}
            {connectionStatus === 'connected' ? 'Connecté' : connectionStatus === 'error' ? 'Déconnecté' : 'Connexion...'}
          </Badge>

          {/* Auto-refresh indicator */}
          <Badge variant="outline" className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground">
            <RefreshCw className={cn('h-3 w-3', isLoading && 'animate-spin')} />
            Actualisé {timeAgoShort(lastRefresh)}
          </Badge>

          {/* Manual refresh */}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={fetchStats}
          >
            <RefreshCw className={cn('h-4 w-4', isLoading && 'animate-spin')} />
          </Button>
        </div>
      </div>

      {/* ═══ Error Banner ═══ */}
      {error && (
        <Card className="border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-900/30">
          <CardContent className="p-4 flex items-start gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-100 dark:bg-red-900/40 shrink-0 mt-0.5">
              <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-red-800 dark:text-red-300">
                Service indisponible
              </p>
              <p className="text-xs text-red-600/80 dark:text-red-400/80 mt-0.5">
                {error}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="shrink-0 border-red-300 text-red-700 hover:bg-red-100 dark:border-red-800 dark:text-red-400"
              onClick={fetchStats}
            >
              <RefreshCw className="h-3 w-3 mr-1" />
              Réessayer
            </Button>
          </CardContent>
        </Card>
      )}

      {/* ═══ KPI Cards ═══ */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          value={totalOnlineDrivers}
          label="Chauffeurs en ligne"
          icon={Car}
          iconBg="bg-emerald-100 dark:bg-emerald-900/30"
          iconColor="text-emerald-600 dark:text-emerald-400"
          subtitle={`${stats?.connectedDrivers?.count ?? 0} chauffeurs connectés`}
        />
        <StatCard
          value={totalPassengers}
          label="Passagers connectés"
          icon={Users}
          iconBg="bg-amber-100 dark:bg-amber-900/30"
          iconColor="text-amber-600 dark:text-amber-400"
        />
        <StatCard
          value={activeRidesCount}
          label="Courses actives"
          icon={Navigation}
          iconBg="bg-emerald-100 dark:bg-emerald-900/30"
          iconColor="text-emerald-600 dark:text-emerald-400"
          subtitle={pendingRidesCount > 0 ? `${pendingRidesCount} en attente` : undefined}
        />
      </div>

      {/* ═══ Zones + Active Rides ═══ */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Zones Card */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
                <MapPin className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div className="flex-1">
                <CardTitle className="text-sm font-semibold">Zones</CardTitle>
              </div>
              <Badge variant="secondary" className="text-[10px]">
                {Object.keys(zones).length} zones
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            {Object.keys(zones).length === 0 ? (
              <div className="py-6 text-center">
                <MapPin className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Aucun chauffeur en zone</p>
              </div>
            ) : (
              <div className="space-y-2">
                {Object.entries(zones)
                  .sort(([, a], [, b]) => b - a)
                  .map(([zone, count]) => {
                    const maxCount = Math.max(...Object.values(zones), 1)
                    const percentage = Math.round((count / maxCount) * 100)
                    return (
                      <div key={zone} className="flex items-center gap-3">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-muted/60 shrink-0">
                            <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-sm font-medium truncate">{zone}</span>
                              <span className="text-sm font-semibold tabular-nums ml-2">
                                {count}
                              </span>
                            </div>
                            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                              <div
                                className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all duration-500"
                                style={{ width: `${percentage}%` }}
                              />
                            </div>
                          </div>
                        </div>
                        <span className="text-[10px] text-muted-foreground shrink-0">
                          {count === 1 ? 'chauffeur' : 'chauffeurs'}
                        </span>
                      </div>
                    )
                  })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Active Rides Card */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900/30">
                <Car className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              </div>
              <div className="flex-1">
                <CardTitle className="text-sm font-semibold">Courses Actives</CardTitle>
              </div>
              <Badge variant="secondary" className="text-[10px]">
                {activeRidesCount} course{activeRidesCount !== 1 ? 's' : ''}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            {activeRides.length === 0 ? (
              <div className="py-6 text-center">
                <Car className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Aucune course active</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Les courses apparaîtront ici en temps réel
                </p>
              </div>
            ) : (
              <ScrollArea className="max-h-72">
                <div className="space-y-2">
                  {activeRides.map((ride) => {
                    const statusInfo = getRideStatusLabel(ride.status)
                    return (
                      <div
                        key={ride.rideId}
                        className="flex items-center gap-3 rounded-lg bg-muted/30 px-3 py-2.5"
                      >
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900/30 shrink-0">
                          <Navigation className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 text-xs font-mono text-muted-foreground">
                            <span className="truncate">{ride.rideId.slice(0, 16)}</span>
                          </div>
                          <div className="flex items-center gap-1.5 mt-0.5 text-sm">
                            <span className="truncate font-medium">{getDriverName(ride.driverId)}</span>
                            <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />
                            <span className="truncate text-muted-foreground">{ride.dropoffZone}</span>
                          </div>
                        </div>
                        <Badge
                          variant="secondary"
                          className={cn('text-[10px] shrink-0', statusInfo.className)}
                        >
                          {ride.status === 'in_progress' && (
                            <Activity className="h-2.5 w-2.5 mr-0.5" />
                          )}
                          {statusInfo.label}
                        </Badge>
                      </div>
                    )
                  })}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ═══ Connected Drivers List ═══ */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
              <Signal className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="flex-1">
              <CardTitle className="text-sm font-semibold">Chauffeurs Connectés</CardTitle>
            </div>
            <Badge variant="secondary" className="text-[10px]">
              {stats?.connectedDrivers?.count ?? 0} connecté{((stats?.connectedDrivers?.count ?? 0) !== 1) ? 's' : ''}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {(!stats?.connectedDrivers?.list || stats.connectedDrivers.list.length === 0) ? (
            <div className="py-6 text-center">
              <User className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Aucun chauffeur connecté</p>
            </div>
          ) : (
            <ScrollArea className="max-h-64">
              <div className="space-y-1.5">
                {stats.connectedDrivers.list.map((driver) => (
                  <div
                    key={driver.driverId}
                    className="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-muted/30 transition-colors"
                  >
                    {/* Online indicator */}
                    <div className="flex h-7 w-7 items-center justify-center rounded-full shrink-0">
                      <span
                        className={cn(
                          'h-2.5 w-2.5 rounded-full',
                          driver.isOnline
                            ? 'bg-emerald-500 shadow-sm shadow-emerald-500/30'
                            : 'bg-gray-400'
                        )}
                      />
                    </div>

                    {/* Driver info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium truncate">
                          {getDriverName(driver.driverId)}
                        </span>
                        {driver.hasActiveRide && (
                          <Badge
                            variant="secondary"
                            className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 text-[9px] px-1.5 py-0"
                          >
                            En course
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                        <span>{driver.zone}</span>
                        {driver.lastLocationUpdate > 0 && (
                          <>
                            <span className="text-muted-foreground/40">·</span>
                            <span>Position: {timeAgoShort(driver.lastLocationUpdate)}</span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Status badge */}
                    <Badge
                      variant="secondary"
                      className={cn(
                        'text-[10px] shrink-0',
                        driver.isOnline
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                          : 'bg-gray-100 text-gray-600 dark:bg-gray-800/50 dark:text-gray-400'
                      )}
                    >
                      {driver.isOnline ? 'En ligne' : 'Hors ligne'}
                    </Badge>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* ═══ Footer Info ═══ */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <Timer className="h-3.5 w-3.5" />
          <span>
            Uptime du service : <span className="font-medium tabular-nums">{formatUptime(uptime)}</span>
          </span>
          <span className="text-muted-foreground/40">|</span>
          <Clock className="h-3.5 w-3.5" />
          <span>
            Dernière MAJ : <span className="font-medium">{timeAgo(lastRefresh)}</span>
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <Zap className="h-3 w-3" />
          <span>Actualisation automatique toutes les 5 secondes</span>
        </div>
      </div>
    </div>
  )
}
