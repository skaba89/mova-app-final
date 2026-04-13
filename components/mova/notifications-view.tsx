'use client'

import { useState, useEffect, useCallback } from 'react'
import { useMovaStore } from '@/lib/store'
import {
  ArrowLeft,
  Bell,
  Check,
  CheckCheck,
  Car,
  UtensilsCrossed,
  CreditCard,
  Tag,
  AlertTriangle,
  Info,
  Loader2,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

// --- Types ---

interface Notification {
  id: string
  type: string
  title: string
  message: string
  isRead: boolean
  createdAt: string
  data?: string | null
}

// --- Constantes ---

const TYPE_CONFIG: Record<string, { icon: LucideIcon; color: string; bgColor: string; label: string }> = {
  ride_update: { icon: Car, color: 'text-blue-600', bgColor: 'bg-blue-50', label: 'Course' },
  payment: { icon: CreditCard, color: 'text-green-600', bgColor: 'bg-green-50', label: 'Paiement' },
  promotion: { icon: Tag, color: 'text-orange-600', bgColor: 'bg-orange-50', label: 'Promotion' },
  system: { icon: Info, color: 'text-gray-600', bgColor: 'bg-gray-50', label: 'Systeme' },
  alert: { icon: AlertTriangle, color: 'text-red-600', bgColor: 'bg-red-50', label: 'Alerte' },
}

function formatDate(dateStr: string): string {
  try {
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMinutes = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMinutes / 60)
    const diffDays = Math.floor(diffHours / 24)

    if (diffMinutes < 1) return 'A l\'instant'
    if (diffMinutes < 60) return `Il y a ${diffMinutes} min`
    if (diffHours < 24) return `Il y a ${diffHours}h`
    if (diffDays < 7) return `Il y a ${diffDays}j`
    return date.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
  } catch {
    return dateStr
  }
}

/**
 * Vue des notifications - liste, marquage comme lu, etat vide.
 */
export function NotificationsView() {
  const { setCurrentView } = useMovaStore()

  // Donnees
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [isMarkingAll, setIsMarkingAll] = useState(false)

  const getToken = () => localStorage.getItem('mova_token')

  // Charger les notifications
  const fetchNotifications = useCallback(async () => {
    setIsLoading(true)
    try {
      const token = getToken()
      const res = await fetch('/api/mova/notifications?limit=50', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      const data = await res.json()
      if (data.success) {
        setNotifications(data.data.notifications || [])
        setUnreadCount(data.data.unreadCount || 0)
      }
    } catch {
      // Silencieux
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchNotifications()
  }, [fetchNotifications])

  // Marquer une notification comme lue
  const markAsRead = async (notificationId: string) => {
    try {
      const token = getToken()
      await fetch(`/api/mova/notifications/${notificationId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ isRead: true }),
      })

      // Mettre a jour localement
      setNotifications((prev) =>
        prev.map((n) => (n.id === notificationId ? { ...n, isRead: true } : n))
      )
      setUnreadCount((prev) => Math.max(0, prev - 1))
    } catch {
      // Silencieux
    }
  }

  // Tout marquer comme lu
  const markAllAsRead = async () => {
    setIsMarkingAll(true)
    try {
      const token = getToken()
      await fetch('/api/mova/notifications/read-all', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      })

      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })))
      setUnreadCount(0)
    } catch {
      // Silencieux
    } finally {
      setIsMarkingAll(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* En-tete */}
      <header className="bg-[#1e40af] text-white px-4 py-4 flex items-center gap-3 sticky top-0 z-10">
        <button
          onClick={() => setCurrentView('hub')}
          className="p-2 -ml-2 rounded-xl hover:bg-white/10 active:scale-95 transition-transform"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-lg font-bold">Notifications</h1>
        </div>
        {unreadCount > 0 && (
          <button
            onClick={markAllAsRead}
            disabled={isMarkingAll}
            className="flex items-center gap-1.5 px-3 py-2 bg-white/15 rounded-xl text-sm font-medium active:scale-95 transition-transform disabled:opacity-50"
          >
            {isMarkingAll ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <CheckCheck className="w-4 h-4" />
            )}
            Tout lire
          </button>
        )}
      </header>

      <div className="px-4 py-5 pb-8">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-[#1e40af] animate-spin" />
          </div>
        ) : notifications.length === 0 ? (
          /* Etat vide */
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-4">
              <Bell className="w-10 h-10 text-gray-300" />
            </div>
            <h3 className="text-lg font-bold text-gray-700 mb-1">Aucune notification</h3>
            <p className="text-sm text-gray-500 text-center">
              Vos notifications apparaitront ici
            </p>
          </div>
        ) : (
          /* Liste des notifications */
          <div className="space-y-2">
            {unreadCount > 0 && (
              <div className="flex items-center gap-2 px-1 mb-2">
                <div className="w-2 h-2 bg-[#1e40af] rounded-full" />
                <span className="text-xs font-semibold text-[#1e40af]">
                  {unreadCount} non lue{unreadCount > 1 ? 's' : ''}
                </span>
              </div>
            )}

            {notifications.map((notification) => {
              const config = TYPE_CONFIG[notification.type] || TYPE_CONFIG.system
              const Icon = config.icon
              return (
                <button
                  key={notification.id}
                  onClick={() => {
                    if (!notification.isRead) {
                      markAsRead(notification.id)
                    }
                  }}
                  className={`w-full flex items-start gap-3 p-4 rounded-xl transition-all active:scale-[0.99] text-left ${
                    notification.isRead
                      ? 'bg-white border border-gray-100'
                      : 'bg-blue-50/50 border border-blue-100'
                  }`}
                >
                  <div className={`w-10 h-10 ${config.bgColor} rounded-xl flex items-center justify-center shrink-0 mt-0.5`}>
                    <Icon className={`w-5 h-5 ${config.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className={`text-sm font-semibold truncate ${
                        notification.isRead ? 'text-gray-600' : 'text-gray-900'
                      }`}>
                        {notification.title}
                      </h3>
                      {!notification.isRead && (
                        <div className="w-2.5 h-2.5 bg-[#1e40af] rounded-full shrink-0 mt-1.5" />
                      )}
                    </div>
                    <p className={`text-sm mt-0.5 line-clamp-2 ${
                      notification.isRead ? 'text-gray-400' : 'text-gray-600'
                    }`}>
                      {notification.message}
                    </p>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-xs text-gray-400">{formatDate(notification.createdAt)}</span>
                      {notification.isRead && (
                        <Check className="w-3.5 h-3.5 text-gray-300" />
                      )}
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
