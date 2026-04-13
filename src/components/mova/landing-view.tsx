'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { motion } from 'framer-motion'
import { useTheme } from 'next-themes'
import {
  Car,
  Package,
  Users,
  CreditCard,
  Trophy,
  Shield,
  Share2,
  FileText,
  Check,
  Smartphone,
  MapPin,
  Menu,
  ChevronRight,
  ArrowRight,
  Phone,
  Mail,
  Download,
  Star,
  Zap,
  Sun,
  Moon,
  X,
  Clock,
  Globe,
  Map,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi,
} from '@/components/ui/carousel'
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'

import { useAppStore } from '@/lib/mova/store'

/* ═══════════════════════════════════════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════════════════════════════════════ */
type IconComponent = React.ComponentType<{ className?: string }>

interface ServiceItem {
  icon: IconComponent
  title: string
  desc: string
  color: string
}

interface TestimonialItem {
  name: string
  role: string
  zone: string
  rating: number
  quote: string
  initials: string
  bgColor: string
}

/* ═══════════════════════════════════════════════════════════════════════════════
   ANIMATION VARIANTS
   ═══════════════════════════════════════════════════════════════════════════════ */
const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.6, ease: 'easeOut' as const },
  }),
}

const fadeIn = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.5 } },
}

const stagger = {
  visible: { transition: { staggerChildren: 0.1 } },
}

const scaleIn = {
  hidden: { opacity: 0, scale: 0.9 },
  visible: (i: number) => ({
    opacity: 1,
    scale: 1,
    transition: { delay: i * 0.08, duration: 0.5, ease: 'easeOut' as const },
  }),
}

/* ═══════════════════════════════════════════════════════════════════════════════
   STATIC DATA
   ═══════════════════════════════════════════════════════════════════════════════ */
const navLinks = [
  { label: 'Services', href: '#services' },
  { label: 'Comment ca marche', href: '#how-it-works' },
  { label: 'Securite', href: '#safety' },
  { label: 'Temoignages', href: '#testimonials' },
  { label: 'Tarifs', href: '#pricing' },
]

const servicesData: ServiceItem[] = [
  {
    icon: Car,
    title: 'VTC / Courses',
    desc: 'Des courses fiables et abordables dans toute Conakry. Reservez en quelques secondes.',
    color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  },
  {
    icon: Package,
    title: 'Livraison',
    desc: 'Envoyez vos colis rapidement et en toute securite. Suivi en temps reel inclus.',
    color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  },
  {
    icon: Users,
    title: 'Covoiturage',
    desc: 'Partagez vos trajets et economisez ensemble. Plus vert, moins cher.',
    color: 'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300',
  },
  {
    icon: CreditCard,
    title: 'Mobile Money',
    desc: 'Payez avec Orange Money et MTN directement dans l\'application.',
    color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
  },
  {
    icon: Trophy,
    title: 'Programme Fidelite',
    desc: 'Gagnez des points et des recompenses a chaque course. 5 niveaux a debloquer.',
    color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
  },
  {
    icon: Shield,
    title: 'Securite',
    desc: 'Bouton SOS, partage de trajet, suivi en direct et assurance trajet.',
    color: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
  },
]

const stepsData = [
  {
    num: '01',
    icon: Smartphone,
    title: 'Inscrivez-vous',
    desc: 'Creez votre compte en 30 secondes avec votre numero',
  },
  {
    num: '02',
    icon: MapPin,
    title: 'Reservez',
    desc: 'Choisissez votre destination et votre type de vehicule',
  },
  {
    num: '03',
    icon: Check,
    title: 'Profitez',
    desc: 'Suivez votre course en temps reel et payez facilement',
  },
]

const safetyData = [
  { icon: Shield, title: 'Bouton SOS', desc: 'Alertez les secours en un tap' },
  { icon: Share2, title: 'Partage de trajet', desc: 'Vos proches suivent votre position' },
  { icon: Check, title: 'Verification chauffeurs', desc: 'Tous nos chauffeurs sont verifies' },
  { icon: FileText, title: 'Assurance trajet', desc: 'Chaque course est assuree' },
]

const countersData = [
  { value: 10000, suffix: '+', label: 'utilisateurs', icon: Users },
  { value: 500, suffix: '+', label: 'chauffeurs verifies', icon: Car },
  { value: 50000, suffix: '+', label: 'courses completees', icon: MapPin },
  { value: 5, suffix: '', label: 'communes couvertes', icon: Map },
  { value: 4.8, suffix: '/5', label: 'note moyenne', icon: Star, decimals: 1 },
  { value: 99.2, suffix: '%', label: 'taux de satisfaction', icon: Shield, decimals: 1 },
]

const testimonialsData: TestimonialItem[] = [
  {
    name: 'Aminata Conde',
    role: 'Passager',
    zone: 'Kaloum',
    rating: 5,
    quote: 'MOVA a change ma vie. Je ne prends plus les taxis-brousse. Les chauffeurs sont professionnels et les prix sont transparents.',
    initials: 'AC',
    bgColor: 'bg-emerald-500',
  },
  {
    name: 'Mamadou Bah',
    role: 'Chauffeur',
    zone: 'Matoto',
    rating: 5,
    quote: 'Depuis que je suis sur MOVA, mes revenus ont augmente de 40%. L\'application est intuitive et les clients sont respectueux.',
    initials: 'MB',
    bgColor: 'bg-amber-500',
  },
  {
    name: 'Fatoumata Diallo',
    role: 'Passager',
    zone: 'Dixinn',
    rating: 4,
    quote: 'Le bouton SOS et le partage de trajet me rassurent beaucoup, surtout le soir. MOVA pense vraiment a la securite des femmes.',
    initials: 'FD',
    bgColor: 'bg-teal-500',
  },
  {
    name: 'Ibrahima Soumah',
    role: 'Chauffeur',
    zone: 'Ratoma',
    rating: 5,
    quote: 'Le programme de fidelite et les defis quotidiens me motivent. J\'ai atteint le niveau Platine en 3 mois !',
    initials: 'IS',
    bgColor: 'bg-orange-500',
  },
  {
    name: 'Kadiatou Camara',
    role: 'Passager',
    zone: 'Matoto',
    rating: 5,
    quote: 'La livraison de colis est incroyable. J\'ai recu un paquet de Madina a Kipe en moins d\'une heure. Service top !',
    initials: 'KC',
    bgColor: 'bg-purple-500',
  },
  {
    name: 'Sekou Toure',
    role: 'Passager',
    zone: 'Matam',
    rating: 4,
    quote: 'Payer avec Orange Money directement dans l\'app, c\'est le futur. Plus besoin de chercher du petit monnaie.',
    initials: 'ST',
    bgColor: 'bg-rose-500',
  },
]

const pricingRows = [
  { feature: 'Course Standard', mova: '5 000 GNF', uber: '6 500 GNF', bolt: '5 500 GNF', yango: '5 000 GNF' },
  { feature: 'Course Premium', mova: '10 000 GNF', uber: '13 000 GNF', bolt: '11 000 GNF', yango: '10 500 GNF' },
  { feature: 'Livraison', mova: '3 000 GNF', uber: null, bolt: '4 000 GNF', yango: null },
  { feature: 'Frais de service', mova: '5%', uber: '15%', bolt: '10%', yango: '12%' },
  { feature: 'Cashback', mova: true, uber: false, bolt: false, yango: false },
  { feature: 'Programme fidelite', mova: '5 niveaux', uber: false, bolt: '3 niveaux', yango: false },
]

