"use client"

import { useEffect, useState, useRef, useMemo, useCallback } from "react"
import { useTheme } from "next-themes"
import { useAppStore, type Ride, type Zone } from "@/lib/mova/store"
import { useAnalytics, useRides, useDrivers, useZones, useIncidents, useDeliveries, useReportIncident, useBookings, useUpdateDriver, useUpdateIncident, useUpdateZone } from "@/lib/mova/api-hooks"
import { useQueryClient } from "@tanstack/react-query"
import type { RideData, DriverData, IncidentData, IncidentType, IncidentSeverity } from "@/lib/mova/api-types"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import {
  RevenueChart,
  RidesByStatusChart,
  RidesByZoneChart,
  MonthlyRevenueChart,
  PaymentMethodsChart,
  TopDriversChart,
  IncidentSeverityChart,
} from "@/components/mova/admin-charts"
import { DynamicMovaMap } from "@/components/mova/mova-map"
import AdminTrackingDashboard from "@/components/mova/admin-tracking-dashboard"

// shadcn/ui
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Sheet,
  SheetContent,
  SheetTitle,
} from "@/components/ui/sheet"

// Lucide icons
import {
  LayoutDashboard,
  Car,
  Users,
  Map as MapIcon,
  Settings,
  LogOut,
  Star,
  Search,
  Eye,
  Menu,
  Shield,
  Bell,
  DollarSign,
  Package,
  Building2,
  AlertTriangle,
  ChevronRight,
  Clock,
  CheckCircle2,
  XCircle,
  UserPlus,
  Phone,
  Mail,
  Ban,
  RefreshCcw,
  Flag,
  Filter,
  Truck,
  CheckCheck,
  ArrowUpRight,
  ArrowDownRight,
  CircleDot,
  ArrowLeft,
  Wrench,
  CreditCard,
  ToggleLeft,
  Globe,
  Zap,
  BarChart3,
  AlertCircle,
  MessageSquare,
  Info,
  Navigation,
  Calendar,
  Moon,
  Sun,
  Radio,
} from "lucide-react"

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

const formatGNF = (amount: number) =>
  new Intl.NumberFormat("fr-GN").format(amount) + " GNF"

const formatCompactGNF = (amount: number) => {
  if (amount >= 1000000) return (amount / 1000000).toFixed(1) + "M GNF"
  if (amount >= 1000) return (amount / 1000).toFixed(0) + "K GNF"
  return amount.toLocaleString("fr-GN") + " GNF"
}

const formatDate = (date: string | Date) =>
  new Date(date).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })

const formatDateTime = (date: string | Date) =>
  new Date(date).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  })

const formatTime = (date: string | Date) =>
  new Date(date).toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  })

const relativeTime = (date: Date | string) => {
  const now = new Date()
  const then = new Date(date)
  const diffMs = now.getTime() - then.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  const diffH = Math.floor(diffMin / 60)
  const diffD = Math.floor(diffH / 24)
  if (diffMin < 1) return "A l'instant"
  if (diffMin < 60) return `il y a ${diffMin} min`
  if (diffH < 24) return `il y a ${diffH}h`
  if (diffD < 7) return `il y a ${diffD}j`
  return then.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })
}

const fullFrenchDate = () =>
  new Date().toLocaleDateString("fr-FR", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  })

const currentTime = () =>
  new Date().toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  })

const getInitials = (name: string) =>
  name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)

type RideStatus = "pending" | "confirmed" | "accepted" | "in_progress" | "completed" | "cancelled"

const statusConfig: Record<
  RideStatus,
  { label: string; color: string; bg: string; dot: string }
> = {
  pending: {
    label: "En attente",
    color: "text-gray-700",
    bg: "bg-gray-100",
    dot: "bg-gray-500",
  },
  confirmed: {
    label: "Confirme",
    color: "text-amber-700",
    bg: "bg-amber-100",
    dot: "bg-amber-500",
  },
  accepted: {
    label: "Acceptee",
    color: "text-emerald-700",
    bg: "bg-emerald-100",
    dot: "bg-emerald-500",
  },
  in_progress: {
    label: "En cours",
    color: "text-amber-700",
    bg: "bg-amber-100",
    dot: "bg-amber-500",
  },
  completed: {
    label: "Terminee",
    color: "text-emerald-700",
    bg: "bg-emerald-100",
    dot: "bg-emerald-500",
  },
  cancelled: {
    label: "Annulee",
    color: "text-red-700",
    bg: "bg-red-100",
    dot: "bg-red-500",
  },
}

const severityConfig: Record<string, { label: string; color: string; bg: string }> = {
  low: { label: "Faible", color: "text-gray-700", bg: "bg-gray-100" },
  medium: { label: "Moyen", color: "text-amber-700", bg: "bg-amber-100" },
  high: { label: "Eleve", color: "text-orange-700", bg: "bg-orange-100" },
  critical: { label: "Critique", color: "text-red-700", bg: "bg-red-100" },
}

// ──────────────────────────────────────────────

const DEFAULT_ACTIVITY = []

// ──────────────────────────────────────────────
// Notification API helpers
// ──────────────────────────────────────────────

function mapNotificationType(type: string): string {
  const map: Record<string, string> = {
    ride: 'ride_completed',
    delivery: 'delivery_completed',
    payment: 'payment_received',
    system: 'system_update',
    signup: 'driver_registered',
    report: 'incident_reported',
  }
  return map[type] || 'system_update'
}

function getActivityIcon(type: string) {
  const map: Record<string, React.ElementType> = {
    ride_completed: CheckCircle2,
    delivery_completed: CheckCircle2,
    payment_received: CreditCard,
    driver_registered: UserPlus,
    incident_reported: AlertTriangle,
    system_update: Info,
  }
  return map[type] || Info
}

function getActivityColor(type: string): string {
  const map: Record<string, string> = {
    ride_completed: 'text-emerald-500',
    delivery_completed: 'text-emerald-500',
    payment_received: 'text-amber-500',
    driver_registered: 'text-blue-500',
    incident_reported: 'text-red-500',
    system_update: 'text-gray-500',
  }
  return map[type] || 'text-gray-500'
}

function formatRelativeTime(dateStr: string): string {
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const diff = Math.floor((now - then) / 1000)
  if (diff < 60) return "A l'instant"
  if (diff < 3600) return `Il y a ${Math.floor(diff / 60)} min`
  if (diff < 86400) return `Il y a ${Math.floor(diff / 3600)}h`
  return `Il y a ${Math.floor(diff / 86400)}j`
}

const revenueWeeklyData = []

// ridesByStatus, ridesByZone, topEarningDrivers, paymentBreakdown replaced by Recharts data below

// ──────────────────────────────────────────────
// Recharts Data
// ──────────────────────────────────────────────

const ridesByStatusChartData = []

const ridesByZoneChartData = [
  { zone: "Kaloum", count: 35 },
  { zone: "Dixinn", count: 18 },
  { zone: "Matam", count: 22 },
  { zone: "Ratoma", count: 42 },
  { zone: "Matoto", count: 30 },
]

const monthlyRevenueChartData = []

const paymentMethodsChartData = []

const topDriversChartData = []

const incidentSeverityChartData = []

// ──────────────────────────────────────────────
// Navigation
// ──────────────────────────────────────────────

const navItems = [
  { id: "dashboard", label: "Tableau de bord", icon: LayoutDashboard },
  { id: "tracking", label: "Suivi temps reel", icon: Radio },
  { id: "rides", label: "Courses", icon: Car },
  { id: "users", label: "Utilisateurs", icon: Users },
  { id: "drivers", label: "Chauffeurs", icon: Shield },
  { id: "revenue", label: "Revenus", icon: DollarSign },
  { id: "zones", label: "Zones", icon: MapIcon },
  { id: "deliveries", label: "Livraisons", icon: Package },
  { id: "business", label: "Entreprises", icon: Building2 },
  { id: "incidents", label: "Signalements", icon: AlertTriangle },
  { id: "settings", label: "Parametres", icon: Settings },
] as const

type NavItem = (typeof navItems)[number]["id"]

type NotificationItem = {
  id: string
  type: 'ride_requested' | 'ride_completed' | 'incident_reported' | 'driver_registered' | 'payment_received'
  title: string
  description: string
  timestamp: Date
  read: boolean
}

type SearchResult = {
  type: 'ride' | 'driver' | 'passenger' | 'incident'
  id: string
  title: string
  subtitle: string
  status: string
  statusColor: string
  tab: NavItem
}

// ──────────────────────────────────────────────
// Sub-components
// ──────────────────────────────────────────────

function StatusBadge({ status }: { status: RideStatus }) {
  const cfg = statusConfig[status]
  return (
    <Badge variant="secondary" className={cn("gap-1.5 font-medium text-xs", cfg.bg, cfg.color)}>
      <span className={cn("h-1.5 w-1.5 rounded-full", cfg.dot)} />
      {cfg.label}
    </Badge>
  )
}

function SeverityBadge({ severity }: { severity: string }) {
  const cfg = severityConfig[severity] || severityConfig.low
  return (
    <Badge variant="secondary" className={cn("gap-1.5 font-medium text-xs", cfg.bg, cfg.color)}>
      {cfg.label}
    </Badge>
  )
}

function IncidentStatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; bg: string; color: string }> = {
    open: { label: "Ouvert", bg: "bg-red-100", color: "text-red-700" },
    investigating: { label: "Enquete", bg: "bg-amber-100", color: "text-amber-700" },
    resolved: { label: "Resolu", bg: "bg-emerald-100", color: "text-emerald-700" },
    closed: { label: "Ferme", bg: "bg-gray-100", color: "text-gray-600" },
  }
  const cfg = map[status] || map.open
  return (
    <Badge variant="secondary" className={cn("font-medium text-xs", cfg.bg, cfg.color)}>
      {cfg.label}
    </Badge>
  )
}

function ErrorBanner({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <Card className="border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-900/30">
      <CardContent className="p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-100 dark:bg-red-900/40">
            <AlertCircle className="h-5 w-5 text-red-600" />
          </div>
          <div>
            <p className="text-sm font-medium text-red-800 dark:text-red-300">Erreur de chargement</p>
            <p className="text-xs text-red-600/80 dark:text-red-400/80 mt-0.5">{message}</p>
          </div>
        </div>
        <Button variant="outline" size="sm" className="border-red-300 text-red-700 hover:bg-red-100 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/30" onClick={onRetry}>
          <RefreshCcw className="h-4 w-4 mr-1" />
          Reessayer
        </Button>
      </CardContent>
    </Card>
  )
}

function KPICard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  trendValue,
  iconBg,
  iconColor,
}: {
  title: string
  value: string
  subtitle?: string
  icon: React.ElementType
  trend?: "up" | "down"
  trendValue?: string
  iconBg: string
  iconColor: string
}) {
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl", iconBg)}>
            <Icon className={cn("h-5 w-5", iconColor)} />
          </div>
          {trend && trendValue && (
            <div className={cn("flex items-center gap-1 text-sm font-medium", trend === "up" ? "text-emerald-600" : "text-red-500")}>
              {trend === "up" ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
              <span>{trendValue}</span>
            </div>
          )}
        </div>
        <div className="mt-3">
          <p className="text-2xl font-bold">{value}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{title}</p>
        </div>
        {subtitle && <p className="text-[11px] text-muted-foreground mt-1">{subtitle}</p>}
      </CardContent>
    </Card>
  )
}

// ──────────────────────────────────────────────
// Sidebar (Dark theme)
// ──────────────────────────────────────────────

function SidebarContent({
  activeTab,
  onTabChange,
  userName,
  onLogout,
}: {
  activeTab: NavItem
  onTabChange: (id: NavItem) => void
  userName: string
  onLogout: () => void
}) {
  return (
    <div className="flex h-full flex-col bg-slate-900 text-white">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-slate-700/50">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 shadow-lg shadow-emerald-500/20">
          <Car className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="text-lg font-bold tracking-tight text-white">MOVA</h1>
          <p className="text-[10px] font-medium text-slate-400 uppercase tracking-widest">Administration</p>
        </div>
      </div>

      {/* Navigation */}
      <ScrollArea className="flex-1 px-3 py-4">
        <nav className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = activeTab === item.id
            return (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
                  isActive
                    ? "bg-emerald-600 text-white shadow-sm shadow-emerald-600/30"
                    : "text-slate-300 hover:bg-slate-800 hover:text-white"
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </button>
            )
          })}
        </nav>
      </ScrollArea>

      {/* User info */}
      <div className="border-t border-slate-700/50 px-4 py-4">
        <div className="flex items-center gap-3">
          <Avatar className="h-9 w-9">
            <AvatarFallback className="bg-emerald-600 text-white text-xs font-bold">
              {getInitials(userName)}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">{userName}</p>
            <Badge className="mt-0.5 text-[10px] px-1.5 py-0 bg-emerald-600/20 text-emerald-400 border-emerald-600/30">
              <Shield className="h-2.5 w-2.5 mr-1" />
              Admin
            </Badge>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-slate-400 hover:text-red-400 hover:bg-slate-800"
            onClick={onLogout}
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────
// Section: Dashboard
// ──────────────────────────────────────────────

