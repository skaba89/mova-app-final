'use client'

import { useState, useCallback } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { X, Phone, Loader2, Check, ArrowRight, RefreshCw } from 'lucide-react'

interface MobileMoneyTopupProps {
  userId: string
  userPhone?: string | null
  onSuccess: () => void
  onClose: () => void
}

const PRESET_AMOUNTS = [5000, 10000, 25000, 50000, 100000]

const PROVIDERS = [
  { id: 'orange_money', name: 'Orange Money', color: 'bg-orange-500', textColor: 'text-white', shortName: 'OM' },
  { id: 'mtn_momo', name: 'MTN MoMo', color: 'bg-amber-400', textColor: 'text-gray-900', shortName: 'MTN' },
] as const

type Step = 'amount' | 'confirm' | 'processing' | 'success' | 'error'

export default function MobileMoneyTopup({ userId, userPhone, onSuccess, onClose }: MobileMoneyTopupProps) {
  const [step, setStep] = useState<Step>('amount')
  const [amount, setAmount] = useState(0)
  const [customAmount, setCustomAmount] = useState('')
  const [provider, setProvider] = useState<'orange_money' | 'mtn_momo'>('orange_money')
  const [phone, setPhone] = useState(userPhone || '')
  const [transactionId, setTransactionId] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState('')

  const selectedProvider = PROVIDERS.find((p) => p.id === provider)!

  const handleAmountSelect = (value: number) => {
    setAmount(value)
    setCustomAmount('')
  }

  const handleConfirm = useCallback(async () => {
    if (amount < 100) {
      toast.error('Le montant minimum est de 100 GNF')
      return
    }
    setStep('confirm')
  }, [amount])

  const handlePay = useCallback(async () => {
    setStep('processing')
    setErrorMessage('')

    try {
      // Initiate payment
      const res = await fetch('/api/mova/wallet/mobile-money', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, amount, provider, phone: phone || 'demo' }),
      })
      const data = await res.json()

      if (!res.ok) {
        setErrorMessage(data.error || 'Erreur lors du paiement')
        setStep('error')
        return
      }

      setTransactionId(data.transactionId)

      // Poll for status
      const maxAttempts = 30 // 30 seconds max
      for (let i = 0; i < maxAttempts; i++) {
        await new Promise((r) => setTimeout(r, 1000))

        const statusRes = await fetch(`/api/mova/wallet/mobile-money/status?transactionId=${data.transactionId}`)
        const statusData = await statusRes.json()

        if (statusData.success && statusData.status === 'completed') {
          setStep('success')
          toast.success('Rechargement réussi !', {
            description: `${new Intl.NumberFormat('fr-GN').format(amount)} GNF ajoutés à votre wallet`,
          })
          setTimeout(() => onSuccess(), 1500)
          return
        }

        if (statusData.status === 'failed') {
          setErrorMessage(statusData.error || 'Paiement échoué')
          setStep('error')
          return
        }
      }

      // Timeout
      setErrorMessage('Le délai de paiement a expiré. Vérifiez votre solde et réessayez.')
      setStep('error')
    } catch {
      setErrorMessage('Erreur de connexion. Veuillez réessayer.')
      setStep('error')
    }
  }, [userId, amount, provider, phone, onSuccess])

  const handleRetry = () => {
    setStep('amount')
    setErrorMessage('')
    setTransactionId(null)
  }

  const handleClose = () => {
    setStep('amount')
    setAmount(0)
    setErrorMessage('')
    setTransactionId(null)
    onClose()
  }

  const formatGNF = (n: number) => new Intl.NumberFormat('fr-GN').format(n)

  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={handleClose} />
      <div className="relative bg-background rounded-t-3xl sm:rounded-3xl w-full max-w-md max-h-[90vh] overflow-y-auto mova-scrollbar transition-all duration-300">
        {/* Amount Step */}
        {step === 'amount' && (
          <div className="p-6 space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-foreground">Mobile Money</h3>
                <p className="text-xs text-muted-foreground">Recharger avec Orange Money ou MTN MoMo</p>
              </div>
              <Button variant="ghost" size="icon" className="rounded-full" onClick={handleClose}>
                <X className="h-5 w-5" />
              </Button>
            </div>

            {/* Provider Selector */}
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Opérateur</p>
              <div className="grid grid-cols-2 gap-2">
                {PROVIDERS.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setProvider(p.id)}
                    className={`p-4 rounded-xl text-center transition-all duration-200 border-2 ${
                      provider === p.id
                        ? 'border-emerald-500 ring-2 ring-emerald-200 dark:ring-emerald-800'
                        : 'border-border hover:border-muted-foreground'
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-lg ${p.color} flex items-center justify-center mx-auto mb-2`}>
                      <Phone className="w-5 h-5" />
                    </div>
                    <p className={`text-sm font-semibold ${provider === p.id ? 'text-foreground' : 'text-muted-foreground'}`}>
                      {p.shortName}
                    </p>
                    <p className="text-[10px] text-muted-foreground">{p.name}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Phone */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Numéro Mobile Money</label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="+224 6XX XX XX XX"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="h-11 pl-10 text-sm"
                />
              </div>
            </div>

            {/* Amount Presets */}
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Montant (GNF)</p>
              <div className="grid grid-cols-3 gap-2">
                {PRESET_AMOUNTS.map((val) => (
                  <button
                    key={val}
                    onClick={() => handleAmountSelect(val)}
                    className={`p-3 rounded-xl text-center transition-all duration-200 border-2 ${
                      amount === val
                        ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/20 ring-1 ring-emerald-300 dark:ring-emerald-700'
                        : 'border-border hover:border-muted-foreground bg-muted/30'
                    }`}
                  >
                    <p className={`text-sm font-bold ${amount === val ? 'text-emerald-700 dark:text-emerald-300' : 'text-foreground'}`}>
                      {formatGNF(val)}
                    </p>
                  </button>
                ))}
              </div>
              <Input
                placeholder="Autre montant..."
                value={customAmount}
                onChange={(e) => {
                  setCustomAmount(e.target.value)
                  const num = parseInt(e.target.value)
                  if (!isNaN(num) && num > 0) setAmount(num)
                }}
                className="h-10 text-sm"
              />
            </div>

            {/* Continue Button */}
            <Button
              className="w-full mova-gradient text-white font-semibold h-12 shadow-lg"
              onClick={handleConfirm}
              disabled={amount < 100 || !phone}
            >
              Continuer <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        )}

        {/* Confirm Step */}
        {step === 'confirm' && (
          <div className="p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-foreground">Confirmer</h3>
              <Button variant="ghost" size="icon" className="rounded-full" onClick={handleClose}>
                <X className="h-5 w-5" />
              </Button>
            </div>

            <Card className="border-2 border-dashed">
              <CardContent className="p-5 text-center space-y-3">
                <div className={`w-14 h-14 rounded-xl ${selectedProvider.color} flex items-center justify-center mx-auto`}>
                  <Phone className="w-7 h-7" />
                </div>
                <p className="text-sm font-semibold text-foreground">{selectedProvider.name}</p>
                <p className="text-xs text-muted-foreground">{phone}</p>
                <div className="h-px bg-border mx-auto w-32" />
                <p className="text-3xl font-black text-foreground">{formatGNF(amount)}</p>
                <p className="text-xs text-muted-foreground">Francs Guinéens</p>
              </CardContent>
            </Card>

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1 h-11" onClick={() => setStep('amount')}>
                Modifier
              </Button>
              <Button
                className="flex-[2] mova-gradient text-white font-semibold h-11 shadow-md"
                onClick={handlePay}
              >
                Payer maintenant
              </Button>
            </div>
          </div>
        )}

        {/* Processing */}
        {step === 'processing' && (
          <div className="p-8 flex flex-col items-center justify-center py-12 space-y-6">
            <div className="relative">
              <div className="w-16 h-16 rounded-full border-4 border-emerald-200 dark:border-emerald-800 border-t-emerald-500 animate-spin" />
              <Phone className="w-6 h-6 text-emerald-500 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
            </div>
            <div className="text-center space-y-1">
              <p className="font-semibold text-foreground">Traitement en cours...</p>
              <p className="text-xs text-muted-foreground">Veuillez confirmer sur votre téléphone</p>
            </div>
            <p className="text-[10px] text-muted-foreground">Transaction : {transactionId?.slice(0, 8)}...</p>
          </div>
        )}

        {/* Success */}
        {step === 'success' && (
          <div className="p-8 flex flex-col items-center justify-center py-12 space-y-5 animate-[mova-view-enter_0.3s_ease-out_both]">
            <div className="w-20 h-20 rounded-full mova-gradient flex items-center justify-center shadow-lg shadow-emerald-500/30">
              <Check className="w-10 h-10 text-white" strokeWidth={3} />
            </div>
            <div className="text-center">
              <h3 className="text-xl font-bold text-foreground">Rechargement réussi !</h3>
              <p className="text-2xl font-black text-emerald-600 mt-2">{formatGNF(amount)} GNF</p>
              <p className="text-xs text-muted-foreground mt-1">ajoutés à votre wallet</p>
            </div>
            <Button className="w-full h-11" onClick={handleClose}>
              Fermer
            </Button>
          </div>
        )}

        {/* Error */}
        {step === 'error' && (
          <div className="p-8 flex flex-col items-center justify-center py-12 space-y-5">
            <div className="w-20 h-20 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
              <X className="w-10 h-10 text-red-500" />
            </div>
            <div className="text-center">
              <h3 className="text-lg font-bold text-foreground">Échec du paiement</h3>
              <p className="text-sm text-red-600 dark:text-red-400 mt-2">{errorMessage}</p>
            </div>
            <div className="flex gap-2 w-full">
              <Button variant="outline" className="flex-1 h-11" onClick={handleClose}>
                Fermer
              </Button>
              <Button className="flex-1 h-11 bg-red-500 hover:bg-red-600 text-white" onClick={handleRetry}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Réessayer
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
