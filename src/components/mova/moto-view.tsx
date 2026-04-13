'use client'

import { useState, useMemo, useEffect } from 'react'
import { useAppStore } from '@/lib/mova/store'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  ArrowLeft,
  Bike,
  MapPin,
  Navigation,
  Clock,
  Star,
  Phone,
  CheckCircle2,
  XCircle,
  CircleDot,
  History,
  Zap,
  Shield,
  Route,
  ChevronRight,
  Loader2,
  AlertCircle,
} from 'lucide-react'

const CONAKRY_LOCATIONS = [
  'Kaloum - Centre-ville',
  'Dixinn - Boulbinet',
  'Matam - Marche Madina',
  'Ratoma - Kipé',
  'Matoto - Hamdallaye',
  'Dixinn - Belle Vue',
  'Ratoma - Cosa',
  'Kaloum - Almamya',
  'Matoto - Cimenterie',
  'Ratoma - Lambanyi',
  'Matam - Niger', 
  'Dixinn - Camayenne',
]

function formatGNF(amount: number) {
  return amount.toLocaleString('fr-FR') + ' GNF'
}

export default function MotoView() {
  const { goBack, user } = useAppStore()
  const [pickup, setPickup] = useState('')
  const [dropoff, setDropoff] = useState('')
  const [bookingStep, setBookingStep] = useState<'form' | 'searching' | 'found' | 'riding'>('form')
  const [showHistory, setShowHistory] = useState(false)
  const [rideHistory, setRideHistory] = useState<Array<{
    id: string
    date: string
    pickup: string
    dropoff: string
    fare: number
    status: 'completed' | 'cancelled'
    driver: string
    driverPhone: string
    rating: number
    duration: string
  }>>([])
  const [activeRide, setActiveRide] = useState<{
    driver: string; phone: string; plate: string; rating: number; eta: string;
    pickup: string; dropoff: string; fare: number; status: string; startedAt: string;
  } | null>(null)
  const [apiRideId, setApiRideId] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isLoadingHistory, setIsLoadingHistory] = useState(true)
  const [historyError, setHistoryError] = useState<string | null>(null)

  // Fetch moto ride history from API on mount
  useEffect(() => {
    let cancelled = false
    const fetchHistory = async () => {
      setIsLoadingHistory(true)
      setHistoryError(null)
      try {
        const token = localStorage.getItem('mova_token')
        const userId = user?.id
        if (!userId || !token) {
          setRideHistory([])
          setIsLoadingHistory(false)
          return
        }
        const res = await fetch('/api/mova/moto', {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            'x-user-id': userId,
          },
        })
        if (!res.ok) throw new Error(`Erreur ${res.status}`)
        const data = await res.json()
        if (cancelled) return
        if (data.rides && Array.isArray(data.rides) && data.rides.length > 0) {
          const mapped = data.rides.map((r: Record<string, unknown>) => {
            const createdAt = typeof r.createdAt === 'string' ? r.createdAt : ''
            const durationMin = (r.duration as number) || 0
            return {
              id: r.id,
              date: createdAt.split('T')[0] || new Date().toISOString().split('T')[0],
              pickup: (r.pickupAddress as string) || '',
              dropoff: (r.dropoffAddress as string) || '',
              fare: (r.estimatedFare as number) || 0,
              status: (r.status as string) === 'completed' ? 'completed' as const : 'cancelled' as const,
              driver: (r.driver as Record<string, string>)?.name || (r.driverId as string) || 'Motard',
              driverPhone: (r.driver as Record<string, string>)?.phone || '',
              rating: ((r.passengerRating as number) || 0),
              duration: durationMin > 0 ? `${durationMin} min` : '--',
            }
          })
          setRideHistory(mapped)
        } else {
          setRideHistory([])
        }
      } catch {
        if (!cancelled) {
          setRideHistory([])
          setHistoryError('Impossible de charger l\'historique depuis le serveur')
        }
      } finally {
        if (!cancelled) setIsLoadingHistory(false)
      }
    }
    fetchHistory()
    return () => { cancelled = true }
  }, [user?.id])

  const estimatedPrice = useMemo(() => {
    if (!pickup || !dropoff) return null
    const pickupIdx = CONAKRY_LOCATIONS.indexOf(pickup)
    const dropoffIdx = CONAKRY_LOCATIONS.indexOf(dropoff)
    // Deterministic "distance" based on location index delta + base offset
    const baseFare = 2000
    const perKmRate = 150
    const distance = Math.abs(pickupIdx - dropoffIdx) + 3 // min 3km, grows with index gap
    return Math.round((baseFare + distance * perKmRate) / 100) * 100
  }, [pickup, dropoff])

  const handleBook = async () => {
    if (!pickup || !dropoff) {
      toast.error('Veuillez selectionner les lieux de depart et d\'arrivee')
      return
    }
    if (pickup === dropoff) {
      toast.error('Les lieux de depart et d\'arrivee doivent etre differents')
      return
    }
    setBookingStep('searching')
    setIsSubmitting(true)

    try {
      const token = localStorage.getItem('mova_token')
      const res = await fetch('/api/mova/moto', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
          ...(user?.id ? { 'x-user-id': user.id } : {}),
        },
        body: JSON.stringify({
          pickupAddress: pickup,
          dropoffAddress: dropoff,
          pickupZone: pickup.split(' - ')[0],
          dropoffZone: dropoff.split(' - ')[0],
          estimatedFare: estimatedPrice ?? 5000,
        }),
      })
      const data = await res.json()
      if (data.ride?.id) {
        setApiRideId(data.ride.id)
      }
    } catch {
      toast.error('Erreur de connexion. Mode hors ligne active.')
    } finally {
      setIsSubmitting(false)
    }

    setTimeout(() => {
      setActiveRide({
        driver: 'Ibrahima Sow',
        phone: '+224 661 00 01 00',
        plate: 'GN-1234-A',
        rating: 4.9,
        eta: '4 min',
        pickup,
        dropoff,
        fare: estimatedPrice ?? 5000,
        status: 'in_progress' as const,
        startedAt: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
      })
      setBookingStep('found')
    }, 2500)
  }

  const handleConfirm = async () => {
    setBookingStep('riding')
    toast.success('Course en cours ! Bon trajet.')

    if (apiRideId) {
      try {
        const token = localStorage.getItem('mova_token')
        const res = await fetch(`/api/mova/rides/${apiRideId}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ status: 'in_progress' }),
        })
        if (!res.ok) {
          toast.error('Impossible de mettre a jour le statut de la course')
        }
      } catch {
        toast.error('Erreur de connexion lors de la confirmation')
      }
    }
  }

  const handleFinish = async () => {
    // Mark ride as completed via API
    if (apiRideId) {
      try {
        const token = localStorage.getItem('mova_token')
        const res = await fetch(`/api/mova/rides/${apiRideId}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ status: 'completed' }),
        })
        if (!res.ok) {
          toast.error('Impossible de mettre a jour le statut de la course')
        }
      } catch {
        toast.error('Erreur de connexion lors de la finalisation')
      }
    }

    if (activeRide) {
      // Deterministic duration based on location index delta
      const pickupIdx = CONAKRY_LOCATIONS.indexOf(activeRide.pickup)
      const dropoffIdx = CONAKRY_LOCATIONS.indexOf(activeRide.dropoff)
      const dist = Math.abs(pickupIdx - dropoffIdx) + 3
      const duration = Math.min(5 + dist * 3, 45)

      const completedRide = {
        id: apiRideId || `moto-${Date.now()}`,
        date: new Date().toISOString().split('T')[0],
        pickup: activeRide.pickup,
        dropoff: activeRide.dropoff,
        fare: activeRide.fare,
        status: 'completed' as const,
        driver: activeRide.driver,
        driverPhone: activeRide.phone,
        rating: 0,
        duration: `${duration} min`,
      }
      setRideHistory((prev) => [completedRide, ...prev])
    }
    setActiveRide(null)
    setApiRideId(null)
    setBookingStep('form')
    setPickup('')
    setDropoff('')
    toast.success('Course terminee. Merci de voyager avec MOVA Moto !')
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-40 mova-glass border-b">
        <div className="flex items-center gap-3 px-4 py-3">
          <Button variant="ghost" size="icon" onClick={goBack} className="shrink-0">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-emerald-600 flex items-center justify-center">
              <Bike className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold">MOVA Moto</h1>
              <p className="text-xs text-muted-foreground">Moto-taxi rapide et securise</p>
            </div>
          </div>
        </div>
      </div>

      <ScrollArea className="h-[calc(100vh-64px)]">
        <div className="p-4 space-y-4 pb-24">
          {/* Active Ride */}
          {bookingStep === 'riding' && activeRide && (
            <Card className="border-emerald-200 bg-emerald-50/50 dark:bg-emerald-950/20">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" />
                    <CardTitle className="text-base">Course en cours</CardTitle>
                  </div>
                  <Badge variant="secondary" className="bg-emerald-100 text-emerald-700">
                    {activeRide.startedAt}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Driver Info */}
                <div className="flex items-center gap-3">
                  <Avatar className="h-12 w-12 border-2 border-emerald-500">
                    <AvatarFallback className="bg-emerald-100 text-emerald-700 font-bold">
                      {activeRide.driver.split(' ').map(n => n[0]).join('')}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{activeRide.driver}</span>
                      <div className="flex items-center gap-1 text-amber-500">
                        <Star className="h-3.5 w-3.5 fill-amber-400" />
                        <span className="text-xs font-medium">{activeRide.rating}</span>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground">{activeRide.plate}</p>
                  </div>
                  <Button size="icon" variant="outline" className="border-emerald-200" onClick={() => toast.success('Appel en cours...')}>
                    <Phone className="h-4 w-4 text-emerald-600" />
                  </Button>
                </div>

                <Separator />

                {/* Route */}
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="flex flex-col items-center mt-1">
                      <CircleDot className="h-3 w-3 text-emerald-500" />
                      <div className="w-0.5 h-6 bg-emerald-300" />
                      <MapPin className="h-3 w-3 text-red-500" />
                    </div>
                    <div className="flex-1 space-y-3">
                      <div>
                        <p className="text-xs text-muted-foreground">Depart</p>
                        <p className="text-sm font-medium">{activeRide.pickup}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Arrivee</p>
                        <p className="text-sm font-medium">{activeRide.dropoff}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* ETA */}
                <div className="bg-emerald-100 dark:bg-emerald-900/30 rounded-xl p-3 text-center">
                  <p className="text-xs text-emerald-600 dark:text-emerald-400">Arrivee estimee</p>
                  <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">
                    {activeRide.eta}
                  </p>
                </div>

                <Button className="w-full bg-emerald-600 hover:bg-emerald-700" onClick={handleFinish}>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Terminer la course
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Searching */}
          {bookingStep === 'searching' && (
            <Card className="border-amber-200 bg-amber-50/50 dark:bg-amber-950/20">
              <CardContent className="py-12 text-center space-y-4">
                <div className="w-16 h-16 mx-auto rounded-full bg-emerald-100 flex items-center justify-center">
                  <Bike className="h-8 w-8 text-emerald-600 animate-bounce" />
                </div>
                <div>
                  <h3 className="font-semibold">Recherche de motard...</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Nous trouvons le motard le plus proche de vous
                  </p>
                </div>
                <div className="flex justify-center gap-1">
                  {[0, 1, 2].map((i) => (
                    <div
                      key={i}
                      className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"
                      style={{ animationDelay: `${i * 0.3}s` }}
                    />
                  ))}
                </div>
                <Button variant="outline" size="sm" onClick={() => { setBookingStep('form'); setIsSubmitting(false); }}>
                  Annuler
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Driver Found */}
          {bookingStep === 'found' && activeRide && (
            <Card className="border-emerald-200 bg-emerald-50/50 dark:bg-emerald-950/20">
              <CardHeader className="pb-3">
                <CardTitle className="text-base text-center">Motard trouve !</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3">
                  <Avatar className="h-14 w-14 border-2 border-emerald-500">
                    <AvatarFallback className="bg-emerald-100 text-emerald-700 font-bold text-lg">
                      {activeRide.driver.split(' ').map(n => n[0]).join('')}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <span className="font-semibold text-lg">{activeRide.driver}</span>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="flex items-center gap-1 text-amber-500">
                        <Star className="h-3.5 w-3.5 fill-amber-400" />
                        <span className="text-xs font-medium">{activeRide.rating}</span>
                      </div>
                      <span className="text-xs text-muted-foreground">{activeRide.plate}</span>
                    </div>
                  </div>
                </div>

                <div className="bg-emerald-100 dark:bg-emerald-900/30 rounded-xl p-3 text-center">
                  <p className="text-xs text-emerald-600 dark:text-emerald-400">Arrivee dans</p>
                  <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">
                    {activeRide.eta}
                  </p>
                </div>

                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={() => setBookingStep('form')}>
                    <XCircle className="h-4 w-4 mr-2" />
                    Annuler
                  </Button>
                  <Button className="flex-1 bg-emerald-600 hover:bg-emerald-700" onClick={handleConfirm}>
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Confirmer
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Booking Form */}
          {bookingStep === 'form' && (
            <>
              {/* Quick Stats */}
              <div className="grid grid-cols-3 gap-3">
                <Card className="mova-card-hover">
                  <CardContent className="p-3 text-center">
                    <Zap className="h-5 w-5 text-amber-500 mx-auto mb-1" />
                    <p className="text-xs text-muted-foreground">Rapide</p>
                    <p className="text-sm font-bold">3-8 min</p>
                  </CardContent>
                </Card>
                <Card className="mova-card-hover">
                  <CardContent className="p-3 text-center">
                    <Shield className="h-5 w-5 text-emerald-500 mx-auto mb-1" />
                    <p className="text-xs text-muted-foreground">Assure</p>
                    <p className="text-sm font-bold">100%</p>
                  </CardContent>
                </Card>
                <Card className="mova-card-hover">
                  <CardContent className="p-3 text-center">
                    <Route className="h-5 w-5 text-emerald-500 mx-auto mb-1" />
                    <p className="text-xs text-muted-foreground">Toute ville</p>
                    <p className="text-sm font-bold">Conakry</p>
                  </CardContent>
                </Card>
              </div>

              {/* Pickup / Dropoff */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Reserver un moto-taxi</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium flex items-center gap-2">
                      <CircleDot className="h-4 w-4 text-emerald-500" />
                      Point de depart
                    </label>
                    <Select value={pickup} onValueChange={setPickup}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Choisir le depart" />
                      </SelectTrigger>
                      <SelectContent>
                        {CONAKRY_LOCATIONS.map((loc) => (
                          <SelectItem key={loc} value={loc}>{loc}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-red-500" />
                      Destination
                    </label>
                    <Select value={dropoff} onValueChange={setDropoff}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Choisir la destination" />
                      </SelectTrigger>
                      <SelectContent>
                        {CONAKRY_LOCATIONS.map((loc) => (
                          <SelectItem key={loc} value={loc}>{loc}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {estimatedPrice && (
                    <div className="bg-emerald-50 dark:bg-emerald-950/30 rounded-xl p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Navigation className="h-4 w-4 text-emerald-600" />
                          <span className="text-sm font-medium">Tarif estime</span>
                        </div>
                        <span className="text-xl font-bold text-emerald-700 dark:text-emerald-400">
                          {formatGNF(estimatedPrice)}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 ml-6">
                        Le tarif peut varier selon la circulation
                      </p>
                    </div>
                  )}

                  <Button
                    className="w-full bg-emerald-600 hover:bg-emerald-700 h-12 text-base font-semibold mova-gradient"
                    onClick={handleBook}
                    disabled={!pickup || !dropoff || isSubmitting}
                  >
                    {isSubmitting ? <Loader2 className="h-5 w-5 mr-2 animate-spin" /> : <Bike className="h-5 w-5 mr-2" />}
                    Commander un moto-taxi
                  </Button>
                </CardContent>
              </Card>

              {/* Safety Info */}
              <Card className="border-amber-200 bg-amber-50/30 dark:bg-amber-950/10">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <Shield className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
                    <div className="space-y-1">
                      <p className="text-sm font-semibold">Securite MOVA Moto</p>
                      <p className="text-xs text-muted-foreground">
                        Tous nos motards sont verifies, assures et equipes de casques. 
                        Partagez votre trajet en direct avec vos proches.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          )}

          {/* Ride History Toggle */}
          <Button
            variant="outline"
            className="w-full justify-between"
            onClick={() => setShowHistory(!showHistory)}
            aria-label={showHistory ? "Masquer l'historique" : "Afficher l'historique"}
          >
            <div className="flex items-center gap-2">
              <History className="h-4 w-4" />
              <span>Historique des courses</span>
              <Badge variant="secondary">{isLoadingHistory ? '...' : rideHistory.length}</Badge>
            </div>
            <ChevronRight className={`h-4 w-4 transition-transform ${showHistory ? 'rotate-90' : ''}`} />
          </Button>

          {/* History Loading Skeleton */}
          {showHistory && isLoadingHistory && (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Card key={i}>
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-5 w-16" />
                    </div>
                    <Skeleton className="h-4 w-48" />
                    <Separator />
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Skeleton className="h-6 w-6 rounded-full" />
                        <Skeleton className="h-3 w-28" />
                      </div>
                      <Skeleton className="h-3 w-16" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* History Error Banner */}
          {showHistory && historyError && !isLoadingHistory && (
            <Card className="border-amber-200 bg-amber-50/50 dark:bg-amber-950/20">
              <CardContent className="p-3 flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                <p className="text-sm text-amber-700 dark:text-amber-400">{historyError}</p>
              </CardContent>
            </Card>
          )}

          {/* Ride History List */}
          {showHistory && !isLoadingHistory && rideHistory.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                <History className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="font-semibold text-base mb-1">Aucune course moto</h3>
              <p className="text-sm text-muted-foreground max-w-xs">Vos courses moto-terminees apparaitront ici.</p>
            </div>
          )}
          {showHistory && !isLoadingHistory && rideHistory.length > 0 && (
            <div className="space-y-3">
              {rideHistory.map((ride) => (
                <Card key={ride.id} className="mova-card-hover">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">{ride.date}</span>
                          <Badge
                            variant={ride.status === 'completed' ? 'default' : 'destructive'}
                            className={
                              ride.status === 'completed'
                                ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100'
                                : ''
                            }
                          >
                            {ride.status === 'completed' ? 'Terminee' : 'Annulee'}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <span className="font-medium">{ride.pickup.split(' - ')[0]}</span>
                          <Navigation className="h-3 w-3 text-muted-foreground" />
                          <span className="font-medium">{ride.dropoff.split(' - ')[0]}</span>
                        </div>
                      </div>
                      <span className="font-bold text-emerald-600">{formatGNF(ride.fare)}</span>
                    </div>
                    <Separator className="mb-3" />
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Avatar className="h-6 w-6">
                          <AvatarFallback className="text-[10px] bg-emerald-100 text-emerald-700">
                            {ride.driver.split(' ').map(n => n[0]).join('')}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-xs text-muted-foreground">{ride.driver}</span>
                        {ride.rating > 0 && (
                          <div className="flex items-center gap-0.5 text-amber-500">
                            <Star className="h-3 w-3 fill-amber-400" />
                            <span className="text-xs">{ride.rating}</span>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {ride.duration}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}
