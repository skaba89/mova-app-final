'use client'

import { useState, useEffect } from 'react'
import { useMovaStore } from '@/lib/store'
import {
  ArrowLeft,
  Trophy,
  Star,
  Crown,
  Sparkles,
  Flame,
  TrendingUp,
  TrendingDown,
  Lock,
  CheckCircle2,
  Gift,
  XCircle,
  Loader2,
  Zap,
} from 'lucide-react'

// --- Types ---

type LoyaltyTier = 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond'

interface TierInfo {
  name: string
  minPoints: number
  color: string
  bgGradient: string
  benefits: string[]
}

interface LoyaltyProfile {
  id: string
  points: number
  tier: string
  streakDays: number
  totalEarned: number
  totalRedeemed: number
  lastActivityDate: string | null
  nextTier: string | null
  pointsToNextTier: number
}

interface LoyaltyTransaction {
  id: string
  type: string
  points: number
  description: string
  createdAt: string
}

// --- Constantes ---

const TIER_ORDER: LoyaltyTier[] = ['bronze', 'silver', 'gold', 'platinum', 'diamond']

const TIERS: Record<LoyaltyTier, TierInfo> = {
  bronze: {
    name: 'Bronze',
    minPoints: 0,
    color: 'text-amber-600',
    bgGradient: 'from-amber-600 to-amber-800',
    benefits: ['Cashback x1'],
  },
  silver: {
    name: 'Argent',
    minPoints: 500,
    color: 'text-slate-400',
    bgGradient: 'from-slate-400 to-slate-600',
    benefits: ['Cashback x1.5', 'Matching prioritaire'],
  },
  gold: {
    name: 'Or',
    minPoints: 2000,
    color: 'text-amber-400',
    bgGradient: 'from-amber-400 to-amber-600',
    benefits: ['Cashback x2', 'Annulation gratuite', 'Matching prioritaire'],
  },
  platinum: {
    name: 'Platine',
    minPoints: 5000,
    color: 'text-cyan-400',
    bgGradient: 'from-cyan-400 to-cyan-600',
    benefits: ['Cashback x3', 'Annulation gratuite', 'Matching prioritaire', 'Support dedie'],
  },
  diamond: {
    name: 'Diamant',
    minPoints: 15000,
    color: 'text-violet-400',
    bgGradient: 'from-violet-400 to-violet-600',
    benefits: ['Cashback x5', 'Annulation gratuite', 'Matching prioritaire', 'Support dedie', 'Course mensuelle gratuite'],
  },
}

function getTierIcon(tier: string) {
  switch (tier) {
    case 'bronze': return <Trophy className="w-5 h-5" />
    case 'silver': return <Star className="w-5 h-5" />
    case 'gold': return <Crown className="w-5 h-5" />
    case 'platinum': return <Sparkles className="w-5 h-5" />
    case 'diamond': return <Sparkles className="w-5 h-5" />
    default: return <Trophy className="w-5 h-5" />
  }
}

function formatDate(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)
  if (hours < 1) return "A l'instant"
  if (hours < 24) return `il y a ${hours}h`
  if (days === 1) return 'Hier'
  if (days < 7) return `il y a ${days}j`
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}

// --- Composant principal ---

