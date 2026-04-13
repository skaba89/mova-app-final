"use client"

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  useEffect,
  type ReactNode,
} from "react"
import { useAppStore } from "@/lib/mova/store"

// ─── Context Types ───────────────────────────────────────────────────────────

interface DriverPosition {
  driverId: string
  lat: number
  lng: number
  heading: number
  timestamp: number
}

interface RideEta {
  etaSeconds: number
  distanceRemaining: number
}

interface TrackingContextValue {
  connectionStatus: string
  isConnected: boolean
  socketId: string | null
  currentRideStatus: string | null
  currentRideId: string | null
  driverLocation: { lat: number; lng: number; timestamp: number } | null
  assignedDriver: Record<string, unknown> | null
  nearbyDrivers: unknown[]
  pendingRide: unknown
  lastError: string | null
  lastWarning: string | null
  driverPositions: Map<string, DriverPosition>
  rideEta: RideEta | null
  joinAsDriver: (data: Record<string, unknown>) => void
  updateLocation: (data: { driverId: string; lat: number; lng: number }) => void
  goOnline: (data: { driverId: string }) => void
  goOffline: (data: { driverId: string }) => void
  joinAsPassenger: (data: Record<string, unknown>) => void
  requestRide: (data: Record<string, unknown>) => void
  cancelRide: (data: { rideId: string }) => void
  getNearbyDrivers: (data: Record<string, unknown>) => void
  acceptRide: (data: { rideId: string; driverId: string }) => void
  startRide: (data: { rideId: string }) => void
  completeRide: (data: { rideId: string; fare?: number }) => void
  subscribeToZone: (data: { passengerId: string; zone: string; lat?: number; lng?: number }) => void
  unsubscribeFromZone: (data: { passengerId: string; zone: string }) => void
  on: (handlers: Record<string, (...args: unknown[]) => void>) => void
  off: () => void
  disconnect: () => void
  reconnect: () => void
  clearError: () => void
  clearWarning: () => void
}

const TrackingContext = createContext<TrackingContextValue | null>(null)

// ─── No-op methods for graceful degradation ──────────────────────────────

const noop = () => {}
const noopMethods = {
  joinAsDriver: noop,
  updateLocation: noop,
  goOnline: noop,
  goOffline: noop,
  joinAsPassenger: noop,
  requestRide: noop,
  cancelRide: noop,
  getNearbyDrivers: noop,
  acceptRide: noop,
  startRide: noop,
  completeRide: noop,
  subscribeToZone: noop,
  unsubscribeFromZone: noop,
  on: noop,
  off: noop,
  disconnect: noop,
  reconnect: noop,
  clearError: () => {},
}

// ─── Socket type ──────────────────────────────────────────────────────────

type SocketInstance = {
  connected: boolean
  emit: (event: string, data: unknown) => void
  on: (event: string, callback: (...args: unknown[]) => void) => void
  off: (event: string, callback?: (...args: unknown[]) => void) => void
  removeAllListeners?: () => void
  disconnect: () => void
  connect: () => void
  id?: string
}

// ─── Event name mapping (camelCase callback → socket event) ───────────────

const EVENT_MAP: Record<string, string> = {
  onRideAssigned: "ride:assigned",
  onRideStatusUpdate: "ride:status-update",
  onRideStatus: "ride:status",
  onRideCompleted: "ride:completed",
  onRideAvailable: "ride:available",
  onRideRequested: "ride:requested",
  onRideAccepted: "ride:accepted",
  onRideCancelled: "ride:cancelled",
  onRideNoDrivers: "ride:no-drivers",
  onDriverLocation: "ride:track",
  onAvailableDrivers: "available_drivers",
  onDriverNearby: "driver:nearby",
  onDriverStatusChanged: "driver:status-changed",
  onDriverJoined: "driver:joined",
  onPassengerJoined: "passenger:joined",
  onRideRestored: "ride:restored",
  onDriverStale: "driver:stale",
  onError: "error",
  onServiceShutdown: "service:shutdown",
}

// ─── Provider Component ───────────────────────────────────────────────────

