'use client'

import { useState, useEffect, useCallback } from 'react'
import { useMovaStore } from '@/lib/store'
import {
  ArrowLeft,
  MapPin,
  Clock,
  Users,
  Loader2,
  CheckCircle2,
  XCircle,
  Navigation,
  Car,
  Star,
  Plus,
} from 'lucide-react'

// --- Types ---

interface Zone {
  id: string
  name: string
}

interface CarpoolRide {
  id: string
  pickupAddress: string
  dropoffAddress: string
  scheduledAt: string
  estimatedFare: number | null
  status: string
  passenger?: {
    name: string
    avatar: string | null
    rating: number | null
  }
  vehicle?: {
    brand: string | null
    model: string | null
    color: string | null
    plateNumber: string | null
  }
}

// --- Constantes ---

const ZONES_DEFAUT: Zone[] = [
  { id: 'kaloum', name: 'Kaloum' },
  { id: 'dixinn', name: 'Dixinn' },
  { id: 'matam', name: 'Matam' },
  { id: 'matoto', name: 'Matoto' },
  { id: 'ratoma', name: 'Ratoma' },
  { id: 'kassa', name: 'Kassa' },
  { id: 'dubreka', name: 'Dubreka' },
  { id: 'coyah', name: 'Coyah' },
  { id: 'kindia', name: 'Kindia' },
]

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  scheduled: { label: 'Programme', color: 'bg-blue-100 text-blue-800' },
  accepted: { label: 'Accepte', color: 'bg-green-100 text-green-800' },
  in_progress: { label: 'En cours', color: 'bg-indigo-100 text-indigo-800' },
  completed: { label: 'Termine', color: 'bg-gray-100 text-gray-700' },
  cancelled: { label: 'Annule', color: 'bg-red-100 text-red-800' },
}

// --- Composant principal ---

