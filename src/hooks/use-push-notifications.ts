"use client"

/**
 * MOVA Push Notifications Hook
 * =============================
 * Manages browser push notification permission and subscription.
 * In demo mode, uses a generated VAPID key pair for subscription.
 */

import { useState, useEffect, useCallback, useRef } from "react"

// ─── Types ────────────────────────────────────────────────────────────────

export type PermissionStatus = "default" | "granted" | "denied" | "unavailable"

export interface UsePushNotificationsReturn {
  /** Whether the browser supports the Push API */
  isSupported: boolean
  /** Current notification permission status */
  permissionStatus: PermissionStatus
  /** Whether the user is currently subscribed to push notifications */
  isSubscribed: boolean
  /** Whether an async operation is in progress */
  isLoading: boolean
  /** Request permission and subscribe to push notifications */
  requestPermission: () => Promise<boolean>
  /** Unsubscribe from push notifications */
  unsubscribe: () => Promise<void>
}

// ─── Demo VAPID key (base64url encoded, generated for demo purposes) ─────
// In production, generate real VAPID keys with `web-push generate-vapid-keys`
// This is only used as a fallback in development mode when the API is unreachable.
const DEMO_VAPID_KEY = "BLG8H6vT2R-8aC2NkC8eJ0xR3jD1wQ6bT5gE4oM9pL7aK3sF8hN2jW6tY5uI1rE4wA6cB7dF0gH3iJ5kL8mN9oP0qR2sT4uV6wX8yZ0"

// ─── Cached VAPID key ─────────────────────────────────────────────────────
let cachedVapidKey: string | null = null

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/")
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

// ─── Hook ─────────────────────────────────────────────────────────────────

export function usePushNotifications(): UsePushNotificationsReturn {
  const [isSupported, setIsSupported] = useState(false)
  const [permissionStatus, setPermissionStatus] = useState<PermissionStatus>("unavailable")
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const registrationRef = useRef<ServiceWorkerRegistration | null>(null)

  // ── Check browser support and current permission on mount ──────────────

  useEffect(() => {
    async function checkSupport() {
      if (typeof window === "undefined") return

      const supported = !!(
        "Notification" in window &&
        "serviceWorker" in navigator &&
        "PushManager" in window
      )

      setIsSupported(supported)

      if (!supported) {
        setPermissionStatus("unavailable")
        return
      }

      // Get current permission
      const permission = Notification.permission as PermissionStatus
      setPermissionStatus(permission)

      // Check if already subscribed
      if (permission === "granted") {
        try {
          const registration = await navigator.serviceWorker.ready
          registrationRef.current = registration
          const subscription = await registration.pushManager.getSubscription()
          setIsSubscribed(!!subscription)
        } catch {
          // Service worker might not be ready
        }
      }
    }

    checkSupport()
  }, [])

  // ── Listen for permission changes ──────────────────────────────────────

  useEffect(() => {
    if (!isSupported || typeof window === "undefined") return

    // Some browsers fire a permission change event
    function handlePermissionChange() {
      const permission = Notification.permission as PermissionStatus
      setPermissionStatus(permission)
      if (permission !== "granted") {
        setIsSubscribed(false)
      }
    }

    // Check periodically (safari workaround — no permissionchange event)
    const interval = setInterval(() => {
      const current = Notification.permission
      if (current !== permissionStatus) {
        handlePermissionChange()
      }
    }, 3000)

    return () => clearInterval(interval)
  }, [isSupported, permissionStatus])

  // ── Send subscription to backend ───────────────────────────────────────

  const sendSubscriptionToBackend = useCallback(async (subscription: PushSubscription) => {
    try {
      const res = await fetch("/api/mova/notifications/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(subscription.toJSON()),
      })
      return res.ok
    } catch {
      console.error("[Push] Failed to send subscription to backend")
      return false
    }
  }, [])

  // ── Request permission + subscribe ─────────────────────────────────────

  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!isSupported) {
      console.warn("[Push] Push API not supported in this browser")
      return false
    }

    if (permissionStatus === "granted" && isSubscribed) {
      return true
    }

    setIsLoading(true)

    try {
      // 1. Request notification permission
      const permission = await Notification.requestPermission()
      setPermissionStatus(permission as PermissionStatus)

      if (permission !== "granted") {
        setIsLoading(false)
        return false
      }

      // 2. Get service worker registration
      let registration = registrationRef.current
      if (!registration) {
        registration = await navigator.serviceWorker.ready
        registrationRef.current = registration
      }

      // 3. Fetch VAPID key from API (or use cached value)
      let vapidKey = cachedVapidKey
      if (!vapidKey) {
        try {
          const keyRes = await fetch('/api/mova/notifications/vapid-key')
          const keyData = await keyRes.json()
          if (keyData.success && keyData.data?.publicKey) {
            vapidKey = keyData.data.publicKey
            cachedVapidKey = vapidKey
          } else if (process.env.NODE_ENV === 'development') {
            vapidKey = DEMO_VAPID_KEY
            cachedVapidKey = vapidKey
            console.warn('[Push] VAPID key not configured on server, using demo key')
          } else {
            throw new Error('Cle VAPID non configuree')
          }
        } catch (fetchError) {
          // Only fall back to demo key in development
          if (process.env.NODE_ENV === 'development') {
            vapidKey = DEMO_VAPID_KEY
            cachedVapidKey = vapidKey
            console.warn('[Push] Failed to fetch VAPID key, using demo key:', fetchError)
          } else {
            throw new Error('Impossible de recuperer la cle VAPID')
          }
        }
      }

      // 4. Create push subscription
      if (!vapidKey) throw new Error('Cle VAPID non disponible')
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey).buffer as ArrayBuffer,
      })

      // 5. Send subscription to backend
      const saved = await sendSubscriptionToBackend(subscription)

      if (saved) {
        setIsSubscribed(true)
        console.log("[Push] Successfully subscribed to push notifications")
      } else {
        console.warn("[Push] Subscription created but failed to save to backend")
        // Still set subscribed since the browser subscription exists
        setIsSubscribed(true)
      }

      setIsLoading(false)
      return true
    } catch (error) {
      console.error("[Push] Error requesting permission:", error)
      setIsLoading(false)
      return false
    }
  }, [isSupported, permissionStatus, isSubscribed, sendSubscriptionToBackend])

  // ── Unsubscribe ────────────────────────────────────────────────────────

  const unsubscribe = useCallback(async () => {
    setIsLoading(true)

    try {
      const registration = registrationRef.current || await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.getSubscription()

      if (subscription) {
        await subscription.unsubscribe()

        // Notify backend
        try {
          await fetch("/api/mova/notifications/subscribe", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
          })
        } catch {
          // Non-critical
        }
      }

      setIsSubscribed(false)
      console.log("[Push] Unsubscribed from push notifications")
    } catch (error) {
      console.error("[Push] Error unsubscribing:", error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  return {
    isSupported,
    permissionStatus,
    isSubscribed,
    isLoading,
    requestPermission,
    unsubscribe,
  }
}
