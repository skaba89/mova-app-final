'use client'

/**
 * MOVA Notification Center
 * =========================
 * Full notification center with real-time badge updates,
 * smart polling (15 s when open, stopped when closed),
 * API-backed CRUD operations, and a refresh button.
 *
 * Exports:
 * - NotificationCenter (default) — Main Sheet component
 * - useNotificationCount() — Hook returning live unread count for badges
 */

import { useState, useEffect, useRef } from 'react'
import { useAppStore } from '@/lib/mova/store'
import { usePushNotifications } from '@/hooks/use-push-notifications'
import { toast } from 'sonner'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import {
  Bell,
  Car,
  Truck,
  Wallet,
  Gift,
  Shield,
  Info,
  CheckCheck,
  Trash2,
  BellOff,
  BellRing,
  Settings,
  ChevronRight,
  RefreshCw,
  Filter,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

// ─── Types ──────────────────────────────────────────────────────────────

interface NotificationItem {
  id: string
  userId: string
  title: string
  message: string
  type: string
  status: 'read' | 'unread'
  data: string | null
  createdAt: string
}

interface NotificationCenterProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

// ─── Shared Unread Count Store ──────────────────────────────────────────

let globalUnreadCount = 0
const countListeners = new Set<() => void>()

function setGlobalUnreadCount(count: number) {
  if (globalUnreadCount === count) return
  globalUnreadCount = count
  for (const listener of countListeners) {
    listener()
  }
}

/**
 * Hook returning the current unread notification count.
 * Polls the API independently (every 30 s) so that badges
 * stay up-to-date even when the notification panel is closed.
 */
export function useNotificationCount(): number {
  const { user, token } = useAppStore()
  const userId = user?.id
  const [localCount, setLocalCount] = useState(globalUnreadCount)

  // Subscribe to global count changes (from NotificationCenter)
  useEffect(() => {
    const listener = () => setLocalCount(globalUnreadCount)
    countListeners.add(listener)
    return () => {
      countListeners.delete(listener)
    }
  }, [])

  // Independent polling for the badge (always active)
  useEffect(() => {
    if (!userId) return

    function fetchCount() {
      const headers: Record<string, string> = {}
      if (token) headers['Authorization'] = `Bearer ${token}`
      fetch(`/api/mova/notifications?userId=${userId}`, { headers })
        .then((res) => (res.ok ? res.json() : null))
        .then((json) => {
          if (json?.data?.unreadCount !== undefined) {
            setGlobalUnreadCount(json.data.unreadCount)
          }
        })
        .catch(() => {
          setGlobalUnreadCount(0)
        })
    }

    queueMicrotask(fetchCount)
    const interval = setInterval(fetchCount, 30000)
    return () => clearInterval(interval)
  }, [userId, token])

  return localCount
}

// ─── Helpers ────────────────────────────────────────────────────────────

function getTypeIcon(type: string) {
  switch (type) {
    case 'ride':
      return <Car className="h-4 w-4 text-emerald-600" />
    case 'delivery':
      return <Truck className="h-4 w-4 text-amber-600" />
    case 'wallet':
      return <Wallet className="h-4 w-4 text-emerald-500" />
    case 'promo':
      return <Gift className="h-4 w-4 text-amber-500" />
    case 'safety':
      return <Shield className="h-4 w-4 text-red-500" />
    default:
      return <Info className="h-4 w-4 text-muted-foreground" />
  }
}

function getTypeBg(type: string) {
  switch (type) {
    case 'ride':
      return 'bg-emerald-100 dark:bg-emerald-900/30'
    case 'delivery':
      return 'bg-amber-100 dark:bg-amber-900/30'
    case 'wallet':
      return 'bg-emerald-50 dark:bg-emerald-950/40'
    case 'promo':
      return 'bg-amber-50 dark:bg-amber-950/40'
    case 'safety':
      return 'bg-red-100 dark:bg-red-900/30'
    default:
      return 'bg-muted'
  }
}

function getTypeBadge(type: string) {
  switch (type) {
    case 'ride':
      return <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 text-[10px] h-5 px-1.5">Course</Badge>
    case 'delivery':
      return <Badge variant="secondary" className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 text-[10px] h-5 px-1.5">Livraison</Badge>
    case 'wallet':
      return <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 text-[10px] h-5 px-1.5">Paiement</Badge>
    case 'promo':
      return <Badge variant="secondary" className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 text-[10px] h-5 px-1.5">Promo</Badge>
    case 'safety':
      return <Badge variant="secondary" className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 text-[10px] h-5 px-1.5">Securite</Badge>
    default:
      return <Badge variant="secondary" className="text-[10px] h-5 px-1.5">Systeme</Badge>
  }
}

function timeAgo(dateStr: string): string {
  const now = Date.now()
  const date = new Date(dateStr).getTime()
  const diffMs = now - date
  const diffSec = Math.floor(diffMs / 1000)
  const diffMin = Math.floor(diffSec / 60)
  const diffHr = Math.floor(diffMin / 60)
  const diffDay = Math.floor(diffHr / 24)

  if (diffSec < 60) return 'A l\'instant'
  if (diffMin < 60) return `il y a ${diffMin} min`
  if (diffHr < 24) return `il y a ${diffHr}h`
  if (diffDay < 7) return `il y a ${diffDay}j`
  return new Date(dateStr).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
  })
}

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** Classify a notification into a time group */
type TimeGroup = 'today' | 'yesterday' | 'earlier'

