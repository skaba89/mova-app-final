'use client'

import { useState, useEffect } from 'react'
import { useAppStore } from '@/lib/mova/store'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import {
  ArrowLeft,
  Gift,
  Tag,
  Clock,
  CheckCircle2,
  Zap,
  Package,
  Copy,
  X,
  Crown,
  TrendingUp,
  CalendarDays,
  Users,
  Bike,
} from 'lucide-react'

const PACKAGES = [
  {
    id: 'pkg-1',
    title: 'Pack Economie',
    description: '10 courses a tarif reduit',
    price: 35000,
    originalPrice: 50000,
    icon: TrendingUp,
    badge: 'Populaire',
    color: 'emerald' as const,
  },
  {
    id: 'pkg-2',
    title: 'Pack Premium',
    description: '20 courses + vehicule premium',
    price: 85000,
    originalPrice: 120000,
    icon: Crown,
    badge: 'Meilleur rapport',
    color: 'amber' as const,
  },
  {
    id: 'pkg-3',
    title: 'Pack Famille',
    description: '30 courses partageables entre 4 membres',
    price: 150000,
    originalPrice: 200000,
    icon: Users,
    badge: '-25%',
    color: 'emerald' as const,
  },
  {
    id: 'pkg-4',
    title: 'Pack Moto',
    description: '15 courses moto-taxi',
    price: 45000,
    originalPrice: 60000,
    icon: Bike,
    badge: 'Nouveau',
    color: 'amber' as const,
  },
  {
    id: 'pkg-5',
    title: 'Pack Ecole',
    description: '1 mois de transport scolaire',
    price: 135000,
    originalPrice: 150000,
    icon: CalendarDays,
    badge: '-10%',
    color: 'emerald' as const,
  },
  {
    id: 'pkg-6',
    title: 'Pack Journee',
    description: '3 courses pour une journee complete',
    price: 12000,
    originalPrice: 18000,
    icon: Zap,
    badge: 'Journalier',
    color: 'amber' as const,
  },
]

interface PromoItem {
  id: string
  title: string
  description: string
  discount: string
  type: string
  code: string
  validUntil: string
  minAmount: number
  usedCount: number
  maxUses: number
  color: 'emerald' | 'amber'
}

function formatGNF(amount: number) {
  return amount.toLocaleString('fr-FR') + ' GNF'
}

