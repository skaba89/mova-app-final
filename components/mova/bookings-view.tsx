'use client'

import { useState, useEffect, useCallback } from 'react'
import { useMovaStore } from '@/lib/store'
import { apiFetch } from '@/lib/api'
import {
  ArrowLeft,
  MapPin,
  Calendar,
  Clock,
  Car,
  Crown,
  Truck,
  Users,
  Loader2,
  CheckCircle2,
  XCircle,
  StickyNote,
  Navigation,
  Ban,
} from 'lucide-react'

// --- Types ---

interface Zone {
  id: string
  name: string
}

interface Booking {
  id: string
  vehicleType: string
  pickupAddress: string
  pickupZone: string
  dropoffAddress: string
  dropoffZone: string
  scheduledAt: string
  passengerCount: number | null
  notes: string | null
  status: string
  estimatedFare: number | null
  createdAt: string
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

const VEHICLE_TYPES = [
  { id: 'standard', label: 'Standard', icon: Car },
  { id: 'premium', label: 'Premium', icon: Crown },
  { id: 'van', label: 'Van', icon: Truck },
  { id: 'moto', label: 'Moto', icon: Navigation },
] as const

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending: { label: 'En attente', color: 'bg-yellow-100 text-yellow-800' },
  confirmed: { label: 'Confirmee', color: 'bg-blue-100 text-blue-800' },
  in_progress: { label: 'En cours', color: 'bg-green-100 text-green-800' },
  completed: { label: 'Terminee', color: 'bg-gray-100 text-gray-700' },
  cancelled: { label: 'Annulee', color: 'bg-red-100 text-red-800' },
}

const VEHICLE_LABELS: Record<string, string> = {
  standard: 'Standard',
  premium: 'Premium',
  van: 'Van',
  moto: 'Moto',
  bicycle: 'Velo',
  camion: 'Camion',
  pickup: 'Pickup',
}

// --- Composant principal ---

