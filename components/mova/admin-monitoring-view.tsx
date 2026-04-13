'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useMovaStore } from '@/lib/store'
import { apiFetch } from '@/lib/api'
import {
  ArrowLeft,
  Activity,
  Server,
  Database,
  HardDrive,
  ShieldCheck,
  Layers,
  Clock,
  Cpu,
  Users,
  Car,
  Wallet,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  XCircle,
  Loader2,
  Zap,
  MemoryStick,
  TrendingUp,
  Eye,
} from 'lucide-react'

// --- Types ---

interface HealthData {
  status: string
  version: string
  timestamp: string
  uptime: { ms: number; seconds: number; formatted: string }
  database: { status: string; latencyMs: number }
  memory: { rss: string; heapTotal: string; heapUsed: string; external: string }
  runtime: string
  platform: string
}

interface MonitoringData {
  system: {
    uptime: { ms: number; seconds: number }
    runtime: string
    platform: string
    nodeEnv: string
    cpuCount: string
  }
  memory: {
    rss: number
    heapTotal: number
    heapUsed: number
    external: number
    arrayBuffers: number
  }
  cache: {
    hits: number
    misses: number
    keys: number
    hitRate: number
  }
  rateLimiter: {
    totalChecks: number
    totalBlocked: number
    topViolators: Array<{ identifier: string; violations: number; banCount: number }>
  }
  jobQueue: {
    pending: number
    processing: number
    completed: number
    failed: number
  }
  timestamp: string
}

// --- Helpers ---

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

function getStatusColor(status: string): string {
  if (status === 'connected' || status === 'ok') return 'bg-green-500'
  if (status === 'error') return 'bg-red-500'
  return 'bg-yellow-500'
}

function getHealthBanner(status: string): { bg: string; text: string; label: string; dot: string } {
  if (status === 'ok') {
    return { bg: 'bg-green-50 border-green-200', text: 'text-green-800', label: 'Systeme operationnel', dot: 'bg-green-500' }
  }
  if (status === 'degraded') {
    return { bg: 'bg-yellow-50 border-yellow-200', text: 'text-yellow-800', label: 'Systeme degrade', dot: 'bg-yellow-500' }
  }
  return { bg: 'bg-red-50 border-red-200', text: 'text-red-800', label: 'Systeme en erreur', dot: 'bg-red-500' }
}

function timeAgo(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (diff < 5) return "A l'instant"
  if (diff < 60) return `il y a ${diff}s`
  if (diff < 3600) return `il y a ${Math.floor(diff / 60)}min`
  return `il y a ${Math.floor(diff / 3600)}h`
}

// --- Composant principal ---

