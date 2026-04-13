'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
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
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Phone,
  CreditCard,
  Shield,
  CheckCircle2,
  Loader2,
  ArrowRight,
  XCircle,
  Wallet,
  MessageSquare,
  Clock,
  Smartphone,
} from 'lucide-react'

// ── Types ────────────────────────────────────────────────────────────────────

type MobileMoneyProvider = 'orange_money' | 'mtn'

interface MobileMoneyPaymentProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  amount: number
  purpose: string // "Recharge wallet", "Paiement course", etc.
  userId?: string
  balance?: number
  onSuccess?: (transactionId: string) => void
  onError?: (error: string) => void
}

type PaymentStep = 'provider' | 'details' | 'processing' | 'success' | 'error'

interface PaymentResponse {
  success: boolean
  data?: {
    transactionId: string
    provider: string
    amount: number
    currency: string
    phoneNumber: string
    status: string
    message: string
    reference: string
    estimatedWaitSeconds: number
  }
  error?: string
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (amount: number) =>
  new Intl.NumberFormat('fr-GN').format(amount) + ' GNF'

const providerLabels: Record<MobileMoneyProvider, string> = {
  orange_money: 'Orange Money',
  mtn: 'MTN Mobile Money',
}

// ── Component ────────────────────────────────────────────────────────────────

export function MobileMoneyPayment({
  open,
  onOpenChange,
  amount,
  purpose,
  userId = 'demo',
  balance,
  onSuccess,
  onError,
}: MobileMoneyPaymentProps) {
  const [step, setStep] = useState<PaymentStep>('provider')
  const [selectedProvider, setSelectedProvider] = useState<MobileMoneyProvider | null>(null)
  const [phoneNumber, setPhoneNumber] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [countdown, setCountdown] = useState(30)
  const [progress, setProgress] = useState(0)

  // Result state
  const [transactionId, setTransactionId] = useState('')
  const [reference, setReference] = useState('')
  const [newBalance, setNewBalance] = useState(0)
  const [errorMessage, setErrorMessage] = useState('')

  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const processingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const progressCleanupRef = useRef<(() => void) | null>(null)

  // Reset on open
  useEffect(() => {
    if (open) {
      setStep('provider')
      setSelectedProvider(null)
      setPhoneNumber('')
      setIsSubmitting(false)
      setCountdown(30)
      setProgress(0)
      setTransactionId('')
      setReference('')
      setNewBalance(0)
      setErrorMessage('')
      cleanup()
    } else {
      cleanup()
    }
    return cleanup
  }, [open])

  const cleanup = useCallback(() => {
    if (countdownRef.current) clearInterval(countdownRef.current)
    if (pollingRef.current) clearInterval(pollingRef.current)
    if (processingTimerRef.current) clearTimeout(processingTimerRef.current)
    if (progressCleanupRef.current) {
      progressCleanupRef.current()
      progressCleanupRef.current = null
    }
    countdownRef.current = null
    pollingRef.current = null
    processingTimerRef.current = null
  }, [])

  // Format phone number as user types
  const formatPhoneNumber = useCallback((value: string) => {
    // Remove non-digit characters except +
    let cleaned = value.replace(/[^\d+]/g, '')

    // If user types without +224 prefix, add it
    if (!cleaned.startsWith('+224')) {
      cleaned = '+224 ' + cleaned.replace(/^224/, '')
    }

    // Format: +224 6XX XX XX XX
    const digits = cleaned.replace(/\D/g, '')
    if (digits.length > 12) {
      cleaned = cleaned.slice(0, 15) // +224 XXX XX XX XX = 15 chars
    }

    return cleaned
  }, [])

  // Start countdown timer
  const startCountdown = useCallback(() => {
    setCountdown(30)
    countdownRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          if (countdownRef.current) clearInterval(countdownRef.current)
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }, [])

  // Simulate progress bar
  const startProgress = useCallback(() => {
    setProgress(0)
    const duration = 4000 // 4 seconds
    const interval = 100
    const steps = duration / interval
    let current = 0

    const timer = setInterval(() => {
      current++
      const newProgress = Math.min(Math.round((current / steps) * 90), 90) // Max 90% until confirmed
      setProgress(newProgress)
      if (current >= steps) {
        clearInterval(timer)
      }
    }, interval)

    return () => clearInterval(timer)
  }, [])

  // Poll for payment status
  const startPolling = useCallback((txnId: string) => {
    let attempts = 0
    const maxAttempts = 60 // 30 seconds

    pollingRef.current = setInterval(async () => {
      attempts++
      if (attempts > maxAttempts) {
        if (pollingRef.current) clearInterval(pollingRef.current)
        setStep('error')
        setErrorMessage('Delai de paiement depasse. Veuillez reessayer.')
        onError?.('Delai de paiement depasse')
        return
      }

      try {
        const token = typeof window !== 'undefined' ? localStorage.getItem('mova_token') : null
        const res = await fetch(`/api/mova/wallet/mobile-money/status?transactionId=${txnId}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        })
        const data: PaymentResponse = await res.json()

        if (data.success && data.data) {
          if (data.data.status === 'completed') {
            if (pollingRef.current) clearInterval(pollingRef.current)
            if (countdownRef.current) clearInterval(countdownRef.current)
            setProgress(100)
            setStep('success')
            // Safely extract newBalance from the response, falling back to estimated balance
            const raw = data.data as Record<string, unknown>
            const extractedBalance = typeof raw?.newBalance === 'number' ? (raw.newBalance as number) : amount
            setNewBalance(extractedBalance)
            onSuccess?.(txnId)
          } else if (data.data.status === 'failed') {
            if (pollingRef.current) clearInterval(pollingRef.current)
            if (countdownRef.current) clearInterval(countdownRef.current)
            setStep('error')
            setErrorMessage('Le paiement a echoue. Veuillez verifier votre solde et reessayer.')
            onError?.('Paiement echoue')
          }
        }
      } catch {
        // Continue polling silently
      }
    }, 500)
  }, [amount, onError, onSuccess])

  // Submit payment
  const handleSubmitPayment = useCallback(async () => {
    if (!selectedProvider || !phoneNumber) return

    // Validate phone number
    const phoneRegex = /^\+224\s?[67]\d{2}\s?\d{2}\s?\d{2}\s?\d{2}$/
    if (!phoneRegex.test(phoneNumber)) {
      onError?.('Format de numero invalide. Utilisez +224 6XX XX XX XX ou +224 7XX XX XX XX')
      return
    }

    setIsSubmitting(true)

    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('mova_token') : null
      const res = await fetch('/api/mova/wallet/mobile-money', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({
          userId,
          amount,
          provider: selectedProvider,
          phoneNumber,
          purpose,
        }),
      })

      const data: PaymentResponse = await res.json()

      if (data.success && data.data) {
        setTransactionId(data.data.transactionId)
        setReference(data.data.reference)
        setStep('processing')
        startCountdown()
        progressCleanupRef.current = startProgress()
        startPolling(data.data.transactionId)
      } else {
        setStep('error')
        setErrorMessage(data.error || 'Erreur lors de l\'initiation du paiement')
        onError?.(data.error || 'Erreur inconnue')
      }
    } catch {
      setStep('error')
      setErrorMessage('Erreur de connexion. Veuillez verifier votre reseau et reessayer.')
      onError?.('Erreur de connexion')
    } finally {
      setIsSubmitting(false)
    }
  }, [selectedProvider, phoneNumber, amount, purpose, userId, startCountdown, startProgress, startPolling, onError])

  // Phone number change handler
  const handlePhoneChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhoneNumber(e.target.value)
    setPhoneNumber(formatted)
  }, [formatPhoneNumber])

  // Step titles
  const stepTitles: Record<PaymentStep, string> = {
    provider: 'Choisir un operateur',
    details: 'Details du paiement',
    processing: 'Traitement en cours',
    success: 'Paiement reussi',
    error: 'Erreur de paiement',
  }

  const isOrange = selectedProvider === 'orange_money'
  const brandColor = isOrange
    ? 'text-orange-500'
    : 'text-amber-500'
  const brandBg = isOrange
    ? 'bg-orange-500'
    : 'bg-amber-500'
  const brandBgLight = isOrange
    ? 'bg-orange-50 dark:bg-orange-950/30'
    : 'bg-amber-50 dark:bg-amber-950/30'
  const brandBorder = isOrange
    ? 'border-orange-200 dark:border-orange-800'
    : 'border-amber-200 dark:border-amber-800'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px] p-0 overflow-hidden">
        {/* Header with brand color accent */}
        <div className={`${isOrange ? 'bg-gradient-to-r from-orange-500 to-orange-600' : selectedProvider ? 'bg-gradient-to-r from-amber-500 to-amber-600' : 'mova-gradient'} p-4 text-white`}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-white text-lg">
              {step === 'provider' && <CreditCard className="size-5" />}
              {step === 'details' && <Phone className="size-5" />}
              {step === 'processing' && <Loader2 className="size-5 animate-spin" />}
              {step === 'success' && <CheckCircle2 className="size-5" />}
              {step === 'error' && <XCircle className="size-5" />}
              {stepTitles[step]}
            </DialogTitle>
            <DialogDescription className="text-white/80 text-sm">
              {step === 'provider' && 'Selectionnez votre operateur Mobile Money'}
              {step === 'details' && `${purpose} - ${fmt(amount)}`}
              {step === 'processing' && 'Veuillez confirmer le paiement sur votre telephone'}
              {step === 'success' && 'Votre paiement a ete effectue avec succes'}
              {step === 'error' && 'Une erreur est survenue lors du paiement'}
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="p-5">
          <AnimatePresence mode="wait">
            {/* ── Step 1: Choose Provider ───────────────────────────── */}
            {step === 'provider' && (
              <motion.div
                key="provider"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-4"
              >
                {/* Balance display */}
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-2">
                    <Wallet className="size-4 text-emerald-600" />
                    <span className="text-sm text-muted-foreground">Solde actuel</span>
                  </div>
                  <span className="text-sm font-semibold">{balance != null ? fmt(balance) : '—'}</span>
                </div>

                <div className="text-center py-2">
                  <p className="text-sm text-muted-foreground">Montant a payer</p>
                  <p className="text-3xl font-bold mt-1 mova-gradient-text">{fmt(amount)}</p>
                </div>

                {/* Provider cards */}
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setSelectedProvider('orange_money')}
                    className={`relative flex flex-col items-center gap-3 p-5 rounded-xl border-2 transition-all duration-200 ${
                      selectedProvider === 'orange_money'
                        ? 'border-orange-500 bg-orange-50 dark:bg-orange-950/30 shadow-lg shadow-orange-500/10'
                        : 'border-border hover:border-orange-300 hover:bg-orange-50/50 dark:hover:bg-orange-950/10'
                    }`}
                  >
                    <div className={`w-14 h-14 rounded-full ${selectedProvider === 'orange_money' ? 'bg-orange-500' : 'bg-orange-100 dark:bg-orange-900/40'} flex items-center justify-center transition-colors`}>
                      <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                        <rect width="28" height="28" rx="8" fill={selectedProvider === 'orange_money' ? 'white' : '#F97316'} />
                        <text x="14" y="19" textAnchor="middle" fill={selectedProvider === 'orange_money' ? '#F97316' : 'white'} fontSize="12" fontWeight="bold">OM</text>
                      </svg>
                    </div>
                    <div className="text-center">
                      <p className="font-semibold text-sm">Orange Money</p>
                      <p className="text-xs text-muted-foreground mt-0.5">+224 6XX</p>
                    </div>
                    {selectedProvider === 'orange_money' && (
                      <Badge className="absolute top-2 right-2 bg-orange-500 text-white text-[10px] px-1.5 py-0">
                        Selectionne
                      </Badge>
                    )}
                  </button>

                  <button
                    onClick={() => setSelectedProvider('mtn')}
                    className={`relative flex flex-col items-center gap-3 p-5 rounded-xl border-2 transition-all duration-200 ${
                      selectedProvider === 'mtn'
                        ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/30 shadow-lg shadow-amber-500/10'
                        : 'border-border hover:border-amber-300 hover:bg-amber-50/50 dark:hover:bg-amber-950/10'
                    }`}
                  >
                    <div className={`w-14 h-14 rounded-full ${selectedProvider === 'mtn' ? 'bg-amber-500' : 'bg-amber-100 dark:bg-amber-900/40'} flex items-center justify-center transition-colors`}>
                      <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                        <rect width="28" height="28" rx="8" fill={selectedProvider === 'mtn' ? 'white' : '#F59E0B'} />
                        <text x="14" y="19" textAnchor="middle" fill={selectedProvider === 'mtn' ? '#F59E0B' : 'white'} fontSize="12" fontWeight="bold">MTN</text>
                      </svg>
                    </div>
                    <div className="text-center">
                      <p className="font-semibold text-sm">MTN MoMo</p>
                      <p className="text-xs text-muted-foreground mt-0.5">+224 7XX</p>
                    </div>
                    {selectedProvider === 'mtn' && (
                      <Badge className="absolute top-2 right-2 bg-amber-500 text-white text-[10px] px-1.5 py-0">
                        Selectionne
                      </Badge>
                    )}
                  </button>
                </div>

                <Button
                  className="w-full"
                  disabled={!selectedProvider}
                  onClick={() => setStep('details')}
                >
                  Continuer
                  <ArrowRight className="size-4 ml-2" />
                </Button>
              </motion.div>
            )}

            {/* ── Step 2: Enter Details ────────────────────────────── */}
            {step === 'details' && (
              <motion.div
                key="details"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-4"
              >
                {/* Provider summary */}
                <div className={`flex items-center gap-3 p-3 rounded-xl ${brandBgLight} ${brandBorder} border`}>
                  <div className={`w-10 h-10 rounded-full ${brandBg} flex items-center justify-center`}>
                    <CreditCard className="size-5 text-white" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm">{providerLabels[selectedProvider!]}</p>
                    <p className="text-xs text-muted-foreground">Operateur Mobile Money</p>
                  </div>
                </div>

                {/* Phone number */}
                <div>
                  <label className="text-sm font-medium mb-1.5 block">
                    Numero de telephone
                  </label>
                  <div className="relative">
                    <Phone className={`absolute left-3 top-1/2 -translate-y-1/2 size-4 ${brandColor}`} />
                    <Input
                      type="tel"
                      value={phoneNumber}
                      onChange={handlePhoneChange}
                      placeholder="+224 6XX XX XX XX"
                      className="pl-10 text-base"
                      maxLength={15}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1.5 flex items-center gap-1">
                    <Shield className="size-3 text-emerald-500" />
                    Votre numero est securise et ne sera jamais partage
                  </p>
                </div>

                {/* Amount display */}
                <div className="p-4 rounded-xl bg-muted/50 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Montant</span>
                    <span className="font-semibold">{fmt(amount)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Frais</span>
                    <span className="text-emerald-600 font-medium">Gratuit</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between">
                    <span className="font-medium">Total</span>
                    <span className="font-bold text-lg mova-gradient-text">{fmt(amount)}</span>
                  </div>
                </div>

                {/* Purpose */}
                <div className="flex items-center gap-2 text-sm text-muted-foreground p-2 rounded-lg bg-muted/30">
                  <MessageSquare className="size-4" />
                  <span>Objet: {purpose}</span>
                </div>

                {/* Actions */}
                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => setStep('provider')}
                  >
                    Retour
                  </Button>
                  <Button
                    className="flex-1"
                    disabled={!phoneNumber || phoneNumber.length < 15 || isSubmitting}
                    onClick={handleSubmitPayment}
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="size-4 mr-2 animate-spin" />
                        Traitement...
                      </>
                    ) : (
                      <>
                        Confirmer
                        <ArrowRight className="size-4 ml-2" />
                      </>
                    )}
                  </Button>
                </div>
              </motion.div>
            )}

            {/* ── Step 3: Processing ────────────────────────────────── */}
            {step === 'processing' && (
              <motion.div
                key="processing"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-5"
              >
                {/* Animated spinner with brand colors */}
                <div className="flex flex-col items-center py-4">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                    className={`w-20 h-20 rounded-full ${brandBgLight} border-4 ${brandBorder} flex items-center justify-center`}
                  >
                    <motion.div
                      animate={{ scale: [1, 1.1, 1] }}
                      transition={{ duration: 1.5, repeat: Infinity }}
                      className={`w-14 h-14 rounded-full ${brandBg} flex items-center justify-center`}
                    >
                      <Smartphone className="size-7 text-white" />
                    </motion.div>
                  </motion.div>
                </div>

                {/* Status message */}
                <div className="text-center space-y-2">
                  <p className="font-semibold text-lg">Confirmation en attente</p>
                  <p className="text-sm text-muted-foreground">
                    Veuillez confirmer le paiement sur votre telephone
                  </p>
                  <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                    <Clock className="size-3" />
                    Temps restant: {countdown}s
                  </p>
                </div>

                {/* Progress bar */}
                <div className="space-y-2">
                  <Progress value={progress} className="h-2" />
                  <p className="text-xs text-muted-foreground text-center">
                    {progress < 30 ? 'Connexion a l\'operateur...' : progress < 60 ? 'Envoi de la demande...' : progress < 90 ? 'En attente de confirmation...' : 'Validation...'}
                  </p>
                </div>

                {/* Transaction details */}
                <div className="p-3 rounded-lg bg-muted/30 space-y-1.5 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Reference</span>
                    <span className="font-mono text-xs">{reference}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Montant</span>
                    <span className="font-semibold">{fmt(amount)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Operateur</span>
                    <span className="font-medium">{providerLabels[selectedProvider!]}</span>
                  </div>
                </div>

                {/* Cancel button */}
                <Button
                  variant="ghost"
                  className="w-full text-muted-foreground"
                  onClick={() => {
                    cleanup()
                    setStep('provider')
                  }}
                >
                  Annuler le paiement
                </Button>
              </motion.div>
            )}

            {/* ── Step 4: Success ───────────────────────────────────── */}
            {step === 'success' && (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="space-y-5"
              >
                {/* Success animation */}
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
                  <p className="font-bold text-xl text-emerald-600">Paiement reussi!</p>
                  <p className="text-sm text-muted-foreground">
                    Votre paiement de {fmt(amount)} a ete effectue avec succes
                  </p>
                </div>

                {/* Receipt */}
                <div className="border rounded-xl overflow-hidden">
                  <div className="bg-muted/50 px-4 py-2">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Recu de paiement
                    </p>
                  </div>
                  <div className="p-4 space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">ID Transaction</span>
                      <span className="font-mono text-xs">{transactionId.slice(0, 20)}...</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Reference</span>
                      <span className="font-mono text-xs">{reference}</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Montant</span>
                      <span className="font-bold text-emerald-600">{fmt(amount)}</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Operateur</span>
                      <span className="font-medium">{selectedProvider ? providerLabels[selectedProvider] : 'N/A'}</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Nouveau solde</span>
                      <span className="font-bold text-lg mova-gradient-text">{fmt(newBalance)}</span>
                    </div>
                  </div>
                </div>

                {/* SMS notification note */}
                <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800">
                  <MessageSquare className="size-4 text-emerald-600 flex-shrink-0" />
                  <p className="text-xs text-emerald-700 dark:text-emerald-400">
                    Reçu envoye par SMS a votre numero de telephone
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

            {/* ── Step 5: Error ─────────────────────────────────────── */}
            {step === 'error' && (
              <motion.div
                key="error"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="space-y-5"
              >
                {/* Error animation */}
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
                  <p className="font-bold text-xl text-red-500">Paiement echoue</p>
                  <p className="text-sm text-muted-foreground">{errorMessage}</p>
                </div>

                <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                  <p className="text-xs text-amber-700 dark:text-amber-400">
                    <strong>Conseil:</strong> Verifiez que vous avez suffisamment de solde sur votre compte Mobile Money et que votre numero est correct.
                  </p>
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
                      setStep('provider')
                      setErrorMessage('')
                    }}
                  >
                    Reessayer
                    <ArrowRight className="size-4 ml-2" />
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default MobileMoneyPayment
