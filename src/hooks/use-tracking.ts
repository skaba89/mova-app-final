"use client"

/**
 * MOVA Real-Time Tracking Hook
 * =============================
 * A thin facade over the TrackingProvider context.
 * All socket connection management lives in TrackingProvider — this hook
 * simply maps the context methods to the existing UseTrackingReturn interface
 * so that consumer components (e.g. passenger-view.tsx) continue to work
 * without any import changes.
 */

import { useTrackingContext } from "@/components/mova/tracking-provider"

// ─── Type Definitions ────────────────────────────────────────────────────────

export interface NearbyDriver {
  driverId: string
  name: string
  zone: string
  lat: number
  lng: number
  vehicleType: string
  vehiclePlate: string
  rating: number
}

export interface RideAssignedData {
  rideId: string
  driverId: string
  driverName: string
  driverLat: number
  driverLng: number
  vehicleType: string
  vehiclePlate: string
  driverRating: number
  etaMinutes: number
  message: string
}

export interface RideTrackData {
  rideId: string
  driverId: string
  lat: number
  lng: number
  timestamp: number
}

export interface RideCompletedData {
  rideId: string
  status: string
  fare: number
  duration: number
  distance: number
  dropoffLat?: number
  dropoffLng?: number
  completedAt: number
  message: string
}

export interface RideStatusUpdate {
  rideId: string
  status: string
  startedAt?: number
  completedAt?: number
  fare?: number
  message?: string
  cancelledBy?: string
}

export interface RideRequestedData {
  rideId: string
  message: string
  pickupZone: string
  estimatedWait: string
}

export interface RideAvailableData {
  rideId: string
  passengerId: string
  pickupLat: number
  pickupLng: number
  pickupZone: string
  dropoffLat: number
  dropoffLng: number
  dropoffZone: string
  requestedAt: number
}

export interface RideAcceptedData {
  rideId: string
  passengerId: string
  pickupLat: number
  pickupLng: number
  pickupZone: string
  dropoffLat: number
  dropoffLng: number
  dropoffZone: string
  message: string
}

export interface RideRestoredData {
  rideId: string
  status: string
  driverId?: string
  driverName?: string
  driverLat?: number
  driverLng?: number
  vehicleType?: string
  vehiclePlate?: string
  passengerId?: string
  passengerName?: string
}

export interface DriverPosition {
  driverId: string
  lat: number
  lng: number
  heading: number
  timestamp: number
}

export interface RideEta {
  etaSeconds: number
  distanceRemaining: number
}

export interface DriverPositionsEvent {
  zone: string
  drivers: Array<{
    driverId: string
    name: string
    lat: number
    lng: number
    heading: number
    vehicleType: string
    rating: number
    isOnline: boolean
  }>
  timestamp: number
}

export type ConnectionStatus = "connecting" | "connected" | "disconnected" | "error"

// ─── Callback types for event listeners ──────────────────────────────────────

export interface TrackingEventListeners {
  onRideAvailable?: (data: RideAvailableData) => void
  onRideAssigned?: (data: RideAssignedData) => void
  onRideRequested?: (data: RideRequestedData) => void
  onRideAccepted?: (data: RideAcceptedData) => void
  onRideRestored?: (data: RideRestoredData) => void
  onRideStatusUpdate?: (data: RideStatusUpdate) => void
  onRideCompleted?: (data: RideCompletedData) => void
  onRideCancelled?: (data: { rideId: string; message: string }) => void
  onRideNoDrivers?: (data: { rideId: string; message: string }) => void
  onDriverLocation?: (data: RideTrackData) => void
  onDriverNearby?: (data: { drivers: NearbyDriver[]; count: number; zone: string }) => void
  onDriverStatusChanged?: (data: { isOnline: boolean; message: string }) => void
  onDriverJoined?: (data: { success: boolean; driverId: string; zone: string; message: string }) => void
  onPassengerJoined?: (data: { success: boolean; passengerId: string; message: string }) => void
  onDriverPositions?: (data: DriverPositionsEvent) => void
  onRideEta?: (data: { rideId: string; etaSeconds: number; distanceRemaining: number }) => void
  onError?: (data: { message: string }) => void
  onServiceShutdown?: (data: { message: string }) => void
}

// ─── Hook Return Type ────────────────────────────────────────────────────────

export interface UseTrackingReturn {
  /** Current connection status */
  connectionStatus: ConnectionStatus
  /** Whether the socket is connected */
  isConnected: boolean
  /** The socket ID (if connected) */
  socketId: string | null
  /** The assigned driver's live location (passenger view) */
  driverLocation: { lat: number; lng: number; timestamp: number } | null
  /** Current ride status from tracking service (more responsive than ride.status) */
  currentRideStatus: string | null
  /** Real-time ETA and distance remaining for active ride */
  rideEta: RideEta | null
  /** Real-time driver positions in subscribed zones (Map<driverId, DriverPosition>) */
  driverPositions: Map<string, DriverPosition>

