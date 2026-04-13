/**
 * MOVA Real-Time Tracking Service
 * ================================
 * A Socket.IO mini-service that handles all real-time ride tracking functionality.
 *
 * Port: 3004
 * Path: "/" (required for Caddy routing)
 *
 * Event Flow Overview:
 * ────────────────────
 * 1. Driver joins → registers in zone → available for rides
 * 2. Passenger requests ride → server broadcasts to drivers in same zone
 * 3. Driver accepts ride → server notifies passenger with driver info
 * 4. Driver starts ride → server broadcasts status update
 * 5. During ride, driver sends location updates → server forwards to passenger
 * 6. Driver completes ride → server broadcasts completion with fare
 *
 * Data Structures:
 * - connectedDrivers: Map<socketId, DriverInfo> — all connected drivers
 * - connectedPassengers: Map<socketId, PassengerInfo> — all connected passengers
 * - activeRides: Map<rideId, RideData> — rides in progress
 * - pendingRides: Map<rideId, RideRequest> — rides waiting for acceptance
 * - zoneDrivers: Map<zone, Set<socketId>> — drivers indexed by zone
 */

import { createServer } from 'http'
import { Server, Socket } from 'socket.io'

// ─── Type Definitions ────────────────────────────────────────────────────────

interface DriverInfo {
  socketId: string
  driverId: string
  name?: string
  zone: string
  lat: number
  lng: number
  isOnline: boolean
  currentRideId: string | null
  // Vehicle info (optional, sent when joining)
  vehicleType?: string
  vehiclePlate?: string
  rating?: number
}

interface PassengerInfo {
  socketId: string
  passengerId: string
  name?: string
  currentRideId: string | null
}

interface RideRequest {
  rideId: string
  passengerId: string
  passengerSocketId: string
  pickupLat: number
  pickupLng: number
  pickupZone: string
  dropoffLat: number
  dropoffLng: number
  dropoffZone: string
  requestedAt: number
  status: 'pending' | 'accepted' | 'cancelled'
}

interface RideData {
  rideId: string
  passengerId: string
  passengerSocketId: string
  driverId: string
  driverSocketId: string
  pickupLat: number
  pickupLng: number
  pickupZone: string
  dropoffLat: number
  dropoffLng: number
  dropoffZone: string
  status: 'accepted' | 'in_progress' | 'completed'
  startedAt: number | null
  completedAt: number | null
  fare: number | null
  // Driver's latest known location during the ride
  driverLat: number
  driverLng: number
}

// ─── Server Setup ────────────────────────────────────────────────────────────

const httpServer = createServer()
const io = new Server(httpServer, {
  // DO NOT change the path — used by Caddy to forward requests to the correct port
  path: '/',
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
  pingTimeout: 60000,
  pingInterval: 25000,
})

// ─── In-Memory State ─────────────────────────────────────────────────────────

/** All connected drivers keyed by their socket.id */
const connectedDrivers = new Map<string, DriverInfo>()

/** All connected passengers keyed by their socket.id */
const connectedPassengers = new Map<string, PassengerInfo>()

/** Rides that are waiting for a driver to accept */
const pendingRides = new Map<string, RideRequest>()

/** Rides that have been accepted and are in progress */
const activeRides = new Map<string, RideData>()

/** Drivers grouped by their operating zone for efficient ride matching */
const zoneDrivers = new Map<string, Set<string>>()

/** Index: driverId → socketId for quick lookups */
const driverIdToSocket = new Map<string, string>()

/** Index: passengerId → socketId for quick lookups */
const passengerIdToSocket = new Map<string, string>()

// ─── Helper Functions ────────────────────────────────────────────────────────

/**
 * Generate a unique ride ID.
 * Uses a timestamp + random suffix for uniqueness.
 */
function generateRideId(): string {
  return `ride_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`
}

/**
 * Calculate the distance between two coordinates using the Haversine formula.
 * Returns distance in kilometers.
 */
function haversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371 // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

/**
 * Register a driver into a zone's driver set.
 */
function addDriverToZone(socketId: string, zone: string): void {
  if (!zoneDrivers.has(zone)) {
    zoneDrivers.set(zone, new Set())
  }
  zoneDrivers.get(zone)!.add(socketId)
}

