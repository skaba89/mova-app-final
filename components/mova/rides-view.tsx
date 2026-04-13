'use client'

import { useState, useEffect, useCallback } from 'react'
import { useMovaStore } from '@/lib/store'
import { apiFetch } from '@/lib/api'
import {
  ArrowLeft,
  MapPin,
  Navigation as NavIcon,
  Car,
  Crown,
  Truck,
  Banknote,
  CreditCard,
  Zap,
  Clock,
  Loader2,
  CheckCircle2,
  XCircle,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

// --- Types ---

interface Zone {
  id: string
  name: string
}

interface FareEstimate {
  pickupZone: string
  dropoffZone: string
  vehicleType: string
  distanceKm: number
  durationMinutes: number
  estimatedFare: number
  currency: string
}

interface ActiveRide {
  id: string
  pickupAddress: string
  dropoffAddress: string
  pickupZone: string
  dropoffZone: string
  vehicleType: string
  status: string
  estimatedFare: number
  createdAt: string
  driver?: {
    name: string
    phone: string
    rating: number
    vehicle?: {
      plateNumber: string
      vehicleType: string
      color: string
      brand: string
      model: string
    }
  }
}

interface VehicleOption {
  id: string
  label: string
  description: string
  apiValue: string
  icon: LucideIcon
  multiplier: number
}

interface PaymentOption {
  id: string
  label: string
  apiValue: string
  icon: LucideIcon
  description: string
}

// --- Constantes ---

const VEHICLES: VehicleOption[] = [
  {
    id: 'auto',
    label: 'Standard',
    description: 'Voiture confortable',
    apiValue: 'auto',
    icon: Car,
    multiplier: 1,
  },
  {
    id: 'premium',
    label: 'Premium',
    description: 'Voiture haut de gamme',
    apiValue: 'premium',
    icon: Crown,
    multiplier: 1.5,
  },
  {
    id: 'van',
    label: 'Van',
    description: 'Vehicule spacieux',
    apiValue: 'van',
    icon: Truck,
    multiplier: 1.3,
  },
]

const PAYMENTS: PaymentOption[] = [
  { id: 'cash', label: 'Especes', apiValue: 'cash', icon: Banknote, description: 'Paiement en espece au chauffeur' },
  { id: 'wallet', label: 'Portefeuille', apiValue: 'wallet', icon: CreditCard, description: 'Payer avec votre solde MOVA' },
  { id: 'orange_money', label: 'Orange Money', apiValue: 'mobile_money', icon: Zap, description: 'Paiement mobile Orange Money' },
  { id: 'mtn_momo', label: 'MTN MoMo', apiValue: 'mobile_money', icon: Clock, description: 'Paiement mobile MTN MoMo' },
]

const ZONES_DEFAUT: Zone[] = [
  { id: 'kaloum', name: 'Kaloum' },
  { id: 'dixinn', name: 'Dixinn' },
  { id: 'matam', name: 'Matam' },
  { id: 'matoto', name: 'Matoto' },
  { id: 'ratoma', name: 'Ratoma' },
]

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  requested: { label: 'Recherche de chauffeur...', color: 'bg-yellow-100 text-yellow-800' },
  accepted: { label: 'Chauffeur accepte', color: 'bg-blue-100 text-blue-800' },
  in_progress: { label: 'Course en cours', color: 'bg-green-100 text-green-800' },
  completed: { label: 'Terminee', color: 'bg-gray-100 text-gray-800' },
  cancelled: { label: 'Annulee', color: 'bg-red-100 text-red-800' },
}

/**
 * Vue de reservation de courses.
 * Formulaire complet avec selection de zones, vehicule, paiement et estimation.
 */