function getTimeGroup(dateStr: string): TimeGroup {
  const now = new Date()
  const date = new Date(dateStr)
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000)

  if (date >= today) return 'today'
  if (date >= yesterday) return 'yesterday'
  return 'earlier'
}

function groupNotifications(notifications: NotificationItem[]): { group: TimeGroup; label: string; items: NotificationItem[] }[] {
  const groups: Record<TimeGroup, NotificationItem[]> = {
    today: [],
    yesterday: [],
    earlier: [],
  }

  for (const n of notifications) {
    groups[getTimeGroup(n.createdAt)].push(n)
  }

  const result: { group: TimeGroup; label: string; items: NotificationItem[] }[] = []

  if (groups.today.length > 0) {
    result.push({ group: 'today', label: "Aujourd'hui", items: groups.today })
  }
  if (groups.yesterday.length > 0) {
    result.push({ group: 'yesterday', label: 'Hier', items: groups.yesterday })
  }
  if (groups.earlier.length > 0) {
    result.push({ group: 'earlier', label: 'Plus ancien', items: groups.earlier })
  }

  return result
}

/** Map API `read: boolean` to component `status` field */
function mapApiToItem(apiNotif: { id: string; userId: string; type: string; title: string; message: string; read: boolean; createdAt: string }): NotificationItem {
  return {
    id: apiNotif.id,
    userId: apiNotif.userId,
    title: apiNotif.title,
    message: apiNotif.message,
    type: apiNotif.type,
    status: apiNotif.read ? 'read' : 'unread',
    data: null,
    createdAt: apiNotif.createdAt,
  }
}

// ─── Notification Row ──────────────────────────────────────────────────