/**
 * Remove a driver from a zone's driver set.
 */
function removeDriverFromZone(socketId: string, zone: string): void {
  const zoneSet = zoneDrivers.get(zone)
  if (zoneSet) {
    zoneSet.delete(socketId)
    if (zoneSet.size === 0) {
      zoneDrivers.delete(zone)
    }
  }
}

/**
 * Get a driver's info by socket ID.
 */
function getDriverBySocket(socketId: string): DriverInfo | undefined {
  return connectedDrivers.get(socketId)
}

/**
 * Get a passenger's info by socket ID.
 */
function getPassengerBySocket(socketId: string): PassengerInfo | undefined {
  return connectedPassengers.get(socketId)
}

/**
 * Get nearby online drivers within a given zone.
 * Returns an array of DriverInfo objects (without internal socketId).
 */
function getNearbyDrivers(
  zone: string,
  lat?: number,
  lng?: number,
  maxDistanceKm: number = 5
): Array<Omit<DriverInfo, 'socketId' | 'currentRideId'>> {
  const driversInZone = zoneDrivers.get(zone)
  if (!driversInZone) return []

  const result: Array<Omit<DriverInfo, 'socketId' | 'currentRideId'>> = []

  for (const socketId of driversInZone) {
    const driver = connectedDrivers.get(socketId)
    if (!driver) continue
    // Only return online drivers that don't have an active ride
    if (!driver.isOnline || driver.currentRideId) continue
    // If coordinates are provided, filter by distance
    if (lat !== undefined && lng !== undefined) {
      const dist = haversineDistance(lat, lng, driver.lat, driver.lng)
      if (dist > maxDistanceKm) continue
    }
    const { socketId: _, currentRideId: __, ...driverPublic } = driver
    result.push(driverPublic)
  }

  return result
}

/**
 * Broadcast a ride request to all online drivers in a specific zone.
 * This is the core matching function.
 */
function broadcastRideToZoneDrivers(rideRequest: RideRequest): void {
  const driversInZone = zoneDrivers.get(rideRequest.pickupZone)
  if (!driversInZone) {
    console.log(
      `[ride:available] No drivers in zone "${rideRequest.pickupZone}" for ride ${rideRequest.rideId}`
    )
    return
  }

  const payload = {
    rideId: rideRequest.rideId,
    passengerId: rideRequest.passengerId,
    pickupLat: rideRequest.pickupLat,
    pickupLng: rideRequest.pickupLng,
    pickupZone: rideRequest.pickupZone,
    dropoffLat: rideRequest.dropoffLat,
    dropoffLng: rideRequest.dropoffLng,
    dropoffZone: rideRequest.dropoffZone,
    requestedAt: rideRequest.requestedAt,
  }

  let notifiedCount = 0
  for (const socketId of driversInZone) {
    const driver = connectedDrivers.get(socketId)
    if (!driver) continue
    if (!driver.isOnline || driver.currentRideId) continue
    io.to(socketId).emit('ride:available', payload)
    notifiedCount++
  }

  console.log(
    `[ride:available] Broadcast ride ${rideRequest.rideId} to ${notifiedCount} drivers in zone "${rideRequest.pickupZone}"`
  )
}

/**
 * Clean up a pending ride when it is accepted or cancelled.
 */
function removePendingRide(rideId: string): void {
  pendingRides.delete(rideId)
}

/**
 * Clean up an active ride when it is completed.
 */
function removeActiveRide(rideId: string): void {
  const ride = activeRides.get(rideId)
  if (ride) {
    // Free the driver
    const driver = connectedDrivers.get(ride.driverSocketId)
    if (driver) {
      driver.currentRideId = null
    }
    // Free the passenger
    const passenger = connectedPassengers.get(ride.passengerSocketId)
    if (passenger) {
      passenger.currentRideId = null
    }
    activeRides.delete(rideId)
  }
}

/**
 * Log server stats periodically.
 */
