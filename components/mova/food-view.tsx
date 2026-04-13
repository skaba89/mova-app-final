'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useMovaStore } from '@/lib/store'
import {
  Search,
  MapPin,
  Star,
  Clock,
  Truck,
  ChevronDown,
  ArrowLeft,
  UtensilsCrossed,
  Filter,
  ShoppingBag,
  Loader2,
  X,
} from 'lucide-react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Restaurant {
  id: string
  name: string
  description: string | null
  address: string | null
  lat: number | null
  lng: number | null
  zone: string | null
  phone: string | null
  imageUrl: string | null
  logoUrl: string | null
  isOpen: boolean
  rating: number | null
  deliveryFee: number | null
  minOrderAmount: number | null
  estimatedDeliveryTime: number | null
}

interface RestaurantsResponse {
  success: boolean
  data: {
    restaurants: Restaurant[]
    pagination: {
      page: number
      limit: number
      total: number
      totalPages: number
    }
  }
}

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------

const CONAKRY_ZONES = [
  { value: '', label: 'Toutes les zones' },
  { value: 'Kaloum', label: 'Kaloum' },
  { value: 'Dixinn', label: 'Dixinn' },
  { value: 'Matam', label: 'Matam' },
  { value: 'Matoto', label: 'Matoto' },
  { value: 'Ratoma', label: 'Ratoma' },
]

const CATEGORY_TABS = [
  { id: 'all', label: 'Tous' },
  { id: 'fast-food', label: 'Fast-food' },
  { id: 'african', label: 'African' },
  { id: 'asiatique', label: 'Asiatique' },
  { id: 'boissons', label: 'Boissons' },
  { id: 'desserts', label: 'Desserts' },
] as const

type CategoryTab = (typeof CATEGORY_TABS)[number]['id']

// Couleurs de fond pour les placeholders d'images
const RESTAURANT_COLORS = [
  'bg-red-500',
  'bg-orange-500',
  'bg-amber-500',
  'bg-emerald-500',
  'bg-teal-500',
  'bg-cyan-500',
  'bg-blue-500',
  'bg-indigo-500',
  'bg-violet-500',
  'bg-pink-500',
  'bg-rose-500',
  'bg-fuchsia-500',
]

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Formater un prix en Francs Guineens */
function formatPrice(amount: number | null | undefined): string {
  if (amount == null) return '---'
  return new Intl.NumberFormat('fr-FR').format(amount) + ' GNF'
}

/** Obtenir la couleur de fond pour un restaurant (deterministe par id) */
function getRestaurantColor(id: string): string {
  let hash = 0
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash)
  }
  return RESTAURANT_COLORS[Math.abs(hash) % RESTAURANT_COLORS.length]
}

/** Rendu des etoiles de notation */
function RatingStars({ rating, size = 'sm' }: { rating: number | null; size?: 'sm' | 'md' }) {
  const stars = 5
  const filled = rating != null ? Math.round(rating * 2) / 2 : 0
  const starSize = size === 'sm' ? 'w-3 h-3' : 'w-4 h-4'

  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: stars }).map((_, i) => {
        const diff = filled - i
        let fillClass = 'text-gray-200'
        if (diff >= 1) fillClass = 'text-amber-400'
        else if (diff >= 0.5) fillClass = 'text-amber-300'

        return (
          <Star
            key={i}
            className={`${starSize} ${fillClass}`}
            fill={diff >= 0.5 ? 'currentColor' : 'none'}
          />
        )
      })}
      {rating != null && (
        <span className={`text-${size === 'sm' ? 'xs' : 'sm'} font-medium text-gray-600 ml-1`}>
          {rating.toFixed(1)}
        </span>
      )}
    </div>
  )
}