const mapZones = [
  { name: 'Matoto', x: 250, y: 55, cx: 250, cy: 80 },
  { name: 'Matam', x: 95, y: 175, cx: 95, cy: 200 },
  { name: 'Ratoma', x: 250, y: 175, cx: 250, cy: 200 },
  { name: 'Dixinn', x: 405, y: 175, cx: 405, cy: 200 },
  { name: 'Kaloum', x: 250, y: 330, cx: 250, cy: 355 },
]

const mapRoads = [
  { from: [250, 80], to: [250, 200] },
  { from: [250, 80], to: [95, 200] },
  { from: [250, 80], to: [405, 200] },
  { from: [95, 200], to: [250, 200] },
  { from: [250, 200], to: [405, 200] },
  { from: [250, 200], to: [250, 355] },
  { from: [95, 200], to: [250, 355] },
  { from: [405, 200], to: [250, 355] },
]

const carPositions = [
  { x: 250, y: 90, targetX: 250, targetY: 200 },
  { x: 200, y: 130, targetX: 95, targetY: 200 },
  { x: 300, y: 130, targetX: 405, targetY: 200 },
  { x: 170, y: 200, targetX: 250, targetY: 200 },
  { x: 330, y: 200, targetX: 405, targetY: 200 },
  { x: 250, y: 220, targetX: 250, targetY: 355 },
  { x: 190, y: 270, targetX: 250, targetY: 355 },
  { x: 310, y: 270, targetX: 250, targetY: 355 },
  { x: 95, y: 260, targetX: 250, targetY: 355 },
  { x: 405, y: 260, targetX: 250, targetY: 355 },
]

/* ═══════════════════════════════════════════════════════════════════════════════
   COUNTER ITEM COMPONENT
   ═══════════════════════════════════════════════════════════════════════════════ */
