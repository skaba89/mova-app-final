'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { useMovaStore } from '@/lib/store'
import { apiFetch } from '@/lib/api'
import {
  ArrowLeft,
  Plus,
  Minus,
  Trash2,
  MapPin,
  CreditCard,
  Wallet,
  Smartphone,
  MessageSquare,
  ShoppingBag,
  Loader2,
  CheckCircle,
  AlertCircle,
  ChevronRight,
  Banknote,
  Receipt,
} from 'lucide-react'
import type { FoodCartItem } from '@/lib/store'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CreateOrderPayload {
  restaurantId: string
  items: { menuItemId: string; quantity: number }[]
  deliveryAddress: string
  deliveryLat: number
  deliveryLng: number
  deliveryZone?: string
  customerNote?: string
  paymentMethod: 'cash' | 'card' | 'wallet' | 'orange_money' | 'mtn_momo' | 'wave'
}

interface OrderResponse {
  success: boolean
  data?: {
    order: {
      id: string
      status: string
      totalAmount: number
    }
  }
  error?: string
}

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------

const PAYMENT_METHODS = [
  {
    id: 'cash' as const,
    label: 'Cash',
    description: 'Paiement a la livraison',
    icon: Banknote,
    color: 'text-green-600',
    bgColor: 'bg-green-50',
  },
  {
    id: 'wallet' as const,
    label: 'Wallet MOVA',
    description: 'Solde du portefeuille',
    icon: Wallet,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
  },
  {
    id: 'orange_money' as const,
    label: 'Orange Money',
    description: 'Paiement mobile Orange',
    icon: Smartphone,
    color: 'text-orange-600',
    bgColor: 'bg-orange-50',
  },
  {
    id: 'mtn_momo' as const,
    label: 'MTN MoMo',
    description: 'Paiement mobile MTN',
    icon: Smartphone,
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-50',
  },
]

type PaymentMethodId = (typeof PAYMENT_METHODS)[number]['id']

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatPrice(amount: number): string {
  return new Intl.NumberFormat('fr-FR').format(amount) + ' GNF'
}

function getMovaWindow(key: string): string | undefined {
  if (typeof window === 'undefined') return undefined
  return (window as unknown as Record<string, string>)[key]
}

// ---------------------------------------------------------------------------
// Composant principal
// ---------------------------------------------------------------------------

