'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Phone, Shield, ArrowLeft, Check, Loader2, RefreshCw } from 'lucide-react'

interface OtpVerificationProps {
  phone: string
  purpose: 'register' | 'login' | 'reset'
  onVerified: () => void
  onBack: () => void
}

const OTP_LENGTH = 6
const RESEND_COOLDOWN = 60
const CODE_EXPIRY = 300 // 5 minutes

export default function OtpVerification({ phone, purpose, onVerified, onBack }: OtpVerificationProps) {
  const [codes, setCodes] = useState<string[]>(Array(OTP_LENGTH).fill(''))
  const [isSending, setIsSending] = useState(true)
  const [isVerifying, setIsVerifying] = useState(false)
  const [isVerified, setIsVerified] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [resendTimer, setResendTimer] = useState(0)
  const [attemptCount, setAttemptCount] = useState(0)

  const inputRefs = useRef<(HTMLInputElement | null)[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Send OTP on mount
  useEffect(() => {
    sendOtp()
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [])

  // Resend cooldown timer
  useEffect(() => {
    if (resendTimer <= 0) {
      if (timerRef.current) clearInterval(timerRef.current)
      return
    }
    timerRef.current = setInterval(() => {
      setResendTimer((prev) => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current)
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [resendTimer])

  const sendOtp = useCallback(async () => {
    setIsSending(true)
    setError(null)
    setResendTimer(RESEND_COOLDOWN)

    try {
      const res = await fetch('/api/mova/auth/otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, purpose }),
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Erreur lors de l\'envoi du code')
        return
      }

      if (data.demoCode) {
        toast.info(`Code de démonstration : ${data.demoCode}`, {
          description: 'En production, ce code sera envoyé par SMS',
          duration: 8000,
        })
      }

      toast.success('Code envoyé par SMS !')
      setCodes(Array(OTP_LENGTH).fill(''))
      setAttemptCount(0)
      // Focus first input
      setTimeout(() => inputRefs.current[0]?.focus(), 100)
    } catch {
      setError('Erreur de connexion. Veuillez réessayer.')
    } finally {
      setIsSending(false)
    }
  }, [phone, purpose])

  const handleInputChange = useCallback((index: number, value: string) => {
    // Only accept digits
    if (value && !/^\d$/.test(value)) return

    const newCodes = [...codes]
    newCodes[index] = value
    setCodes(newCodes)

    // Auto-focus next input
    if (value && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus()
    }

    // Auto-verify when all 6 digits entered
    const fullCode = newCodes.join('')
    if (fullCode.length === OTP_LENGTH && newCodes.every((c) => c !== '')) {
      verifyOtp(fullCode)
    }
  }, [codes])

  const handleKeyDown = useCallback((index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !codes[index] && index > 0) {
      inputRefs.current[index - 1]?.focus()
    }
  }, [codes])

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, OTP_LENGTH)
    if (pasted.length > 0) {
      const newCodes = Array(OTP_LENGTH).fill('')
      pasted.split('').forEach((digit, i) => {
        newCodes[i] = digit
      })
      setCodes(newCodes)
      inputRefs.current[Math.min(pasted.length, OTP_LENGTH - 1)]?.focus()

      if (pasted.length === OTP_LENGTH) {
        verifyOtp(pasted)
      }
    }
  }, [])

  const verifyOtp = useCallback(async (code: string) => {
    setIsVerifying(true)
    setError(null)

    try {
      const res = await fetch('/api/mova/auth/otp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, code, purpose }),
      })
      const data = await res.json()

      if (!res.ok || !data.success) {
        setError(data.error || 'Code invalide')
        setAttemptCount((prev) => prev + 1)

        if (data.attemptsRemaining !== undefined && data.attemptsRemaining <= 0) {
          setError('Trop de tentatives. Veuillez demander un nouveau code.')
        }
        // Shake animation via CSS
        return
      }

      setIsVerified(true)
      toast.success('✅ Numéro vérifié avec succès !')
      setTimeout(() => onVerified(), 1000)
    } catch {
      setError('Erreur de connexion. Veuillez réessayer.')
    } finally {
      setIsVerifying(false)
    }
  }, [phone, purpose, onVerified])

  const formatPhone = (p: string) => {
    if (p.startsWith('+')) return p.replace(/(\d{3})(\d{2})(\d{2})(\d{2})/, '$1 $2 $3 $4')
    return p
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <div className="max-w-md mx-auto w-full flex-1 flex flex-col justify-center px-4 py-8">
        {/* Success State */}
        {isVerified ? (
          <div className="text-center space-y-6 animate-[mova-view-enter_0.3s_ease-out_both]">
            <div className="mx-auto w-20 h-20 rounded-full mova-gradient flex items-center justify-center shadow-lg shadow-emerald-500/30">
              <Check className="w-10 h-10 text-white" strokeWidth={3} />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-foreground">Numéro vérifié !</h2>
              <p className="text-sm text-muted-foreground mt-2">
                {formatPhone(phone)} est confirmé
              </p>
            </div>
            <div className="h-1 w-16 bg-emerald-200 dark:bg-emerald-800 rounded-full mx-auto" />
          </div>
        ) : (
          <div className="space-y-8">
            {/* Header */}
            <div className="text-center space-y-4">
              <div className="mx-auto w-16 h-16 rounded-2xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                <Shield className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-foreground">Vérification</h2>
                <p className="text-sm text-muted-foreground mt-2">
                  Entrez le code envoyé au{' '}
                  <span className="font-semibold text-foreground">{formatPhone(phone)}</span>
                </p>
              </div>
            </div>

            {/* OTP Inputs */}
            <div className="flex justify-center gap-3">
              {codes.map((code, index) => (
                <input
                  key={index}
                  ref={(el) => { inputRefs.current[index] = el }}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={code}
                  onChange={(e) => handleInputChange(index, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(index, e)}
                  onPaste={index === 0 ? handlePaste : undefined}
                  disabled={isSending || isVerifying}
                  className={`w-12 h-14 text-center text-xl font-bold rounded-xl border-2 transition-all duration-200 outline-none
                    ${error
                      ? 'border-red-400 bg-red-50 dark:bg-red-950/20'
                      : isVerifying
                        ? 'border-emerald-400 bg-emerald-50 dark:bg-emerald-950/20'
                        : code
                          ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/20 ring-2 ring-emerald-200 dark:ring-emerald-800'
                          : 'border-border bg-muted/50 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 dark:focus:ring-emerald-800'
                    }`}
                  aria-label={`Chiffre ${index + 1}`}
                />
              ))}
            </div>

            {/* Error */}
            {error && (
              <div className="text-center">
                <p className="text-sm text-red-600 dark:text-red-400 font-medium">{error}</p>
                {attemptCount > 0 && attemptCount < 5 && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {5 - attemptCount} tentative{5 - attemptCount > 1 ? 's' : ''} restante{5 - attemptCount > 1 ? 's' : ''}
                  </p>
                )}
              </div>
            )}

            {/* Loading */}
            {(isSending || isVerifying) && !error && (
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="w-6 h-6 animate-spin text-emerald-500" />
                <p className="text-sm text-muted-foreground">
                  {isSending ? 'Envoi du code...' : 'Vérification en cours...'}
                </p>
              </div>
            )}

            {/* Resend */}
            {!isSending && !isVerifying && !error && (
              <div className="text-center">
                {resendTimer > 0 ? (
                  <p className="text-xs text-muted-foreground">
                    Renvoyer dans <span className="font-semibold text-foreground">{resendTimer}s</span>
                  </p>
                ) : (
                  <button
                    onClick={sendOtp}
                    className="text-sm font-medium text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5 mx-auto"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Renvoyer le code
                  </button>
                )}
              </div>
            )}

            {/* Info */}
            <Card className="bg-muted/30 border-dashed">
              <CardContent className="p-4 flex items-start gap-3">
                <Phone className="w-5 h-5 text-muted-foreground mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs font-medium text-foreground">Aide</p>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Le code est valable 5 minutes. En mode démonstration, utilisez le code <strong>000000</strong>.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Actions */}
            <div className="space-y-3">
              <Button
                variant="outline"
                className="w-full"
                onClick={onBack}
                disabled={isSending || isVerifying}
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Retour
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
