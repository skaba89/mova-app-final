'use client'

import { useState, useEffect, useMemo } from 'react'
import { useAppStore } from '@/lib/mova/store'
import { toast } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  ArrowLeft,
  GraduationCap,
  MapPin,
  Clock,
  Shield,
  Star,
  Check,
  Bus,
  Users,
  Calendar,
  ChevronRight,
  Loader2,
  Route,
  Eye,
  Bell,
  History,
  Baby,
  School,
  Home,
  AlertCircle,
  Phone,
  X,
  Snowflake,
  Award,
} from 'lucide-react'

// ─── Constants ────────────────────────────────────────────────────────

const SCHOOLS = [
  'Lycee Koffiga',
  'Lycee Donka',
  'Lycee Sainte-Marie',
  'CEG Dixinn',
  'Lycee Mohamed Toure',
  'Ecole Primaire Almamya',
  'Groupe Scolaire Aminata Diallo',
  'CEG Ratoma',
]

const COMMUNES = [
  'Kaloum',
  'Dixinn',
  'Matam',
  'Matoto',
  'Ratoma',
]

const GRADE_LEVELS = [
  'Maternelle',
  'CP1-CP2',
  'CE1-CE2',
  'CM1-CM2',
  '6eme-5eme',
  '4eme-3eme',
  '2nde-Tle',
]

/** Maps school names to their zone/commune in Conakry */
const SCHOOL_ZONES: Record<string, string> = {
  'Lycee Koffiga': 'Ratoma',
  'Lycee Donka': 'Dixinn',
  'Lycee Sainte-Marie': 'Dixinn',
  'CEG Dixinn': 'Dixinn',
  'Lycee Mohamed Toure': 'Matam',
  'Ecole Primaire Almamya': 'Matoto',
  'Groupe Scolaire Aminata Diallo': 'Kaloum',
  'CEG Ratoma': 'Ratoma',
}

const SCHEDULES = [
  { id: 'lundi-vendredi', label: 'Lundi-Vendredi' },
  { id: 'lundi-samedi', label: 'Lundi-Samedi' },
  { id: 'personnalise', label: 'Personnalise' },
]

const SERVICE_TYPES = [
  {
    id: 'quotidien',
    name: 'Trajet quotidien',
    desc: 'Aller-retour quotidien',
    priceLabel: 'A partir de 150 000 GNF/mois',
    price: 150000,
    icon: Bus,
    color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    features: ['Aller-retour quotidien', 'Horaires fixes', 'Meme chauffeur'],
  },
  {
    id: 'unique',
    name: 'Trajet unique',
    desc: 'Aller simple',
    priceLabel: 'A partir de 5 000 GNF/course',
    price: 5000,
    icon: Route,
    color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    features: ['Aller simple uniquement', 'Reservation ponctuelle', 'Flexibilite totale'],
  },
  {
    id: 'activites',
    name: 'Transport activites',
    desc: 'Extrascolaire',
    priceLabel: 'A partir de 3 000 GNF/course',
    price: 3000,
    icon: Calendar,
    color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    features: ['Activites sportives', 'Cours du soir', 'Sorties scolaires'],
  },
]

const DEMO_DRIVERS = [
  {
    id: 'drv-1',
    name: 'Mamadou Bah',
    vehicle: 'Minibus 16 places',
    vehicleType: 'minibus',
    rating: 4.9,
    experience: '5 ans',
    badge: 'Verifie',
    badges: ['Verifie', 'Exp. 3+ ans', 'Climatise'],
    dailyRoute: 'Kaloum - Dixinn - Matam',
    weeklyTrips: 45,
    studentsCount: 12,
  },
  {
    id: 'drv-2',
    name: 'Ibrahima Soumah',
    vehicle: 'Bus scolaire 30 places',
    vehicleType: 'bus',
    rating: 4.8,
    experience: '7 ans',
    badge: 'Verifie',
    badges: ['Verifie', 'Exp. 3+ ans', 'Climatise'],
    dailyRoute: 'Ratoma - Matoto - Dixinn',
    weeklyTrips: 38,
    studentsCount: 22,
  },
  {
    id: 'drv-3',
    name: 'Abdoulaye Diallo',
    vehicle: 'Minibus 14 places',
    vehicleType: 'minibus',
    rating: 4.7,
    experience: '4 ans',
    badge: 'Verifie',
    badges: ['Verifie', 'Exp. 3+ ans'],
    dailyRoute: 'Matoto - Ratoma - Kaloum',
    weeklyTrips: 42,
    studentsCount: 10,
  },
  {
    id: 'drv-4',
    name: 'Sekou Conde',
    vehicle: 'Minibus 20 places',
    vehicleType: 'minibus',
    rating: 5.0,
    experience: '6 ans',
    badge: 'Verifie',
    badges: ['Verifie', 'Exp. 3+ ans', 'Climatise'],
    dailyRoute: 'Dixinn - Kaloum - Matam',
    weeklyTrips: 50,
    studentsCount: 16,
  },
  {
    id: 'drv-5',
    name: 'Fode Camara',
    vehicle: 'Bus scolaire 25 places',
    vehicleType: 'bus',
    rating: 4.9,
    experience: '8 ans',
    badge: 'Verifie',
    badges: ['Verifie', 'Exp. 3+ ans', 'Climatise'],
    dailyRoute: 'Kaloum - Ratoma - Dixinn - Matoto',
    weeklyTrips: 55,
    studentsCount: 20,
  },
]

const DEMO_SUBSCRIPTIONS: Array<{
  id: string; childName: string; school: string; route: string;
  schedule: string; monthlyCost: number; renewalDate: string;
  status: 'active' | 'cancelled'; driverName: string;
  pickupTime: string; returnTime: string;
}> = [
  {
    id: 'sub-demo-1',
    childName: 'Aminata Diallo',
    school: 'Lycee Sainte-Marie',
    route: 'Kaloum - Dixinn',
    schedule: 'Lundi-Vendredi',
    monthlyCost: 150000,
    renewalDate: '2025-02-15',
    status: 'active' as const,
    driverName: 'Mamadou Bah',
    pickupTime: '07:00',
    returnTime: '16:30',
  },
]