export function FoodCartView() {
  const {
    setCurrentView,
    user,
    foodCart,
    addToCart,
    removeFromCart,
    updateCartQuantity,
    clearCart,
    cartTotal,
  } = useMovaStore()

  // -- Etats locaux --
  const [deliveryAddress, setDeliveryAddress] = useState('')
  const [customerNote, setCustomerNote] = useState('')
  const [selectedPayment, setSelectedPayment] = useState<PaymentMethodId>('cash')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [orderSuccess, setOrderSuccess] = useState(false)

  // -- Identifiants --
  const restaurantId = useMemo(() => getMovaWindow('__mova_restaurant_id') || '', [])
  const restaurantName = useMemo(
    () => getMovaWindow('__mova_restaurant_name') || foodCart[0]?.restaurantName || 'Restaurant',
    [foodCart]
  )

  // -- Auto-remplissage de l'adresse --
  useEffect(() => {
    // Essayer d'utiliser la localisation sauvegardee dans le store ou localStorage
    const savedAddress = user?.phone // Pas d'adresse dans le user, on essaie localStorage
    if (savedAddress && !deliveryAddress) {
      // Pas d'adresse dans le profil utilisateur par defaut
    }

    // Essayer de recuperer la derniere adresse utilisee
    const lastAddr = typeof window !== 'undefined' ? localStorage.getItem('mova_last_address') : null
    if (lastAddr && !deliveryAddress) {
      setDeliveryAddress(lastAddr)
    }
  }, [user, deliveryAddress])

  // -- Calculs financiers --
  const subtotal = useMemo(() => cartTotal(), [foodCart])
  const deliveryFee = useMemo(() => {
    // Le frais de livraison reel sera calcule par le backend
    // Ici on affiche une estimation : 2000 GNF par defaut
    return 2000
  }, [])
  const serviceFeePercent = 0.05
  const serviceFee = useMemo(() => Math.round(subtotal * serviceFeePercent), [subtotal])
  const total = subtotal + deliveryFee + serviceFee

  // -- Nombre total d'articles --
  const totalItems = useMemo(
    () => foodCart.reduce((sum, item) => sum + item.quantity, 0),
    [foodCart]
  )

  // -- Validation --
  const canSubmit = useMemo(() => {
    return (
      foodCart.length > 0 &&
      deliveryAddress.trim().length >= 5 &&
      !isSubmitting
    )
  }, [foodCart, deliveryAddress, isSubmitting])

  // -- Soumettre la commande (hook avant tout return conditionnel) --
  const handleSubmit = useCallback(async () => {
    if (!canSubmit) return

    setIsSubmitting(true)
    setSubmitError(null)

    try {
      const payload: CreateOrderPayload = {
        restaurantId,
        items: foodCart.map((item) => ({
          menuItemId: item.id,
          quantity: item.quantity,
        })),
        deliveryAddress: deliveryAddress.trim(),
        deliveryLat: 9.5092,
        deliveryLng: -13.7122,
        deliveryZone: getMovaWindow('__mova_zone') || undefined,
        customerNote: customerNote.trim() || undefined,
        paymentMethod: selectedPayment,
      }

      const res = await apiFetch('/api/mova/food', {
        method: 'POST',
        body: JSON.stringify(payload),
      })

      const json: OrderResponse = await res.json()

      if (json.success && json.data?.order) {
        if (typeof window !== 'undefined') {
          ;(window as unknown as Record<string, string>).__mova_order_id = json.data.order.id
        }
        if (typeof window !== 'undefined') {
          localStorage.setItem('mova_last_address', deliveryAddress.trim())
        }
        clearCart()
        setOrderSuccess(true)
      } else {
        setSubmitError(json.error || 'Erreur lors de la commande. Veuillez reessayer.')
      }
    } catch (err) {
      console.error('[FOODCART] Erreur de commande:', err)
      setSubmitError('Erreur de connexion au serveur. Veuillez verifier votre connexion.')
    } finally {
      setIsSubmitting(false)
    }
  }, [canSubmit, restaurantId, foodCart, deliveryAddress, customerNote, selectedPayment, clearCart])

  // -- Retour panier vide --
  if (foodCart.length === 0 && !orderSuccess) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">
        <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-4">
          <ShoppingBag className="w-10 h-10 text-gray-300" />
        </div>
        <h2 className="text-xl font-bold text-gray-700 mb-2">Votre panier est vide</h2>
        <p className="text-sm text-gray-500 text-center mb-6 max-w-xs">
          Vous n&apos;avez pas encore ajoute d&apos;articles a votre panier. Parcourez les
          restaurants pour trouver votre prochain repas.
        </p>
        <button
          onClick={() => setCurrentView('food')}
          className="flex items-center gap-2 px-6 py-3 bg-red-600 text-white rounded-xl font-semibold active:scale-95 transition-transform"
        >
          <ArrowLeft className="w-4 h-4" />
          Voir les restaurants
        </button>
      </div>
    )
  }

  // -- Succes de commande --
  if (orderSuccess) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-4">
          <CheckCircle className="w-10 h-10 text-green-500" />
        </div>
        <h2 className="text-xl font-bold text-gray-700 mb-2">Commande confirmee !</h2>
        <p className="text-sm text-gray-500 text-center mb-6 max-w-xs">
          Votre commande a ete transmise au restaurant. Vous pouvez suivre son avancement en
          temps reel.
        </p>
        <button
          onClick={() => setCurrentView('foodtracking')}
          className="flex items-center gap-2 px-6 py-3 bg-red-600 text-white rounded-xl font-semibold active:scale-95 transition-transform"
        >
          <Receipt className="w-4 h-4" />
          Suivre ma commande
        </button>
      </div>
    )
  }

  // -- Soumettre la commande --
  // (handleSubmit est defini plus haut, avant les returns conditionnels)

  // -- Rendu principal --
  return (
    <div className="min-h-screen bg-gray-50 pb-6">
      {/* ===== EN-TETE ===== */}
      <header className="bg-gradient-to-br from-red-600 to-red-700 text-white px-4 pt-5 pb-5 rounded-b-3xl shadow-lg">
        <div className="flex items-center justify-between mb-3">
          <button
            onClick={() => setCurrentView('restaurant')}
            className="flex items-center gap-2 px-3 py-2 bg-white/10 rounded-xl active:scale-95 transition-transform"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm font-medium">Retour</span>
          </button>
          <h1 className="text-lg font-extrabold">Votre panier</h1>
          <div className="w-20" /> {/* Spacer pour centrer le titre */}
        </div>

        {/* Nom du restaurant */}
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
            <span className="text-sm font-bold">{restaurantName.charAt(0).toUpperCase()}</span>
          </div>
          <div>
            <p className="text-sm font-semibold">{restaurantName}</p>
            <p className="text-red-200 text-xs">{totalItems} article{totalItems !== 1 ? 's' : ''} dans le panier</p>
          </div>
        </div>
      </header>

      {/* ===== CONTENU ===== */}
      <div className="px-4 mt-4 space-y-4">
        {/* --- Liste des articles --- */}
        <section className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-50">
            <h2 className="text-sm font-bold text-gray-700">Articles ({totalItems})</h2>
          </div>
          <div className="divide-y divide-gray-50">
            {foodCart.map((item) => (
              <Cart_item_row
                key={item.id}
                item={item}
                onIncrease={() => updateCartQuantity(item.id, item.quantity + 1)}
                onDecrease={() => updateCartQuantity(item.id, item.quantity - 1)}
                onRemove={() => removeFromCart(item.id)}
              />
            ))}
          </div>
        </section>

        {/* --- Adresse de livraison --- */}
        <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <div className="flex items-center gap-2 mb-3">
            <MapPin className="w-4 h-4 text-red-500" />
            <h2 className="text-sm font-bold text-gray-700">Adresse de livraison</h2>
          </div>
          <textarea
            value={deliveryAddress}
            onChange={(e) => setDeliveryAddress(e.target.value)}
            placeholder="Entrez votre adresse de livraison..."
            rows={2}
            className="w-full px-3 py-2.5 bg-gray-50 rounded-xl text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-200 focus:bg-white transition-all resize-none"
          />
          <p className="text-[10px] text-gray-400 mt-1">
            Soyez precis pour une livraison rapide
          </p>
        </section>

        {/* --- Methode de paiement --- */}
        <section className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-50">
            <div className="flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-red-500" />
              <h2 className="text-sm font-bold text-gray-700">Methode de paiement</h2>
            </div>
          </div>
          <div className="divide-y divide-gray-50">
            {PAYMENT_METHODS.map((method) => {
              const Icon = method.icon
              const isSelected = selectedPayment === method.id

              return (
                <button
                  key={method.id}
                  onClick={() => setSelectedPayment(method.id)}
                  className={`flex items-center gap-3 w-full px-4 py-3 text-left transition-colors ${
                    isSelected ? 'bg-red-50' : 'hover:bg-gray-50'
                  }`}
                >
                  <div className={`w-10 h-10 rounded-xl ${method.bgColor} flex items-center justify-center`}>
                    <Icon className={`w-5 h-5 ${method.color}`} />
                  </div>
                  <div className="flex-1">
                    <p className={`text-sm font-semibold ${isSelected ? 'text-red-700' : 'text-gray-800'}`}>
                      {method.label}
                    </p>
                    <p className="text-xs text-gray-500">{method.description}</p>
                  </div>
                  <div
                    className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                      isSelected ? 'border-red-600 bg-red-600' : 'border-gray-300'
                    }`}
                  >
                    {isSelected && <CheckCircle className="w-3 h-3 text-white" />}
                  </div>
                </button>
              )
            })}
          </div>
        </section>

        {/* --- Note client --- */}
        <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <div className="flex items-center gap-2 mb-3">
            <MessageSquare className="w-4 h-4 text-red-500" />
            <h2 className="text-sm font-bold text-gray-700">Note pour le restaurant</h2>
          </div>
          <textarea
            value={customerNote}
            onChange={(e) => setCustomerNote(e.target.value)}
            placeholder="Allergies, preferences, instructions speciales..."
            rows={3}
            maxLength={500}
            className="w-full px-3 py-2.5 bg-gray-50 rounded-xl text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-200 focus:bg-white transition-all resize-none"
          />
          <p className="text-[10px] text-gray-400 mt-1 text-right">
            {customerNote.length}/500
          </p>
        </section>

        {/* --- Recapitulatif --- */}
        <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <h2 className="text-sm font-bold text-gray-700 mb-3">Recapitulatif</h2>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">Sous-total</span>
              <span className="font-medium text-gray-800">{formatPrice(subtotal)}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">Frais de livraison</span>
              <span className="font-medium text-gray-800">{formatPrice(deliveryFee)}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">Frais de service (5%)</span>
              <span className="font-medium text-gray-800">{formatPrice(serviceFee)}</span>
            </div>
            <div className="border-t border-gray-100 pt-2 mt-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-gray-800">Total</span>
                <span className="text-base font-extrabold text-red-600">{formatPrice(total)}</span>
              </div>
            </div>
          </div>
        </section>

        {/* --- Erreur de soumission --- */}
        {submitError && (
          <div className="flex items-start gap-2 p-4 bg-red-50 border border-red-200 rounded-2xl">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-700">{submitError}</p>
          </div>
        )}

        {/* --- Bouton passer la commande --- */}
        <button
          onClick={handleSubmit}
          disabled={!canSubmit || isSubmitting}
          className={`flex items-center justify-center gap-2 w-full py-4 rounded-2xl text-base font-bold transition-all ${
            canSubmit && !isSubmitting
              ? 'bg-red-600 text-white active:scale-[0.98] shadow-lg'
              : 'bg-gray-200 text-gray-400 cursor-not-allowed'
          }`}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Commande en cours...
            </>
          ) : (
            <>
              <CreditCard className="w-5 h-5" />
              Passer la commande - {formatPrice(total)}
            </>
          )}
        </button>

        {!canSubmit && foodCart.length > 0 && deliveryAddress.trim().length < 5 && (
          <p className="text-xs text-center text-amber-600">
            Veuillez entrer une adresse de livraison valide (minimum 5 caracteres)
          </p>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// CartItemRow
// ---------------------------------------------------------------------------

function Cart_item_row({
  item,
  onIncrease,
  onDecrease,
  onRemove,
}: {
  item: FoodCartItem
  onIncrease: () => void
  onDecrease: () => void
  onRemove: () => void
}) {
  const lineTotal = item.price * item.quantity

  return (
    <div className="flex items-center gap-3 px-4 py-3">
      {/* Placeholder image */}
      <div className="w-14 h-14 bg-red-100 rounded-xl flex items-center justify-center flex-shrink-0">
        <span className="text-lg font-bold text-red-400">
          {item.name.charAt(0).toUpperCase()}
        </span>
      </div>

      {/* Infos article */}
      <div className="flex-1 min-w-0">
        <h3 className="text-sm font-semibold text-gray-800 truncate">{item.name}</h3>
        <p className="text-xs text-gray-500 mt-0.5">{formatPrice(item.price)} / piece</p>

        {/* Controles quantite */}
        <div className="flex items-center gap-2 mt-2">
          <button
            onClick={onDecrease}
            className="w-6 h-6 rounded-md bg-gray-100 text-gray-600 flex items-center justify-center active:scale-90 transition-transform"
          >
            <Minus className="w-3 h-3" />
          </button>
          <span className="w-6 text-center text-sm font-bold text-gray-800">
            {item.quantity}
          </span>
          <button
            onClick={onIncrease}
            className="w-6 h-6 rounded-md bg-red-600 text-white flex items-center justify-center active:scale-90 transition-transform"
          >
            <Plus className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Total ligne + suppression */}
      <div className="flex flex-col items-end gap-2">
        <span className="text-sm font-bold text-gray-800">{formatPrice(lineTotal)}</span>
        <button
          onClick={onRemove}
          className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
          aria-label="Supprimer l'article"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  )
}