function logStats(): void {
  const onlineDrivers = Array.from(connectedDrivers.values()).filter(
    (d) => d.isOnline
  ).length
  const totalDrivers = connectedDrivers.size
  const totalPassengers = connectedPassengers.size
  const pending = pendingRides.size
  const active = activeRides.size
  const zones = Array.from(zoneDrivers.entries()).map(
    ([zone, drivers]) => `${zone}(${drivers.size})`
  )

  console.log(
    `[stats] Drivers: ${onlineDrivers}/${totalDrivers} online | Passengers: ${totalPassengers} | Pending: ${pending} | Active: ${active} | Zones: [${zones.join(', ')}]`
  )
}

// ─── Driver Event Handlers ───────────────────────────────────────────────────

/**
 * Handle driver joining the tracking service.
 * Registers the driver in the zone and makes them available for ride matching.
 *
 * Event: driver:join
 * Payload: { driverId, zone, lat, lng, name?, vehicleType?, vehiclePlate?, rating? }
 */
function handleDriverJoin(socket: Socket, data: any): void {
  const { driverId, zone, lat, lng, name, vehicleType, vehiclePlate, rating } =
    data

  if (!driverId || !zone || lat === undefined || lng === undefined) {
    socket.emit('error', {
      message: 'Missing required fields: driverId, zone, lat, lng',
    })
    return
  }

  const driverInfo: DriverInfo = {
    socketId: socket.id,
    driverId,
    name: name || `Driver-${driverId.substring(0, 6)}`,
    zone,
    lat,
    lng,
    isOnline: true,
    currentRideId: null,
    vehicleType: vehicleType || 'standard',
    vehiclePlate: vehiclePlate || 'Unknown',
    rating: rating || 5.0,
  }

  connectedDrivers.set(socket.id, driverInfo)
  driverIdToSocket.set(driverId, socket.id)
  addDriverToZone(socket.id, zone)

  socket.emit('driver:joined', {
    success: true,
    driverId,
    zone,
    message: `Connected to MOVA tracking in zone: ${zone}`,
  })

  console.log(
    `[driver:join] Driver ${driverId} joined in zone "${zone}" at (${lat}, ${lng})`
  )
}

/**
 * Handle driver location updates.
 * Updates the driver's position in memory. During active rides, also forwards
 * the location to the passenger.
 *
 * Event: driver:location
 * Payload: { driverId, lat, lng }
 */
function handleDriverLocation(socket: Socket, data: any): void {
  const { driverId, lat, lng } = data

  if (!driverId || lat === undefined || lng === undefined) {
    socket.emit('error', {
      message: 'Missing required fields: driverId, lat, lng',
    })
    return
  }

  const driver = connectedDrivers.get(socket.id)
  if (!driver) {
    console.warn(
      `[driver:location] Unknown driver socket ${socket.id} sent location update`
    )
    return
  }

  // Update driver's position
  driver.lat = lat
  driver.lng = lng

  // If the driver has an active ride, forward location to the passenger
  if (driver.currentRideId) {
    const ride = activeRides.get(driver.currentRideId)
    if (ride) {
      ride.driverLat = lat
      ride.driverLng = lng

      // Emit ride:track to the passenger so they can see real-time location
      io.to(ride.passengerSocketId).emit('ride:track', {
        rideId: ride.rideId,
        driverId: ride.driverId,
        lat,
        lng,
        timestamp: Date.now(),
      })
    }
  }

  // Debug log (comment out in production to reduce noise)
  // console.log(`[driver:location] Driver ${driverId} at (${lat}, ${lng})`)
}

/**
 * Handle driver going online (available for rides).
 *
 * Event: driver:go-online
 * Payload: { driverId }
 */
function handleDriverGoOnline(socket: Socket, data: any): void {
  const { driverId } = data
  const driver = connectedDrivers.get(socket.id)

  if (!driver) {
    socket.emit('error', { message: 'Driver not registered' })
    return
  }

  driver.isOnline = true
  socket.emit('driver:status-changed', {
    isOnline: true,
    message: 'You are now online and visible to passengers',
  })

  console.log(`[driver:go-online] Driver ${driverId} is now online`)
}

