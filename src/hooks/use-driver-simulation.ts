'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface SimulatedDriver {
  id: string
  name: string
  lat: number
  lng: number
  heading: number // degrees 0-360
  speed: number // km/h
  vehicleType: 'standard' | 'premium' | 'moto'
  isOnline: boolean
  rating: number
}

// ─── Constants ─────────────────────────────────────────────────────────────────

const CONAKRY_BOUNDS = {
  latMin: 9.46,
  latMax: 9.72,
  lngMin: -13.80,
  lngMax: -13.40,
}

const SPEED_RANGES = {
  standard: { min: 20, max: 40 },
  premium: { min: 25, max: 45 },
  moto: { min: 30, max: 60 },
} as const

const UPDATE_INTERVAL = 2000 // 2 seconds
const HEADING_CHANGE_MIN = 5000 // 5 seconds
const HEADING_CHANGE_MAX = 10000 // 10 seconds
const DRIVER_COUNT = 12

// Degress per second at 1 km/h at Conakry's latitude (~9.6)
// 1 degree lat ≈ 111 km, 1 degree lng ≈ 111 * cos(9.6) ≈ 109.4 km
const DEG_LAT_PER_KMH_PER_SEC = 1 / 111 / 3600
const DEG_LNG_PER_KMH_PER_SEC = 1 / 109.4 / 3600

// ─── Driver Seed Data ──────────────────────────────────────────────────────────

const DRIVER_SEEDS: Array<{
  name: string
  vehicleType: 'standard' | 'premium' | 'moto'
  rating: number
}> = [
  { name: 'Mamadou Diallo', vehicleType: 'standard', rating: 4.8 },
  { name: 'Ibrahima Soumah', vehicleType: 'premium', rating: 4.9 },
  { name: 'Aboubacar Camara', vehicleType: 'standard', rating: 4.5 },
  { name: 'Ousmane Bah', vehicleType: 'moto', rating: 4.7 },
  { name: 'Sekou Keita', vehicleType: 'premium', rating: 4.6 },
  { name: 'Fode Manga', vehicleType: 'standard', rating: 4.3 },
  { name: 'Moussa Traore', vehicleType: 'moto', rating: 4.8 },
  { name: 'Lamine Doumbouya', vehicleType: 'standard', rating: 4.4 },
  { name: 'Amadou Barry', vehicleType: 'premium', rating: 4.9 },
  { name: 'Yaya Sylla', vehicleType: 'moto', rating: 4.2 },
  { name: 'Abdoul Condé', vehicleType: 'standard', rating: 4.7 },
  { name: 'Thierno Baldé', vehicleType: 'moto', rating: 4.5 },
]

// ─── Helpers ───────────────────────────────────────────────────────────────────

function randomBetween(min: number, max: number): number {
  return min + Math.random() * (max - min)
}

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val))
}

function randomSpeed(type: 'standard' | 'premium' | 'moto'): number {
  const range = SPEED_RANGES[type]
  return randomBetween(range.min, range.max)
}

function randomLat(): number {
  return randomBetween(CONAKRY_BOUNDS.latMin + 0.02, CONAKRY_BOUNDS.latMax - 0.02)
}

function randomLng(): number {
  return randomBetween(CONAKRY_BOUNDS.lngMin + 0.02, CONAKRY_BOUNDS.lngMax - 0.02)
}

function randomHeading(): number {
  return Math.random() * 360
}

function createInitialDrivers(): SimulatedDriver[] {
  return DRIVER_SEEDS.map((seed, i) => ({
    id: `sim-${i + 1}`,
    name: seed.name,
    lat: randomLat(),
    lng: randomLng(),
    heading: randomHeading(),
    speed: randomSpeed(seed.vehicleType),
    vehicleType: seed.vehicleType,
    isOnline: true,
    rating: seed.rating,
  }))
}

// ─── Hook ──────────────────────────────────────────────────────────────────────

