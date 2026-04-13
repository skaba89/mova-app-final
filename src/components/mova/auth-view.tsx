'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAppStore } from '@/lib/mova/store'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Checkbox } from '@/components/ui/checkbox'
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Phone,
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  ArrowLeft,
  Check,
  Car,
  Building2,
  Users,
  Shield,
  Loader2,
  KeyRound,
  Clock,
  Truck,
} from 'lucide-react'

// ─── Types ──────────────────────────────────────────────────────────────────

type Role = 'passenger' | 'driver' | 'livreur' | 'admin'
type VehicleType = 'standard' | 'premium' | 'van'

interface FormData {
  phone: string
  firstName: string
  lastName: string
  email: string
  password: string
  confirmPassword: string
  acceptedTerms: boolean
}

interface VehicleData {
  type: VehicleType
  brand: string
  model: string
  year: string
  plateNumber: string
  color: string
}

// Step identifiers for the multi-flow navigation
const STEP_WELCOME = 0
const STEP_LOGIN_PHONE = 1
const STEP_LOGIN_OTP = 2
const STEP_LOGIN_SUCCESS = 3
const STEP_SIGNUP_INFO = 4
const STEP_SIGNUP_ROLE = 5
const STEP_SIGNUP_OTP = 6
const STEP_SIGNUP_VEHICLE = 7
const STEP_COMPLETE = 8

// ─── Animation Variants ─────────────────────────────────────────────────────

const slideVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 300 : -300,
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
  },
  exit: (direction: number) => ({
    x: direction < 0 ? 300 : -300,
    opacity: 0,
  }),
}

const fadeUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -10 },
}

const scaleIn = {
  initial: { scale: 0, opacity: 0 },
  animate: { scale: 1, opacity: 1 },
  exit: { scale: 0, opacity: 0 },
}

const staggerContainer = {
  animate: {
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.1,
    },
  },
}

const staggerItem = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' as const } },
}

// ─── Progress Bar Component ──────────────────────────────────────────────────

function ProgressBar({
  currentStep,
  totalSteps,
  steps,
}: {
  currentStep: number
  totalSteps: number
  steps: string[]
}) {
  const progress = ((currentStep + 1) / totalSteps) * 100

  return (
    <div className="w-full max-w-xs mx-auto px-4">
      <div className="flex items-center gap-2">
        {steps.map((label, i) => {
          const isActive = i <= currentStep
          const isCurrent = i === currentStep
          return (
            <div key={label} className="flex items-center flex-1 last:flex-none">
              <div className="flex flex-col items-center gap-1">
                <motion.div
                  animate={{
                    scale: isCurrent ? 1.2 : 1,
                    backgroundColor: isActive
                      ? 'var(--color-emerald-500)'
                      : 'var(--color-muted)',
                  }}
                  transition={{ duration: 0.3 }}
                  className="w-2.5 h-2.5 rounded-full"
                />
                {isCurrent && (
                  <span className="text-[10px] text-emerald-600 font-medium leading-none">
                    {label}
                  </span>
                )}
              </div>
              {i < steps.length - 1 && (
                <div className="flex-1 h-px mx-1 mt-[-8px]">
                  <motion.div
                    animate={{ scaleX: i < currentStep ? 1 : 0 }}
                    transition={{ duration: 0.4, ease: 'easeInOut' }}
                    className="h-full bg-emerald-500 origin-left rounded-full"
                  />
                  <div className="h-full bg-muted/50 -mt-px" />
                </div>
              )}
            </div>
          )
        })}
      </div>
      {/* Thin progress bar */}
      <div className="mt-3 h-1 bg-muted/50 rounded-full overflow-hidden">
        <motion.div
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.4, ease: 'easeInOut' }}
          className="h-full mova-gradient rounded-full"
        />
      </div>
    </div>
  )
}

// ─── MOVA Logo SVG ───────────────────────────────────────────────────────────

function MovaLogo({ size = 80 }: { size?: number }) {
  return (
    <motion.div
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 0.5, type: 'spring', stiffness: 200 }}
      className="flex items-center justify-center"
    >
      <div
        className="relative flex items-center justify-center"
        style={{ width: size, height: size }}
      >
        {/* Outer glow ring */}
        <motion.div
          animate={{ scale: [1, 1.08, 1], opacity: [0.3, 0.6, 0.3] }}
          transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute rounded-full bg-emerald-500/20"
          style={{
            width: size * 1.3,
            height: size * 1.3,
            left: -(size * 0.15),
            top: -(size * 0.15),
          }}
        />
        {/* Main triangle container */}
        <div
          className="mova-gradient rounded-2xl flex items-center justify-center shadow-lg"
          style={{ width: size, height: size }}
        >
          <svg
            width={size * 0.55}
            height={size * 0.55}
            viewBox="0 0 44 44"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path d="M8 34L22 6L36 34H8Z" fill="white" fillOpacity="0.95" />
            <circle cx="22" cy="30" r="4" fill="rgba(255,255,255,0.4)" />
            <circle cx="22" cy="30" r="2.5" fill="white" />
          </svg>
        </div>
      </div>
    </motion.div>
  )
}

// ─── Success Checkmark Animation ─────────────────────────────────────────────

function SuccessCheckmark({ size = 80 }: { size?: number }) {
  return (
    <motion.div
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      transition={{ duration: 0.5, type: 'spring', stiffness: 200, damping: 12 }}
      className="flex items-center justify-center"
    >
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ delay: 0.2, duration: 0.4, type: 'spring', stiffness: 300 }}
        className="relative"
      >
        {/* Outer ring */}
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1.3, opacity: 0 }}
          transition={{ delay: 0.1, duration: 0.8 }}
          className="absolute inset-0 rounded-full bg-emerald-400/30"
          style={{ width: size, height: size }}
        />
        {/* Main circle */}
        <div
          className="rounded-full mova-gradient flex items-center justify-center shadow-lg shadow-emerald-500/30"
          style={{ width: size, height: size }}
        >
          {/* Checkmark path */}
          <motion.svg
            width={size * 0.45}
            height={size * 0.45}
            viewBox="0 0 24 24"
            fill="none"
            stroke="white"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <motion.path
              d="M5 13l4 4L19 7"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ delay: 0.4, duration: 0.5, ease: 'easeOut' }}
            />
          </motion.svg>
        </div>
      </motion.div>
    </motion.div>
  )
}

// ─── Confetti Particles ──────────────────────────────────────────────────────

function ConfettiParticles() {
  const colors = ['#10b981', '#34d399', '#fbbf24', '#f59e0b', '#6ee7b7', '#ffffff']

  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
      {Array.from({ length: 30 }).map((_, i) => (
        <motion.div
          key={i}
          initial={{
            x: `${50 + (Math.random() - 0.5) * 20}%`,
            y: '40%',
            scale: 0,
            rotate: 0,
          }}
          animate={{
            y: ['40%', '110%'],
            x: `${50 + (Math.random() - 0.5) * 80}%`,
            scale: [0, 1, 0.8, 0],
            rotate: Math.random() * 720 - 360,
            opacity: [0, 1, 1, 0],
          }}
          transition={{
            duration: 2 + Math.random() * 2,
            delay: Math.random() * 0.5,
            ease: 'easeOut',
          }}
          className="absolute"
          style={{
            width: 6 + Math.random() * 8,
            height: 6 + Math.random() * 8,
            borderRadius: Math.random() > 0.5 ? '50%' : '2px',
            backgroundColor: colors[i % colors.length],
          }}
        />
      ))}
    </div>
  )
}