export function BookingsView() {
  const { setCurrentView } = useMovaStore()

  // Zones
  const [zones] = useState<Zone[]>(ZONES_DEFAUT)

  // Formulaire
  const [pickupAddress, setPickupAddress] = useState('')
  const [pickupZone, setPickupZone] = useState('')
  const [dropoffAddress, setDropoffAddress] = useState('')
  const [dropoffZone, setDropoffZone] = useState('')
  const [vehicleType, setVehicleType] = useState('standard')
  const [scheduledDate, setScheduledDate] = useState('')
  const [scheduledTime, setScheduledTime] = useState('')
  const [passengerCount, setPassengerCount] = useState(1)
  const [notes, setNotes] = useState('')

  // Etat
  const [estimatedFare, setEstimatedFare] = useState<number | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Reservations
  const [bookings, setBookings] = useState<Booking[]>([])
  const [isLoadingBookings, setIsLoadingBookings] = useState(false)
  const [showForm, setShowForm] = useState(false)

  // Date minimum (demain)
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const minDate = tomorrow.toISOString().split('T')[0]

  // Charger les reservations
  const fetchBookings = useCallback(async () => {
    setIsLoadingBookings(true)
    try {
      const res = await apiFetch('/api/mova/bookings')
      if (res.ok) {
        const data = await res.json()
        if (data.success && data.data?.bookings) {
          setBookings(data.data.bookings)
        }
      }
    } catch {
      // Silencieux
    } finally {
      setIsLoadingBookings(false)
    }
  }, [])

  useEffect(() => {
    fetchBookings()
  }, [fetchBookings])

  // Estimer le tarif
  const handleEstimate = () => {
    if (!pickupZone || !dropoffZone) {
      setError('Selectionnez les zones')
      return
    }
    if (pickupZone === dropoffZone) {
      setError('Les zones doivent etre differentes')
      return
    }

    // Tarif approximatif
    const basePrices: Record<string, number> = {
      standard: 5000,
      premium: 7500,
      van: 8000,
      moto: 2000,
    }
    const base = basePrices[vehicleType] || 5000
    const price = base + Math.round(Math.random() * 5 + 3) * 800
    setEstimatedFare(price)
    setError('')
  }

  // Creer la reservation
  const handleCreateBooking = async () => {
    if (!pickupZone || !dropoffZone) {
      setError('Selectionnez les zones de depart et d\'arrivee')
      return
    }
    if (!scheduledDate || !scheduledTime) {
      setError('Selectionnez la date et l\'heure')
      return
    }

    setIsCreating(true)
    setError('')
    setSuccess('')

    const scheduledAt = new Date(`${scheduledDate}T${scheduledTime}`)

    try {
      const res = await apiFetch('/api/mova/bookings', {
        method: 'POST',
        body: JSON.stringify({
          vehicleType,
          pickupAddress: pickupAddress.trim() || pickupZone,
          pickupLat: 0,
          pickupLng: 0,
          pickupZone,
          dropoffAddress: dropoffAddress.trim() || dropoffZone,
          dropoffLat: 0,
          dropoffLng: 0,
          dropoffZone,
          scheduledAt: scheduledAt.toISOString(),
          passengerCount,
          notes: notes.trim() || undefined,
        }),
      })

      const data = await res.json()

      if (data.success) {
        setSuccess('Reservation creee avec succes !')
        setShowForm(false)
        resetForm()
        fetchBookings()
      } else {
        setError(data.error || 'Impossible de creer la reservation')
      }
    } catch {
      setError('Erreur de connexion au serveur')
    } finally {
      setIsCreating(false)
    }
  }

  // Annuler une reservation
  const handleCancel = async (bookingId: string) => {
    try {
      const res = await apiFetch(`/api/mova/bookings/${bookingId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'cancelled' }),
      })
      if (res.ok) {
        setBookings((prev) => prev.map((b) => b.id === bookingId ? { ...b, status: 'cancelled' } : b))
        setSuccess('Reservation annulee')
      }
    } catch {
      setError('Impossible d\'annuler la reservation')
    }
  }

  const resetForm = () => {
    setPickupAddress('')
    setPickupZone('')
    setDropoffAddress('')
    setDropoffZone('')
    setVehicleType('standard')
    setScheduledDate('')
    setScheduledTime('')
    setPassengerCount(1)
    setNotes('')
    setEstimatedFare(null)
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

  // Separer les reservations a venir et passees
  const now = new Date()
  const upcoming = bookings.filter((b) => new Date(b.scheduledAt) >= now && b.status !== 'cancelled')
  const past = bookings.filter((b) => new Date(b.scheduledAt) < now || b.status === 'cancelled')

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
          <Calendar className="w-5 h-5" />
          <h1 className="text-lg font-bold">Reservations</h1>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-white/20 text-white text-sm font-semibold rounded-xl hover:bg-white/30 transition-colors active:scale-[0.97]"
        >
          {showForm ? 'Fermer' : 'Nouvelle'}
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

        {/* Formulaire de reservation */}
        {showForm && (
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 space-y-4">
            <h2 className="text-sm font-semibold text-gray-700">Nouvelle reservation</h2>

            {/* Zones */}
            <div className="space-y-2">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  <MapPin className="w-3.5 h-3.5 inline mr-1 text-green-600" />
                  Zone de depart
                </label>
                <select
                  value={pickupZone}
                  onChange={(e) => { setPickupZone(e.target.value); setEstimatedFare(null) }}
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
                  onChange={(e) => { setDropoffZone(e.target.value); setEstimatedFare(null) }}
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

            {/* Type de vehicule */}
            <div>
              <div className="text-xs font-medium text-gray-500 mb-2">Type de vehicule</div>
              <div className="grid grid-cols-4 gap-2">
                {VEHICLE_TYPES.map((vt) => {
                  const Icon = vt.icon
                  const isSelected = vehicleType === vt.id
                  return (
                    <button
                      key={vt.id}
                      onClick={() => { setVehicleType(vt.id); setEstimatedFare(null) }}
                      className={`flex flex-col items-center gap-1 p-2.5 rounded-xl border-2 transition-all active:scale-[0.97] ${
                        isSelected ? 'border-[#1e40af] bg-blue-50' : 'border-gray-200 bg-white'
                      }`}
                    >
                      <Icon className={`w-5 h-5 ${isSelected ? 'text-[#1e40af]' : 'text-gray-400'}`} />
                      <span className={`text-[10px] font-semibold ${isSelected ? 'text-[#1e40af]' : 'text-gray-600'}`}>
                        {vt.label}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Date et heure */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  <Calendar className="w-3.5 h-3.5 inline mr-1" />
                  Date
                </label>
                <input
                  type="date"
                  value={scheduledDate}
                  onChange={(e) => setScheduledDate(e.target.value)}
                  min={minDate}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1e40af]/30 focus:border-[#1e40af]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  <Clock className="w-3.5 h-3.5 inline mr-1" />
                  Heure
                </label>
                <input
                  type="time"
                  value={scheduledTime}
                  onChange={(e) => setScheduledTime(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1e40af]/30 focus:border-[#1e40af]"
                />
              </div>
            </div>

            {/* Passagers et notes */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  <Users className="w-3.5 h-3.5 inline mr-1" />
                  Passagers
                </label>
                <select
                  value={passengerCount}
                  onChange={(e) => setPassengerCount(parseInt(e.target.value))}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1e40af]/30 focus:border-[#1e40af]"
                >
                  {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  <StickyNote className="w-3.5 h-3.5 inline mr-1" />
                  Notes
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Optionnel"
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
                onClick={handleCreateBooking}
                disabled={isCreating || !pickupZone || !dropoffZone || !scheduledDate || !scheduledTime}
                className="py-3 bg-[#1e40af] text-white font-semibold rounded-xl flex items-center justify-center gap-2 active:scale-[0.98] transition-transform disabled:opacity-60 shadow-lg shadow-blue-900/20"
              >
                {isCreating ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Reserver'}
              </button>
            </div>

            {estimatedFare != null && (
              <div className="p-3 bg-[#1e40af]/5 border border-[#1e40af]/20 rounded-xl text-center">
                <span className="text-sm text-gray-500">Tarif estime : </span>
                <span className="text-lg font-bold text-[#1e40af]">{estimatedFare.toLocaleString()} GNF</span>
              </div>
            )}
          </div>
        )}

        {/* Chargement */}
        {isLoadingBookings && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-[#1e40af]" />
            <span className="ml-2 text-sm text-gray-500">Chargement des reservations...</span>
          </div>
        )}

        {/* Reservations a venir */}
        {!isLoadingBookings && upcoming.length > 0 && (
          <div>
            <h2 className="text-sm font-semibold text-gray-700 mb-3">A venir ({upcoming.length})</h2>
            <div className="space-y-2">
              {upcoming.map((b) => {
                const statusInfo = STATUS_LABELS[b.status] || { label: b.status, color: 'bg-gray-100 text-gray-800' }
                return (
                  <div key={b.id} className="p-3 bg-white rounded-xl border border-gray-100 shadow-sm">
                    <div className="flex items-center justify-between mb-2">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${statusInfo.color}`}>
                        {statusInfo.label}
                      </span>
                      {b.estimatedFare != null && b.estimatedFare > 0 && (
                        <span className="text-sm font-bold text-[#1e40af]">{b.estimatedFare.toLocaleString()} GNF</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-2">
                      <Clock className="w-3.5 h-3.5" />
                      <span>{formatDateTime(b.scheduledAt)}</span>
                      <span className="mx-1">--</span>
                      <span className="capitalize">{VEHICLE_LABELS[b.vehicleType] || b.vehicleType}</span>
                      {b.passengerCount && b.passengerCount > 1 && (
                        <span>({b.passengerCount} passagers)</span>
                      )}
                    </div>
                    <div className="space-y-1 text-sm">
                      <div className="flex items-start gap-2">
                        <div className="w-2 h-2 bg-green-500 rounded-full mt-1.5 shrink-0" />
                        <span className="text-gray-700">{b.pickupAddress || b.pickupZone}</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <div className="w-2 h-2 bg-red-500 rounded-full mt-1.5 shrink-0" />
                        <span className="text-gray-700">{b.dropoffAddress || b.dropoffZone}</span>
                      </div>
                    </div>
                    {(b.status === 'pending' || b.status === 'confirmed') && (
                      <button
                        onClick={() => handleCancel(b.id)}
                        className="mt-3 w-full py-2 text-xs font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors flex items-center justify-center gap-1"
                      >
                        <Ban className="w-3.5 h-3.5" />
                        Annuler
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Reservations passees */}
        {!isLoadingBookings && past.length > 0 && (
          <div>
            <h2 className="text-sm font-semibold text-gray-700 mb-3">Passees ({past.length})</h2>
            <div className="space-y-2">
              {past.map((b) => {
                const statusInfo = STATUS_LABELS[b.status] || { label: b.status, color: 'bg-gray-100 text-gray-800' }
                return (
                  <div key={b.id} className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                    <div className="flex items-center justify-between mb-1">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${statusInfo.color}`}>
                        {statusInfo.label}
                      </span>
                      <span className="text-xs text-gray-400">{formatDateTime(b.scheduledAt)}</span>
                    </div>
                    <div className="text-sm text-gray-600">
                      {b.pickupZone} -- {b.dropoffZone}
                      <span className="text-gray-400 ml-2 capitalize">{VEHICLE_LABELS[b.vehicleType] || b.vehicleType}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Etat vide */}
        {!isLoadingBookings && bookings.length === 0 && !showForm && (
          <div className="text-center py-12">
            <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
              <Calendar className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-base font-semibold text-gray-700 mb-1">Aucune reservation</h3>
            <p className="text-sm text-gray-500">Planifiez votre prochain trajet</p>
          </div>
        )}
      </div>
    </div>
  )
}
