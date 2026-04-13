'use client'

import { useState, useEffect, useMemo } from 'react'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Trophy, Flame, Star, Gift, ArrowUp, Crown,
  Sparkles, ChevronRight, TrendingUp, TrendingDown,
  Zap, Lock, Check, CreditCard, Percent, Headphones,
  XCircle, Car, Inbox,
} from 'lucide-react'
import { useAppStore } from '@/lib/mova/store'
import { Skeleton } from '@/components/ui/skeleton'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type LoyaltyTier = 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond'

interface TierInfo {
  name: string
  minPoints: number
  maxPoints: number
  cashback: string
  color: string
  bgGradient: string
  iconBg: string
  iconColor: string
  benefits: Array<{ label: string; icon: React.ReactNode }>
}

interface Reward {
  id: string
  name: string
  pointsCost: number
  value: string
  description: string
}

interface LoyaltyPanelProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

// ---------------------------------------------------------------------------
// Tier config
// ---------------------------------------------------------------------------

const TIERS: Record<LoyaltyTier, TierInfo> = {
  bronze: {
    name: 'Bronze',
    minPoints: 0,
    maxPoints: 999,
    cashback: 'x1',
    color: 'text-amber-600',
    bgGradient: 'from-amber-600 to-amber-800',
    iconBg: 'bg-amber-100 dark:bg-amber-900/30',
    iconColor: 'text-amber-600',
    benefits: [
      { label: 'Cashback x1', icon: <Percent className="h-3.5 w-3.5" /> },
    ],
  },
  silver: {
    name: 'Argent',
    minPoints: 1000,
    maxPoints: 4999,
    cashback: 'x1.5',
    color: 'text-slate-400',
    bgGradient: 'from-slate-400 to-slate-600',
    iconBg: 'bg-slate-100 dark:bg-slate-900/30',
    iconColor: 'text-slate-400',
    benefits: [
      { label: 'Cashback x1.5', icon: <Percent className="h-3.5 w-3.5" /> },
      { label: 'Matching prioritaire', icon: <Zap className="h-3.5 w-3.5" /> },
    ],
  },
  gold: {
    name: 'Or',
    minPoints: 5000,
    maxPoints: 14999,
    cashback: 'x2',
    color: 'text-amber-400',
    bgGradient: 'from-amber-400 to-amber-600',
    iconBg: 'bg-amber-100 dark:bg-amber-900/30',
    iconColor: 'text-amber-400',
    benefits: [
      { label: 'Cashback x2', icon: <Percent className="h-3.5 w-3.5" /> },
      { label: 'Annulation gratuite', icon: <XCircle className="h-3.5 w-3.5" /> },
      { label: 'Matching prioritaire', icon: <Zap className="h-3.5 w-3.5" /> },
    ],
  },
  platinum: {
    name: 'Platine',
    minPoints: 15000,
    maxPoints: 49999,
    cashback: 'x3',
    color: 'text-cyan-400',
    bgGradient: 'from-cyan-400 to-cyan-600',
    iconBg: 'bg-cyan-100 dark:bg-cyan-900/30',
    iconColor: 'text-cyan-400',
    benefits: [
      { label: 'Cashback x3', icon: <Percent className="h-3.5 w-3.5" /> },
      { label: 'Annulation gratuite', icon: <XCircle className="h-3.5 w-3.5" /> },
      { label: 'Matching prioritaire', icon: <Zap className="h-3.5 w-3.5" /> },
      { label: 'Support dedie', icon: <Headphones className="h-3.5 w-3.5" /> },
    ],
  },
  diamond: {
    name: 'Diamant',
    minPoints: 50000,
    maxPoints: Infinity,
    cashback: 'x5',
    color: 'text-violet-400',
    bgGradient: 'from-violet-400 to-violet-600',
    iconBg: 'bg-violet-100 dark:bg-violet-900/30',
    iconColor: 'text-violet-400',
    benefits: [
      { label: 'Cashback x5', icon: <Percent className="h-3.5 w-3.5" /> },
      { label: 'Annulation gratuite', icon: <XCircle className="h-3.5 w-3.5" /> },
      { label: 'Matching prioritaire', icon: <Zap className="h-3.5 w-3.5" /> },
      { label: 'Support dedie', icon: <Headphones className="h-3.5 w-3.5" /> },
      { label: 'Course mensuelle gratuite', icon: <Car className="h-3.5 w-3.5" /> },
    ],
  },
}