// ─── Step 1: Welcome Screen ─────────────────────────────────────────────────

function StepWelcome({
  onLogin,
  onSignup,
  onGuest,
}: {
  onLogin: () => void
  onSignup: () => void
  onGuest: () => void
}) {
  return (
    <motion.div
      className="w-full max-w-md mx-auto px-4"
      variants={staggerContainer}
      initial="initial"
      animate="animate"
    >
      {/* Logo */}
      <motion.div className="flex justify-center mb-8" variants={staggerItem}>
        <MovaLogo size={96} />
      </motion.div>

      {/* Title & Tagline */}
      <motion.div className="text-center mb-3" variants={staggerItem}>
        <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight">
          <span className="mova-gradient-text">MOVA</span>
        </h1>
      </motion.div>
      <motion.p
        className="text-center text-lg font-medium text-foreground/80 mb-1"
        variants={staggerItem}
      >
        Conakry, en mouvement
      </motion.p>
      <motion.p
        className="text-center text-sm text-muted-foreground mb-10"
        variants={staggerItem}
      >
        La super-app de mobilite pour la Guinee
      </motion.p>

      {/* Action Buttons */}
      <motion.div className="space-y-3" variants={staggerItem}>
        <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }}>
          <Button
            onClick={onLogin}
            className="w-full h-14 text-base font-semibold mova-gradient text-white shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 transition-all duration-300 rounded-xl"
          >
            Se connecter
            <ArrowRight className="ml-2 w-5 h-5" />
          </Button>
        </motion.div>
        <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }}>
          <Button
            onClick={onSignup}
            variant="outline"
            className="w-full h-14 text-base font-semibold border-2 border-emerald-500/40 text-emerald-700 hover:bg-emerald-50 hover:border-emerald-500 dark:text-emerald-400 dark:hover:bg-emerald-950/30 rounded-xl transition-all duration-300"
          >
            S&apos;inscrire
          </Button>
        </motion.div>
      </motion.div>

      {/* Guest Link */}
      <motion.div className="text-center mt-6" variants={staggerItem}>
        <button
          onClick={onGuest}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors underline-offset-4 hover:underline"
        >
          Continuer sans compte
        </button>
      </motion.div>

      {/* Security note */}
      <motion.p
        className="text-center text-[11px] text-muted-foreground mt-8 flex items-center justify-center gap-1.5"
        variants={staggerItem}
      >
        <Shield className="w-3 h-3" />
        Vos donnees sont protegees et securisees
      </motion.p>
    </motion.div>
  )
}

// ─── Step 2: Login — Phone Number ───────────────────────────────────────────

function StepLoginPhone({
  onContinue,
  onBack,
  onForgotPassword,
  onGoSignup,
}: {
  onContinue: (phone: string) => void
  onBack: () => void
  onForgotPassword: () => void
  onGoSignup: () => void
}) {
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showGoogleInfo, setShowGoogleInfo] = useState(false)
  const [showAppleInfo, setShowAppleInfo] = useState(false)

  const isValid = phone.length === 9 && /^[56]\d{8}$/.test(phone)

  const handleContinue = useCallback(() => {
    if (!isValid || loading) return
    setError('')
    setLoading(true)
    // Simulate API call
    setTimeout(() => {
      setLoading(false)
      onContinue(`+224${phone}`)
    }, 600)
  }, [isValid, phone, loading, onContinue])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') handleContinue()
    },
    [handleContinue]
  )

  return (
    <motion.div
      className="w-full max-w-md mx-auto px-4"
      variants={fadeUp}
      initial="initial"
      animate="animate"
      exit="exit"
    >
      {/* Back button */}
      <motion.div className="mb-4" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.05 }}>
        <Button
          variant="ghost"
          size="sm"
          onClick={onBack}
          className="text-muted-foreground hover:text-foreground -ml-2"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          Retour
        </Button>
      </motion.div>

      {/* Title */}
      <motion.div className="text-center mb-8" variants={fadeUp} transition={{ delay: 0.1 }}>
        <h2 className="text-2xl font-bold text-foreground">Connexion</h2>
        <p className="text-sm text-muted-foreground mt-2">
          Entrez votre numero de telephone
        </p>
      </motion.div>

      {/* Phone Input Card */}
      <motion.div variants={fadeUp} transition={{ delay: 0.2 }}>
        <Card className="border-0 shadow-md bg-card/80 backdrop-blur-sm">
          <CardContent className="p-6 space-y-5">
            {/* Phone field */}
            <div className="space-y-2">
              <Label htmlFor="login-phone" className="text-sm font-medium">
                Numero de telephone
              </Label>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 px-3 h-12 rounded-xl bg-muted border border-input text-sm font-medium text-muted-foreground shrink-0">
                  <Phone className="w-4 h-4 text-emerald-600" />
                  <span>+224</span>
                </div>
                <div className="relative flex-1">
                  <Input
                    id="login-phone"
                    type="tel"
                    placeholder="6XX XX XX XX"
                    maxLength={9}
                    value={phone}
                    onChange={(e) => {
                      const digits = e.target.value.replace(/\D/g, '')
                      setPhone(digits.slice(0, 9))
                      setError('')
                    }}
                    onKeyDown={handleKeyDown}
                    className={`h-12 text-base tracking-wider rounded-xl pl-4 ${
                      error ? 'border-destructive focus-visible:ring-destructive/30' : ''
                    }`}
                  />
                </div>
              </div>
              {error && (
                <p className="text-xs text-destructive font-medium">{error}</p>
              )}
              {phone.length > 0 && phone.length < 9 && (
                <p className="text-xs text-muted-foreground">
                  {9 - phone.length} chiffre{9 - phone.length > 1 ? 's' : ''} restant
                </p>
              )}
            </div>

            {/* Continue button */}
            <Button
              onClick={handleContinue}
              disabled={!isValid || loading}
              className="w-full h-12 text-base font-semibold mova-gradient text-white shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 transition-all duration-300 disabled:opacity-50 disabled:shadow-none rounded-xl"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  Continuer
                  <ArrowRight className="ml-2 w-5 h-5" />
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </motion.div>

      {/* OR divider */}
      <motion.div className="flex items-center gap-4 my-6" variants={fadeUp} transition={{ delay: 0.3 }}>
        <Separator className="flex-1" />
        <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
          ou se connecter avec
        </span>
        <Separator className="flex-1" />
      </motion.div>

      {/* Social login buttons (decorative) */}
      <motion.div className="grid grid-cols-2 gap-3" variants={fadeUp} transition={{ delay: 0.35 }}>
        <Button
          variant="outline"
          className="h-11 rounded-xl font-medium text-sm hover:bg-muted transition-all"
          onClick={() => setShowGoogleInfo(true)}
        >
          <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          Google
        </Button>
        <Button
          variant="outline"
          className="h-11 rounded-xl font-medium text-sm hover:bg-muted transition-all"
          onClick={() => setShowAppleInfo(true)}
        >
          <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24" fill="currentColor">
            <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
          </svg>
          Apple
        </Button>
      </motion.div>

      {/* Google Info Dialog */}
      <Dialog open={showGoogleInfo} onOpenChange={setShowGoogleInfo}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Connexion Google</DialogTitle>
            <DialogDescription>
              La connexion via Google sera disponible prochainement. En attendant, vous pouvez vous connecter avec votre numero de telephone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setShowGoogleInfo(false)} className="mova-gradient text-white">
              Compris
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Apple Info Dialog */}
      <Dialog open={showAppleInfo} onOpenChange={setShowAppleInfo}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Connexion Apple</DialogTitle>
            <DialogDescription>
              La connexion via Apple sera disponible prochainement. En attendant, vous pouvez vous connecter avec votre numero de telephone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setShowAppleInfo(false)} className="mova-gradient text-white">
              Compris
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Links */}
      <motion.div className="flex flex-col items-center gap-2 mt-6" variants={fadeUp} transition={{ delay: 0.4 }}>
        <button
          onClick={onForgotPassword}
          className="text-sm text-muted-foreground hover:text-emerald-600 transition-colors"
        >
          Mot de passe oublie ?
        </button>
        <button
          onClick={onGoSignup}
          className="text-sm text-muted-foreground hover:text-emerald-600 transition-colors"
        >
          Pas encore de compte ?{' '}
          <span className="font-semibold text-emerald-600">S&apos;inscrire</span>
        </button>
      </motion.div>
    </motion.div>
  )
}

