'use client'

import { useState, useEffect, useRef } from 'react'
import { useTheme } from 'next-themes'
import { motion, AnimatePresence } from 'framer-motion'
import { useAppStore } from '@/lib/mova/store'
import { useWallet, usePromotions, useWalletTransfer, useReferrals, useReferralLeaderboard, useRedeemPromotion, useCreateReferral, useUserPromotions } from '@/lib/mova/api-hooks'
import type { WalletTransactionData, PromotionData, ReferralsData, ReferralLeaderboardEntry, UserPromotionsData } from '@/lib/mova/api-types'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { WalletTopUp } from '@/components/mova/wallet-topup'
import { Skeleton } from '@/components/ui/skeleton'
import NotificationPanel from '@/components/mova/notification-panel'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog'
import {
  ArrowLeft,
  Wallet,
  Plus,
  ArrowUpDown,
  Clock,
  CreditCard,
  Send,
  Download,
  Eye,
  EyeOff,
  TrendingUp,
  Filter,
  Phone,
  Tag,
  Receipt,
  BarChart3,
  PieChart,
  ArrowUp,
  ArrowDown,
  ChevronRight,
  Search,
  Bell,
  Car,
  Package,
  Gift,
  CircleDot,
  ArrowDownLeft,
  Sparkles,
  Users,
  Moon,
  Sun,
  Zap,
  AlertCircle,
  RefreshCw,
  Trophy,
  Copy,
  Check,
  UserPlus,
  ShieldCheck,

} from 'lucide-react'

// ── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (amount: number) =>
  new Intl.NumberFormat('fr-GN').format(amount) + ' GNF'

const fmtShort = (amount: number) =>
  new Intl.NumberFormat('fr-GN').format(amount)

const isValidGNPhone = (phone: string) => /^\+224\s?[567]\d{2}\s?\d{2}\s?\d{2}\s?\d{2}$/.test(phone)

/** Map API WalletTransactionData to the UI Transaction shape */
function mapWalletTransaction(tx: WalletTransactionData): Transaction {
  const isDebit = tx.type === 'debit' || tx.type === 'transfer_out'

  // Determine UI type from API transaction type
  let uiType: Transaction['type'] = 'bonus'
  let title = tx.description || 'Transaction'
  let subtitle = ''

  if (tx.type === 'credit') {
    if (tx.method === 'mobile_money' || tx.method === 'card' || tx.method === 'transfer') {
      uiType = 'recharge'
      title = `Recharge ${tx.provider ? tx.provider.charAt(0).toUpperCase() + tx.provider.slice(1) : 'Mobile Money'}`
      subtitle = 'Via ' + (tx.provider || 'Mobile Money')
    } else {
      uiType = 'bonus'
      title = tx.description || 'Credit recu'
      subtitle = 'Bonus'
    }
  } else if (tx.type === 'debit') {
    uiType = 'course'
    title = tx.description || 'Paiement'
    subtitle = tx.method || 'Wallet'
  } else if (tx.type === 'transfer_in') {
    uiType = 'virement'
    title = tx.description || 'Virement recu'
    subtitle = 'Recu avec succes'
  } else if (tx.type === 'transfer_out') {
    uiType = 'virement'
    title = tx.description || 'Virement envoye'
    subtitle = 'Envoye avec succes'
  }

  // Format date
  const createdAt = new Date(tx.createdAt)
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterday = new Date(today.getTime() - 86400000)
  const txDate = new Date(createdAt.getFullYear(), createdAt.getMonth(), createdAt.getDate())

  let dateGroup: string
  if (txDate.getTime() === today.getTime()) {
    dateGroup = "Aujourd'hui"
  } else if (txDate.getTime() === yesterday.getTime()) {
    dateGroup = 'Hier'
  } else {
    dateGroup = createdAt.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
  }

  const time = createdAt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  const date = `${dateGroup}, ${time}`

  // Map status
  let status: Transaction['status'] = 'Terminé'
  if (tx.status === 'pending') status = 'En cours'
  else if (tx.status === 'failed') status = 'Échoué'

  return {
    id: tx.id,
    type: uiType,
    title,
    subtitle,
    amount: isDebit ? -Math.abs(tx.amount) : Math.abs(tx.amount),
    date,
    dateGroup,
    time,
    status,
    method: tx.method || tx.provider || undefined,
  }
}

// ── Types ────────────────────────────────────────────────────────────────────

interface Transaction {
  id: string
  type: 'course' | 'recharge' | 'livraison' | 'cashback' | 'virement' | 'bonus'
  title: string
  subtitle: string
  amount: number
  date: string
  dateGroup: string
  time: string
  status: 'Terminé' | 'En cours' | 'Échoué'
  method?: string
}

interface FrequentContact {
  id: string
  name: string
  initials: string
  phone: string
  lastAmount: number
  lastDate: string
}

type TabValue = 'accueil' | 'recharger' | 'envoyer' | 'activite' | 'statistiques'

// ── Static Fallback Data ─────────────────────────────────────────────────────

const fallbackContacts: FrequentContact[] = [
  { id: 'fc1', name: 'Fatoumata Diallo', initials: 'FD', phone: '+224 621 12 34 56', lastAmount: 15000, lastDate: 'Hier' },
  { id: 'fc2', name: 'Ibrahima Soumah', initials: 'IS', phone: '+224 662 98 76 54', lastAmount: 20000, lastDate: 'Hier' },
  { id: 'fc3', name: 'Sekou Conde', initials: 'SC', phone: '+224 623 45 67 89', lastAmount: 10000, lastDate: '11 Jan' },
  { id: 'fc4', name: 'Aissatou Bah', initials: 'AB', phone: '+224 664 11 22 33', lastAmount: 7500, lastDate: '08 Jan' },
]

/** Extract recent unique contacts from wallet transfer-out transactions */
function extractContactsFromTransactions(rawTxs: WalletTransactionData[]): FrequentContact[] {
  const transferOut = rawTxs.filter(tx => tx.type === 'transfer_out')
  if (transferOut.length === 0) return fallbackContacts

  const seen = new Map<string, FrequentContact>()
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterday = new Date(today.getTime() - 86400000)

  for (const tx of transferOut) {
    let name = (tx.description || 'Destinataire').trim()
    // Remove common prefixes like "Transfert a " or "Envoye a "
    name = name.replace(/^(Transfert|Envoi|Virement)\s+(a|à|envers|pour)\s+/i, '').trim()
    if (!name || name.length < 2) name = 'Destinataire'

    if (seen.has(name)) continue

    const createdAt = new Date(tx.createdAt)
    const txDate = new Date(createdAt.getFullYear(), createdAt.getMonth(), createdAt.getDate())
    let dateStr: string
    if (txDate.getTime() === today.getTime()) {
      dateStr = "Aujourd'hui"
    } else if (txDate.getTime() === yesterday.getTime()) {
      dateStr = 'Hier'
    } else {
      dateStr = createdAt.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
    }

    // Generate a deterministic masked phone from the name
    let hash = 0
    for (let i = 0; i < name.length; i++) hash = ((hash << 5) - hash + name.charCodeAt(i)) | 0
    const abs = Math.abs(hash)
    const phone = `+224 ${6 + (abs % 2)}${String(abs).padStart(2, '0').slice(0, 2)} ${(abs % 100).toString().padStart(2, '0')} ${(abs % 100).toString().padStart(2, '0')} ${(abs % 100).toString().padStart(2, '0')}`

    seen.set(name, {
      id: `rc-${tx.id}`,
      name,
      initials: name
        .split(' ')
        .map(n => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2),
      phone,
      lastAmount: Math.abs(tx.amount),
      lastDate: dateStr,
    })
  }

  return Array.from(seen.values())
}

const typeLabels: Record<string, { label: string; color: string }> = {
  course: { label: 'Courses VTC', color: 'bg-emerald-500' },
  virement: { label: 'Transferts', color: 'bg-teal-500' },
  livraison: { label: 'Livraisons', color: 'bg-amber-500' },
  bonus: { label: 'Bonus & Cashback', color: 'bg-emerald-400' },
  recharge: { label: 'Recharges', color: 'bg-blue-500' },
  cashback: { label: 'Cashback', color: 'bg-amber-400' },
}

// ── Sub-components ───────────────────────────────────────────────────────────