function CounterItem({
  value,
  suffix,
  label,
  icon: Icon,
  decimals,
  active,
}: {
  value: number
  suffix: string
  label: string
  icon: IconComponent
  decimals?: number
  active: boolean
}) {
  const [count, setCount] = useState(0)
  const isDecimal = decimals !== undefined

  useEffect(() => {
    if (!active) return
    let startTime: number | null = null
    let frame: number

    const animate = (ts: number) => {
      if (!startTime) startTime = ts
      const progress = Math.min((ts - startTime) / 2000, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      const current = eased * value
      setCount(isDecimal ? parseFloat(current.toFixed(decimals)) : Math.round(current))
      if (progress < 1) frame = requestAnimationFrame(animate)
    }

    frame = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(frame)
  }, [value, decimals, active, isDecimal])

  const displayValue = isDecimal
    ? count.toFixed(decimals)
    : count.toLocaleString('fr-FR')

  return (
    <div className="flex flex-col items-center text-center p-6 rounded-2xl bg-white dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-800/50 shadow-sm">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-900/40">
        <Icon className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
      </div>
      <span className="text-2xl font-bold text-foreground sm:text-3xl">
        {displayValue}{suffix}
      </span>
      <span className="mt-1 text-sm text-muted-foreground">{label}</span>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════════
   NAVBAR
   ═══════════════════════════════════════════════════════════════════════════════ */
function Navbar({
  mobileOpen,
  setMobileOpen,
  scrollTo,
  onReserve,
}: {
  mobileOpen: boolean
  setMobileOpen: (v: boolean) => void
  scrollTo: (href: string) => void
  onReserve: () => void
}) {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    queueMicrotask(() => setMounted(true))
  }, [])

  return (
    <motion.nav
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="fixed top-0 left-0 right-0 z-50 mova-glass border-b border-emerald-100/50 dark:border-emerald-800/30"
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <button onClick={() => scrollTo('#top')} className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-700 text-white font-bold text-lg shadow-lg shadow-emerald-500/30">
            M
          </div>
          <span className="text-xl font-bold bg-gradient-to-r from-emerald-600 to-emerald-800 bg-clip-text text-transparent dark:from-emerald-400 dark:to-emerald-600">
            MOVA
          </span>
        </button>

        <div className="hidden lg:flex items-center gap-8">
          {navLinks.map((link) => (
            <button
              key={link.href}
              onClick={() => scrollTo(link.href)}
              className="text-sm font-medium text-muted-foreground hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
            >
              {link.label}
            </button>
          ))}
        </div>

        <div className="hidden lg:flex items-center gap-3">
          {mounted && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="text-muted-foreground hover:text-emerald-600 dark:hover:text-emerald-400"
            >
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
          )}
          <Button
            variant="ghost"
            onClick={onReserve}
            className="text-emerald-700 hover:text-emerald-800 dark:text-emerald-400"
          >
            Se connecter
          </Button>
          <Button
            onClick={onReserve}
            className="mova-gradient text-white shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40"
          >
            Commencer
          </Button>
        </div>

        <div className="flex items-center gap-2 lg:hidden">
          {mounted && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="text-muted-foreground"
            >
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
          )}
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-72">
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-700 text-white font-bold text-sm">
                    M
                  </div>
                  MOVA
                </SheetTitle>
              </SheetHeader>
              <div className="flex flex-col gap-2 px-4 pt-4">
                {navLinks.map((link) => (
                  <button
                    key={link.href}
                    onClick={() => {
                      setMobileOpen(false)
                      scrollTo(link.href)
                    }}
                    className="flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium text-muted-foreground hover:bg-emerald-50 hover:text-emerald-700 dark:hover:bg-emerald-900/20 dark:hover:text-emerald-400 transition-colors min-h-[44px]"
                  >
                    {link.label}
                    <ChevronRight className="ml-auto h-4 w-4 opacity-40" />
                  </button>
                ))}
                <Separator className="my-2" />
                <Button
                  variant="outline"
                  className="mt-2"
                  onClick={() => {
                    setMobileOpen(false)
                    onReserve()
                  }}
                >
                  Se connecter
                </Button>
                <Button
                  className="mova-gradient text-white"
                  onClick={() => {
                    setMobileOpen(false)
                    onReserve()
                  }}
                >
                  Commencer
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </motion.nav>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════════
   HERO SECTION
   ═══════════════════════════════════════════════════════════════════════════════ */
function HeroSection({
  onReserve,
  onDiscover,
}: {
  onReserve: () => void
  onDiscover: () => void
}) {
  return (
    <section
      id="top"
      className="relative min-h-screen flex items-center overflow-hidden"
    >
      {/* Animated background */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="absolute inset-0 opacity-[0.03] dark:opacity-[0.05]"
          style={{
            backgroundImage:
              'linear-gradient(to right, #10b981 1px, transparent 1px), linear-gradient(to bottom, #10b981 1px, transparent 1px)',
            backgroundSize: '60px 60px',
          }}
        />
        <div className="absolute -top-32 -right-32 h-[500px] w-[500px] rounded-full bg-gradient-to-br from-emerald-400/20 to-emerald-600/10 blur-3xl animate-[pulse_8s_ease-in-out_infinite]" />
        <div className="absolute -bottom-40 -left-40 h-[400px] w-[400px] rounded-full bg-gradient-to-tr from-amber-400/15 to-orange-500/10 blur-3xl animate-[pulse_10s_ease-in-out_infinite_2s]" />
        <div className="absolute top-1/3 left-1/4 h-[300px] w-[300px] rounded-full bg-gradient-to-br from-emerald-300/10 to-teal-400/5 blur-3xl animate-[pulse_12s_ease-in-out_infinite_4s]" />
        <div className="absolute bottom-1/4 right-1/3 h-[250px] w-[250px] rounded-full bg-gradient-to-tl from-amber-300/10 to-yellow-400/5 blur-3xl animate-[pulse_9s_ease-in-out_infinite_3s]" />
      </div>

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-20 pb-16 w-full">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          {/* Text side */}
          <motion.div
            initial="hidden"
            animate="visible"
            variants={stagger}
            className="text-center lg:text-left"
          >
            <motion.div variants={fadeUp} custom={0} className="flex items-center justify-center lg:justify-start gap-3 mb-8">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 text-white font-bold text-2xl shadow-xl shadow-emerald-500/30">
                M
              </div>
              <span className="text-3xl font-extrabold bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-500 bg-clip-text text-transparent">
                MOVA
              </span>
            </motion.div>

            <motion.div variants={fadeUp} custom={1}>
              <Badge className="mb-6 border-emerald-300/40 bg-emerald-400/15 text-emerald-700 dark:text-emerald-300 px-4 py-1.5 text-sm font-medium backdrop-blur-sm">
                <Zap className="mr-1.5 h-3.5 w-3.5" />
                Super-app de mobilite
              </Badge>
            </motion.div>

            <motion.h1
              variants={fadeUp}
              custom={2}
              className="text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl lg:text-6xl leading-[1.1]"
            >
              La mobilite{' '}
              <span className="relative inline-block">
                <span className="bg-gradient-to-r from-emerald-600 to-teal-500 bg-clip-text text-transparent">
                  reinventee
                </span>
                <svg
                  className="absolute -bottom-2 left-0 w-full"
                  viewBox="0 0 300 12"
                  fill="none"
                >
                  <path
                    d="M2 8C50 2 100 2 150 6C200 10 250 4 298 8"
                    stroke="rgba(16,185,129,0.4)"
                    strokeWidth="3"
                    strokeLinecap="round"
                  />
                </svg>
              </span>{' '}
              pour Conakry
            </motion.h1>

            <motion.p
              variants={fadeUp}
              custom={3}
              className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground sm:text-xl lg:max-w-lg mx-auto lg:mx-0"
            >
              Courses, livraisons, covoiturage -- tout en une seule application. Plus rapide, plus sur, moins cher.
            </motion.p>

            <motion.div
              variants={fadeUp}
              custom={4}
              className="mt-10 flex flex-col gap-4 sm:flex-row sm:justify-center lg:justify-start"
            >
              <Button
                size="lg"
                onClick={onReserve}
                className="h-14 px-10 text-base font-semibold mova-gradient text-white shadow-xl shadow-emerald-500/30 transition-all hover:shadow-emerald-500/40"
              >
                Commencer maintenant
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={onDiscover}
                className="h-14 px-10 text-base font-semibold border-emerald-300 bg-white dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-900/40 transition-all"
              >
                Decouvrir nos services
              </Button>
            </motion.div>

            <motion.div
              variants={fadeUp}
              custom={5}
              className="mt-10 flex items-center gap-4 sm:justify-center lg:justify-start"
            >
              <div className="flex -space-x-2">
                {[
                  { bg: 'bg-emerald-400', init: 'MD' },
                  { bg: 'bg-amber-400', init: 'IS' },
                  { bg: 'bg-teal-400', init: 'SC' },
                  { bg: 'bg-orange-400', init: 'BK' },
                  { bg: 'bg-emerald-500', init: 'AF' },
                ].map((item, i) => (
                  <div
                    key={i}
                    className={`h-9 w-9 rounded-full ${item.bg} border-2 border-white dark:border-background flex items-center justify-center text-[10px] font-bold text-white`}
                  >
                    {item.init}
                  </div>
                ))}
              </div>
              <div className="text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      className="h-3.5 w-3.5 text-amber-400 fill-amber-400"
                    />
                  ))}
                </div>
                <span className="font-semibold text-foreground">10 000+</span>{' '}
                utilisateurs satisfaits
              </div>
            </motion.div>
          </motion.div>

          {/* Animated illustration */}
          <motion.div
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.4, duration: 0.8, ease: 'easeOut' }}
            className="relative hidden lg:flex items-center justify-center"
          >
            <div className="relative h-[480px] w-[480px]">
              <div className="absolute inset-0 rounded-full border-2 border-dashed border-emerald-200/40 dark:border-emerald-700/30 animate-[spin_40s_linear_infinite]" />
              <div className="absolute inset-6 rounded-full border border-emerald-100/30 dark:border-emerald-800/20 animate-[spin_25s_linear_infinite_reverse]" />
              <div
                className="absolute inset-12 rounded-full border border-emerald-400/20 animate-ping"
                style={{ animationDuration: '4s' }}
              />

              <motion.div
                animate={{ y: [0, -10, 0] }}
                transition={{ repeat: Infinity, duration: 5, ease: 'easeInOut' }}
                className="absolute inset-20 flex items-center justify-center rounded-3xl bg-gradient-to-br from-white to-emerald-50 dark:from-emerald-900 dark:to-emerald-950 border border-emerald-200/50 dark:border-emerald-700/30 shadow-2xl"
              >
                <div className="text-center p-6">
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-700 shadow-lg shadow-emerald-500/30">
                    <Car className="h-8 w-8 text-white" />
                  </div>
                  <p className="text-lg font-bold text-foreground">En route</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Arrivee dans 3 min
                  </p>
                  <div className="mt-3 flex justify-center gap-1">
                    <div className="h-2 w-2 rounded-full bg-emerald-500 animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="h-2 w-2 rounded-full bg-emerald-500 animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="h-2 w-2 rounded-full bg-emerald-500 animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </motion.div>

              <motion.div
                animate={{ y: [0, -12, 0], rotate: [0, 5, -5, 0] }}
                transition={{ repeat: Infinity, duration: 6, ease: 'easeInOut' }}
                className="absolute top-2 right-8 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-lg shadow-emerald-500/30"
              >
                <Car className="h-7 w-7 text-white" />
              </motion.div>

              <motion.div
                animate={{ y: [0, 10, 0], rotate: [0, -5, 5, 0] }}
                transition={{ repeat: Infinity, duration: 5, ease: 'easeInOut', delay: 1 }}
                className="absolute bottom-8 left-0 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 shadow-lg shadow-amber-400/30"
              >
                <Package className="h-6 w-6 text-white" />
              </motion.div>

              <motion.div
                animate={{ y: [0, -8, 0] }}
                transition={{ repeat: Infinity, duration: 4, ease: 'easeInOut', delay: 0.5 }}
                className="absolute top-20 left-2 flex h-11 w-11 items-center justify-center rounded-xl bg-white dark:bg-emerald-900 shadow-lg border border-emerald-100 dark:border-emerald-800"
              >
                <MapPin className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              </motion.div>

              <motion.div
                animate={{ y: [0, 8, 0] }}
                transition={{ repeat: Infinity, duration: 4.5, ease: 'easeInOut', delay: 1.5 }}
                className="absolute bottom-16 right-4 flex h-11 w-11 items-center justify-center rounded-xl bg-white dark:bg-emerald-900 shadow-lg border border-emerald-100 dark:border-emerald-800"
              >
                <Star className="h-5 w-5 text-amber-400 fill-amber-400" />
              </motion.div>

              <motion.div
                animate={{ y: [0, -6, 0], rotate: [0, 3, -3, 0] }}
                transition={{ repeat: Infinity, duration: 5.5, ease: 'easeInOut', delay: 2 }}
                className="absolute top-12 right-36 flex h-10 w-10 items-center justify-center rounded-xl bg-white dark:bg-emerald-900 shadow-lg border border-emerald-100 dark:border-emerald-800"
              >
                <Shield className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              </motion.div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Stats bar */}
      <motion.div
        initial="hidden"
        animate="visible"
        viewport={{ once: true }}
        variants={stagger}
        className="absolute bottom-0 left-0 right-0"
      >
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 pb-8">
          <motion.div
            variants={fadeUp}
            custom={0}
            className="flex flex-wrap items-center justify-center gap-6 sm:gap-10 rounded-2xl border border-emerald-100 dark:border-emerald-800/50 bg-white/80 dark:bg-emerald-950/80 backdrop-blur-lg px-6 py-4 shadow-xl shadow-emerald-900/5"
          >
            {[
              { value: '10 000+', label: 'utilisateurs' },
              { value: '500+', label: 'chauffeurs' },
              { value: '5', label: 'communes couvertes' },
            ].map((stat, i) => (
              <div key={stat.label} className="flex items-center gap-2">
                {i > 0 && (
                  <div className="h-5 w-px bg-emerald-200 dark:bg-emerald-700 mr-2 hidden sm:block" />
                )}
                <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400 sm:text-xl">
                  {stat.value}
                </span>
                <span className="text-sm text-muted-foreground">{stat.label}</span>
              </div>
            ))}
          </motion.div>
        </div>
      </motion.div>
    </section>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════════
   ANIMATED COUNTERS SECTION
   ═══════════════════════════════════════════════════════════════════════════════ */
