'use client'

import { motion } from 'framer-motion'
import { Trophy, Star, Crown, Sparkles } from 'lucide-react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type LoyaltyTier = 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond'

interface LoyaltyBadgeProps {
  tier: LoyaltyTier
  points: number
  showPoints?: boolean
  compact?: boolean
}

// ---------------------------------------------------------------------------
// Tier config
// ---------------------------------------------------------------------------

interface TierBadgeConfig {
  name: string
  color: string
  bg: string
  border: string
  icon: React.ReactNode
  gradient: string
}

const TIER_CONFIG: Record<LoyaltyTier, TierBadgeConfig> = {
  bronze: {
    name: 'Bronze',
    color: 'text-amber-700 dark:text-amber-400',
    bg: 'bg-amber-100 dark:bg-amber-900/40',
    border: 'border-amber-200 dark:border-amber-800',
    icon: <Trophy className="h-3 w-3" />,
    gradient: 'from-amber-500 to-amber-700',
  },
  silver: {
    name: 'Argent',
    color: 'text-slate-600 dark:text-slate-300',
    bg: 'bg-slate-100 dark:bg-slate-800/60',
    border: 'border-slate-200 dark:border-slate-700',
    icon: <Star className="h-3 w-3" />,
    gradient: 'from-slate-400 to-slate-600',
  },
  gold: {
    name: 'Or',
    color: 'text-amber-600 dark:text-amber-400',
    bg: 'bg-amber-50 dark:bg-amber-900/30',
    border: 'border-amber-200 dark:border-amber-700',
    icon: <Crown className="h-3 w-3" />,
    gradient: 'from-amber-400 to-amber-600',
  },
  platinum: {
    name: 'Platine',
    color: 'text-cyan-700 dark:text-cyan-400',
    bg: 'bg-cyan-50 dark:bg-cyan-900/30',
    border: 'border-cyan-200 dark:border-cyan-700',
    icon: <Sparkles className="h-3 w-3" />,
    gradient: 'from-cyan-400 to-cyan-600',
  },
  diamond: {
    name: 'Diamant',
    color: 'text-violet-700 dark:text-violet-400',
    bg: 'bg-violet-50 dark:bg-violet-900/30',
    border: 'border-violet-200 dark:border-violet-700',
    icon: <Sparkles className="h-3 w-3" />,
    gradient: 'from-violet-400 to-violet-600',
  },
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function LoyaltyBadge({
  tier,
  points,
  showPoints = false,
  compact = false,
}: LoyaltyBadgeProps) {
  const config = TIER_CONFIG[tier]

  if (compact) {
    return (
      <span
        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-semibold ${config.color} ${config.bg} border ${config.border}`}
      >
        {config.icon}
        {config.name}
      </span>
    )
  }

  return (
    <motion.button
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      className={`relative overflow-hidden inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-semibold transition-shadow hover:shadow-md ${config.color} ${config.bg} ${config.border}`}
    >
      {/* Animated shimmer for gold+ tiers */}
      {(tier === 'gold' || tier === 'platinum' || tier === 'diamond') && (
        <motion.span
          className="absolute inset-0 rounded-full"
          animate={{
            background: [
              'linear-gradient(0deg, transparent 40%, rgba(255,255,255,0.3) 50%, transparent 60%)',
              'linear-gradient(360deg, transparent 40%, rgba(255,255,255,0.3) 50%, transparent 60%)',
            ],
          }}
          transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
        />
      )}

      <span className={`flex items-center justify-center w-5 h-5 rounded-full bg-gradient-to-br ${config.gradient} text-white`}>
        {config.icon}
      </span>

      <span>{config.name}</span>

      {showPoints && (
        <>
          <span className="w-px h-3 bg-current opacity-30" />
          <span>{points.toLocaleString('fr-FR')} pts</span>
        </>
      )}
    </motion.button>
  )
}

export default LoyaltyBadge