/**
 * Handle driver going offline (not available for rides).
 * If the driver has an active ride, they remain connected but won't receive new requests.
 *
 * Event: driver:go-offline
 * Payload: { driverId }
 */
function handleDriverGoOffline(socket: Socket, data: any): void {
  const { driverId } = data
  const driver = connectedDrivers.get(socket.id)

  if (!driver) {
    socket.emit('error', { message: 'Driver not registered' })
    return
  }

  driver.isOnline = false
  socket.emit('driver:status-changed', {
    isOnline: false,
    message: 'You are now offline',
  })

  console.log(`[driver:go-offline] Driver ${driverId} is now offline`)
}

// ─── Passenger Event Handlers ────────────────────────────────────────────────

/**
 * Handle passenger joining the tracking service.
 *
 * Event: passenger:join
 * Payload: { passengerId, name? }
 */
function handlePassengerJoin(socket: Socket, data: any): void {
  const { passengerId, name } = data

  if (!passengerId) {
    socket.emit('error', { message: 'Missing required field: passengerId' })
    return
  }

  const passengerInfo: PassengerInfo = {
    socketId: socket.id,
    passengerId,
    name: name || `Passenger-${passengerId.substring(0, 6)}`,
    currentRideId: null,
  }

  connectedPassengers.set(socket.id, passengerInfo)
  passengerIdToSocket.set(passengerId, socket.id)

  socket.emit('passenger:joined', {
    success: true,
    passengerId,
    message: 'Connected to MOVA tracking service',
  })

  console.log(`[passenger:join] Passenger ${passengerId} connected`)
}

/**
 * Handle a passenger requesting a ride.
 * Creates a pending ride and broadcasts it to all available drivers in the pickup zone.
 *
 * Event: passenger:request-ride
 * Payload: { passengerId, pickupLat, pickupLng, pickupZone, dropoffLat, dropoffLng, dropoffZone }
 *
 * Flow:
 * 1. Validate payload
 * 2. Create RideRequest with unique ID
 * 3. Store in pendingRides map
 * 4. Broadcast ride:available to all online drivers in the pickup zone
 * 5. Start a timeout (60s) — if no driver accepts, notify passenger
 */
function handlePassengerRequestRide(socket: Socket, data: any): void {
  const {
    passengerId,
    pickupLat,
    pickupLng,
    pickupZone,
    dropoffLat,
    dropoffLng,
    dropoffZone,
  } = data

  if (
    !passengerId ||
    pickupLat === undefined ||
    pickupLng === undefined ||
    !pickupZone ||
    dropoffLat === undefined ||
    dropoffLng === undefined ||
    !dropoffZone
  ) {
    socket.emit('error', {
      message:
        'Missing required fields: passengerId, pickupLat, pickupLng, pickupZone, dropoffLat, dropoffLng, dropoffZone',
    })
    return
  }

  // Check if passenger already has a pending or active ride
  const passenger = connectedPassengers.get(socket.id)
  if (passenger?.currentRideId) {
    socket.emit('error', {
      message: 'You already have an active or pending ride',
    })
    return
  }

  const rideId = generateRideId()

  const rideRequest: RideRequest = {
    rideId,
    passengerId,
    passengerSocketId: socket.id,
    pickupLat,
    pickupLng,
    pickupZone,
    dropoffLat,
    dropoffLng,
    dropoffZone,
    requestedAt: Date.now(),
    status: 'pending',
  }

  pendingRides.set(rideId, rideRequest)

  // Update passenger's current ride
  if (passenger) {
    passenger.currentRideId = rideId
  }

  // Notify passenger that the request is being processed
  socket.emit('ride:requested', {
    rideId,
    message: 'Searching for nearby drivers...',
    pickupZone,
    estimatedWait: '2-5 min',
  })

  // Broadcast to all available drivers in the pickup zone
  broadcastRideToZoneDrivers(rideRequest)

  // Set a timeout — if no driver accepts within 60 seconds, notify passenger
  setTimeout(() => {
    const pending = pendingRides.get(rideId)
    if (pending && pending.status === 'pending') {
      // Remove from pending
      removePendingRide(rideId)
      // Free the passenger
      const p = connectedPassengers.get(pending.passengerSocketId)
      if (p) p.currentRideId = null

      io.to(pending.passengerSocketId).emit('ride:no-drivers', {
        rideId,
        message: 'No drivers available. Please try again.',
      })

      console.log(
        `[ride:timeout] Ride ${rideId} expired — no driver accepted`
      )
    }
  }, 60000)

  console.log(
    `[passenger:request-ride] Passenger ${passengerId} requested ride ${rideId} from "${pickupZone}" to "${dropoffZone}"`
  )
}