const TIER_ORDER: LoyaltyTier[] = ['bronze', 'silver', 'gold', 'platinum', 'diamond']

const REWARDS: Reward[] = [
  { id: 'r1', name: 'Reduction 2,500 GNF', pointsCost: 500, value: '2,500 GNF', description: 'Sur votre prochaine course' },
  { id: 'r2', name: 'Reduction 5,000 GNF', pointsCost: 1000, value: '5,000 GNF', description: 'Sur votre prochaine course' },
  { id: 'r3', name: 'Course gratuite', pointsCost: 2000, value: '8,000 GNF', description: 'Jusqu\'a 8,000 GNF' },
  { id: 'r4', name: 'Pass Journee', pointsCost: 5000, value: '15,000 GNF', description: '3 courses en une journee' },
  { id: 'r5', name: 'Premium 1 mois', pointsCost: 10000, value: 'Premium', description: 'Statut Gold pendant 30 jours' },
]

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getNextTier(current: LoyaltyTier): LoyaltyTier | null {
  const idx = TIER_ORDER.indexOf(current)
  return idx < TIER_ORDER.length - 1 ? TIER_ORDER[idx + 1] : null
}

function getTierIcon(tier: LoyaltyTier) {
  switch (tier) {
    case 'bronze':
      return <Trophy className="h-5 w-5 text-amber-600" />
    case 'silver':
      return <Star className="h-5 w-5 text-slate-400" />
    case 'gold':
      return <Crown className="h-5 w-5 text-amber-400" />
    case 'platinum':
      return <Sparkles className="h-5 w-5 text-cyan-400" />
    case 'diamond':
      return <Sparkles className="h-5 w-5 text-violet-400" />
  }
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  const hours = Math.floor(diff / (1000 * 60 * 60))
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))

  if (hours < 1) return 'A l\'instant'
  if (hours < 24) return `il y a ${hours}h`
  if (days === 1) return 'Hier'
  if (days < 7) return `il y a ${days}j`
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}

// ---------------------------------------------------------------------------
// Fire Streak Component
// ---------------------------------------------------------------------------

