'use client'

import { useState } from 'react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Bell,
  Car,
  Package,
  Star,
  AlertCircle,
  Gift,
  Shield,
  Check,
  Clock,
  Volume2,
  VolumeX,
  RefreshCw,
} from 'lucide-react'
import { useNotifications } from '@/lib/mova/use-notifications'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type NotificationType = 'ride' | 'delivery' | 'rating' | 'system' | 'promo' | 'safety'

type NotificationCategory = 'courses' | 'livraisons' | 'systeme'

type TabValue = 'all' | 'courses' | 'livraisons' | 'systeme'

interface NotificationPanelProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

interface NotificationBadgeProps {
  count?: number
  onClick?: () => void
  className?: string
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getNotificationIcon(type: NotificationType) {
  switch (type) {
    case 'ride':
      return <Car className="h-4 w-4" />
    case 'delivery':
      return <Package className="h-4 w-4" />
    case 'rating':
      return <Star className="h-4 w-4" />
    case 'system':
      return <AlertCircle className="h-4 w-4" />
    case 'promo':
      return <Gift className="h-4 w-4" />
    case 'safety':
      return <Shield className="h-4 w-4" />
  }
}

function getIconBgColor(type: NotificationType) {
  switch (type) {
    case 'ride':
      return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
    case 'delivery':
      return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
    case 'rating':
      return 'bg-gold-light text-gold dark:bg-amber-900/30 dark:text-amber-400'
    case 'system':
      return 'bg-muted text-muted-foreground'
    case 'promo':
      return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
    case 'safety':
      return 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'
  }
}

/** Format a Date to a human-readable relative string (French). */
function formatRelativeTime(date: Date): string {
  const now = Date.now()
  const then = date instanceof Date ? date.getTime() : new Date(date).getTime()
  const diffMs = now - then
  const diffSec = Math.floor(diffMs / 1000)
  const diffMin = Math.floor(diffSec / 60)
  const diffHour = Math.floor(diffMin / 60)
  const diffDay = Math.floor(diffHour / 24)

  if (diffSec < 60) return "a l'instant"
  if (diffMin < 60) return `il y a ${diffMin} min`
  if (diffHour < 24) return `il y a ${diffHour}h`
  if (diffDay === 1) return 'il y a 1j'
  if (diffDay < 30) return `il y a ${diffDay}j`
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}

// ---------------------------------------------------------------------------
// Loading Skeleton
// ---------------------------------------------------------------------------

function NotificationSkeleton() {
  return (
    <div className="flex items-start gap-3 p-3">
      <Skeleton className="w-9 h-9 rounded-lg flex-shrink-0" />
      <div className="flex-1 min-w-0 space-y-2">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-1/4" />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Notification Row
// ---------------------------------------------------------------------------

function NotificationRow({
  notification,
  onMarkRead,
}: {
  notification: {
    id: string
    type: NotificationType
    category: NotificationCategory
    title: string
    description: string
    timestamp: Date
    read: boolean
  }
  onMarkRead: (id: string) => void
}) {
  return (
    <button
      type="button"
      onClick={() => onMarkRead(notification.id)}
      className="w-full flex items-start gap-3 p-3 rounded-xl hover:bg-accent/50 transition-colors text-left group"
    >
      {/* Icon */}
      <div
        className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${getIconBgColor(notification.type)}`}
      >
        {getNotificationIcon(notification.type)}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p
            className={`text-sm font-medium leading-tight truncate ${
              notification.read ? 'text-muted-foreground' : 'text-foreground'
            }`}
          >
            {notification.title}
          </p>
          {/* Unread indicator */}
          {!notification.read && (
            <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0 mova-pulse-dot" />
          )}
        </div>
        <p
          className={`text-xs mt-0.5 line-clamp-2 ${
            notification.read ? 'text-muted-foreground/70' : 'text-muted-foreground'
          }`}
        >
          {notification.description}
        </p>
        <div className="flex items-center gap-1 mt-1">
          <Clock className="h-3 w-3 text-muted-foreground/50" />
          <span className="text-[11px] text-muted-foreground/60">
            {formatRelativeTime(notification.timestamp)}
          </span>
        </div>
      </div>

      {/* Read action on unread items */}
      {!notification.read && (
        <div className="flex-shrink-0 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Check className="h-4 w-4 text-emerald-500" />
        </div>
      )}
    </button>
  )
}

// ---------------------------------------------------------------------------
// Empty State
// ---------------------------------------------------------------------------

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4">
      <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
        <Bell className="h-8 w-8 text-muted-foreground" />
      </div>
      <p className="text-sm font-semibold text-foreground">
        Aucune notification
      </p>
      <p className="text-xs text-muted-foreground mt-1 text-center max-w-[200px]">
        Vous n&apos;avez pas encore de notification dans cette categorie.
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Error Banner
// ---------------------------------------------------------------------------

function ErrorBanner({
  message,
  onRetry,
}: {
  message: string
  onRetry: () => void
}) {
  return (
    <div className="mx-4 mt-2 flex items-center gap-2 p-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40">
      <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
      <p className="text-xs text-red-600 dark:text-red-400 flex-1">{message}</p>
      <Button
        variant="ghost"
        size="sm"
        className="h-6 text-xs text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-full px-2"
        onClick={onRetry}
      >
        <RefreshCw className="h-3 w-3 mr-1" />
        Reessayer
      </Button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// NotificationBadge
// ---------------------------------------------------------------------------

export function NotificationBadge({ count = 0, onClick, className }: NotificationBadgeProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative inline-flex items-center justify-center ${className ?? ''}`}
      aria-label={`${count} notification${count > 1 ? 's' : ''} non lue${count > 1 ? 's' : ''}`}
    >
      <Bell className="h-5 w-5" />
      {count > 0 && (
        <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] flex items-center justify-center px-1 rounded-full bg-red-500 text-white text-[10px] font-bold leading-none">
          {count > 99 ? '99+' : count}
        </span>
      )}
    </button>
  )
}

// ---------------------------------------------------------------------------
// NotificationPanel (main export)
// ---------------------------------------------------------------------------

export default function NotificationPanel({ open, onOpenChange }: NotificationPanelProps) {
  const {
    notifications,
    unreadCount,
    isLoading,
    error,
    fetchNotifications,
    handleMarkRead,
    handleMarkAllRead,
    handleDelete,
    handleClearAll,
  } = useNotifications()
  const [activeTab, setActiveTab] = useState<TabValue>('all')
  const [muted, setMuted] = useState(false)

  // Direct computations — React Compiler handles memoization
  const filteredNotifications =
    activeTab === 'all'
      ? notifications
      : notifications.filter((n) => n.category === activeTab)

  const filteredUnreadCount = filteredNotifications.filter((n) => !n.read).length

  // Reusable content renderer for each tab
  const renderNotificationList = (items: typeof notifications) => {
    if (items.length === 0) return <EmptyState />
    return (
      <div className="space-y-1 px-2">
        {items.map((notification) => (
          <div key={notification.id} className="relative group">
            <NotificationRow notification={notification} onMarkRead={handleMarkRead} />
            {/* Delete button - appears on hover */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                handleDelete(notification.id)
              }}
              className="absolute top-3 right-2 p-1 rounded-md hover:bg-destructive/10 transition-all opacity-0 group-hover:opacity-100 focus:opacity-100"
              aria-label="Supprimer la notification"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-muted-foreground/40 hover:text-destructive"
              >
                <path d="M3 6h18" />
                <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
              </svg>
            </button>
          </div>
        ))}
      </div>
    )
  }

