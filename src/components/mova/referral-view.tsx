'use client'

import { useState, useEffect } from 'react'
import { useAppStore } from '@/lib/mova/store'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import {
  ArrowLeft,
  Users,
  Copy,
  Share2,
  MessageCircle,
  Phone,
  Gift,
  Trophy,
  TrendingUp,
  Crown,
  Target,
  Zap,
  CheckCircle2,
  UserPlus,
} from 'lucide-react'

// Generate dynamic referral code from user name
function generateReferralCode(name?: string | null): string {
  if (name && name.trim()) {
    const initials = name.trim().split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 4)
    return `${initials}-2025`
  }
  return 'ABDO-2025'
}

interface LeaderboardEntry {
  rank: number
  name: string
  referrals: number
  reward: number
  avatar: string
  tier: 'gold' | 'platinum' | 'silver'
}

const HOW_IT_WORKS = [
  {
    step: 1,
    title: 'Partagez votre code',
    description: 'Envoyez votre code de parrainage a vos amis, famille et collegues.',
    icon: Share2,
  },
  {
    step: 2,
    title: 'Votre ami s\'inscrit',
    description: 'Il entre votre code lors de son inscription sur MOVA.',
    icon: UserPlus,
  },
  {
    step: 3,
    title: 'Il effectue sa premiere course',
    description: 'Votre filleul complete sa premiere course avec n\'importe quel service MOVA.',
    icon: CheckCircle2,
  },
  {
    step: 4,
    title: 'Vous gagnez tous les deux',
    description: 'Vous recevez 5 000 GNF et votre filleul obtient 50% de reduction.',
    icon: Gift,
  },
]

function formatGNF(amount: number) {
  return amount.toLocaleString('fr-FR') + ' GNF'
}

function getRankColor(rank: number) {
  if (rank === 1) return 'text-amber-500'
  if (rank === 2) return 'text-gray-400'
  if (rank === 3) return 'text-amber-700'
  return 'text-muted-foreground'
}

