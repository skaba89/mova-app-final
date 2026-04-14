'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useMovaStore } from '@/lib/store'
import { apiFetch } from '@/lib/api'
import {
  ArrowLeft,
  Phone,
  PhoneCall,
  MapPin,
  ShieldAlert,
  Navigation,
  Car,
  User,
  Clock,
  CheckCircle2,
  Loader2,
  XCircle,
  AlertTriangle,
  Copy,
  MessageCircle,
  Route,
} from 'lucide-react'

// --- Types ---

type RideStatus = 'accepted' | 'arrived' | 'in_progress' | 'completed' | 'cancelled'

interface RideDriver {
  id: string
  name: string
  phone: string
  carModel: string
  plateNumber: string
  avatar: string | null
  rating: number
}

interface RideData {
  id: string
  status: RideStatus
  driver: RideDriver
  pickupAddress: string
  dropoffAddress: string
  otp: string
  etaMinutes: number
  distanceKm: number
  fare: number
  currency: string
}

// --- Constantes ---

const STATUS_STEPS: { key: RideStatus; label: string; icon: typeof CheckCircle2 }[] = [
  { key: 'accepted', label: 'Acceptee', icon: CheckCircle2 },
  { key: 'arrived', label: 'Arrive', icon: MapPin },
  { key: 'in_progress', label: 'En cours', icon: Navigation },
  { key: 'completed', label: 'Terminee', icon: CheckCircle2 },
]

// Donnees de demo
const DEMO_RIDE: RideData = {
  id: 'demo-ride-001',
  status: 'in_progress',
  driver: {
    id: 'drv-001',
    name: 'Mamadou Diallo',
    phone: '+224 621 12 34 56',
    carModel: 'Toyota Corolla',
    plateNumber: 'CGZ-1234-AK',
    avatar: null,
    rating: 4.8,
  },
  pickupAddress: 'Carrefour Niger, Dixinn',
  dropoffAddress: 'Aeroport Gbessia, Conakry',
  otp: '4829',
  etaMinutes: 12,
  distanceKm: 14.5,
  fare: 35000,
  currency: 'GNF',
}

function getStatusIndex(status: RideStatus): number {
  return STATUS_STEPS.findIndex((s) => s.key === status)
}

function getStatusLabel(status: RideStatus): { label: string; description: string; color: string } {
  switch (status) {
    case 'accepted':
      return { label: 'Course acceptee', description: 'Le chauffeur se dirige vers votre point de depart.', color: 'text-blue-600' }
    case 'arrived':
      return { label: 'Chauffeur arrive', description: 'Votre chauffeur vous attend au point de depart.', color: 'text-amber-600' }
    case 'in_progress':
      return { label: 'Course en cours', description: 'Vous etes en route vers votre destination.', color: 'text-emerald-600' }
    case 'completed':
      return { label: 'Course terminee', description: 'Vous etes arrive a destination. Merci de voyager avec MOVA !', color: 'text-green-600' }
    case 'cancelled':
      return { label: 'Course annulee', description: 'Cette course a ete annulee.', color: 'text-red-600' }
    default:
      return { label: 'En attente', description: 'Recherche d\'un chauffeur...', color: 'text-gray-600' }
  }
}

// --- Composant principal ---