export default function PromotionsView() {
  const { goBack, user } = useAppStore()
  const [promoInput, setPromoInput] = useState('')
  const [appliedPromo, setAppliedPromo] = useState<string | null>(null)
  const [activePromos, setActivePromos] = useState<PromoItem[]>([])
  const [usedPromos, setUsedPromos] = useState<Array<{ code: string; discount: string; date: string; status: string }>>([])
  const [loadingPromos, setLoadingPromos] = useState(true)

  // Fetch promotions and redemption history from API on mount
  useEffect(() => {
    async function fetchPromotions() {
      try {
        const token = localStorage.getItem('mova_token')
        const headers: Record<string, string> = {}
        if (token) headers['Authorization'] = `Bearer ${token}`

        // Fetch active promotions
        const res = await fetch('/api/mova/promotions?active=true', { headers })
        if (!res.ok) throw new Error('Erreur serveur')
        const data = await res.json()
        if (data.success && data.data && data.data.length > 0) {
          const mapped: PromoItem[] = data.data.map((p: Record<string, unknown>, idx: number) => ({
            id: p.id as string,
            title: (p.code as string) || `PROMO-${idx + 1}`,
            description: (p.description as string) || '',
            discount: p.discountType === 'percentage'
              ? `${p.discountValue}%`
              : `${formatGNF(p.discountValue as number)}`,
            type: p.discountType as string,
            code: p.code as string,
            validUntil: p.endDate
              ? new Date(p.endDate as string).toLocaleDateString('fr-FR')
              : '',
            minAmount: (p.minAmount as number) || 0,
            usedCount: (p.usageCount as number) || 0,
            maxUses: (p.usageLimit as number) || 9999,
            color: (idx % 2 === 0 ? 'emerald' : 'amber') as 'emerald' | 'amber',
          }))
          setActivePromos(mapped)
        } else {
          setActivePromos([])
        }

        // Fetch redemption history for current user
        if (user?.id) {
          try {
            const redRes = await fetch(`/api/mova/promotions/user/${user.id}`, { headers })
            if (redRes.ok) {
              const redData = await redRes.json()
              if (redData.success && redData.data?.redemptions) {
                const used = redData.data.redemptions.map((r: Record<string, unknown>) => {
                  const promo = (r.promotion as Record<string, unknown>) || {}
                  return {
                    code: (r.code as string) || '',
                    discount: promo.discountType === 'percentage'
                      ? `${promo.discountValue}%`
                      : formatGNF((promo.discountValue as number) || (r.savings as number) || 0),
                    date: r.redeemedAt
                      ? new Date(r.redeemedAt as string).toLocaleDateString('fr-FR')
                      : '',
                    status: 'used' as const,
                  }
                })
                setUsedPromos(used)
              }
            }
          } catch {
            // Redemption history fetch failed — keep empty
          }
        }
      } catch {
        setActivePromos([])
      } finally {
        queueMicrotask(() => setLoadingPromos(false))
      }
    }
    fetchPromotions()
  }, [user?.id])

  async function handleApplyPromo() {
    if (!promoInput.trim()) {
      toast.error('Veuillez entrer un code promo')
      return
    }
    const upperCode = promoInput.trim().toUpperCase()

    // Try API first
    try {
      const token = localStorage.getItem('mova_token')
      const res = await fetch('/api/mova/promotions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          code: upperCode,
          userId: user?.id,
        }),
      })
      if (res.ok) {
        const data = await res.json()
        if (data.success) {
          setAppliedPromo(upperCode)
          toast.success(data.data.message || `Code "${upperCode}" applique avec succes !`)
          return
        } else {
          toast.error(data.error || 'Code promo invalide ou expire')
          setPromoInput('')
          return
        }
      }
    } catch {
      // Fall back to local check
    }

    // Local fallback check
    const promo = activePromos.find(p => p.code === upperCode)
    if (promo) {
      setAppliedPromo(promo.code)
      toast.success(`Code "${promo.code}" applique ! ${promo.discount} de reduction.`)
    } else {
      toast.error('Code promo invalide ou expire')
    }
    setPromoInput('')
  }

  function handleCopyCode(code: string) {
    navigator.clipboard.writeText(code).catch(() => {})
    toast.success(`Code "${code}" copie !`)
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
            <div className="w-9 h-9 rounded-xl bg-amber-500 flex items-center justify-center">
              <Gift className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold">Promotions</h1>
              <p className="text-xs text-muted-foreground">Offres et reductions exclusives</p>
            </div>
          </div>
        </div>
      </div>

      <ScrollArea className="h-[calc(100vh-64px)]">
        <div className="p-4 space-y-4 pb-24">
          {/* Promo Code Input */}
          <Card className="border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Tag className="h-5 w-5 text-amber-600" />
                <span className="font-semibold">Vous avez un code promo ?</span>
              </div>
              <div className="flex gap-2">
                <Input
                  placeholder="Entrer le code promo"
                  value={promoInput}
                  onChange={(e) => setPromoInput(e.target.value.toUpperCase())}
                  className="uppercase flex-1"
                  onKeyDown={(e) => e.key === 'Enter' && handleApplyPromo()}
                />
                <Button
                  className="bg-amber-500 hover:bg-amber-600 text-white shrink-0"
                  onClick={handleApplyPromo}
                  disabled={!promoInput.trim()}
                >
                  Appliquer
                </Button>
              </div>
              {appliedPromo && (
                <div className="flex items-center justify-between bg-emerald-100 dark:bg-emerald-900/30 rounded-lg p-2 px-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    <span className="text-sm font-medium text-emerald-700">Code &quot;{appliedPromo}&quot; actif</span>
                  </div>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setAppliedPromo(null)}>
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Active Promos - Horizontal Scroll */}
          <div>
            <h2 className="text-base font-semibold mb-3">Offres en cours</h2>
            {loadingPromos ? (
              <div className="flex gap-3 overflow-x-auto pb-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Card key={i} className="min-w-[260px] shrink-0">
                    <CardContent className="p-4 space-y-3">
                      <Skeleton className="h-5 w-16" />
                      <Skeleton className="h-4 w-40" />
                      <Skeleton className="h-3 w-28" />
                      <Skeleton className="h-2 w-full rounded-full" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : activePromos.length === 0 ? (
              <Card className="p-8 text-center">
                <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center mx-auto mb-3">
                  <Gift className="h-7 w-7 text-muted-foreground" />
                </div>
                <h3 className="font-semibold text-sm mb-1">Aucune promotion disponible</h3>
                <p className="text-xs text-muted-foreground">Revenez bientot pour de nouvelles offres exclusives.</p>
              </Card>
            ) : (
              <div className="flex gap-3 overflow-x-auto pb-2 mova-scrollbar">
                {activePromos.map((promo) => (
                  <Card
                    key={promo.id}
                    className={`min-w-[260px] shrink-0 ${
                      promo.color === 'amber'
                        ? 'border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20'
                        : 'border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/20 dark:to-teal-950/20'
                    }`}
                  >
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <Badge
                          className={
                            promo.color === 'amber'
                              ? 'bg-amber-100 text-amber-700 hover:bg-amber-100'
                              : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100'
                          }
                        >
                          {promo.discount}
                        </Badge>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9"
                          onClick={() => handleCopyCode(promo.code)}
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                      <div>
                        <p className="font-semibold text-sm">{promo.title}</p>
                        <p className="text-xs text-muted-foreground mt-1">{promo.description}</p>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          <span>{promo.validUntil ? `Jusqu'au ${promo.validUntil}` : 'Valide'}</span>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          className={`h-7 text-xs ${
                            promo.color === 'amber'
                              ? 'border-amber-300 text-amber-700 hover:bg-amber-50'
                              : 'border-emerald-300 text-emerald-700 hover:bg-emerald-50'
                          }`}
                          onClick={() => {
                            setPromoInput(promo.code)
                            toast.info(`Code "${promo.code}" pre-rempli`)
                          }}
                        >
                          Utiliser
                        </Button>
                      </div>
                      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                        <div
                          className={`h-1.5 rounded-full ${
                            promo.color === 'amber' ? 'bg-amber-400' : 'bg-emerald-400'
                          }`}
                          style={{ width: `${Math.min((promo.usedCount / promo.maxUses) * 100, 100)}%` }}
                        />
                      </div>
                      <p className="text-[10px] text-muted-foreground text-right">
                        {promo.usedCount.toLocaleString()}/{promo.maxUses.toLocaleString()} utilisations
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>

          {/* Packages Grid */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-semibold">Packs disponibles</h2>
              <Badge variant="secondary">{PACKAGES.length} packs</Badge>
            </div>
            {PACKAGES.length === 0 ? (
              <Card className="p-8 text-center">
                <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center mx-auto mb-3">
                  <Package className="h-7 w-7 text-muted-foreground" />
                </div>
                <h3 className="font-semibold text-sm mb-1">Aucun pack disponible</h3>
                <p className="text-xs text-muted-foreground">Des packs seront bientot disponibles.</p>
              </Card>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {PACKAGES.map((pkg) => (
                  <Card key={pkg.id} className="mova-card-hover">
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-start justify-between">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                          pkg.color === 'amber' ? 'bg-amber-100' : 'bg-emerald-100'
                        }`}>
                          <pkg.icon className={`h-5 w-5 ${
                            pkg.color === 'amber' ? 'text-amber-600' : 'text-emerald-600'
                          }`} />
                        </div>
                        <Badge
                          variant="secondary"
                          className={
                            pkg.color === 'amber'
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-emerald-100 text-emerald-700'
                          }
                        >
                          {pkg.badge}
                        </Badge>
                      </div>
                      <div>
                        <p className="font-semibold">{pkg.title}</p>
                        <p className="text-xs text-muted-foreground">{pkg.description}</p>
                      </div>
                      <div className="flex items-end justify-between">
                        <div>
                          <span className="text-lg font-bold text-emerald-600">{formatGNF(pkg.price)}</span>
                          <span className="text-xs text-muted-foreground line-through ml-2">
                            {formatGNF(pkg.originalPrice)}
                          </span>
                        </div>
                        <Button
                          size="sm"
                          className="bg-emerald-600 hover:bg-emerald-700 h-8"
                          onClick={() => toast.success(`Pack "${pkg.title}" ajoute !`)}
                        >
                          Acheter
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>

          {/* Used Promos History */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Historique des promos</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {usedPromos.length === 0 ? (
                <div className="py-6 text-center">
                  <Tag className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">Aucune promo utilisee</p>
                </div>
              ) : (
                usedPromos.map((promo, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                        <Tag className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">{promo.code}</p>
                        <p className="text-xs text-muted-foreground">{promo.date}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge variant="secondary" className="text-xs">
                        {promo.discount}
                      </Badge>
                      <p className="text-[10px] text-muted-foreground mt-1">
                        {promo.status === 'used' ? 'Utilisee' : 'Expiree'}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </ScrollArea>
    </div>
  )
}