// ─── Step 3 & 6: OTP Verification ───────────────────────────────────────────

function StepOTP({
  phone,
  title,
  subtitle,
  onVerified,
  onBack,
  onModifyNumber,
}: {
  phone: string
  title: string
  subtitle: string
  onVerified: () => void
  onBack: () => void
  onModifyNumber?: () => void
}) {
  const [otp, setOtp] = useState('')
  const [countdown, setCountdown] = useState(59)
  const [verifying, setVerifying] = useState(false)
  const [error, setError] = useState('')

  // Countdown timer
  useEffect(() => {
    if (countdown <= 0) return
    const timer = setInterval(() => {
      setCountdown((prev) => prev - 1)
    }, 1000)
    return () => clearInterval(timer)
  }, [countdown])

  const canResend = countdown <= 0

  // Auto-verify when 4 digits entered
  const handleOtpChange = useCallback(
    (value: string) => {
      setOtp(value)
      setError('')
      if (value.length === 4) {
        if (verifying) return
        setVerifying(true)
        setTimeout(() => {
          setVerifying(false)
          toast.success('Code verifie avec succes !')
          onVerified()
        }, 800)
      }
    },
    [onVerified, verifying]
  )

  // Manual verify
  const handleVerify = useCallback(() => {
    if (otp.length !== 4 || verifying) return
    setVerifying(true)
    setTimeout(() => {
      setVerifying(false)
      toast.success('Code verifie avec succes !')
      onVerified()
    }, 800)
  }, [otp, verifying, onVerified])

  // Resend OTP
  const handleResend = useCallback(() => {
    setCountdown(59)
    setOtp('')
    setError('')
    toast.info('Un nouveau code a ete envoye')
  }, [])

  const minutes = String(Math.floor(countdown / 60)).padStart(2, '0')
  const seconds = String(countdown % 60).padStart(2, '0')

  // Format phone display
  const displayPhone = phone.replace(/(\+224)(\d{3})(\d{2})(\d{2})(\d{2})/, '$1 $2 $3 $4 $5')

  return (
    <motion.div
      className="w-full max-w-md mx-auto px-4"
      variants={fadeUp}
      initial="initial"
      animate="animate"
      exit="exit"
    >
      {/* Back button */}
      <motion.div className="mb-4" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.05 }}>
        <Button
          variant="ghost"
          size="sm"
          onClick={onBack}
          className="text-muted-foreground hover:text-foreground -ml-2"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          Retour
        </Button>
      </motion.div>

      {/* Phone icon */}
      <motion.div
        className="flex justify-center mb-6"
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.1, type: 'spring', stiffness: 200 }}
      >
        <div className="relative">
          <div className="w-20 h-20 rounded-full bg-emerald-100 dark:bg-emerald-950/50 flex items-center justify-center">
            <motion.div
              animate={{ y: [0, -4, 0] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
            >
              <Phone className="w-9 h-9 text-emerald-600" />
            </motion.div>
          </div>
          <motion.div
            animate={{ scale: [1, 1.3, 1], opacity: [0.7, 1, 0.7] }}
            transition={{ duration: 1.2, repeat: Infinity }}
            className="absolute -top-1 -right-1 w-5 h-5 bg-amber-400 rounded-full flex items-center justify-center shadow-md"
          >
            <Mail className="w-3 h-3 text-white" />
          </motion.div>
        </div>
      </motion.div>

      {/* Title */}
      <motion.div className="text-center mb-8" variants={fadeUp} transition={{ delay: 0.15 }}>
        <h2 className="text-xl font-bold text-foreground">{title}</h2>
        <p className="text-sm text-muted-foreground mt-2">
          {subtitle}{' '}
          <span className="font-semibold text-foreground">{displayPhone}</span>
        </p>
      </motion.div>

      {/* OTP Input - 4 digit boxes */}
      <motion.div
        className="flex justify-center mb-6"
        variants={fadeUp}
        transition={{ delay: 0.2 }}
      >
        <InputOTP
          maxLength={4}
          value={otp}
          onChange={handleOtpChange}
          containerClassName="gap-3"
        >
          <InputOTPGroup>
            <InputOTPSlot index={0} className="w-14 h-16 text-2xl rounded-xl font-bold" />
            <InputOTPSlot index={1} className="w-14 h-16 text-2xl rounded-xl font-bold" />
            <InputOTPSlot index={2} className="w-14 h-16 text-2xl rounded-xl font-bold" />
            <InputOTPSlot index={3} className="w-14 h-16 text-2xl rounded-xl font-bold" />
          </InputOTPGroup>
        </InputOTP>
      </motion.div>

      {/* Error */}
      {error && (
        <motion.p
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center text-sm text-destructive mb-4 font-medium"
        >
          {error}
        </motion.p>
      )}

      {/* Timer / Resend */}
      <motion.div className="text-center mb-6" variants={fadeUp} transition={{ delay: 0.3 }}>
        {canResend ? (
          <Button
            variant="link"
            onClick={handleResend}
            className="text-emerald-600 hover:text-emerald-700 font-medium text-sm p-0 h-auto"
          >
            <Clock className="w-4 h-4 mr-1" />
            Renvoyer le code
          </Button>
        ) : (
          <p className="text-sm text-muted-foreground flex items-center justify-center gap-1.5">
            <Clock className="w-3.5 h-3.5" />
            Renvoyer dans{' '}
            <span className="font-mono font-semibold text-foreground">
              {minutes}:{seconds}
            </span>
          </p>
        )}
      </motion.div>

      {/* Verify button */}
      <motion.div variants={fadeUp} transition={{ delay: 0.35 }}>
        <Button
          onClick={handleVerify}
          disabled={otp.length !== 4 || verifying}
          className="w-full h-12 text-base font-semibold mova-gradient text-white shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 transition-all duration-300 disabled:opacity-50 rounded-xl"
        >
          {verifying ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <>
              Verifier
              <Shield className="ml-2 w-5 h-5" />
            </>
          )}
        </Button>
      </motion.div>

      {/* Modify number link */}
      {onModifyNumber && (
        <motion.div className="text-center mt-4" variants={fadeUp} transition={{ delay: 0.4 }}>
          <button
            onClick={onModifyNumber}
            className="text-sm text-muted-foreground hover:text-emerald-600 transition-colors"
          >
            Modifier le numero
          </button>
        </motion.div>
      )}

      {/* Demo hint */}
      <motion.p
        className="text-center text-xs text-muted-foreground mt-4"
        variants={fadeUp}
        transition={{ delay: 0.45 }}
      >
        Pour la demo, tous les codes a 4 chiffres sont acceptes
      </motion.p>
    </motion.div>
  )
}

