"use client"

import { useState, useRef, useEffect, useCallback } from "react"

// ─── Types ────────────────────────────────────────────────────────────────────

interface SmoothPositionOptions {
  /** Animation duration in ms (default: 1500, matching GPS update interval) */
  duration?: number
  /** Enable/disable interpolation (default: true) */
  enabled?: boolean
  /** Easing function (default: ease-out) */
  easing?: "linear" | "ease-out" | "ease-in-out"
}

interface SmoothPositionReturn {
  /** Current interpolated latitude */
  lat: number
  /** Current interpolated longitude */
  lng: number
  /** Current heading in degrees (0-360) */
  heading: number
  /** Whether animation is currently in progress */
  isAnimating: boolean
  /** Progress of current animation (0-1) */
  progress: number
}

type EasingFunction = (t: number) => number

// ─── Easing helpers ───────────────────────────────────────────────────────────

const EASING_MAP: Record<string, EasingFunction> = {
  linear: (t: number) => t,
  "ease-out": (t: number) => 1 - Math.pow(1 - t, 3), // cubic ease-out
  "ease-in-out": (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
}

// ─── Bearing calculation ──────────────────────────────────────────────────────
// Returns heading in degrees 0–360, where 0 = North, 90 = East, etc.

function calculateBearing(fromLat: number, fromLng: number, toLat: number, toLng: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const toDeg = (rad: number) => (rad * 180) / Math.PI

  const dLng = toRad(toLng - fromLng)
  const lat1 = toRad(fromLat)
  const lat2 = toRad(toLat)

  const y = Math.sin(dLng) * Math.cos(lat2)
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng)

  const bearing = toDeg(Math.atan2(y, x))
  return ((bearing % 360) + 360) % 360
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * useSmoothPosition
 *
 * Provides smooth interpolation between GPS position updates using
 * requestAnimationFrame for 60fps animation. When the target position
 * changes, the hook animates from the currently displayed position to
 * the new target over the specified duration with the chosen easing.
 */
export function useSmoothPosition(
  targetLat: number | null | undefined,
  targetLng: number | null | undefined,
  options: SmoothPositionOptions = {}
): SmoothPositionReturn {
  const {
    duration = 1500,
    enabled = true,
    easing = "ease-out",
  } = options

  const easingFn = EASING_MAP[easing] ?? EASING_MAP["ease-out"]

  // ── State ───────────────────────────────────────────────────────────────

  const [lat, setLat] = useState<number>(0)
  const [lng, setLng] = useState<number>(0)
  const [heading, setHeading] = useState<number>(0)
  const [isAnimating, setIsAnimating] = useState(false)
  const [progress, setProgress] = useState<number>(0)

  // ── Refs ────────────────────────────────────────────────────────────────

  const rafRef = useRef<number | null>(null)
  const animStartRef = useRef<number>(0)
  const fromLatRef = useRef<number>(0)
  const fromLngRef = useRef<number>(0)
  const targetLatRef = useRef<number>(0)
  const targetLngRef = useRef<number>(0)
  // Track whether we've received at least one valid position
  const hasPositionRef = useRef<boolean>(false)
  // Refs to hold latest duration / easing so the RAF loop always reads fresh values
  const durationRef = useRef(duration)
  const easingFnRef = useRef(easingFn)

  // Keep refs in sync with props/options (inside an effect to satisfy lint)
  useEffect(() => {
    durationRef.current = duration
    easingFnRef.current = easingFn
  }, [duration, easingFn])

  // ── Cleanup helper ──────────────────────────────────────────────────────

  const cancelAnimation = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
  }, [])

  // ── Animation frame loop ────────────────────────────────────────────────
  // Defined as a plain function so it can reference itself without the
  // useCallback self-reference issue flagged by react-hooks/immutability.

  const tick = (now: number) => {
    const dur = durationRef.current
    const ease = easingFnRef.current

    const elapsed = now - animStartRef.current
    const rawProgress = Math.min(elapsed / dur, 1)
    const easedProgress = ease(rawProgress)

    setLat(fromLatRef.current + (targetLatRef.current - fromLatRef.current) * easedProgress)
    setLng(fromLngRef.current + (targetLngRef.current - fromLngRef.current) * easedProgress)
    setProgress(rawProgress)

    if (rawProgress < 1) {
      rafRef.current = requestAnimationFrame(tick)
    } else {
      setIsAnimating(false)
      rafRef.current = null
    }
  }

  // ── Start animation toward a new target ─────────────────────────────────

  const startAnimation = useCallback(
    (newLat: number, newLng: number) => {
      cancelAnimation()

      fromLatRef.current = lat
      fromLngRef.current = lng
      targetLatRef.current = newLat
      targetLngRef.current = newLng

      // Calculate heading from previous position to new target
      const newHeading = calculateBearing(lat, lng, newLat, newLng)
      setHeading(newHeading)

      setIsAnimating(true)
      animStartRef.current = performance.now()
      rafRef.current = requestAnimationFrame(tick)
    },
    [lat, lng, cancelAnimation]
  )

  // ── React to target position changes ────────────────────────────────────

  useEffect(() => {
    // Skip if target is invalid
    if (targetLat == null || targetLng == null) return

    if (!hasPositionRef.current) {
      // First valid position — snap immediately, no animation.
      // Deferred via RAF to avoid synchronous setState in effect body.
      hasPositionRef.current = true
      const snapLat = targetLat
      const snapLng = targetLng
      requestAnimationFrame(() => {
        setLat(snapLat)
        setLng(snapLng)
        setHeading(0)
        setProgress(1)
        setIsAnimating(false)
      })
      return
    }

    if (!enabled) {
      // Interpolation disabled — snap to target (deferred via RAF).
      cancelAnimation()
      const snapLat = targetLat
      const snapLng = targetLng
      const snapHeading = calculateBearing(lat, lng, targetLat, targetLng)
      requestAnimationFrame(() => {
        setLat(snapLat)
        setLng(snapLng)
        setHeading(snapHeading)
        setProgress(1)
        setIsAnimating(false)
      })
      return
    }

    // Only animate if the target actually changed
    const moved = targetLatRef.current !== targetLat || targetLngRef.current !== targetLng
    if (moved) {
      // Defer startAnimation to avoid synchronous setState in effect body
      const aLat = targetLat
      const aLng = targetLng
      requestAnimationFrame(() => startAnimation(aLat, aLng))
    }
  }, [targetLat, targetLng, enabled, lat, lng, cancelAnimation, startAnimation])

  // ── Cleanup on unmount ──────────────────────────────────────────────────

  useEffect(() => {
    return () => {
      cancelAnimation()
    }
  }, [cancelAnimation])

  return { lat, lng, heading, isAnimating, progress }
}
