'use client'

import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Trophy,
  Medal,
  Star,
  Zap,
  Flame,
  Crown,
  TrendingUp,
  ChevronDown,
  CircleDot,
  Users,
} from 'lucide-react'
import { useAppStore } from '@/lib/mova/store'
import { useDrivers } from '@/lib/mova/api-hooks'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { ScrollArea } from '@/components/ui/scroll-area'

// ── Types ──────────────────────────────────────────────────────────

interface LeaderboardEntry {
  rank: number
  driverId: string
  name: string
  avatar?: string | null
  rating: number
  totalRides: number
  totalEarnings: number
  tier: string
  isOnline: boolean
  streak: number
}

interface DriverLeaderboardProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

// ── Tier calculation helper ────────────────────────────────────────

function deriveTier(totalRides: number): string {
  if (totalRides >= 500) return 'diamond'
  if (totalRides >= 200) return 'platinum'
  if (totalRides >= 100) return 'gold'
  if (totalRides >= 50) return 'silver'
  return 'bronze'
}

function deriveEarnings(totalRides: number, rating: number): number {
  // Rough estimate: avg fare ~15,000 GNF * rides, weighted by rating
  return Math.round(totalRides * 15000 * (rating / 4.5))
}

// ── Constants ──────────────────────────────────────────────────────

type Period = 'month' | 'quarter' | 'all'

const PERIODS: { value: Period; label: string }[] = [
  { value: 'month', label: 'Ce mois' },
  { value: 'quarter', label: 'Ce trimestre' },
  { value: 'all', label: 'Tout le temps' },
]

