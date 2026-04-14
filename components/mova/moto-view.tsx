'use client'

import { useState, useEffect, useCallback } from 'react'
import { useMovaStore } from '@/lib/store'
import { apiFetch } from '@/lib/api'
import {
  ArrowLeft,
  MapPin,
  Navigation as NavIcon,
  Bike,
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

interface ActiveRide {
  id: string
  pickupAddress: string
  dropoffAddress: string
  pickupZone: string
  dropoffZone: string
  status: string
  estimatedFare: number
  createdAt: string
}

// --- Constantes ---

const ZONES_DEFAUT: Zone[] = [
  { id: 'kaloum', name: 'Kaloum' },
  { id: 'dixinn', name: 'Dixinn' },
  { id: 'matam', name: 'Matam' },
  { id: 'matoto', name: 'Matoto' },
  { id: 'ratoma', name: 'Ratoma' },
]

const PAYMENTS = [
  { id: 'cash', label: 'Especes', icon: Banknote, description: 'Paiement en espece' },
  { id: 'wallet', label: 'Portefeuille', icon: CreditCard, description: 'Solde MOVA' },
  { id: 'orange_money', label: 'Orange Money', icon: Zap, description: 'Mobile Money' },
]

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  requested: { label: 'Recherche...', color: 'bg-yellow-100 text-yellow-800' },
  accepted: { label: 'Accepte', color: 'bg-blue-100 text-blue-800' },
  in_progress: { label: 'En course', color: 'bg-green-100 text-green-800' },
  completed: { label: 'Terminee', color: 'bg-gray-100 text-gray-800' },
  cancelled: { label: 'Annulee', color: 'bg-red-100 text-red-800' },
}

/**
 * Vue Moto-taxi - reservation rapide de moto-taxis.
 * Variante de RidesView pour les courses en moto.
 */
