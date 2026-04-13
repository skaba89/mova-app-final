'use client'

import { useState, useEffect, useCallback } from 'react'
import { useMovaStore } from '@/lib/store'
import {
  ArrowLeft,
  MapPin,
  Package,
  FileText,
  ShoppingBag,
  Zap,
  Wine,
  UtensilsCrossed,
  Weight,
  DollarSign,
  User,
  Phone,
  StickyNote,
  Banknote,
  CreditCard,
  Wallet,
  Calculator,
  Loader2,
  CheckCircle2,
  XCircle,
  PackageCheck,
} from 'lucide-react'

// --- Types ---

interface Zone {
  id: string
  name: string
}

interface Delivery {
  id: string
  packageType: string
  pickupAddress: string
  pickupZone: string
  dropoffAddress: string
  dropoffZone: string
  recipientName: string
  status: string
  estimatedPrice: number | null
  paymentMethod: string
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

const PACKAGE_TYPES = [
  { id: 'document', label: 'Document', icon: FileText },
  { id: 'colis', label: 'Colis', icon: ShoppingBag },
  { id: 'express', label: 'Express', icon: Zap },
  { id: 'fragile', label: 'Fragile', icon: Wine },
  { id: 'cuisine', label: 'Cuisine', icon: UtensilsCrossed },
] as const

const PAYMENT_METHODS = [
  { id: 'cash', label: 'Especes', icon: Banknote },
  { id: 'wallet', label: 'Portefeuille', icon: Wallet },
  { id: 'orange_money', label: 'Orange Money', icon: CreditCard },
  { id: 'mtn_momo', label: 'MTN MoMo', icon: Phone },
  { id: 'wave', label: 'Wave', icon: CreditCard },
] as const

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending: { label: 'En attente', color: 'bg-yellow-100 text-yellow-800' },
  accepted: { label: 'Acceptee', color: 'bg-blue-100 text-blue-800' },
  picked_up: { label: 'Ramassee', color: 'bg-purple-100 text-purple-800' },
  in_transit: { label: 'En transit', color: 'bg-indigo-100 text-indigo-800' },
  delivered: { label: 'Livree', color: 'bg-green-100 text-green-800' },
  cancelled: { label: 'Annulee', color: 'bg-red-100 text-red-800' },
}

// --- Tarifs de livraison par zone ---
const BASE_LIVRAISON = 8000
const PER_KM_LIVRAISON = 1200

function estimatePrice(pickupZone: string, dropoffZone: string): number {
  if (!pickupZone || !dropoffZone || pickupZone === dropoffZone) return BASE_LIVRAISON
  const sameCommune = pickupZone === dropoffZone
  if (sameCommune) return BASE_LIVRAISON
  return BASE_LIVRAISON + Math.round(Math.random() * 10 + 5) * PER_KM_LIVRAISON
}

// --- Composant principal ---

