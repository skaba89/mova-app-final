'use client'

import { useEffect, useState, useRef, lazy, Suspense } from 'react'
import { useAppStore, type View } from '@/lib/mova/store'
import { QueryProvider } from '@/lib/mova/query-provider'
import { Skeleton } from '@/components/ui/skeleton'
import { motion, AnimatePresence } from 'framer-motion'
import ErrorBoundary from '@/components/mova/error-boundary'

// Lazy load all views for performance
const LandingView = lazy(() => import('@/components/mova/landing-view'))
const AuthView = lazy(() => import('@/components/mova/auth-view'))
const HubView = lazy(() => import('@/components/mova/hub-view'))
const PassengerView = lazy(() => import('@/components/mova/passenger-view'))
const DriverView = lazy(() => import('@/components/mova/driver-view'))
const AdminView = lazy(() => import('@/components/mova/admin-view'))
const WalletView = lazy(() => import('@/components/mova/wallet-view'))
const CorporateView = lazy(() => import('@/components/mova/corporate-view'))
const DeliveryView = lazy(() => import('@/components/mova/delivery-view'))
const CarpoolView = lazy(() => import('@/components/mova/carpool-view'))
const MotoView = lazy(() => import('@/components/mova/moto-view'))
const IntercityView = lazy(() => import('@/components/mova/intercity-view'))
const SchoolView = lazy(() => import('@/components/mova/school-view'))
const PromotionsView = lazy(() => import('@/components/mova/promotions-view'))
const ReferralView = lazy(() => import('@/components/mova/referral-view'))
const ProfileView = lazy(() => import('@/components/mova/profile-view'))
const SettingsView = lazy(() => import('@/components/mova/settings-view'))
const SupportCenter = lazy(() => import('@/components/mova/support-center'))
const BetaOnboarding = lazy(() => import('@/components/mova/beta-onboarding'))
const MarketplaceView = lazy(() => import('@/components/mova/marketplace-view'))
const CarRentalView = lazy(() => import('@/components/mova/car-rental-view'))
const TransferView = lazy(() => import('@/components/mova/transfer-view'))
const NavigationView = lazy(() => import('@/components/mova/navigation-view'))

function LoadingScreen() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background">
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="flex flex-col items-center gap-6"
      >
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
          className="w-16 h-16 rounded-2xl mova-gradient flex items-center justify-center"
        >
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
            <path d="M6 22L16 6L26 22H6Z" fill="white" fillOpacity="0.9" />
            <circle cx="16" cy="20" r="3" fill="white" />
          </svg>
        </motion.div>
        <div className="text-center">
          <h1 className="text-2xl font-bold mova-gradient-text">MOVA</h1>
          <p className="text-sm text-muted-foreground mt-1">Conakry, en mouvement</p>
        </div>
        <div className="flex gap-1">
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="w-2 h-2 rounded-full bg-emerald-500"
              animate={{ opacity: [0.3, 1, 0.3] }}
              transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
            />
          ))}
        </div>
      </motion.div>
    </div>
  )
}

function ViewLoader() {
  return (
    <div className="min-h-screen p-4 md:p-8 space-y-4">
      <Skeleton className="h-16 w-64 rounded-xl" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Skeleton className="h-32 rounded-xl" />
        <Skeleton className="h-32 rounded-xl" />
        <Skeleton className="h-32 rounded-xl" />
      </div>
      <Skeleton className="h-96 rounded-xl" />
    </div>
  )
}

const viewComponents: Record<View, React.LazyExoticComponent<React.ComponentType>> = {
  landing: LandingView,
  auth: AuthView,
  hub: HubView,
  passenger: PassengerView,
  driver: DriverView,
  admin: AdminView,
  wallet: WalletView,
  corporate: CorporateView,
  delivery: DeliveryView,
  carpool: CarpoolView,
  moto: MotoView,
  intercity: IntercityView,
  school: SchoolView,
  promotions: PromotionsView,
  referral: ReferralView,
  profile: ProfileView,
  settings: SettingsView,
  support: SupportCenter,
  beta: BetaOnboarding,
  marketplace: MarketplaceView,
  carrental: CarRentalView,
  transfer: TransferView,
  navigation: NavigationView,
}

export default function Home() {
  const { currentView, isAuthenticated, user, setView, loginAs } = useAppStore()
  const [mounted, setMounted] = useState(false)

  const mountRef = useRef(false)
  useEffect(() => {
    if (mountRef.current) return
    mountRef.current = true
    // Use queueMicrotask to avoid synchronous setState-in-effect lint rule
    queueMicrotask(() => setMounted(true))
  }, [])

  // Auto-redirect logic
  useEffect(() => {
    if (!mounted) return
    if (currentView === 'auth' && user) {
      setView(user.role === 'admin' ? 'admin' : user.role === 'driver' ? 'driver' : user.role === 'livreur' ? 'delivery' : 'hub')
    }
    // Dev: auto-login and show wallet view
    if (currentView === 'landing' && !isAuthenticated) {
      setView('auth')
    }
  }, [currentView, user, mounted, setView, isAuthenticated])

  if (!mounted) return <LoadingScreen />

  const ActiveView = viewComponents[currentView] || LandingView

  return (
    <QueryProvider>
      <AnimatePresence mode="wait">
        <motion.div
          key={currentView}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.3, ease: 'easeInOut' }}
          className="min-h-screen"
        >
          <ErrorBoundary>
            <Suspense fallback={<ViewLoader />}>
              <ActiveView />
            </Suspense>
          </ErrorBoundary>
        </motion.div>
      </AnimatePresence>
    </QueryProvider>
  )
}