function StreakCounter({ streak }: { streak: number }) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <motion.div
              animate={{ scale: [1, 1.2, 1], rotate: [0, -5, 5, 0] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
            >
              <Flame className="h-5 w-5 text-orange-500" />
            </motion.div>
            <span className="text-sm font-semibold">Serie en cours</span>
          </div>
          <Badge className="bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 border-0">
            {streak} jour{streak > 1 ? 's' : ''}
          </Badge>
        </div>

        {/* Visual streak dots */}
        <div className="flex items-center gap-1.5">
          {[1, 2, 3, 4, 5, 6, 7].map((day) => (
            <div
              key={day}
              className={`flex-1 h-2 rounded-full transition-all ${
                day <= (streak % 7 || (streak > 0 ? 7 : 0))
                  ? 'bg-gradient-to-r from-orange-400 to-red-500 shadow-sm shadow-orange-500/30'
                  : 'bg-muted'
              }`}
            />
          ))}
        </div>
        <p className="text-[11px] text-muted-foreground mt-2">
          {streak >= 5
            ? `Bonus serie ! +200 pts tous les 5 jours`
            : `${Math.max(0, 5 - (streak % 5))} jour${Math.max(0, 5 - (streak % 5)) !== 1 ? 's' : ''} avant le prochain bonus`}
        </p>
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Tier Progress Card
// ---------------------------------------------------------------------------

function TierProgressCard({
  tier,
  points,
}: {
  tier: LoyaltyTier
  points: number
}) {
  const tierInfo = TIERS[tier]
  const nextTier = getNextTier(tier)
  const nextTierInfo = nextTier ? TIERS[nextTier] : null

  let progressPercent = 100
  let pointsToNext = 0

  if (nextTierInfo) {
    const rangeStart = tierInfo.minPoints
    const rangeEnd = nextTierInfo.minPoints
    const rangeTotal = rangeEnd - rangeStart
    const currentInRange = points - rangeStart
    progressPercent = Math.min(Math.round((currentInRange / rangeTotal) * 100), 100)
    pointsToNext = rangeEnd - points
  }

  return (
    <Card className={`overflow-hidden border-0 shadow-lg`}>
      <div className={`bg-gradient-to-r ${tierInfo.bgGradient} p-4 text-white`}>
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center">
            {getTierIcon(tier)}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <p className="text-lg font-bold">{tierInfo.name}</p>
              <Badge className="bg-white/20 text-white border-0 text-xs">
                Cashback {tierInfo.cashback}
              </Badge>
            </div>
            <p className="text-sm text-white/80">
              {nextTier
                ? `${pointsToNext.toLocaleString('fr-FR')} pts avant ${nextTierInfo?.name ?? ''}`
                : 'Niveau maximum atteint'}
            </p>
          </div>
          {nextTier && nextTierInfo && (
            <div className={`w-10 h-10 rounded-lg ${nextTierInfo.iconBg} flex items-center justify-center`}>
              <ArrowUp className={`h-4 w-4 ${nextTierInfo.iconColor}`} />
            </div>
          )}
        </div>
        {nextTier && nextTierInfo && (
          <div className="mt-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-white/70">{tierInfo.name}</span>
              <span className="text-xs text-white/70">{nextTierInfo.name}</span>
            </div>
            <div className="h-2 bg-white/20 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-white rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${progressPercent}%` }}
                transition={{ duration: 1, ease: 'easeOut', delay: 0.3 }}
              />
            </div>
          </div>
        )}
      </div>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Tier Benefits Comparison
// ---------------------------------------------------------------------------

function TierBenefits({ tier }: { tier: LoyaltyTier }) {
  const currentInfo = TIERS[tier]
  const nextTier = getNextTier(tier)
  const nextInfo = nextTier ? TIERS[nextTier] : null

  return (
    <Card>
      <CardContent className="p-4">
        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
          <Star className="h-4 w-4 text-emerald-500" />
          Avantages
        </h3>

        {/* Current tier */}
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Votre statut {currentInfo.name}
          </p>
          <div className="space-y-1.5">
            {currentInfo.benefits.map((b) => (
              <div key={b.label} className="flex items-center gap-2 text-sm">
                <div className={`w-5 h-5 rounded-md ${currentInfo.iconBg} flex items-center justify-center`}>
                  {b.icon}
                </div>
                <span className="text-foreground">{b.label}</span>
                <Check className="h-3.5 w-3.5 text-emerald-500 ml-auto" />
              </div>
            ))}
          </div>
        </div>

        {/* Next tier preview */}
        {nextInfo && (
          <>
            <Separator className="my-3" />
            <div className="space-y-2">
              <div className="flex items-center gap-1">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Prochain : {nextInfo.name}
                </p>
                <ArrowUp className={`h-3 w-3 ${nextInfo.iconColor}`} />
              </div>
              <div className="space-y-1.5">
                {nextInfo.benefits.map((b) => {
                  const hasIt = currentInfo.benefits.some((cb) => cb.label === b.label)
                  return (
                    <div
                      key={b.label}
                      className={`flex items-center gap-2 text-sm ${hasIt ? 'opacity-50' : ''}`}
                    >
                      <div className={`w-5 h-5 rounded-md ${nextInfo.iconBg} flex items-center justify-center`}>
                        {b.icon}
                      </div>
                      <span className={hasIt ? 'text-muted-foreground line-through' : 'text-foreground'}>
                        {b.label}
                      </span>
                      {hasIt ? (
                        <Check className="h-3.5 w-3.5 text-emerald-500 ml-auto" />
                      ) : (
                        <Lock className="h-3.5 w-3.5 text-muted-foreground ml-auto" />
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Points Balance Card
// ---------------------------------------------------------------------------

function PointsBalance({
  points,
  transactions,
}: {
  points: number
  transactions: Array<{ type: 'earned' | 'spent' | 'bonus'; points: number }>
}) {
  const totalEarned = transactions
    .filter((t) => t.type === 'earned' || t.type === 'bonus')
    .reduce((sum, t) => sum + t.points, 0)
  const totalSpent = transactions
    .filter((t) => t.type === 'spent')
    .reduce((sum, t) => sum + t.points, 0)

  return (
    <Card className="mova-gradient border-0 text-white shadow-lg shadow-emerald-500/20">
      <CardContent className="p-4">
        <p className="text-xs text-white/70 uppercase tracking-wider mb-1">Solde de points</p>
        <motion.p
          className="text-4xl font-bold"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          {points.toLocaleString('fr-FR')}
        </motion.p>
        <p className="text-xs text-white/60 mt-1">points fidélité</p>

        <div className="grid grid-cols-2 gap-3 mt-4">
          <div className="bg-white/10 rounded-lg p-2.5">
            <div className="flex items-center gap-1.5 mb-1">
              <TrendingUp className="h-3.5 w-3.5 text-emerald-300" />
              <span className="text-[10px] text-white/60 uppercase">Gagnes</span>
            </div>
            <p className="text-lg font-semibold">{totalEarned.toLocaleString('fr-FR')}</p>
          </div>
          <div className="bg-white/10 rounded-lg p-2.5">
            <div className="flex items-center gap-1.5 mb-1">
              <TrendingDown className="h-3.5 w-3.5 text-red-300" />
              <span className="text-[10px] text-white/60 uppercase">Utilises</span>
            </div>
            <p className="text-lg font-semibold">{totalSpent.toLocaleString('fr-FR')}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Recent Activity
// ---------------------------------------------------------------------------

function RecentActivity({
  transactions,
}: {
  transactions: Array<{
    id: string
    type: 'earned' | 'spent' | 'bonus'
    points: number
    description: string
    timestamp: string
  }>
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
          <CreditCard className="h-4 w-4 text-emerald-500" />
          Activite recente
        </h3>
        <div className="space-y-1 max-h-64 overflow-y-auto mova-scrollbar">
          {transactions.map((tx) => (
            <motion.div
              key={tx.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-center gap-3 py-2 border-b border-border/50 last:border-0"
            >
              <div
                className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                  tx.type === 'earned'
                    ? 'bg-emerald-100 dark:bg-emerald-900/30'
                    : tx.type === 'bonus'
                    ? 'bg-amber-100 dark:bg-amber-900/30'
                    : 'bg-red-100 dark:bg-red-900/30'
                }`}
              >
                {tx.type === 'earned' ? (
                  <TrendingUp className="h-4 w-4 text-emerald-600" />
                ) : tx.type === 'bonus' ? (
                  <Gift className="h-4 w-4 text-amber-600" />
                ) : (
                  <TrendingDown className="h-4 w-4 text-red-500" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{tx.description}</p>
                <p className="text-[11px] text-muted-foreground">{formatDate(tx.timestamp)}</p>
              </div>
              <span
                className={`text-sm font-semibold flex-shrink-0 ${
                  tx.type === 'spent' ? 'text-red-500' : 'text-emerald-600'
                }`}
              >
                {tx.type === 'spent' ? '-' : '+'}{tx.points} pts
              </span>
            </motion.div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Rewards Catalog
// ---------------------------------------------------------------------------

function RewardsCatalog({
  points,
  rewards,
  onRedeem,
}: {
  points: number
  rewards: Reward[]
  onRedeem: (reward: Reward) => void
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
          <Gift className="h-4 w-4 text-amber-500" />
          Catalogue de recompenses
        </h3>
        <div className="space-y-2 max-h-72 overflow-y-auto mova-scrollbar">
          {rewards.map((reward) => {
            const canAfford = points >= reward.pointsCost
            return (
              <motion.div
                key={reward.id}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                className={`flex items-center gap-3 p-3 rounded-xl border transition-colors ${
                  canAfford
                    ? 'border-emerald-200 bg-emerald-50/50 dark:border-emerald-800 dark:bg-emerald-900/10 cursor-pointer hover:border-emerald-300'
                    : 'border-border bg-muted/30 opacity-60'
                }`}
                onClick={() => canAfford && onRedeem(reward)}
              >
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                  canAfford
                    ? 'bg-emerald-100 dark:bg-emerald-900/30'
                    : 'bg-muted'
                }`}>
                  <Gift className={`h-5 w-5 ${canAfford ? 'text-emerald-600' : 'text-muted-foreground'}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{reward.name}</p>
                  <p className="text-xs text-muted-foreground">{reward.description}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className={`text-sm font-bold ${canAfford ? 'text-emerald-600' : 'text-muted-foreground'}`}>
                    {reward.pointsCost.toLocaleString('fr-FR')}
                  </p>
                  <p className="text-[10px] text-muted-foreground">pts</p>
                </div>
                {canAfford && (
                  <ChevronRight className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                )}
              </motion.div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Tier Progress Bar (for remaining tiers)
// ---------------------------------------------------------------------------

function TierProgressBar({ currentTier, points }: { currentTier: LoyaltyTier; points: number }) {
  const currentIdx = TIER_ORDER.indexOf(currentTier)

  return (
    <Card>
      <CardContent className="p-4">
        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
          <Trophy className="h-4 w-4 text-amber-500" />
          Progression
        </h3>
        <div className="space-y-2">
          {TIER_ORDER.map((tier, idx) => {
            const info = TIERS[tier]
            const isActive = idx <= currentIdx
            const isCurrent = tier === currentTier
            return (
              <div key={tier} className="flex items-center gap-2">
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center ${
                    isActive
                      ? `bg-gradient-to-br ${info.bgGradient} text-white`
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {isActive ? (
                    <Check className="h-3 w-3" />
                  ) : (
                    <Lock className="h-3 w-3" />
                  )}
                </div>
                <span className={`text-xs flex-1 ${isCurrent ? 'font-semibold' : ''}`}>
                  {info.name}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  {info.minPoints.toLocaleString('fr-FR')} pts
                </span>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function LoyaltyPanel({ open, onOpenChange }: LoyaltyPanelProps) {
  const user = useAppStore((s) => s.user)
  const setLoyaltyPoints = useAppStore((s) => s.setLoyaltyPoints)
  const setLoyaltyTier = useAppStore((s) => s.setLoyaltyTier)
  const setLoyaltyStreak = useAppStore((s) => s.setLoyaltyStreak)
  const addLoyaltyTransaction = useAppStore((s) => s.addLoyaltyTransaction)

  const [loading, setLoading] = useState(true)
  const [loyaltyPoints, setLocalLoyaltyPoints] = useState(0)
  const [loyaltyTier, setLocalLoyaltyTier] = useState<LoyaltyTier>('bronze')
  const [loyaltyTransactions, setLocalLoyaltyTransactions] = useState<Array<{
    id: string
    type: 'earned' | 'spent' | 'bonus'
    points: number
    description: string
    timestamp: string
  }>>([])
  const [loyaltyStreak, setLocalLoyaltyStreak] = useState(0)
  const [totalEarned, setTotalEarned] = useState(0)
  const [totalSpent, setTotalSpent] = useState(0)

  const [redeemDialogOpen, setRedeemDialogOpen] = useState(false)
  const [selectedReward, setSelectedReward] = useState<Reward | null>(null)

  // Fetch loyalty profile from API
  useEffect(() => {
    if (!open || !user?.id) return
    const userId = user.id
    let cancelled = false

    async function fetchProfile() {
      setLoading(true)
      try {
        const res = await fetch(`/api/mova/loyalty?userId=${userId}`)
        const json = await res.json()
        if (cancelled) return

        if (json.success && json.data) {
          const d = json.data
          setLocalLoyaltyPoints(d.points ?? 0)
          setLocalLoyaltyTier((d.tier ?? 'bronze') as LoyaltyTier)
          setLocalLoyaltyTransactions((d.recentTransactions ?? []).map((tx: { id: string; type: string; points: number; description: string; timestamp: string }) => ({
            id: tx.id,
            type: tx.type as 'earned' | 'spent' | 'bonus',
            points: tx.points,
            description: tx.description,
            timestamp: tx.timestamp,
          })))
          setLocalLoyaltyStreak(d.streak ?? 0)
          setTotalEarned(d.totalEarned ?? 0)
          setTotalSpent(d.totalSpent ?? 0)

          // Sync to store for other components
          setLoyaltyPoints(d.points ?? 0)
          setLoyaltyTier((d.tier ?? 'bronze') as LoyaltyTier)
          setLoyaltyStreak(d.streak ?? 0)
        }
      } catch {
        // Silently fail — show empty state
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchProfile()
    return () => { cancelled = true }
  }, [open, user?.id, setLoyaltyPoints, setLoyaltyTier, setLoyaltyStreak])

  const handleRedeem = (reward: Reward) => {
    setSelectedReward(reward)
    setRedeemDialogOpen(true)
  }

  const confirmRedeem = () => {
    if (!selectedReward || !user?.id) return

    const newPoints = loyaltyPoints - selectedReward.pointsCost
    setLocalLoyaltyPoints(newPoints)
    setLoyaltyPoints(newPoints)

    const tx = {
      id: `redeem-${Date.now()}`,
      type: 'spent' as const,
      points: selectedReward.pointsCost,
      description: selectedReward.name,
      timestamp: new Date().toISOString(),
    }
    setLocalLoyaltyTransactions((prev) => [tx, ...prev])
    addLoyaltyTransaction(tx)

    setRedeemDialogOpen(false)
    setSelectedReward(null)
  }

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-full sm:max-w-md p-0 flex flex-col">
          <SheetHeader className="px-4 pt-4 pb-0">
            <div className="flex items-center justify-between">
              <SheetTitle className="text-lg font-bold flex items-center gap-2">
                <Trophy className="h-5 w-5 text-emerald-600" />
                Fidelite MOVA
              </SheetTitle>
              <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-0 font-semibold">
                {loyaltyPoints.toLocaleString('fr-FR')} pts
              </Badge>
            </div>
            <SheetDescription className="sr-only">
              Votre programme de fidelite et recompenses
            </SheetDescription>
          </SheetHeader>

          <ScrollArea className="flex-1 mova-scrollbar">
            <div className="p-4 space-y-4">
              {loading ? (
                <div className="space-y-4">
                  <Skeleton className="h-32 w-full rounded-xl" />
                  <Skeleton className="h-20 w-full rounded-xl" />
                  <Skeleton className="h-28 w-full rounded-xl" />
                  <Skeleton className="h-24 w-full rounded-xl" />
                  <Skeleton className="h-40 w-full rounded-xl" />
                </div>
              ) : loyaltyPoints === 0 && loyaltyTransactions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16">
                  <div className="w-16 h-16 rounded-2xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mb-4">
                    <Inbox className="h-8 w-8 text-emerald-500" />
                  </div>
                  <h3 className="text-base font-semibold mb-1">Commencez a accumuler des points !</h3>
                  <p className="text-sm text-muted-foreground text-center max-w-xs">
                    Effectuez vos premieres courses pour gagner des points de fidelite et acceder a des recompenses exclusives.
                  </p>
                </div>
              ) : (
                <>
                  {/* Tier Progress */}
                  <TierProgressCard tier={loyaltyTier} points={loyaltyPoints} />

                  {/* Streak Counter */}
                  <StreakCounter streak={loyaltyStreak} />

                  {/* Points Balance */}
                  <PointsBalance points={loyaltyPoints} transactions={loyaltyTransactions} />

                  {/* Tier Benefits */}
                  <TierBenefits tier={loyaltyTier} />

                  {/* Tier Progress Bar */}
                  <TierProgressBar currentTier={loyaltyTier} points={loyaltyPoints} />

                  {/* Recent Activity */}
                  <RecentActivity transactions={loyaltyTransactions} />

                  {/* Rewards Catalog */}
                  <RewardsCatalog
                    points={loyaltyPoints}
                    rewards={REWARDS}
                    onRedeem={handleRedeem}
                  />

                  {/* Bottom info */}
                  <div className="text-center py-2">
                    <p className="text-[11px] text-muted-foreground">
                      Les points expirent apres 12 mois d&apos;inactivite
                    </p>
                  </div>
                </>
              )}
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>

      {/* Redeem Confirmation Dialog */}
      <AnimatePresence>
        {redeemDialogOpen && selectedReward && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50"
            onClick={() => setRedeemDialogOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-background rounded-2xl p-6 max-w-sm w-full shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex flex-col items-center text-center">
                <div className="w-14 h-14 rounded-2xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mb-4">
                  <Gift className="h-7 w-7 text-emerald-600" />
                </div>
                <h3 className="text-lg font-bold mb-1">Echanger vos points</h3>
                <p className="text-sm text-muted-foreground mb-1">
                  Confirmez l&apos;echange de vos points
                </p>
                <p className="text-base font-semibold text-foreground mb-1">
                  {selectedReward.name}
                </p>
                <p className="text-xs text-muted-foreground mb-4">
                  {selectedReward.description}
                </p>
                <div className="flex items-center gap-2 mb-6">
                  <Badge variant="outline" className="text-sm">
                    {selectedReward.pointsCost.toLocaleString('fr-FR')} pts
                  </Badge>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-0">
                    {selectedReward.value}
                  </Badge>
                </div>
                <div className="flex gap-2 w-full">
                  <Button
                    variant="outline"
                    className="flex-1 rounded-xl"
                    onClick={() => setRedeemDialogOpen(false)}
                  >
                    Annuler
                  </Button>
                  <Button
                    className="flex-1 mova-gradient rounded-xl text-white"
                    onClick={confirmRedeem}
                  >
                    Confirmer
                  </Button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