export default function ReferralView() {
  const { goBack, user } = useAppStore()
  const [referralCode, setReferralCode] = useState(generateReferralCode(user?.name))
  const [stats, setStats] = useState({
    totalReferrals: 0,
    activeReferrals: 0,
    totalEarned: 0,
    pendingRewards: 0,
    conversionRate: '0%',
    rank: 0,
  })
  const [loadingReferral, setLoadingReferral] = useState(true)
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [referralList, setReferralList] = useState<Array<{
    id: string
    name: string
    bonusAmount: number
    isPaid: boolean
    referredAt: string
  }>>([])

  // Fetch referral data and leaderboard from API on mount
  useEffect(() => {
    async function fetchReferrals() {
      try {
        const token = localStorage.getItem('mova_token')
        const userId = user?.id
        const headers: Record<string, string> = {}
        if (token) headers['Authorization'] = `Bearer ${token}`

        if (userId) {
          // Fetch user referral stats and list
          const res = await fetch(`/api/mova/referrals?userId=${userId}`, { headers })
          if (!res.ok) throw new Error('Erreur serveur')
          const data = await res.json()
          if (data.success && data.data) {
            const apiData = data.data
            if (apiData.referralCode) {
              setReferralCode(apiData.referralCode)
            }
            if (apiData.stats) {
              const s = apiData.stats
              const totalReferrals = (s.totalReferred as number) || 0
              const activeReferrals = totalReferrals - Math.floor(totalReferrals * 0.2)
              setStats({
                totalReferrals,
                activeReferrals,
                totalEarned: (s.earnedTotal as number) || 0,
                pendingRewards: (s.pendingTotal as number) || 0,
                conversionRate: totalReferrals > 0
                  ? `${Math.round((activeReferrals / totalReferrals) * 100)}%`
                  : '0%',
                rank: 0,
              })
            }
            if (apiData.referrals && apiData.referrals.length > 0) {
              setReferralList(apiData.referrals.map((r: Record<string, unknown>) => ({
                id: r.id as string,
                name: ((r.referredUser as Record<string, unknown>)?.name as string) || 'Inconnu',
                bonusAmount: (r.bonusAmount as number) || 0,
                isPaid: (r.isPaid as boolean) || false,
                referredAt: r.referredAt
                  ? new Date(r.referredAt as string).toLocaleDateString('fr-FR')
                  : '',
              })))
            }
          }
        }

        // Fetch leaderboard from API
        const lbRes = await fetch('/api/mova/referrals/leaderboard', { headers })
        if (lbRes.ok) {
          const lbData = await lbRes.json()
          if (lbData.success && lbData.data) {
            const mapped: LeaderboardEntry[] = lbData.data.map((entry: Record<string, unknown>, idx: number) => {
              const u = (entry.user as Record<string, unknown>) || {}
              const name = (u.name as string) || 'Anonyme'
              const totalRef = (entry.totalReferred as number) || 0
              return {
                rank: idx + 1,
                name,
                referrals: totalRef,
                reward: (entry.totalEarned as number) || 0,
                avatar: name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase(),
                tier: (idx === 0 || idx === 1) ? 'gold' as const
                  : idx === 2 ? 'platinum' as const
                  : 'silver' as const,
              }
            })
            setLeaderboard(mapped)
          }
        }
      } catch {
        // Keep empty state — no fallback to mock data
      } finally {
        queueMicrotask(() => setLoadingReferral(false))
      }
    }
    fetchReferrals()
  }, [user?.id])

  function handleCopyCode() {
    navigator.clipboard.writeText(referralCode).catch(() => {})
    toast.success('Code de parrainage copie !')
  }

  function handleShareWhatsApp() {
    const message = `Utilise mon code de parrainage ${referralCode} sur MOVA pour obtenir 50% de reduction sur ta premiere course ! Telecharge l'app : mova.gn`
    window.open('https://wa.me/?text=' + encodeURIComponent(message), '_blank')
  }

  function handleShareSMS() {
    const message = `Code parrainage MOVA: ${referralCode} - 50% de reduction sur ta 1ere course !`
    window.open('sms:?body=' + encodeURIComponent(message), '_self')
  }

  function handleCopyLink() {
    const link = `https://mova.gn/ref/${referralCode}`
    navigator.clipboard.writeText(link).catch(() => {})
    toast.success('Lien de parrainage copie !')
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-40 mova-glass border-b">
        <div className="flex items-center gap-3 px-4 py-3">
          <Button variant="ghost" size="icon" onClick={goBack} className="shrink-0">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-emerald-600 flex items-center justify-center">
              <Users className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold">Parrainage</h1>
              <p className="text-xs text-muted-foreground">Gagnez en partageant MOVA</p>
            </div>
          </div>
        </div>
      </div>

      <ScrollArea className="h-[calc(100vh-64px)]">
        <div className="p-4 space-y-4 pb-24">
          {/* Referral Code Card */}
          <Card className="border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/20 dark:to-teal-950/20">
            <CardContent className="p-6 text-center space-y-4">
              <div className="w-16 h-16 mx-auto rounded-2xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                <Gift className="w-8 h-8 text-emerald-600" />
              </div>
              <div>
                <h2 className="text-lg font-bold">Votre code de parrainage</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Partagez ce code et gagnez 5 000 GNF par filleul
                </p>
              </div>
              {loadingReferral ? (
                <Skeleton className="h-12 w-full rounded-xl" />
              ) : (
                <div className="flex items-center gap-2 bg-white dark:bg-gray-900 rounded-xl p-4 border border-emerald-200">
                  <span className="flex-1 text-2xl font-bold tracking-widest text-emerald-700 dark:text-emerald-400 font-mono">
                    {referralCode}
                  </span>
                  <Button
                    variant="outline"
                    size="icon"
                    className="border-emerald-200 hover:bg-emerald-50 shrink-0"
                    onClick={handleCopyCode}
                  >
                    <Copy className="h-5 w-5 text-emerald-600" />
                  </Button>
                </div>
              )}
              <div className="flex items-center justify-center gap-2 text-sm">
                <div className="flex items-center gap-1 text-emerald-600">
                  <Gift className="h-4 w-4" />
                  <span className="font-medium">5 000 GNF</span>
                </div>
                <span className="text-muted-foreground">pour vous</span>
                <Separator orientation="vertical" className="h-4" />
                <div className="flex items-center gap-1 text-amber-600">
                  <Zap className="h-4 w-4" />
                  <span className="font-medium">-50%</span>
                </div>
                <span className="text-muted-foreground">pour votre filleul</span>
              </div>
            </CardContent>
          </Card>

          {/* Share Buttons */}
          <div className="grid grid-cols-3 gap-3">
            <Button
              variant="outline"
              className="h-auto py-4 flex-col gap-2"
              onClick={handleShareWhatsApp}
            >
              <MessageCircle className="h-5 w-5 text-green-600" />
              <span className="text-xs font-medium">WhatsApp</span>
            </Button>
            <Button
              variant="outline"
              className="h-auto py-4 flex-col gap-2"
              onClick={handleShareSMS}
            >
              <Phone className="h-5 w-5 text-emerald-600" />
              <span className="text-xs font-medium">SMS</span>
            </Button>
            <Button
              variant="outline"
              className="h-auto py-4 flex-col gap-2"
              onClick={handleCopyLink}
            >
              <Share2 className="h-5 w-5 text-amber-600" />
              <span className="text-xs font-medium">Copier le lien</span>
            </Button>
          </div>

          {/* Stats Grid */}
          <div>
            <h2 className="text-base font-semibold mb-3">Vos statistiques</h2>
            {loadingReferral ? (
              <div className="grid grid-cols-2 gap-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Card key={i} className="p-4">
                    <Skeleton className="h-5 w-5 mb-2 rounded" />
                    <Skeleton className="h-7 w-20 mb-1" />
                    <Skeleton className="h-3 w-24" />
                  </Card>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <Card className="mova-card-hover">
                  <CardContent className="p-4">
                    <UserPlus className="h-5 w-5 text-emerald-500 mb-2" />
                    <p className="text-2xl font-bold">{stats.totalReferrals}</p>
                    <p className="text-xs text-muted-foreground">Filleuls invites</p>
                    <p className="text-xs text-emerald-600 mt-1">{stats.activeReferrals} actifs</p>
                  </CardContent>
                </Card>
                <Card className="mova-card-hover">
                  <CardContent className="p-4">
                    <Trophy className="h-5 w-5 text-amber-500 mb-2" />
                    <p className="text-2xl font-bold">{formatGNF(stats.totalEarned)}</p>
                    <p className="text-xs text-muted-foreground">Total gagne</p>
                    <p className="text-xs text-amber-600 mt-1">{formatGNF(stats.pendingRewards)} en attente</p>
                  </CardContent>
                </Card>
                <Card className="mova-card-hover">
                  <CardContent className="p-4">
                    <TrendingUp className="h-5 w-5 text-emerald-500 mb-2" />
                    <p className="text-2xl font-bold">{stats.conversionRate}</p>
                    <p className="text-xs text-muted-foreground">Taux de conversion</p>
                  </CardContent>
                </Card>
                <Card className="mova-card-hover">
                  <CardContent className="p-4">
                    <Target className="h-5 w-5 text-amber-500 mb-2" />
                    <p className="text-2xl font-bold">#{stats.rank}</p>
                    <p className="text-xs text-muted-foreground">Classement general</p>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>

          {/* Referral List (from API) */}
          {!loadingReferral && referralList.length === 0 && (
            <Card className="p-8 text-center">
              <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center mx-auto mb-3">
                <Users className="h-7 w-7 text-muted-foreground" />
              </div>
              <h3 className="font-semibold text-sm mb-1">Aucun parrainage</h3>
              <p className="text-xs text-muted-foreground">Partagez votre code pour inviter vos proches et gagner des recompenses.</p>
            </Card>
          )}
          {referralList.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Vos filleuls</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {referralList.map((r) => (
                  <div key={r.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-xs font-bold text-emerald-700">
                        {r.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-medium">{r.name}</p>
                        <p className="text-xs text-muted-foreground">{r.referredAt}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-emerald-600">{formatGNF(r.bonusAmount)}</p>
                      <Badge variant={r.isPaid ? 'default' : 'secondary'} className="text-[10px]">
                        {r.isPaid ? 'Paye' : 'En attente'}
                      </Badge>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Leaderboard */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Crown className="h-5 w-5 text-amber-500" />
                  Classement des parrains
                </CardTitle>
                <Badge variant="secondary">Top 5</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {!loadingReferral && leaderboard.length === 0 ? (
                <div className="py-6 text-center">
                  <Crown className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">Aucun classement disponible</p>
                </div>
              ) : (
                leaderboard.map((entry) => (
                  <div
                    key={entry.rank}
                    className={`flex items-center gap-3 p-3 rounded-xl transition-colors ${
                      entry.rank <= 3 ? 'bg-amber-50/50 dark:bg-amber-950/10' : ''
                    }`}
                  >
                    <span className={`text-lg font-bold w-6 text-center ${getRankColor(entry.rank)}`}>
                      {entry.rank}
                    </span>
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold ${
                      entry.tier === 'gold' ? 'bg-amber-100 text-amber-700'
                      : entry.tier === 'platinum' ? 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                      : 'bg-emerald-100 text-emerald-700'
                    }`}>
                      {entry.avatar}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{entry.name}</p>
                      <p className="text-xs text-muted-foreground">{entry.referrals} filleuls</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-emerald-600">{formatGNF(entry.reward)}</p>
                      <Badge
                        variant="secondary"
                        className={`text-[10px] ${
                          entry.tier === 'gold' ? 'bg-amber-100 text-amber-700'
                          : entry.tier === 'platinum' ? 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                          : 'bg-emerald-100 text-emerald-700'
                        }`}
                      >
                        {entry.tier === 'gold' ? 'Or' : entry.tier === 'platinum' ? 'Platine' : 'Argent'}
                      </Badge>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* How it Works */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Comment ca marche ?</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {HOW_IT_WORKS.map((item, idx) => (
                <div key={item.step} className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center shrink-0">
                      <span className="text-sm font-bold text-emerald-700">{item.step}</span>
                    </div>
                    {idx < HOW_IT_WORKS.length - 1 && (
                      <div className="w-0.5 flex-1 bg-emerald-200 dark:bg-emerald-800 mt-2" />
                    )}
                  </div>
                  <div className="pb-4">
                    <p className="text-sm font-semibold">{item.title}</p>
                    <p className="text-xs text-muted-foreground mt-1">{item.description}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </ScrollArea>
    </div>
  )
}