/** Skeleton de chargement */
function RestaurantCardSkeleton() {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden animate-pulse">
      <div className="h-32 bg-gray-200" />
      <div className="p-3 space-y-2">
        <div className="h-4 bg-gray-200 rounded w-3/4" />
        <div className="h-3 bg-gray-100 rounded w-full" />
        <div className="h-3 bg-gray-100 rounded w-1/2" />
        <div className="flex gap-2 mt-3">
          <div className="h-8 bg-gray-200 rounded-lg w-24" />
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Composant principal
// ---------------------------------------------------------------------------

export function FoodView() {
  const { setCurrentView, user } = useMovaStore()

  // -- Etats locaux --
  const [restaurants, setRestaurants] = useState<Restaurant[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedZone, setSelectedZone] = useState('')
  const [activeCategory, setActiveCategory] = useState<CategoryTab>('all')
  const [showZoneDropdown, setShowZoneDropdown] = useState(false)
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 })
  const [debouncedSearch, setDebouncedSearch] = useState('')

  // -- Recherche differee --
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery)
    }, 350)
    return () => clearTimeout(timer)
  }, [searchQuery])

  // -- Chargement des restaurants --
  const fetchRestaurants = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams()
      params.set('limit', '40')
      params.set('page', '1')
      params.set('sort', 'rating')

      // Zone
      if (selectedZone) {
        params.set('zone', selectedZone)
      }

      // Recherche combinant le texte de l'utilisateur et la categorie
      const searchParts: string[] = []
      if (debouncedSearch.trim()) {
        searchParts.push(debouncedSearch.trim())
      }
      if (activeCategory !== 'all') {
        // Mapper les categories vers des termes de recherche pertinents
        const categorySearchMap: Record<string, string> = {
          'fast-food': 'fast-food burger pizza poulet frite',
          'african': 'africain traditionnel guineen tolrone riz sauce',
          'asiatique': 'asiatique chinois tha vietnamien nouille wok',
          'boissons': 'boisson jus smoothie cocktail bissap gingembre',
          'desserts': 'dessert gateau patisserie glace sweet',
        }
        searchParts.push(categorySearchMap[activeCategory] || activeCategory)
      }

      if (searchParts.length > 0) {
        params.set('search', searchParts.join(' '))
      }

      const token = typeof window !== 'undefined' ? localStorage.getItem('mova_token') : null
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (token) {
        headers['Authorization'] = `Bearer ${token}`
      }

      const res = await fetch(`/api/mova/food/restaurants?${params.toString()}`, {
        headers,
      })

      if (!res.ok) {
        throw new Error(`Erreur ${res.status}: ${res.statusText}`)
      }

      const json: RestaurantsResponse = await res.json()

      if (json.success && json.data) {
        setRestaurants(json.data.restaurants)
        setPagination({
          page: json.data.pagination.page,
          totalPages: json.data.pagination.totalPages,
          total: json.data.pagination.total,
        })
      } else {
        setError('Impossible de charger les restaurants.')
      }
    } catch (err) {
      console.error('[FOOD-VIEW] Erreur de chargement:', err)
      setError(err instanceof Error ? err.message : 'Erreur de connexion au serveur.')
    } finally {
      setLoading(false)
    }
  }, [debouncedSearch, selectedZone, activeCategory])

  useEffect(() => {
    fetchRestaurants()
  }, [fetchRestaurants])

  // -- Filtrage client-side supplementaire --
  const filteredRestaurants = useMemo(() => {
    // Si on a deja fait une recherche via API, on filtre encore plus en local
    if (activeCategory === 'all' && !debouncedSearch) {
      return restaurants
    }
    return restaurants
  }, [restaurants, activeCategory, debouncedSearch])

  // -- Nombre total d'articles dans le panier --
  const cartItemCount = useMovaStore((s) =>
    s.foodCart.reduce((sum, item) => sum + item.quantity, 0)
  )

  // -- Handler: ouvrir un restaurant --
  const openRestaurant = (restaurant: Restaurant) => {
    if (typeof window !== 'undefined') {
      ;(window as unknown as Record<string, string>).__mova_restaurant_id = restaurant.id
      ;(window as unknown as Record<string, string>).__mova_restaurant_name = restaurant.name
    }
    setCurrentView('restaurant')
  }

  // -- Handler: ouvrir le panier --
  const openCart = () => {
    setCurrentView('foodcart')
  }

  // -- Zone selectionnee (label) --
  const selectedZoneLabel = CONAKRY_ZONES.find((z) => z.value === selectedZone)?.label || 'Toutes les zones'

  // -- Retour --
  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* ===== EN-TETE ===== */}
      <header className="bg-gradient-to-br from-red-600 to-red-700 text-white px-4 pt-5 pb-6 rounded-b-3xl shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => setCurrentView('hub')}
            className="p-2 -ml-2 rounded-xl bg-white/10 active:scale-95 transition-transform"
            aria-label="Retour a l'accueil"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-xl font-extrabold tracking-tight">MOVA Food</h1>
          <button
            onClick={openCart}
            className="relative p-2 -mr-2 rounded-xl bg-white/10 active:scale-95 transition-transform"
            aria-label="Ouvrir le panier"
          >
            <ShoppingBag className="w-5 h-5" />
            {cartItemCount > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-amber-400 text-red-700 text-xs font-bold rounded-full flex items-center justify-center">
                {cartItemCount > 9 ? '9+' : cartItemCount}
              </span>
            )}
          </button>
        </div>

        {/* Barre de recherche */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-red-200" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Rechercher un restaurant..."
            className="w-full pl-10 pr-10 py-3 bg-white/15 backdrop-blur-sm rounded-xl text-sm text-white placeholder-red-200 focus:outline-none focus:bg-white/25 transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded-full bg-white/20"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      </header>

      {/* ===== ZONE FILTER ===== */}
      <section className="px-4 mt-4">
        <div className="relative">
          <button
            onClick={() => setShowZoneDropdown(!showZoneDropdown)}
            className="flex items-center gap-2 w-full px-4 py-2.5 bg-white rounded-xl border border-gray-200 text-sm font-medium text-gray-700 active:scale-[0.98] transition-transform"
          >
            <MapPin className="w-4 h-4 text-red-500" />
            <span className="flex-1 text-left">{selectedZoneLabel}</span>
            <ChevronDown
              className={`w-4 h-4 text-gray-400 transition-transform ${showZoneDropdown ? 'rotate-180' : ''}`}
            />
          </button>

          {showZoneDropdown && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl border border-gray-200 shadow-lg z-30 overflow-hidden">
              {CONAKRY_ZONES.map((zone) => (
                <button
                  key={zone.value}
                  onClick={() => {
                    setSelectedZone(zone.value)
                    setShowZoneDropdown(false)
                  }}
                  className={`w-full text-left px-4 py-3 text-sm hover:bg-gray-50 transition-colors ${
                    selectedZone === zone.value
                      ? 'bg-red-50 text-red-700 font-semibold'
                      : 'text-gray-700'
                  }`}
                >
                  {zone.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ===== ONGLETS CATEGORIES ===== */}
      <section className="mt-4 px-4">
        <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1 -mx-4 px-4">
          {CATEGORY_TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveCategory(tab.id)}
              className={`whitespace-nowrap px-4 py-2 rounded-full text-sm font-medium transition-all active:scale-95 ${
                activeCategory === tab.id
                  ? 'bg-red-600 text-white shadow-md'
                  : 'bg-white text-gray-600 border border-gray-200 hover:border-red-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </section>

      {/* ===== COMPTEUR DE RESULTATS ===== */}
      {!loading && !error && (
        <div className="px-4 mt-4 flex items-center justify-between">
          <p className="text-sm text-gray-500">
            {filteredRestaurants.length} restaurant{filteredRestaurants.length !== 1 ? 's' : ''} trouve{filteredRestaurants.length !== 1 ? 's' : ''}
          </p>
          {(searchQuery || selectedZone || activeCategory !== 'all') && (
            <button
              onClick={() => {
                setSearchQuery('')
                setSelectedZone('')
                setActiveCategory('all')
              }}
              className="flex items-center gap-1 text-sm text-red-600 font-medium"
            >
              <Filter className="w-3.5 h-3.5" />
              Effacer les filtres
            </button>
          )}
        </div>
      )}

      {/* ===== CONTENU PRINCIPAL ===== */}
      <section className="px-4 mt-3">
        {/* --- Etat de chargement --- */}
        {loading && (
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <RestaurantCardSkeleton key={i} />
            ))}
          </div>
        )}

        {/* --- Erreur --- */}
        {!loading && error && (
          <div className="flex flex-col items-center justify-center py-16 px-4">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
              <UtensilsCrossed className="w-8 h-8 text-red-400" />
            </div>
            <h3 className="text-lg font-bold text-gray-700 mb-2">Erreur de chargement</h3>
            <p className="text-sm text-gray-500 text-center mb-6 max-w-xs">{error}</p>
            <button
              onClick={fetchRestaurants}
              className="flex items-center gap-2 px-5 py-2.5 bg-red-600 text-white rounded-xl text-sm font-semibold active:scale-95 transition-transform"
            >
              <Loader2 className="w-4 h-4" />
              Reessayer
            </button>
          </div>
        )}

        {/* --- Liste vide --- */}
        {!loading && !error && filteredRestaurants.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 px-4">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
              <Search className="w-8 h-8 text-gray-300" />
            </div>
            <h3 className="text-lg font-bold text-gray-700 mb-2">Aucun restaurant trouve</h3>
            <p className="text-sm text-gray-500 text-center mb-6 max-w-xs">
              Essayez de modifier vos filtres ou votre recherche pour trouver des restaurants
              disponibles dans votre zone.
            </p>
            <button
              onClick={() => {
                setSearchQuery('')
                setSelectedZone('')
                setActiveCategory('all')
              }}
              className="flex items-center gap-2 px-5 py-2.5 bg-red-600 text-white rounded-xl text-sm font-semibold active:scale-95 transition-transform"
            >
              Reinitialiser les filtres
            </button>
          </div>
        )}

        {/* --- Grille de restaurants --- */}
        {!loading && !error && filteredRestaurants.length > 0 && (
          <div className="grid grid-cols-2 gap-3">
            {filteredRestaurants.map((restaurant) => (
              <RestaurantCard
                key={restaurant.id}
                restaurant={restaurant}
                onClick={() => openRestaurant(restaurant)}
              />
            ))}
          </div>
        )}
      </section>

      {/* ===== BARRE FLOTTANTE PANIER (si articles) ===== */}
      {cartItemCount > 0 && (
        <div className="fixed bottom-4 left-4 right-4 z-40">
          <button
            onClick={openCart}
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
            <span className="font-bold text-sm">
              {formatPrice(useMovaStore.getState().cartTotal())}
            </span>
          </button>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// RestaurantCard
// ---------------------------------------------------------------------------

function RestaurantCard({
  restaurant,
  onClick,
}: {
  restaurant: Restaurant
  onClick: () => void
}) {
  const bgColor = getRestaurantColor(restaurant.id)
  const initial = restaurant.name.charAt(0).toUpperCase()

  return (
    <button
      onClick={onClick}
      className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm text-left active:scale-[0.97] transition-transform w-full"
    >
      {/* Placeholder image */}
      <div className={`h-28 ${bgColor} flex items-center justify-center relative`}>
        <span className="text-4xl font-bold text-white/90">{initial}</span>

        {/* Badge ouvert/ferme */}
        <div className="absolute top-2 right-2">
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${
              restaurant.isOpen
                ? 'bg-green-500 text-white'
                : 'bg-gray-800/70 text-white'
            }`}
          >
            {restaurant.isOpen ? 'Ouvert' : 'Ferme'}
          </span>
        </div>

        {/* Badge frais de livraison */}
        {restaurant.deliveryFee != null && restaurant.deliveryFee > 0 && (
          <div className="absolute bottom-2 left-2">
            <span className="flex items-center gap-1 px-2 py-0.5 bg-black/40 backdrop-blur-sm text-white rounded-full text-[10px] font-medium">
              <Truck className="w-2.5 h-2.5" />
              {formatPrice(restaurant.deliveryFee)}
            </span>
          </div>
        )}
      </div>

      {/* Contenu */}
      <div className="p-3">
        <h3 className="text-sm font-bold text-gray-800 truncate">{restaurant.name}</h3>

        {restaurant.description && (
          <p className="text-xs text-gray-500 mt-0.5 line-clamp-2 leading-tight">
            {restaurant.description}
          </p>
        )}

        {/* Notation */}
        <div className="mt-2">
          <RatingStars rating={restaurant.rating} />
        </div>

        {/* Temps de livraison + zone */}
        <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
          {restaurant.estimatedDeliveryTime && (
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {restaurant.estimatedDeliveryTime} min
            </span>
          )}
          {restaurant.zone && (
            <span className="flex items-center gap-1 truncate">
              <MapPin className="w-3 h-3 flex-shrink-0" />
              <span className="truncate">{restaurant.zone}</span>
            </span>
          )}
        </div>

        {/* Bouton voir le menu */}
        <div className="mt-3">
          <span className="block w-full text-center px-3 py-2 bg-red-50 text-red-600 rounded-lg text-xs font-semibold active:bg-red-100 transition-colors">
            Voir le menu
          </span>
        </div>
      </div>
    </button>
  )
}