/**
 * Handle passenger cancelling a ride.
 * Works for both pending (not yet accepted) and active rides.
 *
 * Event: passenger:cancel-ride
 * Payload: { rideId }
 */
function handlePassengerCancelRide(socket: Socket, data: any): void {
  const { rideId } = data

  if (!rideId) {
    socket.emit('error', { message: 'Missing required field: rideId' })
    return
  }

  // Check if it's a pending ride
  const pendingRide = pendingRides.get(rideId)
  if (pendingRide) {
    pendingRide.status = 'cancelled'
    removePendingRide(rideId)

    // Free the passenger
    const passenger = connectedPassengers.get(pendingRide.passengerSocketId)
    if (passenger) passenger.currentRideId = null

    // Notify passenger
    io.to(pendingRide.passengerSocketId).emit('ride:cancelled', {
      rideId,
      message: 'Ride request cancelled',
    })

    console.log(`[passenger:cancel-ride] Pending ride ${rideId} cancelled`)
    return
  }

  // Check if it's an active ride
  const activeRide = activeRides.get(rideId)
  if (activeRide) {
    const driverSocketId = activeRide.driverSocketId
    const passengerSocketId = activeRide.passengerSocketId

    // Notify driver
    io.to(driverSocketId).emit('ride:cancelled', {
      rideId,
      cancelledBy: 'passenger',
      message: 'Passenger cancelled the ride',
    })

    // Notify passenger
    io.to(passengerSocketId).emit('ride:cancelled', {
      rideId,
      message: 'Ride cancelled',
    })

    // Clean up
    removeActiveRide(rideId)

    console.log(`[passenger:cancel-ride] Active ride ${rideId} cancelled`)
    return
  }

  socket.emit('error', { message: `Ride ${rideId} not found` })
}

// ─── Ride Event Handlers ─────────────────────────────────────────────────────

/**
 * Handle driver accepting a ride.
 * Moves the ride from pending to active and notifies the passenger.
 *
 * Event: ride:accept
 * Payload: { rideId, driverId }
 *
 * Flow:
 * 1. Validate the pending ride exists
 * 2. Remove from pending, create active ride
 * 3. Update driver and passenger state
 * 4. Notify passenger with driver info (ride:assigned)
 * 5. Notify driver of acceptance (ride:accepted)
 * 6. Broadcast status update
 */