export function TrackingProvider({ children }: { children: ReactNode }) {
  const [connectionStatus, setConnectionStatus] = useState("disconnected")
  const [socketId, setSocketId] = useState<string | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [lastError, setLastError] = useState<string | null>(null)
  const [lastWarning, setLastWarning] = useState<string | null>(null)
  const [currentRideStatus, setCurrentRideStatus] = useState<string | null>(null)
  const [currentRideId, setCurrentRideId] = useState<string | null>(null)
  const [driverLocation, setDriverLocation] = useState<{ lat: number; lng: number; timestamp: number } | null>(null)
  const [assignedDriver, setAssignedDriver] = useState<Record<string, unknown> | null>(null)
  const [nearbyDrivers, setNearbyDrivers] = useState<unknown[]>([])
  const [pendingRide, setPendingRide] = useState<unknown>(null)
  const [driverPositions, setDriverPositions] = useState<Map<string, DriverPosition>>(new Map())
  const [rideEta, setRideEta] = useState<RideEta | null>(null)

  const isAuthenticated = useAppStore((s) => s.isAuthenticated)
  const token = useAppStore((s) => s.token)
  const user = useAppStore((s) => s.user)

  const socketRef = useRef<SocketInstance | null>(null)
  const listenersRef = useRef<Map<string, (...args: unknown[]) => void>>(new Map())

  // ── Emit helper ───────────────────────────────────────────────────────

  const emit = useCallback((event: string, data: unknown) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit(event, data)
    }
  }, [])

  // ── Initialize Socket on mount (after 200ms delay) ───────────────────
  // Only connect for authenticated users — avoids timeout spam on landing/auth views

  useEffect(() => {
    if (!isAuthenticated) {
      // Disconnect existing socket when user logs out
      if (socketRef.current) {
        for (const [event, cb] of listenersRef.current) {
          socketRef.current.off(event, cb)
        }
        listenersRef.current.clear()
        socketRef.current.disconnect()
        socketRef.current = null
      }
      setConnectionStatus("disconnected")
      setIsConnected(false)
      setSocketId(null)
      return
    }

    let mounted = true
    const timer = setTimeout(() => {
      if (!mounted) return

      import("socket.io-client").then((socketIO) => {
        if (!mounted) return

        const socket = socketIO.io("/?XTransformPort=3004", {
          transports: ["websocket", "polling"],
          forceNew: true,
          reconnection: true,
          reconnectionAttempts: 3,
          reconnectionDelay: 2000,
          reconnectionDelayMax: 5000,
          timeout: 5000,
          auth: {
            token: token || undefined,
            role: user?.role || undefined,
          },
        }) as unknown as SocketInstance

        socketRef.current = socket

        socket.on("connect", () => {
          if (!mounted) return
          setConnectionStatus("connected")
          setIsConnected(true)
          setSocketId(socket.id || null)
        })

        socket.on("disconnect", () => {
          if (!mounted) return
          setConnectionStatus("disconnected")
          setIsConnected(false)
          setSocketId(null)
        })

        socket.on("connect_error", () => {
          if (!mounted) return
          console.warn("[TrackingProvider] Socket connection error — will retry briefly then stop")
          setConnectionStatus("error")
          setIsConnected(false)
        })

        socket.on("reconnect", () => {
          if (!mounted) return
          setConnectionStatus("connected")
          setIsConnected(true)
          setSocketId(socket.id || null)
        })

        socket.on("reconnect_attempt", () => {
          if (!mounted) return
          setConnectionStatus("connecting")
        })

        socket.on("reconnect_failed", () => {
          if (!mounted) return
          setConnectionStatus("error")
          setIsConnected(false)
        })

        socket.connect()

        // ── Domain event listeners ─────────────────────────────────────

        const handleRideAssigned = (data: unknown) => {
          if (!mounted) return
          const p = data as Record<string, unknown>
          setCurrentRideId(p.rideId as string)
          setCurrentRideStatus("accepted")
          setAssignedDriver({
            driverId: p.driverId,
            driverName: p.driverName,
            driverLat: p.driverLat,
            driverLng: p.driverLng,
            vehicleType: p.vehicleType,
            vehiclePlate: p.vehiclePlate,
            driverRating: p.driverRating,
            etaMinutes: p.etaMinutes,
          })
          setDriverLocation({
            lat: p.driverLat as number,
            lng: p.driverLng as number,
            timestamp: Date.now(),
          })
        }
        socket.on("ride:assigned", handleRideAssigned)
        listenersRef.current.set("ride:assigned", handleRideAssigned)

        const handleRideTrack = (data: unknown) => {
          if (!mounted) return
          const p = data as Record<string, unknown>
          const heading = (p.heading as number) ?? 0
          const etaSeconds = (p.etaSeconds as number) ?? null
          const distanceRemaining = (p.distanceRemaining as number) ?? null
          setDriverLocation({
            lat: p.lat as number,
            lng: p.lng as number,
            timestamp: (p.timestamp as number) ?? Date.now(),
          })
          // Update driverPositions map with the assigned driver's latest position
          const driverId = p.driverId as string
          if (driverId) {
            setDriverPositions((prev) => {
              const next = new Map(prev)
              next.set(driverId, {
                driverId,
                lat: p.lat as number,
                lng: p.lng as number,
                heading,
                timestamp: (p.timestamp as number) ?? Date.now(),
              })
              return next
            })
          }
          // Update ETA if provided
          if (etaSeconds != null && distanceRemaining != null) {
            setRideEta({ etaSeconds, distanceRemaining })
          }
        }
        socket.on("ride:track", handleRideTrack)
        listenersRef.current.set("ride:track", handleRideTrack)

        const handleRideStatus = (data: unknown) => {
          if (!mounted) return
          const p = data as Record<string, unknown>
          const status = (p.status as string) || (data as string)
          setCurrentRideStatus(status)
          if (status === "driver_disconnected") {
            setLastError((p.message as string) || "Driver disconnected")
          }
        }
        socket.on("ride:status", handleRideStatus)
        listenersRef.current.set("ride:status", handleRideStatus)

        // Also listen for the camelCase variant emitted by some backends
        const handleRideStatusUpdate = (data: unknown) => {
          if (!mounted) return
          const p = data as Record<string, unknown>
          const status = p.status as string
          setCurrentRideStatus(status)
          if (status === "driver_disconnected") {
            setLastError((p.message as string) || "Driver disconnected")
          }
        }
        socket.on("ride:status-update", handleRideStatusUpdate)
        listenersRef.current.set("ride:status-update", handleRideStatusUpdate)

        const handleRideCompleted = (data: unknown) => {
          if (!mounted) return
          setCurrentRideStatus("completed")
          setDriverLocation(null)
          // Keep currentRideId & assignedDriver for completion summary UI.
          // Store completion payload (fare, duration, distance) in pendingRide.
          setPendingRide(data)
        }
        socket.on("ride:completed", handleRideCompleted)
        listenersRef.current.set("ride:completed", handleRideCompleted)

        const handleRideCancelled = (data: unknown) => {
          if (!mounted) return
          setCurrentRideId(null)
          setCurrentRideStatus(null)
          setAssignedDriver(null)
          setDriverLocation(null)
          setPendingRide(null)
        }
        socket.on("ride:cancelled", handleRideCancelled)
        listenersRef.current.set("ride:cancelled", handleRideCancelled)

        const handleRideRequested = (data: unknown) => {
          if (!mounted) return
          setPendingRide(data)
          setCurrentRideStatus("pending")
        }
        socket.on("ride:requested", handleRideRequested)
        listenersRef.current.set("ride:requested", handleRideRequested)

        const handleRideNoDrivers = () => {
          if (!mounted) return
          setPendingRide(null)
          setCurrentRideStatus(null)
        }
        socket.on("ride:no-drivers", handleRideNoDrivers)
        listenersRef.current.set("ride:no-drivers", handleRideNoDrivers)

        const handleAvailableDrivers = (data: unknown) => {
          if (!mounted) return
          const p = data as Record<string, unknown>
          setNearbyDrivers((p.drivers as unknown[]) ?? (Array.isArray(data) ? data : []))
        }
        socket.on("available_drivers", handleAvailableDrivers)
        listenersRef.current.set("available_drivers", handleAvailableDrivers)

        // Also listen for the colon-separated variant emitted by some backends
        const handleDriverNearby = (data: unknown) => {
          if (!mounted) return
          const p = data as Record<string, unknown>
          setNearbyDrivers((p.drivers as unknown[]) ?? [])
        }
        socket.on("driver:nearby", handleDriverNearby)
        listenersRef.current.set("driver:nearby", handleDriverNearby)

        const handleDriverPositions = (data: unknown) => {
          if (!mounted) return
          const p = data as Record<string, unknown>
          const drivers = p.drivers as Array<Record<string, unknown>> | undefined
          const serverTimestamp = (p.timestamp as number) ?? Date.now()
          if (Array.isArray(drivers)) {
            setDriverPositions((prev) => {
              const next = new Map(prev)
              for (const d of drivers) {
                const id = d.driverId as string
                if (id) {
                  next.set(id, {
                    driverId: id,
                    lat: d.lat as number,
                    lng: d.lng as number,
                    heading: (d.heading as number) ?? 0,
                    timestamp: (d.timestamp as number) ?? serverTimestamp,
                  })
                }
              }
              return next
            })
          }
        }
        socket.on("driver:positions", handleDriverPositions)
        listenersRef.current.set("driver:positions", handleDriverPositions)

        const handleRideEta = (data: unknown) => {
          if (!mounted) return
          const p = data as Record<string, unknown>
          setRideEta({
            etaSeconds: p.etaSeconds as number,
            distanceRemaining: p.distanceRemaining as number,
          })
        }
        socket.on("ride:eta", handleRideEta)
        listenersRef.current.set("ride:eta", handleRideEta)

        const handleServerError = (data: unknown) => {
          if (!mounted) return
          const p = data as Record<string, unknown>
          setLastError((p.message as string) || "Unknown error")
        }
        socket.on("error", handleServerError)
        listenersRef.current.set("error", handleServerError)

        const handleRideRestored = (data: unknown) => {
          if (!mounted) return
          const p = data as Record<string, unknown>
          setCurrentRideId(p.rideId as string)
          setCurrentRideStatus(p.status as string)
          if (p.driverId) {
            setAssignedDriver({
              driverId: p.driverId,
              driverName: p.driverName,
              driverLat: p.driverLat,
              driverLng: p.driverLng,
              vehicleType: p.vehicleType,
              vehiclePlate: p.vehiclePlate,
              passengerId: p.passengerId,
              passengerName: p.passengerName,
            })
          }
          if (p.driverLat != null && p.driverLng != null) {
            setDriverLocation({
              lat: p.driverLat as number,
              lng: p.driverLng as number,
              timestamp: Date.now(),
            })
          }
        }
        socket.on("ride:restored", handleRideRestored)
        listenersRef.current.set("ride:restored", handleRideRestored)

        const handleDriverStale = (data: unknown) => {
          if (!mounted) return
          const p = data as Record<string, unknown>
          setLastWarning((p.message as string) || "Le conducteur n'a pas envoye de position recemment. Veuillez patienter.")
        }
        socket.on("driver:stale", handleDriverStale)
        listenersRef.current.set("driver:stale", handleDriverStale)

      }).catch((err) => {
        if (!mounted) return
        console.warn("[TrackingProvider] socket.io-client unavailable:", err)
        setLastError("Service de tracking indisponible")
      })
    }, 200)

    return () => {
      mounted = false
      clearTimeout(timer)
      if (socketRef.current) {
        // Remove all listeners first, then disconnect
        socketRef.current.removeAllListeners?.()
        for (const [event, cb] of listenersRef.current) {
          socketRef.current.off(event, cb)
        }
        listenersRef.current.clear()
        socketRef.current.disconnect()
        socketRef.current = null
      }
    }
  }, [isAuthenticated, token, user])

  // ── Event listener management ────────────────────────────────────────

  const on = useCallback((handlers: Record<string, (...args: unknown[]) => void>) => {
    const socket = socketRef.current
    if (!socket) return
    for (const [key, callback] of Object.entries(handlers)) {
      const event = EVENT_MAP[key] || key
      const prevCb = listenersRef.current.get(event)
      if (prevCb) socket.off(event, prevCb)
      socket.on(event, callback)
      listenersRef.current.set(event, callback)
    }
  }, [])

  const off = useCallback(() => {
    const socket = socketRef.current
    if (!socket) return
    for (const [event, cb] of listenersRef.current) {
      socket.off(event, cb)
    }
    listenersRef.current.clear()
  }, [])

  // ── Socket methods ───────────────────────────────────────────────────

  const disconnect = useCallback(() => { socketRef.current?.disconnect() }, [])
  const reconnect = useCallback(() => { socketRef.current?.connect() }, [])
  const clearError = useCallback(() => { setLastError(null) }, [])
  const clearWarning = useCallback(() => { setLastWarning(null) }, [])

  const joinAsDriver = useCallback((data: Record<string, unknown>) => { emit("driver:join", data) }, [emit])
  const updateLocation = useCallback((data: { driverId: string; lat: number; lng: number }) => { emit("driver:location", data) }, [emit])
  const goOnline = useCallback((data: Record<string, unknown>) => { emit("driver:go-online", data) }, [emit])
  const goOffline = useCallback((data: Record<string, unknown>) => { emit("driver:go-offline", data) }, [emit])
  const joinAsPassenger = useCallback(
    (data: Record<string, unknown>) => {
      emit("passenger:join", data)
      // Auto-subscribe to the default zone (Kaloum) when passenger joins
      const passengerId = data.passengerId as string | undefined
      if (passengerId) {
        emit("passenger:subscribe-zone", { passengerId, zone: "Kaloum" })
      }
    },
    [emit]
  )
  const requestRide = useCallback((data: Record<string, unknown>) => { emit("passenger:request-ride", data) }, [emit])
  const cancelRide = useCallback((data: Record<string, unknown>) => { emit("passenger:cancel-ride", data) }, [emit])
  const getNearbyDrivers = useCallback((data: Record<string, unknown>) => { emit("get:nearby-drivers", data) }, [emit])
  const acceptRide = useCallback((data: Record<string, unknown>) => { emit("ride:accept", data) }, [emit])
  const startRide = useCallback((data: Record<string, unknown>) => { emit("ride:start", data) }, [emit])
  const completeRide = useCallback((data: Record<string, unknown>) => { emit("ride:complete", data) }, [emit])
  const subscribeToZone = useCallback((data: { passengerId: string; zone: string; lat?: number; lng?: number }) => {
    emit("passenger:subscribe-zone", data)
  }, [emit])
  const unsubscribeFromZone = useCallback((data: { passengerId: string; zone: string }) => {
    emit("passenger:unsubscribe-zone", data)
  }, [emit])

  // ── Context value (stable reference via useMemo) ─────────────────────

  const value: TrackingContextValue = {
    connectionStatus,
    isConnected,
    socketId,
    currentRideStatus,
    currentRideId,
    driverLocation,
    assignedDriver,
    nearbyDrivers,
    pendingRide,
    lastError,
    lastWarning,
    driverPositions,
    rideEta,
    joinAsDriver,
    updateLocation,
    goOnline,
    goOffline,
    joinAsPassenger,
    requestRide,
    cancelRide,
    getNearbyDrivers,
    acceptRide,
    startRide,
    completeRide,
    subscribeToZone,
    unsubscribeFromZone,
    on,
    off,
    disconnect,
    reconnect,
    clearError,
    clearWarning,
  }

  return (
    <TrackingContext.Provider value={value}>
      {children}
    </TrackingContext.Provider>
  )
}

// ─── Consumer Hook ──────────────────────────────────────────────────────────

export function useTrackingContext(): TrackingContextValue {
  const context = useContext(TrackingContext)
  if (!context) {
    return {
      connectionStatus: "disconnected",
      isConnected: false,
      socketId: null,
      currentRideStatus: null,
      currentRideId: null,
      driverLocation: null,
      assignedDriver: null,
      nearbyDrivers: [],
      pendingRide: null,
      lastError: null,
      lastWarning: null,
      driverPositions: new Map(),
      rideEta: null,
      ...noopMethods,
      clearError: () => {},
      clearWarning: () => {},
    }
  }
  return context
}