  // Loading skeleton for initial fetch
  const isInitialLoading = isLoading && notifications.length === 0

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md p-0 flex flex-col">
        {/* Header */}
        <SheetHeader className="px-4 pt-4 pb-0">
          <div className="flex items-center justify-between">
            <SheetTitle className="text-lg font-bold flex items-center gap-2">
              <Bell className="h-5 w-5 text-emerald-600" />
              Notifications
              {unreadCount > 0 && (
                <Badge className="ml-1 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-0 font-semibold">
                  {unreadCount}
                </Badge>
              )}
            </SheetTitle>
            <div className="flex items-center gap-1">
              {/* Mute toggle */}
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-full"
                onClick={() => setMuted((prev) => !prev)}
                aria-label={muted ? 'Activer les notifications' : 'Couper le son des notifications'}
              >
                {muted ? (
                  <VolumeX className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <Volume2 className="h-4 w-4 text-muted-foreground" />
                )}
              </Button>
              {/* Mark all read */}
              {unreadCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 text-xs text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-full px-3"
                  onClick={handleMarkAllRead}
                >
                  <Check className="h-3.5 w-3.5 mr-1" />
                  Tout marquer comme lu
                </Button>
              )}
            </div>
          </div>
        </SheetHeader>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabValue)} className="flex flex-col flex-1 overflow-hidden mt-2">
          <div className="px-4">
            <TabsList className="w-full grid grid-cols-4 h-9 rounded-lg">
              <TabsTrigger value="all" className="text-xs rounded-md px-1">
                Toutes
                {unreadCount > 0 && (
                  <Badge variant="secondary" className="ml-1 h-4 min-w-[16px] px-1 text-[10px] rounded-full">
                    {unreadCount}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="courses" className="text-xs rounded-md px-1">
                Courses
              </TabsTrigger>
              <TabsTrigger value="livraisons" className="text-xs rounded-md px-1">
                Livraisons
              </TabsTrigger>
              <TabsTrigger value="systeme" className="text-xs rounded-md px-1">
                Systeme
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Error banner */}
          {error && (
            <ErrorBanner
              message={error}
              onRetry={() => fetchNotifications()}
            />
          )}

          {/* Filtered unread banner */}
          {activeTab !== 'all' && filteredUnreadCount > 0 && (
            <div className="px-4 pt-2">
              <p className="text-xs text-muted-foreground">
                {filteredUnreadCount} notification{filteredUnreadCount > 1 ? 's' : ''} non lue{filteredUnreadCount > 1 ? 's' : ''}
              </p>
            </div>
          )}

          {/* Scrollable notification list */}
          <ScrollArea className="flex-1 mova-scrollbar">
            <div className="py-2">
              {isInitialLoading ? (
                // Loading skeleton
                <div className="space-y-1 px-2">
                  <NotificationSkeleton />
                  <NotificationSkeleton />
                  <NotificationSkeleton />
                  <NotificationSkeleton />
                </div>
              ) : (
                <>
                  <TabsContent value="all" className="mt-0">
                    {renderNotificationList(notifications)}
                  </TabsContent>
                  <TabsContent value="courses" className="mt-0">
                    {renderNotificationList(
                      notifications.filter((n) => n.category === 'courses'),
                    )}
                  </TabsContent>
                  <TabsContent value="livraisons" className="mt-0">
                    {renderNotificationList(
                      notifications.filter((n) => n.category === 'livraisons'),
                    )}
                  </TabsContent>
                  <TabsContent value="systeme" className="mt-0">
                    {renderNotificationList(
                      notifications.filter((n) => n.category === 'systeme'),
                    )}
                  </TabsContent>
                </>
              )}
            </div>
          </ScrollArea>
        </Tabs>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-border/50">
          <div className="flex items-center justify-between">
            <p className="text-[11px] text-muted-foreground">
              {notifications.length} notification{notifications.length !== 1 ? 's' : ''} au total
            </p>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-muted-foreground hover:text-foreground rounded-full px-3"
              onClick={handleClearAll}
              disabled={notifications.length === 0}
            >
              Vider tout
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