// ─── Step 4: Login Success — Select Role ────────────────────────────────────

function StepSelectRole({
  onRoleSelected,
  onSkip,
  userName,
}: {
  onRoleSelected: (role: Role) => void
  onSkip: () => void
  userName: string
}) {
  const roles: Array<{
    id: Role
    title: string
    description: string
    icon: React.ReactNode
  }> = [
    {
      id: 'passenger',
      title: 'Passager',
      description: 'Reservez des courses et livraisons',
      icon: <Car className="w-8 h-8 text-emerald-600" />,
    },
    {
      id: 'driver',
      title: 'Chauffeur',
      description: 'Gagnez de l\'argent en conduisant',
      icon: (
        <div className="relative">
          <Car className="w-8 h-8 text-emerald-600" />
          <KeyRound className="w-4 h-4 text-amber-500 absolute -bottom-1 -right-2" />
        </div>
      ),
    },
    {
      id: 'livreur',
      title: 'Livreur',
      description: 'Livrez des colis et gagnez de l\'argent',
      icon: <Truck className="w-8 h-8 text-emerald-600" />,
    },
    {
      id: 'admin',
      title: 'Entreprise',
      description: 'Gerez les deplacements de vos employes',
      icon: <Building2 className="w-8 h-8 text-emerald-600" />,
    },
  ]

  return (
    <motion.div
      className="w-full max-w-md mx-auto px-4"
      variants={fadeUp}
      initial="initial"
      animate="animate"
      exit="exit"
    >
      {/* Success checkmark */}
      <motion.div className="flex justify-center mb-6" variants={scaleIn}>
        <SuccessCheckmark size={72} />
      </motion.div>

      {/* Welcome message */}
      <motion.div className="text-center mb-8" variants={fadeUp} transition={{ delay: 0.2 }}>
        <h2 className="text-2xl font-bold text-foreground">
          Bienvenue, {userName} !
        </h2>
        <p className="text-sm text-muted-foreground mt-2">
          Comment souhaitez-vous utiliser MOVA ?
        </p>
      </motion.div>

      {/* Role cards */}
      <motion.div className="space-y-3" variants={fadeUp} transition={{ delay: 0.3 }}>
        {roles.map((role, index) => (
          <motion.div
            key={role.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.35 + index * 0.1 }}
            whileHover={{ scale: 1.01, x: 4 }}
            whileTap={{ scale: 0.99 }}
          >
            <Card
              className="cursor-pointer border-2 border-transparent hover:border-emerald-500/40 hover:shadow-lg hover:shadow-emerald-500/10 transition-all duration-300 bg-card/80 backdrop-blur-sm group"
              onClick={() => onRoleSelected(role.id)}
            >
              <CardContent className="p-4 flex items-center gap-4">
                <div className="w-14 h-14 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 flex items-center justify-center shrink-0 group-hover:bg-emerald-100 dark:group-hover:bg-emerald-900/50 transition-colors">
                  {role.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-foreground">{role.title}</h3>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {role.description}
                  </p>
                </div>
                <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-emerald-600 transition-colors shrink-0" />
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </motion.div>

      {/* Skip link */}
      <motion.div className="text-center mt-6" variants={fadeUp} transition={{ delay: 0.6 }}>
        <button
          onClick={onSkip}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors underline-offset-4 hover:underline"
        >
          Plus tard
        </button>
      </motion.div>
    </motion.div>
  )
}

// ─── Step 5: Sign Up — Name & Info ──────────────────────────────────────────

function StepSignupInfo({
  onContinue,
  onBack,
  formData,
  setFormData,
}: {
  onContinue: () => void
  onBack: () => void
  formData: FormData
  setFormData: React.Dispatch<React.SetStateAction<FormData>>
}) {
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const validate = useCallback((): boolean => {
    const newErrors: Record<string, string> = {}

    if (!formData.firstName.trim()) {
      newErrors.firstName = 'Le prenom est requis'
    }
    if (!formData.lastName.trim()) {
      newErrors.lastName = 'Le nom est requis'
    }
    if (formData.phone.length !== 9) {
      newErrors.phone = 'Numero de telephone invalide (9 chiffres requis)'
    } else if (!/^[56]\d{8}$/.test(formData.phone)) {
      newErrors.phone = 'Le numero doit commencer par 6 ou 5'
    }
    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Adresse email invalide'
    }
    if (formData.password.length < 6) {
      newErrors.password = 'Le mot de passe doit contenir au moins 6 caracteres'
    }
    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Les mots de passe ne correspondent pas'
    }
    if (!formData.acceptedTerms) {
      newErrors.terms = 'Vous devez accepter les conditions'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }, [formData])

  const handleContinue = useCallback(() => {
    if (!validate() || loading) return
    setLoading(true)
    // Simulate API call
    setTimeout(() => {
      setLoading(false)
      onContinue()
    }, 600)
  }, [validate, loading, onContinue])

  const updateField = useCallback(
    <K extends keyof FormData>(field: K, value: FormData[K]) => {
      setFormData((prev) => ({ ...prev, [field]: value }))
      // Clear error for this field
      setErrors((prev) => {
        const next = { ...prev }
        delete next[field]
        return next
      })
    },
    [setFormData]
  )

  const handlePhoneChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const digits = e.target.value.replace(/\D/g, '')
      updateField('phone', digits.slice(0, 9))
    },
    [updateField]
  )

  const isFormValid =
    formData.firstName.trim() &&
    formData.lastName.trim() &&
    formData.phone.length === 9 &&
    formData.password.length >= 6 &&
    formData.password === formData.confirmPassword &&
    formData.acceptedTerms

  return (
    <motion.div
      className="w-full max-w-md mx-auto px-4"
      variants={fadeUp}
      initial="initial"
      animate="animate"
      exit="exit"
    >
      {/* Back button */}
      <motion.div className="mb-4" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.05 }}>
        <Button
          variant="ghost"
          size="sm"
          onClick={onBack}
          className="text-muted-foreground hover:text-foreground -ml-2"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          Retour
        </Button>
      </motion.div>

      {/* Title */}
      <motion.div className="text-center mb-6" variants={fadeUp} transition={{ delay: 0.1 }}>
        <h2 className="text-2xl font-bold text-foreground">Inscription</h2>
        <p className="text-sm text-muted-foreground mt-2">
          Creer votre compte MOVA
        </p>
      </motion.div>

      {/* Form Card */}
      <motion.div variants={fadeUp} transition={{ delay: 0.15 }}>
        <Card className="border-0 shadow-md bg-card/80 backdrop-blur-sm">
          <CardContent className="p-6 space-y-4">
            {/* First name */}
            <div className="space-y-1.5">
              <Label htmlFor="signup-firstname" className="text-sm font-medium">
                Prenom <span className="text-destructive">*</span>
              </Label>
              <Input
                id="signup-firstname"
                placeholder="Abdoulaye"
                value={formData.firstName}
                onChange={(e) => updateField('firstName', e.target.value)}
                className={`h-11 rounded-xl ${errors.firstName ? 'border-destructive' : ''}`}
              />
              {errors.firstName && (
                <p className="text-xs text-destructive">{errors.firstName}</p>
              )}
            </div>

            {/* Last name */}
            <div className="space-y-1.5">
              <Label htmlFor="signup-lastname" className="text-sm font-medium">
                Nom <span className="text-destructive">*</span>
              </Label>
              <Input
                id="signup-lastname"
                placeholder="Camara"
                value={formData.lastName}
                onChange={(e) => updateField('lastName', e.target.value)}
                className={`h-11 rounded-xl ${errors.lastName ? 'border-destructive' : ''}`}
              />
              {errors.lastName && (
                <p className="text-xs text-destructive">{errors.lastName}</p>
              )}
            </div>

            {/* Email */}
            <div className="space-y-1.5">
              <Label htmlFor="signup-email" className="text-sm font-medium">
                Email <span className="text-muted-foreground font-normal">(optionnel)</span>
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="signup-email"
                  type="email"
                  placeholder="votre@email.com"
                  value={formData.email}
                  onChange={(e) => updateField('email', e.target.value)}
                  className={`h-11 pl-10 rounded-xl ${errors.email ? 'border-destructive' : ''}`}
                />
              </div>
              {errors.email && (
                <p className="text-xs text-destructive">{errors.email}</p>
              )}
            </div>

            {/* Phone */}
            <div className="space-y-1.5">
              <Label htmlFor="signup-phone" className="text-sm font-medium">
                Telephone <span className="text-destructive">*</span>
              </Label>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 px-3 h-11 rounded-xl bg-muted border border-input text-sm font-medium text-muted-foreground shrink-0">
                  <Phone className="w-3.5 h-3.5 text-emerald-600" />
                  <span>+224</span>
                </div>
                <Input
                  id="signup-phone"
                  type="tel"
                  placeholder="6XX XX XX XX"
                  maxLength={9}
                  value={formData.phone}
                  onChange={handlePhoneChange}
                  className={`h-11 text-base tracking-wider rounded-xl ${
                    errors.phone ? 'border-destructive' : ''
                  }`}
                />
              </div>
              {errors.phone && (
                <p className="text-xs text-destructive">{errors.phone}</p>
              )}
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <Label htmlFor="signup-password" className="text-sm font-medium">
                Mot de passe <span className="text-destructive">*</span>
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="signup-password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Minimum 6 caracteres"
                  value={formData.password}
                  onChange={(e) => updateField('password', e.target.value)}
                  className={`h-11 pl-10 pr-10 rounded-xl ${errors.password ? 'border-destructive' : ''}`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.password && (
                <p className="text-xs text-destructive">{errors.password}</p>
              )}
              {/* Password strength indicator */}
              {formData.password.length > 0 && (
                <div className="flex gap-1">
                  {[1, 2, 3].map((level) => (
                    <div
                      key={level}
                      className={`h-1 flex-1 rounded-full transition-colors ${
                        formData.password.length >= level * 3
                          ? formData.password.length >= 8
                            ? 'bg-emerald-500'
                            : formData.password.length >= 6
                            ? 'bg-amber-400'
                            : 'bg-red-400'
                          : 'bg-muted'
                      }`}
                    />
                  ))}
                  <span className="text-[10px] text-muted-foreground ml-1.5 self-center">
                    {formData.password.length < 4
                      ? 'Faible'
                      : formData.password.length < 6
                      ? 'Moyen'
                      : formData.password.length < 8
                      ? 'Bon'
                      : 'Fort'}
                  </span>
                </div>
              )}
            </div>

            {/* Confirm Password */}
            <div className="space-y-1.5">
              <Label htmlFor="signup-confirm" className="text-sm font-medium">
                Confirmer le mot de passe <span className="text-destructive">*</span>
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="signup-confirm"
                  type={showConfirm ? 'text' : 'password'}
                  placeholder="Confirmez votre mot de passe"
                  value={formData.confirmPassword}
                  onChange={(e) => updateField('confirmPassword', e.target.value)}
                  className={`h-11 pl-10 pr-10 rounded-xl ${
                    errors.confirmPassword ? 'border-destructive' : ''
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.confirmPassword && (
                <p className="text-xs text-destructive">{errors.confirmPassword}</p>
              )}
              {/* Match indicator */}
              {formData.confirmPassword.length > 0 && (
                <div className="flex items-center gap-1">
                  {formData.password === formData.confirmPassword ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-500" />
                      <span className="text-[10px] text-emerald-600">Les mots de passe correspondent</span>
                    </>
                  ) : (
                    <span className="text-[10px] text-destructive">Les mots de passe ne correspondent pas</span>
                  )}
                </div>
              )}
            </div>

            {/* Terms checkbox */}
            <div className="space-y-1.5">
              <div className="flex items-start gap-3">
                <Checkbox
                  id="signup-terms"
                  checked={formData.acceptedTerms}
                  onCheckedChange={(checked) => updateField('acceptedTerms', checked === true)}
                  className="mt-0.5 data-[state=checked]:bg-emerald-600 data-[state=checked]:border-emerald-600"
                />
                <Label
                  htmlFor="signup-terms"
                  className="text-xs text-muted-foreground leading-relaxed cursor-pointer"
                >
                  J&apos;accepte les{' '}
                  <span className="text-emerald-600 font-medium hover:underline cursor-pointer">
                    Conditions d&apos;utilisation
                  </span>{' '}
                  et la{' '}
                  <span className="text-emerald-600 font-medium hover:underline cursor-pointer">
                    Politique de confidentialite
                  </span>
                </Label>
              </div>
              {errors.terms && (
                <p className="text-xs text-destructive">{errors.terms}</p>
              )}
            </div>

            {/* Submit button */}
            <Button
              onClick={handleContinue}
              disabled={!isFormValid || loading}
              className="w-full h-12 text-base font-semibold mova-gradient text-white shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 transition-all duration-300 disabled:opacity-50 disabled:shadow-none rounded-xl"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  Creer mon compte
                  <ArrowRight className="ml-2 w-5 h-5" />
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </motion.div>

      {/* Login link */}
      <motion.div className="text-center mt-4" variants={fadeUp} transition={{ delay: 0.3 }}>
        <button
          onClick={onBack}
          className="text-sm text-muted-foreground hover:text-emerald-600 transition-colors"
        >
          Deja un compte ?{' '}
          <span className="font-semibold text-emerald-600">Se connecter</span>
        </button>
      </motion.div>
    </motion.div>
  )
}

// ─── Step 7: Vehicle Registration ────────────────────────────────────────────

function StepVehicleRegistration({
  onContinue,
  onSkip,
  vehicleData,
  setVehicleData,
}: {
  onContinue: () => void
  onSkip: () => void
  vehicleData: VehicleData
  setVehicleData: React.Dispatch<React.SetStateAction<VehicleData>>
}) {
  const [loading, setLoading] = useState(false)

  const vehicleTypes: Array<{
    id: VehicleType
    title: string
    description: string
    icon: React.ReactNode
  }> = [
    {
      id: 'standard',
      title: 'Standard',
      description: '4 places, economique',
      icon: <Car className="w-7 h-7" />,
    },
    {
      id: 'premium',
      title: 'Premium',
      description: 'Confort superieur, climatisation',
      icon: (
        <div className="relative">
          <Car className="w-7 h-7" />
          <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-amber-400" />
        </div>
      ),
    },
    {
      id: 'van',
      title: 'Van',
      description: '7 places, groupe et familial',
      icon: <Users className="w-7 h-7" />,
    },
  ]

  const updateField = useCallback(
    <K extends keyof VehicleData>(field: K, value: VehicleData[K]) => {
      setVehicleData((prev) => ({ ...prev, [field]: value }))
    },
    [setVehicleData]
  )

  const handleContinue = useCallback(() => {
    setLoading(true)
    setTimeout(() => {
      setLoading(false)
      onContinue()
    }, 600)
  }, [onContinue])

  const currentYear = new Date().getFullYear()
  const years = Array.from({ length: currentYear - 2004 }, (_, i) =>
    String(currentYear - i)
  )

  const isFormValid =
    vehicleData.type &&
    vehicleData.brand.trim() &&
    vehicleData.model.trim() &&
    vehicleData.year &&
    vehicleData.plateNumber.trim() &&
    vehicleData.color.trim()

  return (
    <motion.div
      className="w-full max-w-md mx-auto px-4"
      variants={fadeUp}
      initial="initial"
      animate="animate"
      exit="exit"
    >
      {/* Title */}
      <motion.div className="text-center mb-6" variants={fadeUp} transition={{ delay: 0.1 }}>
        <h2 className="text-2xl font-bold text-foreground">Votre vehicule</h2>
        <p className="text-sm text-muted-foreground mt-2">
          Ajoutez les informations de votre vehicule
        </p>
      </motion.div>

      {/* Form Card */}
      <motion.div variants={fadeUp} transition={{ delay: 0.15 }}>
        <Card className="border-0 shadow-md bg-card/80 backdrop-blur-sm">
          <CardContent className="p-6 space-y-5">
            {/* Vehicle type cards */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Type de vehicule</Label>
              <div className="grid grid-cols-3 gap-2">
                {vehicleTypes.map((vt) => {
                  const isSelected = vehicleData.type === vt.id
                  return (
                    <motion.div key={vt.id} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                      <button
                        type="button"
                        onClick={() => updateField('type', vt.id)}
                        className={`w-full p-3 rounded-xl border-2 text-center transition-all duration-200 ${
                          isSelected
                            ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30 shadow-md shadow-emerald-500/10'
                            : 'border-transparent bg-muted/50 hover:bg-muted hover:border-emerald-200 dark:hover:border-emerald-800'
                        }`}
                      >
                        <div className={`flex justify-center mb-1.5 ${isSelected ? 'text-emerald-600' : 'text-muted-foreground'}`}>
                          {vt.icon}
                        </div>
                        <p className={`text-xs font-semibold ${isSelected ? 'text-emerald-700 dark:text-emerald-400' : 'text-foreground'}`}>
                          {vt.title}
                        </p>
                        <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">
                          {vt.description}
                        </p>
                      </button>
                    </motion.div>
                  )
                })}
              </div>
            </div>

            {/* Brand & Model */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="vehicle-brand" className="text-sm font-medium">
                  Marque
                </Label>
                <Input
                  id="vehicle-brand"
                  placeholder="Toyota"
                  value={vehicleData.brand}
                  onChange={(e) => updateField('brand', e.target.value)}
                  className="h-11 rounded-xl"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="vehicle-model" className="text-sm font-medium">
                  Modele
                </Label>
                <Input
                  id="vehicle-model"
                  placeholder="Corolla"
                  value={vehicleData.model}
                  onChange={(e) => updateField('model', e.target.value)}
                  className="h-11 rounded-xl"
                />
              </div>
            </div>

            {/* Year & Plate */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="vehicle-year" className="text-sm font-medium">
                  Annee
                </Label>
                <select
                  id="vehicle-year"
                  value={vehicleData.year}
                  onChange={(e) => updateField('year', e.target.value)}
                  className="w-full h-11 px-3 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring/50 focus:border-ring transition-colors"
                >
                  <option value="">Selectionner</option>
                  {years.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="vehicle-plate" className="text-sm font-medium">
                  Immatriculation
                </Label>
                <Input
                  id="vehicle-plate"
                  placeholder="GN-1234-AB"
                  value={vehicleData.plateNumber}
                  onChange={(e) =>
                    updateField('plateNumber', e.target.value.toUpperCase())
                  }
                  className="h-11 rounded-xl uppercase"
                />
              </div>
            </div>

            {/* Color */}
            <div className="space-y-1.5">
              <Label htmlFor="vehicle-color" className="text-sm font-medium">
                Couleur
              </Label>
              <Input
                id="vehicle-color"
                placeholder="Noir, Blanc, Gris..."
                value={vehicleData.color}
                onChange={(e) => updateField('color', e.target.value)}
                className="h-11 rounded-xl capitalize"
              />
            </div>

            {/* Submit button */}
            <Button
              onClick={handleContinue}
              disabled={!isFormValid || loading}
              className="w-full h-12 text-base font-semibold mova-gradient text-white shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 transition-all duration-300 disabled:opacity-50 disabled:shadow-none rounded-xl"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  Terminer l&apos;inscription
                  <Check className="ml-2 w-5 h-5" />
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </motion.div>

      {/* Skip link */}
      <motion.div className="text-center mt-4" variants={fadeUp} transition={{ delay: 0.3 }}>
        <button
          onClick={onSkip}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors underline-offset-4 hover:underline"
        >
          Ajouter plus tard
        </button>
      </motion.div>
    </motion.div>
  )
}

// ─── Step 8: Complete ───────────────────────────────────────────────────────

function StepComplete({
  formData,
  selectedRole,
  onStart,
}: {
  formData: FormData
  selectedRole: Role
  onStart: () => void
}) {
  const [showConfetti, setShowConfetti] = useState(false)
  const roleLabels: Record<Role, string> = {
    passenger: 'Passager',
    driver: 'Chauffeur',
    livreur: 'Livreur',
    admin: 'Entreprise',
  }
  const roleIcons: Record<Role, React.ReactNode> = {
    passenger: <Car className="w-5 h-5 text-emerald-600" />,
    driver: <Car className="w-5 h-5 text-emerald-600" />,
    livreur: <Truck className="w-5 h-5 text-emerald-600" />,
    admin: <Building2 className="w-5 h-5 text-emerald-600" />,
  }

  // Trigger confetti on mount
  useEffect(() => {
    const timer = setTimeout(() => setShowConfetti(true), 300)
    return () => clearTimeout(timer)
  }, [])

  return (
    <motion.div
      className="w-full max-w-md mx-auto px-4"
      variants={fadeUp}
      initial="initial"
      animate="animate"
      exit="exit"
    >
      {/* Confetti */}
      {showConfetti && <ConfettiParticles />}

      {/* Success checkmark */}
      <motion.div className="flex justify-center mb-6" variants={scaleIn}>
        <SuccessCheckmark size={88} />
      </motion.div>

      {/* Success message */}
      <motion.div className="text-center mb-8" variants={fadeUp} transition={{ delay: 0.2 }}>
        <h2 className="text-2xl font-bold text-foreground">
          Votre compte est pret !
        </h2>
        <p className="text-sm text-muted-foreground mt-2">
          Bienvenue dans la communaute MOVA
        </p>
      </motion.div>

      {/* Summary card */}
      <motion.div variants={fadeUp} transition={{ delay: 0.3 }}>
        <Card className="border-0 shadow-md bg-card/80 backdrop-blur-sm overflow-hidden">
          <div className="h-1.5 mova-gradient" />
          <CardContent className="p-6 space-y-4">
            {/* Avatar with initials */}
            <div className="flex justify-center">
              <div className="w-16 h-16 rounded-full mova-gradient flex items-center justify-center shadow-lg shadow-emerald-500/20">
                <span className="text-2xl font-bold text-white">
                  {formData.firstName.charAt(0).toUpperCase()}
                  {formData.lastName.charAt(0).toUpperCase()}
                </span>
              </div>
            </div>

            {/* Name */}
            <div className="text-center">
              <p className="text-lg font-semibold text-foreground">
                {formData.firstName} {formData.lastName}
              </p>
              <div className="flex items-center justify-center gap-2 mt-1">
                <Phone className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                  +224 {formData.phone}
                </span>
              </div>
            </div>

            <Separator />

            {/* Role */}
            <div className="flex items-center justify-between px-2">
              <span className="text-sm text-muted-foreground">Role</span>
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/30">
                {roleIcons[selectedRole]}
                <span className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
                  {roleLabels[selectedRole]}
                </span>
              </div>
            </div>

            {formData.email && (
              <div className="flex items-center justify-between px-2">
                <span className="text-sm text-muted-foreground">Email</span>
                <span className="text-sm font-medium text-foreground">{formData.email}</span>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Start button */}
      <motion.div variants={fadeUp} transition={{ delay: 0.4 }}>
        <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }}>
          <Button
            onClick={onStart}
            className="w-full h-14 text-base font-semibold mova-gradient text-white shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 transition-all duration-300 rounded-xl"
          >
            Commencer avec MOVA
            <ArrowRight className="ml-2 w-5 h-5" />
          </Button>
        </motion.div>
      </motion.div>
    </motion.div>
  )
}

// ─── Background Decorations ─────────────────────────────────────────────────

function BackgroundDecorations() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <div className="absolute top-0 left-0 w-full h-full">
        <motion.div
          animate={{ x: [0, 30, 0], y: [0, -20, 0], rotate: [0, 5, 0] }}
          transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
          className="absolute -top-20 -left-20 w-72 h-72 rounded-full bg-emerald-200/30 dark:bg-emerald-900/10 blur-3xl"
        />
        <motion.div
          animate={{ x: [0, -20, 0], y: [0, 30, 0] }}
          transition={{ duration: 25, repeat: Infinity, ease: 'linear' }}
          className="absolute -top-10 -right-10 w-80 h-80 rounded-full bg-amber-200/20 dark:bg-amber-900/10 blur-3xl"
        />
        <motion.div
          animate={{ x: [0, 15, 0], y: [0, -15, 0] }}
          transition={{ duration: 18, repeat: Infinity, ease: 'linear' }}
          className="absolute top-32 left-1/2 -translate-x-1/2 w-56 h-56 rounded-full bg-emerald-100/20 dark:bg-emerald-800/10 blur-2xl"
        />
        <motion.div
          animate={{ x: [0, -25, 0], y: [0, 20, 0] }}
          transition={{ duration: 22, repeat: Infinity, ease: 'linear' }}
          className="absolute bottom-20 left-10 w-48 h-48 rounded-full bg-emerald-200/15 dark:bg-emerald-900/8 blur-2xl"
        />
      </div>
    </div>
  )
}

// ─── Main Auth View ─────────────────────────────────────────────────────────

export default function AuthView() {
  const [currentStep, setCurrentStep] = useState(STEP_WELCOME)
  const [direction, setDirection] = useState(1)
  const [loading, setLoading] = useState(false)
  const [selectedRole, setSelectedRole] = useState<Role>('passenger')

  // Form data for sign up
  const [formData, setFormData] = useState<FormData>({
    phone: '',
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
    acceptedTerms: false,
  })

  // Vehicle data for driver registration
  const [vehicleData, setVehicleData] = useState<VehicleData>({
    type: 'standard',
    brand: '',
    model: '',
    year: '',
    plateNumber: '',
    color: '',
  })

  // Phone stored for login flow
  const [loginPhone, setLoginPhone] = useState('')

  // Store access
  const { loginAs, setView } = useAppStore()

  // Step navigation helpers
  const goForward = useCallback(() => setDirection(1), [])
  const goBackward = useCallback(() => setDirection(-1), [])

  const navigateTo = useCallback(
    (step: number) => {
      setDirection(step > currentStep ? 1 : -1)
      setCurrentStep(step)
    },
    [currentStep]
  )

  // Handle login flow
  const handleLoginPhoneSubmit = useCallback(
    (phone: string) => {
      setLoginPhone(phone)
      goForward()
      setCurrentStep(STEP_LOGIN_OTP)
    },
    [goForward]
  )

  const handleLoginOTPVerified = useCallback(() => {
    goForward()
    setCurrentStep(STEP_LOGIN_SUCCESS)
  }, [goForward])

  const handleRoleSelected = useCallback(
    (role: Role) => {
      setSelectedRole(role)
      setLoading(true)
      setTimeout(() => {
        setLoading(false)
        loginAs(role)
        setView('hub')
        toast.success(
          `Bienvenue ! Connecte en tant que ${
            role === 'passenger'
              ? 'Passager'
              : role === 'driver'
              ? 'Chauffeur'
              : role === 'livreur'
              ? 'Livreur'
              : 'Entreprise'
          }`
        )
      }, 500)
    },
    [loginAs, setView]
  )

  // Handle sign up flow
  const handleSignupOTPVerified = useCallback(() => {
    goForward()
    if (selectedRole === 'driver' || selectedRole === 'livreur') {
      setCurrentStep(STEP_SIGNUP_VEHICLE)
    } else {
      setCurrentStep(STEP_COMPLETE)
    }
  }, [goForward, selectedRole])

  const handleVehicleComplete = useCallback(() => {
    goForward()
    setCurrentStep(STEP_COMPLETE)
  }, [goForward])

  const handleComplete = useCallback(() => {
    setLoading(true)
    setTimeout(() => {
      setLoading(false)
      loginAs(selectedRole)
      setView('hub')
      toast.success(
        `Votre compte est pret ! Bienvenue, ${formData.firstName} !`
      )
    }, 500)
  }, [loginAs, setView, selectedRole, formData.firstName])

  // Handle guest access
  const handleGuestAccess = useCallback(() => {
    setView('hub')
    toast.info('Bienvenue ! Explorez MOVA en mode invite')
  }, [setView])

  // Forgot password handler (decorative)
  const handleForgotPassword = useCallback(() => {
    toast.info('Un lien de reinitialisation vous sera envoye par SMS')
  }, [])

  // Progress steps config based on current flow
  const getProgressConfig = useCallback((): {
    totalSteps: number
    currentProgress: number
    labels: string[]
  } => {
    // Login flow
    if (
      currentStep >= STEP_LOGIN_PHONE &&
      currentStep <= STEP_LOGIN_SUCCESS
    ) {
      const loginSteps = ['Telephone', 'Code', 'Profil']
      const progressInFlow = currentStep - STEP_LOGIN_PHONE
      return {
        totalSteps: loginSteps.length,
        currentProgress: progressInFlow,
        labels: loginSteps,
      }
    }
    // Sign up flow
    if (currentStep >= STEP_SIGNUP_INFO && currentStep <= STEP_COMPLETE) {
      const signupSteps =
        selectedRole === 'driver' || selectedRole === 'livreur'
          ? ['Informations', 'Role', 'Code', 'Vehicule', 'Pret']
          : ['Informations', 'Role', 'Code', 'Pret']
      const progressInFlow = currentStep - STEP_SIGNUP_INFO
      return {
        totalSteps: signupSteps.length,
        currentProgress: progressInFlow,
        labels: signupSteps,
      }
    }
    // Welcome (no progress bar)
    return { totalSteps: 1, currentProgress: 0, labels: [] }
  }, [currentStep, selectedRole])

  const { totalSteps, currentProgress, labels } = getProgressConfig()
  const showProgress = labels.length > 0

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-emerald-50 via-white to-white dark:from-emerald-950/20 dark:via-background dark:to-background" />

      {/* Decorative background elements */}
      <BackgroundDecorations />

      {/* Content area */}
      <div className="relative z-10 flex flex-col min-h-screen">
        {/* Progress indicator */}
        <AnimatePresence>
          {showProgress && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
              className="pt-6 pb-4"
            >
              <ProgressBar
                currentStep={currentProgress}
                totalSteps={totalSteps}
                steps={labels}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main content - centered */}
        <div className="flex-1 flex items-start justify-center">
          <div
            className="w-full py-4 flex items-center justify-center"
            style={{ minHeight: 'calc(100vh - 120px)' }}
          >
            <AnimatePresence mode="wait" custom={direction}>
              {/* Step 0: Welcome */}
              {currentStep === STEP_WELCOME && (
                <motion.div
                  key="step-welcome"
                  custom={direction}
                  variants={slideVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ duration: 0.35, ease: 'easeInOut' }}
                  className="w-full"
                >
                  <StepWelcome
                    onLogin={() => navigateTo(STEP_LOGIN_PHONE)}
                    onSignup={() => navigateTo(STEP_SIGNUP_INFO)}
                    onGuest={handleGuestAccess}
                  />
                </motion.div>
              )}

              {/* Step 1: Login — Phone */}
              {currentStep === STEP_LOGIN_PHONE && (
                <motion.div
                  key="step-login-phone"
                  custom={direction}
                  variants={slideVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ duration: 0.35, ease: 'easeInOut' }}
                  className="w-full"
                >
                  <StepLoginPhone
                    onContinue={handleLoginPhoneSubmit}
                    onBack={() => navigateTo(STEP_WELCOME)}
                    onForgotPassword={handleForgotPassword}
                    onGoSignup={() => navigateTo(STEP_SIGNUP_INFO)}
                  />
                </motion.div>
              )}

              {/* Step 2: Login — OTP */}
              {currentStep === STEP_LOGIN_OTP && (
                <motion.div
                  key="step-login-otp"
                  custom={direction}
                  variants={slideVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ duration: 0.35, ease: 'easeInOut' }}
                  className="w-full"
                >
                  <StepOTP
                    phone={loginPhone}
                    title="Verification"
                    subtitle="Entrez le code envoye au"
                    onVerified={handleLoginOTPVerified}
                    onBack={() => navigateTo(STEP_LOGIN_PHONE)}
                    onModifyNumber={() => navigateTo(STEP_LOGIN_PHONE)}
                  />
                </motion.div>
              )}

              {/* Step 3: Login — Success / Select Role */}
              {currentStep === STEP_LOGIN_SUCCESS && (
                <motion.div
                  key="step-login-success"
                  custom={direction}
                  variants={slideVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ duration: 0.35, ease: 'easeInOut' }}
                  className="w-full"
                >
                  <StepSelectRole
                    userName={formData.firstName || 'Utilisateur'}
                    onRoleSelected={handleRoleSelected}
                    onSkip={() => {
                      loginAs('passenger')
                      setView('hub')
                      toast.info('Vous pourrez choisir votre role plus tard')
                    }}
                  />
                </motion.div>
              )}

              {/* Step 4: Sign Up — Info */}
              {currentStep === STEP_SIGNUP_INFO && (
                <motion.div
                  key="step-signup-info"
                  custom={direction}
                  variants={slideVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ duration: 0.35, ease: 'easeInOut' }}
                  className="w-full"
                >
                  <StepSignupInfo
                    onContinue={() => {
                      goForward()
                      setCurrentStep(STEP_SIGNUP_ROLE)
                    }}
                    onBack={() => navigateTo(STEP_WELCOME)}
                    formData={formData}
                    setFormData={setFormData}
                  />
                </motion.div>
              )}

              {/* Step 5: Sign Up — Select Role */}
              {currentStep === STEP_SIGNUP_ROLE && (
                <motion.div
                  key="step-signup-role"
                  custom={direction}
                  variants={slideVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ duration: 0.35, ease: 'easeInOut' }}
                  className="w-full"
                >
                  <StepSelectRole
                    userName={formData.firstName}
                    onRoleSelected={(role) => {
                      setSelectedRole(role)
                      goForward()
                      setCurrentStep(STEP_SIGNUP_OTP)
                    }}
                    onSkip={() => {
                      goForward()
                      setCurrentStep(STEP_SIGNUP_OTP)
                    }}
                  />
                </motion.div>
              )}

              {/* Step 6: Sign Up — OTP */}
              {currentStep === STEP_SIGNUP_OTP && (
                <motion.div
                  key="step-signup-otp"
                  custom={direction}
                  variants={slideVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ duration: 0.35, ease: 'easeInOut' }}
                  className="w-full"
                >
                  <StepOTP
                    phone={`+224${formData.phone}`}
                    title="Verification"
                    subtitle="Entrez le code envoye au"
                    onVerified={handleSignupOTPVerified}
                    onBack={() => navigateTo(STEP_SIGNUP_ROLE)}
                    onModifyNumber={() => navigateTo(STEP_SIGNUP_INFO)}
                  />
                </motion.div>
              )}

              {/* Step 7: Sign Up — Vehicle (drivers & livreurs only) */}
              {currentStep === STEP_SIGNUP_VEHICLE && (
                <motion.div
                  key="step-signup-vehicle"
                  custom={direction}
                  variants={slideVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ duration: 0.35, ease: 'easeInOut' }}
                  className="w-full"
                >
                  <StepVehicleRegistration
                    onContinue={handleVehicleComplete}
                    onSkip={() => {
                      goForward()
                      setCurrentStep(STEP_COMPLETE)
                    }}
                    vehicleData={vehicleData}
                    setVehicleData={setVehicleData}
                  />
                </motion.div>
              )}

              {/* Step 8: Complete */}
              {currentStep === STEP_COMPLETE && (
                <motion.div
                  key="step-complete"
                  custom={direction}
                  variants={slideVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ duration: 0.35, ease: 'easeInOut' }}
                  className="w-full"
                >
                  <StepComplete
                    formData={formData}
                    selectedRole={selectedRole}
                    onStart={handleComplete}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Footer */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="relative z-10 pb-6 text-center"
        >
          <p className="text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()} MOVA — Mobilite pour tous en
            Guinee
          </p>
        </motion.div>
      </div>

      {/* Global loading overlay */}
      <AnimatePresence>
        {loading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center"
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              className="flex flex-col items-center gap-4"
            >
              <div className="w-16 h-16 rounded-full mova-gradient flex items-center justify-center shadow-lg shadow-emerald-500/30">
                <Loader2 className="w-8 h-8 text-white animate-spin" />
              </div>
              <p className="text-sm text-muted-foreground font-medium">
                Chargement...
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
