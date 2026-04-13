'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Plus,
  Wallet,
  CreditCard,
  Smartphone,
  CheckCircle2,
  Loader2,
  ArrowRight,
  XCircle,
  Gift,
  Sparkles,
  Shield,
  Phone,
  Zap,
  Star,
} from 'lucide-react'
import { useWalletTopUp } from '@/lib/mova/api-hooks'
import { MobileMoneyPayment } from '@/components/mova/mobile-money-payment'

// ── Types ────────────────────────────────────────────────────────────────────

interface WalletTopUpProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentBalance: number
  userId?: string
  onTopUpSuccess?: (newBalance: number) => void
  defaultAmount?: number | null
}

type PaymentMethod = 'mobile_money' | 'orange_money' | 'mtn' | 'card'

type TopUpStep = 'amount' | 'method' | 'payment'

// ── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (amount: number) =>
  new Intl.NumberFormat('fr-GN').format(amount) + ' GNF'

// ── Component ────────────────────────────────────────────────────────────────

export function WalletTopUp({
  open,
  onOpenChange,
  currentBalance,
  userId = 'demo',
  onTopUpSuccess,
  defaultAmount,
}: WalletTopUpProps) {
  const [step, setStep] = useState<TopUpStep>('amount')
  const [selectedAmount, setSelectedAmount] = useState<number | null>(null)
  const [customAmount, setCustomAmount] = useState('')
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(null)

  // Mobile Money dialog state
  const [mobileMoneyOpen, setMobileMoneyOpen] = useState(false)
  const [mmProvider, setMmProvider] = useState<'orange_money' | 'mtn'>('orange_money')

  // Processing state
  const [isProcessing, setIsProcessing] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [isError, setIsError] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [successData, setSuccessData] = useState<{ newBalance: number; transactionId: string } | null>(null)

  // Refs
  const inputRef = useRef<HTMLInputElement>(null)

  // Real API mutation for card/top-up
  const walletTopUp = useWalletTopUp()

  // Reset on open
  useEffect(() => {
    if (open) {
      queueMicrotask(() => {
        setStep('amount')
        setSelectedAmount(defaultAmount ?? null)
        setCustomAmount('')
        setSelectedMethod(null)
        setIsProcessing(false)
        setIsSuccess(false)
        setIsError(false)
        setErrorMsg('')
        setSuccessData(null)
      })
    }
  }, [open, defaultAmount])

  // Quick amounts
  const quickAmounts = [
    { value: 5000, label: '5 000' },
    { value: 10000, label: '10 000' },
    { value: 25000, label: '25 000', popular: true },
    { value: 50000, label: '50 000', bonus: 2500 },
  ]

  // Payment methods
  const paymentMethods: Array<{
    id: PaymentMethod
    name: string
    description: string
    icon: React.ReactNode
    color: string
  }> = [
    {
      id: 'orange_money',
      name: 'Orange Money',
      description: 'Paiement instantane',
      icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><rect width="24" height="24" rx="6" fill="#F97316"/><text x="12" y="16" textAnchor="middle" fill="white" fontSize="9" fontWeight="bold">OM</text></svg>,
      color: 'border-orange-500 bg-orange-50 dark:bg-orange-950/30',
    },
    {
      id: 'mtn',
      name: 'MTN Mobile Money',
      description: 'Paiement instantane',
      icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><rect width="24" height="24" rx="6" fill="#F59E0B"/><text x="12" y="16" textAnchor="middle" fill="white" fontSize="9" fontWeight="bold">MTN</text></svg>,
      color: 'border-amber-500 bg-amber-50 dark:bg-amber-950/30',
    },
    {
      id: 'card',
      name: 'Carte bancaire',
      description: 'Visa, Mastercard',
      icon: <CreditCard className="size-6 text-emerald-600" />,
      color: 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30',
    },
  ]

  // Get the final amount
  const finalAmount = selectedAmount ?? (customAmount ? Number(customAmount) : 0)

  // Determine the display name of the payment method used
  const paymentMethodName = selectedMethod === 'card'
    ? 'Carte bancaire'
    : mmProvider === 'orange_money'
      ? 'Orange Money'
      : mmProvider === 'mtn'
        ? 'MTN Mobile Money'
        : 'Mobile Money'

  // Handle amount selection
  const handleSelectAmount = useCallback((value: number) => {
    setSelectedAmount(value)
    setCustomAmount('')
  }, [])

  // Handle custom amount
  const handleCustomAmount = useCallback((value: string) => {
    const num = Number(value)
    if (value === '' || (!isNaN(num) && num >= 0 && num <= 5000000)) {
      setCustomAmount(value)
      setSelectedAmount(null)
    }
  }, [])

  // Handle payment method selection
  const handleMethodSelect = useCallback((method: PaymentMethod) => {
    if (method === 'orange_money' || method === 'mtn') {
      setMmProvider(method)
      setMobileMoneyOpen(true)
    } else {
      setSelectedMethod(method)
      // Call real API for card top-up
      setIsProcessing(true)
      walletTopUp.mutate(
        { userId, amount: finalAmount, method: 'card', provider: 'card' },
        {
          onSuccess: (data) => {
            setIsProcessing(false)
            setIsSuccess(true)
            setSuccessData({ newBalance: data.newBalance, transactionId: data.transactionId })
            onTopUpSuccess?.(data.newBalance)
          },
          onError: (err) => {
            setIsProcessing(false)
            setIsError(true)
            setErrorMsg(err.message || 'Erreur lors de la recharge. Veuillez reessayer.')
          },
        }
      )
    }
  }, [finalAmount, userId, walletTopUp, onTopUpSuccess])

  // Handle mobile money success
  const handleMobileMoneySuccess = useCallback((transactionId: string) => {
    setMobileMoneyOpen(false)
    setStep('method')
    setIsSuccess(true)
    // The mobile money API handler already updates the wallet via server
    // Use current balance + amount as approximation, the wallet query will refetch
    const newBal = currentBalance + finalAmount
    setSuccessData({ newBalance: newBal, transactionId })
    onTopUpSuccess?.(newBal)
  }, [finalAmount, currentBalance, onTopUpSuccess])

  // Handle mobile money error
  const handleMobileMoneyError = useCallback((_error: string) => {
    setMobileMoneyOpen(false)
    // Don't change step - user can try again
  }, [])

  // Can proceed
  const canProceed = finalAmount >= 100

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[480px] p-0 overflow-hidden">
          {/* Header */}
          <div className="mova-gradient p-4 text-white">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-white text-lg">
                <Plus className="size-5" />
                Recharger le portefeuille
              </DialogTitle>
              <DialogDescription className="text-white/80 text-sm">
                {step === 'amount' && 'Choisissez le montant de votre recharge'}
                {step === 'method' && `Recharge de ${fmt(finalAmount)}`}
                {step === 'payment' && 'Confirmation du paiement'}
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="p-5">
            <AnimatePresence mode="wait">
              {/* ── Step 1: Choose Amount ──────────────────────────── */}
              {step === 'amount' && !isSuccess && !isError && (
                <motion.div
                  key="amount"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-4"
                >
                  {/* Current balance */}
                  <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-2">
                      <Wallet className="size-4 text-emerald-600" />
                      <span className="text-sm text-muted-foreground">Solde actuel</span>
                    </div>
                    <span className="text-sm font-semibold">{fmt(currentBalance)}</span>
                  </div>

                  {/* Promo banner */}
                  <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 p-4 text-white">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full -translate-y-8 translate-x-8" />
                    <div className="relative flex items-start gap-3">
                      <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
                        <Gift className="size-5 text-white" />
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Sparkles className="size-3.5" />
                          <span className="font-semibold text-sm">Offre speciale!</span>
                        </div>
                        <p className="text-xs text-white/90">
                          Rechargez 50 000 GNF et recevez 2 500 GNF bonus!
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Quick amounts */}
                  <div>
                    <label className="text-sm font-medium mb-2 block">Montant rapide</label>
                    <div className="grid grid-cols-2 gap-2">
                      {quickAmounts.map((item) => (
                        <button
                          key={item.value}
                          onClick={() => handleSelectAmount(item.value)}
                          className={`relative flex flex-col items-center gap-1 p-4 rounded-xl border-2 transition-all duration-200 ${
                            selectedAmount === item.value
                              ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30 shadow-lg shadow-emerald-500/10'
                              : 'border-border hover:border-emerald-300 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/10'
                          }`}
                        >
                          {item.popular && (
                            <Badge className="absolute -top-2 right-2 bg-amber-500 text-white text-[10px] px-1.5 py-0">
                              <Star className="size-2.5 mr-0.5" />
                              Populaire
                            </Badge>
                          )}
                          {item.bonus && (
                            <Badge className="absolute -top-2 right-2 bg-emerald-500 text-white text-[10px] px-1.5 py-0">
                              <Gift className="size-2.5 mr-0.5" />
                              +{fmt(item.bonus)}
                            </Badge>
                          )}
                          <span className="text-lg font-bold">
                            {item.value >= 1000
                              ? `${Math.floor(item.value / 1000)}K`
                              : item.value}{' '}
                            GNF
                          </span>
                          {item.bonus && (
                            <span className="text-[10px] text-emerald-600">
                              +{fmt(item.bonus)} bonus
                            </span>
                          )}
                          {selectedAmount === item.value && (
                            <CheckCircle2 className="size-4 text-emerald-600" />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Custom amount */}
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">Montant personnalise</label>
                    <div className="relative">
                      <Input
                        ref={inputRef}
                        type="number"
                        value={customAmount}
                        onChange={(e) => handleCustomAmount(e.target.value)}
                        placeholder="Entrez un montant"
                        className="text-lg pr-12"
                        min={100}
                        max={5000000}
                        onFocus={() => setSelectedAmount(null)}
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                        GNF
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Minimum: 100 GNF | Maximum: 5 000 000 GNF
                    </p>
                  </div>

                  {/* Summary */}
                  {finalAmount > 0 && (
                    <div className="p-3 rounded-xl bg-muted/30 flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Montant de la recharge</span>
                      <span className="font-bold text-lg mova-gradient-text">{fmt(finalAmount)}</span>
                    </div>
                  )}

                  {/* Action */}
                  <Button
                    className="w-full"
                    disabled={!canProceed}
                    onClick={() => setStep('method')}
                  >
                    Continuer
                    <ArrowRight className="size-4 ml-2" />
                  </Button>
                </motion.div>
              )}

              {/* ── Step 2: Choose Payment Method ─────────────────── */}
              {step === 'method' && !isSuccess && !isError && (
                <motion.div
                  key="method"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-4"
                >
                  {/* Amount summary */}
                  <div className="text-center py-2">
                    <p className="text-sm text-muted-foreground">Montant a recharger</p>
                    <p className="text-3xl font-bold mt-1 mova-gradient-text">{fmt(finalAmount)}</p>
                  </div>

                  {/* Payment methods */}
                  <div className="space-y-3">
                    {paymentMethods.map((method) => (
                      <button
                        key={method.id}
                        onClick={() => handleMethodSelect(method.id)}
                        disabled={isProcessing}
                        className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all duration-200 ${
                          selectedMethod === method.id
                            ? method.color + ' shadow-lg'
                            : 'border-border hover:border-muted-foreground/30 hover:bg-muted/30'
                        }`}
                      >
                        <div className="flex-shrink-0">
                          {method.icon}
                        </div>
                        <div className="flex-1 text-left">
                          <p className="font-semibold text-sm">{method.name}</p>
                          <p className="text-xs text-muted-foreground">{method.description}</p>
                        </div>
                        <div className="flex-shrink-0">
                          {selectedMethod === method.id && (
                            <CheckCircle2 className="size-5 text-emerald-600" />
                          )}
                          {(method.id === 'orange_money' || method.id === 'mtn') && (
                            <ArrowRight className="size-4 text-muted-foreground" />
                          )}
                          {method.id === 'card' && isProcessing && (
                            <Loader2 className="size-4 animate-spin text-emerald-600" />
                          )}
                        </div>
                      </button>
                    ))}
                  </div>

                  {/* Security note */}
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/30">
                    <Shield className="size-4 text-emerald-500 flex-shrink-0" />
                    <p className="text-xs text-muted-foreground">
                      Vos informations de paiement sont securisees par un cryptage de bout en bout
                    </p>
                  </div>

                  {/* Back button */}
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => setStep('amount')}
                    disabled={isProcessing}
                  >
                    Retour
                  </Button>
                </motion.div>
              )}

              {/* ── Success State ────────────────────────────────────── */}
              {isSuccess && successData && (
                <motion.div
                  key="success"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="space-y-5"
                >
                  {/* Success icon */}
                  <div className="flex flex-col items-center py-4">
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: 'spring', stiffness: 200, damping: 15 }}
                      className="w-20 h-20 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center"
                    >
                      <CheckCircle2 className="size-10 text-emerald-600" />
                    </motion.div>
                  </div>

                  <div className="text-center space-y-2">
                    <p className="font-bold text-xl text-emerald-600">Recharge reussie!</p>
                    <p className="text-sm text-muted-foreground">
                      Votre portefeuille a ete credite de {fmt(finalAmount)}
                    </p>
                  </div>

                  {/* New balance */}
                  <div className="text-center p-4 rounded-xl bg-gradient-to-r from-emerald-50 to-emerald-100 dark:from-emerald-950/30 dark:to-emerald-900/20 border border-emerald-200 dark:border-emerald-800">
                    <p className="text-xs text-muted-foreground mb-1">Nouveau solde</p>
                    <p className="text-3xl font-bold mova-gradient-text">{fmt(successData.newBalance)}</p>
                  </div>

                  {/* Transaction details */}
                  <div className="p-3 rounded-lg bg-muted/30 space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Montant recharge</span>
                      <span className="font-semibold">{fmt(finalAmount)}</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Methode</span>
                      <span className="font-medium">{paymentMethodName}</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Frais</span>
                      <span className="text-emerald-600 font-medium">Gratuit</span>
                    </div>
                  </div>

                  {/* SMS note */}
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800">
                    <Phone className="size-4 text-emerald-600 flex-shrink-0" />
                    <p className="text-xs text-emerald-700 dark:text-emerald-400">
                      Confirmation envoyee par SMS
                    </p>
                  </div>

                  <Button
                    className="w-full bg-emerald-600 hover:bg-emerald-700"
                    onClick={() => onOpenChange(false)}
                  >
                    Fermer
                  </Button>
                </motion.div>
              )}

              {/* ── Error State ──────────────────────────────────────── */}
              {isError && (
                <motion.div
                  key="error"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="space-y-5"
                >
                  <div className="flex flex-col items-center py-4">
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: 'spring', stiffness: 200, damping: 15 }}
                      className="w-20 h-20 rounded-full bg-red-100 dark:bg-red-900/40 flex items-center justify-center"
                    >
                      <XCircle className="size-10 text-red-500" />
                    </motion.div>
                  </div>

                  <div className="text-center space-y-2">
                    <p className="font-bold text-xl text-red-500">Erreur de recharge</p>
                    <p className="text-sm text-muted-foreground">{errorMsg}</p>
                  </div>

                  <div className="flex gap-3">
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => onOpenChange(false)}
                    >
                      Fermer
                    </Button>
                    <Button
                      className="flex-1"
                      onClick={() => {
                        setIsError(false)
                        setErrorMsg('')
                        setStep('method')
                      }}
                    >
                      <Zap className="size-4 mr-2" />
                      Reessayer
                    </Button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </DialogContent>
      </Dialog>

      {/* Mobile Money Payment Sub-Dialog */}
      <MobileMoneyPayment
        open={mobileMoneyOpen}
        onOpenChange={setMobileMoneyOpen}
        amount={finalAmount}
        purpose="Recharge wallet"
        userId={userId}
        onSuccess={handleMobileMoneySuccess}
        onError={handleMobileMoneyError}
      />
    </>
  )
}

export default WalletTopUp