function TransactionIcon({ type }: { type: Transaction['type'] }) {
  switch (type) {
    case 'course':
      return <Car className="size-4 text-emerald-600" />
    case 'recharge':
      return <ArrowDownLeft className="size-4 text-emerald-600" />
    case 'livraison':
      return <Package className="size-4 text-amber-500" />
    case 'cashback':
      return <Gift className="size-4 text-amber-500" />
    case 'virement':
      return <Send className="size-4 text-emerald-600" />
    case 'bonus':
      return <Sparkles className="size-4 text-amber-500" />
    default:
      return <CircleDot className="size-4 text-muted-foreground" />
  }
}

function TransactionIconBg({ type }: { type: Transaction['type'] }) {
  const bgClass =
    type === 'course' || type === 'recharge' || type === 'virement'
      ? 'bg-emerald-50 dark:bg-emerald-900/30'
      : 'bg-amber-50 dark:bg-amber-900/30'
  return <div className={`flex-shrink-0 w-10 h-10 rounded-full ${bgClass} flex items-center justify-center`}><TransactionIcon type={type} /></div>
}

function StatusBadge({ status }: { status: Transaction['status'] }) {
  if (status === 'Terminé')
    return <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-900/40 dark:text-emerald-400 text-[10px] px-1.5 py-0">Terminé</Badge>
  if (status === 'En cours')
    return <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 dark:bg-amber-900/40 dark:text-amber-400 text-[10px] px-1.5 py-0">En cours</Badge>
  return <Badge variant="destructive" className="text-[10px] px-1.5 py-0">Échoué</Badge>
}

function TransactionRow({ tx, showTime = false }: { tx: Transaction; showTime?: boolean }) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-xl hover:bg-muted/50 transition-colors">
      <TransactionIconBg type={tx.type} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{tx.title}</p>
        <p className="text-xs text-muted-foreground truncate">{tx.subtitle}</p>
      </div>
      <div className="flex flex-col items-end gap-1">
        <span className={`text-sm font-semibold ${tx.amount >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
          {tx.amount >= 0 ? '+' : '-'}{fmt(Math.abs(tx.amount))}
        </span>
        {showTime && (
          <span className="text-[10px] text-muted-foreground">{tx.time}</span>
        )}
      </div>
    </div>
  )
}

function TransactionRowWithStatus({ tx }: { tx: Transaction }) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-xl hover:bg-muted/50 transition-colors">
      <TransactionIconBg type={tx.type} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{tx.title}</p>
        <p className="text-xs text-muted-foreground truncate">{tx.method}</p>
      </div>
      <div className="flex flex-col items-end gap-1">
        <span className={`text-sm font-semibold ${tx.amount >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
          {tx.amount >= 0 ? '+' : '-'}{fmt(Math.abs(tx.amount))}
        </span>
        <StatusBadge status={tx.status} />
      </div>
    </div>
  )
}

// ── Animated Balance Counter ──────────────────────────────────────────────────

function AnimatedBalance({ value, formatter, className }: { value: number; formatter: (_v: number) => string; className?: string }) {
  const prevValue = useRef(value)
  const [displayValue, setDisplayValue] = useState(value)
  const animationRef = useRef<number | null>(null)

  useEffect(() => {
    if (prevValue.current === value) return

    const startValue = prevValue.current
    const endValue = value
    const duration = 600
    const startTime = performance.now()

    function animate(currentTime: number) {
      const elapsed = currentTime - startTime
      const progress = Math.min(elapsed / duration, 1)
      // Ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3)
      const currentValue = Math.round(startValue + (endValue - startValue) * eased)
      setDisplayValue(currentValue)

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate)
      } else {
        prevValue.current = endValue
        setDisplayValue(endValue)
      }
    }

    animationRef.current = requestAnimationFrame(animate)
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current)
    }
  }, [value])

  return <span className={className}>{formatter(displayValue)}</span>
}

// ── Tab Components ───────────────────────────────────────────────────────────