export function CarpoolView() {
  const { setCurrentView } = useMovaStore()

  // Zones
  const [zones] = useState<Zone[]>(ZONES_DEFAUT)

  // Formulaire
  const [pickupAddress, setPickupAddress] = useState('')
  const [pickupZone, setPickupZone] = useState('')
  const [dropoffAddress, setDropoffAddress] = useState('')
  const [dropoffZone, setDropoffZone] = useState('')
  const [seats, setSeats] = useState(1)
  const [departureTime, setDepartureTime] = useState('')

  // Etat
  const [estimatedContribution, setEstimatedContribution] = useState<number | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [showForm, setShowForm] = useState(false)

  // Covoiturages
  const [rides, setRides] = useState<CarpoolRide[]>([])
  const [isLoading, setIsLoading] = useState(false)

  // Date minimum
  const now = new Date()
  const minDatetime = new Date(now.getTime() + 3600000).toISOString().slice(0, 16)

  // Charger les covoiturages
  const fetchRides = useCallback(async () => {
    setIsLoading(true)
    try {
      const token = localStorage.getItem('mova_token')
      const res = await fetch('/api/mova/carpool', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      const data = await res.json()
      if (data.success && data.data?.rides) {
        setRides(data.data.rides)
      }
    } catch {
      // Silencieux
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchRides()
  }, [fetchRides])

  // Estimer la contribution
  const handleEstimate = () => {
    if (!pickupZone || !dropoffZone) {
      setError('Selectionnez les zones de depart et d\'arrivee')
      return
    }
    if (pickupZone === dropoffZone) {
      setError('Les zones doivent etre differentes')
      return
    }

    const contribution = 3000 + Math.round(Math.random() * 3 + 2) * 500
    setEstimatedContribution(contribution)
    setError('')
  }

  // Creer le covoiturage
  const handleCreateCarpool = async () => {
    if (!pickupZone || !dropoffZone) {
      setError('Selectionnez les zones de depart et d\'arrivee')
      return
    }
    if (!departureTime) {
      setError('Selectionnez l\'heure de depart')
      return
    }

    setIsCreating(true)
    setError('')
    setSuccess('')

    try {
      const token = localStorage.getItem('mova_token')
      const res = await fetch('/api/mova/carpool', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          pickupAddress: pickupAddress.trim() || pickupZone,
          pickupLat: 0,
          pickupLng: 0,
          dropoffAddress: dropoffAddress.trim() || dropoffZone,
          dropoffLat: 0,
          dropoffLng: 0,
          seats,
          departureTime,
        }),
      })

      const data = await res.json()

      if (data.success) {
        setSuccess('Trajet publie avec succes !')
        setShowForm(false)
        setPickupAddress('')
        setPickupZone('')
        setDropoffAddress('')
        setDropoffZone('')
        setSeats(1)
        setDepartureTime('')
        setEstimatedContribution(null)
        fetchRides()
      } else {
        setError(data.error || 'Impossible de publier le trajet')
      }
    } catch {
      setError('Erreur de connexion au serveur')
    } finally {
      setIsCreating(false)
    }
  }

  // Formater la date
  const formatDateTime = (iso: string): string => {
    const d = new Date(iso)
    return d.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* En-tete */}
      <header className="bg-[#1e40af] text-white px-4 py-4 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setCurrentView('hub')}
            className="p-2 -ml-2 rounded-xl hover:bg-white/10 active:scale-95 transition-transform"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <Users className="w-5 h-5" />
          <h1 className="text-lg font-bold">Covoiturage</h1>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-white/20 text-white text-sm font-semibold rounded-xl hover:bg-white/30 transition-colors active:scale-[0.97]"
        >
          {showForm ? 'Fermer' : 'Publier'}
        </button>
      </header>

      <div className="px-4 py-5 space-y-5 pb-8">
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

        {/* Formulaire de publication */}
        {showForm && (
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 space-y-4">
            <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <Plus className="w-4 h-4 text-[#059669]" />
              Proposer un trajet
            </h2>

            {/* Zones */}
            <div className="space-y-2">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  <MapPin className="w-3.5 h-3.5 inline mr-1 text-green-600" />
                  Zone de depart
                </label>
                <select
                  value={pickupZone}
                  onChange={(e) => { setPickupZone(e.target.value); setEstimatedContribution(null) }}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1e40af]/30 focus:border-[#1e40af]"
                >
                  <option value="">Choisir</option>
                  {zones.map((z) => <option key={z.id} value={z.name}>{z.name}</option>)}
                </select>
              </div>
              <input
                type="text"
                value={pickupAddress}
                onChange={(e) => setPickupAddress(e.target.value)}
                placeholder="Adresse precise (optionnel)"
                className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1e40af]/30 focus:border-[#1e40af]"
              />
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  <MapPin className="w-3.5 h-3.5 inline mr-1 text-red-600" />
                  Zone de destination
                </label>
                <select
                  value={dropoffZone}
                  onChange={(e) => { setDropoffZone(e.target.value); setEstimatedContribution(null) }}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1e40af]/30 focus:border-[#1e40af]"
                >
                  <option value="">Choisir</option>
                  {zones.map((z) => <option key={z.id} value={z.name}>{z.name}</option>)}
                </select>
              </div>
              <input
                type="text"
                value={dropoffAddress}
                onChange={(e) => setDropoffAddress(e.target.value)}
                placeholder="Adresse precise (optionnel)"
                className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1e40af]/30 focus:border-[#1e40af]"
              />
            </div>

            {/* Places et horaire */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  <Users className="w-3.5 h-3.5 inline mr-1" />
                  Places disponibles
                </label>
                <div className="flex gap-1.5">
                  {[1, 2, 3, 4].map((n) => (
                    <button
                      key={n}
                      onClick={() => setSeats(n)}
                      className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all border ${
                        seats === n
                          ? 'bg-[#1e40af] text-white border-[#1e40af]'
                          : 'bg-white border-gray-200 text-gray-600'
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  <Clock className="w-3.5 h-3.5 inline mr-1" />
                  Heure de depart
                </label>
                <input
                  type="datetime-local"
                  value={departureTime}
                  onChange={(e) => setDepartureTime(e.target.value)}
                  min={minDatetime}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1e40af]/30 focus:border-[#1e40af]"
                />
              </div>
            </div>

            {/* Boutons */}
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={handleEstimate}
                disabled={!pickupZone || !dropoffZone}
                className="py-3 bg-gray-800 text-white font-semibold rounded-xl flex items-center justify-center gap-2 active:scale-[0.98] transition-transform disabled:opacity-50"
              >
                Estimer
              </button>
              <button
                onClick={handleCreateCarpool}
                disabled={isCreating || !pickupZone || !dropoffZone || !departureTime}
                className="py-3 bg-[#059669] text-white font-semibold rounded-xl flex items-center justify-center gap-2 active:scale-[0.98] transition-transform disabled:opacity-60 shadow-lg shadow-green-900/20"
              >
                {isCreating ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Publier'}
              </button>
            </div>

            {estimatedContribution != null && (
              <div className="p-3 bg-[#059669]/5 border border-[#059669]/20 rounded-xl text-center">
                <span className="text-sm text-gray-500">Contribution estimee : </span>
                <span className="text-lg font-bold text-[#059669]">
                  {estimatedContribution.toLocaleString()} GNF / passager
                </span>
              </div>
            )}
          </div>
        )}

        {/* Chargement */}
        {isLoading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-[#1e40af]" />
            <span className="ml-2 text-sm text-gray-500">Chargement des covoiturages...</span>
          </div>
        )}

        {/* Liste des covoiturages */}
        {!isLoading && rides.length > 0 && (
          <div>
            <h2 className="text-sm font-semibold text-gray-700 mb-3">
              Trajets disponibles ({rides.length})
            </h2>
            <div className="space-y-3">
              {rides.map((ride) => {
                const statusInfo = STATUS_LABELS[ride.status] || { label: ride.status, color: 'bg-gray-100 text-gray-800' }
                return (
                  <div key={ride.id} className="p-4 bg-white rounded-2xl border border-gray-100 shadow-sm space-y-3">
                    {/* Conducteur et statut */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-9 h-9 rounded-full bg-[#1e40af]/10 flex items-center justify-center text-xs font-bold text-[#1e40af]">
                          {ride.passenger?.name
                            ? ride.passenger.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
                            : '?'
                          }
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-gray-800">
                            {ride.passenger?.name || 'Conducteur'}
                          </p>
                          {ride.passenger?.rating != null && (
                            <div className="flex items-center gap-0.5 text-xs text-gray-500">
                              <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
                              <span>{ride.passenger.rating}</span>
                            </div>
                          )}
                        </div>
                      </div>
                      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${statusInfo.color}`}>
                        {statusInfo.label}
                      </span>
                    </div>

                    {/* Trajet */}
                    <div className="flex items-start gap-2">
                      <div className="flex flex-col items-center gap-0.5 pt-1">
                        <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
                        <div className="w-0.5 h-8 bg-gray-200" />
                        <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
                      </div>
                      <div className="flex-1 space-y-4">
                        <div>
                          <p className="text-sm font-medium text-gray-700">{ride.pickupAddress}</p>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-700">{ride.dropoffAddress}</p>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="flex items-center gap-1 text-xs text-gray-500 mb-1">
                          <Clock className="w-3.5 h-3.5" />
                          <span>{formatDateTime(ride.scheduledAt)}</span>
                        </div>
                        {ride.estimatedFare != null && ride.estimatedFare > 0 && (
                          <p className="text-sm font-bold text-[#059669]">
                            {ride.estimatedFare.toLocaleString()} GNF
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Vehicule */}
                    {ride.vehicle && (
                      <div className="flex items-center gap-1.5 text-xs text-gray-400 pt-2 border-t border-gray-50">
                        <Car className="w-3.5 h-3.5" />
                        <span>
                          {[ride.vehicle.brand, ride.vehicle.model, ride.vehicle.color, ride.vehicle.plateNumber]
                            .filter(Boolean)
                            .join(' ')}
                        </span>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Etat vide */}
        {!isLoading && rides.length === 0 && !showForm && (
          <div className="text-center py-12">
            <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
              <Navigation className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-base font-semibold text-gray-700 mb-1">Aucun covoiturage disponible</h3>
            <p className="text-sm text-gray-500">Publiez un trajet ou revenez plus tard</p>
          </div>
        )}
      </div>
    </div>
  )
}