function handleRideAccept(socket: Socket, data: any): void {
  const { rideId, driverId } = data

  if (!rideId || !driverId) {
    socket.emit('error', {
      message: 'Missing required fields: rideId, driverId',
    })
    return
  }

  const driver = connectedDrivers.get(socket.id)
  if (!driver) {
    socket.emit('error', { message: 'Driver not registered' })
    return
  }

  // Check if driver already has an active ride
  if (driver.currentRideId) {
    socket.emit('error', { message: 'You already have an active ride' })
    return
  }

  const pendingRide = pendingRides.get(rideId)
  if (!pendingRide) {
    socket.emit('error', {
      message: 'Ride not found or already accepted',
    })
    return
  }

  if (pendingRide.status !== 'pending') {
    socket.emit('error', { message: 'Ride is no longer available' })
    return
  }

  // Create the active ride
  const rideData: RideData = {
    rideId: pendingRide.rideId,
    passengerId: pendingRide.passengerId,
    passengerSocketId: pendingRide.passengerSocketId,
    driverId,
    driverSocketId: socket.id,
    pickupLat: pendingRide.pickupLat,
    pickupLng: pendingRide.pickupLng,
    pickupZone: pendingRide.pickupZone,
    dropoffLat: pendingRide.dropoffLat,
    dropoffLng: pendingRide.dropoffLng,
    dropoffZone: pendingRide.dropoffZone,
    status: 'accepted',
    startedAt: null,
    completedAt: null,
    fare: null,
    driverLat: driver.lat,
    driverLng: driver.lng,
  }

  // Transition: pending → active
  removePendingRide(rideId)
  activeRides.set(rideId, rideData)

  // Update driver state
  driver.currentRideId = rideId

  // Update passenger state
  const passenger = connectedPassengers.get(pendingRide.passengerSocketId)
  if (passenger) {
    passenger.currentRideId = rideId
  }

  // Notify the passenger that a driver has been assigned
  io.to(pendingRide.passengerSocketId).emit('ride:assigned', {
    rideId,
    driverId,
    driverName: driver.name,
    driverLat: driver.lat,
    driverLng: driver.lng,
    vehicleType: driver.vehicleType,
    vehiclePlate: driver.vehiclePlate,
    driverRating: driver.rating,
    etaMinutes: Math.round(
      haversineDistance(driver.lat, driver.lng, pendingRide.pickupLat, pendingRide.pickupLng) / 30
    ), // rough estimate: 30 km/h average speed
    message: `${driver.name} is on the way!`,
  })

  // Confirm to driver
  socket.emit('ride:accepted', {
    rideId,
    passengerId: pendingRide.passengerId,
    pickupLat: pendingRide.pickupLat,
    pickupLng: pendingRide.pickupLng,
    pickupZone: pendingRide.pickupZone,
    dropoffLat: pendingRide.dropoffLat,
    dropoffLng: pendingRide.dropoffLng,
    dropoffZone: pendingRide.dropoffZone,
    message: 'Ride accepted! Head to pickup location.',
  })

  console.log(
    `[ride:accept] Driver ${driverId} accepted ride ${rideId} for passenger ${pendingRide.passengerId}`
  )
}

/**
 * Handle ride start (driver arrives at pickup and begins trip).
 *
 * Event: ride:start
 * Payload: { rideId }
 */
function handleRideStart(socket: Socket, data: any): void {
  const { rideId } = data

  if (!rideId) {
    socket.emit('error', { message: 'Missing required field: rideId' })
    return
  }

  const ride = activeRides.get(rideId)
  if (!ride) {
    socket.emit('error', { message: 'Active ride not found' })
    return
  }

  if (ride.driverSocketId !== socket.id) {
    socket.emit('error', { message: 'You are not the driver for this ride' })
    return
  }

  ride.status = 'in_progress'
  ride.startedAt = Date.now()

  // Notify both passenger and driver
  const payload = {
    rideId,
    status: 'in_progress',
    startedAt: ride.startedAt,
    message: 'Ride has started!',
  }

  io.to(ride.passengerSocketId).emit('ride:status-update', payload)
  io.to(ride.driverSocketId).emit('ride:status-update', payload)

  console.log(
    `[ride:start] Ride ${rideId} started (driver: ${ride.driverId}, passenger: ${ride.passengerId})`
  )
}

/**
 * Handle ride completion.
 * Calculates final info, cleans up state, and notifies both parties.
 *
 * Event: ride:complete
 * Payload: { rideId, fare }
 */