const DEMO_TRIP_HISTORY = [
  { id: 'trip-1', date: '2025-01-10', childName: 'Aminata Diallo', pickup: 'Kaloum', dropoff: 'Lycee Sainte-Marie', status: 'Termine', driver: 'Mamadou Bah' },
  { id: 'trip-2', date: '2025-01-10', childName: 'Aminata Diallo', pickup: 'Lycee Sainte-Marie', dropoff: 'Kaloum', status: 'Termine', driver: 'Mamadou Bah' },
  { id: 'trip-3', date: '2025-01-09', childName: 'Aminata Diallo', pickup: 'Kaloum', dropoff: 'Lycee Sainte-Marie', status: 'Termine', driver: 'Mamadou Bah' },
  { id: 'trip-4', date: '2025-01-09', childName: 'Aminata Diallo', pickup: 'Lycee Sainte-Marie', dropoff: 'Kaloum', status: 'Termine', driver: 'Mamadou Bah' },
  { id: 'trip-5', date: '2025-01-08', childName: 'Aminata Diallo', pickup: 'Kaloum', dropoff: 'Lycee Sainte-Marie', status: 'Annule', driver: 'Mamadou Bah' },
]

// ─── Helpers ──────────────────────────────────────────────────────────

function formatGNF(amount: number) {
  return new Intl.NumberFormat('fr-FR').format(amount) + ' GNF'
}

// ─── Fade-in variant ─────────────────────────────────────────────────

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.06, duration: 0.4, ease: 'easeOut' as const },
  }),
}

// ─── Main Component ──────────────────────────────────────────────────