export function RidesView() {
  const { setCurrentView } = useMovaStore()

  // Zones
  const [zones, setZones] = useState<Zone[]>(ZONES_DEFAUT)
  const [zonesLoaded, setZonesLoaded] = useState(false)

  // Formulaire
  const [pickupZone, setPickupZone] = useState('')
  const [dropoffZone, setDropoffZone] = useState('')
  const [pickupAddress, setPickupAddress] = useState('')
  const [dropoffAddress, setDropoffAddress] = useState('')
  const [vehicleType, setVehicleType] = useState('auto')
  const [paymentMethod, setPaymentMethod] = useState('cash')

  // Etat UI
  const [fare, setFare] = useState<FareEstimate | null>(null)
  const [isLoadingFare, setIsLoadingFare] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Courses actives
  const [activeRides, setActiveRides] = useState<ActiveRide[]>([])
  const [isLoadingRides, setIsLoadingRides] = useState(false)
  const [showActiveRides, setShowActiveRides] = useState(false)

  // Charger les zones depuis l'API
  useEffect(() => {
    async function fetchZones() {
      try {
        const res = await fetch('/api/mova/zones')
        const data = await res.json()
        if (data.success && data.data?.zones?.length > 0) {
          setZones(data.data.zones)
        }
      } catch {
        // Garder les zones par defaut
      } finally {
        setZonesLoaded(true)
      }
    }
    fetchZones()
  }, [])

  // Charger les courses actives
  const fetchActiveRides = useCallback(async () => {
    setIsLoadingRides(true)
    try {
      const res = await apiFetch('/api/mova/rides?status=requested,accepted,in_progress')
      if (res.ok) {
        const data = await res.json()
        if (data.success && data.data?.rides) {
          setActiveRides(data.data.rides)
        }
      }
    } catch {
      // Silencieux
    } finally {
      setIsLoadingRides(false)
    }
  }, [])

  useEffect(() => {
    fetchActiveRides()
  }, [fetchActiveRides])

  // Estimer le tarif
  const estimateFare = async () => {
    if (!pickupZone || !dropoffZone) {
      setError('Selectionnez les zones de depart et d\'arrivee')
      return
    }
    if (pickupZone === dropoffZone) {
      setError('Les zones de depart et d\'arrivee doivent etre differentes')
      return
    }

    setIsLoadingFare(true)
    setError('')
    setFare(null)

    try {
      const res = await fetch(
        `/api/mova/fare?pickupZone=${encodeURIComponent(pickupZone)}&dropoffZone=${encodeURIComponent(dropoffZone)}&vehicleType=${vehicleType}`
      )
      const data = await res.json()

      if (data.success) {
        setFare(data.data)
      } else {
        setError(data.error || 'Impossible d\'estimer le tarif')
      }
    } catch {
      setError('Erreur de connexion au serveur')
    } finally {
      setIsLoadingFare(false)
    }
  }

  // Creer la course
  const createRide = async () => {
    if (!pickupZone || !dropoffZone) {
      setError('Selectionnez les zones de depart et d\'arrivee')
      return
    }
    if (!pickupAddress.trim() || !dropoffAddress.trim()) {
      setError('Entrez les adresses de depart et d\'arrivee')
      return
    }

    setIsCreating(true)
    setError('')
    setSuccess('')

    try {
      const res = await apiFetch('/api/mova/rides', {
        method: 'POST',
        body: JSON.stringify({
          pickupAddress: pickupAddress.trim(),
          pickupLat: 0,
          pickupLng: 0,
          pickupZone,
          dropoffAddress: dropoffAddress.trim(),
          dropoffLat: 0,
          dropoffLng: 0,
          dropoffZone,
          vehicleType,
          paymentMethod,
        }),
      })

      const data = await res.json()

      if (data.success) {
        setSuccess('Course creee avec succes ! Recherche d\'un chauffeur en cours...')
        setFare(null)
        setPickupAddress('')
        setDropoffAddress('')
        fetchActiveRides()
      } else {
        setError(data.error || 'Impossible de creer la course')
      }
    } catch {
      setError('Erreur de connexion au serveur')
    } finally {
      setIsCreating(false)
    }
  }

  const selectedVehicle = VEHICLES.find((v) => v.id === vehicleType)

  return (
    <div className="min-h-screen bg-gray-50">
      {/* En-tete */}
      <header className="bg-[#1e40af] text-white px-4 py-4 flex items-center gap-3 sticky top-0 z-10">
        <button
          onClick={() => setCurrentView('hub')}
          className="p-2 -ml-2 rounded-xl hover:bg-white/10 active:scale-95 transition-transform"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-lg font-bold">Commander une course</h1>
      </header>

      <div className="px-4 py-5 space-y-5 pb-8">
        {/* Courses actives */}
        {activeRides.length > 0 && (
          <div>
            <button
              onClick={() => setShowActiveRides(!showActiveRides)}
              className="w-full flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-xl"
            >
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 bg-green-500 rounded-full animate-pulse" />
                <span className="text-sm font-semibold text-green-800">
                  {activeRides.length} course(s) active(s)
                </span>
              </div>
              <NavIcon className={`w-4 h-4 text-green-600 transition-transform ${showActiveRides ? 'rotate-90' : ''}`} />
            </button>

            {showActiveRides && (
              <div className="mt-2 space-y-2">
                {activeRides.map((ride) => {
                  const statusInfo = STATUS_LABELS[ride.status] || { label: ride.status, color: 'bg-gray-100 text-gray-800' }
                  return (
                    <div key={ride.id} className="p-3 bg-white rounded-xl border border-gray-100 shadow-sm">
                      <div className="flex items-center justify-between mb-2">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${statusInfo.color}`}>
                          {statusInfo.label}
                        </span>
                        {ride.estimatedFare > 0 && (
                          <span className="text-sm font-bold text-[#1e40af]">
                            {ride.estimatedFare.toLocaleString()} GNF
                          </span>
                        )}
                      </div>
                      <div className="space-y-1.5 text-sm">
                        <div className="flex items-start gap-2">
                          <div className="w-2 h-2 bg-green-500 rounded-full mt-1.5 shrink-0" />
                          <span className="text-gray-700">{ride.pickupAddress || ride.pickupZone}</span>
                        </div>
                        <div className="flex items-start gap-2">
                          <div className="w-2 h-2 bg-red-500 rounded-full mt-1.5 shrink-0" />
                          <span className="text-gray-700">{ride.dropoffAddress || ride.dropoffZone}</span>
                        </div>
                      </div>
                      {ride.driver && (
                        <div className="mt-2 pt-2 border-t border-gray-100 text-xs text-gray-500">
                          Chauffeur : {ride.driver.name}
                          {ride.driver.vehicle && (
                            <span> -- {ride.driver.vehicle.brand} {ride.driver.vehicle.model} ({ride.driver.vehicle.plateNumber})</span>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* Messages d'erreur / succes */}
        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
            <XCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}
        {success && (
          <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-xl text-green-700 text-sm">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            {success}
          </div>
        )}

        {/* Selection des zones */}
        <div className="space-y-3">
          {/* Zone de depart */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              <MapPin className="w-4 h-4 inline mr-1 text-green-600" />
              Zone de depart
            </label>
            <select
              value={pickupZone}
              onChange={(e) => setPickupZone(e.target.value)}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1e40af]/30 focus:border-[#1e40af] transition-colors"
            >
              <option value="">Choisir une zone</option>
              {zones.map((zone) => (
                <option key={zone.id} value={zone.name}>
                  {zone.name}
                </option>
              ))}
            </select>
          </div>

          {/* Adresse de depart */}
          <div>
            <input
              type="text"
              value={pickupAddress}
              onChange={(e) => setPickupAddress(e.target.value)}
              placeholder="Adresse precise (optionnel)"
              className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1e40af]/30 focus:border-[#1e40af] transition-colors"
            />
          </div>

          {/* Zone d'arrivee */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              <MapPin className="w-4 h-4 inline mr-1 text-red-600" />
              Zone d'arrivee
            </label>
            <select
              value={dropoffZone}
              onChange={(e) => setDropoffZone(e.target.value)}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1e40af]/30 focus:border-[#1e40af] transition-colors"
            >
              <option value="">Choisir une zone</option>
              {zones.map((zone) => (
                <option key={zone.id} value={zone.name}>
                  {zone.name}
                </option>
              ))}
            </select>
          </div>

          {/* Adresse d'arrivee */}
          <div>
            <input
              type="text"
              value={dropoffAddress}
              onChange={(e) => setDropoffAddress(e.target.value)}
              placeholder="Adresse precise (optionnel)"
              className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1e40af]/30 focus:border-[#1e40af] transition-colors"
            />
          </div>
        </div>

        {/* Type de vehicule */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Type de vehicule</label>
          <div className="grid grid-cols-3 gap-2">
            {VEHICLES.map((v) => {
              const Icon = v.icon
              const isSelected = vehicleType === v.id
              return (
                <button
                  key={v.id}
                  onClick={() => {
                    setVehicleType(v.id)
                    setFare(null)
                  }}
                  className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all active:scale-[0.97] ${
                    isSelected
                      ? 'border-[#1e40af] bg-blue-50'
                      : 'border-gray-200 bg-white'
                  }`}
                >
                  <Icon className={`w-6 h-6 ${isSelected ? 'text-[#1e40af]' : 'text-gray-400'}`} />
                  <span className={`text-xs font-semibold ${isSelected ? 'text-[#1e40af]' : 'text-gray-600'}`}>
                    {v.label}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Methode de paiement */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Mode de paiement</label>
          <div className="grid grid-cols-2 gap-2">
            {PAYMENTS.map((p) => {
              const Icon = p.icon
              const isSelected = paymentMethod === p.id
              return (
                <button
                  key={p.id}
                  onClick={() => setPaymentMethod(p.id)}
                  className={`flex items-center gap-2.5 p-3 rounded-xl border-2 transition-all text-left active:scale-[0.97] ${
                    isSelected
                      ? 'border-[#1e40af] bg-blue-50'
                      : 'border-gray-200 bg-white'
                  }`}
                >
                  <Icon className={`w-5 h-5 shrink-0 ${isSelected ? 'text-[#1e40af]' : 'text-gray-400'}`} />
                  <div className="min-w-0">
                    <span className={`text-xs font-semibold block truncate ${isSelected ? 'text-[#1e40af]' : 'text-gray-700'}`}>
                      {p.label}
                    </span>
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* Bouton estimer */}
        <button
          onClick={estimateFare}
          disabled={isLoadingFare || !pickupZone || !dropoffZone}
          className="w-full py-3 bg-gray-800 text-white font-semibold rounded-xl flex items-center justify-center gap-2 active:scale-[0.98] transition-transform disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoadingFare ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <NavIcon className="w-4 h-4" />
          )}
          Estimer le tarif
        </button>

        {/* Affichage de l'estimation */}
        {fare && (
          <div className="p-4 bg-white border-2 border-[#1e40af] rounded-2xl">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-gray-500">Estimation</span>
              {selectedVehicle && (
                <span className="text-xs font-medium text-[#1e40af] bg-blue-50 px-2 py-1 rounded-lg">
                  {selectedVehicle.label}
                </span>
              )}
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Distance</span>
                <span className="text-sm font-semibold">{fare.distanceKm.toFixed(1)} km</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Duree estimee</span>
                <span className="text-sm font-semibold">{fare.durationMinutes} min</span>
              </div>
              <div className="border-t border-gray-100 pt-2 flex items-center justify-between">
                <span className="text-base font-bold text-gray-800">Tarif estime</span>
                <span className="text-xl font-extrabold text-[#1e40af]">
                  {fare.estimatedFare.toLocaleString()} {fare.currency}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Bouton commander */}
        <button
          onClick={createRide}
          disabled={isCreating || !pickupZone || !dropoffZone}
          className="w-full py-4 bg-[#1e40af] text-white text-lg font-bold rounded-xl flex items-center justify-center gap-2 active:scale-[0.98] transition-transform disabled:opacity-60 disabled:cursor-not-allowed shadow-lg shadow-blue-900/20"
        >
          {isCreating ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Car className="w-5 h-5" />
          )}
          Commander
        </button>

        {/* Historique rapide */}
        <button
          onClick={fetchActiveRides}
          disabled={isLoadingRides}
          className="w-full py-2.5 text-center text-sm text-gray-500 font-medium"
        >
          {isLoadingRides ? 'Chargement...' : 'Voir mes courses'}
        </button>
      </div>
    </div>
  )
}