function handleRideComplete(socket: Socket, data: any): void {
  const { rideId, fare } = data

  if (!rideId) {
    socket.emit('error', { message: 'Missing required field: rideId' })
    return
  }

  const ride = activeRides.get(rideId)
  if (!ride) {
    socket.emit('error', { message: 'Active ride not found' })
    return
  }

  if (ride.driverSocketId !== socket.id) {
    socket.emit('error', { message: 'You are not the driver for this ride' })
    return
  }

  ride.status = 'completed'
  ride.completedAt = Date.now()
  ride.fare = fare || 0

  const rideDuration = ride.startedAt
    ? Math.round((ride.completedAt - ride.startedAt) / 60000) // minutes
    : 0
  const rideDistance = haversineDistance(
    ride.pickupLat,
    ride.pickupLng,
    ride.dropoffLat,
    ride.dropoffLng
  )

  // Notify passenger
  io.to(ride.passengerSocketId).emit('ride:completed', {
    rideId,
    status: 'completed',
    fare: ride.fare,
    duration: rideDuration,
    distance: Math.round(rideDistance * 10) / 10,
    dropoffLat: ride.dropoffLat,
    dropoffLng: ride.dropoffLng,
    completedAt: ride.completedAt,
    message: 'Ride completed! Thank you for riding with MOVA.',
  })

  // Confirm to driver
  socket.emit('ride:completed', {
    rideId,
    status: 'completed',
    fare: ride.fare,
    duration: rideDuration,
    distance: Math.round(rideDistance * 10) / 10,
    message: 'Ride completed! Earnings will be available shortly.',
  })

  // Broadcast status update
  const statusPayload = {
    rideId,
    status: 'completed',
    fare: ride.fare,
    completedAt: ride.completedAt,
  }
  io.to(ride.passengerSocketId).emit('ride:status-update', statusPayload)
  io.to(ride.driverSocketId).emit('ride:status-update', statusPayload)

  // Clean up
  removeActiveRide(rideId)

  console.log(
    `[ride:complete] Ride ${rideId} completed | Fare: ${ride.fare} GNF | Duration: ${rideDuration}min | Distance: ${rideDistance.toFixed(1)}km`
  )
}

// ─── Nearby Drivers Query ────────────────────────────────────────────────────

/**
 * Send a list of nearby drivers to a passenger.
 * Useful for showing available drivers on a map before requesting a ride.
 *
 * Triggered by: passenger requesting nearby drivers
 * Emits: driver:nearby to the requesting passenger
 */
function handleGetNearbyDrivers(socket: Socket, data: any): void {
  const { zone, lat, lng } = data

  const passenger = connectedPassengers.get(socket.id)
  if (!passenger) {
    socket.emit('error', { message: 'Passenger not registered' })
    return
  }

  const drivers = getNearbyDrivers(zone || 'Kaloum', lat, lng, 5)
  socket.emit('driver:nearby', {
    drivers,
    count: drivers.length,
    zone: zone || 'Kaloum',
  })

  console.log(
    `[driver:nearby] Sent ${drivers.length} nearby drivers to passenger ${passenger.passengerId} in zone "${zone || 'Kaloum'}"`
  )
}

// ─── Connection & Disconnection ──────────────────────────────────────────────

