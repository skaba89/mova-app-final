'use client'

import { useEffect, useRef, useState } from 'react'
import { useAppStore } from './store'

const TOKEN_KEY = 'mova_token'

/** Derive the French-language category from the notification type. */
function typeToCategory(
  type: string,
): 'courses' | 'livraisons' | 'systeme' {
  switch (type) {
    case 'ride':
    case 'rating':
      return 'courses'
    case 'delivery':
      return 'livraisons'
    default:
      return 'systeme'
  }
}

// ---------------------------------------------------------------------------
// Seed / demo notifications (used when the API returns nothing)
// ---------------------------------------------------------------------------

const DEMO_NOTIFICATIONS: Array<{
  id: string
  type: 'ride' | 'delivery' | 'rating' | 'system' | 'promo' | 'safety'
  category: 'courses' | 'livraisons' | 'systeme'
  title: string
  description: string
  timestamp: Date
  read: boolean
}> = (() => {
  const now = Date.now()
  return [
    {
      id: 'demo-1',
      type: 'ride',
      category: 'courses',
      title: 'Course acceptee',
      description: 'Mamadou D. a accepte votre course Kaloum vers Matoto.',
      timestamp: new Date(now - 2 * 60_000),
      read: false,
    },
    {
      id: 'demo-2',
      type: 'ride',
      category: 'courses',
      title: 'Chauffeur en route',
      description: 'Votre chauffeur arrive dans environ 5 min.',
      timestamp: new Date(now - 10 * 60_000),
      read: false,
    },
    {
      id: 'demo-3',
      type: 'delivery',
      category: 'livraisons',
      title: 'Livraison en cours',
      description: 'Votre colis est en route vers Dixinn. Arrivee prevue a 14h30.',
      timestamp: new Date(now - 25 * 60_000),
      read: false,
    },
    {
      id: 'demo-4',
      type: 'promo',
      category: 'systeme',
      title: 'Offre speciale -20%',
      description: 'Profitez de -20% sur votre prochaine course avec le code MOVA20.',
      timestamp: new Date(now - 60 * 60_000),
      read: true,
    },
    {
      id: 'demo-5',
      type: 'rating',
      category: 'courses',
      title: 'Nouvelle evaluation',
      description: 'Vous avez recu 5 etoiles pour votre derniere course.',
      timestamp: new Date(now - 3 * 3600_000),
      read: true,
    },
    {
      id: 'demo-6',
      type: 'safety',
      category: 'systeme',
      title: 'Rappel securite',
      description: 'Portez toujours votre ceinture de securite pendant la course.',
      timestamp: new Date(now - 24 * 3600_000),
      read: true,
    },
  ]
})()

export function useNotifications() {
  const {
    notifications,
    addNotification,
    removeNotification,
    markNotificationRead,
    markAllNotificationsRead,
    clearNotifications,
    isAuthenticated,
    user,
  } = useAppStore()

  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Keep a ref to the current notifications array so fetch can
  // read the latest list without recreating the callback on every change.
  const notificationsRef = useRef(notifications)
  useEffect(() => { notificationsRef.current = notifications }, [notifications])

  // Stable ref for fetchNotifications — the interval always calls the latest version.
  const fetchRef = useRef<(() => Promise<void>) | undefined>(undefined)

  fetchRef.current = async () => {
    if (!isAuthenticated) return
    setIsLoading(true)
    setError(null)
    try {
      const token =
        typeof window !== 'undefined'
          ? localStorage.getItem(TOKEN_KEY)
          : null
      if (!token) { setIsLoading(false); return }

      const userId = user?.id
      const res = await fetch(
        `/api/mova/notifications${userId ? `?userId=${userId}` : ''}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      )

      if (res.ok) {
        const data = await res.json()
        if (data.success && Array.isArray(data.data?.notifications)) {
          const storeIds = new Set(notificationsRef.current.map((n) => n.id))
          for (const n of data.data.notifications) {
            if (!storeIds.has(n.id)) {
              addNotification({
                id: n.id,
                type: n.type || 'system',
                category: typeToCategory(n.type),
                title: n.title,
                description: n.message ?? n.description ?? '',
                timestamp: new Date(n.createdAt),
                read: n.read || false,
              })
            }
          }
        }
      }
    } catch {
      setError('Impossible de charger les notifications')
    } finally {
      setIsLoading(false)
    }
  }

  const fetchNotifications = () => fetchRef.current?.()

  async function handleMarkRead(id: string) {
    markNotificationRead(id)
    try {
      const token =
        typeof window !== 'undefined'
          ? localStorage.getItem(TOKEN_KEY)
          : null
      if (!token) return
      const userId = user?.id
      await fetch(`/api/mova/notifications/${id}${userId ? `?userId=${userId}` : ''}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ read: true }),
      })
    } catch {
      /* silent */
    }
  }

  async function handleMarkAllRead() {
    markAllNotificationsRead()
    try {
      const token =
        typeof window !== 'undefined'
          ? localStorage.getItem(TOKEN_KEY)
          : null
      if (!token) return
      const userId = user?.id
      await fetch('/api/mova/notifications/read-all', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ userId }),
      })
    } catch {
      /* silent */
    }
  }

  async function handleDelete(id: string) {
    removeNotification(id)
    try {
      const token =
        typeof window !== 'undefined'
          ? localStorage.getItem(TOKEN_KEY)
          : null
      if (!token) return
      const userId = user?.id
      await fetch(`/api/mova/notifications/${id}${userId ? `?userId=${userId}` : ''}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      // Refetch after delete to keep the list in sync
      fetchNotifications()
    } catch {
      /* silent */
    }
  }

  async function handleClearAll() {
    clearNotifications()
    try {
      const token =
        typeof window !== 'undefined'
          ? localStorage.getItem(TOKEN_KEY)
          : null
      if (!token) return
      const userId = user?.id
      for (const n of notificationsRef.current) {
        await fetch(`/api/mova/notifications/${n.id}${userId ? `?userId=${userId}` : ''}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        })
      }
    } catch {
      /* silent */
    }
  }

  // Seed demo notifications when the store is completely empty (fresh session)
  useEffect(() => {
    if (notifications.length === 0) {
      for (const n of DEMO_NOTIFICATIONS) {
        addNotification(n)
      }
    }
    // Only run once on mount — eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Fetch on mount and when authenticated; poll every 30 s
  useEffect(() => {
    fetchRef.current?.()
    const interval = setInterval(() => fetchRef.current?.(), 30000)
    return () => clearInterval(interval)
  }, [isAuthenticated])

  const unreadCount = notifications.filter((n) => !n.read).length

  return {
    notifications,
    unreadCount,
    isLoading,
    error,
    fetchNotifications,
    handleMarkRead,
    handleMarkAllRead,
    handleDelete,
    handleClearAll,
  }
}