const TIER_CONFIG: Record<string, { label: string; bg: string; text: string; border: string }> = {
  bronze: { label: 'Bronze', bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-400', border: 'border-amber-300 dark:border-amber-700' },
  silver: { label: 'Argent', bg: 'bg-slate-100 dark:bg-slate-800', text: 'text-slate-600 dark:text-slate-300', border: 'border-slate-300 dark:border-slate-600' },
  gold: { label: 'Or', bg: 'bg-amber-50 dark:bg-amber-900/20', text: 'text-amber-400 dark:text-amber-400', border: 'border-amber-300 dark:border-amber-700' },
  platinum: { label: 'Platine', bg: 'bg-cyan-50 dark:bg-cyan-900/20', text: 'text-cyan-600 dark:text-cyan-400', border: 'border-cyan-300 dark:border-cyan-700' },
  diamond: { label: 'Diamant', bg: 'bg-violet-50 dark:bg-violet-900/20', text: 'text-violet-600 dark:text-violet-400', border: 'border-violet-300 dark:border-violet-700' },
}

// ── Helpers ────────────────────────────────────────────────────────

function formatGNF(amount: number): string {
  return new Intl.NumberFormat('fr-GN').format(amount)
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

function getTierConfig(tier: string) {
  return TIER_CONFIG[tier] ?? TIER_CONFIG.bronze
}

// ── Animation Variants ─────────────────────────────────────────────

const staggerContainer = {
  animate: { transition: { staggerChildren: 0.07 } },
}

const staggerItem = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
}

const podiumReveal = {
  initial: { opacity: 0, scale: 0.85, y: 30 },
  animate: { opacity: 1, scale: 1, y: 0 },
  exit: { opacity: 0, scale: 0.9 },
}

const listReveal = {
  initial: { opacity: 0, x: -16 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -16 },
}

// ── Sub-Components ─────────────────────────────────────────────────

function TierBadge({ tier }: { tier: string }) {
  const config = getTierConfig(tier)
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${config.bg} ${config.text} ${config.border}`}
    >
      {tier === 'diamond' && <Crown className="size-3" />}
      {tier === 'platinum' && <Zap className="size-3" />}
      {tier === 'gold' && <Trophy className="size-3" />}
      {tier === 'silver' && <Medal className="size-3" />}
      {tier === 'bronze' && <Medal className="size-3" />}
      {config.label}
    </span>
  )
}

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      <Star className="size-3 text-amber-500 fill-amber-500" />
      <span className="text-xs font-semibold text-foreground">{rating.toFixed(1)}</span>
    </div>
  )
}

function OnlineDot({ isOnline }: { isOnline: boolean }) {
  return (
    <div className="relative flex items-center justify-center">
      <div
        className={`size-2 rounded-full ${isOnline ? 'bg-emerald-500' : 'bg-muted-foreground/30'}`}
      />
      {isOnline && (
        <div className="absolute size-2 rounded-full bg-emerald-500 animate-ping opacity-40" />
      )}
    </div>
  )
}

function PodiumCard({
  entry,
  delay,
}: {
  entry: LeaderboardEntry
  delay: number
}) {
  const isFirst = entry.rank === 1
  const isSecond = entry.rank === 2
  const isThird = entry.rank === 3

  const gradientClass = isFirst
    ? 'from-amber-400 via-yellow-300 to-amber-500'
    : isSecond
      ? 'from-slate-300 via-gray-200 to-slate-400'
      : 'from-amber-600 via-orange-400 to-amber-700'

  const textClass = isFirst
    ? 'text-amber-900'
    : isSecond
      ? 'text-slate-800'
      : 'text-amber-100'

  const ringClass = isFirst
    ? 'ring-amber-400/40'
    : isSecond
      ? 'ring-slate-300/40'
      : 'ring-amber-600/40'

  const initials = getInitials(entry.name)

  return (
    <motion.div
      variants={podiumReveal}
      transition={{ type: 'spring', stiffness: 300, damping: 24, delay }}
      className={`flex flex-col items-center gap-2 flex-1 ${isFirst ? '-mt-2' : 'mt-0'}`}
    >
      {/* Trophy / Medal icon */}
      <div className="relative">
        {isFirst && (
          <div className="absolute -top-4 left-1/2 -translate-x-1/2 z-10">
            <motion.div
              initial={{ scale: 0, rotate: -30 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', delay: delay + 0.2, stiffness: 400, damping: 15 }}
            >
              <Trophy className="size-7 text-amber-500 drop-shadow-md" />
            </motion.div>
          </div>
        )}
        {isSecond && (
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
            <motion.div
              initial={{ scale: 0, rotate: -30 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', delay: delay + 0.2, stiffness: 400, damping: 15 }}
            >
              <Trophy className="size-6 text-slate-400 drop-shadow-sm" />
            </motion.div>
          </div>
        )}
        {isThird && (
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
            <motion.div
              initial={{ scale: 0, rotate: -30 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', delay: delay + 0.2, stiffness: 400, damping: 15 }}
            >
              <Medal className="size-6 text-amber-600 drop-shadow-sm" />
            </motion.div>
          </div>
        )}

        {/* Avatar */}
        <div
          className={`w-16 h-16 ${isFirst ? 'w-18 h-18' : ''} rounded-full bg-gradient-to-br ${gradientClass} ring-4 ${ringClass} flex items-center justify-center shadow-lg relative`}
        >
          <span className={`${isFirst ? 'text-lg' : 'text-base'} font-bold ${textClass}`}>
            {initials}
          </span>
          <div className="absolute bottom-0.5 right-0.5">
            <OnlineDot isOnline={entry.isOnline} />
          </div>
        </div>
      </div>

      {/* Name */}
      <div className="text-center mt-1">
        <p className={`text-sm font-bold leading-tight ${isFirst ? 'text-base' : ''}`}>
          {entry.name}
        </p>
        <div className="flex items-center justify-center gap-1.5 mt-1">
          <StarRating rating={entry.rating} />
        </div>
      </div>

      {/* Stats */}
      <div className="text-center space-y-0.5">
        <p className="text-[10px] text-muted-foreground font-medium">
          {entry.totalRides} courses
        </p>
        <p className="text-xs font-bold text-foreground">
          {formatGNF(entry.totalEarnings)} GNF
        </p>
      </div>

      {/* Tier + Streak */}
      <div className="flex items-center gap-1.5">
        <TierBadge tier={entry.tier} />
        {entry.streak > 0 && (
          <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-orange-500">
            <Flame className="size-3" />
            {entry.streak}j
          </span>
        )}
      </div>

      {/* Rank badge */}
      <div
        className={`w-7 h-7 rounded-full bg-gradient-to-br ${gradientClass} flex items-center justify-center shadow-sm mt-1`}
      >
        <span className={`text-xs font-extrabold ${textClass}`}>#{entry.rank}</span>
      </div>
    </motion.div>
  )
}

function ListItem({
  entry,
  isCurrentUser,
}: {
  entry: LeaderboardEntry
  isCurrentUser: boolean
}) {
  const initials = getInitials(entry.name)

  return (
    <motion.div variants={listReveal}>
      <div
        className={`flex items-center gap-3 p-3 rounded-xl transition-colors ${
          isCurrentUser
            ? 'bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800'
            : 'hover:bg-muted/50'
        }`}
      >
        {/* Rank */}
        <div className="w-8 shrink-0 text-center">
          <span
            className={`text-sm font-bold ${
              isCurrentUser
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-muted-foreground'
            }`}
          >
            #{entry.rank}
          </span>
        </div>

        {/* Avatar */}
        <div className="relative shrink-0">
          <Avatar className="size-10 border border-border">
            <AvatarFallback className="bg-muted text-muted-foreground text-xs font-bold">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="absolute -bottom-0.5 -right-0.5">
            <OnlineDot isOnline={entry.isOnline} />
          </div>
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="text-sm font-semibold truncate">{entry.name}</p>
            {isCurrentUser && (
              <span className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/30 px-1.5 py-0.5 rounded-full">
                VOUS
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <StarRating rating={entry.rating} />
            <TierBadge tier={entry.tier} />
          </div>
        </div>

        {/* Stats */}
        <div className="text-right shrink-0">
          <p className="text-xs font-bold">{formatGNF(entry.totalEarnings)}</p>
          <p className="text-[10px] text-muted-foreground">{entry.totalRides} courses</p>
        </div>
      </div>
    </motion.div>
  )
}

// ── Main Component ─────────────────────────────────────────────────

export default function DriverLeaderboard({
  open,
  onOpenChange,
}: DriverLeaderboardProps) {
  const [period, setPeriod] = useState<Period>('month')
  const { user } = useAppStore()
  const currentUserId = user?.id ?? ''

  const { data: driversData, isLoading } = useDrivers()

  const drivers: LeaderboardEntry[] = useMemo(() => {
    if (!driversData || driversData.length === 0) return []
    return driversData
      .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
      .slice(0, 10)
      .map((d, idx) => ({
        rank: idx + 1,
        driverId: d.id,
        name: d.name,
        avatar: d.avatar,
        rating: d.rating ?? 0,
        totalRides: d.completedRides ?? 0,
        totalEarnings: deriveEarnings(d.completedRides ?? 0, d.rating ?? 4.0),
        tier: deriveTier(d.completedRides ?? 0),
        isOnline: d.isOnline,
        streak: 0,
      }))
  }, [driversData])

  const top3 = drivers.filter((d) => d.rank <= 3)
  const remaining = drivers.filter((d) => d.rank > 3)
  const currentUser = drivers.find((d) => d.driverId === currentUserId)

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[92vh] rounded-t-2xl px-0 pb-0">
        {/* Handle bar */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-muted-foreground/20" />
        </div>

        <SheetHeader className="px-5 pb-0">
          <div className="flex items-center justify-between">
            <div>
              <SheetTitle className="text-lg font-bold flex items-center gap-2">
                <Trophy className="size-5 text-amber-500" />
                Classement MOVA
              </SheetTitle>
              <SheetDescription className="text-xs mt-1">
                Les meilleurs chauffeurs de Conakry
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        {/* Period Tabs */}
        <div className="px-5 pt-3">
          <div className="flex items-center gap-1.5 p-1 bg-muted rounded-xl">
            {PERIODS.map((p) => (
              <button
                key={p.value}
                onClick={() => setPeriod(p.value)}
                className={`flex-1 text-xs font-semibold py-2 px-3 rounded-lg transition-all ${
                  period === p.value
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <ScrollArea className="flex-1 overflow-auto px-5 pt-4" style={{ maxHeight: 'calc(92vh - 160px)' }}>
          <div className="pb-8 space-y-6">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-12 gap-3">
                <div className="size-8 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" />
                <p className="text-sm text-muted-foreground">Chargement du classement...</p>
              </div>
            ) : drivers.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 gap-3">
                <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center">
                  <Users className="size-6 text-muted-foreground" />
                </div>
                <p className="text-sm font-medium text-muted-foreground">Aucun chauffeur disponible</p>
                <p className="text-xs text-muted-foreground/70">Le classement apparaitra lorsque des chauffeurs seront inscrits.</p>
              </div>
            ) : (
            <AnimatePresence mode="wait">
              <motion.div
                key={period}
                variants={staggerContainer}
                initial="initial"
                animate="animate"
                exit="exit"
                className="space-y-6"
              >
                {/* ── Top 3 Podium ── */}
                <div>
                  {/* Podium visual order: 2nd | 1st | 3rd */}
                  <div className="flex items-end justify-center gap-3 pt-4">
                    {top3
                      .sort((a, b) => {
                        // Display order: 2nd, 1st, 3rd
                        const order: Record<number, number> = { 2: 0, 1: 1, 3: 2 }
                        return (order[a.rank] ?? 0) - (order[b.rank] ?? 0)
                      })
                      .map((entry) => (
                        <PodiumCard
                          key={entry.driverId}
                          entry={entry}
                          delay={entry.rank === 1 ? 0 : entry.rank === 2 ? 0.15 : 0.3}
                        />
                      ))}
                  </div>

                  {/* Podium base bars */}
                  <div className="flex items-end justify-center gap-3 mt-3">
                    {[2, 1, 3].map((rank) => (
                      <div key={rank} className="flex-1 flex justify-center">
                        <motion.div
                          initial={{ height: 0 }}
                          animate={{ height: rank === 1 ? 24 : rank === 2 ? 16 : 12 }}
                          transition={{ duration: 0.5, delay: 0.4 }}
                          className={`w-full rounded-t-lg ${
                            rank === 1
                              ? 'h-6 bg-gradient-to-t from-amber-500 to-amber-300'
                              : rank === 2
                                ? 'h-4 bg-gradient-to-t from-slate-400 to-slate-200'
                                : 'h-3 bg-gradient-to-t from-amber-600 to-amber-400'
                          }`}
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {/* ── Remaining positions (4th-10th) ── */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp className="size-4 text-muted-foreground" />
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Classement complet
                    </h3>
                  </div>
                  {remaining.map((entry) => (
                    <ListItem
                      key={entry.driverId}
                      entry={entry}
                      isCurrentUser={entry.driverId === currentUserId}
                    />
                  ))}
                </div>

                {/* ── Your Position ── */}
                {currentUser && currentUser.rank > 3 && (
                  <motion.div
                    variants={staggerItem}
                    transition={{ delay: 0.5 }}
                  >
                    <div className="rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 p-4 text-white shadow-lg">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                            <span className="text-sm font-extrabold">#{currentUser.rank}</span>
                          </div>
                          <div>
                            <p className="text-xs font-medium text-white/70">
                              Votre position
                            </p>
                            <p className="text-sm font-bold">
                              {currentUser.name}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-0.5">
                            <Star className="size-3 text-yellow-300 fill-yellow-300" />
                            <span className="text-xs font-bold">{currentUser.rating}</span>
                          </div>
                          <div className="flex items-center gap-0.5">
                            <Flame className="size-3 text-orange-300" />
                            <span className="text-xs font-bold">{currentUser.streak}j</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 mt-3 pt-3 border-t border-white/20">
                        <div>
                          <p className="text-[10px] text-white/60 font-medium">Revenus</p>
                          <p className="text-xs font-bold">{formatGNF(currentUser.totalEarnings)} GNF</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-white/60 font-medium">Courses</p>
                          <p className="text-xs font-bold">{currentUser.totalRides}</p>
                        </div>
                        <div className="ml-auto">
                          <TierBadge tier={currentUser.tier} />
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* ── Motivational Footer ── */}
                <motion.div
                  variants={staggerItem}
                  className="text-center pt-2"
                >
                  <div className="inline-flex items-center gap-2 rounded-full bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 px-4 py-2">
                    <Zap className="size-4 text-amber-500" />
                    <span className="text-xs font-medium text-amber-700 dark:text-amber-300">
                      Gagnez des points et montez dans le classement !
                    </span>
                  </div>
                </motion.div>
              </motion.div>
            </AnimatePresence>
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  )
}