io.on('connection', (socket: Socket) => {
  console.log(`[connect] Socket connected: ${socket.id}`)

  // ── Driver Events ──────────────────────────────────────────────────────

  /**
   * driver:join — Driver registers with the tracking service.
   * Must be the first event a driver sends after connecting.
   */
  socket.on('driver:join', (data: any) => {
    handleDriverJoin(socket, data)
  })

  /**
   * driver:location — Periodic location updates from the driver.
   * During active rides, this is forwarded to the passenger as ride:track.
   */
  socket.on('driver:location', (data: any) => {
    handleDriverLocation(socket, data)
  })

  /**
   * driver:go-online — Driver toggles to online/available state.
   */
  socket.on('driver:go-online', (data: any) => {
    handleDriverGoOnline(socket, data)
  })

  /**
   * driver:go-offline — Driver toggles to offline/unavailable state.
   */
  socket.on('driver:go-offline', (data: any) => {
    handleDriverGoOffline(socket, data)
  })

  // ── Passenger Events ───────────────────────────────────────────────────

  /**
   * passenger:join — Passenger registers with the tracking service.
   */
  socket.on('passenger:join', (data: any) => {
    handlePassengerJoin(socket, data)
  })

  /**
   * passenger:request-ride — Passenger creates a new ride request.
   * Broadcasts to all available drivers in the pickup zone.
   */
  socket.on('passenger:request-ride', (data: any) => {
    handlePassengerRequestRide(socket, data)
  })

  /**
   * passenger:cancel-ride — Passenger cancels a pending or active ride.
   */
  socket.on('passenger:cancel-ride', (data: any) => {
    handlePassengerCancelRide(socket, data)
  })

  // ── Ride Events ────────────────────────────────────────────────────────

  /**
   * ride:accept — Driver accepts a pending ride request.
   */
  socket.on('ride:accept', (data: any) => {
    handleRideAccept(socket, data)
  })

  /**
   * ride:start — Driver starts the ride (arrived at pickup).
   */
  socket.on('ride:start', (data: any) => {
    handleRideStart(socket, data)
  })

  /**
   * ride:complete — Driver completes the ride.
   */
  socket.on('ride:complete', (data: any) => {
    handleRideComplete(socket, data)
  })

  // ── Utility Events ─────────────────────────────────────────────────────

  /**
   * get:nearby-drivers — Passenger requests list of nearby available drivers.
   */
  socket.on('get:nearby-drivers', (data: any) => {
    handleGetNearbyDrivers(socket, data)
  })

  /**
   * ping — Simple ping/pong for connection health check.
   */
  socket.on('ping', () => {
    socket.emit('pong', { timestamp: Date.now() })
  })

  // ── Disconnection ──────────────────────────────────────────────────────

  /**
   * Handle socket disconnection.
   * Cleans up all state associated with the disconnected socket.
   */
  socket.on('disconnect', (reason: string) => {
    const driver = connectedDrivers.get(socket.id)
    const passenger = connectedPassengers.get(socket.id)

    if (driver) {
      // Remove from zone
      removeDriverFromZone(socket.id, driver.zone)
      // Remove from driver ID index
      driverIdToSocket.delete(driver.driverId)
      // Remove from connected drivers
      connectedDrivers.delete(socket.id)

      // If driver had an active ride, notify the passenger
      if (driver.currentRideId) {
        const ride = activeRides.get(driver.currentRideId)
        if (ride) {
          io.to(ride.passengerSocketId).emit('ride:status-update', {
            rideId: ride.rideId,
            status: 'driver_disconnected',
            message: 'Driver lost connection. Please wait or request a new ride.',
          })
        }
      }

      console.log(
        `[disconnect] Driver ${driver.driverId} disconnected (${reason})`
      )
    }

    if (passenger) {
      // Remove from passenger ID index
      passengerIdToSocket.delete(passenger.passengerId)
      // Remove from connected passengers
      connectedPassengers.delete(socket.id)

      // If passenger had a pending ride, remove it
      if (passenger.currentRideId) {
        const pending = pendingRides.get(passenger.currentRideId)
        if (pending) {
          removePendingRide(passenger.currentRideId)
        }
      }

      console.log(
        `[disconnect] Passenger ${passenger.passengerId} disconnected (${reason})`
      )
    }

    if (!driver && !passenger) {
      console.log(`[disconnect] Unknown socket ${socket.id} disconnected (${reason})`)
    }
  })

  socket.on('error', (error: Error) => {
    console.error(`[error] Socket ${socket.id} error:`, error.message)
  })
})

// ─── Server Startup ──────────────────────────────────────────────────────────

const PORT = 3004

httpServer.listen(PORT, () => {
  console.log('╔══════════════════════════════════════════════╗')
  console.log('║   MOVA Real-Time Tracking Service            ║')
  console.log(`║   Running on port ${PORT}                       ║`)
  console.log('║   Path: / (Caddy proxy)                     ║')
  console.log('╚══════════════════════════════════════════════╝')
})

// Log stats every 30 seconds
setInterval(logStats, 30000)

// ─── Graceful Shutdown ───────────────────────────────────────────────────────

function gracefulShutdown(signal: string) {
  console.log(`\n[shutdown] Received ${signal}, shutting down tracking service...`)

  // Notify all connected clients
  io.emit('service:shutdown', {
    message: 'Tracking service is shutting down. Please reconnect later.',
  })

  // Clean up intervals
  const intervals = (global as any).__intervals as NodeJS.Timeout[] | undefined
  if (intervals) {
    intervals.forEach(clearInterval)
  }

  httpServer.close(() => {
    console.log('[shutdown] Tracking service closed')
    process.exit(0)
  })

  // Force exit after 5 seconds
  setTimeout(() => {
    console.warn('[shutdown] Forcing exit after timeout')
    process.exit(1)
  }, 5000)
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'))
process.on('SIGINT', () => gracefulShutdown('SIGINT'))
