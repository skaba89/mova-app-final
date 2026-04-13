'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useMovaStore } from '@/lib/store'
import {
  ArrowLeft,
  Star,
  Clock,
  Truck,
  MapPin,
  Phone,
  Plus,
  Minus,
  ShoppingBag,
  Loader2,
  Flame,
  UtensilsCrossed,
  ChevronDown,
  ChevronUp,
  Check,
} from 'lucide-react'
import type { FoodCartItem } from '@/lib/store'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface MenuItemData {
  id: string
  name: string
  description: string | null
  price: number | null
  imageUrl: string | null
  isPopular: boolean
  preparationTime: number | null
  calories: number | null
}

interface MenuCategory {
  category: string
  items: MenuItemData[]
}

interface RestaurantData {
  id: string
  name: string
  description: string | null
  address: string | null
  lat: number | null
  lng: number | null
  zone: string | null
  phone: string | null
  email: string | null
  imageUrl: string | null
  logoUrl: string | null
  isOpen: boolean
  rating: number | null
  deliveryFee: number | null
  minOrderAmount: number | null
  estimatedDeliveryTime: number | null
  operatingHours: unknown
  menu: MenuCategory[]
}

interface RestaurantResponse {
  success: boolean
  data: {
    restaurant: RestaurantData
  }
}

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------

const MENU_COLORS = [
  'bg-red-400',
  'bg-orange-400',
  'bg-amber-400',
  'bg-emerald-400',
  'bg-teal-400',
  'bg-cyan-400',
  'bg-blue-400',
  'bg-indigo-400',
  'bg-violet-400',
  'bg-pink-400',
  'bg-rose-400',
  'bg-fuchsia-400',
]

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatPrice(amount: number | null | undefined): string {
  if (amount == null) return '---'
  return new Intl.NumberFormat('fr-FR').format(amount) + ' GNF'
}

function getMenuItemColor(id: string): string {
  let hash = 0
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash)
  }
  return MENU_COLORS[Math.abs(hash) % MENU_COLORS.length]
}

function getMovaWindow(key: string): string | undefined {
  if (typeof window === 'undefined') return undefined
  return (window as unknown as Record<string, string>)[key]
}

// ---------------------------------------------------------------------------
// Composant principal
// ---------------------------------------------------------------------------

