'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useMovaStore } from '@/lib/store'
import {
  ArrowLeft,
  Clock,
  MapPin,
  Phone,
  Truck,
  Package,
  ChefHat,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Copy,
  PhoneCall,
  MessageCircle,
  CircleDot,
  CircleCheck,
  CircleX,
} from 'lucide-react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface OrderDriver {
  id: string
  user: {
    id: string
    name: string
    phone: string
    avatar: string | null
  }
  vehicleType: string
}

interface OrderPayment {
  id: string
  amount: number | null
  method: string
  status: string
  reference: string | null
  createdAt: string
}

interface OrderItem {
  menuItemId: string
  name: string
  price: number
  quantity: number
  total: number
}

interface OrderData {
  id: string
  customerId: string
  restaurantId: string
  driverProfileId: string | null
  status: string
  items: string | OrderItem[]
  subtotal: number | null
  deliveryFee: number | null
  serviceFee: number | null
  totalAmount: number | null
  paymentMethod: string
  paymentStatus: string
  deliveryAddress: string
  deliveryLat: number | null
  deliveryLng: number | null
  deliveryZone: string | null
  customerNote: string | null
  restaurantNote: string | null
  otp: string | null
  estimatedDeliveryTime: number | null
  actualDeliveryTime: number | null
  cancelledAt: string | null
  createdAt: string
  updatedAt: string
  restaurant: {
    id: string
    name: string
    address: string | null
    logoUrl: string | null
    phone: string | null
  }
  driverProfile: OrderDriver | null
  payments: OrderPayment[]
}

interface OrderResponse {
  success: boolean
  data?: {
    order: OrderData
  }
  error?: string
}

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------

const STATUS_STEPS = [
  { key: 'pending', label: 'Confirmee', icon: CircleDot, color: 'text-gray-400' },
  { key: 'confirmed', label: 'Confirmee', icon: CircleCheck, color: 'text-blue-500' },
  { key: 'preparing', label: 'En preparation', icon: ChefHat, color: 'text-orange-500' },
  { key: 'ready', label: 'Pret', icon: Package, color: 'text-amber-500' },
  { key: 'picked_up', label: 'Recuperee', icon: Truck, color: 'text-indigo-500' },
  { key: 'in_transit', label: 'En livraison', icon: Truck, color: 'text-purple-500' },
  { key: 'delivered', label: 'Livree', icon: CheckCircle2, color: 'text-green-500' },
] as const

const STATUS_LABELS: Record<string, { label: string; description: string; color: string; bgColor: string }> = {
  pending: {
    label: 'En attente',
    description: 'Votre commande est en attente de confirmation par le restaurant.',
    color: 'text-gray-600',
    bgColor: 'bg-gray-100',
  },
  confirmed: {
    label: 'Confirmee',
    description: 'Le restaurant a accepte votre commande et va commencer la preparation.',
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
  },
  preparing: {
    label: 'En preparation',
    description: 'Votre commande est en cours de preparation par le restaurant.',
    color: 'text-orange-600',
    bgColor: 'bg-orange-50',
  },
  ready: {
    label: 'Pret a recuperer',
    description: 'Votre commande est prete ! Un livreur va etre assigne.',
    color: 'text-amber-600',
    bgColor: 'bg-amber-50',
  },
  picked_up: {
    label: 'Recuperee',
    description: 'Le livreur a recupere votre commande et se dirige vers vous.',
    color: 'text-indigo-600',
    bgColor: 'bg-indigo-50',
  },
  in_transit: {
    label: 'En livraison',
    description: 'Le livreur est en route vers votre adresse de livraison.',
    color: 'text-purple-600',
    bgColor: 'bg-purple-50',
  },
  delivered: {
    label: 'Livree',
    description: 'Votre commande a ete livree avec succes. Bon appetit !',
    color: 'text-green-600',
    bgColor: 'bg-green-50',
  },
  cancelled: {
    label: 'Annulee',
    description: 'Votre commande a ete annulee. Un remboursement sera effectue si applicable.',
    color: 'text-red-600',
    bgColor: 'bg-red-50',
  },
}

const POLL_INTERVAL_MS = 15000 // 15 secondes

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatPrice(amount: number | null | undefined): string {
  if (amount == null) return '---'
  return new Intl.NumberFormat('fr-FR').format(amount) + ' GNF'
}