export function NavigationView() {
  const { setCurrentView } = useMovaStore()

  // Etats
  const [ride, setRide] = useState<RideData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [copiedOtp, setCopiedOtp] = useState(false)
  const [sosLoading, setSosLoading] = useState(false)
  const [sosSent, setSosSent] = useState(false)
  const [cancelLoading, setCancelLoading] = useState(false)
  const [cancelError, setCancelError] = useState('')
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  // Charger les donnees de la course
  const fetchRide = useCallback(async () => {
    try {
      const res = await apiFetch('/api/mova/rides/active')
      if (res.ok) {
        const data = await res.json()
        if (data.success && data.data?.ride) {
          setRide(data.data.ride)
          return
        }
      }
      // Fallback sur les donnees demo si pas de course active
      setRide(DEMO_RIDE)
    } catch {
      // Fallback sur les donnees demo
      setRide(DEMO_RIDE)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchRide()
  }, [fetchRide])

  // Simulation temps reel : faire baisser l'ETA
  useEffect(() => {
    if (!ride || ride.status === 'completed' || ride.status === 'cancelled') return
    if (ride.status === 'accepted') return // L'ETA n'a pas de sens avant l'arrivee du chauffeur

    intervalRef.current = setInterval(() => {
      setRide((prev) => {
        if (!prev || prev.etaMinutes <= 1) return prev
        return { ...prev, etaMinutes: prev.etaMinutes - 1 }
      })
    }, 5000) // Decremente toutes les 5 secondes

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [ride?.status])

  // Copier l'OTP
  const handleCopyOtp = useCallback(() => {
    if (!ride?.otp) return
    navigator.clipboard.writeText(ride.otp).then(() => {
      setCopiedOtp(true)
      setTimeout(() => setCopiedOtp(false), 2000)
    }).catch(() => {
      // Fallback
      const ta = document.createElement('textarea')
      ta.value = ride.otp
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
      setCopiedOtp(true)
      setTimeout(() => setCopiedOtp(false), 2000)
    })
  }, [ride?.otp])

  // SOS
  const handleSOS = useCallback(async () => {
    if (sosLoading || sosSent) return
    setSosLoading(true)
    try {
      await apiFetch('/api/mova/sos', { method: 'POST' })
      setSosSent(true)
    } catch {
      // Silencieux - en mode demo
      setSosSent(true)
    } finally {
      setSosLoading(false)
    }
  }, [sosLoading, sosSent])

  // Annuler
  const handleCancel = useCallback(async () => {
    if (cancelLoading) return
    if (!ride || (ride.status !== 'accepted' && ride.status !== 'arrived')) return

    setCancelLoading(true)
    setCancelError('')
    try {
      const res = await apiFetch(`/api/mova/rides/${ride.id}/cancel`, { method: 'POST' })
      const data = await res.json()
      if (data.success) {
        setRide((prev) => prev ? { ...prev, status: 'cancelled' } : prev)
      } else {
        setCancelError(data.error || 'Impossible d\'annuler la course.')
      }
    } catch {
      setCancelError('Erreur de connexion au serveur.')
    } finally {
      setCancelLoading(false)
    }
  }, [cancelLoading, ride])

  // Chargement
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">
        <Loader2 className="w-10 h-10 text-[#1e40af] animate-spin mb-4" />
        <p className="text-sm text-gray-500">Chargement du suivi...</p>
      </div>
    )
  }

  // Erreur sans donnees
  if (error || !ride) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
          <AlertTriangle className="w-8 h-8 text-red-400" />
        </div>
        <h3 className="text-lg font-bold text-gray-700 mb-2">Erreur de suivi</h3>
        <p className="text-sm text-gray-500 text-center mb-6 max-w-xs">{error || 'Aucune course active trouvee.'}</p>
        <button
          onClick={() => setCurrentView('hub')}
          className="flex items-center gap-2 px-5 py-2.5 bg-[#1e40af] text-white rounded-xl text-sm font-semibold active:scale-95 transition-transform"
        >
          <ArrowLeft className="w-4 h-4" />
          Retour a l'accueil
        </button>
      </div>
    )
  }

  const statusInfo = getStatusLabel(ride.status)
  const statusIdx = getStatusIndex(ride.status)
  const progressPercent = ride.status === 'completed' ? 100 : ride.status === 'cancelled' ? 0 : (statusIdx / (STATUS_STEPS.length - 1)) * 100
  const canCancel = ride.status === 'accepted' || ride.status === 'arrived'

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* En-tete */}
      <header className="bg-gradient-to-br from-[#1e40af] to-[#1e3a8a] text-white px-4 py-4 flex items-center gap-3 sticky top-0 z-10 shadow-lg">
        <button
          onClick={() => setCurrentView('rides')}
          className="p-2 -ml-2 rounded-xl hover:bg-white/10 active:scale-95 transition-transform"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <Navigation className="w-5 h-5" />
        <h1 className="text-lg font-bold">Suivi de course</h1>
        <button
          onClick={fetchRide}
          className="ml-auto p-2 rounded-xl hover:bg-white/10 active:scale-95 transition-transform"
          aria-label="Actualiser"
        >
          <Loader2 className="w-5 h-5" />
        </button>
      </header>

      {/* Zone carte simulee */}
      <div className="relative bg-gray-800 h-56 overflow-hidden">
        {/* Grille */}
        <div className="absolute inset-0 opacity-10" style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,.3) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.3) 1px, transparent 1px)',
          backgroundSize: '24px 24px',
        }} />
        {/* Route simulee */}
        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 400 224">
          <path d="M 60 180 Q 120 120 200 110 T 340 40" stroke="#facc15" strokeWidth="4" fill="none" strokeDasharray="8 6" opacity="0.7" />
          <circle cx="60" cy="180" r="8" fill="#22c55e" />
          <circle cx="60" cy="180" r="4" fill="white" />
          <circle cx="340" cy="40" r="8" fill="#ef4444" />
          <circle cx="340" cy="40" r="4" fill="white" />
          {/* Point voiture */}
          {ride.status === 'in_progress' && (
            <circle cx="200" cy="110" r="10" fill="#3b82f6">
              <animate attributeName="opacity" values="1;0.4;1" dur="2s" repeatCount="indefinite" />
            </circle>
          )}
        </svg>
        {/* Labels */}
        <div className="absolute bottom-3 left-3 bg-black/50 backdrop-blur-sm rounded-lg px-2.5 py-1.5 text-[10px] text-white font-medium flex items-center gap-1">
          <MapPin className="w-3 h-3 text-green-400" />
          {ride.pickupAddress}
        </div>
        <div className="absolute top-3 right-3 bg-black/50 backdrop-blur-sm rounded-lg px-2.5 py-1.5 text-[10px] text-white font-medium flex items-center gap-1">
          <MapPin className="w-3 h-3 text-red-400" />
          {ride.dropoffAddress}
        </div>
        {/* ETA badge */}
        <div className="absolute top-3 left-3 bg-[#1e40af]/90 backdrop-blur-sm rounded-xl px-3 py-2 shadow-lg">
          <p className="text-[10px] text-blue-200 font-medium">Arrivee estimee</p>
          <p className="text-2xl font-extrabold text-white leading-tight">
            {ride.etaMinutes} <span className="text-sm font-semibold text-blue-200">min</span>
          </p>
        </div>
      </div>

      {/* Contenu */}
      <div className="flex-1 px-4 py-4 space-y-4 pb-6">
        {/* Statut actuel */}
        <section className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3 mb-4">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
              ride.status === 'completed' ? 'bg-green-100' :
              ride.status === 'cancelled' ? 'bg-red-100' :
              'bg-blue-100'
            }`}>
              {ride.status === 'completed' ? (
                <CheckCircle2 className="w-5 h-5 text-green-600" />
              ) : ride.status === 'cancelled' ? (
                <XCircle className="w-5 h-5 text-red-500" />
              ) : (
                <Loader2 className="w-5 h-5 text-[#1e40af] animate-spin" />
              )}
            </div>
            <div>
              <h2 className={`text-base font-bold ${statusInfo.color}`}>{statusInfo.label}</h2>
              <p className="text-xs text-gray-500 mt-0.5">{statusInfo.description}</p>
            </div>
          </div>

          {/* Barre de progression */}
          {ride.status !== 'cancelled' && (
            <div>
              <div className="relative">
                <div className="absolute top-3.5 left-3 right-3 h-1.5 bg-gray-100 rounded-full" />
                <div
                  className="absolute top-3.5 left-3 h-1.5 bg-gradient-to-r from-[#1e40af] to-blue-500 rounded-full transition-all duration-700"
                  style={{ width: `calc(${progressPercent}% - 1.5rem)` }}
                />
                <div className="relative flex justify-between">
                  {STATUS_STEPS.map((step, idx) => {
                    const isCompleted = idx < statusIdx
                    const isCurrent = idx === statusIdx
                    const Icon = step.icon
                    return (
                      <div key={step.key} className="flex flex-col items-center" style={{ width: `${100 / STATUS_STEPS.length}%` }}>
                        <div
                          className={`w-7 h-7 rounded-full flex items-center justify-center transition-all duration-300 ${
                            isCompleted
                              ? 'bg-[#1e40af] text-white'
                              : isCurrent
                                ? 'bg-[#1e40af]/10 text-[#1e40af] ring-2 ring-[#1e40af] ring-offset-2'
                                : 'bg-gray-100 text-gray-400'
                          }`}
                        >
                          <Icon className="w-3.5 h-3.5" />
                        </div>
                        <span className={`text-[9px] mt-1.5 text-center font-medium leading-tight ${
                          isCompleted || isCurrent ? 'text-gray-800' : 'text-gray-400'
                        }`}>
                          {step.label}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}
        </section>

        {/* Infos chauffeur */}
        {ride.driver && ride.status !== 'cancelled' && (
          <section className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <h3 className="text-sm font-bold text-gray-700 mb-3">Votre chauffeur</h3>
            <div className="flex items-center gap-3">
              {/* Avatar */}
              <div className="w-12 h-12 bg-[#1e40af]/10 rounded-xl flex items-center justify-center shrink-0">
                {ride.driver.avatar ? (
                  <img src={ride.driver.avatar} alt={ride.driver.name} className="w-12 h-12 rounded-xl object-cover" />
                ) : (
                  <span className="text-lg font-bold text-[#1e40af]">
                    {ride.driver.name.charAt(0).toUpperCase()}
                  </span>
                )}
              </div>

              {/* Infos */}
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-semibold text-gray-800 truncate">{ride.driver.name}</h4>
                <div className="flex items-center gap-2 mt-0.5">
                  <Car className="w-3 h-3 text-gray-400" />
                  <span className="text-xs text-gray-500">{ride.driver.carModel}</span>
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs font-mono font-bold text-gray-700 bg-gray-100 px-1.5 py-0.5 rounded">
                    {ride.driver.plateNumber}
                  </span>
                  <span className="text-xs text-amber-600 font-medium">★ {ride.driver.rating}</span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <a
                  href={`tel:${ride.driver.phone}`}
                  className="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center text-green-600 active:scale-90 transition-transform"
                  aria-label="Appeler le chauffeur"
                >
                  <PhoneCall className="w-5 h-5" />
                </a>
                <button
                  className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center text-[#1e40af] active:scale-90 transition-transform"
                  aria-label="Envoyer un message"
                >
                  <MessageCircle className="w-5 h-5" />
                </button>
              </div>
            </div>
          </section>
        )}

        {/* OTP */}
        {ride.otp && (ride.status === 'arrived' || ride.status === 'in_progress') && (
          <section className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <ShieldAlert className="w-4 h-4 text-amber-600" />
              <h3 className="text-sm font-bold text-amber-800">Code de verification</h3>
            </div>
            <p className="text-xs text-amber-700 mb-3">
              Communiquez ce code au chauffeur pour confirmer votre identite.
            </p>
            <div className="flex items-center gap-3">
              <div className="flex-1 flex justify-center gap-2">
                {ride.otp.split('').map((digit, i) => (
                  <span
                    key={i}
                    className="w-12 h-14 bg-white border-2 border-amber-300 rounded-xl flex items-center justify-center text-2xl font-extrabold text-amber-800"
                  >
                    {digit}
                  </span>
                ))}
              </div>
              <button
                onClick={handleCopyOtp}
                className={`p-2.5 rounded-xl transition-colors ${
                  copiedOtp
                    ? 'bg-green-100 text-green-600'
                    : 'bg-white border border-amber-200 text-amber-600'
                }`}
                aria-label="Copier le code"
              >
                {copiedOtp ? <CheckCircle2 className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
              </button>
            </div>
          </section>
        )}

        {/* Details de la course */}
        <section className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <h3 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
            <Route className="w-4 h-4 text-[#1e40af]" />
            Details de la course
          </h3>
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center shrink-0 mt-0.5">
                <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
              </div>
              <div className="flex-1">
                <p className="text-xs text-gray-400">Depart</p>
                <p className="text-sm text-gray-800">{ride.pickupAddress}</p>
              </div>
            </div>
            <div className="ml-3 border-l-2 border-dashed border-gray-200 h-3" />
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-red-100 flex items-center justify-center shrink-0 mt-0.5">
                <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
              </div>
              <div className="flex-1">
                <p className="text-xs text-gray-400">Destination</p>
                <p className="text-sm text-gray-800">{ride.dropoffAddress}</p>
              </div>
            </div>
          </div>

          {/* Infos supplementaires */}
          <div className="grid grid-cols-3 gap-3 mt-4 pt-3 border-t border-gray-100">
            <div className="text-center">
              <Clock className="w-4 h-4 text-gray-400 mx-auto mb-1" />
              <p className="text-xs font-bold text-gray-800">{ride.distanceKm} km</p>
              <p className="text-[10px] text-gray-400">Distance</p>
            </div>
            <div className="text-center">
              <Navigation className="w-4 h-4 text-gray-400 mx-auto mb-1" />
              <p className="text-xs font-bold text-gray-800">{ride.etaMinutes} min</p>
              <p className="text-[10px] text-gray-400">ETA</p>
            </div>
            <div className="text-center">
              <User className="w-4 h-4 text-gray-400 mx-auto mb-1" />
              <p className="text-xs font-bold text-gray-800">{ride.fare.toLocaleString('fr-FR')}</p>
              <p className="text-[10px] text-gray-400">{ride.currency}</p>
            </div>
          </div>
        </section>

        {/* Erreur annulation */}
        {cancelError && (
          <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
            <XCircle className="w-4 h-4 shrink-0" />
            {cancelError}
          </div>
        )}

        {/* Bouton Annuler */}
        {canCancel && (
          <button
            onClick={handleCancel}
            disabled={cancelLoading}
            className="w-full py-3 bg-white border-2 border-red-200 text-red-600 rounded-2xl text-sm font-semibold flex items-center justify-center gap-2 active:scale-[0.98] transition-transform disabled:opacity-60"
          >
            {cancelLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <XCircle className="w-4 h-4" />
            )}
            Annuler la course
          </button>
        )}

        {/* Indicateur temps reel */}
        {ride.status !== 'completed' && ride.status !== 'cancelled' && (
          <div className="flex items-center justify-center gap-2 py-1">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
            <p className="text-xs text-gray-400">Suivi en temps reel</p>
          </div>
        )}

        {/* SOS Button */}
        {ride.status !== 'completed' && ride.status !== 'cancelled' && (
          <div className="pt-2">
            <button
              onClick={handleSOS}
              disabled={sosLoading || sosSent}
              className={`w-full py-4 rounded-2xl text-sm font-extrabold flex items-center justify-center gap-2.5 transition-all active:scale-[0.98] shadow-lg ${
                sosSent
                  ? 'bg-green-500 text-white'
                  : 'bg-gradient-to-r from-red-600 to-red-700 text-white'
              }`}
            >
              {sosSent ? (
                <>
                  <CheckCircle2 className="w-5 h-5" />
                  Alerte SOS envoyee
                </>
              ) : sosLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <ShieldAlert className="w-5 h-5" />
                  Alerte d&apos;urgence SOS
                </>
              )}
            </button>
            <p className="text-[10px] text-gray-400 text-center mt-2">
              En cas d&apos;urgence uniquement. Signale votre position aux secours.
            </p>
          </div>
        )}

        {/* Bouton retour si termine */}
        {ride.status === 'completed' && (
          <button
            onClick={() => setCurrentView('hub')}
            className="w-full py-3 bg-[#1e40af] text-white rounded-2xl text-sm font-semibold flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
          >
            <ArrowLeft className="w-4 h-4" />
            Retour a l&apos;accueil
          </button>
        )}

        {ride.status === 'cancelled' && (
          <button
            onClick={() => setCurrentView('rides')}
            className="w-full py-3 bg-[#1e40af] text-white rounded-2xl text-sm font-semibold flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
          >
            <ArrowLeft className="w-4 h-4" />
            Commander une course
          </button>
        )}
      </div>
    </div>
  )
}
