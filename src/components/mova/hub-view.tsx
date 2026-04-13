'use client'

import { useEffect, useState } from 'react'
import { useAppStore } from '@/lib/mova/store'
import { useNotifications } from '@/lib/mova/use-notifications'
import { toast } from 'sonner'
import { useTheme } from 'next-themes'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Car, Bike, Package, Users, Calendar,
  Wallet, Gift, UserPlus, Building2, GraduationCap,
  Headphones, Home, Building, Bell, Shield, MapPin,
  ChevronRight, Clock, ArrowRight, Star, Zap,
  Plane, Phone, Moon, Sun, Download,
  Tag, Copy, CopyCheck, Share2, Mail, MessageCircle,
  Route, Check, Loader2, X,
  ShoppingBag, Timer, TrendingUp, Truck, Send, Navigation
} from 'lucide-react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import NotificationPanel from "@/components/mova/notification-panel"
import LoyaltyPanel from "@/components/mova/loyalty-panel"
import { LoyaltyBadge } from "@/components/mova/loyalty-badge"
import AssistantPanel from "@/components/mova/assistant-panel"
import { Trophy, Flame, Sparkles } from 'lucide-react'
import { usePwaInstall } from "@/lib/mova/use-pwa-install"
import { LanguageSelector } from "@/components/mova/language-selector"
import { useAnalytics, usePromotions, useRides } from '@/lib/mova/api-hooks'

interface ServiceItem {
  id: string
  name: string
  icon: React.ReactNode
  color: string
  view?: string
  badge?: string
  badgeColor?: string
  comingSoon?: boolean
  action?: () => void
  highDemand?: boolean
  waitMin?: number
}