function formatDate(isoString: string): string {
  try {
    return new Intl.DateTimeFormat('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(isoString))
  } catch {
    return isoString
  }
}

function getMovaWindow(key: string): string | undefined {
  if (typeof window === 'undefined') return undefined
  return (window as unknown as Record<string, string>)[key]
}

/** Obtenir l'index d'etape actuel */
function getStatusStepIndex(status: string): number {
  const idx = STATUS_STEPS.findIndex((s) => s.key === status)
  return idx >= 0 ? idx : 0
}

/** Verifier si la commande est dans un etat terminal */
function isTerminalStatus(status: string): boolean {
  return status === 'delivered' || status === 'cancelled'
}

/** Verifier si la commande est en transit (pour afficher l'OTP) */
function isInTransit(status: string): boolean {
  return status === 'picked_up' || status === 'in_transit'
}

/** Parser les articles de la commande (peut etre JSON string ou objet) */
function parseOrderItems(items: string | OrderItem[]): OrderItem[] {
  if (Array.isArray(items)) return items
  try {
    const parsed = JSON.parse(items)
    if (Array.isArray(parsed)) return parsed
    return []
  } catch {
    return []
  }
}

// ---------------------------------------------------------------------------
// Composant principal
// ---------------------------------------------------------------------------

export function FoodTrackingView() {
  const { setCurrentView } = useMovaStore()

  // -- Etats --
  const [order, setOrder] = useState<OrderData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pollCount, setPollCount] = useState(0)
  const [copiedOtp, setCopiedOtp] = useState(false)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  // -- ID de commande --
  const orderId = useMemo(() => getMovaWindow('__mova_order_id'), [])

  // -- Chargement de la commande --
  const fetchOrder = useCallback(async () => {
    if (!orderId) {
      setError('Identifiant de commande manquant. Veuillez passer une commande.')
      setLoading(false)
      return
    }

    try {
      const token =
        typeof window !== 'undefined' ? localStorage.getItem('mova_token') : null
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (token) {
        headers['Authorization'] = `Bearer ${token}`
      }

      const res = await fetch(`/api/mova/food/${orderId}`, { headers })

      if (!res.ok) {
        if (res.status === 404) {
          throw new Error('Commande introuvable.')
        }
        if (res.status === 403) {
          throw new Error('Acces refuse a cette commande.')
        }
        throw new Error(`Erreur ${res.status}: ${res.statusText}`)
      }

      const json: OrderResponse = await res.json()

      if (json.success && json.data?.order) {
        setOrder(json.data.order)
        setError(null)
      } else {
        setError(json.error || 'Impossible de charger la commande.')
      }
    } catch (err) {
      console.error('[FOODTRACKING] Erreur:', err)
      setError(err instanceof Error ? err.message : 'Erreur de connexion au serveur.')
    } finally {
      setLoading(false)
    }
  }, [orderId])

  // -- Premier chargement --
  useEffect(() => {
    fetchOrder()
  }, [fetchOrder])

  // -- Auto-rafraichissement --
  useEffect(() => {
    if (!order || isTerminalStatus(order.status)) return

    intervalRef.current = setInterval(() => {
      fetchOrder()
      setPollCount((prev) => prev + 1)
    }, POLL_INTERVAL_MS)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [order?.status, fetchOrder])

  // -- Copier l'OTP --
  const handleCopyOtp = useCallback(() => {
    if (order?.otp) {
      navigator.clipboard.writeText(order.otp).then(() => {
        setCopiedOtp(true)
        setTimeout(() => setCopiedOtp(false), 2000)
      }).catch(() => {
        // Fallback pour les navigateurs sans clipboard API
        const textArea = document.createElement('textarea')
        textArea.value = order.otp!
        document.body.appendChild(textArea)
        textArea.select()
        document.execCommand('copy')
        document.body.removeChild(textArea)
        setCopiedOtp(true)
        setTimeout(() => setCopiedOtp(false), 2000)
      })
    }
  }, [order?.otp])

  // -- Donnees derivees --
  const statusInfo = order ? STATUS_LABELS[order.status] || STATUS_LABELS.pending : null
  const currentStepIndex = order ? getStatusStepIndex(order.status) : 0
  const parsedItems = order ? parseOrderItems(order.items) : []
  const showOtp = order ? isInTransit(order.status) && order.otp : false

  // -- Progression du timeline (en pourcentage) --
  const progressPercent = (currentStepIndex / (STATUS_STEPS.length - 1)) * 100

  // -- Retour loading --
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">
        <Loader2 className="w-10 h-10 text-red-500 animate-spin mb-4" />
        <p className="text-sm text-gray-500">Chargement du suivi...</p>
      </div>
    )
  }

  // -- Retour erreur --
  if (error || !order) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
          <AlertTriangle className="w-8 h-8 text-red-400" />
        </div>
        <h3 className="text-lg font-bold text-gray-700 mb-2">Erreur de suivi</h3>
        <p className="text-sm text-gray-500 text-center mb-6 max-w-xs">{error}</p>
        <div className="flex gap-3">
          <button
            onClick={fetchOrder}
            className="flex items-center gap-2 px-5 py-2.5 bg-red-600 text-white rounded-xl text-sm font-semibold active:scale-95 transition-transform"
          >
            <RefreshCw className="w-4 h-4" />
            Reessayer
          </button>
          <button
            onClick={() => setCurrentView('hub')}
            className="flex items-center gap-2 px-5 py-2.5 bg-gray-200 text-gray-700 rounded-xl text-sm font-semibold active:scale-95 transition-transform"
          >
            <ArrowLeft className="w-4 h-4" />
            Accueil
          </button>
        </div>
      </div>
    )
  }

  // -- Rendu principal --
  return (
    <div className="min-h-screen bg-gray-50 pb-6">
      {/* ===== EN-TETE ===== */}
      <header className="bg-gradient-to-br from-red-600 to-red-700 text-white px-4 pt-5 pb-5 rounded-b-3xl shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => setCurrentView('food')}
            className="flex items-center gap-2 px-3 py-2 bg-white/10 rounded-xl active:scale-95 transition-transform"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm font-medium">Retour</span>
          </button>
          <h1 className="text-lg font-extrabold">Suivi de commande</h1>
          <button
            onClick={fetchOrder}
            className="p-2 bg-white/10 rounded-xl active:scale-95 transition-transform"
            aria-label="Actualiser"
          >
            <RefreshCw className={`w-4 h-4 ${pollCount > 0 ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* ID de commande */}
        <div className="bg-white/10 backdrop-blur-sm rounded-xl px-3 py-2">
          <p className="text-red-200 text-[10px] uppercase tracking-wide font-medium">Commande</p>
          <p className="text-sm font-mono font-bold text-white mt-0.5">
            #{order.id.slice(-8).toUpperCase()}
          </p>
        </div>
      </header>

      {/* ===== STATUT ACTUEL ===== */}
      {statusInfo && (
        <section className={`mx-4 -mt-3 relative z-10 rounded-2xl p-4 shadow-md ${statusInfo.bgColor} border border-white/60`}>
          <div className="flex items-center gap-3">
            {order.status === 'cancelled' ? (
              <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <CircleX className="w-6 h-6 text-red-500" />
              </div>
            ) : order.status === 'delivered' ? (
              <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <CheckCircle2 className="w-6 h-6 text-green-500" />
              </div>
            ) : (
              <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm">
                <Loader2 className="w-6 h-6 text-red-500 animate-spin" />
              </div>
            )}
            <div>
              <h2 className={`text-base font-bold ${statusInfo.color}`}>{statusInfo.label}</h2>
              <p className="text-xs text-gray-600 mt-0.5 leading-relaxed">{statusInfo.description}</p>
            </div>
          </div>
        </section>
      )}

      {/* ===== TIMELINE ===== */}
      <section className="mx-4 mt-4 bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
        <h3 className="text-sm font-bold text-gray-700 mb-4">Progression</h3>

        {/* Barre de progression */}
        <div className="relative">
          {/* Ligne de fond */}
          <div className="absolute top-4 left-4 right-4 h-1 bg-gray-100 rounded-full" />
          {/* Ligne de progression */}
          <div
            className="absolute top-4 left-4 h-1 bg-red-500 rounded-full transition-all duration-700"
            style={{ width: `calc(${progressPercent}% - 2rem)` }}
          />

          {/* Etapes */}
          <div className="relative flex justify-between">
            {STATUS_STEPS.map((step, idx) => {
              const isCompleted = idx < currentStepIndex
              const isCurrent = idx === currentStepIndex
              const Icon = step.icon

              return (
                <div
                  key={step.key}
                  className="flex flex-col items-center"
                  style={{ width: `${100 / STATUS_STEPS.length}%` }}
                >
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 ${
                      isCompleted
                        ? 'bg-red-500 text-white'
                        : isCurrent
                          ? 'bg-red-100 text-red-600 ring-2 ring-red-500 ring-offset-2'
                          : 'bg-gray-100 text-gray-400'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                  <span
                    className={`text-[9px] mt-1.5 text-center font-medium leading-tight ${
                      isCompleted || isCurrent ? 'text-gray-800' : 'text-gray-400'
                    }`}
                  >
                    {step.label}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ===== OTP (en transit) ===== */}
      {showOtp && (
        <section className="mx-4 mt-4 bg-amber-50 border border-amber-200 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <ShieldCheck className="w-4 h-4 text-amber-600" />
            <h3 className="text-sm font-bold text-amber-800">Code de verification</h3>
          </div>
          <p className="text-xs text-amber-700 mb-3">
            Communiquez ce code au livreur lors de la livraison pour confirmer la reception.
          </p>
          <div className="flex items-center gap-3">
            <div className="flex-1 flex justify-center gap-2">
              {(order.otp || '').split('').map((digit, i) => (
                <span
                  key={i}
                  className="w-10 h-12 bg-white border-2 border-amber-300 rounded-xl flex items-center justify-center text-2xl font-extrabold text-amber-800"
                >
                  {digit}
                </span>
              ))}
            </div>
            <button
              onClick={handleCopyOtp}
              className={`p-2 rounded-xl transition-colors ${
                copiedOtp
                  ? 'bg-green-100 text-green-600'
                  : 'bg-white border border-amber-200 text-amber-600'
              }`}
              aria-label="Copier le code"
            >
              {copiedOtp ? (
                <CheckCircle2 className="w-5 h-5" />
              ) : (
                <Copy className="w-5 h-5" />
              )}
            </button>
          </div>
        </section>
      )}

      {/* ===== INFOS LIVREUR ===== */}
      {order.driverProfile && order.status !== 'cancelled' && (
        <section className="mx-4 mt-4 bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <h3 className="text-sm font-bold text-gray-700 mb-3">Votre livreur</h3>
          <div className="flex items-center gap-3">
            {/* Avatar */}
            <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center flex-shrink-0">
              {order.driverProfile.user.avatar ? (
                <img
                  src={order.driverProfile.user.avatar}
                  alt={order.driverProfile.user.name}
                  className="w-12 h-12 rounded-xl object-cover"
                />
              ) : (
                <span className="text-lg font-bold text-red-500">
                  {order.driverProfile.user.name.charAt(0).toUpperCase()}
                </span>
              )}
            </div>

            {/* Infos */}
            <div className="flex-1">
              <h4 className="text-sm font-semibold text-gray-800">
                {order.driverProfile.user.name}
              </h4>
              <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                <Phone className="w-3 h-3" />
                {order.driverProfile.user.phone}
              </p>
              {order.driverProfile.vehicleType && (
                <p className="text-xs text-gray-400 mt-0.5">
                  {order.driverProfile.vehicleType === 'standard'
                    ? 'Voiture'
                    : order.driverProfile.vehicleType === 'moto'
                      ? 'Moto'
                      : order.driverProfile.vehicleType.charAt(0).toUpperCase() +
                        order.driverProfile.vehicleType.slice(1)}
                </p>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <a
                href={`tel:${order.driverProfile.user.phone}`}
                className="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center text-green-600 active:scale-90 transition-transform"
                aria-label="Appeler le livreur"
              >
                <PhoneCall className="w-5 h-5" />
              </a>
              <button
                className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600 active:scale-90 transition-transform"
                aria-label="Envoyer un message"
              >
                <MessageCircle className="w-5 h-5" />
              </button>
            </div>
          </div>
        </section>
      )}

      {/* ===== DETAILS DE LA COMMANDE ===== */}
      <section className="mx-4 mt-4 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-50 flex items-center justify-between">
          <h3 className="text-sm font-bold text-gray-700">Details de la commande</h3>
          <span className="text-[10px] text-gray-400">{formatDate(order.createdAt)}</span>
        </div>

        {/* Restaurant */}
        <div className="px-4 py-3 border-b border-gray-50">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <span className="text-sm font-bold text-red-500">
                {order.restaurant.name.charAt(0).toUpperCase()}
              </span>
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-800">{order.restaurant.name}</p>
              {order.restaurant.address && (
                <p className="text-xs text-gray-500">{order.restaurant.address}</p>
              )}
            </div>
          </div>
        </div>

        {/* Articles */}
        <div className="divide-y divide-gray-50">
          {parsedItems.map((item, idx) => (
            <div key={`${item.menuItemId}-${idx}`} className="flex items-center justify-between px-4 py-2.5">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <span className="w-6 h-6 bg-gray-100 rounded-md flex items-center justify-center text-xs font-bold text-gray-500 flex-shrink-0">
                  {item.quantity}x
                </span>
                <span className="text-sm text-gray-800 truncate">{item.name}</span>
              </div>
              <span className="text-sm font-medium text-gray-700 flex-shrink-0 ml-2">
                {formatPrice(item.total)}
              </span>
            </div>
          ))}
        </div>

        {/* Totaux */}
        <div className="px-4 py-3 bg-gray-50/50 space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-500">Sous-total</span>
            <span className="text-gray-700">{formatPrice(order.subtotal)}</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-500">Livraison</span>
            <span className="text-gray-700">{formatPrice(order.deliveryFee)}</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-500">Service</span>
            <span className="text-gray-700">{formatPrice(order.serviceFee)}</span>
          </div>
          <div className="border-t border-gray-200 pt-1.5 mt-1.5">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-gray-800">Total</span>
              <span className="text-sm font-extrabold text-red-600">{formatPrice(order.totalAmount)}</span>
            </div>
          </div>
        </div>
      </section>

      {/* ===== ADRESSE DE LIVRAISON ===== */}
      <section className="mx-4 mt-4 bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
        <div className="flex items-center gap-2 mb-2">
          <MapPin className="w-4 h-4 text-red-500" />
          <h3 className="text-sm font-bold text-gray-700">Adresse de livraison</h3>
        </div>
        <p className="text-sm text-gray-600">{order.deliveryAddress}</p>
        {order.deliveryZone && (
          <p className="text-xs text-gray-400 mt-1">Zone : {order.deliveryZone}</p>
        )}
      </section>

      {/* ===== NOTE CLIENT ===== */}
      {order.customerNote && (
        <section className="mx-4 mt-4 bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <div className="flex items-center gap-2 mb-2">
            <MessageCircle className="w-4 h-4 text-red-500" />
            <h3 className="text-sm font-bold text-gray-700">Votre note</h3>
          </div>
          <p className="text-sm text-gray-600 italic">{order.customerNote}</p>
        </section>
      )}

      {/* ===== METHODE DE PAIEMENT ===== */}
      <section className="mx-4 mt-4 bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-gray-700">Paiement</span>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                order.paymentStatus === 'completed'
                  ? 'bg-green-100 text-green-700'
                  : 'bg-amber-100 text-amber-700'
              }`}
            >
              {order.paymentStatus === 'completed'
                ? 'Paye'
                : order.paymentStatus === 'pending'
                  ? 'En attente'
                  : order.paymentStatus === 'cancelled'
                    ? 'Annule'
                    : order.paymentStatus}
            </span>
          </div>
          <span className="text-xs text-gray-500 font-medium">
            {order.paymentMethod === 'cash'
              ? 'Cash'
              : order.paymentMethod === 'wallet'
                ? 'Wallet'
                : order.paymentMethod === 'orange_money'
                  ? 'Orange Money'
                  : order.paymentMethod === 'mtn_momo'
                    ? 'MTN MoMo'
                    : order.paymentMethod === 'card'
                      ? 'Carte'
                      : order.paymentMethod}
          </span>
        </div>
        {order.payments && order.payments.length > 0 && (
          <p className="text-[10px] text-gray-400 mt-1">
            Ref : {order.payments[0].reference || order.payments[0].id}
          </p>
        )}
      </section>

      {/* ===== ACTIONS ===== */}
      <section className="mx-4 mt-4 space-y-2">
        {!isTerminalStatus(order.status) && (
          <button
            onClick={() => setCurrentView('incidents')}
            className="flex items-center justify-center gap-2 w-full py-3 bg-white border border-red-200 text-red-600 rounded-2xl text-sm font-semibold active:scale-[0.98] transition-transform"
          >
            <AlertTriangle className="w-4 h-4" />
            Signaler un probleme
          </button>
        )}

        <button
          onClick={() => setCurrentView('food')}
          className="flex items-center justify-center gap-2 w-full py-3 bg-gray-100 text-gray-700 rounded-2xl text-sm font-semibold active:scale-[0.98] transition-transform"
        >
          <ArrowLeft className="w-4 h-4" />
          Retour aux restaurants
        </button>
      </section>

      {/* ===== INDICATEUR DE RAFRAICHISSEMENT ===== */}
      {!isTerminalStatus(order.status) && (
        <div className="mx-4 mt-4 flex items-center justify-center gap-2">
          <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
          <p className="text-xs text-gray-400">
            Actualisation automatique toutes les 15 secondes
          </p>
        </div>
      )}
    </div>
  )
}
