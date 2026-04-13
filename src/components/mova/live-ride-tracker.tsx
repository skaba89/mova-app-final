"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"
import {
  Car,
  Navigation,
  Phone,
  Share2,
  X,
  ChevronUp,
  Clock,
  MapPin,
  Star,
  Route,
} from "lucide-react"

// ─── Types ─────────────────────────────────────────────────────────────────────

interface LiveRideTrackerProps {
  driverName: string
  vehicleType: string
  vehiclePlate: string
  driverRating: number
  driverPhone?: string
  status: "accepted" | "in_progress" | "arriving"
  etaSeconds: number
  distanceRemaining: number
  pickupAddress?: string
  dropoffAddress?: string
  onCancelRide?: () => void
  onCallDriver?: () => void
  onShareTrip?: () => void
}

// ─── Status Configuration ──────────────────────────────────────────────────────

interface StatusConfig {
  label: string
  icon: React.ReactNode
  colorClass: string
  bgClass: string
  borderClass: string
  dotClass: string
}

const STATUS_CONFIG: Record<LiveRideTrackerProps["status"], StatusConfig> = {
  accepted: {
    label: "En route vers vous",
    icon: <Car className="size-3.5" />,
    colorClass: "text-blue-600 dark:text-blue-400",
    bgClass: "bg-blue-50 dark:bg-blue-950/30",
    borderClass: "border-blue-200 dark:border-blue-800/50",
    dotClass: "bg-blue-500",
  },
  in_progress: {
    label: "Course en cours",
    icon: <Navigation className="size-3.5" />,
    colorClass: "text-emerald-600 dark:text-emerald-400",
    bgClass: "bg-emerald-50 dark:bg-emerald-950/30",
    borderClass: "border-emerald-200 dark:border-emerald-800/50",
    dotClass: "bg-emerald-500",
  },
  arriving: {
    label: "Arrivee imminente",
    icon: <Route className="size-3.5" />,
    colorClass: "text-amber-600 dark:text-amber-400",
    bgClass: "bg-amber-50 dark:bg-amber-950/30",
    borderClass: "border-amber-200 dark:border-amber-800/50",
    dotClass: "bg-amber-500",
  },
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)
}

function formatEta(seconds: number): string {
  if (seconds <= 0) return "Arrive"
  if (seconds < 30) return "Arrivee imminente"
  if (seconds < 60) return `${Math.ceil(seconds)} sec`
  const minutes = Math.ceil(seconds / 60)
  return `${minutes} min`
}