export default function HubView() {
  const { user, setView, loginAs, logout, loyaltyPoints, loyaltyTier, loyaltyStreak, setPendingViewTab, setSelectedVehicleType, setPickupAddress } = useAppStore()
  const { unreadCount } = useNotifications()
  const { theme, setTheme } = useTheme()
  const { isInstallable, install } = usePwaInstall()
  const [mounted, setMounted] = useState(false)
  const [showNotifications, setShowNotifications] = useState(false)
  const [showLoyalty, setShowLoyalty] = useState(false)
  const [showAssistant, setShowAssistant] = useState(false)
  const [showReferral, setShowReferral] = useState(false)
  const [showSupport, setShowSupport] = useState(false)
  const [referralCopied, setReferralCopied] = useState(false)
  const [promoCopied, setPromoCopied] = useState(false)
  const [tripSharingEnabled, setTripSharingEnabled] = useState(false)
  const [showAllServices, setShowAllServices] = useState(false)

  useEffect(() => { queueMicrotask(() => setMounted(true)) }, [])

  const firstName = user?.name?.split(' ')[0] || 'Utilisateur'

  // ─── Live API Data ───────────────────────────────────────────────
  const { data: analyticsData, isLoading: analyticsLoading } = useAnalytics()
  const { data: promotionsData, isLoading: promosLoading } = usePromotions(true)
  const { data: ridesData, isLoading: ridesLoading } = useRides({ limit: 5 })

  const stats = analyticsData?.stats
  const ridesByZone = analyticsData?.ridesByZone ?? []
  const recentRides = ridesData?.rides ?? analyticsData?.recentRides ?? []
  const promotions = promotionsData ?? []
  const latestPromo = promotions.length > 0 ? promotions[0] : null

  // Compute zone-based wait time (minutes) from analytics
  const userZone = user?.zone || 'Kaloum'
  const zoneRides = ridesByZone.find((z) => z.zone === userZone)
  const estimatedWaitMin = stats?.activeDrivers && stats.activeDrivers > 0
    ? Math.max(3, Math.round(15 - (stats.activeDrivers * 0.8) + (zoneRides?.count ?? 0) * 0.3))
    : 10

  // Compute demand level for services
  const highDemand = (zoneRides?.count ?? 0) > 5

  // ─── Helpers ─────────────────────────────────────────────────────
  const formatGNF = (amount: number) => {
    return new Intl.NumberFormat('fr-FR').format(amount) + ' GNF'
  }

  const formatRelativeTime = (dateStr: Date | string) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMin = Math.floor(diffMs / 60_000)
    const diffH = Math.floor(diffMs / 3_600_000)
    const diffD = Math.floor(diffMs / 86_400_000)
    if (diffMin < 1) return 'A l\'instant'
    if (diffMin < 60) return `il y a ${diffMin} min`
    if (diffH < 24) return `il y a ${diffH}h`
    if (diffD < 7) return `il y a ${diffD}j`
    return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
  }

  // Gradient styles for promotion cards
  const promoGradients = [
    'mova-gradient',
    'bg-gradient-to-br from-amber-500 to-emerald-600',
    'bg-gradient-to-br from-emerald-600 to-emerald-800',
    'bg-gradient-to-br from-amber-400 to-amber-600',
    'bg-gradient-to-br from-emerald-500 to-teal-600',
  ]

  const promoBtnStyles = [
    'bg-white text-emerald-700 hover:bg-white/90',
    'bg-white text-amber-700 hover:bg-white/90',
    'bg-white text-emerald-700 hover:bg-white/90',
    'bg-white text-amber-800 hover:bg-white/90',
    'bg-white text-teal-700 hover:bg-white/90',
  ]

  const services: ServiceItem[] = [
    { id: 'vtc', name: 'VTC / Course', icon: <Car className="h-6 w-6" />, color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400', view: 'passenger', highDemand, waitMin: estimatedWaitMin },
    { id: 'moto', name: 'Moto-Taxi', icon: <Bike className="h-6 w-6" />, color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400', badge: 'Nouveau', badgeColor: 'bg-emerald-100 text-emerald-700', waitMin: estimatedWaitMin + 2, action: () => { setSelectedVehicleType('moto'); setView('passenger') } },
    { id: 'delivery', name: 'Livraison', icon: <Package className="h-6 w-6" />, color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400', view: 'delivery', badge: 'Populaire', badgeColor: 'bg-emerald-100 text-emerald-700', highDemand: highDemand, waitMin: estimatedWaitMin + 5 },
    { id: 'carpool', name: 'Covoiturage', icon: <Users className="h-6 w-6" />, color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400', view: 'carpool', badge: 'Nouveau', badgeColor: 'bg-emerald-100 text-emerald-700', waitMin: estimatedWaitMin + 10 },
    { id: 'intercity', name: 'Interurbain', icon: <Plane className="h-6 w-6" />, color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400', badge: 'Nouveau', badgeColor: 'bg-emerald-100 text-emerald-700', view: 'intercity' },
    { id: 'scheduled', name: 'Reservation', icon: <Calendar className="h-6 w-6" />, color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400', badge: 'Nouveau', badgeColor: 'bg-emerald-100 text-emerald-700', action: () => { setPendingViewTab('scheduled'); setView('passenger') } },
    { id: 'wallet', name: 'Mon Wallet', icon: <Wallet className="h-6 w-6" />, color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400', view: 'wallet' },
    { id: 'promos', name: 'Promotions', icon: <Gift className="h-6 w-6" />, color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400', action: () => toast.success('3 promotions actives !') },
    { id: 'corporate', name: 'Mon Entreprise', icon: <Building2 className="h-6 w-6" />, color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400', view: 'corporate' },
    { id: 'referral', name: 'Parrainage', icon: <UserPlus className="h-6 w-6" />, color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400', action: () => setShowReferral(true) },
    { id: 'school', name: 'Transport Scolaire', icon: <GraduationCap className="h-6 w-6" />, color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400', badge: 'Nouveau', badgeColor: 'bg-emerald-100 text-emerald-700', view: 'school' },
    { id: 'marketplace', name: 'Marketplace', icon: <ShoppingBag className="h-6 w-6" />, color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400', view: 'marketplace', badge: 'Nouveau', badgeColor: 'bg-emerald-100 text-emerald-700' },
    { id: 'carrental', name: 'Location Voiture', icon: <Truck className="h-6 w-6" />, color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400', view: 'carrental', badge: 'Nouveau', badgeColor: 'bg-blue-100 text-blue-700' },
    { id: 'transfer', name: 'Transfert Argent', icon: <Send className="h-6 w-6" />, color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400', view: 'transfer', badge: 'Nouveau', badgeColor: 'bg-purple-100 text-purple-700' },
    { id: 'navigation', name: 'Navigation GPS', icon: <Navigation className="h-6 w-6" />, color: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400', view: 'navigation', badge: 'Nouveau', badgeColor: 'bg-teal-100 text-teal-700' },
    { id: 'help', name: 'Aide & Support', icon: <Headphones className="h-6 w-6" />, color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400', action: () => setShowSupport(true) },
  ]

  const handleServiceClick = (service: ServiceItem) => {
    if (service.comingSoon) {
      toast.info(`${service.name} sera disponible prochainement. Restez connecte pour etre parmi les premiers informs.`)
      return
    }
    if (service.view) {
      setView(service.view as 'passenger' | 'driver' | 'admin' | 'wallet' | 'corporate' | 'delivery' | 'marketplace' | 'carpool' | 'intercity' | 'moto' | 'school' | 'carrental' | 'transfer' | 'navigation')
      return
    }
    if (service.action) {
      service.action()
    }
  }

  if (!mounted) return null

  return (
    <div className="min-h-screen pb-20 sm:pb-8">
      {/* HEADER */}
      <header className="sticky top-0 z-50 mova-glass border-b border-border/50">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl mova-gradient flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <svg width="20" height="20" viewBox="0 0 32 32" fill="none">
                <path d="M6 22L16 6L26 22H6Z" fill="white" fillOpacity="0.95" />
                <circle cx="16" cy="20" r="3" fill="white" fillOpacity="0.7" />
              </svg>
            </div>
            <div>
              <h1 className="text-lg font-bold text-foreground">Bonjour, {firstName}</h1>
              <button className="text-xs text-muted-foreground flex items-center gap-1 hover:text-emerald-600 transition-colors">
                <MapPin className="h-3 w-3 text-emerald-500" />
                {user?.zone || 'Kaloum'}, Conakry
                <ChevronRight className="h-3 w-3" />
              </button>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowLoyalty(true)} aria-label="Fidelite MOVA">
              <LoyaltyBadge tier={loyaltyTier} points={loyaltyPoints} showPoints={false} compact />
            </button>
            <LanguageSelector />
            {isInstallable && (
              <Button variant="outline" size="sm" className="gap-1.5 text-xs border-emerald-300 text-emerald-700 dark:border-emerald-700 dark:text-emerald-300 rounded-lg" onClick={() => { install(); toast.success('MOVA installee sur votre appareil !'); }}>
                <Download className="size-3.5" />
                Installer
              </Button>
            )}
            <button onClick={() => setShowNotifications(true)} className="relative">
              <Bell className="size-5" />
              {unreadCount > 0 && <span className="absolute -top-1 -right-1 size-4 rounded-full bg-red-500 text-[10px] text-white flex items-center justify-center font-bold">{unreadCount > 9 ? '9+' : unreadCount}</span>}
            </button>
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
              className="rounded-full bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400"
              onClick={() => logout()}
            >
              <span className="text-xs font-bold">{firstName[0]}</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-4 space-y-5">

        {/* QUICK RIDE CTA */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
          <Card className="mova-gradient text-white overflow-hidden shadow-xl shadow-emerald-500/20 cursor-pointer hover:shadow-2xl transition-shadow"
            onClick={() => setView('passenger')}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center">
                  <MapPin className="h-6 w-6 text-white" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-white/80">Où allez-vous ?</p>
                  <p className="text-white/60 text-xs mt-0.5">Réservez en quelques secondes</p>
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" className="text-white/90 hover:bg-white/20 hover:text-white rounded-lg"
                    onClick={(e) => { e.stopPropagation(); setPickupAddress('Cite des Enseignants, Ratoma'); toast.success('Depart : Maison'); setView('passenger') }}>
                    <Home className="h-4 w-4 mr-1" /> Maison
                  </Button>
                  <Button variant="ghost" size="sm" className="text-white/90 hover:bg-white/20 hover:text-white rounded-lg"
                    onClick={(e) => { e.stopPropagation(); setPickupAddress('Centre-ville, Kaloum'); toast.success('Depart : Bureau'); setView('passenger') }}>
                    <Building className="h-4 w-4 mr-1" /> Bureau
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* PROMO BANNER */}
        {!promosLoading && latestPromo && (
          <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}>
            <Card className="mova-gradient text-white overflow-hidden shadow-lg shadow-emerald-500/10">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="w-11 h-11 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center flex-shrink-0">
                    <Zap className="h-5 w-5 text-amber-300" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge className="bg-white/20 text-white border-0 text-xs">{latestPromo.code}</Badge>
                      <span className="text-sm font-bold">
                        {latestPromo.discountType === 'percentage'
                          ? `${latestPromo.discountValue}% de reduction`
                          : `${formatGNF(latestPromo.discountValue)} de reduction`}
                      </span>
                    </div>
                    <p className="text-xs text-white/80 mt-1 line-clamp-1">{latestPromo.description}</p>
                    <p className="text-[10px] text-white/50 mt-0.5">
                      Expire le {new Date(latestPromo.endDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
                      {latestPromo.remainingUses !== null && latestPromo.remainingUses > 0 && (
                        <span className="ml-2">{latestPromo.remainingUses} reste{latestPromo.remainingUses > 1 ? 's' : ''}</span>
                      )}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    className={`flex-shrink-0 rounded-xl font-semibold shadow-md ${promoCopied ? 'bg-emerald-400 text-white' : 'bg-white text-emerald-700 hover:bg-white/90'}`}
                    onClick={async () => {
                      await navigator.clipboard.writeText(latestPromo.code)
                      setPromoCopied(true)
                      toast.success('Code promo copie !')
                      setTimeout(() => setPromoCopied(false), 2000)
                    }}
                  >
                    {promoCopied ? <CopyCheck className="h-3.5 w-3.5 mr-1" /> : <Copy className="h-3.5 w-3.5 mr-1" />}
                    {promoCopied ? 'Copie' : 'Copier le code'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.section>
        )}

        {/* SERVICES GRID */}
        <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold flex items-center gap-2">
              <Zap className="h-4 w-4 text-emerald-500" />
              Nos Services
              <Badge variant="secondary" className="text-xs font-normal ml-1">{services.length}</Badge>
            </h2>
            <button className="text-xs text-emerald-600 font-medium hover:underline" onClick={() => setShowAllServices(true)}>Voir tout</button>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
            {services.slice(0, 12).map((service, i) => (
              <motion.button
                key={service.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.1 + i * 0.03 }}
                whileHover={{ scale: 1.07 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => handleServiceClick(service)}
                className={`relative flex flex-col items-center gap-1.5 p-3 rounded-2xl transition-all ${
                  service.comingSoon
                    ? 'bg-muted/50 opacity-80'
                    : 'bg-card hover:bg-accent hover:shadow-md border border-border shadow-sm'
                }`}
              >
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${service.color}`}>
                  {service.icon}
                </div>
                <span className="text-xs font-medium text-center leading-tight text-foreground">
                  {service.name}
                </span>
                {service.waitMin != null && !analyticsLoading && (
                  <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                    <Timer className="h-2.5 w-2.5" />
                    {service.waitMin} min
                  </span>
                )}
                {service.badge && (
                  <span className={`absolute -top-1 -right-1 text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${service.badgeColor || 'bg-emerald-100 text-emerald-700'}`}>
                    {service.badge}
                  </span>
                )}
                {service.highDemand && !service.badge && (
                  <span className="absolute -top-1 -right-1 text-[9px] px-1.5 py-0.5 rounded-full font-semibold bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 flex items-center gap-0.5">
                    <TrendingUp className="h-2 w-2" />
                    Forte demande
                  </span>
                )}
                {service.comingSoon && (
                  <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-amber-400" />
                )}
              </motion.button>
            ))}
          </div>
          {/* Show remaining services on mobile if there are more than 12 */}
          {services.length > 12 && (
            <div className="mt-3 sm:hidden">
              <div className="grid grid-cols-3 gap-3">
                {services.slice(12).map((service, i) => (
                  <motion.button
                    key={service.id}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.1 + i * 0.03 }}
                    whileHover={{ scale: 1.07 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => handleServiceClick(service)}
                    className={`relative flex flex-col items-center gap-1.5 p-3 rounded-2xl transition-all ${
                      service.comingSoon
                        ? 'bg-muted/50 opacity-80'
                        : 'bg-card hover:bg-accent hover:shadow-md border border-border shadow-sm'
                    }`}
                  >
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${service.color}`}>
                      {service.icon}
                    </div>
                    <span className="text-xs font-medium text-center leading-tight text-foreground">
                      {service.name}
                    </span>
                    {service.waitMin != null && !analyticsLoading && (
                      <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                        <Timer className="h-2.5 w-2.5" />
                        {service.waitMin} min
                      </span>
                    )}
                    {service.badge && (
                      <span className={`absolute -top-1 -right-1 text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${service.badgeColor || 'bg-emerald-100 text-emerald-700'}`}>
                        {service.badge}
                      </span>
                    )}
                    {service.highDemand && !service.badge && (
                      <span className="absolute -top-1 -right-1 text-[9px] px-1.5 py-0.5 rounded-full font-semibold bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 flex items-center gap-0.5">
                        <TrendingUp className="h-2 w-2" />
                        Forte demande
                      </span>
                    )}
                    {service.comingSoon && (
                      <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-amber-400" />
                    )}
                  </motion.button>
                ))}
              </div>
            </div>
          )}
        </motion.section>

        {/* OFFERS CAROUSEL */}
        <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold flex items-center gap-2">
              <Zap className="h-4 w-4 text-amber-500" />
              Offres du moment
              {!promosLoading && promotions.length > 0 && (
                <Badge variant="secondary" className="text-xs font-normal ml-1">{promotions.length}</Badge>
              )}
            </h2>
            <button className="text-xs text-emerald-600 font-medium hover:underline" onClick={() => setView('promotions')}>Voir tout</button>
          </div>
          {promosLoading ? (
            <div className="flex gap-3 pb-3 overflow-x-auto">
              {[0, 1, 2].map((i) => (
                <Card key={i} className="min-w-[280px] flex-shrink-0 overflow-hidden border-0 shadow-lg">
                  <div className="p-4 space-y-3">
                    <Skeleton className="h-5 w-24 bg-white/20" />
                    <Skeleton className="h-6 w-48 bg-white/20" />
                    <Skeleton className="h-4 w-full bg-white/20" />
                    <Skeleton className="h-9 w-28 rounded-xl bg-white/20" />
                  </div>
                </Card>
              ))}
            </div>
          ) : promotions.length > 0 ? (
            <ScrollArea className="w-full">
              <div className="flex gap-3 pb-3">
                {promotions.map((promo, i) => {
                  const gradientIdx = i % promoGradients.length
                  const discountLabel = promo.discountType === 'percentage'
                    ? `${promo.discountValue}% de reduction`
                    : `${formatGNF(promo.discountValue)} de reduction`
                  return (
                    <Card key={promo.id} className="min-w-[280px] flex-shrink-0 overflow-hidden border-0 shadow-lg">
                      <div className={`${promoGradients[gradientIdx]} p-4 text-white`}>
                        <Badge className="bg-white/20 text-white border-0 mb-2">{promo.code}</Badge>
                        <h3 className="font-bold text-lg">{discountLabel}</h3>
                        <p className="text-sm text-white/80 mt-1">{promo.description}</p>
                        {promo.remainingUses !== null && (
                          <p className="text-xs text-white/60 mt-1">
                            {promo.remainingUses > 0 ? `${promo.remainingUses} utilisation${promo.remainingUses > 1 ? 's' : ''} restante${promo.remainingUses > 1 ? 's' : ''}` : 'Utilisations illimitees'}
                          </p>
                        )}
                        <Button className={`mt-3 ${promoBtnStyles[gradientIdx]} font-semibold rounded-xl shadow-lg`}>
                          <Tag className="h-3.5 w-3.5 mr-1" />
                          Utiliser <ArrowRight className="h-4 w-4 ml-1" />
                        </Button>
                      </div>
                    </Card>
                  )
                })}
              </div>
              <ScrollBar orientation="horizontal" />
            </ScrollArea>
          ) : (
            <Card className="p-6 text-center">
              <Gift className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Aucune promotion active pour le moment</p>
              <p className="text-xs text-muted-foreground mt-1">Revenez bientot pour decouvrir de nouvelles offres</p>
            </Card>
          )}
        </motion.section>

        {/* RECENT ACTIVITY */}
        <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold flex items-center gap-2">
              <Clock className="h-4 w-4 text-emerald-500" />
              Activite recente
              {!ridesLoading && recentRides.length > 0 && (
                <Badge variant="secondary" className="text-xs font-normal ml-1">{recentRides.length}</Badge>
              )}
            </h2>
            <button className="text-xs text-emerald-600 font-medium hover:underline" onClick={() => setView('passenger')}>Tout voir</button>
          </div>
          {ridesLoading || analyticsLoading ? (
            <Card className="divide-y divide-border">
              {[0, 1, 2, 3, 4].map((i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-3">
                  <Skeleton className="h-9 w-9 rounded-lg" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                  <div className="text-right space-y-1.5">
                    <Skeleton className="h-4 w-16 ml-auto" />
                    <Skeleton className="h-3 w-12 ml-auto" />
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              ))}
            </Card>
          ) : recentRides.length > 0 ? (
            <Card className="divide-y divide-border">
              {recentRides.slice(0, 5).map((ride, i) => {
                const isCompleted = ride.status === 'completed'
                const isCancelled = ride.status === 'cancelled'
                const isInProgress = ride.status === 'in_progress' || ride.status === 'accepted'
                const fare = ride.actualFare ?? ride.estimatedFare ?? 0
                const statusLabel = isCompleted ? 'Terminee' : isCancelled ? 'Annulee' : isInProgress ? 'En cours' : 'En attente'
                const statusColor = isCompleted ? 'text-emerald-600' : isCancelled ? 'text-red-500' : isInProgress ? 'text-amber-600' : 'text-muted-foreground'
                return (
                  <motion.div
                    key={ride.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.3 + i * 0.05 }}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-accent/50 transition-colors cursor-pointer"
                  >
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                      isCompleted ? 'bg-emerald-100 dark:bg-emerald-900/30' : isInProgress ? 'bg-amber-100 dark:bg-amber-900/30' : 'bg-muted'
                    }`}>
                      <Car className={`h-4 w-4 ${isCompleted ? 'text-emerald-600' : isInProgress ? 'text-amber-600' : 'text-muted-foreground'}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {ride.pickupZone || ride.pickupAddress?.split(',')[0] || 'Depart'} → {ride.dropoffZone || ride.dropoffAddress?.split(',')[0] || 'Arrivee'}
                      </p>
                      <div className="flex items-center gap-2">
                        <p className="text-xs text-muted-foreground">{formatRelativeTime(ride.createdAt)}</p>
                        <span className={`text-[10px] font-medium ${statusColor}`}>{statusLabel}</span>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <span className={`text-sm font-semibold ${isCompleted ? 'text-foreground' : isCancelled ? 'text-red-500' : 'text-amber-600'}`}>
                        {fare > 0 ? formatGNF(fare) : '--'}
                      </span>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  </motion.div>
                )
              })}
            </Card>
          ) : (
            <Card className="p-6 text-center">
              <Clock className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Aucune activite recente</p>
              <p className="text-xs text-muted-foreground mt-1">Vos courses et livraisons apparaitront ici</p>
            </Card>
          )}
        </motion.section>

        {/* LOYALTY CARD */}
        <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.38 }}>
          <Card className="cursor-pointer hover:shadow-md transition-shadow mova-card-hover overflow-hidden"
            onClick={() => setShowLoyalty(true)}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center flex-shrink-0 shadow-sm">
                  <Trophy className="h-5 w-5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold">Fidelite MOVA</p>
                    <LoyaltyBadge tier={loyaltyTier} points={loyaltyPoints} showPoints={false} compact />
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {loyaltyPoints.toLocaleString('fr-FR')} points
                    {loyaltyStreak > 0 && (
                      <span className="inline-flex items-center gap-1 ml-2">
                        <Flame className="h-3 w-3 text-orange-500" />
                        Serie {loyaltyStreak} jour{loyaltyStreak > 1 ? 's' : ''}
                      </span>
                    )}
                  </p>
                </div>
                <div className="flex-shrink-0">
                  <p className="text-lg font-bold text-emerald-600">{loyaltyPoints.toLocaleString('fr-FR')}</p>
                  <p className="text-[10px] text-muted-foreground text-right">points</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.section>

        {/* SAFETY STRIP */}
        <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
          <Card className="bg-emerald-50 border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-800">
            <CardContent className="p-3 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center flex-shrink-0">
                <Shield className="h-5 w-5 text-emerald-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">
                  Partagez votre trajet en direct
                </p>
                <p className="text-xs text-emerald-600 dark:text-emerald-400">
                  Vos proches peuvent suivre votre position en temps réel
                </p>
              </div>
              <Button variant="outline" size="sm" className="border-emerald-300 text-emerald-700 dark:border-emerald-700 dark:text-emerald-300 rounded-xl flex-shrink-0" onClick={() => {
                setTripSharingEnabled(!tripSharingEnabled)
                if (!tripSharingEnabled) {
                  toast.success('Partage de trajet active. Vos contacts proches peuvent suivre votre position.')
                } else {
                  toast.success('Partage de trajet desactive.')
                }
              }}>
                {tripSharingEnabled ? 'Desactiver' : 'Activer'}
              </Button>
            </CardContent>
          </Card>
        </motion.section>

        {/* STATS MINI */}
        <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }}>
          {analyticsLoading ? (
            <div className="grid grid-cols-3 gap-3">
              {[0, 1, 2].map((i) => (
                <Card key={i} className="text-center p-3 space-y-2">
                  <Skeleton className="h-8 w-16 mx-auto" />
                  <Skeleton className="h-3 w-14 mx-auto" />
                </Card>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-3">
              <Card className="text-center p-3">
                <div className="flex items-center justify-center mb-1">
                  <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                    <Car className="h-4 w-4 text-emerald-600" />
                  </div>
                </div>
                <p className="text-2xl font-bold text-emerald-600">{stats?.activeDrivers ?? 0}</p>
                <p className="text-xs text-muted-foreground">Chauffeurs disponibles</p>
              </Card>
              <Card className="text-center p-3">
                <div className="flex items-center justify-center mb-1">
                  <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                    <Route className="h-4 w-4 text-amber-600" />
                  </div>
                </div>
                <p className="text-2xl font-bold text-amber-600">{stats?.totalRides ?? 0}</p>
                <p className="text-xs text-muted-foreground">Courses aujourd'hui</p>
              </Card>
              <Card className="text-center p-3">
                <div className="flex items-center justify-center mb-1">
                  <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                    <Star className="h-4 w-4 text-emerald-600" />
                  </div>
                </div>
                <div className="flex items-center justify-center gap-1">
                  <p className="text-2xl font-bold text-emerald-600">{stats?.averageRating ? stats.averageRating.toFixed(1) : '0.0'}</p>
                </div>
                <p className="text-xs text-muted-foreground">Note moyenne</p>
              </Card>
            </div>
          )}
        </motion.section>
      </main>

      {/* MOBILE BOTTOM NAV */}
      <nav className="fixed bottom-0 left-0 right-0 sm:hidden mova-glass border-t border-border/50 z-50">
        <div className="flex items-center justify-around py-2 px-4">
          {[
            { icon: <Home className="h-5 w-5" />, label: 'Accueil', active: true },
            { icon: <Car className="h-5 w-5" />, label: 'Courses', action: () => setView('passenger') },
            { icon: <Wallet className="h-5 w-5" />, label: 'Wallet', action: () => setView('wallet') },
            { icon: <Phone className="h-5 w-5" />, label: 'Support', action: () => setShowSupport(true) },
          ].map((tab, i) => (
            <button
              key={i}
              onClick={tab.action}
              className="flex flex-col items-center gap-1 px-3 py-1 relative min-h-[44px]"
            >
              <span className={tab.active ? 'text-emerald-600' : 'text-muted-foreground'}>
                {tab.icon}
              </span>
              <span className={`text-[10px] font-medium ${tab.active ? 'text-emerald-600' : 'text-muted-foreground'}`}>
                {tab.label}
              </span>
              {tab.active && (
                <motion.div layoutId="tab-indicator" className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-6 h-0.5 rounded-full bg-emerald-500" />
              )}
            </button>
          ))}
        </div>
      </nav>

      {/* REFERRAL DIALOG */}
      <Dialog open={showReferral} onOpenChange={setShowReferral}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-emerald-600" />
              Parrainez vos amis
            </DialogTitle>
            <DialogDescription>
              Partagez votre code et gagnez des credits de course pour chaque ami qui rejoint MOVA.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="flex flex-col items-center gap-3 p-4 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800">
              <p className="text-sm text-muted-foreground">Votre code de parrainage</p>
              <p className="text-3xl font-bold tracking-widest text-emerald-700 dark:text-emerald-300">
                {user?.id ? `MOVA-${user.id.toUpperCase().slice(0, 6)}` : 'MOVA-DEMO01'}
              </p>
              <p className="text-xs text-emerald-600 dark:text-emerald-400 text-center">
                Chaque ami inscrit = 2 000 GNF de credit pour vous et votre ami
              </p>
            </div>
            <Button
              className="w-full mova-gradient font-semibold rounded-xl"
              onClick={async () => {
                const code = user?.id ? `MOVA-${user.id.toUpperCase().slice(0, 6)}` : 'MOVA-DEMO01'
                const link = `https://mova.gn/parrainage/${code}`
                if (navigator.share) {
                  try {
                    await navigator.share({
                      title: 'Rejoignez MOVA',
                      text: `Utilisez mon code ${code} sur MOVA pour obtenir 2 000 GNF de credit !`,
                      url: link,
                    })
                  } catch {
                    // User cancelled share
                  }
                } else {
                  await navigator.clipboard.writeText(`${link}\nCode: ${code}`)
                  toast.success('Lien copie dans le presse-papier !')
                }
              }}
            >
              <Share2 className="h-4 w-4 mr-2" />
              Partager le lien
            </Button>
            <Button
              variant="outline"
              className="w-full rounded-xl"
              onClick={async () => {
                const code = user?.id ? `MOVA-${user.id.toUpperCase().slice(0, 6)}` : 'MOVA-DEMO01'
                await navigator.clipboard.writeText(code)
                setReferralCopied(true)
                toast.success('Code copie !')
                setTimeout(() => setReferralCopied(false), 2000)
              }}
            >
              {referralCopied ? <CopyCheck className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
              {referralCopied ? 'Copie' : 'Copier le code'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* SUPPORT DIALOG */}
      <Dialog open={showSupport} onOpenChange={setShowSupport}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Headphones className="h-5 w-5 text-emerald-600" />
              Aide & Support
            </DialogTitle>
            <DialogDescription>
              Notre equipe est disponible 24h/24 et 7j/7 pour vous aider.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Card className="mova-card-hover cursor-pointer" onClick={() => window.open('tel:+224620000000') }>
              <CardContent className="flex items-center gap-3 p-4">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center flex-shrink-0">
                  <Phone className="h-5 w-5 text-emerald-600" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold">Appeler le support</p>
                  <p className="text-xs text-muted-foreground">+224 620 00 00 00</p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </CardContent>
            </Card>
            <Card className="mova-card-hover cursor-pointer" onClick={() => window.open('mailto:support@mova.gn') }>
              <CardContent className="flex items-center gap-3 p-4">
                <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center flex-shrink-0">
                  <Mail className="h-5 w-5 text-amber-600" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold">Envoyer un email</p>
                  <p className="text-xs text-muted-foreground">support@mova.gn</p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </CardContent>
            </Card>
            <Card className="mova-card-hover cursor-pointer" onClick={() => window.open('https://wa.me/224620000000', '_blank') }>
              <CardContent className="flex items-center gap-3 p-4">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center flex-shrink-0">
                  <MessageCircle className="h-5 w-5 text-emerald-600" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold">WhatsApp</p>
                  <p className="text-xs text-muted-foreground">Ecrivez-nous sur WhatsApp</p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </CardContent>
            </Card>
          </div>
        </DialogContent>
      </Dialog>

      {/* ALL SERVICES DIALOG */}
      <Dialog open={showAllServices} onOpenChange={setShowAllServices}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-emerald-600" />
              Tous nos services
            </DialogTitle>
            <DialogDescription>
              Decouvrez tous les services MOVA disponibles a Conakry
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 py-4">
            {services.map((service, i) => (
              <motion.button
                key={service.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.02 }}
                whileHover={{ scale: 1.07 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => {
                  handleServiceClick(service)
                  setShowAllServices(false)
                }}
                className={`relative flex flex-col items-center gap-1.5 p-3 rounded-2xl transition-all ${
                  service.comingSoon
                    ? 'bg-muted/50 opacity-80'
                    : 'bg-card hover:bg-accent hover:shadow-md border border-border shadow-sm'
                }`}
              >
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${service.color}`}>
                  {service.icon}
                </div>
                <span className="text-xs font-medium text-center leading-tight text-foreground">
                  {service.name}
                </span>
                {service.badge && (
                  <span className={`absolute -top-1 -right-1 text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${service.badgeColor || 'bg-emerald-100 text-emerald-700'}`}>
                    {service.badge}
                  </span>
                )}
              </motion.button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* ASSISTANT FAB */}
      {!showAssistant && (
        <motion.button
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 260, damping: 20, delay: 0.5 }}
          onClick={() => setShowAssistant(true)}
          className="fixed bottom-20 right-4 sm:bottom-6 sm:right-6 z-50 size-14 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-lg shadow-emerald-500/30 hover:shadow-xl hover:shadow-emerald-500/40 hover:scale-105 active:scale-95 transition-all flex items-center justify-center"
        >
          <MessageCircle className="size-6" />
          <span className="absolute -top-0.5 -right-0.5 size-3 rounded-full bg-emerald-300 animate-pulse" />
        </motion.button>
      )}

      <NotificationPanel open={showNotifications} onOpenChange={setShowNotifications} />
      <LoyaltyPanel open={showLoyalty} onOpenChange={setShowLoyalty} />
      <AssistantPanel open={showAssistant} onOpenChange={setShowAssistant} />

    </div>
  )
}