export function MotoView() {
  const { setCurrentView } = useMovaStore()

  const [zones] = useState<Zone[]>(ZONES_DEFAUT)
  const [pickupZone, setPickupZone] = useState('')
  const [dropoffZone, setDropoffZone] = useState('')
  const [pickupAddress, setPickupAddress] = useState('')
  const [dropoffAddress, setDropoffAddress] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('cash')

  const [fare, setFare] = useState<{ estimatedFare: number; currency: string; durationMinutes: number; distanceKm: number } | null>(null)
  const [isLoadingFare, setIsLoadingFare] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [activeRides, setActiveRides] = useState<ActiveRide[]>([])
  const [showActiveRides, setShowActiveRides] = useState(false)

  const fetchActiveRides = useCallback(async () => {
    try {
      const res = await apiFetch('/api/mova/moto?status=requested,accepted,in_progress')
      if (res.ok) {
        const data = await res.json()
        if (data.success && data.data?.rides) {
          setActiveRides(data.data.rides)
        }
      }
    } catch {
      // Silencieux
    }
  }, [])

  useEffect(() => {
    fetchActiveRides()
  }, [fetchActiveRides])

  const estimateFare = async () => {
    if (!pickupZone || !dropoffZone || pickupZone === dropoffZone) {
      setError('Selectionnez deux zones differentes')
      return
    }
    setIsLoadingFare(true)
    setError('')
    setFare(null)
    try {
      const res = await fetch(
        `/api/mova/fare?pickupZone=${encodeURIComponent(pickupZone)}&dropoffZone=${encodeURIComponent(dropoffZone)}&vehicleType=moto`
      )
      const data = await res.json()
      if (data.success) setFare(data.data)
      else setError(data.error || 'Impossible d\'estimer')
    } catch {
      setError('Erreur de connexion')
    } finally {
      setIsLoadingFare(false)
    }
  }

  const createMoto = async () => {
    if (!pickupZone || !dropoffZone) {
      setError('Selectionnez les zones')
      return
    }
    setIsCreating(true)
    setError('')
    setSuccess('')
    try {
      const res = await apiFetch('/api/mova/moto', {
        method: 'POST',
        body: JSON.stringify({
          pickupAddress: pickupAddress.trim() || pickupZone,
          pickupLat: 0,
          pickupLng: 0,
          pickupZone,
          dropoffAddress: dropoffAddress.trim() || dropoffZone,
          dropoffLat: 0,
          dropoffLng: 0,
          dropoffZone,
          paymentMethod,
        }),
      })
      const data = await res.json()
      if (data.success) {
        setSuccess('Moto commande ! Recherche d\'un pilote en cours...')
        setFare(null)
        setPickupAddress('')
        setDropoffAddress('')
        fetchActiveRides()
      } else {
        setError(data.error || 'Impossible de commander')
      }
    } catch {
      setError('Erreur de connexion')
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* En-tete */}
      <header className="bg-gradient-to-r from-orange-500 to-orange-600 text-white px-4 py-4 flex items-center gap-3 sticky top-0 z-10">
        <button
          onClick={() => setCurrentView('hub')}
          className="p-2 -ml-2 rounded-xl bg-white/10 active:scale-95 transition-transform"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <Bike className="w-6 h-6" />
        <h1 className="text-lg font-bold">Moto-taxi</h1>
      </header>

      {/* Bandeau promo */}
      <div className="bg-orange-50 px-4 py-3 flex items-center gap-2 border-b border-orange-100">
        <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center">
          <Zap className="w-4 h-4 text-orange-600" />
        </div>
        <div className="flex-1">
          <p className="text-xs font-semibold text-orange-800">Rapide & economique</p>
          <p className="text-[10px] text-orange-600">Traversez Conakry en moto</p>
        </div>
      </div>

      <div className="px-4 py-5 space-y-5 pb-8">
        {/* Courses actives */}
        {activeRides.length > 0 && (
          <div>
            <button
              onClick={() => setShowActiveRides(!showActiveRides)}
              className="w-full flex items-center justify-between p-3 bg-orange-50 border border-orange-200 rounded-xl"
            >
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 bg-orange-500 rounded-full animate-pulse" />
                <span className="text-sm font-semibold text-orange-800">
                  {activeRides.length} course(s) active(s)
                </span>
              </div>
              <NavIcon className={`w-4 h-4 text-orange-600 transition-transform ${showActiveRides ? 'rotate-90' : ''}`} />
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
                        <span className="text-sm font-bold text-orange-600">
                          {ride.estimatedFare.toLocaleString()} GNF
                        </span>
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
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* Messages */}
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

        {/* Zones */}
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              <MapPin className="w-4 h-4 inline mr-1 text-green-600" />
              Depart
            </label>
            <select
              value={pickupZone}
              onChange={(e) => setPickupZone(e.target.value)}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500"
            >
              <option value="">Choisir une zone</option>
              {zones.map((z) => (
                <option key={z.id} value={z.name}>{z.name}</option>
              ))}
            </select>
          </div>
          <input
            type="text"
            value={pickupAddress}
            onChange={(e) => setPickupAddress(e.target.value)}
            placeholder="Adresse precise (optionnel)"
            className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500"
          />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              <MapPin className="w-4 h-4 inline mr-1 text-red-600" />
              Destination
            </label>
            <select
              value={dropoffZone}
              onChange={(e) => setDropoffZone(e.target.value)}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500"
            >
              <option value="">Choisir une zone</option>
              {zones.map((z) => (
                <option key={z.id} value={z.name}>{z.name}</option>
              ))}
            </select>
          </div>
          <input
            type="text"
            value={dropoffAddress}
            onChange={(e) => setDropoffAddress(e.target.value)}
            placeholder="Adresse precise (optionnel)"
            className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500"
          />
        </div>

        {/* Paiement */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Paiement</label>
          <div className="grid grid-cols-3 gap-2">
            {PAYMENTS.map((p) => {
              const Icon = p.icon
              const isSelected = paymentMethod === p.id
              return (
                <button
                  key={p.id}
                  onClick={() => setPaymentMethod(p.id)}
                  className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all active:scale-[0.97] ${
                    isSelected ? 'border-orange-500 bg-orange-50' : 'border-gray-200 bg-white'
                  }`}
                >
                  <Icon className={`w-5 h-5 ${isSelected ? 'text-orange-600' : 'text-gray-400'}`} />
                  <span className={`text-[10px] font-semibold ${isSelected ? 'text-orange-600' : 'text-gray-600'}`}>
                    {p.label}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Estimer */}
        <button
          onClick={estimateFare}
          disabled={isLoadingFare || !pickupZone || !dropoffZone}
          className="w-full py-3 bg-gray-800 text-white font-semibold rounded-xl flex items-center justify-center gap-2 active:scale-[0.98] transition-transform disabled:opacity-50"
        >
          {isLoadingFare ? <Loader2 className="w-4 h-4 animate-spin" /> : <NavIcon className="w-4 h-4" />}
          Estimer le tarif
        </button>

        {/* Tarif */}
        {fare && (
          <div className="p-4 bg-white border-2 border-orange-500 rounded-2xl">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">Distance</span>
                <span className="text-sm font-semibold">{fare.distanceKm.toFixed(1)} km</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">Duree</span>
                <span className="text-sm font-semibold">{fare.durationMinutes} min</span>
              </div>
              <div className="border-t border-gray-100 pt-2 flex items-center justify-between">
                <span className="text-base font-bold text-gray-800">Tarif</span>
                <span className="text-xl font-extrabold text-orange-600">
                  {fare.estimatedFare.toLocaleString()} {fare.currency}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Commander */}
        <button
          onClick={createMoto}
          disabled={isCreating || !pickupZone || !dropoffZone}
          className="w-full py-4 bg-gradient-to-r from-orange-500 to-orange-600 text-white text-lg font-bold rounded-xl flex items-center justify-center gap-2 active:scale-[0.98] transition-transform disabled:opacity-60 shadow-lg shadow-orange-900/20"
        >
          {isCreating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Bike className="w-5 h-5" />}
          Commander un moto
        </button>
      </div>
    </div>
  )
}