function CountersSection() {
  const sectionRef = useRef<HTMLDivElement>(null)
  const [hasAnimated, setHasAnimated] = useState(false)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasAnimated) {
          setHasAnimated(true)
        }
      },
      { threshold: 0.3 }
    )
    const current = sectionRef.current
    if (current) observer.observe(current)
    return () => {
      if (current) observer.unobserve(current)
    }
  }, [hasAnimated])

  return (
    <section ref={sectionRef} className="py-20 md:py-28 bg-emerald-50/50 dark:bg-emerald-950/20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-80px' }}
          className="text-center mb-14"
        >
          <motion.div variants={fadeIn}>
            <Badge variant="secondary" className="mb-4 px-4 py-1.5">
              <Zap className="mr-1.5 h-3.5 w-3.5" />
              En chiffres
            </Badge>
          </motion.div>
          <motion.h2
            variants={fadeUp}
            custom={0}
            className="text-3xl font-bold tracking-tight sm:text-4xl"
          >
            MOVA en chiffres
          </motion.h2>
        </motion.div>

        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-60px' }}
          variants={stagger}
          className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 sm:gap-6"
        >
          {countersData.map((item, i) => {
            const Icon = item.icon
            return (
              <motion.div key={item.label} variants={fadeUp} custom={i}>
                <CounterItem
                  value={item.value}
                  suffix={item.suffix}
                  label={item.label}
                  icon={Icon}
                  decimals={item.decimals}
                  active={hasAnimated}
                />
              </motion.div>
            )
          })}
        </motion.div>
      </div>
    </section>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════════
   SERVICES SECTION
   ═══════════════════════════════════════════════════════════════════════════════ */
function ServicesSection({ onReserve }: { onReserve?: () => void }) {
  return (
    <section id="services" className="py-20 md:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-80px' }}
          className="text-center"
        >
          <motion.div variants={fadeIn}>
            <Badge variant="secondary" className="mb-4 px-4 py-1.5">
              Nos services
            </Badge>
          </motion.div>
          <motion.h2
            variants={fadeUp}
            custom={0}
            className="text-3xl font-bold tracking-tight sm:text-4xl"
          >
            Tout ce dont vous avez besoin
          </motion.h2>
          <motion.p
            variants={fadeUp}
            custom={1}
            className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground"
          >
            Une application, six services essentiels pour votre quotidien a Conakry.
          </motion.p>
        </motion.div>

        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-60px' }}
          variants={stagger}
          className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3"
        >
          {servicesData.map((service, i) => {
            const Icon = service.icon
            return (
              <motion.div key={service.title} variants={fadeUp} custom={i}>
                <Card className="mova-card-hover group h-full border-emerald-100 dark:border-emerald-800/50 overflow-hidden">
                  <CardContent className="p-6">
                    <div
                      className={`mb-4 flex h-14 w-14 items-center justify-center rounded-2xl ${service.color} transition-transform group-hover:scale-110`}
                    >
                      <Icon className="h-7 w-7" />
                    </div>
                    <h3 className="text-lg font-bold mb-2">{service.title}</h3>
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      {service.desc}
                    </p>
                    <button onClick={onReserve} className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 transition-colors group-hover:gap-2">
                      En savoir plus
                      <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                    </button>
                  </CardContent>
                </Card>
              </motion.div>
            )
          })}
        </motion.div>
      </div>
    </section>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════════
   LIVE RIDE SIMULATION SECTION
   ═══════════════════════════════════════════════════════════════════════════════ */
function LiveRideSection() {
  const [carIndex, setCarIndex] = useState(0)
  const [eta, setEta] = useState(272)

  useEffect(() => {
    const carInterval = setInterval(() => {
      setCarIndex((prev) => (prev + 1) % carPositions.length)
    }, 2000)
    return () => clearInterval(carInterval)
  }, [])

  useEffect(() => {
    const etaInterval = setInterval(() => {
      setEta((prev) => (prev > 0 ? prev - 1 : 272))
    }, 1000)
    return () => clearInterval(etaInterval)
  }, [])

  const minutes = Math.floor(eta / 60)
  const seconds = eta % 60

  const activeRidePath = 'M 95 200 L 172 200 L 250 200 L 250 275 L 250 355'
  const currentCar = carPositions[carIndex]

  return (
    <section id="live-ride" className="py-20 md:py-28 bg-emerald-50/50 dark:bg-emerald-950/20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-80px' }}
          className="text-center"
        >
          <motion.div variants={fadeIn}>
            <Badge className="mb-4 px-4 py-1.5 border-emerald-200 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 dark:border-emerald-800">
              <MapPin className="mr-1.5 h-3.5 w-3.5" />
              Temps reel
            </Badge>
          </motion.div>
          <motion.h2
            variants={fadeUp}
            custom={0}
            className="text-3xl font-bold tracking-tight sm:text-4xl"
          >
            Voyez vos courses en direct
          </motion.h2>
          <motion.p
            variants={fadeUp}
            custom={1}
            className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground"
          >
            Suivez votre chauffeur en temps reel sur la carte. Exclusif MOVA.
          </motion.p>
        </motion.div>

        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-60px' }}
          variants={fadeUp}
          custom={0}
          className="mt-14"
        >
          <div className="grid lg:grid-cols-3 gap-6">
            {/* Map area */}
            <div className="lg:col-span-2">
              <Card className="overflow-hidden border-emerald-100 dark:border-emerald-800/50">
                <CardContent className="p-4 sm:p-6">
                  <svg viewBox="0 0 500 420" className="w-full h-auto rounded-xl" xmlns="http://www.w3.org/2000/svg">
                    <defs>
                      <pattern id="mapGrid" width="25" height="25" patternUnits="userSpaceOnUse">
                        <path d="M 25 0 L 0 0 0 25" fill="none" stroke="rgba(16,185,129,0.06)" strokeWidth="0.5" />
                      </pattern>
                      <filter id="glow">
                        <feGaussianBlur stdDeviation="3" result="blur" />
                        <feMerge>
                          <feMergeNode in="blur" />
                          <feMergeNode in="SourceGraphic" />
                        </feMerge>
                      </filter>
                    </defs>

                    {/* Background */}
                    <rect width="500" height="420" fill="url(#mapGrid)" rx="12" />
                    <rect width="500" height="420" fill="rgba(255,255,255,0.02)" rx="12" className="dark:fill-emerald-950/20" />

                    {/* Roads */}
                    {mapRoads.map((road, i) => (
                      <line
                        key={`road-${i}`}
                        x1={road.from[0]}
                        y1={road.from[1]}
                        x2={road.to[0]}
                        y2={road.to[1]}
                        stroke="rgba(16,185,129,0.15)"
                        strokeWidth="2"
                        strokeLinecap="round"
                      />
                    ))}

                    {/* Active ride path */}
                    <path
                      d={activeRidePath}
                      fill="none"
                      stroke="rgba(16,185,129,0.6)"
                      strokeWidth="3"
                      strokeDasharray="8 4"
                      strokeLinecap="round"
                      filter="url(#glow)"
                    >
                      <animate
                        attributeName="stroke-dashoffset"
                        from="0"
                        to="-24"
                        dur="1s"
                        repeatCount="indefinite"
                      />
                    </path>

                    {/* Pickup marker */}
                    <circle cx={95} cy={200} r="10" fill="#10b981" opacity="0.3">
                      <animate attributeName="r" values="10;16;10" dur="2s" repeatCount="indefinite" />
                      <animate attributeName="opacity" values="0.3;0.1;0.3" dur="2s" repeatCount="indefinite" />
                    </circle>
                    <circle cx={95} cy={200} r="6" fill="#10b981" />
                    <text x={95} y={185} textAnchor="middle" fill="#10b981" fontSize="9" fontWeight="bold">Depart</text>

                    {/* Dropoff marker */}
                    <circle cx={250} cy={355} r="10" fill="#ef4444" opacity="0.3">
                      <animate attributeName="r" values="10;16;10" dur="2s" repeatCount="indefinite" begin="0.5s" />
                      <animate attributeName="opacity" values="0.3;0.1;0.3" dur="2s" repeatCount="indefinite" begin="0.5s" />
                    </circle>
                    <circle cx={250} cy={355} r="6" fill="#ef4444" />
                    <text x={250} y={375} textAnchor="middle" fill="#ef4444" fontSize="9" fontWeight="bold">Arrivee</text>

                    {/* Zone labels */}
                    {mapZones.map((zone) => (
                      <g key={zone.name}>
                        <rect
                          x={zone.cx - 35}
                          y={zone.cy - 12}
                          width={70}
                          height={24}
                          rx={12}
                          fill="rgba(255,255,255,0.9)"
                          className="dark:fill-emerald-900/80"
                          stroke="rgba(16,185,129,0.2)"
                          strokeWidth="1"
                        />
                        <text
                          x={zone.cx}
                          y={zone.cy + 4}
                          textAnchor="middle"
                          fill="#374151"
                          className="dark:fill-emerald-200"
                          fontSize="11"
                          fontWeight="600"
                        >
                          {zone.name}
                        </text>
                      </g>
                    ))}

                    {/* Animated car dots */}
                    {carPositions.map((pos, i) => (
                      <circle
                        key={`car-${i}`}
                        cx={pos.x}
                        cy={pos.y}
                        r={i === carIndex ? 5 : 3}
                        fill={i === carIndex ? '#10b981' : 'rgba(16,185,129,0.4)'}
                      >
                        <animate
                          attributeName="cx"
                          values={`${pos.x};${pos.targetX};${pos.x}`}
                          dur="3s"
                          repeatCount="indefinite"
                        />
                        <animate
                          attributeName="cy"
                          values={`${pos.y};${pos.targetY};${pos.y}`}
                          dur="3s"
                          repeatCount="indefinite"
                        />
                      </circle>
                    ))}

                    {/* Active ride car */}
                    <g>
                      <circle cx={currentCar.x} cy={currentCar.y} r="8" fill="#10b981" opacity="0.3">
                        <animate attributeName="r" values="8;14;8" dur="1.5s" repeatCount="indefinite" />
                      </circle>
                      <circle cx={currentCar.x} cy={currentCar.y} r="5" fill="#10b981" />
                      <circle cx={currentCar.x} cy={currentCar.y} r="2" fill="white" />
                    </g>
                  </svg>
                </CardContent>
              </Card>
            </div>

            {/* Info panel */}
            <div className="flex flex-col gap-4">
              {/* ETA Card */}
              <Card className="border-emerald-100 dark:border-emerald-800/50 mova-card-hover">
                <CardContent className="p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <Clock className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                    <span className="text-sm font-semibold text-foreground">Temps d&apos;arrivee</span>
                  </div>
                  <p className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">
                    {minutes} min {seconds.toString().padStart(2, '0')}s
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">Arrivee dans {minutes} min {seconds.toString().padStart(2, '0')}s</p>
                </CardContent>
              </Card>

              {/* Driver card */}
              <Card className="border-emerald-100 dark:border-emerald-800/50 mova-card-hover">
                <CardContent className="p-6">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 font-bold text-sm">
                      MD
                    </div>
                    <div>
                      <p className="font-semibold text-foreground">Mamadou D.</p>
                      <p className="text-xs text-muted-foreground">Toyota Corolla</p>
                    </div>
                  </div>
                  <Badge variant="secondary" className="text-xs">
                    Conakry 1 AB 234 CD
                  </Badge>
                </CardContent>
              </Card>

              {/* Status steps */}
              <Card className="border-emerald-100 dark:border-emerald-800/50">
                <CardContent className="p-6">
                  <h4 className="font-semibold text-foreground mb-4">Statut de la course</h4>
                  <div className="space-y-4">
                    {[
                      { label: 'Course acceptee', done: true },
                      { label: 'Chauffeur en route', done: true },
                      { label: 'Arrivee', done: false },
                    ].map((step, i) => (
                      <div key={step.label} className="flex items-center gap-3">
                        <div className={`flex h-7 w-7 items-center justify-center rounded-full border-2 ${step.done ? 'bg-emerald-500 border-emerald-500' : 'border-muted-foreground/30'}`}>
                          {step.done && <Check className="h-3.5 w-3.5 text-white" />}
                        </div>
                        <span className={`text-sm ${step.done ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
                          {step.label}
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════════
   HOW IT WORKS SECTION
   ═══════════════════════════════════════════════════════════════════════════════ */
function HowItWorksSection() {
  return (
    <section id="how-it-works" className="py-20 md:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-80px' }}
          className="text-center"
        >
          <motion.div variants={fadeIn}>
            <Badge variant="secondary" className="mb-4 px-4 py-1.5">
              Simple et rapide
            </Badge>
          </motion.div>
          <motion.h2
            variants={fadeUp}
            custom={0}
            className="text-3xl font-bold tracking-tight sm:text-4xl"
          >
            Comment ca marche ?
          </motion.h2>
          <motion.p
            variants={fadeUp}
            custom={1}
            className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground"
          >
            Trois etapes simples pour vous deplacer en toute confiance.
          </motion.p>
        </motion.div>

        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-60px' }}
          variants={stagger}
          className="mt-14 grid gap-8 md:grid-cols-3"
        >
          {stepsData.map((step, i) => {
            const Icon = step.icon
            return (
              <motion.div key={step.num} variants={fadeUp} custom={i} className="relative">
                {i < stepsData.length - 1 && (
                  <div className="pointer-events-none absolute top-16 left-[calc(50%+40px)] right-[calc(-50%+40px)] hidden md:block">
                    <div className="border-t-2 border-dashed border-emerald-300 dark:border-emerald-700" />
                    <div className="absolute -right-2 -top-[5px]">
                      <ArrowRight className="h-3 w-3 text-emerald-400" />
                    </div>
                  </div>
                )}
                <Card className="mova-card-hover relative overflow-hidden border-emerald-100 dark:border-emerald-800/50">
                  <div className="pointer-events-none absolute top-4 right-4 text-7xl font-black text-emerald-50 dark:text-emerald-900/30">
                    {step.num}
                  </div>
                  <CardContent className="relative pt-8 pb-8">
                    <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-lg shadow-emerald-500/20">
                      <Icon className="h-7 w-7 text-white" />
                    </div>
                    <h3 className="text-lg font-bold mb-2">{step.title}</h3>
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      {step.desc}
                    </p>
                  </CardContent>
                </Card>
              </motion.div>
            )
          })}
        </motion.div>
      </div>
    </section>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════════
   PRICING SECTION
   ═══════════════════════════════════════════════════════════════════════════════ */
function PricingSection() {
  return (
    <section id="pricing" className="py-20 md:py-28 bg-emerald-50/50 dark:bg-emerald-950/20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-80px' }}
          className="text-center"
        >
          <motion.div variants={fadeIn}>
            <Badge variant="secondary" className="mb-4 px-4 py-1.5">
              Transparence
            </Badge>
          </motion.div>
          <motion.h2
            variants={fadeUp}
            custom={0}
            className="text-3xl font-bold tracking-tight sm:text-4xl"
          >
            Des tarifs transparents et competitifs
          </motion.h2>
          <motion.p
            variants={fadeUp}
            custom={1}
            className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground"
          >
            Comparez MOVA avec les autres applications de transport.
          </motion.p>
        </motion.div>

        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-60px' }}
          variants={fadeUp}
          custom={0}
          className="mt-14"
        >
          <div className="overflow-x-auto rounded-2xl border border-emerald-100 dark:border-emerald-800/50 shadow-sm">
            <Table>
              <TableHeader>
                <TableRow className="bg-emerald-50 dark:bg-emerald-900/30 hover:bg-emerald-50 dark:hover:bg-emerald-900/30">
                  <TableHead className="font-semibold min-w-[160px]">Fonctionnalite</TableHead>
                  <TableHead className="font-semibold text-center bg-emerald-100 dark:bg-emerald-800/40 min-w-[130px]">
                    <span className="text-emerald-700 dark:text-emerald-300">MOVA</span>
                  </TableHead>
                  <TableHead className="font-semibold text-center min-w-[130px]">Uber</TableHead>
                  <TableHead className="font-semibold text-center min-w-[130px]">Bolt</TableHead>
                  <TableHead className="font-semibold text-center min-w-[130px]">Yango</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pricingRows.map((row) => (
                  <TableRow key={row.feature}>
                    <TableCell className="font-medium text-foreground">{row.feature}</TableCell>
                    <TableCell className="text-center bg-emerald-50/50 dark:bg-emerald-900/20">
                      <PricingCell value={row.mova} isMova />
                    </TableCell>
                    <TableCell className="text-center">
                      <PricingCell value={row.uber} />
                    </TableCell>
                    <TableCell className="text-center">
                      <PricingCell value={row.bolt} />
                    </TableCell>
                    <TableCell className="text-center">
                      <PricingCell value={row.yango} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </motion.div>
      </div>
    </section>
  )
}

function PricingCell({ value, isMova }: { value: string | boolean | null; isMova?: boolean }) {
  if (value === null) {
    return <span className="text-sm text-muted-foreground">Indisponible</span>
  }
  if (typeof value === 'boolean') {
    return value ? (
      <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full ${isMova ? 'bg-emerald-100 dark:bg-emerald-900/40' : 'bg-emerald-100 dark:bg-emerald-900/40'}`}>
        <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
      </span>
    ) : (
      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
        <X className="h-3.5 w-3.5 text-red-500" />
      </span>
    )
  }
  return (
    <span className={`text-sm font-medium ${isMova ? 'text-emerald-700 dark:text-emerald-300 font-semibold' : 'text-foreground'}`}>
      {value}
    </span>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════════
   SAFETY SECTION
   ═══════════════════════════════════════════════════════════════════════════════ */
function SafetySection() {
  return (
    <section id="safety" className="relative overflow-hidden bg-gradient-to-b from-emerald-50 to-white py-20 md:py-28 dark:from-emerald-950/40 dark:to-background">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute top-0 right-0 h-72 w-72 rounded-full bg-emerald-100/50 dark:bg-emerald-900/20 blur-3xl" />
        <div className="absolute bottom-0 left-0 h-72 w-72 rounded-full bg-emerald-100/30 dark:bg-emerald-900/10 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-80px' }}
          className="text-center"
        >
          <motion.div variants={fadeIn}>
            <Badge className="mb-4 px-4 py-1.5 border-emerald-200 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 dark:border-emerald-800">
              <Shield className="mr-1.5 h-3.5 w-3.5" />
              Securite
            </Badge>
          </motion.div>
          <motion.h2
            variants={fadeUp}
            custom={0}
            className="text-3xl font-bold tracking-tight sm:text-4xl"
          >
            Votre securite est notre priorite
          </motion.h2>
          <motion.p
            variants={fadeUp}
            custom={1}
            className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground"
          >
            Chaque trajet est pense pour garantir votre tranquillite d&apos;esprit.
          </motion.p>
        </motion.div>

        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-60px' }}
          variants={stagger}
          className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4"
        >
          {safetyData.map((feat, i) => {
            const Icon = feat.icon
            return (
              <motion.div key={feat.title} variants={scaleIn} custom={i}>
                <Card className="mova-card-hover h-full border-emerald-100 dark:border-emerald-800/50 bg-white/80 dark:bg-emerald-950/50 backdrop-blur-sm">
                  <CardContent className="pt-8 pb-8 flex flex-col items-center text-center">
                    <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-lg shadow-emerald-500/20">
                      <Icon className="h-7 w-7 text-white" />
                    </div>
                    <h3 className="font-bold mb-2">{feat.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {feat.desc}
                    </p>
                  </CardContent>
                </Card>
              </motion.div>
            )
          })}
        </motion.div>

        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={fadeUp}
          custom={0}
          className="mt-12"
        >
          <div className="mx-auto max-w-2xl rounded-2xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20 p-6 text-center">
            <div className="flex items-center justify-center gap-2 mb-3">
              <Shield className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              <span className="font-semibold text-foreground">Engagement MOVA</span>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Tous nos chauffeurs sont verifies : controle d&apos;identite, verification du permis,
              inspection du vehicule et evaluation continue par la communaute.
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════════
   TESTIMONIALS SECTION
   ═══════════════════════════════════════════════════════════════════════════════ */
function TestimonialsSection() {
  const [api, setApi] = useState<CarouselApi | null>(null)
  const [isPaused, setIsPaused] = useState(false)

  useEffect(() => {
    if (!api || isPaused) return
    const timer = setInterval(() => {
      api.scrollNext()
    }, 5000)
    return () => clearInterval(timer)
  }, [api, isPaused])

  return (
    <section id="testimonials" className="py-20 md:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-80px' }}
          className="text-center"
        >
          <motion.div variants={fadeIn}>
            <Badge variant="secondary" className="mb-4 px-4 py-1.5">
              Temoignages
            </Badge>
          </motion.div>
          <motion.h2
            variants={fadeUp}
            custom={0}
            className="text-3xl font-bold tracking-tight sm:text-4xl"
          >
            Ils nous font confiance
          </motion.h2>
        </motion.div>

        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-60px' }}
          variants={fadeUp}
          custom={0}
          className="mt-14"
          onMouseEnter={() => setIsPaused(true)}
          onMouseLeave={() => setIsPaused(false)}
        >
          <Carousel setApi={setApi} opts={{ loop: true, align: 'start' }} className="w-full">
            <CarouselContent className="-ml-4">
              {testimonialsData.map((t) => (
                <CarouselItem key={t.name} className="pl-4 sm:basis-1/2 lg:basis-1/3">
                  <Card className="mova-card-hover h-full border-emerald-100 dark:border-emerald-800/50">
                    <CardContent className="p-6">
                      <div className="flex items-center gap-3 mb-4">
                        <div className={`flex h-10 w-10 items-center justify-center rounded-full ${t.bgColor} text-white text-sm font-bold`}>
                          {t.initials}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-foreground text-sm truncate">{t.name}</p>
                          <p className="text-xs text-muted-foreground">{t.role}</p>
                        </div>
                        <Badge variant="secondary" className="text-xs shrink-0">
                          {t.zone}
                        </Badge>
                      </div>

                      <div className="flex items-center gap-0.5 mb-3">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star
                            key={i}
                            className={`h-4 w-4 ${i < t.rating ? 'text-amber-400 fill-amber-400' : 'text-muted-foreground/30'}`}
                          />
                        ))}
                      </div>

                      <p className="text-sm leading-relaxed text-muted-foreground italic">
                        &ldquo;{t.quote}&rdquo;
                      </p>
                    </CardContent>
                  </Card>
                </CarouselItem>
              ))}
            </CarouselContent>
          </Carousel>
        </motion.div>
      </div>
    </section>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════════
   DOWNLOAD / CTA SECTION
   ═══════════════════════════════════════════════════════════════════════════════ */
function DownloadSection({ onReserve }: { onReserve: () => void }) {
  return (
    <section id="download" className="relative overflow-hidden py-20 md:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-80px' }}
          className="relative rounded-3xl bg-gradient-to-br from-emerald-600 via-emerald-700 to-emerald-800 overflow-hidden"
        >
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute -top-20 -right-20 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
            <div className="absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-emerald-400/20 blur-3xl" />
            <div
              className="absolute inset-0 opacity-[0.04]"
              style={{
                backgroundImage:
                  'radial-gradient(circle, white 1px, transparent 1px)',
                backgroundSize: '30px 30px',
              }}
            />
          </div>

          <div className="relative px-8 py-16 sm:px-16 sm:py-20 text-center">
            <motion.div variants={stagger} initial="hidden" whileInView="visible" viewport={{ once: true }} className="flex flex-col items-center">
              <motion.div variants={fadeUp} custom={0}>
                <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-sm">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-emerald-700 font-bold text-lg">
                    M
                  </div>
                </div>
              </motion.div>

              <motion.h2
                variants={fadeUp}
                custom={1}
                className="text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-5xl"
              >
                Pret a demarrer ?
              </motion.h2>

              <motion.p
                variants={fadeUp}
                custom={2}
                className="mt-4 max-w-xl text-lg text-emerald-100/90"
              >
                Telechargez MOVA et rejoignez des milliers de Conakryens qui se
                deplacent autrement.
              </motion.p>

              <motion.div
                variants={fadeUp}
                custom={3}
                className="mt-10"
              >
                <Button
                  size="lg"
                  onClick={onReserve}
                  className="h-14 px-10 text-base font-semibold bg-white text-emerald-700 hover:bg-emerald-50 shadow-xl shadow-black/10 transition-all"
                >
                  Commencer maintenant
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </motion.div>

              <motion.div
                variants={fadeUp}
                custom={4}
                className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4"
              >
                <button
                  onClick={onReserve}
                  className="flex items-center gap-3 rounded-xl bg-black/20 backdrop-blur-sm px-5 py-3 transition-colors hover:bg-black/30 border border-white/10"
                >
                  <Download className="h-6 w-6 text-white" />
                  <div className="text-left">
                    <p className="text-[10px] text-emerald-100/80 leading-none">
                      DISPONIBLE SUR
                    </p>
                    <p className="text-sm font-semibold text-white leading-tight">
                      Google Play
                    </p>
                  </div>
                </button>

                <button
                  onClick={onReserve}
                  className="flex items-center gap-3 rounded-xl bg-black/20 backdrop-blur-sm px-5 py-3 transition-colors hover:bg-black/30 border border-white/10"
                >
                  <Download className="h-6 w-6 text-white" />
                  <div className="text-left">
                    <p className="text-[10px] text-emerald-100/80 leading-none">
                      TELECHARGER SUR
                    </p>
                    <p className="text-sm font-semibold text-white leading-tight">
                      App Store
                    </p>
                  </div>
                </button>
              </motion.div>

              <motion.div
                variants={fadeUp}
                custom={5}
                className="mt-8 flex items-center justify-center gap-6 text-sm text-emerald-100/80"
              >
                <div className="flex items-center gap-1.5">
                  <Star className="h-4 w-4 text-amber-300 fill-amber-300" />
                  <span>4.8/5 sur Google Play</span>
                </div>
                <div className="h-4 w-px bg-white/30" />
                <span>100K+ telechargements</span>
              </motion.div>
            </motion.div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════════
   FOOTER
   ═══════════════════════════════════════════════════════════════════════════════ */
const FOOTER_CONTENT: Record<string, { title: string; content: string }> = {
  'A propos': {
    title: 'A propos de MOVA',
    content: 'MOVA est la premiere super-app de mobilite en Guinee. Nous connectons passagers, chauffeurs et livreurs pour offrir une experience de deplacement securisee, abordable et moderne a Conakry et dans toute la Guinee. Notre mission est de rendre la mobilite accessible a tous les Guineens grace a la technologie. MOVA propose des courses VTC, des livraisons de colis, du covoiturage, et bien d\'autres services pour simplifier votre quotidien.',
  },
  Carrieres: {
    title: 'Carrieres',
    content: 'Rejoignez l\'equipe MOVA et participez a la revolution de la mobilite en Guinee. Nous recherchons des talents passionnes dans les domaines suivants :\n\n- Developpeur Full-Stack (React/Next.js, Node.js)\n- Designer UI/UX\n- Operations Manager\n- Responsable Marketing\n\nPour postuler, envoyez votre CV et lettre de motivation a cv@mova.gn. Nous offrons un environnement de travail dynamique, une formation continue et des avantages competitifs.',
  },
  Presse: {
    title: 'Presse',
    content: 'MOVA dans les medias. Pour toute demande de presse, kit de presse ou interview, veuillez contacter notre equipe communication a presse@mova.gn.\n\nLe kit de presse MOVA inclut :\n- Logo et charte graphique\n- Photos haute resolution\n- Fiche entreprise\n- Chiffres cles et impact local\n\nDossier de presse disponible sur demande.',
  },
  Blog: {
    title: 'Blog MOVA',
    content: 'Retrouvez bientot nos articles sur le blog MOVA :\n\n- "Comment MOVA transforme la mobilite a Conakry"\n- "5 conseils pour vos trajets quotidiens"\n- "Decouvrez le covoiturage MOVA"\n- "Avenir de la mobilite urbaine en Guinee"\n\nRestez connecte, le blog arrive prochainement !',
  },
  Conditions: {
    title: 'Conditions d\'utilisation',
    content: 'Conditions Generales d\'Utilisation de MOVA\n\n1. Acceptation des conditions : En utilisant l\'application MOVA, vous acceptez les presentes conditions generales.\n\n2. Inscription : L\'utilisateur doit fournir des informations exactes et a jour lors de la creation de son compte.\n\n3. Services : MOVA propose des services de transport, livraison et covoiturage. Les tarifs sont calcules automatiquement et affiches avant confirmation.\n\n4. Paiement : Les paiements peuvent etre effectues en especes, par Mobile Money (Orange Money, MTN Money, Wave) ou via le Wallet MOVA.\n\n5. Securite : MOVA s\'engage a assurer la securite de ses utilisateurs grace a la verification des chauffeurs, le suivi GPS en temps reel et le partage de trajet.\n\n6. Responsabilite : MOVA agit en tant qu\'intermediaire entre passagers et chauffeurs. La responsabilite est limitee aux services fournis via l\'application.\n\n7. Donnees personnelles : Conformement a la loi guineenne, MOVA protege vos donnees personnelles.',
  },
  Confidentialite: {
    title: 'Politique de confidentialite',
    content: 'Politique de Confidentialite MOVA\n\n1. Donnees collectees : Nous collectons votre nom, numero de telephone, localisation GPS, historique de courses et preferences de paiement.\n\n2. Utilisation : Vos donnees sont utilisees pour fournir nos services, ameliorer votre experience et assurer la securite des trajets.\n\n3. Partage : Vos donnees ne sont jamais vendues a des tiers. Elles peuvent etre partagees avec les chauffeurs assignes a vos courses et les autorites competentes en cas d\'urgence.\n\n4. Stockage : Vos donnees sont stockees de maniere securisee sur des serveurs conformes aux normes internationales.\n\n5. Vos droits : Vous pouvez consulter, modifier ou supprimer vos donnees personnelles a tout moment depuis les parametres de l\'application ou en contactant dpo@mova.gn.\n\n6. Cookies : MOVA utilise des cookies essentiels au fonctionnement de l\'application.',
  },
  Cookies: {
    title: 'Politique de cookies',
    content: 'Politique relative aux cookies de MOVA\n\nMOVA utilise des cookies pour ameliorer votre experience sur l\'application.\n\n1. Cookies essentiels : Necessaires au fonctionnement de base de l\'application (authentification, preferences de langue, session). Ces cookies ne peuvent pas etre desactives.\n\n2. Cookies de performance : Utilises pour analyser l\'utilisation de l\'application et detecter les problemes de performance.\n\n3. Cookies de fonctionnalite : Permettent de memoriser vos preferences (zones favorites, type de vehicule, mode de paiement).\n\n4. Gestion : Vous pouvez gerer vos preferences de cookies dans les parametres de votre navigateur.\n\nPour toute question, contactez-nous a dpo@mova.gn.',
  },
}

function Footer({ scrollTo }: { scrollTo: (href: string) => void }) {
  const [footerDialog, setFooterDialog] = useState<{ open: boolean; title: string; content: string } | null>(null)
  const openFooterDialog = (item: string) => {
    const entry = FOOTER_CONTENT[item]
    if (entry) setFooterDialog({ open: true, title: entry.title, content: entry.content })
  }
  return (
    <footer className="border-t bg-white dark:bg-emerald-950/30 mt-auto">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          {/* Brand */}
          <div className="sm:col-span-2 lg:col-span-1">
            <div className="flex items-center gap-2 mb-4">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-700 text-white font-bold text-lg shadow-lg shadow-emerald-500/20">
                M
              </div>
              <span className="text-xl font-bold bg-gradient-to-r from-emerald-600 to-emerald-800 bg-clip-text text-transparent dark:from-emerald-400 dark:to-emerald-600">
                MOVA
              </span>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-xs">
              La super-app de mobilite pour Conakry. Courses, livraisons, covoiturage et plus encore, tout en une seule application.
            </p>
          </div>

          {/* Services */}
          <div>
            <h4 className="font-semibold text-foreground mb-4">Services</h4>
            <ul className="space-y-2.5">
              {['VTC / Courses', 'Livraison', 'Covoiturage', 'Mobile Money', 'Programme Fidelite'].map((item) => (
                <li key={item}>
                  <button
                    onClick={() => scrollTo('#services')}
                    className="text-sm text-muted-foreground hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
                  >
                    {item}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* Entreprise */}
          <div>
            <h4 className="font-semibold text-foreground mb-4">Entreprise</h4>
            <ul className="space-y-2.5">
              {['A propos', 'Carrieres', 'Presse', 'Blog'].map((item) => (
                <li key={item}>
                  <button onClick={() => openFooterDialog(item)} className="text-sm text-muted-foreground hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">
                    {item}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="font-semibold text-foreground mb-4">Legal</h4>
            <ul className="space-y-2.5">
              {['Conditions', 'Confidentialite', 'Cookies'].map((item) => (
                <li key={item}>
                  <button onClick={() => openFooterDialog(item)} className="text-sm text-muted-foreground hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">
                    {item}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <Separator className="my-8" />

        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">
            2025 MOVA. Tous droits reserves.
          </p>
          <div className="flex items-center gap-4">
            <button className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors">
              <Globe className="h-4 w-4" />
            </button>
            <button className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors">
              <Phone className="h-4 w-4" />
            </button>
            <button className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors">
              <Mail className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
      <Dialog open={footerDialog?.open ?? false} onOpenChange={(open) => { if (!open) setFooterDialog(null) }}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto mova-scrollbar">
          <DialogHeader>
            <DialogTitle>{footerDialog?.title}</DialogTitle>
            <DialogDescription className="sr-only">{footerDialog?.title}</DialogDescription>
          </DialogHeader>
          <div className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
            {footerDialog?.content}
          </div>
        </DialogContent>
      </Dialog>
    </footer>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════════
   MAIN LANDING VIEW
   ═══════════════════════════════════════════════════════════════════════════════ */
export default function LandingView() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const setView = useAppStore((s) => s.setView)

  const handleReserve = useCallback(() => {
    setView('auth')
  }, [setView])

  const scrollTo = useCallback((href: string) => {
    const el = document.querySelector(href)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' })
    }
  }, [])

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar
        mobileOpen={mobileOpen}
        setMobileOpen={setMobileOpen}
        scrollTo={scrollTo}
        onReserve={handleReserve}
      />
      <main className="flex-1">
        <HeroSection
          onReserve={handleReserve}
          onDiscover={() => scrollTo('#services')}
        />
        <CountersSection />
        <ServicesSection onReserve={handleReserve} />
        <LiveRideSection />
        <HowItWorksSection />
        <PricingSection />
        <SafetySection />
        <TestimonialsSection />
        <DownloadSection onReserve={handleReserve} />
      </main>
      <Footer scrollTo={scrollTo} />
    </div>
  )
}