export function LoyaltyView() {
  const { setCurrentView } = useMovaStore()

  // Donnees
  const [profile, setProfile] = useState<LoyaltyProfile | null>(null)
  const [transactions, setTransactions] = useState<LoyaltyTransaction[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  // Charger les donnees
  useEffect(() => {
    async function fetchData() {
      try {
        const token = localStorage.getItem('mova_token')
        const res = await fetch('/api/mova/loyalty', {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        })
        const data = await res.json()

        if (data.success && data.data) {
          setProfile(data.data.profile)
          setTransactions(data.data.transactions || [])
        } else {
          setError(data.error || 'Erreur de chargement')
        }
      } catch {
        setError('Erreur de connexion au serveur')
      } finally {
        setIsLoading(false)
      }
    }
    fetchData()
  }, [])

  const currentTier = (profile?.tier || 'bronze') as LoyaltyTier
  const tierInfo = TIERS[currentTier]
  const currentIdx = TIER_ORDER.indexOf(currentTier)
  const nextTier = currentIdx < TIER_ORDER.length - 1 ? TIER_ORDER[currentIdx + 1] : null
  const nextTierInfo = nextTier ? TIERS[nextTier] : null

  // Calcul de la progression
  let progressPercent = 100
  if (nextTierInfo && profile) {
    const rangeStart = tierInfo.minPoints
    const rangeEnd = nextTierInfo.minPoints
    const currentInRange = profile.points - rangeStart
    progressPercent = Math.min(Math.round((currentInRange / (rangeEnd - rangeStart)) * 100), 100)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* En-tete */}
      <header className="bg-[#1e40af] text-white px-4 py-4 flex items-center gap-3 sticky top-0 z-10">
        <button
          onClick={() => setCurrentView('hub')}
          className="p-2 -ml-2 rounded-xl hover:bg-white/10 active:scale-95 transition-transform"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <Trophy className="w-5 h-5" />
        <h1 className="text-lg font-bold">Programme de fidelite</h1>
      </header>

      <div className="px-4 py-5 space-y-5 pb-8">
        {/* Chargement */}
        {isLoading && (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-[#1e40af]" />
            <span className="ml-2 text-sm text-gray-500">Chargement...</span>
          </div>
        )}

        {/* Erreur */}
        {error && !isLoading && (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-red-600">
            <XCircle className="w-5 h-5" />
            {error}
          </div>
        )}

        {!isLoading && !error && profile && (
          <>
            {/* Carte points + niveau */}
            <div className={`bg-gradient-to-r ${tierInfo.bgGradient} rounded-2xl p-5 text-white shadow-lg`}>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center">
                  {getTierIcon(currentTier)}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-bold">{tierInfo.name}</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-white/20">
                      Cashback x{currentTier === 'bronze' ? '1' : currentTier === 'silver' ? '1.5' : currentTier === 'gold' ? '2' : currentTier === 'platinum' ? '3' : '5'}
                    </span>
                  </div>
                  <p className="text-sm text-white/70">
                    {nextTierInfo
                      ? `${profile.pointsToNextTier.toLocaleString('fr-FR')} pts avant ${nextTierInfo.name}`
                      : 'Niveau maximum atteint'}
                  </p>
                </div>
              </div>

              {/* Points */}
              <div className="mb-4">
                <p className="text-xs text-white/60 uppercase tracking-wider">Solde de points</p>
                <p className="text-4xl font-extrabold">{profile.points.toLocaleString('fr-FR')}</p>
              </div>

              {/* Barre de progression vers le prochain niveau */}
              {nextTierInfo && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-white/60">{tierInfo.name}</span>
                    <span className="text-xs text-white/60">{nextTierInfo.name}</span>
                  </div>
                  <div className="h-2.5 bg-white/20 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-white rounded-full transition-all duration-500"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Statistiques */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-white rounded-xl p-3 text-center shadow-sm border border-gray-100">
                <TrendingUp className="w-5 h-5 text-[#059669] mx-auto mb-1" />
                <p className="text-lg font-bold text-gray-800">{profile.totalEarned.toLocaleString('fr-FR')}</p>
                <p className="text-[10px] text-gray-500">Points gagnes</p>
              </div>
              <div className="bg-white rounded-xl p-3 text-center shadow-sm border border-gray-100">
                <TrendingDown className="w-5 h-5 text-red-500 mx-auto mb-1" />
                <p className="text-lg font-bold text-gray-800">{profile.totalRedeemed.toLocaleString('fr-FR')}</p>
                <p className="text-[10px] text-gray-500">Points utilises</p>
              </div>
              <div className="bg-white rounded-xl p-3 text-center shadow-sm border border-gray-100">
                <Flame className="w-5 h-5 text-orange-500 mx-auto mb-1" />
                <p className="text-lg font-bold text-gray-800">{profile.streakDays}</p>
                <p className="text-[10px] text-gray-500">Jours de serie</p>
              </div>
            </div>

            {/* Serie de jours */}
            {profile.streakDays > 0 && (
              <div className="p-4 bg-orange-50 border border-orange-200 rounded-2xl">
                <div className="flex items-center gap-2 mb-3">
                  <Flame className="w-5 h-5 text-orange-500" />
                  <span className="text-sm font-semibold text-orange-800">
                    Serie en cours : {profile.streakDays} jour{profile.streakDays > 1 ? 's' : ''}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  {[1, 2, 3, 4, 5, 6, 7].map((day) => (
                    <div
                      key={day}
                      className={`flex-1 h-2 rounded-full ${
                        day <= (profile.streakDays % 7 || (profile.streakDays > 0 ? 7 : 0))
                          ? 'bg-gradient-to-r from-orange-400 to-red-500'
                          : 'bg-orange-100'
                      }`}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Avantages par niveau */}
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
              <h2 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <Zap className="w-4 h-4 text-[#1e40af]" />
                Avantages par niveau
              </h2>
              <div className="space-y-2">
                {TIER_ORDER.map((tier) => {
                  const info = TIERS[tier]
                  const isActive = TIER_ORDER.indexOf(tier) <= currentIdx
                  const isCurrent = tier === currentTier
                  return (
                    <div
                      key={tier}
                      className={`flex items-center gap-2 p-2.5 rounded-xl ${
                        isCurrent ? 'bg-[#1e40af]/5 border border-[#1e40af]/20' : ''
                      }`}
                    >
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
                        isActive ? `bg-gradient-to-br ${info.bgGradient} text-white` : 'bg-gray-100 text-gray-400'
                      }`}>
                        {isActive ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                      </div>
                      <span className={`text-xs flex-1 ${isCurrent ? 'font-bold' : ''}`}>{info.name}</span>
                      <span className="text-[10px] text-gray-400">{info.minPoints.toLocaleString('fr-FR')} pts</span>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Avantages du niveau actuel */}
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
              <h2 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <Gift className="w-4 h-4 text-[#059669]" />
                Votre niveau : {tierInfo.name}
              </h2>
              <div className="space-y-2">
                {tierInfo.benefits.map((benefit) => (
                  <div key={benefit} className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-[#059669] shrink-0" />
                    <span className="text-sm text-gray-700">{benefit}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Historique des transactions */}
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
              <h2 className="text-sm font-semibold text-gray-700 mb-3">Historique des points</h2>
              {transactions.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-6">Aucune transaction</p>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {transactions.map((tx) => (
                    <div key={tx.id} className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                        tx.type === 'earn' ? 'bg-green-100' : 'bg-red-100'
                      }`}>
                        {tx.type === 'earn' ? (
                          <TrendingUp className="w-4 h-4 text-green-600" />
                        ) : (
                          <TrendingDown className="w-4 h-4 text-red-500" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-700 truncate">{tx.description}</p>
                        <p className="text-[11px] text-gray-400">{formatDate(tx.createdAt)}</p>
                      </div>
                      <span className={`text-sm font-semibold shrink-0 ${
                        tx.type === 'earn' ? 'text-green-600' : 'text-red-500'
                      }`}>
                        {tx.type === 'earn' ? '+' : '-'}{tx.points} pts
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