  // ── Driver Methods ────────────────────────────────────────────────────

  /** Register as a driver with the tracking service */
  joinAsDriver: (data: {
    driverId: string
    zone: string
    lat: number
    lng: number
    name?: string
    vehicleType?: string
    vehiclePlate?: string
    rating?: number
  }) => void

  /** Send a location update */
  updateLocation: (data: { driverId: string; lat: number; lng: number }) => void

  /** Go online (available for rides) */
  goOnline: (data: { driverId: string }) => void

  /** Go offline (unavailable for rides) */
  goOffline: (data: { driverId: string }) => void

  // ── Passenger Methods ─────────────────────────────────────────────────

  /** Register as a passenger */
  joinAsPassenger: (data: { passengerId: string; name?: string }) => void

  /** Request a new ride */
  requestRide: (data: {
    passengerId: string
    pickupLat: number
    pickupLng: number
    pickupZone: string
    dropoffLat: number
    dropoffLng: number
    dropoffZone: string
  }) => void

  /** Cancel a pending or active ride */
  cancelRide: (data: { rideId: string }) => void

  /** Request nearby drivers for a zone */
  getNearbyDrivers: (data: { zone: string; lat?: number; lng?: number }) => void

  /** Subscribe to real-time driver position updates for a zone */
  subscribeToZone: (data: { passengerId: string; zone: string; lat?: number; lng?: number }) => void

  /** Unsubscribe from zone driver updates */
  unsubscribeFromZone: (data: { passengerId: string; zone: string }) => void

  // ── Ride Methods ──────────────────────────────────────────────────────

  /** Accept a ride (driver) */
  acceptRide: (data: { rideId: string; driverId: string }) => void

  /** Start a ride (driver) */
  startRide: (data: { rideId: string }) => void

  /** Complete a ride (driver) */
  completeRide: (data: { rideId: string; fare?: number }) => void

  // ── Utility ───────────────────────────────────────────────────────────

  /** Register event listeners */
  on: (listeners: TrackingEventListeners) => void

  /** Remove all registered event listeners */
  off: () => void

  /** Manually disconnect */
  disconnect: () => void

  /** Manually reconnect */
  reconnect: () => void

  /** Latest warning message (e.g. driver position stale) */
  lastWarning: string | null

  /** Clear the current warning */
  clearWarning: () => void
}

// ─── The Hook ────────────────────────────────────────────────────────────────

export function useTracking(): UseTrackingReturn {
  const ctx = useTrackingContext()

  return {
    connectionStatus: ctx.connectionStatus as ConnectionStatus,
    isConnected: ctx.isConnected,
    socketId: ctx.socketId,
    driverLocation: ctx.driverLocation ?? null,
    currentRideStatus: ctx.currentRideStatus ?? null,
    rideEta: ctx.rideEta ?? null,
    driverPositions: ctx.driverPositions ?? new Map(),

    // Driver
    joinAsDriver: (data) => ctx.joinAsDriver(data),
    updateLocation: (data) => ctx.updateLocation(data),
    goOnline: (data) => ctx.goOnline(data),
    goOffline: (data) => ctx.goOffline(data),

    // Passenger
    joinAsPassenger: (data) => ctx.joinAsPassenger(data),
    requestRide: (data) => ctx.requestRide(data),
    cancelRide: (data) => ctx.cancelRide(data),
    getNearbyDrivers: (data) => ctx.getNearbyDrivers(data),

    // New methods
    subscribeToZone: (data) => ctx.subscribeToZone(data),
    unsubscribeFromZone: (data) => ctx.unsubscribeFromZone(data),

    // Ride
    acceptRide: (data) => ctx.acceptRide(data),
    startRide: (data) => ctx.startRide(data),
    completeRide: (data) => ctx.completeRide(data),

    // Utility — convert typed TrackingEventListeners to the generic Record the context expects
    on: (listeners) => {
      const handlers: Record<string, (...args: unknown[]) => void> = {}
      for (const [key, cb] of Object.entries(listeners)) {
        if (cb) {
          handlers[key] = cb as (...args: unknown[]) => void
        }
      }
      ctx.on(handlers)
    },
    off: () => ctx.off(),
    disconnect: () => ctx.disconnect(),
    reconnect: () => ctx.reconnect(),

    lastWarning: ctx.lastWarning ?? null,
    clearWarning: () => ctx.clearWarning(),
  }
}