export function RestaurantView() {
  const {
    setCurrentView,
    foodCart,
    addToCart,
    removeFromCart,
    updateCartQuantity,
    cartTotal,
  } = useMovaStore()

  // -- Etats --
  const [restaurant, setRestaurant] = useState<RestaurantData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set())
  const [addedToast, setAddedToast] = useState<string | null>(null)

  // -- Recuperer l'ID du restaurant --
  const restaurantId = useMemo(() => getMovaWindow('__mova_restaurant_id'), [])

  // -- Chargement du restaurant --
  const fetchRestaurant = useCallback(async () => {
    if (!restaurantId) {
      setError('Identifiant du restaurant manquant.')
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const token =
        typeof window !== 'undefined' ? localStorage.getItem('mova_token') : null
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (token) {
        headers['Authorization'] = `Bearer ${token}`
      }

      const res = await fetch(`/api/mova/food/restaurants/${restaurantId}`, { headers })

      if (!res.ok) {
        if (res.status === 404) {
          throw new Error('Restaurant introuvable ou desactive.')
        }
        throw new Error(`Erreur ${res.status}: ${res.statusText}`)
      }

      const json: RestaurantResponse = await res.json()

      if (json.success && json.data?.restaurant) {
        setRestaurant(json.data.restaurant)
        // Developper toutes les categories par defaut
        const cats = new Set(json.data.restaurant.menu.map((m) => m.category))
        setExpandedCategories(cats)
      } else {
        setError('Impossible de charger le restaurant.')
      }
    } catch (err) {
      console.error('[RESTAURANT-VIEW] Erreur:', err)
      setError(err instanceof Error ? err.message : 'Erreur de connexion au serveur.')
    } finally {
      setLoading(false)
    }
  }, [restaurantId])

  useEffect(() => {
    fetchRestaurant()
  }, [fetchRestaurant])

  // -- Panier: articles de ce restaurant uniquement --
  const cartItemsForRestaurant = useMemo(
    () => foodCart.filter((item) => item.restaurantId === restaurantId),
    [foodCart, restaurantId]
  )

  const cartItemCount = cartItemsForRestaurant.reduce((sum, item) => sum + item.quantity, 0)
  const restaurantName = restaurant?.name || getMovaWindow('__mova_restaurant_name') || 'Restaurant'

  // -- Ajouter au panier --
  const handleAddToCart = (item: MenuItemData) => {
    if (item.price == null) return

    addToCart({
      id: item.id,
      name: item.name,
      price: item.price,
      restaurantId: restaurantId || '',
      restaurantName: restaurantName,
    })

    // Feedback visuel
    setAddedToast(item.id)
    setTimeout(() => setAddedToast(null), 1200)
  }

  // -- Quantite d'un article dans le panier --
  const getItemQuantity = (menuItemId: string): number => {
    const found = foodCart.find((item) => item.id === menuItemId)
    return found?.quantity || 0
  }

  // -- Toggle categorie --
  const toggleCategory = (category: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev)
      if (next.has(category)) {
        next.delete(category)
      } else {
        next.add(category)
      }
      return next
    })
  }

  // -- Sommaire rapide du menu --
  const totalMenuItems = restaurant?.menu.reduce((sum, cat) => sum + cat.items.length, 0) || 0

  // -- Retour loading --
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="bg-red-600 px-4 pt-5 pb-8 rounded-b-3xl">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-8 h-8 bg-white/20 rounded-xl animate-pulse" />
            <div className="h-5 bg-white/20 rounded w-40 animate-pulse" />
          </div>
          <div className="space-y-3">
            <div className="h-6 bg-white/20 rounded w-3/4 animate-pulse" />
            <div className="h-4 bg-white/20 rounded w-1/2 animate-pulse" />
            <div className="flex gap-4 mt-4">
              <div className="h-4 bg-white/20 rounded w-20 animate-pulse" />
              <div className="h-4 bg-white/20 rounded w-24 animate-pulse" />
              <div className="h-4 bg-white/20 rounded w-16 animate-pulse" />
            </div>
          </div>
        </div>
        <div className="px-4 mt-6 space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="h-5 bg-gray-200 rounded w-32 mb-3" />
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, j) => (
                  <div key={j} className="flex gap-3 bg-white rounded-xl p-3">
                    <div className="w-16 h-16 bg-gray-200 rounded-lg flex-shrink-0" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-gray-200 rounded w-3/4" />
                      <div className="h-3 bg-gray-100 rounded w-full" />
                      <div className="h-4 bg-gray-200 rounded w-24" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  // -- Retour erreur --
  if (error || !restaurant) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
          <UtensilsCrossed className="w-8 h-8 text-red-400" />
        </div>
        <h3 className="text-lg font-bold text-gray-700 mb-2">Restaurant indisponible</h3>
        <p className="text-sm text-gray-500 text-center mb-6">{error || 'Donnees manquantes.'}</p>
        <button
          onClick={() => setCurrentView('food')}
          className="flex items-center gap-2 px-5 py-2.5 bg-red-600 text-white rounded-xl text-sm font-semibold active:scale-95 transition-transform"
        >
          <ArrowLeft className="w-4 h-4" />
          Retour aux restaurants
        </button>
      </div>
    )
  }

  // -- Rendu principal --
  return (
    <div className="min-h-screen bg-gray-50 pb-28">
      {/* ===== EN-TETE DU RESTAURANT ===== */}
      <header className="bg-gradient-to-br from-red-600 to-red-700 text-white px-4 pt-5 pb-6 rounded-b-3xl shadow-lg relative">
        {/* Bouton retour */}
        <div className="flex items-center justify-between mb-5">
          <button
            onClick={() => setCurrentView('food')}
            className="flex items-center gap-2 px-3 py-2 bg-white/10 rounded-xl active:scale-95 transition-transform"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm font-medium">Retour</span>
          </button>

          {/* Badge ouvert/ferme */}
          <span
            className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide ${
              restaurant.isOpen
                ? 'bg-green-500 text-white'
                : 'bg-gray-800/70 text-white'
            }`}
          >
            {restaurant.isOpen ? 'Ouvert' : 'Ferme'}
          </span>
        </div>

        {/* Nom et description */}
        <h1 className="text-2xl font-extrabold mb-1 leading-tight">{restaurant.name}</h1>
        {restaurant.description && (
          <p className="text-red-100 text-sm leading-relaxed line-clamp-2">{restaurant.description}</p>
        )}

        {/* Infos rapides */}
        <div className="flex flex-wrap items-center gap-4 mt-4 text-sm text-red-100">
          {/* Notation */}
          <div className="flex items-center gap-1">
            <Star className="w-4 h-4 text-amber-300 fill-amber-300" />
            <span className="font-semibold text-white">
              {restaurant.rating != null ? restaurant.rating.toFixed(1) : '--'}
            </span>
          </div>

          {/* Temps de livraison */}
          {restaurant.estimatedDeliveryTime && (
            <div className="flex items-center gap-1">
              <Clock className="w-4 h-4" />
              <span>{restaurant.estimatedDeliveryTime} min</span>
            </div>
          )}

          {/* Frais de livraison */}
          <div className="flex items-center gap-1">
            <Truck className="w-4 h-4" />
            <span>{formatPrice(restaurant.deliveryFee)}</span>
          </div>

          {/* Zone */}
          {restaurant.zone && (
            <div className="flex items-center gap-1">
              <MapPin className="w-4 h-4" />
              <span>{restaurant.zone}</span>
            </div>
          )}
        </div>

        {/* Commande minimum */}
        {restaurant.minOrderAmount != null && restaurant.minOrderAmount > 0 && (
          <p className="text-red-200 text-xs mt-2">
            Commande minimum : {formatPrice(restaurant.minOrderAmount)}
          </p>
        )}

        {/* Telephone */}
        {restaurant.phone && (
          <a
            href={`tel:${restaurant.phone}`}
            className="inline-flex items-center gap-1.5 mt-3 px-3 py-1.5 bg-white/10 rounded-lg text-xs font-medium active:bg-white/20 transition-colors"
          >
            <Phone className="w-3.5 h-3.5" />
            {restaurant.phone}
          </a>
        )}
      </header>

      {/* ===== COMPTEUR DE PLATS ===== */}
      <div className="px-4 mt-4">
        <p className="text-sm text-gray-500">
          {totalMenuItems} plat{totalMenuItems !== 1 ? 's' : ''} disponible{totalMenuItems !== 1 ? 's' : ''}
        </p>
      </div>

      {/* ===== SECTIONS DU MENU ===== */}
      <div className="px-4 mt-3 space-y-4">
        {restaurant.menu.map((menuCategory) => {
          const isExpanded = expandedCategories.has(menuCategory.category)

          return (
            <div key={menuCategory.category} className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
              {/* En-tete de categorie */}
              <button
                onClick={() => toggleCategory(menuCategory.category)}
                className="flex items-center justify-between w-full px-4 py-3.5 active:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <div className="w-1 h-5 bg-red-500 rounded-full" />
                  <h2 className="text-base font-bold text-gray-800">{menuCategory.category}</h2>
                  <span className="text-xs text-gray-400 font-medium">
                    ({menuCategory.items.length})
                  </span>
                </div>
                {isExpanded ? (
                  <ChevronUp className="w-4 h-4 text-gray-400" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-gray-400" />
                )}
              </button>

              {/* Liste des articles */}
              {isExpanded && (
                <div className="divide-y divide-gray-50">
                  {menuCategory.items.map((item) => (
                    <MenuItemCard
                      key={item.id}
                      item={item}
                      quantity={getItemQuantity(item.id)}
                      onAdd={() => handleAddToCart(item)}
                      onIncrease={() => updateCartQuantity(item.id, getItemQuantity(item.id) + 1)}
                      onDecrease={() => updateCartQuantity(item.id, getItemQuantity(item.id) - 1)}
                      isJustAdded={addedToast === item.id}
                    />
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* ===== BARRE FLOTTANTE PANIER ===== */}
      {cartItemCount > 0 && (
        <div className="fixed bottom-4 left-4 right-4 z-40">
          <button
            onClick={() => setCurrentView('foodcart')}
            className="flex items-center justify-between w-full px-5 py-3.5 bg-red-600 text-white rounded-2xl shadow-xl active:scale-[0.98] transition-transform"
          >
            <div className="flex items-center gap-3">
              <div className="relative">
                <ShoppingBag className="w-5 h-5" />
                <span className="absolute -top-2 -right-2 w-4 h-4 bg-amber-400 text-red-700 text-[10px] font-bold rounded-full flex items-center justify-center">
                  {cartItemCount}
                </span>
              </div>
              <span className="font-semibold text-sm">Voir le panier</span>
            </div>
            <span className="font-bold text-sm">{formatPrice(cartTotal())}</span>
          </button>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// MenuItemCard
// ---------------------------------------------------------------------------

function MenuItemCard({
  item,
  quantity,
  onAdd,
  onIncrease,
  onDecrease,
  isJustAdded,
}: {
  item: MenuItemData
  quantity: number
  onAdd: () => void
  onIncrease: () => void
  onDecrease: () => void
  isJustAdded: boolean
}) {
  const bgColor = getMenuItemColor(item.id)
  const initial = item.name.charAt(0).toUpperCase()

  return (
    <div className="flex gap-3 p-3 relative">
      {/* Placeholder image */}
      <div
        className={`w-20 h-20 ${bgColor} rounded-xl flex items-center justify-center flex-shrink-0`}
      >
        <span className="text-2xl font-bold text-white/90">{initial}</span>
      </div>

      {/* Contenu */}
      <div className="flex-1 min-w-0 flex flex-col justify-between">
        <div>
          {/* Nom avec badge populaire */}
          <div className="flex items-start gap-1.5">
            <h3 className="text-sm font-bold text-gray-800 leading-tight truncate flex-1">
              {item.name}
            </h3>
            {item.isPopular && (
              <span className="flex items-center gap-0.5 px-1.5 py-0.5 bg-orange-100 text-orange-600 rounded text-[10px] font-bold flex-shrink-0">
                <Flame className="w-2.5 h-2.5" />
                Populaire
              </span>
            )}
          </div>

          {/* Description */}
          {item.description && (
            <p className="text-xs text-gray-500 mt-0.5 line-clamp-2 leading-tight">
              {item.description}
            </p>
          )}
        </div>

        {/* Prix + temps + bouton */}
        <div className="flex items-center justify-between mt-1.5">
          <div className="flex flex-col">
            <span className="text-sm font-bold text-red-600">{formatPrice(item.price)}</span>
            {item.preparationTime && (
              <span className="flex items-center gap-0.5 text-[10px] text-gray-400 mt-0.5">
                <Clock className="w-2.5 h-2.5" />
                {item.preparationTime} min
              </span>
            )}
          </div>

          {/* Controle quantite ou bouton ajouter */}
          {quantity === 0 ? (
            <button
              onClick={onAdd}
              className="flex items-center gap-1 px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs font-semibold active:scale-95 transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              Ajouter
            </button>
          ) : (
            <div className="flex items-center gap-1">
              <button
                onClick={onDecrease}
                className="w-7 h-7 rounded-lg bg-red-50 text-red-600 flex items-center justify-center active:scale-90 transition-transform"
              >
                {quantity === 1 ? (
                  <Minus className="w-3 h-3" />
                ) : (
                  <Minus className="w-3 h-3" />
                )}
              </button>
              <span className="w-7 text-center text-sm font-bold text-gray-800">{quantity}</span>
              <button
                onClick={onIncrease}
                className="w-7 h-7 rounded-lg bg-red-600 text-white flex items-center justify-center active:scale-90 transition-transform"
              >
                <Plus className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Feedback visuel d'ajout */}
      {isJustAdded && (
        <div className="absolute inset-0 bg-green-50/80 rounded-xl flex items-center justify-center pointer-events-none animate-pulse">
          <Check className="w-8 h-8 text-green-500" />
        </div>
      )}
    </div>
  )
}