export function DeliveriesView() {
  const { setCurrentView } = useMovaStore()

  // Zones
  const [zones] = useState<Zone[]>(ZONES_DEFAUT)

  // Formulaire - Adresses
  const [pickupAddress, setPickupAddress] = useState('')
  const [pickupZone, setPickupZone] = useState('')
  const [dropoffAddress, setDropoffAddress] = useState('')
  const [dropoffZone, setDropoffZone] = useState('')

  // Formulaire - Colis
  const [packageType, setPackageType] = useState('colis')
  const [weight, setWeight] = useState('')
  const [declaredValue, setDeclaredValue] = useState('')

  // Formulaire - Destinataire
  const [recipientName, setRecipientName] = useState('')
  const [recipientPhone, setRecipientPhone] = useState('')
  const [recipientNote, setRecipientNote] = useState('')

  // Formulaire - Paiement
  const [paymentMethod, setPaymentMethod] = useState('cash')

  // Prix estime
  const [estimatedPrice, setEstimatedPrice] = useState<number | null>(null)
  const [isLoadingPrice, setIsLoadingPrice] = useState(false)

  // Soumission
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Livraisons actives
  const [deliveries, setDeliveries] = useState<Delivery[]>([])
  const [isLoadingDeliveries, setIsLoadingDeliveries] = useState(false)
  const [showDeliveries, setShowDeliveries] = useState(false)

  // Charger les livraisons actives
  const fetchDeliveries = useCallback(async () => {
    setIsLoadingDeliveries(true)
    try {
      const token = localStorage.getItem('mova_token')
      const res = await fetch('/api/mova/deliveries?status=pending,accepted,picked_up,in_transit', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      const data = await res.json()
      if (data.success && data.data?.deliveries) {
        setDeliveries(data.data.deliveries)
      }
    } catch {
      // Silencieux
    } finally {
      setIsLoadingDeliveries(false)
    }
  }, [])

  useEffect(() => {
    fetchDeliveries()
  }, [fetchDeliveries])

  // Estimer le prix
  const handleEstimatePrice = () => {
    if (!pickupZone || !dropoffZone) {
      setError('Selectionnez les zones de depart et de destination')
      return
    }
    if (pickupZone === dropoffZone) {
      setError('Les zones doivent etre differentes')
      return
    }

    setIsLoadingPrice(true)
    setError('')

    // Simulation du calcul
    setTimeout(() => {
      const price = estimatePrice(pickupZone, dropoffZone)
      setEstimatedPrice(price)
      setIsLoadingPrice(false)
    }, 600)
  }

  // Commander la livraison
  const handleCreateDelivery = async () => {
    if (!pickupZone || !dropoffZone) {
      setError('Selectionnez les zones de depart et de destination')
      return
    }
    if (!recipientName.trim()) {
      setError('Le nom du destinataire est requis')
      return
    }
    if (!recipientPhone.trim()) {
      setError('Le telephone du destinataire est requis')
      return
    }

    setIsCreating(true)
    setError('')
    setSuccess('')

    try {
      const token = localStorage.getItem('mova_token')
      const res = await fetch('/api/mova/deliveries', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          packageType,
          pickupAddress: pickupAddress.trim() || pickupZone,
          pickupLat: 0,
          pickupLng: 0,
          pickupZone,
          dropoffAddress: dropoffAddress.trim() || dropoffZone,
          dropoffLat: 0,
          dropoffLng: 0,
          dropoffZone,
          recipientName: recipientName.trim(),
          recipientPhone: recipientPhone.trim(),
          paymentMethod,
          packageWeight: weight ? parseFloat(weight) : undefined,
          declaredValue: declaredValue ? parseFloat(declaredValue) : undefined,
        }),
      })

      const data = await res.json()

      if (data.success) {
        setSuccess('Livraison creee avec succes ! Recherche d\'un livreur en cours...')
        resetForm()
        fetchDeliveries()
      } else {
        setError(data.error || 'Impossible de creer la livraison')
      }
    } catch {
      setError('Erreur de connexion au serveur')
    } finally {
      setIsCreating(false)
    }
  }

  const resetForm = () => {
    setPickupAddress('')
    setPickupZone('')
    setDropoffAddress('')
    setDropoffZone('')
    setPackageType('colis')
    setWeight('')
    setDeclaredValue('')
    setRecipientName('')
    setRecipientPhone('')
    setRecipientNote('')
    setPaymentMethod('cash')
    setEstimatedPrice(null)
  }

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
        <h1 className="text-lg font-bold">Livraison</h1>
      </header>

      <div className="px-4 py-5 space-y-5 pb-8">
        {/* Livraisons actives */}
        {deliveries.length > 0 && (
          <div>
            <button
              onClick={() => setShowDeliveries(!showDeliveries)}
              className="w-full flex items-center justify-between p-3 bg-[#059669]/10 border border-[#059669]/20 rounded-xl"
            >
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 bg-[#059669] rounded-full animate-pulse" />
                <span className="text-sm font-semibold text-[#059669]">
                  {deliveries.length} livraison(s) active(s)
                </span>
              </div>
              <PackageCheck className="w-4 h-4 text-[#059669]" />
            </button>

            {showDeliveries && (
              <div className="mt-2 space-y-2">
                {deliveries.map((d) => {
                  const statusInfo = STATUS_LABELS[d.status] || { label: d.status, color: 'bg-gray-100 text-gray-800' }
                  return (
                    <div key={d.id} className="p-3 bg-white rounded-xl border border-gray-100 shadow-sm">
                      <div className="flex items-center justify-between mb-2">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${statusInfo.color}`}>
                          {statusInfo.label}
                        </span>
                        {d.estimatedPrice != null && d.estimatedPrice > 0 && (
                          <span className="text-sm font-bold text-[#1e40af]">
                            {d.estimatedPrice.toLocaleString()} GNF
                          </span>
                        )}
                      </div>
                      <div className="space-y-1.5 text-sm">
                        <div className="flex items-start gap-2">
                          <div className="w-2 h-2 bg-green-500 rounded-full mt-1.5 shrink-0" />
                          <span className="text-gray-700">{d.pickupAddress || d.pickupZone}</span>
                        </div>
                        <div className="flex items-start gap-2">
                          <div className="w-2 h-2 bg-red-500 rounded-full mt-1.5 shrink-0" />
                          <span className="text-gray-700">{d.dropoffAddress || d.dropoffZone}</span>
                        </div>
                      </div>
                      <div className="mt-2 pt-2 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
                        <span>{d.recipientName}</span>
                        <span className="capitalize">{d.packageType}</span>
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

        {/* Adresses */}
        <div className="space-y-3">
          <div className="text-sm font-semibold text-gray-700">Adresses</div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">
              <MapPin className="w-3.5 h-3.5 inline mr-1 text-green-600" />
              Zone de depart
            </label>
            <select
              value={pickupZone}
              onChange={(e) => { setPickupZone(e.target.value); setEstimatedPrice(null) }}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1e40af]/30 focus:border-[#1e40af] transition-colors"
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
            className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1e40af]/30 focus:border-[#1e40af] transition-colors"
          />

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">
              <MapPin className="w-3.5 h-3.5 inline mr-1 text-red-600" />
              Zone de destination
            </label>
            <select
              value={dropoffZone}
              onChange={(e) => { setDropoffZone(e.target.value); setEstimatedPrice(null) }}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1e40af]/30 focus:border-[#1e40af] transition-colors"
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
            className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1e40af]/30 focus:border-[#1e40af] transition-colors"
          />
        </div>

        {/* Type de colis */}
        <div>
          <div className="text-sm font-semibold text-gray-700 mb-2">Type de colis</div>
          <div className="grid grid-cols-5 gap-2">
            {PACKAGE_TYPES.map((pt) => {
              const Icon = pt.icon
              const isSelected = packageType === pt.id
              return (
                <button
                  key={pt.id}
                  onClick={() => setPackageType(pt.id)}
                  className={`flex flex-col items-center gap-1 p-2.5 rounded-xl border-2 transition-all active:scale-[0.97] ${
                    isSelected ? 'border-[#1e40af] bg-blue-50' : 'border-gray-200 bg-white'
                  }`}
                >
                  <Icon className={`w-5 h-5 ${isSelected ? 'text-[#1e40af]' : 'text-gray-400'}`} />
                  <span className={`text-[10px] font-semibold ${isSelected ? 'text-[#1e40af]' : 'text-gray-600'}`}>
                    {pt.label}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Poids et valeur declaree */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">
              <Weight className="w-3.5 h-3.5 inline mr-1" />
              Poids (kg)
            </label>
            <input
              type="number"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              placeholder="0.5"
              min="0.1"
              step="0.1"
              className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1e40af]/30 focus:border-[#1e40af] transition-colors"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">
              <DollarSign className="w-3.5 h-3.5 inline mr-1" />
              Valeur (GNF)
            </label>
            <input
              type="number"
              value={declaredValue}
              onChange={(e) => setDeclaredValue(e.target.value)}
              placeholder="0"
              min="0"
              className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1e40af]/30 focus:border-[#1e40af] transition-colors"
            />
          </div>
        </div>

        {/* Destinataire */}
        <div className="space-y-3">
          <div className="text-sm font-semibold text-gray-700">Destinataire</div>
          <div className="relative">
            <User className="w-4 h-4 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={recipientName}
              onChange={(e) => setRecipientName(e.target.value)}
              placeholder="Nom du destinataire"
              className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1e40af]/30 focus:border-[#1e40af] transition-colors"
            />
          </div>
          <div className="relative">
            <Phone className="w-4 h-4 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2" />
            <input
              type="tel"
              value={recipientPhone}
              onChange={(e) => setRecipientPhone(e.target.value)}
              placeholder="Telephone du destinataire"
              className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1e40af]/30 focus:border-[#1e40af] transition-colors"
            />
          </div>
          <div className="relative">
            <StickyNote className="w-4 h-4 text-gray-400 absolute left-4 top-3" />
            <textarea
              value={recipientNote}
              onChange={(e) => setRecipientNote(e.target.value)}
              placeholder="Note pour le livreur (optionnel)"
              rows={2}
              className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1e40af]/30 focus:border-[#1e40af] transition-colors resize-none"
            />
          </div>
        </div>

        {/* Mode de paiement */}
        <div>
          <div className="text-sm font-semibold text-gray-700 mb-2">Mode de paiement</div>
          <div className="grid grid-cols-3 gap-2">
            {PAYMENT_METHODS.map((pm) => {
              const Icon = pm.icon
              const isSelected = paymentMethod === pm.id
              return (
                <button
                  key={pm.id}
                  onClick={() => setPaymentMethod(pm.id)}
                  className={`flex items-center gap-1.5 p-2.5 rounded-xl border-2 transition-all text-left active:scale-[0.97] ${
                    isSelected ? 'border-[#1e40af] bg-blue-50' : 'border-gray-200 bg-white'
                  }`}
                >
                  <Icon className={`w-4 h-4 shrink-0 ${isSelected ? 'text-[#1e40af]' : 'text-gray-400'}`} />
                  <span className={`text-[11px] font-semibold truncate ${isSelected ? 'text-[#1e40af]' : 'text-gray-700'}`}>
                    {pm.label}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Estimer le prix */}
        <button
          onClick={handleEstimatePrice}
          disabled={isLoadingPrice || !pickupZone || !dropoffZone}
          className="w-full py-3 bg-gray-800 text-white font-semibold rounded-xl flex items-center justify-center gap-2 active:scale-[0.98] transition-transform disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoadingPrice ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Calculator className="w-4 h-4" />
          )}
          Estimer le prix
        </button>

        {/* Affichage du prix estime */}
        {estimatedPrice != null && (
          <div className="p-4 bg-white border-2 border-[#1e40af] rounded-2xl">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">Prix estime</span>
              <span className="text-xl font-extrabold text-[#1e40af]">
                {estimatedPrice.toLocaleString()} GNF
              </span>
            </div>
            <div className="mt-2 text-xs text-gray-400">
              {pickupZone} -- {dropoffZone}
            </div>
          </div>
        )}

        {/* Commander */}
        <button
          onClick={handleCreateDelivery}
          disabled={isCreating || !pickupZone || !dropoffZone || !recipientName.trim() || !recipientPhone.trim()}
          className="w-full py-4 bg-[#1e40af] text-white text-lg font-bold rounded-xl flex items-center justify-center gap-2 active:scale-[0.98] transition-transform disabled:opacity-60 disabled:cursor-not-allowed shadow-lg shadow-blue-900/20"
        >
          {isCreating ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Package className="w-5 h-5" />
          )}
          Commander
        </button>

        {/* Voir les livraisons */}
        <button
          onClick={fetchDeliveries}
          disabled={isLoadingDeliveries}
          className="w-full py-2.5 text-center text-sm text-gray-500 font-medium"
        >
          {isLoadingDeliveries ? 'Chargement...' : 'Voir mes livraisons'}
        </button>
      </div>
    </div>
  )
}