function DashboardSection() {
  const queryClient = useQueryClient()
  const { data: analytics, isLoading: analyticsLoading, error: analyticsError, refetch: refetchAnalytics } = useAnalytics()
  const { data: zonesData } = useZones()
  const { data: onlineDriversData } = useDrivers({ online: true })

  const stats = analytics?.stats
  const onlineDrivers = onlineDriversData ?? []
  const recentRides = analytics?.recentRides ?? []
  const revenueByDay = analytics?.revenueByDay ?? []
  const ridesByStatus = analytics?.ridesByStatus ?? []
  const ridesByZone = analytics?.ridesByZone ?? []
  const zones = zonesData ?? []

  // Map analytics ridesByStatus to chart format
  const statusChartData = ridesByStatus.length === 0
    ? ridesByStatusChartData
    : ridesByStatus.map((r) => {
        const colorMap: Record<string, string> = {
          completed: "#10b981", cancelled: "#ef4444", in_progress: "#f59e0b",
          pending: "#9ca3af", confirmed: "#f59e0b",
        }
        const labelMap: Record<string, string> = {
          completed: "Terminees", cancelled: "Annulees", in_progress: "En cours",
          pending: "En attente", confirmed: "Confirmees",
        }
        return {
          name: labelMap[r.status] ?? r.status,
          value: r.count,
          color: colorMap[r.status] ?? "#9ca3af",
        }
      })

  // Map revenueByDay to weekly revenue chart format (RevenueChart expects { date, revenus, depenses })
  const weeklyRevenueData = revenueByDay.length === 0
    ? revenueWeeklyData
    : revenueByDay.map((r) => ({ date: r.day, revenus: r.revenue, depenses: Math.round(r.revenue * 0.45) }))

  // Map analytics ridesByZone to chart format
  const zoneChartData = ridesByZone.length === 0
    ? ridesByZoneChartData
    : ridesByZone.map((r) => ({ zone: r.zone, count: r.count }))

  const handleRetry = () => {
    refetchAnalytics()
  }

  // Notifications API state
  const [notificationsActivity, setNotificationsActivity] = useState<typeof DEFAULT_ACTIVITY>([])

  // Fetch notifications from API with 30s refresh
  useEffect(() => {
    const token = localStorage.getItem('mova_token')
    if (!token) return

    const fetchActivity = async () => {
      try {
        const res = await fetch('/api/mova/notifications?userId=admin', {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (res.ok) {
          const json = await res.json()
          const notifications = json.data?.notifications ?? []
          if (notifications.length) {
            const mapped = notifications.slice(0, 10).map((n: { id?: string; type: string; title?: string; message?: string; createdAt: string }, i: number) => ({
              id: n.id || `notif-${i + 1}`,
              type: mapNotificationType(n.type),
              icon: getActivityIcon(mapNotificationType(n.type)),
              description: n.title || n.message || '',
              time: formatRelativeTime(n.createdAt),
              color: getActivityColor(mapNotificationType(n.type)),
            }))
            setNotificationsActivity(mapped)
          }
        }
      } catch {
        // Keep default activity on error
      }
    }

    fetchActivity()
    const interval = setInterval(fetchActivity, 30000)
    return () => clearInterval(interval)
  }, [])

  // Build activity feed from recent rides (primary) or notifications API (secondary)
  const activityFeed = recentRides.length === 0
    ? (notificationsActivity.length > 0 ? notificationsActivity : DEFAULT_ACTIVITY)
    : recentRides.slice(0, 10).map((ride) => {
        const passengerName = ride.passenger?.name ?? "Passager"
        const driverName = ride.driver?.name ?? "Chauffeur"
        const isCompleted = ride.status === "completed"
        const isCancelled = ride.status === "cancelled"
        const isInProgress = ride.status === "in_progress"
        const rideAmount = ride.actualFare ?? ride.estimatedFare

        let description = ""
        let icon = CheckCircle2
        let color = "text-emerald-500"

        if (isCompleted) {
        description = `Course ${ride.id} terminee - ${ride.pickupZone} vers ${ride.dropoffZone} (${formatGNF(rideAmount)})`
        icon = CheckCircle2
        color = "text-emerald-500"
      } else if (isCancelled) {
        description = `Course ${ride.id} annulee - ${passengerName}`
        icon = XCircle
        color = "text-red-500"
      } else if (isInProgress) {
        description = `Course ${ride.id} en cours - ${driverName}`
        icon = CircleDot
        color = "text-amber-500"
      } else {
        description = `Nouvelle course ${ride.id} - ${passengerName}`
        icon = Car
        color = "text-amber-500"
      }

      return {
        id: ride.id,
        type: isCompleted ? "ride_completed" : isCancelled ? "ride_cancelled" : isInProgress ? "ride_in_progress" : "ride_pending",
        icon,
        description,
        time: formatDateTime(ride.createdAt),
        color,
      }
    })

  // Admin map drivers — populated from online drivers API
  const adminMapDrivers = onlineDrivers
    .filter((d) => d.currentLat != null && d.currentLng != null)
    .map((d) => ({ lat: d.currentLat!, lng: d.currentLng!, id: d.id, name: d.name }))

  if (analyticsError && !analyticsLoading) {
    return (
      <ErrorBanner message="Impossible de charger les donnees du tableau de bord" onRetry={handleRetry} />
    )
  }

  if (analyticsLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}><CardContent className="p-5 space-y-3">
              <Skeleton className="h-10 w-10 rounded-xl" />
              <Skeleton className="h-8 w-32" />
              <Skeleton className="h-4 w-24" />
            </CardContent></Card>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <Card key={i}><CardContent className="p-6"><Skeleton className="h-[280px] w-full rounded-lg" /></CardContent></Card>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {analyticsError && !analyticsLoading && (
        <ErrorBanner message="Certaines donnees n'ont pas pu etre chargees" onRetry={handleRetry} />
      )}
      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="Courses totales"
          value={String(stats?.totalRides ?? 0)}
          subtitle={`${stats?.totalPassengers ?? 0} passagers`}
          icon={Car}
          iconBg="bg-emerald-100"
          iconColor="text-emerald-600"
        />
        <KPICard
          title="Revenus"
          value={formatGNF(stats?.totalRevenue ?? 0)}
          icon={DollarSign}
          iconBg="bg-amber-100"
          iconColor="text-amber-600"
        />
        <KPICard
          title="Chauffeurs en ligne"
          value={String(stats?.activeDrivers ?? 0)}
          icon={Users}
          iconBg="bg-emerald-100"
          iconColor="text-emerald-600"
        />
        <KPICard
          title="Note moyenne"
          value={`${(stats?.averageRating ?? 0).toFixed(1)}/5`}
          subtitle={`${stats?.totalRides ?? 0} courses`}
          icon={Star}
          iconBg="bg-purple-100"
          iconColor="text-purple-600"
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Revenus sur 7 jours</CardTitle>
            <CardDescription>Total : {formatCompactGNF(weeklyRevenueData.reduce((s, d) => s + (d as any).amount || 0, 0))}</CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <RevenueChart data={weeklyRevenueData} />
          </CardContent>
        </Card>
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Courses par statut</CardTitle>
            <CardDescription>Distribution des {stats?.totalRides ?? 0} courses</CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <RidesByStatusChart data={statusChartData} />
          </CardContent>
        </Card>
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Courses par zone</CardTitle>
            <CardDescription>Repartition sur les communes</CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <RidesByZoneChart data={zoneChartData} />
          </CardContent>
        </Card>
      </div>

      {/* Activity + Map Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Recent Activity */}
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Activite recente</CardTitle>
            <CardDescription>Derniers evenements</CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="space-y-3 max-h-96 overflow-y-auto mova-scrollbar">
              {activityFeed.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8">
                  <Clock className="h-8 w-8 text-muted-foreground/40 mb-2" />
                  <p className="text-sm text-muted-foreground">Aucune activite recente</p>
                </div>
              ) : activityFeed.map((event) => {
                const Icon = event.icon
                const dotColor =
                  event.type === "ride_completed" || event.type === "incident_resolved"
                    ? "bg-emerald-500"
                    : event.type === "ride_cancelled" || event.type === "incident_reported"
                    ? "bg-red-500"
                    : event.type === "ride_in_progress"
                    ? "bg-amber-500"
                    : "bg-amber-500"
                return (
                  <div key={event.id} className="flex items-start gap-3">
                    <div className="flex items-center justify-center h-8 w-8 rounded-full bg-muted shrink-0">
                      <Icon className={cn("h-4 w-4", event.color)} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm leading-tight">{event.description}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", dotColor)} />
                        <span className="text-xs text-muted-foreground">{event.time}</span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>

        {/* Live Map */}
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Carte en temps reel</CardTitle>
            <CardDescription>{stats?.activeDrivers ?? 0} chauffeurs en ligne sur {zones.length} zones</CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            {adminMapDrivers.length === 0 ? (
              <div className="h-64 rounded-xl bg-muted/30 flex items-center justify-center">
                <div className="text-center">
                  <Users className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">Aucun chauffeur en ligne</p>
                </div>
              </div>
            ) : (
              <DynamicMovaMap
                drivers={adminMapDrivers}
                showZones
                interactive
                showRoute={false}
                className="h-64 rounded-xl overflow-hidden"
              />
            )}
            {/* Legend */}
            <div className="flex items-center gap-4 mt-3 flex-wrap">
              <div className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded-full bg-emerald-500 border-2 border-white shadow-sm" />
                <span className="text-[11px] text-muted-foreground">Course disponible</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded-full bg-emerald-500 border-2 border-white shadow-sm" />
                <span className="text-[11px] text-muted-foreground">Chauffeur en ligne</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded-full bg-amber-500 border-2 border-white shadow-sm" />
                <span className="text-[11px] text-muted-foreground">Destination</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────
// Section: Courses
// ──────────────────────────────────────────────

function RidesSection() {
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [zoneFilter, setZoneFilter] = useState<string>("all")
  const [selectedRide, setSelectedRide] = useState<RideData | null>(null)
  const [reportingRide, setReportingRide] = useState<RideData | null>(null)
  const [incidentType, setIncidentType] = useState<IncidentType>("other")
  const [incidentSeverity, setIncidentSeverity] = useState<IncidentSeverity>("medium")
  const [incidentDescription, setIncidentDescription] = useState("")
  const [refundingRide, setRefundingRide] = useState<RideData | null>(null)
  const [refundAmount, setRefundAmount] = useState("")
  const [refundReason, setRefundReason] = useState("")

  // Pre-fill refund amount when ride changes
  useEffect(() => {
    if (refundingRide) {
      const fare = String(refundingRide.actualFare ?? refundingRide.estimatedFare ?? 0)
      queueMicrotask(() => {
        setRefundAmount(fare)
        setRefundReason("")
      })
    }
  }, [refundingRide])

  const reportMutation = useReportIncident({
    onSuccess: () => {
      toast.success("Signalement cree avec succes")
      setReportingRide(null)
      setIncidentType("other")
      setIncidentSeverity("medium")
      setIncidentDescription("")
    },
    onError: (err) => {
      toast.error("Erreur: " + err.message)
    },
  })

  const { data: ridesResponse, isLoading: ridesLoading, error: ridesError, refetch: refetchRides } = useRides(
    { status: statusFilter !== "all" ? statusFilter : undefined, limit: 100 },
  )

  const allRides = ridesResponse?.rides ?? []

  const filteredRides = (!search && zoneFilter === "all") ? allRides
    : allRides.filter((ride) => {
        if (search) {
          const q = search.toLowerCase()
          const passengerName = ride.passenger?.name ?? ""
          const driverName = ride.driver?.name ?? ""
          const match =
            ride.id.toLowerCase().includes(q) ||
            passengerName.toLowerCase().includes(q) ||
            driverName.toLowerCase().includes(q)
          if (!match) return false
        }
        if (zoneFilter !== "all" && ride.pickupZone !== zoneFilter && ride.dropoffZone !== zoneFilter) return false
        return true
      })

  return (
    <div className="space-y-6">
      {ridesError && !ridesLoading && (
        <ErrorBanner message="Impossible de charger la liste des courses" onRetry={() => refetchRides()} />
      )}
      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher par ID, passager, chauffeur..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-44">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Statut" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les statuts</SelectItem>
                <SelectItem value="completed">Terminee</SelectItem>
                <SelectItem value="in_progress">En cours</SelectItem>
                <SelectItem value="pending">En attente</SelectItem>
                <SelectItem value="cancelled">Annulee</SelectItem>
              </SelectContent>
            </Select>
            <Select value={zoneFilter} onValueChange={setZoneFilter}>
              <SelectTrigger className="w-full sm:w-40">
                <MapIcon className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Zone" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes les zones</SelectItem>
                <SelectItem value="Kaloum">Kaloum</SelectItem>
                <SelectItem value="Dixinn">Dixinn</SelectItem>
                <SelectItem value="Matam">Matam</SelectItem>
                <SelectItem value="Ratoma">Ratoma</SelectItem>
                <SelectItem value="Matoto">Matoto</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Rides Table */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm font-semibold">Liste des courses</CardTitle>
              <CardDescription>{filteredRides.length} courses trouvees</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">ID</TableHead>
                  <TableHead className="text-xs">Passager</TableHead>
                  <TableHead className="text-xs">Chauffeur</TableHead>
                  <TableHead className="text-xs">Trajet</TableHead>
                  <TableHead className="text-xs">Montant</TableHead>
                  <TableHead className="text-xs">Statut</TableHead>
                  <TableHead className="text-xs">Date</TableHead>
                  <TableHead className="text-xs text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ridesLoading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8">
                      <div className="space-y-2">
                        <Skeleton className="h-6 w-full mx-auto max-w-md" />
                        <Skeleton className="h-6 w-full mx-auto max-w-md" />
                        <Skeleton className="h-6 w-3/4 mx-auto max-w-md" />
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  <>
                {filteredRides.map((ride) => (
                  <TableRow key={ride.id}>
                    <TableCell className="font-mono text-xs">{ride.id}</TableCell>
                    <TableCell className="text-sm">{ride.passenger?.name ?? "Inconnu"}</TableCell>
                    <TableCell className="text-sm">{ride.driver?.name ?? <span className="text-muted-foreground">-</span>}</TableCell>
                    <TableCell className="text-xs">
                      <div className="flex items-center gap-1">
                        <span className="truncate max-w-24">{ride.pickupZone}</span>
                        <ChevronRight className="h-3 w-3 text-muted-foreground" />
                        <span className="truncate max-w-24">{ride.dropoffZone}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm font-medium">{ride.actualFare ? formatGNF(ride.actualFare) : formatGNF(ride.estimatedFare)}</TableCell>
                    <TableCell><StatusBadge status={ride.status} /></TableCell>
                    <TableCell className="text-xs text-muted-foreground">{formatDateTime(ride.createdAt)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => setSelectedRide(ride)}>
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-9 w-9 text-amber-500 hover:text-amber-700" onClick={() => setRefundingRide(ride)}>
                          <RefreshCcw className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-9 w-9 text-red-500 hover:text-red-700" onClick={() => setReportingRide(ride)}>
                          <Flag className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredRides.length === 0 && !ridesLoading && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground text-sm">
                      Aucune course trouvee
                    </TableCell>
                  </TableRow>
                )}
                </>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Ride Detail Dialog */}
      <Dialog open={!!selectedRide} onOpenChange={() => setSelectedRide(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Detail de la course {selectedRide?.id}</DialogTitle>
            <DialogDescription>Informations completes de la course</DialogDescription>
          </DialogHeader>
          {selectedRide && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Statut</p>
                  <StatusBadge status={selectedRide.status as RideStatus} />
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Montant</p>
                  <p className="text-sm font-semibold">{formatGNF(selectedRide.actualFare ?? selectedRide.estimatedFare)}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Passager</p>
                  <p className="text-sm font-medium">{selectedRide.passenger?.name ?? "Inconnu"}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Chauffeur</p>
                  <p className="text-sm font-medium">{selectedRide.driver?.name ?? "Non assigne"}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Depart</p>
                  <p className="text-sm">{selectedRide.pickupAddress}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Arrivee</p>
                  <p className="text-sm">{selectedRide.dropoffAddress}</p>
                </div>
                {selectedRide.distance && (
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Distance</p>
                    <p className="text-sm">{selectedRide.distance} km</p>
                  </div>
                )}
                {selectedRide.duration && (
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Duree</p>
                    <p className="text-sm">{selectedRide.duration} min</p>
                  </div>
                )}
              </div>
              {selectedRide.passengerNote && (
                <div className="rounded-lg bg-muted p-3">
                  <p className="text-xs text-muted-foreground mb-1">Commentaire passager</p>
                  <p className="text-sm">{selectedRide.passengerNote}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Report Incident Dialog */}
      <Dialog open={!!reportingRide} onOpenChange={(open) => { if (!open) setReportingRide(null) }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Signaler un incident</DialogTitle>
            <DialogDescription>Course {reportingRide?.id} - {reportingRide?.passenger?.name ?? "Inconnu"}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Type d'incident</Label>
              <Select value={incidentType} onValueChange={(v) => setIncidentType(v as IncidentType)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selectionner le type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="accident">Accident</SelectItem>
                  <SelectItem value="dispute">Litige</SelectItem>
                  <SelectItem value="damage">Dommage</SelectItem>
                  <SelectItem value="lost_item">Objet perdu</SelectItem>
                  <SelectItem value="safety">Securite</SelectItem>
                  <SelectItem value="other">Autre</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Severite</Label>
              <RadioGroup value={incidentSeverity} onValueChange={(v) => setIncidentSeverity(v as IncidentSeverity)} className="flex gap-3 flex-wrap">
                <div className="flex items-center gap-1.5">
                  <RadioGroupItem value="low" id="sev-low" />
                  <Label htmlFor="sev-low" className="text-xs text-gray-700 font-normal">Faible</Label>
                </div>
                <div className="flex items-center gap-1.5">
                  <RadioGroupItem value="medium" id="sev-medium" />
                  <Label htmlFor="sev-medium" className="text-xs text-amber-700 font-normal">Moyen</Label>
                </div>
                <div className="flex items-center gap-1.5">
                  <RadioGroupItem value="high" id="sev-high" />
                  <Label htmlFor="sev-high" className="text-xs text-orange-700 font-normal">Eleve</Label>
                </div>
                <div className="flex items-center gap-1.5">
                  <RadioGroupItem value="critical" id="sev-critical" />
                  <Label htmlFor="sev-critical" className="text-xs text-red-700 font-normal">Critique</Label>
                </div>
              </RadioGroup>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Description</Label>
              <Textarea
                placeholder="Decrivez l'incident en detail..."
                value={incidentDescription}
                onChange={(e) => setIncidentDescription(e.target.value)}
                rows={4}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setReportingRide(null)}>Annuler</Button>
              <Button
                className="bg-red-600 hover:bg-red-700 text-white"
                disabled={!incidentDescription.trim() || reportMutation.isPending}
                onClick={() => {
                  if (!reportingRide) return
                  reportMutation.mutate({
                    reporterId: reportingRide.driverId ?? reportingRide.passengerId ?? "admin",
                    rideId: reportingRide.id,
                    type: incidentType,
                    severity: incidentSeverity,
                    description: incidentDescription.trim(),
                  })
                }}
              >
                {reportMutation.isPending ? "Envoi en cours..." : "Envoyer le signalement"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Refund Dialog */}
      <Dialog open={!!refundingRide} onOpenChange={(open) => { if (!open) setRefundingRide(null) }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RefreshCcw className="h-5 w-5 text-amber-500" />
              Remboursement
            </DialogTitle>
            <DialogDescription>Traiter un remboursement pour la course {refundingRide?.id}</DialogDescription>
          </DialogHeader>
          {refundingRide && (
            <div className="space-y-4">
              {/* Ride Details Summary */}
              <div className="rounded-lg bg-muted/50 p-3 space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Details de la course</p>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">Passager</p>
                    <p className="font-medium">{refundingRide.passenger?.name ?? "Inconnu"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Chauffeur</p>
                    <p className="font-medium">{refundingRide.driver?.name ?? "Non assigne"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Trajet</p>
                    <p className="font-medium">{refundingRide.pickupZone} <ChevronRight className="inline h-3 w-3 text-muted-foreground" /> {refundingRide.dropoffZone}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Date</p>
                    <p className="font-medium">{formatDateTime(refundingRide.createdAt)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Tarif original</p>
                    <p className="font-semibold text-amber-600">{formatGNF(refundingRide.actualFare ?? refundingRide.estimatedFare)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Statut</p>
                    <StatusBadge status={refundingRide.status as RideStatus} />
                  </div>
                </div>
              </div>

              {/* Amount Input */}
              <div className="space-y-2">
                <Label htmlFor="refund-amount" className="text-sm font-medium">Montant du remboursement</Label>
                <div className="relative">
                  <Input
                    id="refund-amount"
                    type="number"
                    min={0}
                    value={refundAmount}
                    onChange={(e) => setRefundAmount(e.target.value)}
                    className="pr-12"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-medium">GNF</span>
                </div>
                {Number(refundAmount) > (refundingRide.actualFare ?? refundingRide.estimatedFare ?? 0) && (
                  <p className="text-xs text-red-500">Le montant ne peut pas depasser le tarif de la course</p>
                )}
              </div>

              {/* Reason Textarea */}
              <div className="space-y-2">
                <Label htmlFor="refund-reason" className="text-sm font-medium">
                  Raison du remboursement <span className="text-red-500">*</span>
                </Label>
                <Textarea
                  id="refund-reason"
                  placeholder="Ex: Retard important, mauvaise destination, vehicule non conforme..."
                  value={refundReason}
                  onChange={(e) => setRefundReason(e.target.value)}
                  rows={3}
                />
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setRefundingRide(null)}>Annuler</Button>
                <Button
                  className="bg-amber-500 hover:bg-amber-600 text-white"
                  disabled={!refundReason.trim() || Number(refundAmount) <= 0 || Number(refundAmount) > (refundingRide.actualFare ?? refundingRide.estimatedFare ?? 0)}
                  onClick={async () => {
                    if (!refundingRide) return
                    const amount = Number(refundAmount)
                    const token = localStorage.getItem('mova_token')
                    try {
                      const res = await fetch(`/api/mova/rides/${refundingRide.id}`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                        body: JSON.stringify({ status: 'refunded', amount, reason: refundReason }),
                      })
                      if (res.ok) {
                        toast.success(`Remboursement de ${formatGNF(amount)} traité pour la course ${refundingRide.id}`)
                        setRefundingRide(null)
                      } else {
                        toast.error('Erreur lors du remboursement')
                      }
                    } catch {
                      toast.error('Erreur réseau')
                    }
                  }}
                >
                  <RefreshCcw className="h-4 w-4 mr-2" />
                  Confirmer le remboursement
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ──────────────────────────────────────────────
// Section: Users
// ──────────────────────────────────────────────

function UsersSection() {
  const [search, setSearch] = useState("")
  const [roleFilter, setRoleFilter] = useState<string>("all")
  const [selectedPassenger, setSelectedPassenger] = useState<{ id: string; name: string; phone: string; email: string; totalRides: number; lastRide: string; zone: string; rating: number; joinDate: string } | null>(null)

  const { data: analytics, isLoading: analyticsLoading, error: analyticsError, refetch: refetchAnalytics } = useAnalytics()
  const { data: ridesResponse, isLoading: ridesLoading, error: ridesError, refetch: refetchRides } = useRides({ limit: 100 })

  const totalPassengers = analytics?.stats?.totalPassengers ?? 0
  const allRides = ridesResponse?.rides ?? []

  // Derive unique passengers from rides
  const passengers = useMemo(() => {
    const map = new Map<string, { id: string; name: string; phone: string; email: string; totalRides: number; lastRide: string; zone: string; rating: number; joinDate: string }>()
    for (const ride of allRides) {
      const p = ride.passenger
      if (!p) continue
      const existing = map.get(p.id)
      if (existing) {
        existing.totalRides += 1
        const rideDate = new Date(ride.createdAt)
        const existingDate = new Date(existing.lastRide)
        if (rideDate > existingDate) {
          existing.lastRide = ride.createdAt as string
          existing.zone = ride.pickupZone
          existing.rating = ride.driverRating ?? existing.rating
        }
      } else {
        map.set(p.id, {
          id: p.id,
          name: p.name,
          phone: p.phone ?? "",
          email: p.email ?? "",
          totalRides: 1,
          lastRide: ride.createdAt as string,
          zone: ride.pickupZone,
          rating: ride.driverRating ?? 0,
          joinDate: ride.createdAt as string,
        })
      }
    }
    return Array.from(map.values())
  }, [allRides])

  const filteredPassengers = useMemo(() => {
    if (!search && roleFilter === "all") return passengers
    return passengers.filter((p) => {
      if (search) {
        const q = search.toLowerCase()
        if (!p.name.toLowerCase().includes(q) && !p.email.toLowerCase().includes(q) && !p.phone.includes(q)) return false
      }
      if (roleFilter === "active" && p.totalRides < 3) return false
      return true
    })
  }, [passengers, search, roleFilter])

  const newThisWeek = passengers.filter((p) => {
    const d = new Date(p.joinDate)
    const now = new Date()
    return (now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24) <= 7
  }).length
  const activeToday = passengers.filter((p) => {
    const d = new Date(p.lastRide)
    const now = new Date()
    return (now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24) <= 1
  }).length

  // Compute passenger rides and stats
  const passengerRides = useMemo(() => {
    if (!selectedPassenger) return []
    return allRides
      .filter(r => r.passengerId === selectedPassenger.id)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 10)
  }, [selectedPassenger, allRides])

  const passengerTotalSpent = useMemo(() => {
    if (!selectedPassenger) return 0
    return allRides
      .filter(r => r.passengerId === selectedPassenger.id && r.status === "completed")
      .reduce((s, r) => s + (r.actualFare ?? r.estimatedFare ?? 0), 0)
  }, [selectedPassenger, allRides])

  if (analyticsLoading || ridesLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <Card key={i}><CardContent className="p-4"><Skeleton className="h-10 w-10 rounded-xl mb-2" /><Skeleton className="h-6 w-24" /></CardContent></Card>
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <Card key={i}><CardContent className="p-4 space-y-3"><Skeleton className="h-10 w-10 rounded-full" /><Skeleton className="h-4 w-32" /><Skeleton className="h-16 w-full" /></CardContent></Card>
          ))}
        </div>
      </div>
    )
  }

  if ((analyticsError || ridesError) && !analyticsLoading && !ridesLoading) {
    return (
      <ErrorBanner
        message="Impossible de charger les donnees des utilisateurs"
        onRetry={() => { refetchAnalytics(); refetchRides() }}
      />
    )
  }

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100">
              <Users className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-xl font-bold">{totalPassengers}</p>
              <p className="text-xs text-muted-foreground">Total passagers</p>
            </div>
          </CardContent>
        </Card>
        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100">
              <UserPlus className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-xl font-bold">{newThisWeek}</p>
              <p className="text-xs text-muted-foreground">Nouveaux cette semaine</p>
            </div>
          </CardContent>
        </Card>
        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100">
              <Clock className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-xl font-bold">{activeToday}</p>
              <p className="text-xs text-muted-foreground">Actifs aujourd'hui</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Rechercher par nom, email, telephone..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
            </div>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-full sm:w-40">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Filtrer" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous</SelectItem>
                <SelectItem value="active">Actifs (3+ courses)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* User Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredPassengers.length === 0 && !ridesLoading ? (
          <div className="col-span-full text-center py-12 text-muted-foreground text-sm">
            Aucun passager trouve
          </div>
        ) : (
          filteredPassengers.map((p) => (
            <Card key={p.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarFallback className="bg-emerald-100 text-emerald-700 text-xs font-bold">
                        {getInitials(p.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-semibold">{p.name}</p>
                      <div className="flex items-center gap-1 mt-0.5">
                        <Phone className="h-3 w-3 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">{p.phone || "-"}</span>
                      </div>
                    </div>
                  </div>
                </div>
                <Separator className="my-3" />
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <p className="text-muted-foreground">Zone</p>
                    <p className="font-medium">{p.zone || "-"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Note</p>
                    <div className="flex items-center gap-1">
                      <Star className="h-3 w-3 text-amber-500 fill-amber-500" />
                      <span className="font-medium">{p.rating > 0 ? p.rating.toFixed(1) : "-"}</span>
                    </div>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Courses</p>
                    <p className="font-medium">{p.totalRides}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Derniere course</p>
                    <p className="font-medium">{formatDate(p.lastRide)}</p>
                  </div>
                </div>
                <Separator className="my-3" />
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" className="flex-1 text-xs h-8" onClick={() => setSelectedPassenger(p)}>
                    <Eye className="h-3 w-3 mr-1" />
                    Voir courses
                  </Button>
                  <Button variant="outline" size="sm" className="flex-1 text-xs h-8" onClick={async () => {
                    try {
                      const res = await fetch("/api/mova/notifications", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          userId: p.id,
                          type: "system" as const,
                          title: "Notification admin",
                          message: `Message de l'administration MOVA`,
                        }),
                      })
                      if (!res.ok) throw new Error()
                      toast.success("Notification envoyee a " + p.name)
                    } catch {
                      toast.error("Erreur lors de l'envoi de la notification")
                    }
                  }}>
                    <MessageSquare className="h-3 w-3 mr-1" />
                    Notifier
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Passenger Ride History Dialog */}
      <Dialog open={!!selectedPassenger} onOpenChange={(open) => { if (!open) setSelectedPassenger(null) }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto mova-scrollbar">
          <DialogHeader>
            <DialogTitle>Historique des courses</DialogTitle>
            <DialogDescription>Details du passager et ses reservations</DialogDescription>
          </DialogHeader>
          {selectedPassenger && (
            <div className="space-y-4">
              {/* Passenger header */}
              <div className="flex items-center gap-4">
                <Avatar className="h-14 w-14">
                  <AvatarFallback className="bg-emerald-100 text-emerald-700 text-lg font-bold">
                    {getInitials(selectedPassenger.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <p className="text-lg font-bold">{selectedPassenger.name}</p>
                  <div className="flex flex-col gap-0.5 mt-1 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1"><Phone className="h-3.5 w-3.5" /> {selectedPassenger.phone || "-"}</span>
                    {selectedPassenger.email && (
                      <span className="flex items-center gap-1"><Mail className="h-3.5 w-3.5" /> {selectedPassenger.email}</span>
                    )}
                    <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" /> Inscrit le {formatDate(selectedPassenger.joinDate)}</span>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Stats */}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg bg-emerald-50 p-3">
                  <p className="text-xs text-emerald-700 font-medium">Total courses</p>
                  <p className="text-xl font-bold text-emerald-800">{selectedPassenger.totalRides}</p>
                </div>
                <div className="rounded-lg bg-amber-50 p-3">
                  <p className="text-xs text-amber-700 font-medium">Total depense</p>
                  <p className="text-xl font-bold text-amber-800">{formatCompactGNF(passengerTotalSpent)}</p>
                </div>
              </div>

              <Separator />

              {/* Recent rides */}
              <div>
                <p className="text-sm font-semibold mb-2">Reservations recentes</p>
                {passengerRides.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Aucune course trouvee</p>
                ) : (
                  <div className="space-y-2 max-h-80 overflow-y-auto mova-scrollbar">
                    {passengerRides.map((ride) => (
                      <div key={ride.id} className="rounded-lg bg-muted p-3">
                        <div className="flex items-center justify-between mb-1.5">
                          <StatusBadge status={ride.status as RideStatus} />
                          <span className="text-xs text-muted-foreground">{formatDateTime(ride.createdAt)}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-sm mb-1">
                          <span className="font-medium truncate">{ride.pickupZone}</span>
                          <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />
                          <span className="font-medium truncate">{ride.dropoffZone}</span>
                        </div>
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          {ride.distance && <span>{ride.distance} km</span>}
                          {ride.duration && <span>{ride.duration} min</span>}
                          <span className="font-medium text-foreground">{formatGNF(ride.actualFare ?? ride.estimatedFare)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <Separator />

              {/* Close button */}
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => setSelectedPassenger(null)}
              >
                Fermer
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}



// ──────────────────────────────────────────────
// Section: Drivers
// ──────────────────────────────────────────────

function DriversSection() {
  const [search, setSearch] = useState("")
  const [approvalFilter, setApprovalFilter] = useState<string>("all")
  const [selectedDriver, setSelectedDriver] = useState<DriverData | null>(null)

  const { data: driversData, isLoading: driversLoading, error: driversError, refetch: refetchDrivers } = useDrivers()
  const { data: ridesResponse } = useRides({ limit: 100 })

  const allDrivers = driversData ?? []
  const allRides = ridesResponse?.rides ?? []

  const updateDriverMutation = useUpdateDriver({
    onSuccess: (_data, variables) => {
      toast.success(`Chauffeur ${variables.data.isOnline ? "mis en ligne" : "mis hors ligne"}`)
    },
    onError: (err) => {
      toast.error("Erreur: " + err.message)
    },
  })

  // Compute driver recent rides (last 5)
  const driverRecentRides = useMemo(() => {
    if (!selectedDriver) return []
    return allRides
      .filter(r => r.driverId === selectedDriver.id)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 5)
  }, [selectedDriver, allRides])

  // Compute driver stats
  const driverStats = useMemo(() => {
    if (!selectedDriver) return { totalRides: 0, completedRides: 0, avgRating: 0, totalEarnings: 0 }
    const driverRides = allRides.filter(r => r.driverId === selectedDriver.id)
    const completed = driverRides.filter(r => r.status === "completed")
    const totalEarnings = completed.reduce((s, r) => s + (r.actualFare ?? r.estimatedFare ?? 0), 0)
    const ratedRides = completed.filter(r => r.driverRating != null && r.driverRating > 0)
    const avgRating = ratedRides.length > 0
      ? ratedRides.reduce((s, r) => s + (r.driverRating ?? 0), 0) / ratedRides.length
      : 0
    return {
      totalRides: driverRides.length,
      completedRides: completed.length,
      avgRating,
      totalEarnings,
    }
  }, [selectedDriver, allRides])

  const filteredDrivers = useMemo(() => {
    return allDrivers.filter((d) => {
      if (search) {
        const q = search.toLowerCase()
        if (!d.name.toLowerCase().includes(q) && !d.phone.includes(q)) return false
      }
      return true
    })
  }, [allDrivers, search])

  const totalDrivers = allDrivers.length
  const onlineDrivers = allDrivers.filter((d) => d.isOnline).length
  const avgRating = allDrivers.filter((d) => (d.rating ?? 0) > 0).length > 0
    ? (allDrivers.filter((d) => (d.rating ?? 0) > 0).reduce((s, d) => s + (d.rating ?? 0), 0) / allDrivers.filter((d) => (d.rating ?? 0) > 0).length).toFixed(1)
    : "0"

  if (driversLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <Card key={i}><CardContent className="p-4 space-y-3">
              <Skeleton className="h-10 w-10 rounded-full" />
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-16 w-full rounded-lg" />
            </CardContent></Card>
          ))}
        </div>
      </div>
    )
  }

  if (driversError && !driversLoading) {
    return (
      <ErrorBanner message="Impossible de charger la liste des chauffeurs" onRetry={() => refetchDrivers()} />
    )
  }

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100">
              <Users className="h-5 w-5 text-slate-600" />
            </div>
            <div>
              <p className="text-xl font-bold">{totalDrivers}</p>
              <p className="text-xs text-muted-foreground">Total chauffeurs</p>
            </div>
          </CardContent>
        </Card>
        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100">
              <CircleDot className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-xl font-bold">{onlineDrivers}</p>
              <p className="text-xs text-muted-foreground">En ligne</p>
            </div>
          </CardContent>
        </Card>
        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100">
              <Star className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-xl font-bold">{avgRating}</p>
              <p className="text-xs text-muted-foreground">Note moyenne</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Rechercher par nom, telephone..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Driver Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {driversLoading ? (
          [...Array(6)].map((_, i) => (
            <Card key={i} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4 space-y-4">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                </div>
                <Skeleton className="h-16 w-full rounded-lg" />
                <div className="grid grid-cols-3 gap-2">
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-full" />
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          filteredDrivers.map((d) => {
            const vehicle = d.vehicles?.[0]
            const totalRides = d.completedRides ?? 0
            return (
          <Card key={d.id} className="hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <Avatar className="h-10 w-10">
                      <AvatarFallback className="bg-emerald-100 text-emerald-700 text-xs font-bold">
                        {getInitials(d.name)}
                      </AvatarFallback>
                    </Avatar>
                    {d.isOnline && (
                      <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-emerald-500 border-2 border-white" />
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{d.name}</p>
                    <p className="text-xs text-muted-foreground">{d.phone}</p>
                  </div>
                </div>
                <Badge className={cn(
                  "text-[10px]",
                  d.isOnline ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-600"
                )}>
                  {d.isOnline ? "En ligne" : "Hors ligne"}
                </Badge>
              </div>

              <Separator className="my-3" />

              {/* Vehicle info */}
              {vehicle && (
              <div className="rounded-lg bg-muted p-2.5 mb-3">
                <p className="text-xs font-medium text-muted-foreground mb-1">Vehicule</p>
                <p className="text-sm font-medium">{vehicle.make ?? ""} {vehicle.model ?? ""}</p>
                <p className="text-xs text-muted-foreground">{vehicle.color ?? ""} - {vehicle.plateNumber ?? ""} ({vehicle.type})</p>
              </div>
              )}

              {/* Stats */}
              <div className="grid grid-cols-3 gap-2 text-xs mb-3">
                <div>
                  <p className="text-muted-foreground">Zone</p>
                  <p className="font-medium">{d.zone ?? "-"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Note</p>
                  <div className="flex items-center gap-1">
                    <Star className="h-3 w-3 text-amber-500 fill-amber-500" />
                    <span className="font-medium">{d.rating ?? "-"}</span>
                  </div>
                </div>
                <div>
                  <p className="text-muted-foreground">Courses</p>
                  <p className="font-medium">{totalRides}</p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className={cn(
                    "flex-1 text-xs h-8",
                    d.isOnline
                      ? "text-red-600 border-red-300 hover:bg-red-50"
                      : "text-emerald-600 border-emerald-300 hover:bg-emerald-50"
                  )}
                  onClick={() => updateDriverMutation.mutate({ id: d.id, data: { isOnline: !d.isOnline } })}
                >
                  {d.isOnline ? (
                    <>
                      <ToggleLeft className="h-3 w-3 mr-1" />
                      Hors ligne
                    </>
                  ) : (
                    <>
                      <CircleDot className="h-3 w-3 mr-1" />
                      En ligne
                    </>
                  )}
                </Button>
                <Button variant="outline" size="sm" className="text-xs h-8" onClick={() => setSelectedDriver(d)}>
                  <Eye className="h-3 w-3 mr-1" />
                  Profil
                </Button>
              </div>
            </CardContent>
          </Card>
            )
          })
        )}
      </div>

      {/* Driver Profile Dialog */}
      <Dialog open={!!selectedDriver} onOpenChange={(open) => { if (!open) setSelectedDriver(null) }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto mova-scrollbar">
          <DialogHeader>
            <DialogTitle>Profil du chauffeur</DialogTitle>
            <DialogDescription>Informations detaillees et statistiques</DialogDescription>
          </DialogHeader>
          {selectedDriver && (() => {
            const vehicle = selectedDriver.vehicles?.[0]
            return (
              <div className="space-y-4">
                {/* Driver header */}
                <div className="flex items-center gap-4">
                  <Avatar className="h-14 w-14">
                    <AvatarFallback className="bg-emerald-100 text-emerald-700 text-lg font-bold">
                      {getInitials(selectedDriver.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-lg font-bold">{selectedDriver.name}</p>
                      <Badge className={cn(
                        "text-[10px]",
                        selectedDriver.isOnline ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-600"
                      )}>
                        {selectedDriver.isOnline ? "En ligne" : "Hors ligne"}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1"><Phone className="h-3.5 w-3.5" /> {selectedDriver.phone}</span>
                      {selectedDriver.email && (
                        <span className="flex items-center gap-1"><Mail className="h-3.5 w-3.5" /> {selectedDriver.email}</span>
                      )}
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Vehicle info */}
                {vehicle && (
                  <div className="rounded-lg bg-muted p-3">
                    <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">Vehicule</p>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <p className="text-xs text-muted-foreground">Marque / Modele</p>
                        <p className="font-medium">{vehicle.make ?? "-"} {vehicle.model ?? ""}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Immatriculation</p>
                        <p className="font-medium">{vehicle.plateNumber ?? "-"}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Couleur</p>
                        <p className="font-medium">{vehicle.color ?? "-"}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Type</p>
                        <p className="font-medium">{vehicle.type}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Stats grid */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg bg-emerald-50 p-3">
                    <p className="text-xs text-emerald-700 font-medium">Total courses</p>
                    <p className="text-xl font-bold text-emerald-800">{driverStats.totalRides}</p>
                  </div>
                  <div className="rounded-lg bg-amber-50 p-3">
                    <p className="text-xs text-amber-700 font-medium">Note moyenne</p>
                    <div className="flex items-center gap-1">
                      <p className="text-xl font-bold text-amber-800">{driverStats.avgRating > 0 ? driverStats.avgRating.toFixed(1) : "-"}</p>
                      {driverStats.avgRating > 0 && <Star className="h-4 w-4 text-amber-500 fill-amber-500" />}
                    </div>
                  </div>
                  <div className="rounded-lg bg-emerald-50 p-3">
                    <p className="text-xs text-emerald-700 font-medium">Revenus totaux</p>
                    <p className="text-xl font-bold text-emerald-800">{formatCompactGNF(driverStats.totalEarnings)}</p>
                  </div>
                  <div className="rounded-lg bg-slate-50 p-3">
                    <p className="text-xs text-slate-700 font-medium">Statut</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={cn("h-2.5 w-2.5 rounded-full", selectedDriver.isOnline ? "bg-emerald-500" : "bg-gray-400")} />
                      <p className="text-lg font-bold">{selectedDriver.isOnline ? "Actif" : "Inactif"}</p>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Recent rides */}
                <div>
                  <p className="text-sm font-semibold mb-2">Courses recentes</p>
                  {driverRecentRides.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Aucune course trouvee</p>
                  ) : (
                    <div className="space-y-2 max-h-64 overflow-y-auto mova-scrollbar">
                      {driverRecentRides.map((ride) => (
                        <div key={ride.id} className="flex items-center justify-between rounded-lg bg-muted p-2.5">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1 text-sm">
                              <span className="truncate">{ride.pickupZone}</span>
                              <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />
                              <span className="truncate">{ride.dropoffZone}</span>
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">{formatDateTime(ride.createdAt)}</p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0 ml-2">
                            <StatusBadge status={ride.status as RideStatus} />
                            <span className="text-sm font-medium">{formatGNF(ride.actualFare ?? ride.estimatedFare)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <Separator />

                {/* Action buttons */}
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className={cn(
                      "flex-1",
                      selectedDriver.isActive !== false
                        ? "text-red-600 border-red-300 hover:bg-red-50"
                        : "text-emerald-600 border-emerald-300 hover:bg-emerald-50"
                    )}
                    onClick={() => {
                      updateDriverMutation.mutate({ id: selectedDriver.id, data: { isActive: selectedDriver.isActive === false } })
                      setSelectedDriver(null)
                    }}
                  >
                    {selectedDriver.isActive !== false ? (
                      <><Ban className="h-3.5 w-3.5 mr-1" /> Suspendre</>
                    ) : (
                      <><CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Activer</>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => {
                      setSelectedDriver(null)
                    }}
                  >
                    Fermer
                  </Button>
                </div>
              </div>
            )
          })()}
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ──────────────────────────────────────────────
// Section: Revenue
// ──────────────────────────────────────────────

function RevenueSection() {
  const [dateRange, setDateRange] = useState<string>("month")

  const { data: analytics, isLoading: analyticsLoading, error: analyticsError, refetch: refetchAnalytics } = useAnalytics()
  const { data: driversData, isLoading: driversLoading } = useDrivers()
  const { data: ridesDataForPayments } = useRides({ limit: 200 })

  const totalRevenue = analytics?.stats?.totalRevenue ?? 0
  const totalRides = analytics?.stats?.totalRides ?? 0
  const revenueByDay = analytics?.revenueByDay ?? []
  const drivers = driversData ?? []
  const allRidesForPayments = ridesDataForPayments?.rides ?? []

  // Derive monthly revenue from daily data
  const monthlyRevenueData = revenueByDay.length === 0
    ? monthlyRevenueChartData
    : (() => {
        const monthMap = new Map<string, number>()
        for (const d of revenueByDay) {
          const date = new Date(d.day)
          const key = date.toLocaleDateString("fr-FR", { month: "short" })
          monthMap.set(key, (monthMap.get(key) ?? 0) + d.revenue)
        }
        return Array.from(monthMap.entries()).map(([month, amount]) => ({ month, amount }))
      })()

  // Derive top drivers from driver list
  const topDriversData = (() => {
    const sorted = [...drivers]
      .filter((d) => (d.completedRides ?? 0) > 0)
      .sort((a, b) => (b.completedRides ?? 0) - (a.completedRides ?? 0))
      .slice(0, 5)
    if (sorted.length === 0) return topDriversChartData
    return sorted.map((d) => ({
      name: d.name,
      earnings: (d.completedRides ?? 0) * 15000,
      rides: d.completedRides ?? 0,
    }))
  })()

  // Derive payment methods breakdown from rides payments
  const derivedPaymentMethods = (() => {
    const methodCounts: Record<string, number> = {}
    for (const ride of allRidesForPayments) {
      if (ride.payments && ride.payments.length > 0) {
        for (const payment of ride.payments) {
          const method = payment.method || "cash"
          methodCounts[method] = (methodCounts[method] ?? 0) + 1
        }
      } else {
        methodCounts["cash"] = (methodCounts["cash"] ?? 0) + 1
      }
    }
    if (Object.keys(methodCounts).length === 0) return paymentMethodsChartData
    const total = Object.values(methodCounts).reduce((s, v) => s + v, 0)
    const colorMap: Record<string, string> = { cash: "#f59e0b", wallet: "#10b981", mobile_money: "#f97316", card: "#14b8a6" }
    const labelMap: Record<string, string> = { cash: "Cash", wallet: "Wallet", mobile_money: "Mobile Money", card: "Carte" }
    return Object.entries(methodCounts).map(([method, count]) => ({
      name: labelMap[method] ?? method,
      value: Math.round((count / total) * 100),
      color: colorMap[method] ?? "#9ca3af",
    }))
  })()

  // Compute range values from real data
  const dayRevenue = revenueByDay.length > 0 ? revenueByDay[revenueByDay.length - 1].revenue : totalRevenue
  const weekRevenue = revenueByDay.slice(-7).reduce((s, d) => s + d.revenue, 0)
  const projected = totalRevenue > 0 ? Math.round(totalRevenue * 1.2) : 0
  const commissionRate = 0.15
  const commissionEarned = Math.round(totalRevenue * commissionRate)

  const rangeValues: Record<string, { label: string; today: number; total: number; projected: number }> = {
    today: { label: "Aujourd'hui", today: dayRevenue, total: dayRevenue, projected: Math.round(dayRevenue * 1.3) },
    week: { label: "Cette semaine", today: dayRevenue, total: weekRevenue, projected: Math.round(weekRevenue * 1.2) },
    month: { label: "Ce mois", today: dayRevenue, total: totalRevenue, projected },
  }

  const current = rangeValues[dateRange]

  if (analyticsLoading || driversLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}><CardContent className="p-4"><Skeleton className="h-4 w-24 mb-2" /><Skeleton className="h-7 w-32" /></CardContent></Card>
          ))}
        </div>
        <Card><CardContent className="p-6"><Skeleton className="h-[280px] w-full rounded-lg" /></CardContent></Card>
      </div>
    )
  }

  if (analyticsError && !analyticsLoading) {
    return (
      <ErrorBanner message="Impossible de charger les donnees de revenus" onRetry={() => refetchAnalytics()} />
    )
  }

  return (
    <div className="space-y-6">
      {/* Date range selector */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <Select value={dateRange} onValueChange={setDateRange}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">Aujourd'hui</SelectItem>
                <SelectItem value="week">Cette semaine</SelectItem>
                <SelectItem value="month">Ce mois</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Aujourd'hui</p>
            <p className="text-xl font-bold mt-1">{formatGNF(current.today)}</p>
            <div className="flex items-center gap-1 text-emerald-600 text-xs mt-1">
              <ArrowUpRight className="h-3 w-3" />
              <span>Revenus du jour</span>
            </div>
          </CardContent>
        </Card>
        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">{current.label}</p>
            <p className="text-xl font-bold mt-1">{formatGNF(current.total)}</p>
            <p className="text-xs text-muted-foreground mt-1">{totalRides} courses</p>
          </CardContent>
        </Card>
        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Projection</p>
            <p className="text-xl font-bold mt-1">{formatGNF(current.projected)}</p>
          </CardContent>
        </Card>
        <Card className="hover:shadow-md transition-shadow border-emerald-200 bg-emerald-50/50">
          <CardContent className="p-4">
            <p className="text-xs text-emerald-700 font-medium">Commission ({(commissionRate * 100).toFixed(0)}%)</p>
            <p className="text-xl font-bold mt-1 text-emerald-700">{formatGNF(commissionEarned)}</p>
            <p className="text-xs text-emerald-600 mt-1">Revenus plate-forme</p>
          </CardContent>
        </Card>
      </div>

      {/* Monthly Revenue Chart */}
      <Card className="hover:shadow-md transition-shadow">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Revenus quotidiens</CardTitle>
          <CardDescription>Total : {formatCompactGNF(totalRevenue)}</CardDescription>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          <MonthlyRevenueChart data={monthlyRevenueData} />
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Payment Method Breakdown */}
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Repartition par methode de paiement</CardTitle>
            <CardDescription>Basée sur les revenus du mois</CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <PaymentMethodsChart data={derivedPaymentMethods} />
          </CardContent>
        </Card>

        {/* Top Earning Drivers */}
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Meilleurs chauffeurs</CardTitle>
            <CardDescription>Classement par nombre de courses</CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <TopDriversChart data={topDriversData} />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────
// Section: Incidents
// ──────────────────────────────────────────────

function IncidentsSection() {
  const [severityFilter, setSeverityFilter] = useState<string>("all")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [selectedIncident, setSelectedIncident] = useState<IncidentData | null>(null)
  const [resolutionDialog, setResolutionDialog] = useState<{ incidentId: string; action: "resolve" | "close" } | null>(null)
  const [resolutionText, setResolutionText] = useState("")

  const { data: incidentsResponse, isLoading: incidentsLoading, error: incidentsError, refetch: refetchIncidents } = useIncidents({ limit: 100 })

  const allIncidents = incidentsResponse?.data ?? []

  const updateIncidentMutation = useUpdateIncident({
    onSuccess: (_data, variables) => {
      const statusLabels: Record<string, string> = {
        investigating: "Enquete ouverte",
        resolved: "Incident resolu",
        closed: "Incident ferme",
      }
      toast.success(statusLabels[variables.data.status] ?? "Statut mis a jour")
    },
    onError: (err) => {
      toast.error("Erreur: " + err.message)
    },
  })

  const filteredIncidents = useMemo(() => {
    if (!incidentsResponse) return []
    return allIncidents.filter((inc) => {
      if (severityFilter !== "all" && inc.severity !== severityFilter) return false
      if (statusFilter !== "all" && inc.status !== statusFilter) return false
      return true
    })
  }, [allIncidents, severityFilter, statusFilter])

  const openCount = allIncidents.filter((i) => i.status === "open").length
  const investigatingCount = allIncidents.filter((i) => i.status === "investigating").length
  const resolvedCount = allIncidents.filter((i) => i.status === "resolved" || i.status === "closed").length
  const criticalCount = allIncidents.filter((i) => i.severity === "critical" && i.status !== "resolved" && i.status !== "closed").length

  // Derive severity chart data from real incidents
  const severityChartData = (() => {
    const counts: Record<string, number> = {}
    for (const inc of allIncidents) {
      counts[inc.severity] = (counts[inc.severity] ?? 0) + 1
    }
    if (Object.keys(counts).length === 0) return incidentSeverityChartData
    const colorMap: Record<string, string> = { low: "#9ca3af", medium: "#f59e0b", high: "#f97316", critical: "#ef4444" }
    const labelMap: Record<string, string> = { low: "Faible", medium: "Moyen", high: "Eleve", critical: "Critique" }
    return Object.entries(counts).map(([severity, value]) => ({
      name: labelMap[severity] ?? severity,
      value,
      color: colorMap[severity] ?? "#9ca3af",
    }))
  })()

  if (incidentsLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}><CardContent className="p-4"><Skeleton className="h-8 w-8 rounded-lg mb-2" /><Skeleton className="h-6 w-16" /></CardContent></Card>
          ))}
        </div>
        <Card><CardContent className="p-6"><Skeleton className="h-[200px] w-full rounded-lg" /></CardContent></Card>
      </div>
    )
  }

  if (incidentsError && !incidentsLoading) {
    return (
      <ErrorBanner message="Impossible de charger les signalements" onRetry={() => refetchIncidents()} />
    )
  }

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-100">
                <AlertCircle className="h-4 w-4 text-red-600" />
              </div>
              <div>
                <p className="text-xl font-bold text-red-600">{openCount}</p>
                <p className="text-xs text-muted-foreground">Ouverts</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100">
                <Search className="h-4 w-4 text-amber-600" />
              </div>
              <div>
                <p className="text-xl font-bold text-amber-600">{investigatingCount}</p>
                <p className="text-xs text-muted-foreground">Enquetes</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              </div>
              <div>
                <p className="text-xl font-bold text-emerald-600">{resolvedCount}</p>
                <p className="text-xs text-muted-foreground">Resolus</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-100">
                <AlertTriangle className="h-4 w-4 text-red-600" />
              </div>
              <div>
                <p className="text-xl font-bold text-red-600">{criticalCount}</p>
                <p className="text-xs text-muted-foreground">Critiques</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Severity Chart */}
      <Card className="hover:shadow-md transition-shadow">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Signalements par severite</CardTitle>
          <CardDescription>Distribution de la gravite des incidents</CardDescription>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          <IncidentSeverityChart data={severityChartData} />
        </CardContent>
      </Card>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <Select value={severityFilter} onValueChange={setSeverityFilter}>
              <SelectTrigger className="w-full sm:w-44">
                <AlertTriangle className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Severite" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes les severites</SelectItem>
                <SelectItem value="low">Faible</SelectItem>
                <SelectItem value="medium">Moyen</SelectItem>
                <SelectItem value="high">Eleve</SelectItem>
                <SelectItem value="critical">Critique</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-44">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Statut" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les statuts</SelectItem>
                <SelectItem value="open">Ouvert</SelectItem>
                <SelectItem value="investigating">Enquete</SelectItem>
                <SelectItem value="resolved">Resolu</SelectItem>
                <SelectItem value="closed">Ferme</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Incident List */}
      <Card>
        <CardContent className="p-0">
          <div className="divide-y">
            {filteredIncidents.map((inc) => (
              <div key={inc.id} className="p-4 hover:bg-muted/30 transition-colors">
                <div className="flex flex-col sm:flex-row sm:items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs text-muted-foreground">{inc.id.slice(0, 10)}</span>
                      <Badge variant="secondary" className="text-xs">{inc.type}</Badge>
                      <SeverityBadge severity={inc.severity} />
                      <IncidentStatusBadge status={inc.status} />
                    </div>
                    <p className="text-sm mt-1.5">{inc.description}</p>
                    <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        {inc.reported?.role === "driver" ? <Shield className="h-3 w-3" /> : <Users className="h-3 w-3" />}
                        {inc.reporter?.name ?? "Inconnu"}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatDateTime(inc.createdAt)}
                      </span>
                      {inc.rideId && (
                        <span className="flex items-center gap-1">
                          <Car className="h-3 w-3" />
                          {inc.rideId.slice(0, 10)}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {inc.status === "open" && (
                      <Button size="sm" variant="outline" className="text-xs h-7 text-amber-600" onClick={() => updateIncidentMutation.mutate({ id: inc.id, data: { status: "investigating" } })}>
                        <Search className="h-3 w-3 mr-1" />
                        Enqueter
                      </Button>
                    )}
                    {inc.status === "investigating" && (
                      <Button size="sm" variant="outline" className="text-xs h-7 text-emerald-600" onClick={() => { setResolutionDialog({ incidentId: inc.id, action: "resolve" }); setResolutionText("") }}>
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        Resoudre
                      </Button>
                    )}
                    {inc.status === "resolved" && (
                      <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => { setResolutionDialog({ incidentId: inc.id, action: "close" }); setResolutionText("") }}>
                        <XCircle className="h-3 w-3 mr-1" />
                        Fermer
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" className="text-xs h-7" onClick={() => setSelectedIncident(inc)}>
                      <Eye className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
            {filteredIncidents.length === 0 && (
              <div className="p-8 text-center text-muted-foreground text-sm">
                Aucun signalement trouve
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Resolution Dialog */}
      <Dialog open={!!resolutionDialog} onOpenChange={(open) => { if (!open) { setResolutionDialog(null); setResolutionText("") } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {resolutionDialog?.action === "resolve" ? "Resoudre l'incident" : "Fermer l'incident"}
            </DialogTitle>
            <DialogDescription>
              {resolutionDialog?.action === "resolve"
                ? "Renseignez la resolution appliquee avant de confirmer."
                : "Renseignez le motif de cloture avant de confirmer."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Label className="text-xs text-muted-foreground">
              {resolutionDialog?.action === "resolve" ? "Resolution" : "Motif de cloture"}
            </Label>
            <Textarea
              value={resolutionText}
              onChange={(e) => setResolutionText(e.target.value)}
              placeholder={resolutionDialog?.action === "resolve" ? "Decrivez la resolution appliquee..." : "Decrivez le motif de cloture..."}
              rows={4}
              className="text-sm"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setResolutionDialog(null); setResolutionText("") }}>
              Annuler
            </Button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700"
              disabled={!resolutionText.trim()}
              onClick={() => {
                if (!resolutionDialog) return
                const newStatus = resolutionDialog.action === "resolve" ? "resolved" : "closed"
                updateIncidentMutation.mutate({
                  id: resolutionDialog.incidentId,
                  data: { status: newStatus, resolution: resolutionText.trim() },
                })
                setResolutionDialog(null)
                setResolutionText("")
              }}
            >
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Confirmer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Incident Detail Dialog */}
      <Dialog open={!!selectedIncident} onOpenChange={(open) => { if (!open) setSelectedIncident(null) }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Detail du signalement {selectedIncident?.id}</DialogTitle>
            <DialogDescription>Informations completes de l'incident</DialogDescription>
          </DialogHeader>
          {selectedIncident && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Type</p>
                  <Badge variant="secondary" className="text-xs">{selectedIncident.type}</Badge>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Severite</p>
                  <SeverityBadge severity={selectedIncident.severity} />
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Statut</p>
                  <IncidentStatusBadge status={selectedIncident.status} />
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Date de creation</p>
                  <p className="text-sm font-medium">{formatDateTime(selectedIncident.createdAt)}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Signale par</p>
                  <p className="text-sm font-medium">{selectedIncident.reporter?.name ?? "Inconnu"}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Personne signalee</p>
                  <p className="text-sm font-medium">{selectedIncident.reported?.name ?? "-"}</p>
                </div>
              </div>
              {selectedIncident.rideId && (
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Course associee</p>
                  <p className="text-sm font-mono">{selectedIncident.rideId}</p>
                </div>
              )}
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Description</p>
                <div className="rounded-lg bg-muted p-3">
                  <p className="text-sm">{selectedIncident.description}</p>
                </div>
              </div>
              {selectedIncident.resolution && (
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Resolution</p>
                  <div className="rounded-lg bg-emerald-50 p-3">
                    <p className="text-sm text-emerald-800">{selectedIncident.resolution}</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ──────────────────────────────────────────────
// Section: Zones
// ──────────────────────────────────────────────

function ZonesSection() {
  const { data: zonesData, isLoading: zonesLoading, error: zonesError, refetch: refetchZones } = useZones()
  const updateZoneMutation = useUpdateZone({
    onSuccess: (_data, variables) => {
      toast.success(variables.data.isActive ? "Zone activee" : "Zone desactivee")
    },
    onError: (err) => {
      toast.error("Erreur: " + err.message)
    },
  })

  const zones = zonesData ?? []

  if (zonesLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(5)].map((_, i) => (
            <Card key={i} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4 space-y-3">
                <Skeleton className="h-5 w-24" />
                <Skeleton className="h-16 w-full rounded-lg" />
                <Skeleton className="h-4 w-32" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  if (zonesError && !zonesLoading) {
    return (
      <ErrorBanner message="Impossible de charger les zones" onRetry={() => refetchZones()} />
    )
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {zones.map((z) => (
          <Card key={z.id} className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold">{z.name}</CardTitle>
                <Switch
                  checked={z.isActive}
                  onCheckedChange={() => updateZoneMutation.mutate({ id: z.id, data: { isActive: !z.isActive } })}
                  disabled={updateZoneMutation.isPending}
                />
              </div>
              <CardDescription className="text-xs">{z.description ?? "Zone de service"}</CardDescription>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="text-xs text-muted-foreground">
                <p>Rayon : {z.radius ?? "-"} km</p>
                <p>Coordonnees : {z.lat?.toFixed(4) ?? "-"}, {z.lng?.toFixed(4) ?? "-"}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────
// Section: Deliveries
// ──────────────────────────────────────────────

function DeliveriesSection() {
  const { data: deliveriesResponse, isLoading: deliveriesLoading, error: deliveriesError, refetch: refetchDeliveries } = useDeliveries({ limit: 100 })

  const deliveries = deliveriesResponse?.data ?? []
  const totalDeliveries = deliveriesResponse?.pagination?.total ?? deliveries.length
  const inTransit = deliveries.filter((d) => d.status === "in_transit" || d.status === "picked_up").length
  const totalDeliveryRevenue = deliveries.reduce((s, d) => s + (d.actualPrice ?? d.estimatedPrice ?? 0), 0)

  if (deliveriesLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <Card key={i}><CardContent className="p-4"><Skeleton className="h-4 w-24 mb-2" /><Skeleton className="h-7 w-32" /></CardContent></Card>
          ))}
        </div>
      </div>
    )
  }

  if (deliveriesError && !deliveriesLoading) {
    return (
      <ErrorBanner message="Impossible de charger les livraisons" onRetry={() => refetchDeliveries()} />
    )
  }

  const statusLabels: Record<string, { label: string; className: string }> = {
    pending: { label: "En attente", className: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" },
    picked_up: { label: "Recupere", className: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
    in_transit: { label: "En transit", className: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400" },
    delivered: { label: "Livree", className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" },
    cancelled: { label: "Annulee", className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KPICard title="Total livraisons" value={String(totalDeliveries)} icon={Package} iconBg="bg-emerald-100" iconColor="text-emerald-600" />
        <KPICard title="En transit" value={String(inTransit)} icon={Truck} iconBg="bg-amber-100" iconColor="text-amber-600" />
        <KPICard title="Revenus livraisons" value={formatGNF(totalDeliveryRevenue)} icon={DollarSign} iconBg="bg-emerald-100" iconColor="text-emerald-600" />
      </div>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Package className="h-4 w-4 text-emerald-600" />
            Liste des livraisons
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {deliveries.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <Package className="h-10 w-10 mb-3 opacity-40" />
              <p className="text-sm font-medium">Aucune donnee</p>
              <p className="text-xs text-muted-foreground mt-1">Les livraisons apparaitront ici une fois creees.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">ID</TableHead>
                    <TableHead className="text-xs">Expediteur</TableHead>
                    <TableHead className="text-xs">Destinataire</TableHead>
                    <TableHead className="text-xs">Type</TableHead>
                    <TableHead className="text-xs">Montant</TableHead>
                    <TableHead className="text-xs">Statut</TableHead>
                    <TableHead className="text-xs">Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {deliveries.map((d) => {
                    const st = statusLabels[d.status] ?? { label: d.status, className: "bg-muted text-muted-foreground" }
                    return (
                      <TableRow key={d.id}>
                        <TableCell className="text-xs font-mono">{d.id.slice(0, 8)}</TableCell>
                        <TableCell className="text-xs">{d.pickupName}</TableCell>
                        <TableCell className="text-xs">{d.deliveryName}</TableCell>
                        <TableCell className="text-xs">{d.packageType}</TableCell>
                        <TableCell className="text-xs font-semibold">{formatGNF(d.actualPrice ?? d.estimatedPrice)}</TableCell>
                        <TableCell>
                          <Badge className={cn("text-[10px] border-0", st.className)}>{st.label}</Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{formatDateTime(d.createdAt)}</TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// ──────────────────────────────────────────────
// Section: Business
// ──────────────────────────────────────────────

function BusinessSection() {
  const [businesses, setBusinesses] = useState<Array<{
    id: string
    name: string
    email: string
    phone: string | null
    plan: string
    isActive: boolean
    employeeCount: number
    totalSpent: number
    createdAt: string | Date
  }>>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function fetchBusinesses() {
      setIsLoading(true)
      try {
        const res = await fetch("/api/mova/business")
        const json = await res.json()
        if (cancelled) return
        if (json.success && Array.isArray(json.data)) {
          setBusinesses(json.data)
        } else if (Array.isArray(json)) {
          setBusinesses(json)
        }
      } catch {
        // Silently fail — show empty state
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }
    fetchBusinesses()
    return () => { cancelled = true }
  }, [])

  const totalEmployees = businesses.reduce((s, b) => s + (b.employeeCount ?? 0), 0)
  const totalSpent = businesses.reduce((s, b) => s + (b.totalSpent ?? 0), 0)

  const planLabels: Record<string, { label: string; className: string }> = {
    starter: { label: "Starter", className: "bg-stone-100 text-stone-700 dark:bg-stone-900/30 dark:text-stone-400" },
    pro: { label: "Pro", className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" },
    enterprise: { label: "Enterprise", className: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" },
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <Card key={i}><CardContent className="p-4"><Skeleton className="h-4 w-24 mb-2" /><Skeleton className="h-7 w-32" /></CardContent></Card>
          ))}
        </div>
        <Card>
          <CardContent className="p-6 space-y-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="size-10 rounded-full" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-3 w-32" />
                </div>
                <Skeleton className="h-5 w-20" />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KPICard title="Entreprises" value={String(businesses.length)} icon={Building2} iconBg="bg-purple-100" iconColor="text-purple-600" />
        <KPICard title="Employes B2B" value={String(totalEmployees)} icon={Users} iconBg="bg-emerald-100" iconColor="text-emerald-600" />
        <KPICard title="Volume B2B" value={formatCompactGNF(totalSpent)} icon={DollarSign} iconBg="bg-emerald-100" iconColor="text-emerald-600" />
      </div>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Building2 className="h-4 w-4 text-purple-600" />
            Comptes entreprises
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {businesses.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <Building2 className="h-10 w-10 mb-3 opacity-40" />
              <p className="text-sm font-medium">Aucune donnee</p>
              <p className="text-xs text-muted-foreground mt-1">Les comptes entreprises apparaitront ici une fois crees.</p>
            </div>
          ) : (
            <div className="divide-y max-h-96 overflow-y-auto mova-scrollbar">
              {businesses.map((b) => {
                const plan = planLabels[b.plan] ?? { label: b.plan, className: "bg-muted text-muted-foreground" }
                return (
                  <div key={b.id} className="flex items-center gap-3 p-4 hover:bg-muted/50 transition-colors">
                    <div className="w-10 h-10 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center flex-shrink-0">
                      <Building2 className="h-5 w-5 text-purple-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold truncate">{b.name}</p>
                        <Badge className={cn("text-[10px] border-0", plan.className)}>{plan.label}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{b.email}{b.phone ? ` - ${b.phone}` : ""}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-xs font-medium">{b.employeeCount ?? 0} employe{(b.employeeCount ?? 0) > 1 ? "s" : ""}</p>
                      <p className="text-[10px] text-muted-foreground">{formatGNF(b.totalSpent ?? 0)}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// ──────────────────────────────────────────────
// Section: Settings
// ──────────────────────────────────────────────

function SettingsSection() {
  const [settings, setSettings] = useState({
    baseFareStandard: 5000,
    baseFarePremium: 10000,
    baseFareVan: 8000,
    perKmRateStandard: 1200,
    perKmRatePremium: 1800,
    perKmRateVan: 1000,
    surgeMultiplierMax: 3.0,
    commissionRate: 15,
    platformName: "MOVA",
    contactEmail: "contact@mova.gn",
    supportPhone: "+224 622 00 00 00",
    notifyPush: true,
    notifySMS: true,
    notifyEmail: true,
  })

  const { data: zonesData } = useZones()
  const zones = zonesData ?? []

  const updateSetting = (key: string, value: number | string | boolean) => {
    setSettings((prev) => ({ ...prev, [key]: value }))
  }

  const updateZoneMutation = useUpdateZone({
    onSuccess: (_data, variables) => {
      toast.success(variables.data.isActive ? "Zone activee" : "Zone desactivee")
    },
    onError: (err) => {
      toast.error("Erreur: " + err.message)
    },
  })

  const [saving, setSaving] = useState(false)

  const toggleZone = (zoneId: string) => {
    const zone = zones.find(z => z.id === zoneId)
    if (!zone) return
    updateZoneMutation.mutate({ id: zoneId, data: { isActive: !zone.isActive } })
  }

  const handleSaveSettings = async () => {
    setSaving(true)
    try {
      const res = await fetch("/api/mova/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      })
      const json = await res.json()
      if (json.success) {
        toast.success("Parametres sauvegardes avec succes")
      } else {
        toast.error(json.error ?? "Erreur lors de la sauvegarde")
      }
    } catch {
      toast.error("Erreur de connexion au serveur")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Pricing */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-emerald-600" />
            Tarification
          </CardTitle>
          <CardDescription>Tarifs de base et tarifs au kilometre par type de vehicule</CardDescription>
        </CardHeader>
        <CardContent className="p-4 space-y-4">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Type de vehicule</TableHead>
                  <TableHead className="text-xs">Tarif de base (GNF)</TableHead>
                  <TableHead className="text-xs">Tarif/km (GNF)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell className="text-sm font-medium">Standard</TableCell>
                  <TableCell>
                    <Input type="number" value={settings.baseFareStandard} onChange={(e) => updateSetting("baseFareStandard", parseInt(e.target.value))} className="w-32 h-8 text-sm" />
                  </TableCell>
                  <TableCell>
                    <Input type="number" value={settings.perKmRateStandard} onChange={(e) => updateSetting("perKmRateStandard", parseInt(e.target.value))} className="w-32 h-8 text-sm" />
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="text-sm font-medium">Premium</TableCell>
                  <TableCell>
                    <Input type="number" value={settings.baseFarePremium} onChange={(e) => updateSetting("baseFarePremium", parseInt(e.target.value))} className="w-32 h-8 text-sm" />
                  </TableCell>
                  <TableCell>
                    <Input type="number" value={settings.perKmRatePremium} onChange={(e) => updateSetting("perKmRatePremium", parseInt(e.target.value))} className="w-32 h-8 text-sm" />
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="text-sm font-medium">Van</TableCell>
                  <TableCell>
                    <Input type="number" value={settings.baseFareVan} onChange={(e) => updateSetting("baseFareVan", parseInt(e.target.value))} className="w-32 h-8 text-sm" />
                  </TableCell>
                  <TableCell>
                    <Input type="number" value={settings.perKmRateVan} onChange={(e) => updateSetting("perKmRateVan", parseInt(e.target.value))} className="w-32 h-8 text-sm" />
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
          <div className="flex items-center gap-3">
            <Label className="text-sm">Multiplicateur de pointe max</Label>
            <Input type="number" step="0.1" value={settings.surgeMultiplierMax} onChange={(e) => updateSetting("surgeMultiplierMax", parseFloat(e.target.value))} className="w-24 h-8 text-sm" />
            <span className="text-sm text-muted-foreground">x</span>
          </div>
        </CardContent>
      </Card>

      {/* Commission */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-emerald-600" />
            Commission plate-forme
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <Label className="text-sm">Pourcentage de commission</Label>
            <Input type="number" value={settings.commissionRate} onChange={(e) => updateSetting("commissionRate", parseInt(e.target.value))} className="w-24 h-8 text-sm" />
            <span className="text-sm text-muted-foreground">%</span>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Revenu estime ce mois : {formatGNF(Math.round(68500000 * (settings.commissionRate / 100)))}
          </p>
        </CardContent>
      </Card>

      {/* Zones */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <MapIcon className="h-4 w-4 text-emerald-600" />
            Zones operationnelles
          </CardTitle>
          <CardDescription>Activer ou desactiver les zones de service</CardDescription>
        </CardHeader>
        <CardContent className="p-4 space-y-3">
          {zones.map((z) => (
            <div key={z.id} className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">{z.name}</p>
                <p className="text-xs text-muted-foreground">{z.description}</p>
              </div>
              <Switch
                checked={z.isActive}
                onCheckedChange={() => toggleZone(z.id)}
              />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Notifications */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Bell className="h-4 w-4 text-emerald-600" />
            Notifications
          </CardTitle>
          <CardDescription>Gerer les types de notifications envoyees</CardDescription>
        </CardHeader>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Notifications Push</p>
              <p className="text-xs text-muted-foreground">Notifications sur l'application mobile</p>
            </div>
            <Switch checked={settings.notifyPush} onCheckedChange={(v) => updateSetting("notifyPush", v)} />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">SMS</p>
              <p className="text-xs text-muted-foreground">Notifications par SMS</p>
            </div>
            <Switch checked={settings.notifySMS} onCheckedChange={(v) => updateSetting("notifySMS", v)} />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Email</p>
              <p className="text-xs text-muted-foreground">Notifications par email</p>
            </div>
            <Switch checked={settings.notifyEmail} onCheckedChange={(v) => updateSetting("notifyEmail", v)} />
          </div>
        </CardContent>
      </Card>

      {/* General */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Globe className="h-4 w-4 text-emerald-600" />
            Informations generales
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Nom de l'application</Label>
            <Input value={settings.platformName} onChange={(e) => updateSetting("platformName", e.target.value)} className="h-8 text-sm" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Email de contact</Label>
            <Input value={settings.contactEmail} onChange={(e) => updateSetting("contactEmail", e.target.value)} className="h-8 text-sm" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Telephone support</Label>
            <Input value={settings.supportPhone} onChange={(e) => updateSetting("supportPhone", e.target.value)} className="h-8 text-sm" />
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button className="bg-emerald-600 hover:bg-emerald-700" disabled={saving} onClick={handleSaveSettings}>
          <Wrench className="h-4 w-4 mr-2" />
          {saving ? "Sauvegarde en cours..." : "Sauvegarder les parametres"}
        </Button>
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────
// Section Label Helper
// ──────────────────────────────────────────────

const sectionLabels: Record<NavItem, string> = {
  dashboard: "Tableau de bord",
  tracking: "Suivi en temps reel",
  rides: "Gestion des courses",
  users: "Gestion des utilisateurs",
  drivers: "Gestion des chauffeurs",
  revenue: "Analyse des revenus",
  zones: "Zones operationnelles",
  deliveries: "Gestion des livraisons",
  business: "Comptes entreprises",
  incidents: "Signalements",
  settings: "Parametres",
}

// ──────────────────────────────────────────────
// Main Component
// ──────────────────────────────────────────────

export default function AdminView() {
  const {
    user,
    logout,
    setIsLoading,
    goBack,
  } = useAppStore()

  const [activeTab, setActiveTab] = useState<NavItem>("dashboard")
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [showNotifications, setShowNotifications] = useState(false)
  const [showSearchResults, setShowSearchResults] = useState(false)
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Notification system
  const [notifications, setNotifications] = useState<NotificationItem[]>([])

  const unreadCount = useMemo(() => notifications.filter(n => !n.read).length, [notifications])

  useEffect(() => { queueMicrotask(() => setMounted(true)) }, [])

  // Generate demo notifications on mount
  useEffect(() => {
    const now = new Date()
    const makeDate = (minutesAgo: number) => new Date(now.getTime() - minutesAgo * 60000)
    const demoNotifications: NotificationItem[] = [
      {
        id: "n1", type: "ride_requested", title: "Nouvelle course demandee",
        description: "Mamadou Bah a demande une course de Kaloum vers Dixinn",
        timestamp: makeDate(5), read: false,
      },
      {
        id: "n2", type: "payment_received", title: "Paiement recu",
        description: "29 500 GNF via Orange Money - Course C-2025-010",
        timestamp: makeDate(18), read: false,
      },
      {
        id: "n3", type: "ride_completed", title: "Course terminee",
        description: "Course C-2025-009 - Matoto vers Kipe (12 min)",
        timestamp: makeDate(32), read: false,
      },
      {
        id: "n4", type: "driver_registered", title: "Nouveau chauffeur inscrit",
        description: "Abdoul Aziz Bangoura - En attente de validation",
        timestamp: makeDate(55), read: false,
      },
      {
        id: "n5", type: "incident_reported", title: "Signalement critique",
        description: "INC-001 - Accident signale dans la zone de Kipe",
        timestamp: makeDate(90), read: false,
      },
      {
        id: "n6", type: "payment_received", title: "Paiement recu",
        description: "38 000 GNF via Wallet MOVA - Course C-2025-008",
        timestamp: makeDate(120), read: true,
      },
      {
        id: "n7", type: "ride_completed", title: "Course terminee",
        description: "Course C-2025-007 - Kaloum vers Matam (8 min)",
        timestamp: makeDate(180), read: true,
      },
      {
        id: "n8", type: "ride_requested", title: "Nouvelle course demandee",
        description: "Fanta Camara a demande une course de Dixinn vers Ratoma",
        timestamp: makeDate(210), read: true,
      },
      {
        id: "n9", type: "incident_reported", title: "Signalement resolu",
        description: "INC-009 - Vehicule nettoye apres signalement",
        timestamp: makeDate(300), read: true,
      },
      {
        id: "n10", type: "driver_registered", title: "Nouveau chauffeur inscrit",
        description: "Ibrahim Sylla a complete son inscription",
        timestamp: makeDate(420), read: true,
      },
    ]
    queueMicrotask(() => setNotifications(demoNotifications))
  }, [])

  const markAllRead = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
  }, [])

  const markAsRead = useCallback((id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
  }, [])

  const getNotificationIcon = (type: NotificationItem["type"]) => {
    switch (type) {
      case "ride_requested": return <Car className="h-4 w-4 text-amber-500" />
      case "ride_completed": return <CheckCircle2 className="h-4 w-4 text-emerald-500" />
      case "incident_reported": return <AlertTriangle className="h-4 w-4 text-red-500" />
      case "driver_registered": return <UserPlus className="h-4 w-4 text-violet-500" />
      case "payment_received": return <CreditCard className="h-4 w-4 text-amber-500" />
    }
  }

  useEffect(() => {
    setIsLoading(true)
    setTimeout(() => setIsLoading(false), 100)
  }, [setIsLoading])

  // Search functionality
  const { data: searchRidesData } = useRides({ limit: 100 })
  const { data: searchDriversData } = useDrivers()
  const { data: searchIncidentsData } = useIncidents({ limit: 100 })

  const allRides = searchRidesData?.rides ?? []
  const allDrivers = searchDriversData ?? []
  const allIncidents = searchIncidentsData?.data ?? []

  // Derive passengers from rides
  const searchPassengers = useMemo(() => {
    const map = new Map<string, { id: string; name: string; phone: string }>()
    for (const ride of allRides) {
      const p = ride.passenger
      if (!p) continue
      map.set(p.id, { id: p.id, name: p.name, phone: p.phone ?? "" })
    }
    return Array.from(map.values())
  }, [allRides])

  const searchResults = useMemo(() => {
    if (!searchQuery.trim() || searchQuery.length < 2) return []
    const q = searchQuery.toLowerCase().trim()
    const results: SearchResult[] = []

    // Search rides (by ID, passenger name, driver name, zone, status)
    for (const ride of allRides) {
      const passengerName = ride.passenger?.name?.toLowerCase() ?? ""
      const driverName = ride.driver?.name?.toLowerCase() ?? ""
      const rideId = ride.id.toLowerCase()
      const pickupZone = ride.pickupZone?.toLowerCase() ?? ""
      const dropoffZone = ride.dropoffZone?.toLowerCase() ?? ""
      const status = ride.status.toLowerCase()
      const matches =
        rideId.includes(q) ||
        passengerName.includes(q) ||
        driverName.includes(q) ||
        pickupZone.includes(q) ||
        dropoffZone.includes(q) ||
        status.includes(q)
      if (matches) {
        const sc = statusConfig[ride.status as RideStatus]
        results.push({
          type: 'ride', id: ride.id,
          title: `Course ${ride.id.slice(0, 8)}`,
          subtitle: `${ride.pickupZone} → ${ride.dropoffZone} - ${ride.passenger?.name ?? 'N/A'}`,
          status: sc?.label ?? ride.status, statusColor: sc?.color ?? '',
          tab: 'rides',
        })
      }
    }

    // Search drivers (by name, phone, zone)
    for (const driver of allDrivers) {
      const name = driver.name.toLowerCase()
      const phone = driver.phone.toLowerCase()
      const zone = driver.zone?.toLowerCase() ?? ""
      if (name.includes(q) || phone.includes(q) || zone.includes(q)) {
        results.push({
          type: 'driver', id: driver.id,
          title: driver.name,
          subtitle: `${driver.phone}${driver.zone ? ' - ' + driver.zone : ''}${driver.isOnline ? '' : ' (Hors ligne)'}`,
          status: driver.isOnline ? 'En ligne' : 'Hors ligne',
          statusColor: driver.isOnline ? 'text-emerald-700' : 'text-muted-foreground',
          tab: 'drivers',
        })
      }
    }

    // Search passengers (by name, phone)
    for (const p of searchPassengers) {
      const name = p.name.toLowerCase()
      const phone = p.phone.toLowerCase()
      if (name.includes(q) || phone.includes(q)) {
        results.push({
          type: 'passenger', id: p.id,
          title: p.name,
          subtitle: p.phone,
          status: 'Passager', statusColor: 'text-emerald-700',
          tab: 'users',
        })
      }
    }

    // Search incidents (by ID, type, description)
    for (const inc of allIncidents) {
      const incId = inc.id.toLowerCase()
      const desc = inc.description.toLowerCase()
      const incType = inc.type.toLowerCase()
      if (incId.includes(q) || desc.includes(q) || incType.includes(q)) {
        const sev = severityConfig[inc.severity]
        results.push({
          type: 'incident', id: inc.id,
          title: `Signalement ${inc.id.slice(0, 8)}`,
          subtitle: `${inc.type} - ${inc.description.slice(0, 50)}`,
          status: sev?.label ?? inc.severity, statusColor: sev?.color ?? '',
          tab: 'incidents',
        })
      }
    }

    return results.slice(0, 10)
  }, [searchQuery, allRides, allDrivers, searchPassengers, allIncidents])

  const getSearchResultIcon = (type: SearchResult["type"]) => {
    switch (type) {
      case 'ride': return <Car className="h-4 w-4 text-amber-500" />
      case 'driver': return <Shield className="h-4 w-4 text-emerald-500" />
      case 'passenger': return <Users className="h-4 w-4 text-emerald-500" />
      case 'incident': return <AlertTriangle className="h-4 w-4 text-red-500" />
    }
  }

  const handleSearchInputChange = useCallback((value: string) => {
    setSearchQuery(value)
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current)
    searchTimeoutRef.current = setTimeout(() => {
      setShowSearchResults(value.trim().length >= 2)
    }, 300)
  }, [])

  const handleSearchResultClick = useCallback((result: SearchResult) => {
    setActiveTab(result.tab)
    setSearchQuery("")
    setShowSearchResults(false)
    toast.success(`Navigation vers : ${result.title}`)
  }, [])

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (!target.closest('[data-search-container]')) setShowSearchResults(false)
      if (!target.closest('[data-notif-container]')) setShowNotifications(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const handleTabChange = (id: NavItem) => {
    setActiveTab(id)
    setMobileOpen(false)
  }

  const handleLogout = () => {
    logout()
    toast.info("Deconnexion reussie")
  }

  return (
    <div className="flex h-screen w-full overflow-hidden bg-muted/30">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-64 flex-shrink-0">
        <SidebarContent activeTab={activeTab} onTabChange={handleTabChange} userName={user?.name || "Admin MOVA"} onLogout={handleLogout} />
      </aside>

      {/* Mobile sidebar */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-64 p-0">
          <SheetTitle className="sr-only">Menu de navigation</SheetTitle>
          <SidebarContent activeTab={activeTab} onTabChange={handleTabChange} userName={user?.name || "Admin MOVA"} onLogout={handleLogout} />
        </SheetContent>
      </Sheet>

      {/* Main content */}
      <main className="flex-1 overflow-hidden flex flex-col">
        {/* Top bar */}
        <header className="flex items-center gap-4 border-b bg-card px-4 md:px-6 py-3">
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 shrink-0"
            onClick={goBack}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="min-h-[44px] min-w-[44px] lg:hidden" onClick={() => setMobileOpen(true)}>
            <Menu className="h-5 w-5" />
          </Button>

          <div className="flex-1">
            <h1 className="text-lg font-bold">Administration MOVA</h1>
            <p className="text-xs text-muted-foreground hidden sm:block">{fullFrenchDate()} - {currentTime()}</p>
          </div>

          {/* Search */}
          <div className="hidden md:flex items-center relative max-w-xs w-full" data-search-container>
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher courses, chauffeurs..."
              value={searchQuery}
              onChange={(e) => handleSearchInputChange(e.target.value)}
              onFocus={() => searchQuery.trim().length >= 2 && setShowSearchResults(true)}
              className="pl-9 h-9 text-sm"
            />
            {showSearchResults && searchQuery.trim().length >= 2 && (
              <div className="absolute top-full mt-1 left-0 right-0 z-50 bg-card border rounded-lg shadow-lg max-h-96 overflow-y-auto">
                {searchResults.length === 0 ? (
                  <div className="p-4 text-center">
                    <Search className="h-6 w-6 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">Aucun resultat pour "{searchQuery.trim()}"</p>
                  </div>
                ) : (
                  <div className="p-1">
                    {searchResults.map((result) => (
                      <button
                        key={`${result.type}-${result.id}`}
                        onClick={() => handleSearchResultClick(result)}
                        className="w-full flex items-center gap-3 p-2.5 rounded-md hover:bg-accent transition-colors text-left"
                      >
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted/60 flex-shrink-0">
                          {getSearchResultIcon(result.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{result.title}</p>
                          <p className="text-xs text-muted-foreground truncate">{result.subtitle}</p>
                        </div>
                        <Badge variant="secondary" className={cn("text-[10px] flex-shrink-0", result.statusColor)}>
                          {result.status}
                        </Badge>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Theme Toggle */}
          {mounted && (
            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="p-2 rounded-lg hover:bg-accent transition-colors"
              aria-label="Changer de theme"
            >
              {theme === 'dark' ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4 text-slate-600" />}
            </button>
          )}

          {/* Notification bell */}
          <div className="relative" data-notif-container>
            <Button variant="ghost" size="icon" className="relative h-9 w-9" onClick={() => setShowNotifications(!showNotifications)}>
              <Bell className="h-4 w-4" />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-red-500 text-[10px] font-bold text-white flex items-center justify-center">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </Button>
            {showNotifications && (
              <div className="absolute top-full mt-1 right-0 z-50 w-80 sm:w-96 bg-card border rounded-lg shadow-lg">
                <div className="flex items-center justify-between p-3 border-b">
                  <h3 className="text-sm font-semibold">Notifications</h3>
                  {unreadCount > 0 && (
                    <Button variant="ghost" size="sm" className="text-xs h-7 text-emerald-600 hover:text-emerald-700" onClick={markAllRead}>
                      <CheckCheck className="h-3 w-3 mr-1" />
                      Tout marquer comme lu
                    </Button>
                  )}
                </div>
                <div className="max-h-80 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <div className="p-6 text-center">
                      <Bell className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">Aucune notification</p>
                    </div>
                  ) : (
                    <div>
                      {notifications.slice(0, 10).map((notif) => (
                      <button
                        key={notif.id}
                        onClick={() => markAsRead(notif.id)}
                        className={cn(
                          "w-full flex items-start gap-3 p-3 border-b last:border-b-0 hover:bg-accent/50 transition-colors text-left",
                          !notif.read && "bg-emerald-50/50 dark:bg-emerald-950/20"
                        )}
                      >
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted/60 flex-shrink-0 mt-0.5">
                          {getNotificationIcon(notif.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className={cn("text-sm truncate", !notif.read && "font-semibold")}>{notif.title}</p>
                            {!notif.read && (
                              <span className="h-2 w-2 rounded-full bg-emerald-500 flex-shrink-0" />
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{notif.description}</p>
                          <p className="text-[10px] text-muted-foreground mt-1">{relativeTime(notif.timestamp)}</p>
                        </div>
                      </button>
                    ))}
                    </div>
                  )}
                </div>
                <div className="p-2 border-t bg-muted/30">
                  <p className="text-[10px] text-muted-foreground text-center">{notifications.length} notification{notifications.length !== 1 ? 's' : ''} au total</p>
                </div>
              </div>
            )}
          </div>

          {/* Admin avatar */}
          <Avatar className="h-8 w-8">
            <AvatarFallback className="bg-emerald-600 text-white text-xs font-bold">
              {getInitials(user?.name || "AM")}
            </AvatarFallback>
          </Avatar>
        </header>

        {/* Page content */}
        <ScrollArea className="flex-1">
          <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto w-full">
            {/* Section header */}
            <div className="mb-6">
              <h2 className="text-xl font-bold">{sectionLabels[activeTab]}</h2>
              <p className="text-sm text-muted-foreground">
                {activeTab === "dashboard" && "Vue d'ensemble de l'activite MOVA en temps reel"}
                {activeTab === "tracking" && "Suivi en direct des chauffeurs, passagers et courses via le service de tracking"}
                {activeTab === "rides" && "Gerer et suivre toutes les courses de la plate-forme"}
                {activeTab === "users" && "Gerer les comptes passagers et leur activite"}
                {activeTab === "drivers" && "Gerer les chauffeurs, approbations et performances"}
                {activeTab === "revenue" && "Analyser les revenus et commissions"}
                {activeTab === "zones" && "Configurer les zones de service a Conakry"}
                {activeTab === "deliveries" && "Suivre les livraisons colis et documents"}
                {activeTab === "business" && "Gerer les comptes entreprises B2B"}
                {activeTab === "incidents" && "Suivre et resoudre les signalements"}
                {activeTab === "settings" && "Configuration de la plate-forme"}
              </p>
            </div>

            {/* Sections */}
            {activeTab === "dashboard" && <DashboardSection />}
            {activeTab === "tracking" && <AdminTrackingDashboard />}
            {activeTab === "rides" && <RidesSection />}
            {activeTab === "users" && <UsersSection />}
            {activeTab === "drivers" && <DriversSection />}
            {activeTab === "revenue" && <RevenueSection />}
            {activeTab === "zones" && <ZonesSection />}
            {activeTab === "deliveries" && <DeliveriesSection />}
            {activeTab === "business" && <BusinessSection />}
            {activeTab === "incidents" && <IncidentsSection />}
            {activeTab === "settings" && <SettingsSection />}
          </div>
        </ScrollArea>
      </main>
    </div>
  )
}