export function AdminMonitoringView() {
  const { setCurrentView, user } = useMovaStore()

  // Donnees
  const [healthData, setHealthData] = useState<HealthData | null>(null)
  const [monitoringData, setMonitoringData] = useState<MonitoringData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [lastRefresh, setLastRefresh] = useState(new Date().toISOString())

  // Verification admin
  const isAdmin = user?.role === 'admin'

  // Timer pour "il y a"
  const [now, setNow] = useState(Date.now())
  const nowRef = useRef(now)
  nowRef.current = now

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(interval)
  }, [])

  // Requetes
  const fetchHealth = useCallback(async () => {
    try {
      const res = await fetch('/api/mova/health')
      if (res.ok) {
        const data = await res.json()
        if (data.success) setHealthData(data.data)
      }
    } catch {
      // Silencieux
    }
  }, [])

  const fetchMonitoring = useCallback(async () => {
    try {
      const res = await apiFetch('/api/mova/admin/monitoring')

      if (res.ok) {
        const data = await res.json()
        if (data.success) {
          setMonitoringData(data.data)
          setError('')
        }
      } else {
        setError('Acces refuse ou erreur serveur')
      }
    } catch {
      setError('Erreur de connexion au serveur')
    } finally {
      setIsLoading(false)
      setLastRefresh(new Date().toISOString())
    }
  }, [])

  // Chargement initial + auto-refresh
  useEffect(() => {
    fetchHealth()
    fetchMonitoring()

    const healthInterval = setInterval(fetchHealth, 10000)
    const monitoringInterval = setInterval(fetchMonitoring, 30000)

    return () => {
      clearInterval(healthInterval)
      clearInterval(monitoringInterval)
    }
  }, [fetchHealth, fetchMonitoring])

  const handleRefresh = () => {
    setIsLoading(true)
    setError('')
    fetchHealth()
    fetchMonitoring()
  }

  // Non-admin
  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-[#1e40af] text-white px-4 py-4 flex items-center gap-3 sticky top-0 z-10">
          <button
            onClick={() => setCurrentView('hub')}
            className="p-2 -ml-2 rounded-xl hover:bg-white/10 active:scale-95 transition-transform"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <Eye className="w-5 h-5" />
          <h1 className="text-lg font-bold">Administration</h1>
        </header>
        <div className="px-4 py-16 text-center">
          <ShieldCheck className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-gray-700">Acces restreint</h2>
          <p className="text-sm text-gray-500 mt-1">Cette section est reservee aux administrateurs.</p>
        </div>
      </div>
    )
  }

  const banner = getHealthBanner(healthData?.status || 'ok')
  const m = monitoringData

  return (
    <div className="min-h-screen bg-gray-50">
      {/* En-tete */}
      <header className="bg-[#1e40af] text-white px-4 py-4 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setCurrentView('hub')}
            className="p-2 -ml-2 rounded-xl hover:bg-white/10 active:scale-95 transition-transform"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <Activity className="w-5 h-5" />
          <h1 className="text-lg font-bold">Monitoring</h1>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-white/60 hidden sm:inline">
            Actualise {timeAgo(lastRefresh)}
          </span>
          <button
            onClick={handleRefresh}
            className="p-2 rounded-lg hover:bg-white/10 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </header>

      <div className="px-4 py-5 space-y-5 pb-8">
        {/* Chargement */}
        {isLoading && !monitoringData && (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-[#1e40af]" />
            <span className="ml-2 text-sm text-gray-500">Chargement du monitoring...</span>
          </div>
        )}

        {/* Erreur */}
        {error && !isLoading && (
          <div className="flex items-center justify-center gap-2 py-8 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
            <AlertCircle className="w-4 h-4" />
            {error}
          </div>
        )}

        {monitoringData && (
          <>
            {/* Bandeau de sante */}
            <div className={`p-4 rounded-2xl border ${banner.bg}`}>
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${banner.dot} ${healthData?.status === 'ok' ? 'animate-pulse' : ''}`} />
                <span className={`text-sm font-semibold ${banner.text}`}>{banner.label}</span>
                {healthData?.version && (
                  <span className="text-xs text-gray-500 ml-auto">v{healthData.version}</span>
                )}
              </div>
              {healthData?.uptime?.formatted && (
                <p className="text-xs text-gray-500 mt-1">
                  Disponibilite : {healthData.uptime.formatted}
                </p>
              )}
            </div>

            {/* Metriques principales */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {/* Utilisateurs */}
              <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-[#1e40af]/10 flex items-center justify-center">
                    <Users className="w-4 h-4 text-[#1e40af]" />
                  </div>
                  <span className="text-[10px] text-gray-500 uppercase tracking-wider">Utilisateurs</span>
                </div>
                <p className="text-2xl font-bold text-gray-800">--</p>
                <p className="text-[10px] text-gray-400">total</p>
              </div>

              {/* Courses actives */}
              <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-[#059669]/10 flex items-center justify-center">
                    <Car className="w-4 h-4 text-[#059669]" />
                  </div>
                  <span className="text-[10px] text-gray-500 uppercase tracking-wider">Courses</span>
                </div>
                <p className="text-2xl font-bold text-gray-800">--</p>
                <p className="text-[10px] text-gray-400">actives</p>
              </div>

              {/* Revenus */}
              <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center">
                    <Wallet className="w-4 h-4 text-amber-600" />
                  </div>
                  <span className="text-[10px] text-gray-500 uppercase tracking-wider">Revenus</span>
                </div>
                <p className="text-2xl font-bold text-gray-800">--</p>
                <p className="text-[10px] text-gray-400">aujourd'hui</p>
              </div>

              {/* Taux d'erreur */}
              <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center">
                    <AlertTriangle className="w-4 h-4 text-red-500" />
                  </div>
                  <span className="text-[10px] text-gray-500 uppercase tracking-wider">Erreurs</span>
                </div>
                <p className="text-2xl font-bold text-gray-800">{m?.jobQueue?.failed ?? 0}</p>
                <p className="text-[10px] text-gray-400">taches echouees</p>
              </div>
            </div>

            {/* Systeme : Memoire, CPU, Uptime */}
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 space-y-4">
              <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <Server className="w-4 h-4 text-[#1e40af]" />
                Informations systeme
              </h2>

              <div className="grid grid-cols-2 gap-4">
                {/* Memoire */}
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <MemoryStick className="w-4 h-4 text-purple-500" />
                    <span className="text-xs font-medium text-gray-600">Memoire</span>
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-500">Heap utilise</span>
                      <span className="font-semibold">{m?.memory?.heapUsed ?? 0} Mo</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2">
                      <div
                        className="h-2 rounded-full bg-purple-500 transition-all"
                        style={{
                          width: `${Math.min(((m?.memory?.heapUsed ?? 0) / (m?.memory?.heapTotal ?? 1)) * 100, 100)}%`,
                        }}
                      />
                    </div>
                    <div className="flex justify-between text-[10px] text-gray-400">
                      <span>RSS : {m?.memory?.rss ?? 0} Mo</span>
                      <span>Total : {m?.memory?.heapTotal ?? 0} Mo</span>
                    </div>
                  </div>
                </div>

                {/* CPU et Uptime */}
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Cpu className="w-4 h-4 text-blue-500" />
                    <span className="text-xs font-medium text-gray-600">CPU et Disponibilite</span>
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-500">Uptime</span>
                      <span className="font-semibold">{formatUptime(m?.system?.uptime?.seconds ?? 0)}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-500">Runtime</span>
                      <span className="font-semibold">{m?.system?.runtime ?? '--'}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-500">Plateforme</span>
                      <span className="font-semibold">{m?.system?.platform ?? '--'}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-500">Environnement</span>
                      <span className="font-semibold">{m?.system?.nodeEnv ?? '--'}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Base de donnees */}
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
              <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2 mb-3">
                <Database className="w-4 h-4 text-[#059669]" />
                Base de donnees
              </h2>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`w-2.5 h-2.5 rounded-full ${getStatusColor(healthData?.database?.status || 'connected')}`} />
                  <span className="text-sm text-gray-700">
                    {healthData?.database?.status === 'connected' ? 'Connectee' : 'Deconnectee'}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-gray-500">
                  <Clock className="w-3.5 h-3.5" />
                  <span>Latence : {healthData?.database?.latencyMs || 0} ms</span>
                </div>
              </div>
            </div>

            {/* Cache et Rate Limiter */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Cache */}
              <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center">
                    <HardDrive className="w-4 h-4 text-amber-600" />
                  </div>
                  <span className="text-xs font-medium text-gray-600">Cache</span>
                </div>
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-500">Cles</span>
                    <span className="font-semibold">{m?.cache?.keys ?? 0}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-500">Taux de succes</span>
                    <span className="font-semibold">{m?.cache?.hitRate ?? 0}%</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-500">Requetes</span>
                    <span className="font-semibold">{(m?.cache?.hits ?? 0) + (m?.cache?.misses ?? 0)}</span>
                  </div>
                </div>
              </div>

              {/* Rate Limiter */}
              <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center">
                    <ShieldCheck className="w-4 h-4 text-red-500" />
                  </div>
                  <span className="text-xs font-medium text-gray-600">Rate Limiter</span>
                </div>
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-500">Verifications</span>
                    <span className="font-semibold">{m?.rateLimiter?.totalChecks ?? 0}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-500">Bloquees</span>
                    <span className="font-semibold text-red-600">{m?.rateLimiter?.totalBlocked ?? 0}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* File de taches */}
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
              <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2 mb-3">
                <Layers className="w-4 h-4 text-amber-500" />
                File de taches
              </h2>
              <div className="grid grid-cols-4 gap-3">
                <div className="text-center p-2 rounded-lg bg-yellow-50">
                  <p className="text-lg font-bold text-yellow-700">{m?.jobQueue?.pending ?? 0}</p>
                  <p className="text-[10px] text-gray-500">En attente</p>
                </div>
                <div className="text-center p-2 rounded-lg bg-blue-50">
                  <p className="text-lg font-bold text-blue-700">{m?.jobQueue?.processing ?? 0}</p>
                  <p className="text-[10px] text-gray-500">En cours</p>
                </div>
                <div className="text-center p-2 rounded-lg bg-green-50">
                  <p className="text-lg font-bold text-green-700">{m?.jobQueue?.completed ?? 0}</p>
                  <p className="text-[10px] text-gray-500">Terminees</p>
                </div>
                <div className="text-center p-2 rounded-lg bg-red-50">
                  <p className="text-lg font-bold text-red-600">{m?.jobQueue?.failed ?? 0}</p>
                  <p className="text-[10px] text-gray-500">Echouees</p>
                </div>
              </div>
            </div>

            {/* Top rate limit violators */}
            {m?.rateLimiter?.topViolators && m.rateLimiter.topViolators.length > 0 && (
              <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2 mb-3">
                  <TrendingUp className="w-4 h-4 text-red-500" />
                  Top abus de rate limit ({m.rateLimiter!.topViolators.length})
                </h2>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {m.rateLimiter!.topViolators.slice(0, 10).map((v, i) => (
                    <div key={i} className="flex items-center justify-between py-1.5 text-xs">
                      <span className="text-gray-700 font-mono truncate max-w-[200px]">{v.identifier}</span>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-gray-500">{v.violations} violations</span>
                        {v.banCount > 0 && (
                          <span className="px-1.5 py-0.5 bg-red-100 text-red-700 rounded text-[10px] font-medium">
                            {v.banCount} ban(s)
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Dernier refresh */}
            <div className="text-center py-2">
              <p className="text-[11px] text-gray-400">
                Auto-rafraichissement toutes les 30 secondes
                -- Derniere mise a jour : {timeAgo(lastRefresh)}
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