function AccueilTab({
  balance,
  showBalance,
  toggleBalance,
  onNavigate,
  transactions,
  isLoadingTransactions,
  promotions,
  isLoadingPromotions,
  walletLoading,
  promoCode,
  setPromoCode,
  onRedeemPromo,
  redeemPending,
  referralsData,
  isLoadingReferrals,
  copiedReferral,
  onCopyReferralCode,
  referralInput,
  setReferralInput,
  onApplyReferral,
  referralPending,
  userPromotionsData,
  isLoadingUserPromotions,
}: {
  balance: number
  showBalance: boolean
  toggleBalance: () => void
  onNavigate: (_tab: TabValue) => void
  transactions: Transaction[]
  isLoadingTransactions: boolean
  promotions: PromotionData[]
  isLoadingPromotions: boolean
  walletLoading: boolean
  promoCode: string
  setPromoCode: (_v: string) => void
  onRedeemPromo: () => void
  redeemPending: boolean
  referralsData?: ReferralsData
  isLoadingReferrals: boolean
  copiedReferral: boolean
  onCopyReferralCode: () => void
  referralInput: string
  setReferralInput: (_v: string) => void
  onApplyReferral: () => void
  referralPending: boolean
  userPromotionsData?: UserPromotionsData
  isLoadingUserPromotions: boolean
}) {
  const recentTxs = transactions.slice(0, 10)

  // Pick the first active promotion for the banner
  const activePromo = promotions.length > 0 ? promotions[0] : null
  const promoLabel = activePromo
    ? activePromo.discountType === 'percentage'
      ? `${activePromo.discountValue}% de remise`
      : `${fmt(activePromo.discountValue)} de remise`
    : ''
  const promoMinAmount = activePromo?.minAmount ? `Rechargez ${fmt(activePromo.minAmount)} minimum` : 'Rechargez maintenant'

  const { setView } = useAppStore()

  return (
    <div className="space-y-5">
      {/* Balance Hero Card */}
      <Card className="overflow-hidden border-0 shadow-lg">
        <div className="bg-gradient-to-br from-emerald-600 via-emerald-500 to-teal-500 p-6 text-white relative">
          <div className="absolute top-0 right-0 w-40 h-40 bg-white/5 rounded-full -translate-y-16 translate-x-16" />
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/5 rounded-full translate-y-12 -translate-x-12" />
          <div className="relative">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm text-white/80 flex items-center gap-1.5">
                <Wallet className="size-4" />
                Solde disponible
              </span>
              <button
                onClick={toggleBalance}
                className="w-8 h-8 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center transition-colors"
              >
                {showBalance ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
              </button>
            </div>
            {walletLoading ? (
              <Skeleton className="h-10 w-48 bg-white/20" />
            ) : (
              <p className="text-4xl font-bold tracking-tight mb-1">
                {showBalance ? (
                  <AnimatedBalance value={balance} formatter={(v) => fmt(v)} />
                ) : '*** *** *** GNF'}
              </p>
            )}
            <div className="flex items-center gap-2 mt-2">
              <span className="text-xs flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/20">
                <TrendingUp className="size-3" />
                {walletLoading ? 'Chargement...' : 'Portefeuille actif'}
              </span>
            </div>
          </div>
        </div>
      </Card>

      {/* Quick Actions Grid */}
      <div className="grid grid-cols-2 gap-3">
        <Card
          className="cursor-pointer mova-card-hover border-emerald-200 dark:border-emerald-800 hover:border-emerald-300 dark:hover:border-emerald-700 transition-all"
          onClick={() => onNavigate('recharger')}
        >
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-orange-50 dark:bg-orange-900/30 flex items-center justify-center flex-shrink-0">
              <CreditCard className="size-5 text-orange-500" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold">Mobile Money</p>
              <p className="text-[11px] text-muted-foreground truncate">Recharger via Orange/MTN</p>
            </div>
          </CardContent>
        </Card>

        <Card
          className="cursor-pointer mova-card-hover border-emerald-200 dark:border-emerald-800 hover:border-emerald-300 dark:hover:border-emerald-700 transition-all"
          onClick={() => onNavigate('envoyer')}
        >
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center flex-shrink-0">
              <ArrowUpDown className="size-5 text-emerald-600" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold">Virement</p>
              <p className="text-[11px] text-muted-foreground truncate">Envoyer a un contact</p>
            </div>
          </CardContent>
        </Card>

        <Card
          className="cursor-pointer mova-card-hover border-emerald-200 dark:border-emerald-800 hover:border-emerald-300 dark:hover:border-emerald-700 transition-all"
          onClick={() => setView('promotions')}
        >
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-amber-50 dark:bg-amber-900/30 flex items-center justify-center flex-shrink-0">
              <Tag className="size-5 text-amber-500" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold">Codes promo</p>
              <p className="text-[11px] text-muted-foreground truncate">Appliquer un code</p>
            </div>
          </CardContent>
        </Card>

        <Card
          className="cursor-pointer mova-card-hover border-emerald-200 dark:border-emerald-800 hover:border-emerald-300 dark:hover:border-emerald-700 transition-all"
          onClick={() => onNavigate('activite')}
        >
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center flex-shrink-0">
              <Clock className="size-5 text-emerald-600" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold">Historique</p>
              <p className="text-[11px] text-muted-foreground truncate">Voir l&apos;historique</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Transactions */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Receipt className="size-4 text-emerald-600" />
              Transactions recentes
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-emerald-600 hover:text-emerald-700"
              onClick={() => onNavigate('activite')}
            >
              Voir tout
              <ChevronRight className="size-3.5 ml-0.5" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0 pb-2">
          {isLoadingTransactions ? (
            <div className="p-4 space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="size-10 rounded-full" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                  <Skeleton className="h-4 w-16" />
                </div>
              ))}
            </div>
          ) : (
            <ScrollArea className="max-h-96">
              <div className="divide-y">
                {recentTxs.length > 0 ? (
                  recentTxs.map((tx) => (
                    <TransactionRow key={tx.id} tx={tx} />
                  ))
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                    <Receipt className="size-8 mb-2 opacity-40" />
                    <p className="text-sm">Aucune transaction</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Promo Banner - Dynamic from API */}
      {isLoadingPromotions ? (
        <Card className="overflow-hidden border-0 shadow-md">
          <div className="bg-gradient-to-r from-emerald-600 to-teal-500 p-4 text-white">
            <div className="flex items-center gap-3">
              <Skeleton className="size-11 rounded-full bg-white/20" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-2/3 bg-white/20" />
                <Skeleton className="h-3 w-full bg-white/15" />
                <Skeleton className="h-7 w-36 bg-white/20" />
              </div>
            </div>
          </div>
        </Card>
      ) : activePromo ? (
        <Card className="overflow-hidden border-0 shadow-md">
          <div className="relative overflow-hidden bg-gradient-to-r from-emerald-600 to-teal-500 p-4 text-white">
            <div className="absolute top-0 right-0 w-28 h-28 bg-white/10 rounded-full -translate-y-10 translate-x-10" />
            <div className="absolute bottom-0 left-1/2 w-20 h-20 bg-white/5 rounded-full translate-y-8" />
            <div className="relative flex items-start gap-3">
              <div className="w-11 h-11 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
                <Zap className="size-5 text-white" />
              </div>
              <div className="space-y-1 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm">{activePromo.code}</span>
                  <Badge className="bg-white/20 text-white text-[10px] hover:bg-white/20 border-0">
                    {promoLabel}
                  </Badge>
                </div>
                <p className="text-xs text-white/90">
                  {activePromo.description || promoLabel}
                </p>
                <Button
                  size="sm"
                  variant="secondary"
                  className="mt-2 h-7 text-xs bg-white text-emerald-700 hover:bg-white/90"
                  onClick={() => onNavigate('recharger')}
                >
                  <Plus className="size-3 mr-1" />
                  {promoMinAmount}
                </Button>
              </div>
            </div>
          </div>
        </Card>
      ) : (
        <Card className="overflow-hidden border-0 shadow-md">
          <div className="relative overflow-hidden bg-gradient-to-r from-emerald-600 to-teal-500 p-4 text-white">
            <div className="absolute top-0 right-0 w-28 h-28 bg-white/10 rounded-full -translate-y-10 translate-x-10" />
            <div className="absolute bottom-0 left-1/2 w-20 h-20 bg-white/5 rounded-full translate-y-8" />
            <div className="relative flex items-start gap-3">
              <div className="w-11 h-11 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
                <Sparkles className="size-5 text-white" />
              </div>
              <div className="space-y-1 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm">Offre speciale!</span>
                  <Badge className="bg-white/20 text-white text-[10px] hover:bg-white/20 border-0">Limite</Badge>
                </div>
                <p className="text-xs text-white/90">
                  Rechargez 50 000 GNF et recevez 2 500 GNF bonus !
                </p>
                <Button
                  size="sm"
                  variant="secondary"
                  className="mt-2 h-7 text-xs bg-white text-emerald-700 hover:bg-white/90"
                  onClick={() => onNavigate('recharger')}
                >
                  <Plus className="size-3 mr-1" />
                  Recharger maintenant
                </Button>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Promo Code Redemption */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Tag className="size-4 text-amber-500" />
            Code promo
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input
              placeholder="Entrez votre code promo"
              value={promoCode}
              onChange={(e) => setPromoCode(e.target.value)}
              className="flex-1 text-sm uppercase"
            />
            <Button
              onClick={onRedeemPromo}
              disabled={redeemPending || !promoCode.trim()}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {redeemPending ? (
                <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}>
                  <RefreshCw className="size-4" />
                </motion.div>
              ) : (
                <Zap className="size-4 mr-1" />
              )}
              <span className="hidden sm:inline">Appliquer</span>
            </Button>
          </div>
          {promotions.length > 1 && (
            <div className="flex flex-wrap gap-1.5">
              {promotions.slice(1, 4).map((p) => (
                <Badge
                  key={p.id}
                  variant="outline"
                  className="text-[10px] cursor-pointer border-emerald-200 dark:border-emerald-800 hover:bg-emerald-50 dark:hover:bg-emerald-900/20"
                  onClick={() => setPromoCode(p.code)}
                >
                  {p.code}
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Referral / Parrainage Section */}
      {isLoadingReferrals ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="size-4 text-emerald-600" />
              Parrainage
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-10 w-full" />
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16 w-full rounded-lg" />
              ))}
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="size-4 text-emerald-600" />
              Parrainage
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Referral Code Display */}
            {referralsData?.referralCode && (
              <div className="p-3 rounded-xl bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 border border-emerald-200 dark:border-emerald-800">
                <p className="text-xs text-muted-foreground mb-1.5">Votre code de parrainage</p>
                <div className="flex items-center gap-2">
                  <span className="text-lg font-bold text-emerald-700 dark:text-emerald-400 tracking-wider flex-1">
                    {referralsData.referralCode}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs border-emerald-300 dark:border-emerald-700"
                    onClick={onCopyReferralCode}
                  >
                    {copiedReferral ? <Check className="size-3.5 mr-1 text-emerald-600" /> : <Copy className="size-3.5 mr-1" />}
                    {copiedReferral ? 'Copie !' : 'Copier'}
                  </Button>
                </div>
              </div>
            )}

            {/* Referral Stats */}
            <div className="grid grid-cols-3 gap-2">
              <div className="text-center p-2 rounded-lg bg-muted/50">
                <p className="text-lg font-bold text-emerald-600">{referralsData?.stats?.totalReferred ?? 0}</p>
                <p className="text-[10px] text-muted-foreground">Filles</p>
              </div>
              <div className="text-center p-2 rounded-lg bg-muted/50">
                <p className="text-lg font-bold text-amber-600">{fmtShort(referralsData?.stats?.earnedTotal ?? 0)}</p>
                <p className="text-[10px] text-muted-foreground">Gagnes (GNF)</p>
              </div>
              <div className="text-center p-2 rounded-lg bg-muted/50">
                <p className="text-lg font-bold text-emerald-600">{fmtShort(referralsData?.stats?.pendingTotal ?? 0)}</p>
                <p className="text-[10px] text-muted-foreground">En attente</p>
              </div>
            </div>

            {/* Apply Referral Code */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Appliquer un code de parrainage</label>
              <div className="flex gap-2">
                <Input
                  placeholder="Code du parrain"
                  value={referralInput}
                  onChange={(e) => setReferralInput(e.target.value)}
                  className="flex-1 text-sm uppercase"
                />
                <Button
                  variant="outline"
                  onClick={onApplyReferral}
                  disabled={referralPending || !referralInput.trim()}
                  className="border-emerald-200 dark:border-emerald-800 hover:bg-emerald-50 dark:hover:bg-emerald-900/20"
                >
                  {referralPending ? (
                    <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}>
                      <RefreshCw className="size-4" />
                    </motion.div>
                  ) : (
                    <UserPlus className="size-4" />
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* User's Redeemed Promotions */}
      {isLoadingUserPromotions ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Gift className="size-4 text-amber-500" />
              Mes promotions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="size-10 rounded-full" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
                <Skeleton className="h-4 w-16" />
              </div>
            ))}
          </CardContent>
        </Card>
      ) : userPromotionsData && userPromotionsData.redemptions.length > 0 ? (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Gift className="size-4 text-amber-500" />
                Mes promotions
              </CardTitle>
              <Badge variant="outline" className="text-[10px] border-amber-300 dark:border-amber-700">
                {userPromotionsData.totalRedemptions} utilisee{userPromotionsData.totalRedemptions > 1 ? 's' : ''}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0 pb-2">
            <ScrollArea className="max-h-64">
              <div className="divide-y">
                {userPromotionsData.redemptions.slice(0, 5).map((redemption) => {
                  const promLabel = redemption.promotion.discountType === 'percentage'
                    ? `${redemption.promotion.discountValue}%`
                    : fmt(redemption.promotion.discountValue)
                  return (
                    <div key={redemption.id} className="flex items-center gap-3 p-3">
                      <div className="flex-shrink-0 w-10 h-10 rounded-full bg-amber-50 dark:bg-amber-900/30 flex items-center justify-center">
                        <Tag className="size-4 text-amber-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{redemption.promotion.code}</p>
                        <p className="text-xs text-muted-foreground">
                          {redemption.promotion.description || `Remise ${promLabel}`}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-0.5">
                        <span className="text-xs font-semibold text-emerald-600">-{promLabel}</span>
                        <span className="text-[10px] text-muted-foreground">
                          {new Date(redemption.redeemedAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </ScrollArea>
            <div className="px-4 pt-2 pb-3">
              <p className="text-xs text-muted-foreground">
                Economies totales : <span className="font-semibold text-emerald-600">{fmt(userPromotionsData.totalSavings)}</span>
              </p>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}

function RechargerTab({ balance, userId }: { balance: number; userId: string }) {
  const [topUpOpen, setTopUpOpen] = useState(false)
  const [topUpDefaultAmount, setTopUpDefaultAmount] = useState<number | null>(null)

  function handleTopUpSuccess(newBalance: number) {
    toast.success(`Recharge effectuee avec succes! Nouveau solde: ${fmt(newBalance)}`)
    setTopUpOpen(false)
    setTopUpDefaultAmount(null)
  }

  function openTopUpWithAmount(amount: number) {
    setTopUpDefaultAmount(amount)
    setTopUpOpen(true)
  }

  function openTopUp() {
    setTopUpDefaultAmount(null)
    setTopUpOpen(true)
  }

  const quickAmounts = [5000, 10000, 25000, 50000, 100000, 200000]

  return (
    <div className="space-y-5">
      {/* Balance Summary */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Solde actuel</p>
              <p className="text-2xl font-bold mova-gradient-text">{fmt(balance)}</p>
            </div>
            <div className="w-12 h-12 rounded-full bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center">
              <Wallet className="size-6 text-emerald-600" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Top Up */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Recharge rapide</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-2">
            {quickAmounts.map((amount) => (
              <Button
                key={amount}
                variant="outline"
                className="h-auto py-3 flex-col gap-0.5 border-emerald-200 dark:border-emerald-800 hover:bg-emerald-50 dark:hover:bg-emerald-900/20"
                onClick={() => openTopUpWithAmount(amount)}
              >
                <span className="text-sm font-bold">
                  {amount >= 1000 ? `${Math.floor(amount / 1000)}K` : amount}
                </span>
                <span className="text-[10px] text-muted-foreground">GNF</span>
              </Button>
            ))}
          </div>
          <Button
            className="w-full h-12 text-base"
            onClick={openTopUp}
          >
            <Plus className="size-5 mr-2" />
            Autre montant
          </Button>
        </CardContent>
      </Card>

      {/* Payment Methods */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Methodes de paiement</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-3 p-3 rounded-xl border border-orange-200 dark:border-orange-800 bg-orange-50/50 dark:bg-orange-900/10">
            <div className="w-10 h-10 rounded-lg bg-orange-100 dark:bg-orange-900/40 flex items-center justify-center">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><rect width="24" height="24" rx="6" fill="#F97316"/><text x="12" y="16" textAnchor="middle" fill="white" fontSize="8" fontWeight="bold">OM</text></svg>
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium">Orange Money</p>
              <p className="text-xs text-muted-foreground">Paiement instantane</p>
            </div>
            <ChevronRight className="size-4 text-muted-foreground" />
          </div>
          <div className="flex items-center gap-3 p-3 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-900/10">
            <div className="w-10 h-10 rounded-lg bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><rect width="24" height="24" rx="6" fill="#F59E0B"/><text x="12" y="16" textAnchor="middle" fill="white" fontSize="7" fontWeight="bold">MTN</text></svg>
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium">MTN Mobile Money</p>
              <p className="text-xs text-muted-foreground">Paiement instantane</p>
            </div>
            <ChevronRight className="size-4 text-muted-foreground" />
          </div>
          <div className="flex items-center gap-3 p-3 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-900/10">
            <div className="w-10 h-10 rounded-lg bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center">
              <CreditCard className="size-5 text-emerald-600" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium">Carte bancaire</p>
              <p className="text-xs text-muted-foreground">Visa, Mastercard</p>
            </div>
            <ChevronRight className="size-4 text-muted-foreground" />
          </div>
        </CardContent>
      </Card>

      <WalletTopUp
        open={topUpOpen}
        onOpenChange={setTopUpOpen}
        currentBalance={balance}
        userId={userId}
        onTopUpSuccess={handleTopUpSuccess}
        defaultAmount={topUpDefaultAmount}
      />
    </div>
  )
}

function EnvoyerTab({ balance, transactions, rawTransactions, userId }: { balance: number; transactions: Transaction[]; rawTransactions: WalletTransactionData[]; userId: string }) {
  const [phone, setPhone] = useState('')
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)

  const walletTransfer = useWalletTransfer()

  // Build dynamic contacts from recent transfer-out transactions, fallback to static list
  const dynamicContacts = extractContactsFromTransactions(rawTransactions)

  const quickAmounts = [1000, 2000, 5000, 10000]

  function handleSend() {
    if (!phone.trim()) {
      toast.error('Veuillez entrer un numero de telephone')
      return
    }
    if (!isValidGNPhone(phone.trim())) {
      toast.error('Numero de telephone invalide. Format: +224 6XX XX XX XX')
      return
    }
    if (!amount || Number(amount) <= 0) {
      toast.error('Veuillez entrer un montant valide')
      return
    }
    if (Number(amount) > balance) {
      toast.error('Solde insuffisant')
      return
    }
    setShowConfirmDialog(true)
  }

  function confirmSend() {
    setShowConfirmDialog(false)
    walletTransfer.mutate(
      { fromUserId: userId, toUserId: phone.trim(), amount: Number(amount) },
      {
        onSuccess: (data) => {
          toast.success(`Transfert de ${fmt(data.amount)} envoye avec succes`)
          setPhone('')
          setAmount('')
          setNote('')
        },
        onError: (err) => {
          toast.error(err.message || 'Erreur lors du transfert. Veuillez reessayer.')
        },
      }
    )
  }

  function handleQuickAmount(val: number) {
    setAmount(String(val))
  }

  function handleSelectContact(contact: FrequentContact) {
    setPhone(contact.phone)
    toast.info(`Contact ${contact.name} selectionne`)
  }

  return (
    <div className="space-y-5">
      {/* Balance Reminder */}
      <Card>
        <CardContent className="p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground">Solde disponible</p>
            <p className="text-xl font-bold mova-gradient-text">{fmt(balance)}</p>
          </div>
          <div className="px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 text-xs font-medium">
            Frais: 0 GNF
          </div>
        </CardContent>
      </Card>

      {/* Transfer Form */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Send className="size-4 text-emerald-600" />
            Envoyer de l&apos;argent
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Phone Input */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Numero du destinataire</label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                placeholder="+224 6XX XX XX XX"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className={`pl-10 text-base ${phone.trim() && !isValidGNPhone(phone.trim()) ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
              />
              {phone.trim() && !isValidGNPhone(phone.trim()) && (
                <p className="text-[11px] text-red-500 mt-1">Format invalide. Exemple: +224 621 12 34 56</p>
              )}
            </div>
          </div>

          {/* Amount Input */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Montant</label>
            <div className="relative">
              <Input
                type="number"
                placeholder="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="text-2xl font-bold text-center pr-12"
                min={0}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-medium">
                GNF
              </span>
            </div>
          </div>

          {/* Quick Amounts */}
          <div className="flex gap-2">
            {quickAmounts.map((val) => (
              <Button
                key={val}
                size="sm"
                variant={amount === String(val) ? 'default' : 'outline'}
                className={`flex-1 text-xs ${amount === String(val) ? 'bg-emerald-600 hover:bg-emerald-700' : 'border-emerald-200 dark:border-emerald-800'}`}
                onClick={() => handleQuickAmount(val)}
              >
                {val >= 1000 ? `${val / 1000}K` : val}
              </Button>
            ))}
          </div>

          {/* Note */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-muted-foreground">Note (optionnel)</label>
            <Input
              placeholder="Ajouter un message..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="text-sm"
            />
          </div>

          {/* Fee Display */}
          <div className="p-3 rounded-lg bg-muted/50 flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Frais de transfert</span>
            <span className="text-sm font-semibold text-emerald-600">0 GNF</span>
          </div>

          {/* Send Button */}
          <Button
            className="w-full h-12 text-base"
            onClick={handleSend}
            disabled={walletTransfer.isPending || !phone.trim() || !amount || Number(amount) <= 0}
          >
            {walletTransfer.isPending ? (
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
              >
                <Send className="size-5 mr-2" />
              </motion.div>
            ) : (
              <Send className="size-5 mr-2" />
            )}
            {walletTransfer.isPending ? 'Envoi en cours...' : 'Envoyer'}
          </Button>
        </CardContent>
      </Card>

      {/* Transfer Confirmation Dialog */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <ShieldCheck className="size-5 text-emerald-600" />
              Confirmer le transfert
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3 pt-2">
              <p className="text-sm">Vous allez envoyer les fonds suivants :</p>
              <div className="p-3 rounded-xl bg-muted/50 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Destinataire</span>
                  <span className="font-medium">{phone.trim()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Montant</span>
                  <span className="font-bold text-emerald-600">{fmt(Number(amount))}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Frais</span>
                  <span className="font-medium text-emerald-600">0 GNF</span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Cette action est irreversible. Assurez-vous que le numero du destinataire est correct.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmSend}
              disabled={walletTransfer.isPending}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              Confirmer l&apos;envoi
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Frequent Contacts */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="size-4 text-emerald-600" />
            Contacts frequents
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 pb-2">
          <ScrollArea className="max-h-56">
            <div className="divide-y">
              {dynamicContacts.map((contact) => (
                <button
                  key={contact.id}
                  className="w-full flex items-center gap-3 p-3 hover:bg-muted/50 transition-colors text-left"
                  onClick={() => handleSelectContact(contact)}
                >
                  <Avatar className="size-10">
                    <AvatarFallback className="bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 text-xs font-bold">
                      {contact.initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{contact.name}</p>
                    <p className="text-xs text-muted-foreground">{contact.lastDate} - {fmt(contact.lastAmount)}</p>
                  </div>
                  <ChevronRight className="size-4 text-muted-foreground" />
                </button>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Recent Transfers */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="size-4 text-emerald-600" />
            Transferts recents
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 pb-2">
          <div className="divide-y">
            {transactions
              .filter((tx) => tx.type === 'virement')
              .slice(0, 4)
              .map((tx) => (
                <TransactionRowWithStatus key={tx.id} tx={tx} />
              ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function ActiviteTab({
  transactions,
  isLoading,
}: {
  transactions: Transaction[]
  isLoading: boolean
}) {
  const [dateFilter, setDateFilter] = useState('tout')
  const [typeFilter, setTypeFilter] = useState('tout')

  function getFilteredTransactions() {
    let txs = [...transactions]
    if (dateFilter === 'aujourdhui') {
      txs = txs.filter((tx) => tx.dateGroup === "Aujourd'hui")
    } else if (dateFilter === 'semaine') {
      // Show recent transactions for the week
      txs = txs.slice(0, 20)
    } else if (dateFilter === 'mois') {
      txs = txs.slice(0, 50)
    }
    if (typeFilter !== 'tout') {
      txs = txs.filter((tx) => tx.type === typeFilter)
    }
    return txs
  }

  const filteredTransactions = getFilteredTransactions()

  const totalCredits = filteredTransactions.filter((tx) => tx.amount > 0).reduce((s, tx) => s + tx.amount, 0)
  const totalDebits = filteredTransactions.filter((tx) => tx.amount < 0).reduce((s, tx) => s + Math.abs(tx.amount), 0)
  const netAmount = totalCredits - totalDebits

  const dateFilters = [
    { key: 'aujourdhui', label: "Aujourd'hui" },
    { key: 'semaine', label: 'Cette semaine' },
    { key: 'mois', label: 'Ce mois' },
    { key: 'tout', label: 'Tout' },
  ]
  const typeFilters = [
    { key: 'tout', label: 'Tout' },
    { key: 'recharge', label: 'Recharge' },
    { key: 'course', label: 'Course' },
    { key: 'virement', label: 'Virement' },
    { key: 'bonus', label: 'Bonus' },
  ]

  function handleExport() {
    // Generate CSV from filtered transactions
    const header = 'Date,Type,Description,Montant,Statut,Methode'
    const rows = filteredTransactions.map(tx => {
      const esc = (s: string) => `"${s.replace(/"/g, '""')}"`
      return [
        esc(tx.date),
        esc(tx.type),
        esc(tx.title),
        tx.amount.toFixed(0),
        esc(tx.status),
        esc(tx.method || 'Wallet'),
      ].join(',')
    })
    const csv = [header, ...rows].join('\n')

    // Trigger download via Blob
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    const today = new Date().toISOString().slice(0, 10)
    link.href = url
    link.download = `mova_transactions_${today}.csv`
    link.click()
    URL.revokeObjectURL(url)

    toast.success('Export telecharge !')
  }

  // Group transactions by dateGroup
  const groupedTransactions: Record<string, Transaction[]> = {}
  for (const tx of filteredTransactions) {
    if (!groupedTransactions[tx.dateGroup]) groupedTransactions[tx.dateGroup] = []
    groupedTransactions[tx.dateGroup].push(tx)
  }

  return (
    <div className="space-y-5">
      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-2">
        <Card className="border-emerald-200 dark:border-emerald-800">
          <CardContent className="p-3 text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <ArrowDown className="size-3 text-emerald-600" />
              <span className="text-[10px] text-muted-foreground">Credits</span>
            </div>
            <p className="text-sm font-bold text-emerald-600">{fmtShort(totalCredits)}</p>
          </CardContent>
        </Card>
        <Card className="border-red-200 dark:border-red-800">
          <CardContent className="p-3 text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <ArrowUp className="size-3 text-red-500" />
              <span className="text-[10px] text-muted-foreground">Debits</span>
            </div>
            <p className="text-sm font-bold text-red-500">{fmtShort(totalDebits)}</p>
          </CardContent>
        </Card>
        <Card className="border-emerald-200 dark:border-emerald-800">
          <CardContent className="p-3 text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <TrendingUp className="size-3 text-emerald-600" />
              <span className="text-[10px] text-muted-foreground">Net</span>
            </div>
            <p className={`text-sm font-bold ${netAmount >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
              {netAmount >= 0 ? '+' : '-'}{fmtShort(Math.abs(netAmount))}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filter Bar - Date */}
      <Card>
        <CardContent className="p-3">
          <div className="flex items-center gap-2 mb-3">
            <Filter className="size-4 text-muted-foreground" />
            <span className="text-sm font-medium">Periode</span>
          </div>
          <div className="flex gap-2 flex-wrap">
            {dateFilters.map((f) => (
              <Button
                key={f.key}
                size="sm"
                variant={dateFilter === f.key ? 'default' : 'outline'}
                className={
                  dateFilter === f.key
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-xs'
                    : 'text-xs'
                }
                onClick={() => setDateFilter(f.key)}
              >
                {f.label}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Filter Bar - Type */}
      <Card>
        <CardContent className="p-3">
          <div className="flex items-center gap-2 mb-3">
            <Search className="size-4 text-muted-foreground" />
            <span className="text-sm font-medium">Type</span>
          </div>
          <div className="flex gap-2 flex-wrap">
            {typeFilters.map((f) => (
              <Button
                key={f.key}
                size="sm"
                variant={typeFilter === f.key ? 'default' : 'outline'}
                className={
                  typeFilter === f.key
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-xs'
                    : 'text-xs'
                }
                onClick={() => setTypeFilter(f.key)}
              >
                {f.label}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Export Button */}
      <Button
        variant="outline"
        className="w-full border-emerald-200 dark:border-emerald-800 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20"
        onClick={handleExport}
      >
        <Download className="size-4 mr-2" />
        Exporter en CSV
      </Button>

      {/* Transaction List with Date Groups */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Receipt className="size-4 text-emerald-600" />
            Historique des transactions
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 pb-2">
          {isLoading ? (
            <div className="p-4 space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="size-10 rounded-full" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                  <Skeleton className="h-4 w-16" />
                </div>
              ))}
            </div>
          ) : filteredTransactions.length > 0 ? (
            <ScrollArea className="max-h-[500px]">
              <div>
                {Object.entries(groupedTransactions).map(([dateGroup, txs]) => (
                  <div key={dateGroup}>
                    {/* Date Group Header */}
                    <div className="px-4 py-2 bg-muted/40">
                      <p className="text-xs font-semibold text-muted-foreground">{dateGroup}</p>
                    </div>
                    <div className="divide-y">
                      {txs.map((tx) => (
                        <TransactionRow key={tx.id} tx={tx} showTime />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <Receipt className="size-10 mb-2 opacity-40" />
              <p className="text-sm">Aucune transaction trouvee</p>
              <p className="text-xs mt-1">Modifiez les filtres pour voir plus de resultats</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function StatistiquesTab({ transactions, referralsData, isLoadingReferrals, leaderboard }: { transactions: Transaction[]; referralsData?: ReferralsData; isLoadingReferrals: boolean; leaderboard?: ReferralLeaderboardEntry[] }) {
  const [period, setPeriod] = useState('mois')

  const periodFilters = [
    { key: 'semaine', label: 'Cette semaine' },
    { key: 'mois', label: 'Ce mois' },
    { key: 'trimestre', label: 'Les 3 derniers mois' },
  ]

  // ── Compute spending breakdown from real transactions ───────────────────
  function computeDynamicSpending() {
    const debits = transactions.filter(tx => tx.amount < 0)
    if (debits.length === 0) return []

    const byType = new Map<string, number>()
    for (const tx of debits) {
      byType.set(tx.type, (byType.get(tx.type) || 0) + Math.abs(tx.amount))
    }
    const total = Array.from(byType.values()).reduce((s, a) => s + a, 0)

    return Array.from(byType.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([type, amount]) => ({
        label: typeLabels[type]?.label || type,
        amount,
        percentage: total > 0 ? Math.round((amount / total) * 100) : 0,
        color: typeLabels[type]?.color || 'bg-stone-400',
      }))
  }

  function computeDynamicIncome() {
    const credits = transactions.filter(tx => tx.amount > 0)
    if (credits.length === 0) return []

    const byType = new Map<string, number>()
    for (const tx of credits) {
      byType.set(tx.type, (byType.get(tx.type) || 0) + tx.amount)
    }

    return Array.from(byType.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([type, amount]) => ({
        label: typeLabels[type]?.label || type,
        amount,
        color: typeLabels[type]?.color || 'bg-stone-400',
      }))
  }

  function computeDynamicMonthlyTrend() {
    if (transactions.length === 0) return []

    const monthMap = new Map<string, { key: string; label: string; amount: number }>()

    for (const tx of transactions) {
      let monthKey: string
      let monthLabel: string
      if (tx.dateGroup === "Aujourd'hui" || tx.dateGroup === 'Hier') {
        const now = new Date()
        monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
        monthLabel = now.toLocaleDateString('fr-FR', { month: 'short' })
      } else {
        const parts = tx.dateGroup.split(' ')
        if (parts.length >= 2) {
          const monthName = parts[1]
          const year = parts[2] || new Date().getFullYear().toString()
          monthKey = `${year}-${monthName}`
          monthLabel = monthName
        } else {
          continue
        }
      }

      const existing = monthMap.get(monthKey)
      if (existing) {
        existing.amount += Math.abs(tx.amount)
      } else {
        monthMap.set(monthKey, { key: monthKey, label: monthLabel, amount: Math.abs(tx.amount) })
      }
    }

    const sorted = Array.from(monthMap.values())
      .sort((a, b) => a.key.localeCompare(b.key))
      .slice(-6)

    if (sorted.length === 0) return []
    return sorted.map(m => ({ month: m.label, amount: m.amount }))
  }

  // Compute payment methods from real transactions
  function computeDynamicPaymentMethods() {
    const byMethod = new Map<string, number>()
    for (const tx of transactions) {
      const method = tx.method || 'Wallet'
      byMethod.set(method, (byMethod.get(method) || 0) + Math.abs(tx.amount))
    }
    const total = Array.from(byMethod.values()).reduce((s, a) => s + a, 0)
    if (total === 0) return []
    const methodColors: Record<string, string> = { 'Wallet': 'bg-emerald-500', 'mobile_money': 'bg-amber-500', 'cash': 'bg-stone-400', 'card': 'bg-blue-500' }
    return Array.from(byMethod.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([label, amount]) => ({
        label: label.charAt(0).toUpperCase() + label.slice(1),
        percentage: Math.round((amount / total) * 100),
        color: methodColors[label] || 'bg-stone-400',
      }))
  }

  const activeSpending = computeDynamicSpending()
  const activeIncome = computeDynamicIncome()
  const activeTrend = computeDynamicMonthlyTrend()
  const activePaymentMethods = computeDynamicPaymentMethods()

  const maxSpending = activeSpending.length > 0 ? Math.max(...activeSpending.map((s) => s.amount)) : 1
  const maxIncome = activeIncome.length > 0 ? Math.max(...activeIncome.map((s) => s.amount)) : 1
  const maxTrend = activeTrend.length > 0 ? Math.max(...activeTrend.map((m) => m.amount)) : 1
  const totalSpending = activeSpending.reduce((s, item) => s + item.amount, 0)

  return (
    <div className="space-y-5">
      {/* Period Selector */}
      <Card>
        <CardContent className="p-3">
          <div className="flex gap-2">
            {periodFilters.map((p) => (
              <Button
                key={p.key}
                size="sm"
                variant={period === p.key ? 'default' : 'outline'}
                className={`flex-1 text-xs ${period === p.key ? 'bg-emerald-600 hover:bg-emerald-700' : ''}`}
                onClick={() => setPeriod(p.key)}
              >
                {p.label}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Total Spent */}
      <Card>
        <CardContent className="p-4 text-center">
          <p className="text-xs text-muted-foreground mb-1">Total depenses ({period === 'mois' ? 'ce mois' : period === 'semaine' ? 'cette semaine' : '3 mois'})</p>
          <p className="text-3xl font-bold text-red-500">{fmt(totalSpending)}</p>
        </CardContent>
      </Card>

      {/* Empty state when no transactions at all */}
      {activeSpending.length === 0 && activeIncome.length === 0 && activeTrend.length === 0 && activePaymentMethods.length === 0 && (
        <Card className="border-muted">
          <CardContent className="p-8 text-center">
            <BarChart3 className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm font-medium">Aucune statistique disponible</p>
            <p className="text-xs text-muted-foreground mt-1">Les statistiques apparaitront automatiquement apres vos premieres transactions.</p>
          </CardContent>
        </Card>
      )}

      {/* Spending Breakdown */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart3 className="size-4 text-emerald-600" />
            Repartition des depenses
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {activeSpending.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Aucune depense enregistree</p>
          ) : (
            activeSpending.map((item) => (
              <div key={item.label} className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-sm">{item.label}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold">{fmtShort(item.amount)}</span>
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-muted-foreground/20">{item.percentage}%</Badge>
                  </div>
                </div>
                <div className="w-full h-2.5 rounded-full bg-muted/50 overflow-hidden">
                  <motion.div
                    className={`h-full rounded-full ${item.color}`}
                    initial={{ width: 0 }}
                    animate={{ width: `${(item.amount / maxSpending) * 100}%` }}
                    transition={{ duration: 0.8, ease: 'easeOut' }}
                  />
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Income Sources */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="size-4 text-emerald-600" />
            Sources de revenus
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {activeIncome.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Aucun revenu enregistre</p>
          ) : (
            <>
              {activeIncome.map((item) => (
                <div key={item.label} className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">{item.label}</span>
                    <span className="text-sm font-semibold text-emerald-600">{fmtShort(item.amount)}</span>
                  </div>
                  <div className="w-full h-2.5 rounded-full bg-muted/50 overflow-hidden">
                    <motion.div
                      className={`h-full rounded-full ${item.color}`}
                      initial={{ width: 0 }}
                      animate={{ width: `${(item.amount / maxIncome) * 100}%` }}
                      transition={{ duration: 0.8, ease: 'easeOut', delay: 0.2 }}
                    />
                  </div>
                </div>
              ))}
              <Separator />
              <div className="flex items-center justify-between pt-1">
                <span className="text-sm font-medium">Total revenus</span>
                <span className="text-sm font-bold text-emerald-600">
                  {fmtShort(activeIncome.reduce((s, i) => s + i.amount, 0))}
                </span>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Monthly Trend - Simple Bar Chart */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart3 className="size-4 text-emerald-600" />
            Tendance mensuelle
          </CardTitle>
        </CardHeader>
        <CardContent>
          {activeTrend.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-12">Aucune tendance mensuelle disponible</p>
          ) : (
            <div className="flex items-end justify-between gap-2 h-40 px-2">
              {activeTrend.map((item, index) => {
                const height = (item.amount / maxTrend) * 100
                return (
                  <div key={item.month} className="flex flex-col items-center gap-1.5 flex-1">
                    <span className="text-[10px] text-muted-foreground font-medium">
                      {item.amount >= 1000 ? `${Math.floor(item.amount / 1000)}K` : item.amount}
                    </span>
                    <motion.div
                      className="w-full rounded-t-md bg-emerald-500 min-h-[4px]"
                      initial={{ height: 0 }}
                      animate={{ height: `${height}%` }}
                      transition={{ duration: 0.6, ease: 'easeOut', delay: index * 0.1 }}
                    />
                    <span className="text-[10px] text-muted-foreground">{item.month}</span>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Payment Methods Pie */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <PieChart className="size-4 text-emerald-600" />
            Methodes de paiement
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {activePaymentMethods.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-12">Aucune methode de paiement utilisee</p>
          ) : (
            <>
              {/* Visual Pie Representation */}
              <div className="flex items-center justify-center py-4">
                <div className="relative w-36 h-36">
                  <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                    {activePaymentMethods.map((method, index) => {
                      const offset = activePaymentMethods.slice(0, index).reduce((s, m) => s + m.percentage, 0)
                      const dashArray = `${method.percentage} ${100 - method.percentage}`
                      const colors = ['#10b981', '#f59e0b', '#a8a29e', '#3b82f6', '#8b5cf6']
                      return (
                        <circle
                          key={method.label}
                          cx="50"
                          cy="50"
                          r="40"
                          fill="none"
                          stroke={colors[index % colors.length]}
                          strokeWidth="20"
                          strokeDasharray={dashArray}
                          strokeDashoffset={-offset}
                          className="transition-all duration-700"
                        />
                      )
                    })}
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center">
                      <p className="text-[10px] text-muted-foreground">Total</p>
                      <p className="text-sm font-bold">100%</p>
                    </div>
                  </div>
                </div>
              </div>
              {/* Legend */}
              <div className="space-y-2">
                {activePaymentMethods.map((method) => (
                  <div key={method.label} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-full ${method.color}`} />
                      <span className="text-sm">{method.label}</span>
                    </div>
                    <span className="text-sm font-semibold">{method.percentage}%</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Referral Stats & Leaderboard */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Trophy className="size-4 text-amber-500" />
            Parrainage et classement
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoadingReferrals ? (
            <div className="space-y-3">
              <Skeleton className="h-5 w-1/2" />
              <div className="grid grid-cols-3 gap-2">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-16 rounded-lg" />
                ))}
              </div>
              <Skeleton className="h-20 w-full" />
            </div>
          ) : referralsData ? (
            <>
              <div className="grid grid-cols-3 gap-2">
                <div className="text-center p-3 rounded-lg bg-emerald-50 dark:bg-emerald-900/20">
                  <p className="text-lg font-bold text-emerald-600">{referralsData.stats?.totalReferred ?? 0}</p>
                  <p className="text-[10px] text-muted-foreground">Personnes invitees</p>
                </div>
                <div className="text-center p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20">
                  <p className="text-lg font-bold text-amber-600">{fmtShort(referralsData.stats?.earnedTotal ?? 0)}</p>
                  <p className="text-[10px] text-muted-foreground">Total gagne (GNF)</p>
                </div>
                <div className="text-center p-3 rounded-lg bg-emerald-50 dark:bg-emerald-900/20">
                  <p className="text-lg font-bold text-emerald-600">{fmtShort(referralsData.stats?.paidTotal ?? 0)}</p>
                  <p className="text-[10px] text-muted-foreground">Verse (GNF)</p>
                </div>
              </div>
              {referralsData.referrals && referralsData.referrals.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">Derniers filleuls</p>
                  <ScrollArea className="max-h-48">
                    <div className="divide-y">
                      {referralsData.referrals.slice(0, 5).map((ref) => (
                        <div key={ref.id} className="flex items-center justify-between py-2">
                          <div className="flex items-center gap-2">
                            <Avatar className="size-8">
                              <AvatarFallback className="bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 text-xs font-bold">
                                {ref.referredUser.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="text-sm font-medium">{ref.referredUser.name}</p>
                              <p className="text-[10px] text-muted-foreground">{new Date(ref.referredAt).toLocaleDateString('fr-FR')}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-semibold text-emerald-600">+{fmtShort(ref.bonusAmount)}</p>
                            {ref.isPaid ? (
                              <Badge className="bg-emerald-100 text-emerald-700 text-[9px] px-1 py-0">Verse</Badge>
                            ) : (
                              <Badge className="bg-amber-100 text-amber-700 text-[9px] px-1 py-0">En attente</Badge>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-8">
              <Users className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm font-medium">Aucune donnee de parrainage</p>
              <p className="text-xs text-muted-foreground mt-1">Invitez vos amis pour gagner des bonus !</p>
            </div>
          )}

          {leaderboard && leaderboard.length > 0 && (
            <div className="space-y-2 pt-2">
              <p className="text-sm font-medium flex items-center gap-1.5">
                <Trophy className="size-4 text-amber-500" />
                Classement des parrains
              </p>
              <ScrollArea className="max-h-52">
                <div className="divide-y">
                  {leaderboard.map((entry) => (
                    <div key={entry.rank} className="flex items-center justify-between py-2">
                      <div className="flex items-center gap-2">
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                          entry.rank === 1 ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400' :
                          entry.rank === 2 ? 'bg-stone-100 text-stone-600 dark:bg-stone-800/40 dark:text-stone-400' :
                          entry.rank === 3 ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400' :
                          'bg-muted text-muted-foreground'
                        }`}>
                          {entry.rank}
                        </div>
                        <div>
                          <p className="text-sm font-medium">{entry.user?.name ?? 'Anonyme'}</p>
                          <p className="text-[10px] text-muted-foreground">{entry.totalReferred} filleuls</p>
                        </div>
                      </div>
                      <span className="text-sm font-semibold text-emerald-600">{fmtShort(entry.totalEarned)}</span>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// ── Main Component ───────────────────────────────────────────────────────────

export default function WalletView() {
  const { user, goBack } = useAppStore()
  const { theme, setTheme } = useTheme()
  const [activeTab, setActiveTab] = useState<TabValue>('accueil')
  const [showBalance, setShowBalance] = useState(true)
  const [mounted, setMounted] = useState(false)
  const [showNotifications, setShowNotifications] = useState(false)
  const [promoCode, setPromoCode] = useState('')
  const [copiedReferral, setCopiedReferral] = useState(false)
  const [referralInput, setReferralInput] = useState('')

  // ── Real API Data ─────────────────────────────────────────────────────────
  const userId = user?.id || 'demo'
  const { data: walletData, isLoading: walletLoading, error: walletError, refetch: refetchWallet } = useWallet(userId)
  const { data: promotions = [], isLoading: isLoadingPromotions, error: promosError, refetch: refetchPromos } = usePromotions(true)
  const { data: referralsData, isLoading: isLoadingReferrals, error: referralsError, refetch: refetchReferrals } = useReferrals(userId)
  const { data: leaderboard = [] } = useReferralLeaderboard()
  const redeemPromo = useRedeemPromotion()
  const createReferral = useCreateReferral()
  const { data: userPromotionsData, isLoading: isLoadingUserPromotions } = useUserPromotions(userId)

  // Derive balance and transactions from wallet API, with demo fallback
  const DEMO_BALANCE = 85000
  const balance = walletData?.balance ?? DEMO_BALANCE
  const txList = walletData?.recentTransactions
  const transactions: Transaction[] = (txList && txList.length > 0)
    ? txList.map(mapWalletTransaction)
    : []

  useEffect(() => { queueMicrotask(() => setMounted(true)) }, [])

  function toggleBalance() {
    setShowBalance((prev) => !prev)
  }

  function handleNavigate(tab: TabValue) {
    setActiveTab(tab)
  }

  function handleRetryAll() {
    refetchWallet()
    refetchPromos()
    refetchReferrals()
  }

  function handleRedeemPromo() {
    if (!promoCode.trim()) {
      toast.error('Veuillez entrer un code promotionnel')
      return
    }
    redeemPromo.mutate(
      { code: promoCode.trim(), userId },
      {
        onSuccess: (data) => {
          toast.success(data.message || `Code ${promoCode} active avec succes ! Economie: ${fmt(data.savings)}`)
          setPromoCode('')
        },
        onError: (err) => {
          toast.error(err.message || 'Impossible d\'activer ce code. Verifiez et reessayez.')
        },
      }
    )
  }

  function handleCopyReferralCode() {
    const code = referralsData?.referralCode
    if (!code) return
    navigator.clipboard.writeText(code).then(() => {
      setCopiedReferral(true)
      toast.success('Code copie dans le presse-papiers')
      setTimeout(() => setCopiedReferral(false), 2000)
    }).catch(() => {
      toast.info(`Votre code: ${code}`)
    })
  }

  function handleApplyReferral() {
    if (!referralInput.trim()) {
      toast.error('Veuillez entrer un code de parrainage')
      return
    }
    createReferral.mutate(
      { referrerId: userId, code: referralInput.trim() },
      {
        onSuccess: (data) => {
          toast.success(data.message || 'Code de parrainage applique avec succes !')
          setReferralInput('')
        },
        onError: (err) => {
          toast.error(err.message || 'Impossible d\'appliquer ce code. Verifiez et reessayez.')
        },
      }
    )
  }

  const tabItems: Array<{
    key: TabValue
    label: string
    icon: React.ReactNode
  }> = [
    { key: 'accueil', label: 'Accueil', icon: <Wallet className="size-5" /> },
    { key: 'recharger', label: 'Recharger', icon: <Plus className="size-5" /> },
    { key: 'envoyer', label: 'Envoyer', icon: <Send className="size-5" /> },
    { key: 'activite', label: 'Activite', icon: <Receipt className="size-5" /> },
    { key: 'statistiques', label: 'Stats', icon: <BarChart3 className="size-5" /> },
  ]

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* ── Top Navigation Bar ──────────────────────────────────────── */}
      <div className="sticky top-0 z-50 mova-glass border-b">
        <div className="max-w-2xl mx-auto flex items-center justify-between px-4 py-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={goBack}
            className="rounded-full"
          >
            <ArrowLeft className="size-5" />
          </Button>
          <h1 className="text-lg font-bold flex items-center gap-2">
            <Wallet className="size-5 text-emerald-600" />
            Mon Portefeuille
          </h1>
          {mounted && (
            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="p-2 rounded-lg hover:bg-accent transition-colors"
              aria-label="Changer de theme"
            >
              {theme === 'dark' ? <Sun className="size-4 text-amber-400" /> : <Moon className="size-4 text-slate-600" />}
            </button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full relative"
            onClick={() => setShowNotifications(true)}
          >
            <Bell className="size-5" />
            <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-red-500" />
          </Button>
        </div>
      </div>

      {/* ── Main Content ────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto pb-24">
        <div className="max-w-2xl mx-auto px-4 py-4">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              {/* Error Banners */}
              {(walletError || promosError || referralsError) && (
                <div className="space-y-2 mb-4">
                  {walletError && (
                    <Alert variant="destructive" className="border-red-200 dark:border-red-800">
                      <AlertCircle className="size-4" />
                      <AlertDescription className="flex items-center justify-between">
                        <span className="text-sm">Erreur de chargement du portefeuille: {walletError.message}</span>
                        <Button variant="outline" size="sm" className="ml-2 h-7 text-xs border-red-300 dark:border-red-700 hover:bg-red-50 dark:hover:bg-red-900/20" onClick={() => refetchWallet()}>
                          <RefreshCw className="size-3 mr-1" />
                          Reessayer
                        </Button>
                      </AlertDescription>
                    </Alert>
                  )}
                  {promosError && (
                    <Alert variant="destructive" className="border-amber-200 dark:border-amber-800">
                      <AlertCircle className="size-4" />
                      <AlertDescription className="flex items-center justify-between">
                        <span className="text-sm">Erreur de chargement des promotions</span>
                        <Button variant="outline" size="sm" className="ml-2 h-7 text-xs border-amber-300 dark:border-amber-700 hover:bg-amber-50 dark:hover:bg-amber-900/20" onClick={() => refetchPromos()}>
                          <RefreshCw className="size-3 mr-1" />
                          Reessayer
                        </Button>
                      </AlertDescription>
                    </Alert>
                  )}
                  {referralsError && (
                    <Alert variant="destructive" className="border-amber-200 dark:border-amber-800">
                      <AlertCircle className="size-4" />
                      <AlertDescription className="flex items-center justify-between">
                        <span className="text-sm">Erreur de chargement du parrainage</span>
                        <Button variant="outline" size="sm" className="ml-2 h-7 text-xs border-amber-300 dark:border-amber-700 hover:bg-amber-50 dark:hover:bg-amber-900/20" onClick={() => refetchReferrals()}>
                          <RefreshCw className="size-3 mr-1" />
                          Reessayer
                        </Button>
                      </AlertDescription>
                    </Alert>
                  )}
                  <Button variant="outline" size="sm" className="w-full" onClick={handleRetryAll}>
                    <RefreshCw className="size-3 mr-1" />
                    Recharger toutes les donnees
                  </Button>
                </div>
              )}

              {activeTab === 'accueil' && (
                <AccueilTab
                  balance={balance}
                  showBalance={showBalance}
                  toggleBalance={toggleBalance}
                  onNavigate={handleNavigate}
                  transactions={transactions}
                  isLoadingTransactions={walletLoading}
                  promotions={promotions}
                  isLoadingPromotions={isLoadingPromotions}
                  walletLoading={walletLoading}
                  promoCode={promoCode}
                  setPromoCode={setPromoCode}
                  onRedeemPromo={handleRedeemPromo}
                  redeemPending={redeemPromo.isPending}
                  referralsData={referralsData}
                  isLoadingReferrals={isLoadingReferrals}
                  copiedReferral={copiedReferral}
                  onCopyReferralCode={handleCopyReferralCode}
                  referralInput={referralInput}
                  setReferralInput={setReferralInput}
                  onApplyReferral={handleApplyReferral}
                  referralPending={createReferral.isPending}
                  userPromotionsData={userPromotionsData}
                  isLoadingUserPromotions={isLoadingUserPromotions}
                />
              )}
              {activeTab === 'recharger' && <RechargerTab balance={balance} userId={userId} />}
              {activeTab === 'envoyer' && <EnvoyerTab balance={balance} transactions={transactions} rawTransactions={walletData?.recentTransactions ?? []} userId={userId} />}
              {activeTab === 'activite' && (
                <ActiviteTab
                  transactions={transactions}
                  isLoading={walletLoading}
                />
              )}
              {activeTab === 'statistiques' && <StatistiquesTab transactions={transactions} referralsData={referralsData} isLoadingReferrals={isLoadingReferrals} leaderboard={leaderboard} />}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* ── Bottom Tab Bar ──────────────────────────────────────────── */}
      <div className="fixed bottom-0 left-0 right-0 z-50 mova-glass border-t bg-background/95 backdrop-blur-md">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-around px-2 py-1.5">
            {tabItems.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex flex-col items-center gap-0.5 py-2 px-3 rounded-xl transition-all duration-200 min-w-[56px] ${
                  activeTab === tab.key
                    ? 'text-emerald-600'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <div className="relative">
                  {tab.icon}
                  {activeTab === tab.key && (
                    <motion.div
                      layoutId="walletTabIndicator"
                      className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-5 h-0.5 rounded-full bg-emerald-600"
                      transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                    />
                  )}
                </div>
                <span className={`text-[10px] ${activeTab === tab.key ? 'font-semibold' : 'font-medium'}`}>
                  {tab.label}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Notification Panel */}
      <NotificationPanel open={showNotifications} onOpenChange={setShowNotifications} />
    </div>
  )
}