export function useDriverSimulation(enabled: boolean): {
  drivers: SimulatedDriver[]
  isSimulating: boolean
} {
  const [drivers, setDrivers] = useState<SimulatedDriver[]>([])
  const [isSimulating, setIsSimulating] = useState(false)
  const movementIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const headingIntervalRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const onlineIntervalRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Update positions based on heading and speed
  const updatePositions = useCallback(() => {
    const elapsedSec = UPDATE_INTERVAL / 1000

    setDrivers((prev) =>
      prev.map((d) => {
        if (!d.isOnline) return d

        const headingRad = (d.heading * Math.PI) / 180
        const latDelta = d.speed * DEG_LAT_PER_KMH_PER_SEC * elapsedSec * Math.cos(headingRad)
        const lngDelta = d.speed * DEG_LNG_PER_KMH_PER_SEC * elapsedSec * Math.sin(headingRad)

        let newLat = d.lat + latDelta
        let newLng = d.lng + lngDelta
        let newHeading = d.heading

        // Bounce off Conakry bounds
        const margin = 0.005
        if (newLat < CONAKRY_BOUNDS.latMin + margin) {
          newLat = CONAKRY_BOUNDS.latMin + margin
          newHeading = 360 - newHeading // reflect north-south
        } else if (newLat > CONAKRY_BOUNDS.latMax - margin) {
          newLat = CONAKRY_BOUNDS.latMax - margin
          newHeading = 360 - newHeading
        }

        if (newLng < CONAKRY_BOUNDS.lngMin + margin) {
          newLng = CONAKRY_BOUNDS.lngMin + margin
          newHeading = 180 - newHeading // reflect east-west
        } else if (newLng > CONAKRY_BOUNDS.lngMax - margin) {
          newLng = CONAKRY_BOUNDS.lngMax - margin
          newHeading = 180 - newHeading
        }

        // Normalize heading to 0-360
        newHeading = ((newHeading % 360) + 360) % 360

        return { ...d, lat: newLat, lng: newLng, heading: newHeading }
      }),
    )
  }, [])

  // Randomly change headings for online drivers
  const changeHeadings = useCallback(() => {
    setDrivers((prev) =>
      prev.map((d) => {
        if (!d.isOnline) return d
        // Smooth heading change: add small random offset (-45 to +45 degrees)
        const offset = randomBetween(-45, 45)
        let newHeading = d.heading + offset
        newHeading = ((newHeading % 360) + 360) % 360
        // Slightly vary speed too
        const newSpeed = clamp(
          d.speed + randomBetween(-5, 5),
          SPEED_RANGES[d.vehicleType].min,
          SPEED_RANGES[d.vehicleType].max,
        )
        return { ...d, heading: newHeading, speed: newSpeed }
      }),
    )
  }, [])

  // Toggle 1-2 drivers online/offline
  const toggleOnlineStatus = useCallback(() => {
    setDrivers((prev) => {
      const onlineDrivers = prev.filter((d) => d.isOnline)
      const offlineDrivers = prev.filter((d) => !d.isOnline)

      if (onlineDrivers.length <= 1 && offlineDrivers.length === 0) {
        // Don't take the last driver offline if no one is offline
        return prev
      }

      const updated = [...prev]

      // Pick one random online driver to toggle
      if (onlineDrivers.length > 1) {
        const idx = Math.floor(Math.random() * onlineDrivers.length)
        const target = onlineDrivers[idx]
        const targetIdx = updated.findIndex((d) => d.id === target.id)
        if (targetIdx !== -1) {
          updated[targetIdx] = { ...updated[targetIdx], isOnline: !updated[targetIdx].isOnline }
        }
      }

      // Occasionally toggle a second driver (50% chance)
      if (Math.random() > 0.5 && onlineDrivers.length > 2) {
        const stillOnline = updated.filter((d) => d.isOnline)
        if (stillOnline.length > 1) {
          const idx2 = Math.floor(Math.random() * stillOnline.length)
          const target2 = stillOnline[idx2]
          const targetIdx2 = updated.findIndex((d) => d.id === target2.id)
          if (targetIdx2 !== -1) {
            updated[targetIdx2] = { ...updated[targetIdx2], isOnline: !updated[targetIdx2].isOnline }
          }
        }
      }

      return updated
    })
  }, [])

  useEffect(() => {
    if (!enabled) {
      // Cleanup all intervals
      if (movementIntervalRef.current) clearInterval(movementIntervalRef.current)
      if (headingIntervalRef.current) clearTimeout(headingIntervalRef.current)
      if (onlineIntervalRef.current) clearTimeout(onlineIntervalRef.current)
      movementIntervalRef.current = null
      headingIntervalRef.current = null
      onlineIntervalRef.current = null
      queueMicrotask(() => setIsSimulating(false))
      return
    }

    // Initialize drivers
    const initial = createInitialDrivers()
    queueMicrotask(() => {
      setDrivers(initial)
      setIsSimulating(true)
    })

    // Movement interval: update every 2 seconds
    movementIntervalRef.current = setInterval(() => {
      updatePositions()
    }, UPDATE_INTERVAL)

    // Heading change interval: random between 5-10 seconds, rescheduled each time
    const scheduleHeadingChange = () => {
      const delay = randomBetween(HEADING_CHANGE_MIN, HEADING_CHANGE_MAX)
      headingIntervalRef.current = setTimeout(() => {
        changeHeadings()
        scheduleHeadingChange()
      }, delay)
    }
    scheduleHeadingChange()

    // Online/offline toggle: every 15-30 seconds
    const scheduleOnlineToggle = () => {
      const delay = randomBetween(15000, 30000)
      onlineIntervalRef.current = setTimeout(() => {
        toggleOnlineStatus()
        scheduleOnlineToggle()
      }, delay)
    }
    scheduleOnlineToggle()

    return () => {
      if (movementIntervalRef.current) clearInterval(movementIntervalRef.current)
      if (headingIntervalRef.current) clearTimeout(headingIntervalRef.current)
      if (onlineIntervalRef.current) clearTimeout(onlineIntervalRef.current)
      movementIntervalRef.current = null
      headingIntervalRef.current = null
      onlineIntervalRef.current = null
    }
  }, [enabled, updatePositions, changeHeadings, toggleOnlineStatus])

  return { drivers, isSimulating }
}