function NotificationRow({
  notification,
  onRead,
  onDelete,
}: {
  notification: NotificationItem
  onRead: (id: string) => void
  onDelete: (id: string) => void
}) {
  const isUnread = notification.status === 'unread'

  return (
    <div
      className={`group flex items-start gap-3 px-4 py-3.5 cursor-pointer transition-colors duration-150 hover:bg-accent/50 ${
        isUnread ? 'bg-emerald-50/50 dark:bg-emerald-950/10' : ''
      }`}
      onClick={() => {
        if (isUnread) onRead(notification.id)
      }}
    >
      {/* Icon */}
      <div
        className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5 ${getTypeBg(notification.type)}`}
      >
        {getTypeIcon(notification.type)}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <p
              className={`text-sm leading-tight truncate ${
                isUnread
                  ? 'font-semibold text-foreground'
                  : 'font-medium text-foreground/80'
              }`}
            >
              {notification.title}
            </p>
            {isUnread && (
              <span className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0 mt-1.5" />
            )}
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            {getTypeBadge(notification.type)}
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-1 line-clamp-2 leading-relaxed">
          {notification.message}
        </p>
        <p className="text-[11px] text-muted-foreground/60 mt-1.5">
          {timeAgo(notification.createdAt)} · {formatTime(notification.createdAt)}
        </p>
      </div>

      {/* Delete button (visible on hover) */}
      <button
        className="opacity-0 group-hover:opacity-100 transition-opacity duration-150 p-1.5 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 flex-shrink-0 mt-0.5"
        onClick={(e) => {
          e.stopPropagation()
          onDelete(notification.id)
        }}
        aria-label="Supprimer"
      >
        <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-red-500 transition-colors" />
      </button>
    </div>
  )
}

// ─── Push Notification Settings ────────────────────────────────────────

function PushSettings() {
  const {
    isSupported,
    permissionStatus,
    isSubscribed,
    isLoading,
    requestPermission,
    unsubscribe,
  } = usePushNotifications()

  const permissionLabel: Record<string, string> = {
    default: 'Non demande',
    granted: 'Autorise',
    denied: 'Refuse',
    unavailable: 'Non supporte',
  }

  const permissionColor: Record<string, string> = {
    default: 'text-amber-600 bg-amber-100 dark:text-amber-400 dark:bg-amber-900/30',
    granted: 'text-emerald-600 bg-emerald-100 dark:text-emerald-400 dark:bg-emerald-900/30',
    denied: 'text-red-600 bg-red-100 dark:text-red-400 dark:bg-red-900/30',
    unavailable: 'text-muted-foreground bg-muted',
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {isSubscribed ? (
            <BellRing className="h-4 w-4 text-emerald-600" />
          ) : (
            <BellOff className="h-4 w-4 text-muted-foreground" />
          )}
          <span className="text-sm font-medium">Notifications push</span>
        </div>
        <Badge
          variant="secondary"
          className={`text-[10px] h-5 px-1.5 font-medium ${permissionColor[permissionStatus]}`}
        >
          {permissionLabel[permissionStatus]}
        </Badge>
      </div>

      {!isSupported ? (
        <p className="text-xs text-muted-foreground">
          Les notifications push ne sont pas supportees par votre navigateur.
        </p>
      ) : isSubscribed ? (
        <Button
          variant="outline"
          size="sm"
          className="w-full text-xs h-8 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 dark:border-red-900/50 dark:hover:bg-red-950/30"
          onClick={unsubscribe}
          disabled={isLoading}
        >
          <BellOff className="h-3.5 w-3.5 mr-1.5" />
          {isLoading ? 'Chargement...' : 'Desactiver les notifications push'}
        </Button>
      ) : (
        <Button
          size="sm"
          className="w-full text-xs h-8 mova-gradient text-white hover:opacity-90"
          onClick={() => {
            requestPermission().then((granted) => {
              if (granted) {
                toast.success('Notifications push activees !')
              } else {
                toast.error('Autorisation refusee. Activez les notifications dans les parametres de votre navigateur.')
              }
            })
          }}
          disabled={isLoading}
        >
          <BellRing className="h-3.5 w-3.5 mr-1.5" />
          {isLoading ? 'Chargement...' : 'Activer les notifications push'}
        </Button>
      )}

      <p className="text-[11px] text-muted-foreground/70 leading-relaxed">
        Recevez des alertes en temps reel : courses, promos, paiements et alertes de securite.
      </p>
    </div>
  )
}

// ─── Empty State ───────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="w-20 h-20 rounded-full bg-muted/50 flex items-center justify-center mb-4">
        <Bell className="h-9 w-9 text-muted-foreground/50" />
      </div>
      <p className="text-sm font-semibold text-muted-foreground">
        Aucune notification
      </p>
      <p className="text-xs text-muted-foreground/70 mt-1.5 max-w-[220px] leading-relaxed">
        Vos alertes de courses, promotions et mises a jour apparaitront ici.
      </p>
    </div>
  )
}

// ─── Main Component ────────────────────────────────────────────────────

export default function NotificationCenter({ open, onOpenChange }: NotificationCenterProps) {
  const { user, token } = useAppStore()
  const userId = user?.id

  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [markingAll, setMarkingAll] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [showFullHistory, setShowFullHistory] = useState(false)
  const [historyFilter, setHistoryFilter] = useState('all')
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Keep a ref to userId so async functions always read the latest value
  const userIdRef = useRef(userId)
  useEffect(() => { userIdRef.current = userId }, [userId])
  const tokenRef = useRef(token)
  useEffect(() => { tokenRef.current = token }, [token])

  // ── Fetch notifications from backend ──
  async function fetchNotifications() {
    const uid = userIdRef.current
    if (!uid) return

    try {
      const headers: Record<string, string> = {}
      const tk = tokenRef.current
      if (tk) headers['Authorization'] = `Bearer ${tk}`

      const res = await fetch(
        `/api/mova/notifications?userId=${uid}&limit=50&offset=0`,
        { headers },
      )

      if (res.ok) {
        const json = await res.json()
        const fetched = json.data?.notifications
        const count = json.data?.unreadCount

        if (Array.isArray(fetched)) {
          setNotifications(fetched.map(mapApiToItem))
          const resolvedCount = typeof count === 'number' ? count : fetched.filter((n: { read: boolean }) => !n.read).length
          setUnreadCount(resolvedCount)
          setGlobalUnreadCount(resolvedCount)
        } else {
          setNotifications([])
          setUnreadCount(0)
          setGlobalUnreadCount(0)
        }
      } else {
        setNotifications([])
        setUnreadCount(0)
        setGlobalUnreadCount(0)
      }
    } catch {
      setNotifications([])
      setUnreadCount(0)
      setGlobalUnreadCount(0)
    }
  }

  // ── Initial fetch on mount (always) ──
  useEffect(() => {
    queueMicrotask(fetchNotifications)
  }, [])

  // ── Smart polling: 15 s when open, stopped when closed ──
  useEffect(() => {
    if (open) {
      // Fetch immediately when opening, then every 15 s
      fetchNotifications()
      pollRef.current = setInterval(fetchNotifications, 15000)
    } else {
      // Stop polling when closed
      if (pollRef.current) {
        clearInterval(pollRef.current)
        pollRef.current = null
      }
    }
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current)
        pollRef.current = null
      }
    }
  }, [open])

  // Reset settings view when opening
  useEffect(() => {
    if (open) {
      setShowSettings(false)
    }
  }, [open])

  // ── Mark single as read (calls PATCH API) ──
  async function markAsRead(id: string) {
    const uid = userIdRef.current
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      const tk = tokenRef.current
      if (tk) headers['Authorization'] = `Bearer ${tk}`
      await fetch(`/api/mova/notifications/${id}?userId=${uid}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ read: true }),
      })
    } catch {
      // Non-critical: still update locally
    }
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, status: 'read' as const } : n)),
    )
    setUnreadCount((c) => {
      const next = Math.max(0, c - 1)
      setGlobalUnreadCount(next)
      return next
    })
  }

  // ── Mark all as read (calls POST /read-all API) ──
  async function markAllAsRead() {
    setMarkingAll(true)
    const uid = userIdRef.current
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      const tk = tokenRef.current
      if (tk) headers['Authorization'] = `Bearer ${tk}`

      const res = await fetch('/api/mova/notifications/read-all', {
        method: 'POST',
        headers,
        body: JSON.stringify({ userId: uid }),
      })
      if (res.ok) {
        setNotifications((prev) => prev.map((n) => ({ ...n, status: 'read' as const })))
        setUnreadCount(0)
        setGlobalUnreadCount(0)
        toast.success('Toutes les notifications ont ete marquees comme lues')
      }
    } catch {
      // Still update locally
      setNotifications((prev) => prev.map((n) => ({ ...n, status: 'read' as const })))
      setUnreadCount(0)
      setGlobalUnreadCount(0)
      toast.success('Toutes les notifications ont ete marquees comme lues')
    } finally {
      setMarkingAll(false)
    }
  }

  // ── Delete notification (calls DELETE API) ──
  async function deleteNotification(id: string) {
    const uid = userIdRef.current
    setNotifications((prev) => {
      const n = prev.find((item) => item.id === id)
      if (n?.status === 'unread') {
        setUnreadCount((c) => {
          const next = Math.max(0, c - 1)
          setGlobalUnreadCount(next)
          return next
        })
      }
      return prev.filter((item) => item.id !== id)
    })
    try {
      const headers: Record<string, string> = {}
      const tk = tokenRef.current
      if (tk) headers['Authorization'] = `Bearer ${tk}`
      await fetch(`/api/mova/notifications/${id}?userId=${uid}`, {
        method: 'DELETE',
        headers,
      })
    } catch {
      // Non-critical
    }
  }

  // ── Manual refresh ──
  async function handleRefresh() {
    setIsRefreshing(true)
    await fetchNotifications()
    // Brief minimum spin so the user sees feedback
    setTimeout(() => setIsRefreshing(false), 400)
  }

  const grouped = groupNotifications(notifications)

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-[420px] p-0 flex flex-col"
      >
        {/* ── Header ── */}
        <SheetHeader className="px-4 pt-4 pb-3 border-b border-border">
          <div className="flex items-center justify-between">
            <SheetTitle className="flex items-center gap-2.5 text-lg">
              <div className="w-8 h-8 rounded-lg mova-gradient flex items-center justify-center">
                <Bell className="h-4 w-4 text-white" />
              </div>
              Notifications
              {unreadCount > 0 && (
                <Badge className="bg-red-500 text-white text-[10px] font-bold px-1.5 h-5 min-w-[20px] justify-center">
                  {unreadCount}
                </Badge>
              )}
            </SheetTitle>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-lg"
              onClick={() => setShowSettings(!showSettings)}
            >
              <Settings className="h-4 w-4" />
            </Button>
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-between mt-3">
            {unreadCount > 0 ? (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                onClick={markAllAsRead}
                disabled={markingAll}
              >
                <CheckCheck className="h-3.5 w-3.5 mr-1" />
                {markingAll ? 'Chargement...' : 'Tout marquer comme lu'}
              </Button>
            ) : (
              <span className="text-xs text-muted-foreground">Tout est a jour</span>
            )}
            <span className="text-[11px] text-muted-foreground">
              {notifications.length} notification{notifications.length !== 1 ? 's' : ''}
            </span>
          </div>
        </SheetHeader>

        {/* ── Push Settings (collapsible) ── */}
        {showSettings && (
          <div className="border-b border-border px-4 py-4 transition-all duration-200">
            <PushSettings />
          </div>
        )}

        {/* ── Refresh button ── */}
        <div className="px-4 py-2 border-b border-border/50">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground hover:bg-accent/50"
            onClick={handleRefresh}
            disabled={isRefreshing}
          >
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 transition-transform duration-500 ${isRefreshing ? 'animate-spin' : ''}`} />
            Actualiser
          </Button>
        </div>

        {/* ── Notification List ── */}
        <ScrollArea className="flex-1 h-0">
          {notifications.length === 0 ? (
            <EmptyState />
          ) : (
            <div>
              {grouped.map(({ group, label, items }) => (
                <div key={group}>
                  {/* Group header */}
                  <div className="sticky top-0 z-10 bg-card/95 backdrop-blur-sm border-b border-border/50 px-4 py-2">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {label}
                    </p>
                  </div>

                  {/* Notification items */}
                  <div className="divide-y divide-border/30">
                    {items.map((notification) => (
                      <NotificationRow
                        key={notification.id}
                        notification={notification}
                        onRead={markAsRead}
                        onDelete={deleteNotification}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        {/* ── Footer ── */}
        {notifications.length > 0 && (
          <>
            <Separator />
            <div className="px-4 py-3">
              <button
                className="w-full flex items-center justify-center gap-1.5 text-xs font-medium text-emerald-600 hover:text-emerald-700 transition-colors py-1 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                onClick={() => setShowFullHistory(true)}
              >
                Voir l&apos;historique complet
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </>
        )}
      </SheetContent>

      {/* Full History Dialog */}
      <Dialog open={showFullHistory} onOpenChange={setShowFullHistory}>
        <DialogContent className="max-w-2xl max-h-[85vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-emerald-600" />
              Historique complet des notifications
            </DialogTitle>
          </DialogHeader>

          {/* Filter buttons */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2">
            <Filter className="h-4 w-4 text-muted-foreground shrink-0" />
            {[
              { key: 'all', label: 'Toutes' },
              { key: 'unread', label: 'Non lues' },
              { key: 'ride', label: 'Courses' },
              { key: 'delivery', label: 'Livraisons' },
              { key: 'system', label: 'Systeme' },
            ].map((f) => (
              <Button
                key={f.key}
                size="sm"
                variant={historyFilter === f.key ? 'default' : 'outline'}
                className={`text-xs shrink-0 ${historyFilter === f.key ? 'bg-emerald-600 hover:bg-emerald-700' : ''}`}
                onClick={() => setHistoryFilter(f.key)}
              >
                {f.label}
                {f.key === 'unread' && unreadCount > 0 && (
                  <Badge className="ml-1 bg-white text-emerald-700 text-[9px] h-4 min-w-[16px] px-1">{unreadCount}</Badge>
                )}
              </Button>
            ))}
          </div>

          <Separator />

          {/* Notification list */}
          <ScrollArea className="max-h-[50vh]">
            {(() => {
              let filtered = notifications
              if (historyFilter === 'unread') {
                filtered = notifications.filter(n => n.status === 'unread')
              } else if (historyFilter === 'ride') {
                filtered = notifications.filter(n => n.type === 'ride' || n.type === 'wallet')
              } else if (historyFilter === 'delivery') {
                filtered = notifications.filter(n => n.type === 'delivery')
              } else if (historyFilter === 'system') {
                filtered = notifications.filter(n => n.type === 'system' || n.type === 'promo' || n.type === 'safety')
              }

              return filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Bell className="h-8 w-8 text-muted-foreground/40 mb-2" />
                  <p className="text-sm text-muted-foreground">Aucune notification</p>
                  <p className="text-xs text-muted-foreground/70 mt-1">Aucune notification ne correspond a ce filtre.</p>
                </div>
              ) : (
                <div className="divide-y divide-border/30">
                  {filtered.map((notification) => (
                    <NotificationRow
                      key={notification.id}
                      notification={notification}
                      onRead={markAsRead}
                      onDelete={deleteNotification}
                    />
                  ))}
                </div>
              )
            })()}
          </ScrollArea>

          <div className="flex items-center justify-between pt-2">
            <span className="text-xs text-muted-foreground">{notifications.length} notification{notifications.length !== 1 ? 's' : ''} au total</span>
            <Button
              size="sm"
              className="mova-gradient text-white"
              onClick={() => setShowFullHistory(false)}
            >
              Fermer
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Sheet>
  )
}