function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`
  return `${km.toFixed(1)} km`
}

// ─── Animation Variants ────────────────────────────────────────────────────────

const trackerVariants = {
  compact: {
    height: "auto",
    transition: { type: "spring" as const, stiffness: 400, damping: 35 },
  },
  expanded: {
    height: "auto",
    transition: { type: "spring" as const, stiffness: 400, damping: 35 },
  },
}

const contentVariants = {
  collapsed: {
    opacity: 0,
    height: 0,
    marginTop: 0,
    transition: { duration: 0.25, ease: "easeInOut" as const },
  },
  visible: {
    opacity: 1,
    height: "auto",
    marginTop: 12,
    transition: { duration: 0.25, ease: "easeInOut" as const },
  },
}

// ─── Component ─────────────────────────────────────────────────────────────────

export default function LiveRideTracker({
  driverName,
  vehicleType,
  vehiclePlate,
  driverRating,
  driverPhone,
  status,
  etaSeconds: etaSecondsProp,
  distanceRemaining,
  pickupAddress,
  dropoffAddress,
  onCancelRide,
  onCallDriver,
  onShareTrip,
}: LiveRideTrackerProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [remainingSeconds, setRemainingSeconds] = useState(etaSecondsProp)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const statusConfig = STATUS_CONFIG[status]

  // ── Countdown Timer ──
  useEffect(() => {
    setRemainingSeconds(etaSecondsProp)
  }, [etaSecondsProp])

  // Track whether countdown should be running
  const isFinished = remainingSeconds <= 0

  useEffect(() => {
    if (isFinished) {
      // Stop countdown when finished
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      return
    }

    intervalRef.current = setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          if (intervalRef.current) {
            clearInterval(intervalRef.current)
            intervalRef.current = null
          }
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [isFinished])

  const toggleExpand = useCallback(() => {
    setIsExpanded((prev) => !prev)
  }, [])

  const handleCancel = useCallback(() => {
    onCancelRide?.()
  }, [onCancelRide])

  const handleCall = useCallback(() => {
    onCallDriver?.()
  }, [onCallDriver])

  const handleShare = useCallback(() => {
    onShareTrip?.()
  }, [onShareTrip])

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 flex justify-center sm:bottom-6 sm:px-4 pointer-events-none">
      <motion.div
        variants={trackerVariants}
        initial="compact"
        animate={isExpanded ? "expanded" : "compact"}
        className="w-full sm:max-w-md pointer-events-auto"
      >
        <div className="mx-0 sm:mx-auto bg-background/80 dark:bg-background/70 backdrop-blur-xl border border-border/60 dark:border-border/40 rounded-t-2xl sm:rounded-2xl shadow-lg shadow-black/10 dark:shadow-black/30 overflow-hidden">
          {/* ── Compact Header (always visible) ── */}
          <button
            type="button"
            onClick={toggleExpand}
            className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-accent/30 dark:hover:bg-accent/10 transition-colors cursor-pointer"
            aria-expanded={isExpanded}
            aria-label={isExpanded ? "Reduire les details" : "Afficher les details"}
          >
            {/* Driver Avatar */}
            <div className="relative shrink-0">
              <Avatar className="h-12 w-12">
                <AvatarFallback className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 font-bold text-sm">
                  {getInitials(driverName)}
                </AvatarFallback>
              </Avatar>
              {/* Pulsing status dot */}
              <span className={`absolute -bottom-0.5 -right-0.5 size-3.5 rounded-full ${statusConfig.dotClass} border-2 border-background dark:border-background/80 animate-pulse`} />
            </div>

            {/* Driver Info + ETA */}
            <div className="flex-1 min-w-0 text-left">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold truncate">{driverName}</h3>
                <span className="relative flex items-center gap-1 whitespace-nowrap">
                  {status === "arriving" && (
                    <span className="absolute inset-0 rounded-full animate-ping bg-amber-400/30 dark:bg-amber-500/20 -m-1.5" />
                  )}
                  <span className="relative flex items-center gap-1 text-xs font-medium text-muted-foreground">
                    <Clock className="size-3" />
                    {formatEta(remainingSeconds)}
                  </span>
                </span>
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs text-muted-foreground truncate">
                  {vehicleType} &middot; {vehiclePlate}
                </span>
                <Star className="size-3 text-amber-500 fill-amber-500 shrink-0" />
                <span className="text-xs text-muted-foreground font-medium">
                  {driverRating.toFixed(1)}
                </span>
              </div>
            </div>

            {/* Status Badge */}
            <Badge
              variant="secondary"
              className={`shrink-0 gap-1.5 text-[11px] font-medium px-2.5 py-1 ${statusConfig.colorClass} ${statusConfig.bgClass} border ${statusConfig.borderClass}`}
            >
              {statusConfig.icon}
              {statusConfig.label}
            </Badge>

            {/* Expand/Collapse Chevron */}
            <motion.div
              animate={{ rotate: isExpanded ? 180 : 0 }}
              transition={{ duration: 0.2 }}
              className="shrink-0 text-muted-foreground ml-0.5"
            >
              <ChevronUp className="size-4" />
            </motion.div>
          </button>

          {/* ── Expanded Content (animated) ── */}
          <AnimatePresence initial={false}>
            {isExpanded && (
              <motion.div
                key="expanded-content"
                variants={contentVariants}
                initial="collapsed"
                animate="visible"
                exit="collapsed"
              >
                <div className="px-4 pb-4 space-y-3">
                  <Separator className="bg-border/50" />

                  {/* ── ETA + Distance Stats ── */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className={`rounded-xl p-3 ${statusConfig.bgClass}`}>
                      <div className="flex items-center gap-1.5 mb-1">
                        <Clock className={`size-3.5 ${statusConfig.colorClass}`} />
                        <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                          Temps restant
                        </span>
                      </div>
                      <p className={`text-lg font-bold ${statusConfig.colorClass}`}>
                        {formatEta(remainingSeconds)}
                      </p>
                    </div>
                    <div className="rounded-xl p-3 bg-muted/50 dark:bg-muted/20">
                      <div className="flex items-center gap-1.5 mb-1">
                        <Route className="size-3.5 text-muted-foreground" />
                        <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                          Distance
                        </span>
                      </div>
                      <p className="text-lg font-bold">
                        {formatDistance(distanceRemaining)}
                      </p>
                    </div>
                  </div>

                  {/* ── Addresses ── */}
                  {(pickupAddress || dropoffAddress) && (
                    <div className="space-y-2">
                      {pickupAddress && (
                        <div className="flex items-start gap-2.5">
                          <div className="mt-0.5 size-5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center shrink-0">
                            <div className="size-2 rounded-full bg-emerald-500" />
                          </div>
                          <div className="min-w-0">
                            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                              Depart
                            </span>
                            <p className="text-sm truncate mt-0.5">
                              {pickupAddress}
                            </p>
                          </div>
                        </div>
                      )}
                      {pickupAddress && dropoffAddress && (
                        <div className="ml-2.5 border-l-2 border-dashed border-border/50 h-2" />
                      )}
                      {dropoffAddress && (
                        <div className="flex items-start gap-2.5">
                          <div className="mt-0.5 size-5 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center shrink-0">
                            <MapPin className="size-2.5 text-red-500" />
                          </div>
                          <div className="min-w-0">
                            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                              Arrivee
                            </span>
                            <p className="text-sm truncate mt-0.5">
                              {dropoffAddress}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* ── Action Buttons ── */}
                  <div className="flex items-center gap-2">
                    {/* Call Driver */}
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 h-10 gap-2 rounded-xl border-emerald-200 dark:border-emerald-800/50 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors"
                      onClick={handleCall}
                      disabled={!driverPhone && !onCallDriver}
                    >
                      <Phone className="size-4" />
                      <span className="text-xs font-medium">Appeler</span>
                    </Button>

                    {/* Share Trip */}
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 h-10 gap-2 rounded-xl hover:bg-accent/50 transition-colors"
                      onClick={handleShare}
                      disabled={!onShareTrip}
                    >
                      <Share2 className="size-4" />
                      <span className="text-xs font-medium">Partager</span>
                    </Button>

                    {/* Cancel Ride */}
                    <Button
                      variant="destructive"
                      size="sm"
                      className="flex-1 h-10 gap-2 rounded-xl"
                      onClick={handleCancel}
                      disabled={!onCancelRide}
                    >
                      <X className="size-4" />
                      <span className="text-xs font-medium">Annuler</span>
                    </Button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── Progress Bar (visual ETA indicator) ── */}
          <div className="h-1 bg-muted/30">
            <motion.div
              className={`h-full ${statusConfig.dotClass}`}
              initial={{ width: "0%" }}
              animate={{
                width: status === "arriving"
                  ? "90%"
                  : status === "in_progress"
                    ? "60%"
                    : "30%",
              }}
              transition={{ duration: 1.5, ease: "easeOut" }}
            />
          </div>
        </div>
      </motion.div>
    </div>
  )
}