export default function SchoolView() {
  const { goBack, user } = useAppStore()

  // ── Form state ──
  const [childFirstName, setChildFirstName] = useState('')
  const [childLastName, setChildLastName] = useState('')
  const [school, setSchool] = useState('')
  const [commune, setCommune] = useState('')
  const [gradeLevel, setGradeLevel] = useState('')
  const [schedule, setSchedule] = useState('lundi-vendredi')
  const [pickupTime, setPickupTime] = useState('07:00')
  const [serviceType, setServiceType] = useState('quotidien')
  const [selectedDriver, setSelectedDriver] = useState<string | null>(null)

  // ── UI state ──
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isLoadingData, setIsLoadingData] = useState(true)
  const [dataError, setDataError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState('booking')
  const [showBookingForm, setShowBookingForm] = useState(false)
  const [subscriptions, setSubscriptions] = useState(DEMO_SUBSCRIPTIONS)
  const [expandedSubscription, setExpandedSubscription] = useState<string | null>(null)

  // ── Computed ──
  const selectedServiceType = SERVICE_TYPES.find((s) => s.id === serviceType)
  const selectedDriverData = DEMO_DRIVERS.find((d) => d.id === selectedDriver)
  const activeSubscriptions = subscriptions.filter((s) => s.status === 'active')

  // ── Fetch subscriptions on mount ──
  useEffect(() => {
    async function fetchData() {
      try {
        const token = localStorage.getItem('mova_token')
        const headers: Record<string, string> = {}
        if (token) headers['Authorization'] = `Bearer ${token}`
        if (user?.id) headers['x-user-id'] = user.id

        const res = await fetch('/api/mova/school', { headers })
        if (!res.ok) throw new Error('Erreur serveur')
        const data = await res.json()
        if (data.subscriptions && data.subscriptions.length > 0) {
          setSubscriptions(
            data.subscriptions.map((s: Record<string, unknown>) => ({
              id: s.id as string,
              childName: (s.childName as string) || '',
              school: (s.schoolName as string) || '',
              route: `${s.homeZone || 'Conakry'} - ${s.schoolZone || 'Conakry'}`,
              schedule: s.schedule === 'both' ? 'Lundi-Vendredi' : s.schedule === 'morning' ? 'Matin seuleument' : 'Apres-midi seuleument',
              monthlyCost: (s.price as number) || 0,
              renewalDate: s.expiresAt ? new Date(s.expiresAt as string).toISOString().split('T')[0] : '',
              status: (s.status as string) || 'active',
              driverName: 'Chauffeur MOVA',
              pickupTime: '07:00',
              returnTime: '16:30',
            }))
          )
        }
      } catch {
        setDataError('Impossible de charger les donnees. Veuillez reessayer.')
      } finally {
        queueMicrotask(() => setIsLoadingData(false))
      }
    }
    fetchData()
  }, [user?.id])

  // ── Submit booking ──
  const handleSubmit = async () => {
    if (!childFirstName.trim() || !school || !commune) {
      toast.error('Veuillez remplir tous les champs obligatoires (prenom, ecole, commune).')
      return
    }
    if (!gradeLevel) {
      toast.error('Veuillez selectionner le niveau scolaire.')
      return
    }
    if (!pickupTime) {
      toast.error('Veuillez indiquer l\'heure de prise en charge.')
      return
    }

    setIsSubmitting(true)
    try {
      const token = localStorage.getItem('mova_token')
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      }
      if (token) headers['Authorization'] = `Bearer ${token}`
      if (user?.id) headers['x-user-id'] = user.id

      const scheduleMap: Record<string, string> = {
        'lundi-vendredi': 'both',
        'lundi-samedi': 'both',
        'personnalise': 'both',
      }
      const packageTypeMap: Record<string, string> = {
        'quotidien': 'monthly',
        'unique': 'monthly',
        'activites': 'monthly',
      }

      const res = await fetch('/api/mova/school', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          childName: `${childFirstName} ${childLastName}`.trim(),
          schoolName: school,
          schoolAddress: school,
          homeAddress: commune,
          pickupZone: commune,
          dropoffZone: SCHOOL_ZONES[school] || commune,
          schedule: scheduleMap[schedule] || 'both',
          packageType: packageTypeMap[serviceType] || 'monthly',
          notes: JSON.stringify({
            gradeLevel,
            pickupTime,
            serviceType,
            schedule,
            driverId: selectedDriver,
          }),
        }),
      })

      const data = await res.json()
      if (!res.ok || !data.success) {
        toast.error(data.error || 'Erreur lors de la reservation du transport scolaire.')
        return
      }

      toast.success('Transport scolaire reserve avec succes !', {
        description: `${childFirstName} ${childLastName} - ${school} - ${selectedServiceType?.name}`,
      })

      // Reset form
      setChildFirstName('')
      setChildLastName('')
      setSchool('')
      setCommune('')
      setGradeLevel('')
      setSchedule('lundi-vendredi')
      setPickupTime('07:00')
      setServiceType('quotidien')
      setSelectedDriver(null)
      setShowBookingForm(false)

      // Add to local subscriptions
      const newSub = {
        id: data.subscription?.id || `sub-${Date.now()}`,
        childName: `${childFirstName} ${childLastName}`.trim(),
        school,
        route: `${commune} - ${commune}`,
        schedule: SCHEDULES.find((s) => s.id === schedule)?.label || schedule,
        monthlyCost: selectedServiceType?.price ?? 150000,
        renewalDate: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
        status: 'active' as const,
        driverName: selectedDriverData?.name || 'Chauffeur MOVA',
        pickupTime,
        returnTime: '',
      }
      setSubscriptions((prev) => [newSub, ...prev])
    } catch {
      toast.error('Erreur de connexion. Veuillez reessayer.')
    } finally {
      setIsSubmitting(false)
    }
  }

  // ── Cancel subscription ──
  const handleCancelSubscription = (subId: string) => {
    setSubscriptions((prev) =>
      prev.map((s) => (s.id === subId ? { ...s, status: 'cancelled' as const } : s))
    )
    setExpandedSubscription(null)
    toast.success('Abonnement annule. Votre enfant ne sera plus pris en charge.')
  }

  return (
    <div className="min-h-screen bg-background">
      {/* ─── Sticky Header ─── */}
      <div className="sticky top-0 z-40 mova-glass border-b">
        <div className="flex items-center gap-3 px-4 py-3 max-w-4xl mx-auto">
          <Button variant="ghost" size="icon" onClick={goBack} className="shrink-0">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-emerald-600 flex items-center justify-center">
              <GraduationCap className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold">Transport Scolaire</h1>
              <p className="text-xs text-muted-foreground">MOVA Ecole</p>
            </div>
          </div>
        </div>
      </div>

      <ScrollArea className="h-[calc(100vh-64px)]">
        <div className="max-w-4xl mx-auto p-4 space-y-6 pb-24">

          {/* ═══════════════════════════════════════════════════════════════
              1. HERO SECTION
          ═══════════════════════════════════════════════════════════════ */}
          <motion.section
            initial="hidden"
            animate="visible"
            className="mova-gradient rounded-2xl p-6 text-white relative overflow-hidden"
          >
            {/* Background pattern */}
            <div className="absolute inset-0 opacity-10">
              <div className="absolute top-4 right-4 w-32 h-32 rounded-full border-2 border-white" />
              <div className="absolute bottom-2 right-12 w-20 h-20 rounded-full border border-white" />
              <div className="absolute top-8 left-8 w-6 h-6 rounded-full bg-white" />
            </div>

            <div className="relative z-10">
              <motion.div variants={fadeUp} custom={0} className="flex items-center gap-3 mb-3">
                <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center">
                  <GraduationCap className="h-8 w-8 text-white" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold">Transport Scolaire MOVA</h2>
                  <p className="text-sm text-white/80">Le transport scolaire securise pour vos enfants</p>
                </div>
              </motion.div>

              {/* Safety Badge */}
              <motion.div variants={fadeUp} custom={1} className="flex items-center gap-2 bg-white/15 backdrop-blur rounded-xl px-4 py-2.5 mb-5 max-w-lg">
                <Shield className="h-5 w-5 text-amber-300 flex-shrink-0" />
                <p className="text-sm text-white/90">
                  Conducteurs verifies et vehicules equipes de ceintures
                </p>
              </motion.div>

              {/* Stats Row */}
              <motion.div variants={fadeUp} custom={2} className="grid grid-cols-3 gap-3">
                <div className="bg-white/15 backdrop-blur rounded-xl p-3 text-center">
                  <School className="h-5 w-5 mx-auto mb-1 text-amber-300" />
                  <p className="text-xl font-bold">500+</p>
                  <p className="text-[11px] text-white/70">Ecoles desservies</p>
                </div>
                <div className="bg-white/15 backdrop-blur rounded-xl p-3 text-center">
                  <Baby className="h-5 w-5 mx-auto mb-1 text-amber-300" />
                  <p className="text-xl font-bold">2 000+</p>
                  <p className="text-[11px] text-white/70">Eleves transportes</p>
                </div>
                <div className="bg-white/15 backdrop-blur rounded-xl p-3 text-center">
                  <Star className="h-5 w-5 mx-auto mb-1 text-amber-300" />
                  <p className="text-xl font-bold">4.9/5</p>
                  <p className="text-[11px] text-white/70">Note parents</p>
                </div>
              </motion.div>
            </div>
          </motion.section>

          {/* ═══════════════════════════════════════════════════════════════
              2. SERVICE TYPES
          ═══════════════════════════════════════════════════════════════ */}
          <motion.section initial="hidden" animate="visible">
            <motion.h3 variants={fadeUp} custom={0} className="text-base font-semibold mb-3 flex items-center gap-2">
              <Bus className="h-4 w-4 text-emerald-600" />
              Types de services
            </motion.h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {SERVICE_TYPES.map((svc, idx) => {
                const Icon = svc.icon
                const isSelected = serviceType === svc.id
                return (
                  <motion.div key={svc.id} variants={fadeUp} custom={idx + 1}>
                    <Card
                      className={`cursor-pointer transition-all mova-card-hover ${
                        isSelected
                          ? 'ring-2 ring-emerald-500 border-emerald-300 dark:border-emerald-700'
                          : ''
                      }`}
                      onClick={() => {
                        setServiceType(svc.id)
                        if (!showBookingForm) setShowBookingForm(true)
                      }}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${svc.color}`}>
                            <Icon className="h-5 w-5" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold">{svc.name}</p>
                            <p className="text-xs text-muted-foreground">{svc.desc}</p>
                            <p className="text-sm font-bold text-emerald-600 mt-1">{svc.priceLabel}</p>
                          </div>
                          {isSelected && (
                            <Check className="h-5 w-5 text-emerald-600 flex-shrink-0" />
                          )}
                        </div>
                        <div className="mt-3 space-y-1">
                          {svc.features.map((feat) => (
                            <div key={feat} className="flex items-center gap-2 text-xs text-muted-foreground">
                              <Check className="h-3 w-3 text-emerald-500" />
                              {feat}
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                )
              })}
            </div>
          </motion.section>

          {/* ═══════════════════════════════════════════════════════════════
              TABS: Booking / Mes abonnements / Tableau de bord
          ═══════════════════════════════════════════════════════════════ */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="booking" className="text-xs sm:text-sm">
                <GraduationCap className="h-4 w-4 mr-1.5 hidden sm:inline-block" />
                Reservation
              </TabsTrigger>
              <TabsTrigger value="subscriptions" className="text-xs sm:text-sm">
                <Award className="h-4 w-4 mr-1.5 hidden sm:inline-block" />
                Abonnements
                {activeSubscriptions.length > 0 && (
                  <Badge className="ml-1.5 bg-emerald-100 text-emerald-700 text-[10px] px-1.5">{activeSubscriptions.length}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="dashboard" className="text-xs sm:text-sm">
                <Eye className="h-4 w-4 mr-1.5 hidden sm:inline-block" />
                Suivi
              </TabsTrigger>
            </TabsList>

            {/* ═══════════════════════════════════════════════════════════════
                TAB: BOOKING FORM
            ═══════════════════════════════════════════════════════════════ */}
            <TabsContent value="booking" className="space-y-4 mt-4">
              {!showBookingForm ? (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center py-8 text-center">
                  <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mb-4">
                    <GraduationCap className="h-8 w-8 text-emerald-600" />
                  </div>
                  <h3 className="font-semibold text-lg mb-1">Reserver un transport scolaire</h3>
                  <p className="text-sm text-muted-foreground max-w-sm mb-5">
                    Choisissez un type de service ci-dessus ou cliquez sur le bouton pour commencer votre reservation.
                  </p>
                  <Button
                    className="mova-gradient font-semibold rounded-xl px-8"
                    onClick={() => setShowBookingForm(true)}
                  >
                    <GraduationCap className="h-4 w-4 mr-2" />
                    Nouvelle reservation
                  </Button>
                </motion.div>
              ) : (
                <AnimatePresence mode="wait">
                  <motion.div
                    key="booking-form"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                  >
                    <Card>
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-base flex items-center gap-2">
                            <GraduationCap className="h-5 w-5 text-emerald-600" />
                            Formulaire de reservation
                          </CardTitle>
                          <Button variant="ghost" size="icon" onClick={() => setShowBookingForm(false)}>
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {/* Route visualization */}
                        <div className="flex items-center gap-3 p-4 bg-emerald-50 dark:bg-emerald-950/20 rounded-xl">
                          <div className="flex flex-col items-center">
                            <Home className="h-4 w-4 text-emerald-500" />
                            <div className="w-0.5 h-6 bg-emerald-300" />
                            <Bus className="h-4 w-4 text-amber-500" />
                            <div className="w-0.5 h-6 bg-emerald-300" />
                            <School className="h-4 w-4 text-emerald-500" />
                          </div>
                          <div className="flex-1 space-y-3">
                            <div>
                              <p className="text-xs text-muted-foreground">Domicile</p>
                              <p className="text-sm font-medium">{commune || 'Commune non definie'}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Transport</p>
                              <p className="text-sm font-medium text-amber-600">Bus MOVA Ecole</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Ecole</p>
                              <p className="text-sm font-medium">{school || 'Ecole non definie'}</p>
                            </div>
                          </div>
                        </div>

                        {/* Child info */}
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-2">
                            <Label className="text-sm font-medium">Prenom de l&apos;enfant *</Label>
                            <Input
                              placeholder="Ex: Aminata"
                              value={childFirstName}
                              onChange={(e) => setChildFirstName(e.target.value)}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-sm font-medium">Nom de l&apos;enfant</Label>
                            <Input
                              placeholder="Ex: Diallo"
                              value={childLastName}
                              onChange={(e) => setChildLastName(e.target.value)}
                            />
                          </div>
                        </div>

                        {/* School select */}
                        <div className="space-y-2">
                          <Label className="text-sm font-medium">Ecole *</Label>
                          <Select value={school} onValueChange={setSchool}>
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Choisir l'ecole" />
                            </SelectTrigger>
                            <SelectContent>
                              {SCHOOLS.map((s) => (
                                <SelectItem key={s} value={s}>{s}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        {/* Home commune */}
                        <div className="space-y-2">
                          <Label className="text-sm font-medium">Adresse domicile / Commune *</Label>
                          <Select value={commune} onValueChange={setCommune}>
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Choisir la commune" />
                            </SelectTrigger>
                            <SelectContent>
                              {COMMUNES.map((c) => (
                                <SelectItem key={c} value={c}>{c}, Conakry</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        {/* Grade level */}
                        <div className="space-y-2">
                          <Label className="text-sm font-medium">Niveau scolaire *</Label>
                          <Select value={gradeLevel} onValueChange={setGradeLevel}>
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Choisir le niveau" />
                            </SelectTrigger>
                            <SelectContent>
                              {GRADE_LEVELS.map((g) => (
                                <SelectItem key={g} value={g}>{g}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        {/* Schedule */}
                        <div className="space-y-2">
                          <Label className="text-sm font-medium">Planning</Label>
                          <div className="grid grid-cols-3 gap-2">
                            {SCHEDULES.map((s) => (
                              <button
                                key={s.id}
                                onClick={() => setSchedule(s.id)}
                                className={`p-3 rounded-xl border-2 text-center transition-all ${
                                  schedule === s.id
                                    ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/20'
                                    : 'border-transparent bg-muted hover:bg-muted/80'
                                }`}
                              >
                                <Calendar className={`h-4 w-4 mx-auto mb-1 ${
                                  schedule === s.id ? 'text-emerald-600' : 'text-muted-foreground'
                                }`} />
                                <p className={`text-xs font-medium ${
                                  schedule === s.id ? 'text-emerald-700' : ''
                                }`}>{s.label}</p>
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Pickup time */}
                        <div className="space-y-2">
                          <Label className="text-sm font-medium">Heure de prise en charge</Label>
                          <Input
                            type="time"
                            value={pickupTime}
                            onChange={(e) => setPickupTime(e.target.value)}
                          />
                        </div>

                        {/* Service type */}
                        <div className="space-y-2">
                          <Label className="text-sm font-medium">Type de service</Label>
                          <Select value={serviceType} onValueChange={setServiceType}>
                            <SelectTrigger className="w-full">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {SERVICE_TYPES.map((s) => (
                                <SelectItem key={s.id} value={s.id}>
                                  {s.name} - {s.desc} ({s.priceLabel})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        {/* Summary */}
                        {selectedServiceType && (
                          <div className="bg-emerald-50 dark:bg-emerald-950/30 rounded-xl p-4 space-y-2">
                            <div className="flex justify-between text-sm">
                              <span className="text-muted-foreground">Enfant</span>
                              <span className="font-medium">{childFirstName || '-'} {childLastName || ''}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span className="text-muted-foreground">Ecole</span>
                              <span className="font-medium">{school || '-'}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span className="text-muted-foreground">Commune</span>
                              <span className="font-medium">{commune || '-'}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span className="text-muted-foreground">Niveau</span>
                              <span className="font-medium">{gradeLevel || '-'}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span className="text-muted-foreground">Planning</span>
                              <span className="font-medium">{SCHEDULES.find((s) => s.id === schedule)?.label}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span className="text-muted-foreground">Prise en charge</span>
                              <span className="font-medium">{pickupTime}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span className="text-muted-foreground">Service</span>
                              <span className="font-medium">{selectedServiceType.name}</span>
                            </div>
                            {selectedDriverData && (
                              <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Conducteur</span>
                                <span className="font-medium">{selectedDriverData.name}</span>
                              </div>
                            )}
                            <Separator />
                            <div className="flex justify-between">
                              <span className="font-semibold">Tarif</span>
                              <span className="font-bold text-emerald-700 text-lg">{selectedServiceType.priceLabel}</span>
                            </div>
                          </div>
                        )}

                        {/* Submit */}
                        <Button
                          className="w-full bg-emerald-600 hover:bg-emerald-700 h-12 mova-gradient text-base font-semibold"
                          onClick={handleSubmit}
                          disabled={!childFirstName.trim() || !school || !commune || !gradeLevel || isSubmitting}
                        >
                          {isSubmitting ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Reservation en cours...
                            </>
                          ) : (
                            <>
                              <Check className="h-4 w-4 mr-2" />
                              Confirmer la reservation
                            </>
                          )}
                        </Button>
                      </CardContent>
                    </Card>
                  </motion.div>
                </AnimatePresence>
              )}
            </TabsContent>

            {/* ═══════════════════════════════════════════════════════════════
                TAB: SUBSCRIPTIONS
            ═══════════════════════════════════════════════════════════════ */}
            <TabsContent value="subscriptions" className="space-y-4 mt-4">
              {isLoadingData ? (
                <div className="space-y-3">
                  {Array.from({ length: 2 }).map((_, i) => (
                    <Card key={i}>
                      <CardContent className="p-4 space-y-3">
                        <div className="flex items-center gap-3">
                          <Skeleton className="h-10 w-10 rounded-full" />
                          <div className="flex-1 space-y-2">
                            <Skeleton className="h-4 w-32" />
                            <Skeleton className="h-3 w-48" />
                          </div>
                        </div>
                        <Skeleton className="h-3 w-full" />
                        <div className="grid grid-cols-2 gap-2">
                          <Skeleton className="h-16 rounded-lg" />
                          <Skeleton className="h-16 rounded-lg" />
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : dataError ? (
                <Card className="border-red-200 bg-red-50 dark:bg-red-950/10 dark:border-red-800">
                  <CardContent className="p-4 flex items-center gap-3">
                    <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-red-700 dark:text-red-400">{dataError}</p>
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-2 border-red-300 text-red-700 dark:border-red-700 dark:text-red-400"
                        onClick={() => window.location.reload()}
                      >
                        Reessayer
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ) : subscriptions.length === 0 ? (
                <div className="flex flex-col items-center py-12 text-center">
                  <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                    <GraduationCap className="w-8 h-8 text-muted-foreground" />
                  </div>
                  <h3 className="font-semibold text-base mb-1">Aucun abonnement</h3>
                  <p className="text-sm text-muted-foreground max-w-xs mb-4">
                    Creez votre premier abonnement de transport scolaire pour vos enfants.
                  </p>
                  <Button
                    className="mova-gradient font-semibold rounded-xl"
                    onClick={() => {
                      setActiveTab('booking')
                      setShowBookingForm(true)
                    }}
                  >
                    <GraduationCap className="h-4 w-4 mr-2" />
                    Nouvel abonnement
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {subscriptions.map((sub) => (
                    <Card key={sub.id} className="mova-card-hover overflow-hidden">
                      <CardContent className="p-4">
                        {/* Header */}
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                              <Baby className="h-5 w-5 text-amber-600" />
                            </div>
                            <div>
                              <p className="text-sm font-semibold">{sub.childName}</p>
                              <p className="text-xs text-muted-foreground">{sub.school}</p>
                            </div>
                          </div>
                          <Badge
                            className={
                              sub.status === 'active'
                                ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100'
                                : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'
                            }
                          >
                            {sub.status === 'active' ? 'Actif' : 'Annule'}
                          </Badge>
                        </div>

                        {/* Info grid */}
                        <div className="grid grid-cols-2 gap-2 mb-3">
                          <div className="bg-muted/50 rounded-lg p-2.5">
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Trajet</p>
                            <p className="text-xs font-medium flex items-center gap-1 mt-0.5">
                              <Route className="h-3 w-3 text-emerald-500" />
                              {sub.route}
                            </p>
                          </div>
                          <div className="bg-muted/50 rounded-lg p-2.5">
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Planning</p>
                            <p className="text-xs font-medium flex items-center gap-1 mt-0.5">
                              <Calendar className="h-3 w-3 text-emerald-500" />
                              {sub.schedule}
                            </p>
                          </div>
                          <div className="bg-muted/50 rounded-lg p-2.5">
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Cout mensuel</p>
                            <p className="text-xs font-bold text-emerald-600">{formatGNF(sub.monthlyCost)}</p>
                          </div>
                          <div className="bg-muted/50 rounded-lg p-2.5">
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Renouvellement</p>
                            <p className="text-xs font-medium flex items-center gap-1 mt-0.5">
                              <Calendar className="h-3 w-3 text-amber-500" />
                              {sub.renewalDate}
                            </p>
                          </div>
                        </div>

                        {/* Expanded details */}
                        <AnimatePresence>
                          {expandedSubscription === sub.id && sub.status === 'active' && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              className="overflow-hidden"
                            >
                              <Separator className="my-3" />
                              <div className="space-y-2">
                                <div className="flex justify-between text-sm">
                                  <span className="text-muted-foreground">Conducteur</span>
                                  <span className="font-medium">{sub.driverName}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                  <span className="text-muted-foreground">Prise en charge</span>
                                  <span className="font-medium">{sub.pickupTime}</span>
                                </div>
                                {sub.returnTime && (
                                  <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">Retour</span>
                                    <span className="font-medium">{sub.returnTime}</span>
                                  </div>
                                )}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>

                        {/* Actions */}
                        {sub.status === 'active' && (
                          <div className="flex gap-2 mt-3">
                            <Button
                              variant="outline"
                              size="sm"
                              className="flex-1 rounded-xl text-xs"
                              onClick={() =>
                                setExpandedSubscription(
                                  expandedSubscription === sub.id ? null : sub.id
                                )
                              }
                            >
                              {expandedSubscription === sub.id ? (
                                <>Masquer <X className="h-3 w-3 ml-1" /></>
                              ) : (
                                <>Details <ChevronRight className="h-3 w-3 ml-1" /></>
                              )}
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="flex-1 rounded-xl text-xs"
                              onClick={() => {
                                setActiveTab('booking')
                                setShowBookingForm(true)
                                toast.info('Modifiez les informations dans le formulaire de reservation.')
                              }}
                            >
                              Modifier
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="flex-1 rounded-xl text-xs border-red-200 text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/20"
                              onClick={() => handleCancelSubscription(sub.id)}
                            >
                              Annuler
                            </Button>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* ═══════════════════════════════════════════════════════════════
                TAB: PARENT DASHBOARD
            ═══════════════════════════════════════════════════════════════ */}
            <TabsContent value="dashboard" className="space-y-4 mt-4">
              {/* Real-time tracking */}
              <Card className="mova-card-hover">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-11 h-11 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                      <Eye className="h-5 w-5 text-emerald-600" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold">Suivi en temps reel</p>
                      <p className="text-xs text-muted-foreground">Suivez le bus de votre enfant sur la carte</p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      <span className="text-[10px] text-emerald-600 font-medium">En direct</span>
                    </div>
                  </div>

                  {/* Map placeholder */}
                  <div className="rounded-xl bg-muted/50 h-48 flex flex-col items-center justify-center relative overflow-hidden">
                    <div className="absolute inset-0 opacity-20">
                      <svg className="w-full h-full" viewBox="0 0 400 200" preserveAspectRatio="none">
                        <defs>
                          <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
                            <path d="M 20 0 L 0 0 0 20" fill="none" stroke="currentColor" strokeWidth="0.5" className="text-muted-foreground" />
                          </pattern>
                        </defs>
                        <rect width="400" height="200" fill="url(#grid)" />
                      </svg>
                    </div>
                    <MapPin className="h-8 w-8 text-emerald-500 mb-2 relative" />
                    <p className="text-xs text-muted-foreground relative">Carte de suivi - Bus en approche</p>
                    <p className="text-[10px] text-muted-foreground relative mt-1">Arrivee estimee : 06h45</p>
                  </div>

                  {activeSubscriptions.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center mt-3">
                      Activez un abonnement pour suivre le bus de votre enfant.
                    </p>
                  ) : (
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <div className="bg-emerald-50 dark:bg-emerald-950/20 rounded-lg p-2.5 text-center">
                        <p className="text-[10px] text-muted-foreground">Position</p>
                        <p className="text-xs font-semibold text-emerald-700">Almamiya - Dixinn</p>
                      </div>
                      <div className="bg-amber-50 dark:bg-amber-950/20 rounded-lg p-2.5 text-center">
                        <p className="text-[10px] text-muted-foreground">Arrivee</p>
                        <p className="text-xs font-semibold text-amber-700">~8 min</p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Automatic notifications */}
              <Card className="mova-card-hover">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-11 h-11 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                      <Bell className="h-5 w-5 text-amber-600" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold">Notifications automatiques</p>
                      <p className="text-xs text-muted-foreground">Alertes de prise en charge et de depot</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {[
                      { icon: Home, text: 'Prise en charge domicile', time: '07:02', status: 'Confirme' },
                      { icon: Bus, text: 'En route vers l\'ecole', time: '07:15', status: 'En cours' },
                      { icon: School, text: 'Arrivee a l\'ecole', time: '07:32', status: 'Prevu' },
                      { icon: Home, text: 'Retour au domicile', time: '16:30', status: 'Prevu' },
                    ].map((notif, idx) => {
                      const Icon = notif.icon
                      return (
                        <div key={idx} className="flex items-center gap-3 p-2.5 rounded-lg bg-muted/50">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                            notif.status === 'En cours'
                              ? 'bg-amber-100 dark:bg-amber-900/30'
                              : notif.status === 'Confirme'
                                ? 'bg-emerald-100 dark:bg-emerald-900/30'
                                : 'bg-muted'
                          }`}>
                            <Icon className={`h-4 w-4 ${
                              notif.status === 'En cours'
                                ? 'text-amber-600'
                                : notif.status === 'Confirme'
                                  ? 'text-emerald-600'
                                  : 'text-muted-foreground'
                            }`} />
                          </div>
                          <div className="flex-1">
                            <p className="text-xs font-medium">{notif.text}</p>
                            <p className="text-[10px] text-muted-foreground">{notif.time}</p>
                          </div>
                          <Badge
                            variant="secondary"
                            className={`text-[10px] ${
                              notif.status === 'En cours'
                                ? 'bg-amber-100 text-amber-700'
                                : notif.status === 'Confirme'
                                  ? 'bg-emerald-100 text-emerald-700'
                                  : ''
                            }`}
                          >
                            {notif.status}
                          </Badge>
                        </div>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>

              {/* Trip history */}
              <Card className="mova-card-hover">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-11 h-11 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                      <History className="h-5 w-5 text-emerald-600" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold">Historique des trajets</p>
                      <p className="text-xs text-muted-foreground">Derniers trajets de votre enfant</p>
                    </div>
                    <Badge variant="secondary" className="text-xs">{DEMO_TRIP_HISTORY.length}</Badge>
                  </div>

                  <div className="space-y-2 max-h-96 overflow-y-auto mova-scrollbar">
                    {DEMO_TRIP_HISTORY.map((trip) => (
                      <div key={trip.id} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted/50 transition-colors">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                          trip.status === 'Termine'
                            ? 'bg-emerald-100 dark:bg-emerald-900/30'
                            : 'bg-red-100 dark:bg-red-900/30'
                        }`}>
                          {trip.status === 'Termine'
                            ? <Check className="h-4 w-4 text-emerald-600" />
                            : <X className="h-4 w-4 text-red-500" />
                          }
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium truncate">
                            {trip.pickup} - {trip.dropoff}
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            {trip.date} - {trip.driver}
                          </p>
                        </div>
                        <Badge
                          variant="secondary"
                          className={`text-[10px] flex-shrink-0 ${
                            trip.status === 'Termine'
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-red-100 text-red-600'
                          }`}
                        >
                          {trip.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          {/* ═══════════════════════════════════════════════════════════════
              4. AVAILABLE DRIVERS
          ═══════════════════════════════════════════════════════════════ */}
          <motion.section initial="hidden" animate="visible">
            <motion.h3 variants={fadeUp} custom={0} className="text-base font-semibold mb-3 flex items-center gap-2">
              <Users className="h-4 w-4 text-emerald-600" />
              Conducteurs disponibles
              <Badge variant="secondary" className="text-xs font-normal">{DEMO_DRIVERS.length}</Badge>
            </motion.h3>

            <div className="space-y-3 max-h-[600px] overflow-y-auto mova-scrollbar">
              {DEMO_DRIVERS.map((driver, idx) => {
                const isSelected = selectedDriver === driver.id
                return (
                  <motion.div key={driver.id} variants={fadeUp} custom={idx + 1}>
                    <Card
                      className={`cursor-pointer transition-all mova-card-hover ${
                        isSelected
                          ? 'ring-2 ring-emerald-500 border-emerald-300 dark:border-emerald-700'
                          : ''
                      }`}
                      onClick={() => setSelectedDriver(isSelected ? null : driver.id)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          {/* Avatar */}
                          <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
                            isSelected
                              ? 'bg-emerald-100 dark:bg-emerald-900/30'
                              : 'bg-muted'
                          }`}>
                            {driver.vehicleType === 'bus' ? (
                              <Bus className={`h-6 w-6 ${isSelected ? 'text-emerald-600' : 'text-muted-foreground'}`} />
                            ) : (
                              <Bus className={`h-6 w-6 ${isSelected ? 'text-emerald-600' : 'text-muted-foreground'}`} />
                            )}
                          </div>

                          <div className="flex-1 min-w-0">
                            {/* Name + rating */}
                            <div className="flex items-center gap-2 mb-1">
                              <p className="text-sm font-semibold truncate">{driver.name}</p>
                              <div className="flex items-center gap-0.5 flex-shrink-0">
                                <Star className="h-3 w-3 text-amber-500 fill-amber-500" />
                                <span className="text-xs font-semibold text-amber-600">{driver.rating}</span>
                              </div>
                              {isSelected && (
                                <Check className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                              )}
                            </div>

                            {/* Vehicle */}
                            <p className="text-xs text-muted-foreground mb-2">{driver.vehicle}</p>

                            {/* Badges */}
                            <div className="flex flex-wrap gap-1.5 mb-2">
                              {driver.badges.map((badge) => (
                                <Badge
                                  key={badge}
                                  variant="secondary"
                                  className={`text-[10px] px-2 py-0.5 ${
                                    badge === 'Verifie'
                                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                                      : badge === 'Climatise'
                                        ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                                        : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                                  }`}
                                >
                                  {badge === 'Climatise' ? <Snowflake className="h-3 w-3 mr-1" /> : null}
                                  {badge}
                                </Badge>
                              ))}
                            </div>

                            {/* Route + stats */}
                            <div className="grid grid-cols-2 gap-2">
                              <div className="bg-muted/50 rounded-lg p-2">
                                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Trajet quotidien</p>
                                <p className="text-[11px] font-medium flex items-center gap-1 mt-0.5">
                                  <Route className="h-3 w-3 text-emerald-500" />
                                  {driver.dailyRoute}
                                </p>
                              </div>
                              <div className="bg-muted/50 rounded-lg p-2">
                                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Statistiques</p>
                                <p className="text-[11px] font-medium mt-0.5">
                                  {driver.weeklyTrips} trajets/sem. - {driver.studentsCount} eleves
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Select button */}
                        <div className="mt-3 pt-3 border-t">
                          <Button
                            variant={isSelected ? 'default' : 'outline'}
                            size="sm"
                            className={`w-full rounded-xl text-xs ${
                              isSelected
                                ? 'bg-emerald-600 hover:bg-emerald-700'
                                : 'border-emerald-300 text-emerald-700 dark:border-emerald-700 dark:text-emerald-400'
                            }`}
                          >
                            {isSelected ? (
                              <>
                                <Check className="h-3.5 w-3.5 mr-1.5" />
                                Selectionne
                              </>
                            ) : (
                              <>
                                <Users className="h-3.5 w-3.5 mr-1.5" />
                                Choisir ce conducteur
                              </>
                            )}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                )
              })}
            </div>
          </motion.section>

          {/* ═══════════════════════════════════════════════════════════════
              5. ACTIVE SUBSCRIPTION CARD (visible always)
          ═══════════════════════════════════════════════════════════════ */}
          {activeSubscriptions.length > 0 && (
            <motion.section initial="hidden" animate="visible">
              <motion.h3 variants={fadeUp} custom={0} className="text-base font-semibold mb-3 flex items-center gap-2">
                <Award className="h-4 w-4 text-emerald-600" />
                Abonnements actifs
              </motion.h3>
              {activeSubscriptions.map((sub, idx) => (
                <motion.div key={sub.id} variants={fadeUp} custom={idx + 1}>
                  <Card className="border-emerald-200 bg-emerald-50/50 dark:bg-emerald-950/10 dark:border-emerald-800 overflow-hidden">
                    <div className="mova-gradient px-4 py-2.5 text-white">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold">Abonnement en cours</p>
                        <Badge className="bg-white/20 text-white border-0 text-[10px]">Actif</Badge>
                      </div>
                    </div>
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                          <Baby className="h-5 w-5 text-amber-600" />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-semibold">{sub.childName}</p>
                          <p className="text-xs text-muted-foreground">{sub.school}</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-2">
                        <div className="bg-white dark:bg-background rounded-lg p-2.5 text-center shadow-sm">
                          <Route className="h-4 w-4 text-emerald-500 mx-auto mb-1" />
                          <p className="text-[10px] text-muted-foreground">Trajet</p>
                          <p className="text-[11px] font-medium">{sub.route}</p>
                        </div>
                        <div className="bg-white dark:bg-background rounded-lg p-2.5 text-center shadow-sm">
                          <Calendar className="h-4 w-4 text-amber-500 mx-auto mb-1" />
                          <p className="text-[10px] text-muted-foreground">Planning</p>
                          <p className="text-[11px] font-medium">{sub.schedule}</p>
                        </div>
                        <div className="bg-white dark:bg-background rounded-lg p-2.5 text-center shadow-sm">
                          <Clock className="h-4 w-4 text-emerald-500 mx-auto mb-1" />
                          <p className="text-[10px] text-muted-foreground">Cout</p>
                          <p className="text-[11px] font-bold text-emerald-600">{formatGNF(sub.monthlyCost)}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        <span>Prochain renouvellement : {sub.renewalDate}</span>
                      </div>

                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 rounded-xl text-xs"
                          onClick={() => {
                            setActiveTab('booking')
                            setShowBookingForm(true)
                            toast.info('Modifiez les informations dans le formulaire de reservation.')
                          }}
                        >
                          Modifier
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 rounded-xl text-xs border-red-200 text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/20"
                          onClick={() => handleCancelSubscription(sub.id)}
                        >
                          Annuler
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </motion.section>
          )}

          {/* ═══════════════════════════════════════════════════════════════
              SAFETY INFO
          ═══════════════════════════════════════════════════════════════ */}
          <motion.div initial="hidden" animate="visible">
            <motion.div variants={fadeUp} custom={0}>
              <Card className="border-amber-200 bg-amber-50/30 dark:bg-amber-950/10">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <Shield className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
                    <div className="space-y-2">
                      <p className="text-sm font-semibold">Securite enfants MOVA</p>
                      <ul className="text-xs text-muted-foreground space-y-1">
                        <li className="flex items-center gap-2">
                          <Check className="h-3 w-3 text-emerald-500" />
                          Conducteurs verifies et formes au transport d&apos;enfants
                        </li>
                        <li className="flex items-center gap-2">
                          <Check className="h-3 w-3 text-emerald-500" />
                          Notification SMS a chaque arret (depart, arrivee ecole, retour)
                        </li>
                        <li className="flex items-center gap-2">
                          <Check className="h-3 w-3 text-emerald-500" />
                          Bus equipes de ceintures de securite
                        </li>
                        <li className="flex items-center gap-2">
                          <Check className="h-3 w-3 text-emerald-500" />
                          Suivi GPS en temps reel pour les parents
                        </li>
                        <li className="flex items-center gap-2">
                          <Check className="h-3 w-3 text-emerald-500" />
                          Assurance passagers incluse
                        </li>
                      </ul>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </motion.div>

          {/* Contact support */}
          <motion.div initial="hidden" animate="visible">
            <motion.div variants={fadeUp} custom={1}>
              <Card className="mova-card-hover cursor-pointer" onClick={() => window.open('tel:+224620000000')}>
                <CardContent className="flex items-center gap-3 p-4">
                  <div className="w-11 h-11 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center flex-shrink-0">
                    <Phone className="h-5 w-5 text-emerald-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold">Besoin d&apos;aide ?</p>
                    <p className="text-xs text-muted-foreground">Appelez notre support dedie : +224 620 00 00 00</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </CardContent>
              </Card>
            </motion.div>
          </motion.div>

        </div>
      </ScrollArea>
    </div>
  )
}
