'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useAppStore } from '@/lib/mova/store'
import { StatCardSkeleton, StatGridSkeleton, TableSkeleton } from '@/components/mova/mova-skeletons'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

// shadcn/ui
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Progress } from '@/components/ui/progress'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

// Lucide icons
import {
  Activity,
  ArrowLeft,
  Database,
  HardDrive,
  ShieldCheck,
  Layers,
  Clock,
  Server,
  Cpu,
  Users,
  Car,
  Wallet,
  ArrowLeftRight,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  XCircle,
  Loader2,
  RotateCcw,
  Zap,
  Timer,
  MemoryStick,
} from 'lucide-react'

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

interface HealthData {
  status: 'healthy' | 'degraded' | 'unhealthy'
  timestamp: string
  uptime: number
  version: string
  environment: string
  checks: {
    database: { status: string; latencyMs: number }
    cache: { status: string; keys: number; hitRate: string }
    rateLimit: { status: string; totalChecks: number; totalBlocked: number }
    jobQueue: { status: string; pending: number; processing: number; failed: number }
    memory: { usedMB: number; totalMB: number; percentage: number }
  }
}

interface MonitoringData {
  success: boolean
  data: {
    system: {
      uptime: number
      memory: { usedMB: number; totalMB: number; rssMB: number }
      nodeVersion: string
      platform: string
      pid: number
    }
    database: {
      status: string
      totalUsers: number
      totalRides: number
      totalWallets: number
      totalTransactions: number
      totalDeliveries: number
      totalBookings: number
      totalIncidents: number
    }
    cache: {
      keys: number
      hits: number
      misses: number
      hitRate: string
      topKeys: string[]
    }
    rateLimit: {
      totalChecks: number
      totalBlocked: number
      activeLimits: number
      totalBanned: number
      topViolators: Array<{ identifier: string; violations: number; banCount: number }>
    }
    jobQueue: {
      stats: { pending: number; processing: number; completed: number; failed: number; total: number }
      recentFailed: Array<{ id: string; type: string; error: string | null; createdAt: number }>
      processing: Array<{ id: string; type: string; attempts: number }>
    }
    api: {
      recentErrors: Array<{
        id: string
        level: string
        message: string
        path: string
        method: string
        userId: string | null
        timestamp: string
        context: Record<string, unknown> | null
      }>
      slowEndpoints: Array<{ path: string; method: string; avgMs: number; calls: number }>
      loggerStats: { total: number; errors: number; warnings: number }
    }
    notifications: { sent: number; failed: number; subscribed: number }
    generatedAt: string
    responseTimeMs: number
  }
}

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const parts: string[] = []
  if (days > 0) parts.push(`${days}j`)
  if (hours > 0) parts.push(`${hours}h`)
  parts.push(`${minutes}min`)
  return parts.join(' ')
}

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

function timeAgo(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (diff < 5) return "À l'instant"
  if (diff < 60) return `il y a ${diff}s`
  if (diff < 3600) return `il y a ${Math.floor(diff / 60)}min`
  return `il y a ${Math.floor(diff / 3600)}h`
}

function getStatusColor(status: string): string {
  if (status === 'up' || status === 'healthy') return 'bg-emerald-500'
  if (status === 'degraded') return 'bg-amber-500'
  return 'bg-red-500'
}

function getStatusBadge(status: string): { label: string; className: string } {
  if (status === 'up' || status === 'healthy') {
    return { label: 'Opérationnel', className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' }
  }
  if (status === 'degraded') {
    return { label: 'Dégradé', className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' }
  }
  return { label: 'Hors ligne', className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' }
}

// ──────────────────────────────────────────────
// Main Component
// ──────────────────────────────────────────────

export default function AdminMonitoringView() {
  const { goBack, user } = useAppStore()

  // Data state
  const [healthData, setHealthData] = useState<HealthData | null>(null)
  const [monitoringData, setMonitoringData] = useState<MonitoringData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastHealthRefresh, setLastHealthRefresh] = useState<string>(new Date().toISOString())
  const [lastMonitoringRefresh, setLastMonitoringRefresh] = useState<string>(new Date().toISOString())

  // Time ago counter
  const [now, setNow] = useState(Date.now())
  const nowRef = useRef(now)
  nowRef.current = now

  // Tick every second for "time ago" display
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(interval)
  }, [])

  // ── Fetch functions ──

  const fetchHealth = useCallback(async () => {
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (user?.role) headers['x-user-role'] = user.role

      const res = await fetch('/api/mova/health', { headers })
      if (!res.ok) throw new Error(`Erreur ${res.status}`)
      const data = await res.json()
      setHealthData(data)
      setLastHealthRefresh(new Date().toISOString())
    } catch {
      // Silently fail for health — it's non-critical
    }
  }, [user?.role])

  const fetchMonitoring = useCallback(async () => {
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      
      if (user?.role) headers['x-user-role'] = user.role

      const res = await fetch('/api/mova/admin/monitoring', { headers })
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        throw new Error(body?.error || `Erreur ${res.status}`)
      }
      const data = await res.json()
      setMonitoringData(data)
      setLastMonitoringRefresh(new Date().toISOString())
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de chargement')
    } finally {
      setIsLoading(false)
    }
  }, [user?.role])

  // ── Initial load + polling ──

  useEffect(() => {
    // Initial load
    fetchHealth()
    fetchMonitoring()

    // Polling intervals
    const healthInterval = setInterval(fetchHealth, 10000) // every 10s
    const monitoringInterval = setInterval(fetchMonitoring, 30000) // every 30s

    return () => {
      clearInterval(healthInterval)
      clearInterval(monitoringInterval)
    }
  }, [fetchHealth, fetchMonitoring])

  // ── Refresh handler ──

  const handleRefresh = () => {
    setIsLoading(true)
    setError(null)
    fetchHealth()
    fetchMonitoring()
  }

  // ── Retry failed jobs ──

  const handleRetryAllFailed = async () => {
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      
      if (user?.role) headers['x-user-role'] = user.role

      const res = await fetch('/api/mova/admin/monitoring/retry-failed', {
        method: 'POST',
        headers,
      })
      if (res.ok) {
        toast.success('Toutes les tâches échouées ont été relancées')
      } else {
        toast.error("Impossible de relancer les tâches échouées")
      }
    } catch {
      toast.error('Erreur lors de la relance des tâches')
    }
  }

  // ── Loading skeleton ──

  if (isLoading && !monitoringData) {
    return (
      <div className="min-h-screen bg-muted/30">
        {/* Header skeleton */}
        <div className="sticky top-0 z-10 bg-card/95 backdrop-blur border-b px-4 md:px-6 py-4">
          <div className="max-w-7xl mx-auto flex items-center gap-4">
            <div className="h-10 w-10 rounded-xl bg-muted animate-pulse" />
            <div className="space-y-2">
              <div className="h-5 w-40 rounded-lg bg-muted animate-pulse" />
              <div className="h-3 w-24 rounded-md bg-muted animate-pulse" />
            </div>
          </div>
        </div>
        <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
          <StatGridSkeleton count={4} />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-xl border bg-card p-6 space-y-4">
              <div className="h-5 w-32 rounded-lg bg-muted animate-pulse" />
              <div className="h-4 w-full rounded bg-muted animate-pulse" />
              <div className="h-4 w-3/4 rounded bg-muted animate-pulse" />
            </div>
            <div className="rounded-xl border bg-card p-6 space-y-4">
              <div className="h-5 w-32 rounded-lg bg-muted animate-pulse" />
              <div className="h-4 w-full rounded bg-muted animate-pulse" />
              <div className="h-4 w-2/3 rounded bg-muted animate-pulse" />
            </div>
          </div>
          <StatGridSkeleton count={4} />
          <TableSkeleton rows={5} cols={5} />
        </div>
      </div>
    )
  }

  // ── Error state ──

  if (error && !monitoringData) {
    return (
      <div className="min-h-screen bg-muted/30 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center space-y-4">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/20">
              <AlertCircle className="h-7 w-7 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold">Erreur de chargement</h3>
              <p className="text-sm text-muted-foreground mt-1">{error}</p>
            </div>
            <Button onClick={handleRefresh} className="gap-2">
              <RefreshCw className="h-4 w-4" />
              Réessayer
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const d = monitoringData?.data
  const h = healthData

  // ──────────────────────────────────────────────
  // Render
  // ──────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-muted/30">
      {/* ═══ 1. HEADER BAR ═══ */}
      <div className="sticky top-0 z-10 bg-card/95 backdrop-blur border-b">
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 shrink-0"
              onClick={goBack}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-900/30">
                <Activity className="h-4.5 w-4.5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <h1 className="text-lg font-bold mova-gradient-text leading-tight">MOVA Monitoring</h1>
                <p className="text-[11px] text-muted-foreground">Surveillance système en temps réel</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Overall status badge */}
            {h && (
              <Badge
                variant="secondary"
                className={cn(
                  'hidden sm:flex items-center gap-1.5 text-xs font-medium',
                  getStatusBadge(h.status).className
                )}
              >
                <span className={cn('h-1.5 w-1.5 rounded-full', getStatusColor(h.status))} />
                {getStatusBadge(h.status).label}
              </Badge>
            )}

            {/* Auto-refresh badge */}
            <Badge variant="outline" className="hidden md:flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              Actualisé {timeAgo(lastMonitoringRefresh)}
            </Badge>

            {/* Manual refresh */}
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={handleRefresh}
            >
              <RefreshCw className={cn('h-4 w-4', isLoading && 'animate-spin')} />
            </Button>
          </div>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">

          {/* ═══ 2. SYSTEM STATUS CARDS ═══ */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Database */}
            <Card className="mova-card-hover">
              <CardContent className="p-4 md:p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-900/30">
                    <Database className="h-4.5 w-4.5 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className={cn('h-2 w-2 rounded-full', getStatusColor(h?.checks?.database?.status || 'up'))} />
                    <span className="text-[11px] text-muted-foreground">Base de données</span>
                  </div>
                </div>
                <p className="text-xl font-bold">{h?.checks?.database?.latencyMs ?? 0}<span className="text-sm font-normal text-muted-foreground ml-1">ms</span></p>
                <p className="text-xs text-muted-foreground mt-0.5">Latence de requête</p>
              </CardContent>
            </Card>

            {/* Cache */}
            <Card className="mova-card-hover">
              <CardContent className="p-4 md:p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-100 dark:bg-amber-900/30">
                    <HardDrive className="h-4.5 w-4.5 text-amber-600 dark:text-amber-400" />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className={cn('h-2 w-2 rounded-full', getStatusColor(h?.checks?.cache?.status || 'up'))} />
                    <span className="text-[11px] text-muted-foreground">Cache</span>
                  </div>
                </div>
                <p className="text-xl font-bold">{d?.cache?.keys ?? 0}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Clés en cache</p>
                <div className="mt-2 space-y-1">
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                    <span>Taux de succès</span>
                    <span className="font-medium">{d?.cache?.hitRate ?? '0%'}</span>
                  </div>
                  <Progress value={parseFloat(String(d?.cache?.hitRate ?? '0'))} className="h-1.5" />
                </div>
              </CardContent>
            </Card>

            {/* Rate Limiter */}
            <Card className="mova-card-hover">
              <CardContent className="p-4 md:p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-900/30">
                    <ShieldCheck className="h-4.5 w-4.5 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className={cn('h-2 w-2 rounded-full', getStatusColor(h?.checks?.rateLimit?.status || 'up'))} />
                    <span className="text-[11px] text-muted-foreground">Rate Limiter</span>
                  </div>
                </div>
                <p className="text-xl font-bold">{d?.rateLimit?.totalChecks ?? h?.checks?.rateLimit?.totalChecks ?? 0}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Vérifications totales</p>
                <div className="mt-2 flex items-center gap-2 text-xs">
                  <Badge variant="secondary" className="bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400 text-[10px] px-1.5 py-0">
                    <XCircle className="h-2.5 w-2.5 mr-0.5" />
                    {d?.rateLimit?.totalBlocked ?? h?.checks?.rateLimit?.totalBlocked ?? 0} bloquées
                  </Badge>
                </div>
              </CardContent>
            </Card>

            {/* Job Queue */}
            <Card className="mova-card-hover">
              <CardContent className="p-4 md:p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-100 dark:bg-amber-900/30">
                    <Layers className="h-4.5 w-4.5 text-amber-600 dark:text-amber-400" />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className={cn('h-2 w-2 rounded-full', getStatusColor(h?.checks?.jobQueue?.status || 'up'))} />
                    <span className="text-[11px] text-muted-foreground">File de tâches</span>
                  </div>
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-xl font-bold">{h?.checks?.jobQueue?.pending ?? 0}</span>
                  <span className="text-sm text-amber-600 dark:text-amber-400">en attente</span>
                </div>
                <div className="mt-1.5 flex items-center gap-2 text-[11px] text-muted-foreground">
                  <span>{h?.checks?.jobQueue?.processing ?? 0} en cours</span>
                  <span>·</span>
                  <span className="text-red-600 dark:text-red-400">{h?.checks?.jobQueue?.failed ?? 0} échouées</span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* ═══ 3. MEMORY & RESOURCES + SYSTEM INFO ═══ */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Memory Card */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
                    <Cpu className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div>
                    <CardTitle className="text-sm font-semibold">Mémoire & Ressources</CardTitle>
                    <CardDescription className="text-[11px]">Utilisation du tas Node.js</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Memory bar */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Heap utilisé</span>
                    <span className="font-semibold">
                      {h?.checks?.memory?.usedMB ?? d?.system?.memory?.usedMB ?? 0} / {h?.checks?.memory?.totalMB ?? d?.system?.memory?.totalMB ?? 0} Mo
                    </span>
                  </div>
                  <Progress value={h?.checks?.memory?.percentage ?? 0} className="h-2.5" />
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                    <span>RSS: {d?.system?.memory?.rssMB ?? 0} Mo</span>
                    <span>{h?.checks?.memory?.percentage ?? 0}%</span>
                  </div>
                </div>

                <Separator />

                {/* System info grid */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex items-center gap-2 text-sm">
                    <Timer className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div>
                      <p className="font-medium text-xs">{formatUptime(h?.uptime ?? d?.system?.uptime ?? 0)}</p>
                      <p className="text-[10px] text-muted-foreground">Disponibilité</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Server className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div>
                      <p className="font-medium text-xs">{d?.system?.nodeVersion ?? h?.version ?? '-'}</p>
                      <p className="text-[10px] text-muted-foreground">Node.js</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Cpu className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div>
                      <p className="font-medium text-xs">{d?.system?.platform ?? '-'}</p>
                      <p className="text-[10px] text-muted-foreground">Plateforme</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Zap className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div>
                      <p className="font-medium text-xs">{h?.environment ?? 'development'}</p>
                      <p className="text-[10px] text-muted-foreground">Environnement</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Notification Stats */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900/30">
                    <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                  </div>
                  <div>
                    <CardTitle className="text-sm font-semibold">Statistiques API</CardTitle>
                    <CardDescription className="text-[11px]">Journal des erreurs & endpoints lents</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Error logger stats */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="text-center p-2 rounded-lg bg-muted/50">
                    <p className="text-lg font-bold">{d?.api?.loggerStats?.errors ?? 0}</p>
                    <p className="text-[10px] text-red-600 dark:text-red-400 font-medium">Erreurs</p>
                  </div>
                  <div className="text-center p-2 rounded-lg bg-muted/50">
                    <p className="text-lg font-bold">{d?.api?.loggerStats?.warnings ?? 0}</p>
                    <p className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">Avertissements</p>
                  </div>
                  <div className="text-center p-2 rounded-lg bg-muted/50">
                    <p className="text-lg font-bold">{d?.api?.loggerStats?.total ?? 0}</p>
                    <p className="text-[10px] text-muted-foreground font-medium">Total logs</p>
                  </div>
                </div>

                <Separator />

                {/* Notifications */}
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">Notifications</p>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Envoyées</span>
                    <span className="font-medium">{d?.notifications?.sent ?? 0}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Échouées</span>
                    <span className="font-medium text-red-600 dark:text-red-400">{d?.notifications?.failed ?? 0}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Abonnés</span>
                    <span className="font-medium">{d?.notifications?.subscribed ?? 0}</span>
                  </div>
                </div>

                {/* Response time */}
                <Separator />
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Temps de réponse API</span>
                  <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 text-xs">
                    <Clock className="h-3 w-3 mr-1" />
                    {d?.responseTimeMs ?? 0}ms
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* ═══ 4. DATABASE STATS ═══ */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Database className="h-4.5 w-4.5 text-muted-foreground" />
              <h2 className="text-sm font-semibold">Statistiques de la base de données</h2>
              <Badge variant="secondary" className={cn('ml-auto text-[10px]', getStatusBadge(d?.database?.status || 'up').className)}>
                {getStatusBadge(d?.database?.status || 'up').label}
              </Badge>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              <Card className="mova-card-hover">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Users className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    <span className="text-xs text-muted-foreground">Utilisateurs</span>
                  </div>
                  <p className="text-2xl font-bold">{d?.database?.totalUsers ?? 0}</p>
                </CardContent>
              </Card>
              <Card className="mova-card-hover">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Car className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                    <span className="text-xs text-muted-foreground">Courses</span>
                  </div>
                  <p className="text-2xl font-bold">{d?.database?.totalRides ?? 0}</p>
                </CardContent>
              </Card>
              <Card className="mova-card-hover">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Wallet className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    <span className="text-xs text-muted-foreground">Portefeuilles</span>
                  </div>
                  <p className="text-2xl font-bold">{d?.database?.totalWallets ?? 0}</p>
                </CardContent>
              </Card>
              <Card className="mova-card-hover">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <ArrowLeftRight className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                    <span className="text-xs text-muted-foreground">Transactions</span>
                  </div>
                  <p className="text-2xl font-bold">{d?.database?.totalTransactions ?? 0}</p>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* ═══ 5. RECENT ERRORS LOG ═══ */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-100 dark:bg-red-900/20">
                  <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
                </div>
                <div className="flex-1">
                  <CardTitle className="text-sm font-semibold">Journal des erreurs récentes</CardTitle>
                  <CardDescription className="text-[11px]">
                    {(d?.api?.recentErrors?.length ?? 0)} entrée(s)
                  </CardDescription>
                </div>
                {d?.api?.loggerStats?.errors === 0 && (
                  <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 text-[10px]">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Aucune erreur
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {d?.api?.recentErrors && d.api.recentErrors.length > 0 ? (
                <ScrollArea className="max-h-80">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-[11px] w-40">Horodatage</TableHead>
                        <TableHead className="text-[11px] w-20">Niveau</TableHead>
                        <TableHead className="text-[11px]">Message</TableHead>
                        <TableHead className="text-[11px] w-48 hidden md:table-cell">Chemin</TableHead>
                        <TableHead className="text-[11px] w-20 hidden sm:table-cell">Méthode</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {d.api.recentErrors.map((err) => (
                        <TableRow key={err.id} className="text-xs">
                          <TableCell className="py-2 text-[11px] text-muted-foreground whitespace-nowrap">
                            {formatTimestamp(err.timestamp)}
                          </TableCell>
                          <TableCell className="py-2">
                            <Badge
                              variant="secondary"
                              className={cn(
                                'text-[10px] px-1.5 py-0',
                                err.level === 'error'
                                  ? 'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400'
                                  : 'bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400'
                              )}
                            >
                              {err.level === 'error' ? (
                                <AlertCircle className="h-2.5 w-2.5 mr-0.5" />
                              ) : (
                                <AlertTriangle className="h-2.5 w-2.5 mr-0.5" />
                              )}
                              {err.level === 'error' ? 'Erreur' : 'Attention'}
                            </Badge>
                          </TableCell>
                          <TableCell className="py-2 max-w-xs truncate text-[11px]">
                            {err.message}
                          </TableCell>
                          <TableCell className="py-2 max-w-xs truncate text-[11px] text-muted-foreground hidden md:table-cell">
                            {err.path}
                          </TableCell>
                          <TableCell className="py-2 hidden sm:table-cell">
                            <Badge variant="outline" className="text-[10px] font-mono">
                              {err.method}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              ) : (
                <div className="py-12 text-center">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/20 mb-3">
                    <CheckCircle2 className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <p className="text-sm font-medium">Aucune erreur récente</p>
                  <p className="text-xs text-muted-foreground mt-1">Le système fonctionne normalement</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* ═══ 6. JOB QUEUE DETAILS ═══ */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900/30">
                  <Layers className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                </div>
                <div className="flex-1">
                  <CardTitle className="text-sm font-semibold">File de tâches</CardTitle>
                  <CardDescription className="text-[11px]">
                    {d?.jobQueue?.stats?.total ?? 0} tâche(s) au total
                  </CardDescription>
                </div>
                {(d?.jobQueue?.stats?.failed ?? 0) > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 text-xs text-red-600 border-red-200 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20"
                    onClick={handleRetryAllFailed}
                  >
                    <RotateCcw className="h-3 w-3" />
                    Relancer les échouées
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Job queue stats grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="text-center p-3 rounded-lg bg-muted/50 space-y-1">
                  <div className="flex items-center justify-center gap-1.5">
                    <Clock className="h-3.5 w-3.5 text-amber-500" />
                    <span className="text-lg font-bold">{d?.jobQueue?.stats?.pending ?? 0}</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">En attente</p>
                </div>
                <div className="text-center p-3 rounded-lg bg-muted/50 space-y-1">
                  <div className="flex items-center justify-center gap-1.5">
                    <Loader2 className="h-3.5 w-3.5 text-emerald-500" />
                    <span className="text-lg font-bold">{d?.jobQueue?.stats?.processing ?? 0}</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">En cours</p>
                </div>
                <div className="text-center p-3 rounded-lg bg-muted/50 space-y-1">
                  <div className="flex items-center justify-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                    <span className="text-lg font-bold">{d?.jobQueue?.stats?.completed ?? 0}</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">Terminées</p>
                </div>
                <div className="text-center p-3 rounded-lg bg-muted/50 space-y-1">
                  <div className="flex items-center justify-center gap-1.5">
                    <XCircle className="h-3.5 w-3.5 text-red-500" />
                    <span className="text-lg font-bold">{d?.jobQueue?.stats?.failed ?? 0}</span>
                  </div>
                  <p className="text-[10px] text-red-600 dark:text-red-400 font-medium uppercase tracking-wide">Échouées</p>
                </div>
              </div>

              {/* Currently processing */}
              {d?.jobQueue?.processing && d.jobQueue.processing.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">Tâches en cours de traitement</p>
                  <div className="space-y-1.5">
                    {d.jobQueue.processing.map((job) => (
                      <div key={job.id} className="flex items-center justify-between rounded-lg bg-muted/30 px-3 py-2 text-xs">
                        <div className="flex items-center gap-2">
                          <Loader2 className="h-3.5 w-3.5 text-emerald-500 animate-spin" />
                          <span className="font-medium font-mono text-[11px]">{job.type}</span>
                        </div>
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <span className="text-[11px]">Tentative {job.attempts}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Recent failed jobs */}
              {d?.jobQueue?.recentFailed && d.jobQueue.recentFailed.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-red-600 dark:text-red-400">Tâches récemment échouées</p>
                  <ScrollArea className="max-h-48">
                    <div className="space-y-1.5">
                      {d.jobQueue.recentFailed.map((job) => (
                        <div key={job.id} className="rounded-lg bg-red-50 dark:bg-red-900/10 px-3 py-2.5 space-y-1">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <XCircle className="h-3.5 w-3.5 text-red-500 shrink-0" />
                              <span className="font-medium font-mono text-xs">{job.type}</span>
                            </div>
                            <span className="text-[10px] text-muted-foreground">
                              {new Date(job.createdAt).toLocaleString('fr-FR', {
                                day: '2-digit', month: 'short',
                                hour: '2-digit', minute: '2-digit',
                              })}
                            </span>
                          </div>
                          {job.error && (
                            <p className="text-[11px] text-red-600/70 dark:text-red-400/70 pl-5 truncate">
                              {job.error}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              )}

              {/* Empty state */}
              {(!d?.jobQueue?.recentFailed || d.jobQueue.recentFailed.length === 0) &&
               (!d?.jobQueue?.processing || d.jobQueue.processing.length === 0) && (
                <div className="py-6 text-center">
                  <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">Toutes les tâches sont terminées avec succès</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* ═══ SLOW ENDPOINTS (if any) ═══ */}
          {d?.api?.slowEndpoints && d.api.slowEndpoints.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900/30">
                    <Timer className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                  </div>
                  <div>
                    <CardTitle className="text-sm font-semibold">Endpoints lents</CardTitle>
                    <CardDescription className="text-[11px]">Temps de réponse moyen élevé</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="max-h-48">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-[11px]">Endpoint</TableHead>
                        <TableHead className="text-[11px] w-20">Méthode</TableHead>
                        <TableHead className="text-[11px] w-24">Temps moy.</TableHead>
                        <TableHead className="text-[11px] w-20">Appels</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {d.api.slowEndpoints.map((ep, i) => (
                        <TableRow key={i} className="text-xs">
                          <TableCell className="py-2 text-[11px] font-mono truncate max-w-xs">
                            {ep.path}
                          </TableCell>
                          <TableCell className="py-2">
                            <Badge variant="outline" className="text-[10px] font-mono">
                              {ep.method}
                            </Badge>
                          </TableCell>
                          <TableCell className="py-2">
                            <Badge
                              variant="secondary"
                              className={cn(
                                'text-[10px]',
                                ep.avgMs > 1000
                                  ? 'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400'
                                  : ep.avgMs > 500
                                    ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400'
                                    : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                              )}
                            >
                              {Math.round(ep.avgMs)}ms
                            </Badge>
                          </TableCell>
                          <TableCell className="py-2 text-[11px] text-muted-foreground">
                            {ep.calls}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </CardContent>
            </Card>
          )}

          {/* Footer timestamp */}
          <div className="text-center py-4 text-[11px] text-muted-foreground space-y-0.5">
            <p>Dernière actualisation : {formatTimestamp(lastMonitoringRefresh)}</p>
            {d?.system && (
              <p>Version {h?.version ?? '1.0.0'} · PID {d.system.pid} · {d.system.platform}</p>
            )}
          </div>
        </div>
      </ScrollArea>
    </div>
  )
}
