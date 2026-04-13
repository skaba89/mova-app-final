'use client'

import { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAppStore } from '@/lib/mova/store'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  AlertCircle, ArrowLeft, Clock, MapPin, Eye, Phone, MessageCircle, Share2,
  Star, Plus, X, ChevronRight, SlidersHorizontal, RefreshCw, Search,
  Smartphone, Shirt, Building2, Wrench, ShoppingBag, Briefcase, Car, Home,
  Check, Loader2, Heart, Tag, Package, Camera, Trash2, Sparkles
} from 'lucide-react'

// ── Types ──────────────────────────────────────────────────

interface ListingItem {
  id: string
  title: string
  description: string | null
  price: number
  currency: string
  category: string
  condition: string | null
  images: string | null
  location: string
  lat: number | null
  lng: number | null
  sellerId: string
  sellerName: string
  sellerPhone: string
  sellerRating: number | null
  status: string
  views: number
  createdAt: string
  updatedAt: string
}

interface CategoryOption {
  id: string
  label: string
  icon: React.ReactNode
  value: string
  color: string
}

// ── Constants ──────────────────────────────────────────────

const CONAKRY_COMMUNES = [
  'Kaloum', 'Dixinn', 'Matam', 'Ratoma', 'Matoto',
  'Gbessia', 'Tombolia', 'Lambanyi', 'Sonfonia', 'Kagbélen',
  'Dubréka', 'Manéah', 'Sanoyah',
]

const CATEGORIES: CategoryOption[] = [
  { id: 'all', label: 'Tout', icon: <Package className="h-4 w-4" />, value: 'all', color: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300' },
  { id: 'electronics', label: 'Electronique', icon: <Smartphone className="h-4 w-4" />, value: 'electronics', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  { id: 'fashion', label: 'Mode', icon: <Shirt className="h-4 w-4" />, value: 'fashion', color: 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400' },
  { id: 'immobilier', label: 'Immobilier', icon: <Building2 className="h-4 w-4" />, value: 'immobilier', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
  { id: 'services', label: 'Services', icon: <Wrench className="h-4 w-4" />, value: 'services', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
  { id: 'alimentation', label: 'Alimentation', icon: <ShoppingBag className="h-4 w-4" />, value: 'alimentation', color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' },
  { id: 'emplois', label: 'Emplois', icon: <Briefcase className="h-4 w-4" />, value: 'emplois', color: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400' },
  { id: 'vehicules', label: 'Vehicules', icon: <Car className="h-4 w-4" />, value: 'vehicules', color: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400' },
  { id: 'maison', label: 'Maison', icon: <Home className="h-4 w-4" />, value: 'maison', color: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400' },
]

const SORT_OPTIONS = [
  { value: 'recent', label: 'Plus recent' },
  { value: 'price_asc', label: 'Prix croissant' },
  { value: 'price_desc', label: 'Prix decroissant' },
  { value: 'popular', label: 'Plus populaire' },
]

const CONDITION_OPTIONS = [
  { value: 'all', label: 'Toutes conditions' },
  { value: 'neuf', label: 'Neuf' },
  { value: 'occasion', label: 'Occasion' },
  { value: 'reconditionné', label: 'Reconditionné' },
]

// ── Category Placeholder Config ────────────────────────────

interface CategoryPlaceholder {
  gradient: string
  darkGradient: string
  icon: React.ReactNode
  iconColor: string
  darkIconColor: string
}

const CATEGORY_PLACEHOLDER: Record<string, CategoryPlaceholder> = {
  electronics: {
    gradient: 'from-blue-50 to-blue-100',
    darkGradient: 'dark:from-blue-900/20 dark:to-blue-800/20',
    icon: <Smartphone className="h-14 w-14" />,
    iconColor: 'text-blue-300',
    darkIconColor: 'dark:text-blue-600',
  },
  fashion: {
    gradient: 'from-pink-50 to-pink-100',
    darkGradient: 'dark:from-pink-900/20 dark:to-pink-800/20',
    icon: <Shirt className="h-14 w-14" />,
    iconColor: 'text-pink-300',
    darkIconColor: 'dark:text-pink-600',
  },
  immobilier: {
    gradient: 'from-amber-50 to-amber-100',
    darkGradient: 'dark:from-amber-900/20 dark:to-amber-800/20',
    icon: <Building2 className="h-14 w-14" />,
    iconColor: 'text-amber-300',
    darkIconColor: 'dark:text-amber-600',
  },
  services: {
    gradient: 'from-emerald-50 to-emerald-100',
    darkGradient: 'dark:from-emerald-900/20 dark:to-emerald-800/20',
    icon: <Wrench className="h-14 w-14" />,
    iconColor: 'text-emerald-300',
    darkIconColor: 'dark:text-emerald-600',
  },
  alimentation: {
    gradient: 'from-orange-50 to-orange-100',
    darkGradient: 'dark:from-orange-900/20 dark:to-orange-800/20',
    icon: <ShoppingBag className="h-14 w-14" />,
    iconColor: 'text-orange-300',
    darkIconColor: 'dark:text-orange-600',
  },
  emplois: {
    gradient: 'from-violet-50 to-violet-100',
    darkGradient: 'dark:from-violet-900/20 dark:to-violet-800/20',
    icon: <Briefcase className="h-14 w-14" />,
    iconColor: 'text-violet-300',
    darkIconColor: 'dark:text-violet-600',
  },
  vehicules: {
    gradient: 'from-teal-50 to-teal-100',
    darkGradient: 'dark:from-teal-900/20 dark:to-teal-800/20',
    icon: <Car className="h-14 w-14" />,
    iconColor: 'text-teal-300',
    darkIconColor: 'dark:text-teal-600',
  },
  maison: {
    gradient: 'from-rose-50 to-rose-100',
    darkGradient: 'dark:from-rose-900/20 dark:to-rose-800/20',
    icon: <Home className="h-14 w-14" />,
    iconColor: 'text-rose-300',
    darkIconColor: 'dark:text-rose-600',
  },
}

const DEFAULT_PLACEHOLDER: CategoryPlaceholder = {
  gradient: 'from-gray-50 to-gray-100',
  darkGradient: 'dark:from-gray-900/20 dark:to-gray-800/20',
  icon: <Package className="h-14 w-14" />,
  iconColor: 'text-gray-300',
  darkIconColor: 'dark:text-gray-600',
}

// ── Demo Data ──────────────────────────────────────────────

const DEMO_LISTINGS: ListingItem[] = [
  {
    id: 'demo-001',
    title: 'Samsung Galaxy A54 - Etat impeccable',
    description: 'Smartphone Samsung Galaxy A54 128Go, couleur noir. Acheté en octobre 2024, avec coque et film protecteur inclus. Batterie excellente, aucun rayon sur l\'ecran. Facture disponible.',
    price: 2500000,
    currency: 'GNF',
    category: 'electronics',
    condition: 'occasion',
    images: null,
    location: 'Kaloum',
    lat: 9.509,
    lng: -13.712,
    sellerId: 'demo-seller-1',
    sellerName: 'Mamadou Bah',
    sellerPhone: '224621550001',
    sellerRating: 4.8,
    status: 'active',
    views: 127,
    createdAt: new Date(Date.now() - 2 * 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 1 * 86400000).toISOString(),
  },
  {
    id: 'demo-002',
    title: 'Appartement F3 a louer - Kipe',
    description: 'Bel appartement F3 de 85m² dans residence securisée a Kipe. 2 chambres, salon, cuisine equipée, salle de bain. Climatisation, eau courante, parking. Proche supermarché et écoles.',
    price: 800000,
    currency: 'GNF',
    category: 'immobilier',
    condition: null,
    images: null,
    location: 'Matoto',
    lat: 9.570,
    lng: -13.620,
    sellerId: 'demo-seller-2',
    sellerName: 'Immobilier Conakry Plus',
    sellerPhone: '224622330002',
    sellerRating: 4.5,
    status: 'active',
    views: 342,
    createdAt: new Date(Date.now() - 5 * 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 2 * 86400000).toISOString(),
  },
  {
    id: 'demo-003',
    title: 'Toyota Corolla 2019 - Bon etat',
    description: 'Toyota Corolla 2019, couleur blanc, 75000 km. Vidange récente, pneus neufs. Climatisation fonctionnelle, direction assistée. Papers en regle. Prix légèrement négociable.',
    price: 85000000,
    currency: 'GNF',
    category: 'vehicules',
    condition: 'occasion',
    images: null,
    location: 'Matoto',
    lat: 9.586,
    lng: -13.623,
    sellerId: 'demo-seller-3',
    sellerName: 'Seydouba Diallo',
    sellerPhone: '224623770003',
    sellerRating: 4.6,
    status: 'active',
    views: 215,
    createdAt: new Date(Date.now() - 1 * 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 1 * 86400000).toISOString(),
  },
  {
    id: 'demo-004',
    title: 'Ensemble traditionnel brodé - Homme',
    description: 'Ensemble 3 piéces brodé a la main, tissu bazin riche. Taille M/L disponible. Coloris blanc et doré. Idéal pour cérémonies et fêtes. Qualité premium.',
    price: 750000,
    currency: 'GNF',
    category: 'fashion',
    condition: 'neuf',
    images: null,
    location: 'Matam',
    lat: 9.556,
    lng: -13.670,
    sellerId: 'demo-seller-4',
    sellerName: 'Aminata Couture',
    sellerPhone: '224624110004',
    sellerRating: 4.9,
    status: 'active',
    views: 89,
    createdAt: new Date(Date.now() - 3 * 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 3 * 86400000).toISOString(),
  },
  {
    id: 'demo-005',
    title: 'Plombier professionnel - Intervention rapide',
    description: 'Plombier certifié avec 10 ans d\'expérience. Réparations fuites, installation sanitaire, dépannage urgence. Intervention sous 24h dans toutes les communes de Conakry. Devis gratuit.',
    price: 50000,
    currency: 'GNF',
    category: 'services',
    condition: null,
    images: null,
    location: 'Ratoma',
    lat: 9.630,
    lng: -13.595,
    sellerId: 'demo-seller-5',
    sellerName: 'Alpha Conde Services',
    sellerPhone: '224625550005',
    sellerRating: 4.7,
    status: 'active',
    views: 156,
    createdAt: new Date(Date.now() - 7 * 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 5 * 86400000).toISOString(),
  },
  {
    id: 'demo-006',
    title: 'Riz parfumé 50kg - Prix de gros',
    description: 'Riz parfumé de qualité supérieure, sac de 50kg. Livraison possible dans Conakry. Prix pour commande minimum 5 sacs. Stock permanent disponible.',
    price: 450000,
    currency: 'GNF',
    category: 'alimentation',
    condition: 'neuf',
    images: null,
    location: 'Dixinn',
    lat: 9.538,
    lng: -13.695,
    sellerId: 'demo-seller-6',
    sellerName: 'Kalan Commerce',
    sellerPhone: '224626990006',
    sellerRating: 4.4,
    status: 'active',
    views: 73,
    createdAt: new Date(Date.now() - 4 * 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 4 * 86400000).toISOString(),
  },
  {
    id: 'demo-007',
    title: 'Recherche comptable expérimenté',
    description: 'Entreprise de transport recherche comptable avec 3+ ans d\'expérience. Maitrise du logiciel Sage. Contrat CDI, salaire attractif. Envoyer CV par WhatsApp.',
    price: 1500000,
    currency: 'GNF',
    category: 'emplois',
    condition: null,
    images: null,
    location: 'Kaloum',
    lat: 9.509,
    lng: -13.712,
    sellerId: 'demo-seller-7',
    sellerName: 'Trans Express GN',
    sellerPhone: '224627330007',
    sellerRating: 4.3,
    status: 'active',
    views: 198,
    createdAt: new Date(Date.now() - 6 * 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 6 * 86400000).toISOString(),
  },
  {
    id: 'demo-008',
    title: 'Canapé 3 places en cuir - Neuf',
    description: 'Canapé 3 places en cuir synthétique de haute qualité. Coloris marron. Dimensions: 200x85x90cm. Livraison et montage inclus dans Conakry. Garantie 1 an.',
    price: 3500000,
    currency: 'GNF',
    category: 'maison',
    condition: 'neuf',
    images: null,
    location: 'Ratoma',
    lat: 9.648,
    lng: -13.565,
    sellerId: 'demo-seller-8',
    sellerName: 'Meubles du Nord',
    sellerPhone: '224628770008',
    sellerRating: 4.6,
    status: 'active',
    views: 64,
    createdAt: new Date(Date.now() - 8 * 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 8 * 86400000).toISOString(),
  },
  {
    id: 'demo-009',
    title: 'iPhone 14 Pro Max 256Go',
    description: 'iPhone 14 Pro Max 256Go, couleur Space Black. Écran en parfait état, batterie santé 92%. Avec boîte d\'origine et accessoires. Face ID fonctionnel.',
    price: 15000000,
    currency: 'GNF',
    category: 'electronics',
    condition: 'occasion',
    images: null,
    location: 'Matoto',
    lat: 9.590,
    lng: -13.618,
    sellerId: 'demo-seller-9',
    sellerName: 'Ibrahima Sow',
    sellerPhone: '224629110009',
    sellerRating: 4.2,
    status: 'active',
    views: 421,
    createdAt: new Date(Date.now() - 1 * 86400000).toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'demo-010',
    title: 'Cours particuliers maths/physique',
    description: 'Professeur diplômé en sciences propose cours particuliers maths et physique pour lycéens et étudiants. En présentiel ou en ligne. Résultats garantis.',
    price: 25000,
    currency: 'GNF',
    category: 'services',
    condition: null,
    images: null,
    location: 'Lambanyi',
    lat: 9.635,
    lng: -13.590,
    sellerId: 'demo-seller-10',
    sellerName: 'Prof Keita',
    sellerPhone: '224620550010',
    sellerRating: 4.95,
    status: 'active',
    views: 312,
    createdAt: new Date(Date.now() - 3 * 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 2 * 86400000).toISOString(),
  },
  {
    id: 'demo-011',
    title: 'Montre connectee Samsung Galaxy Watch 5',
    description: 'Montre connectee en parfait etat, portee 2 mois. Avec boite et chargeur. Toutes les tailles de bracelet incluses.',
    price: 1800000,
    currency: 'GNF',
    category: 'electronics',
    condition: 'occasion',
    images: null,
    location: 'Dixinn',
    lat: 9.538,
    lng: -13.695,
    sellerId: 'demo-seller-11',
    sellerName: 'Fatoumata Soumah',
    sellerPhone: '224621110011',
    sellerRating: 4.7,
    status: 'active',
    views: 45,
    createdAt: new Date(Date.now() - 12 * 3600000).toISOString(),
    updatedAt: new Date(Date.now() - 12 * 3600000).toISOString(),
  },
  {
    id: 'demo-012',
    title: 'Cuisiniere 4 feux a gaz - Neuf',
    description: 'Cuisiniere 4 feux a gaz de marque Butagaz, couleur inox. Livree avec tuyau et regulateur. Garantie 2 ans.',
    price: 1200000,
    currency: 'GNF',
    category: 'maison',
    condition: 'neuf',
    images: null,
    location: 'Matam',
    lat: 9.556,
    lng: -13.670,
    sellerId: 'demo-seller-12',
    sellerName: 'Electromenager Plus GN',
    sellerPhone: '224622770012',
    sellerRating: 4.5,
    status: 'active',
    views: 31,
    createdAt: new Date(Date.now() - 6 * 3600000).toISOString(),
    updatedAt: new Date(Date.now() - 6 * 3600000).toISOString(),
  },
]

// ── Helpers ────────────────────────────────────────────────

function formatGNF(amount: number): string {
  return new Intl.NumberFormat('fr-FR').format(amount) + ' GNF'
}

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  const diffH = Math.floor(diffMs / 3600000)
  const diffD = Math.floor(diffMs / 86400000)
  if (diffMin < 1) return "A l'instant"
  if (diffMin < 60) return `il y a ${diffMin} min`
  if (diffH < 24) return `il y a ${diffH}h`
  if (diffD < 30) return `il y a ${diffD}j`
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}

function getCategoryInfo(category: string): CategoryOption {
  return CATEGORIES.find(c => c.value === category) || CATEGORIES[0]
}

function getCategoryIcon(category: string): React.ReactNode {
  const cat = CATEGORIES.find(c => c.value === category)
  return cat?.icon || <Package className="h-8 w-8" />
}

function isListingNew(createdAt: string): boolean {
  const now = new Date()
  const created = new Date(createdAt)
  return (now.getTime() - created.getTime()) < 24 * 3600000
}

function getSellerInitials(name: string): string {
  return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
}

function getCategoryPlaceholderConfig(category: string): CategoryPlaceholder {
  return CATEGORY_PLACEHOLDER[category] || DEFAULT_PLACEHOLDER
}

// ── Category Image Placeholder Component ───────────────────

function CategoryImagePlaceholder({ category, className = '' }: { category: string; className?: string }) {
  const config = getCategoryPlaceholderConfig(category)

  return (
    <div className={`relative bg-gradient-to-br ${config.gradient} ${config.darkGradient} flex items-center justify-center overflow-hidden ${className}`}>
      {/* Subtle dot pattern overlay */}
      <svg className="absolute inset-0 w-full h-full opacity-[0.06] pointer-events-none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id={`dots-${category}`} x="0" y="0" width="16" height="16" patternUnits="userSpaceOnUse">
            <circle cx="2" cy="2" r="1.2" fill="currentColor" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill={`url(#dots-${category})`} className="text-gray-500" />
      </svg>
      {/* Subtle diagonal lines overlay */}
      <svg className="absolute inset-0 w-full h-full opacity-[0.03] pointer-events-none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id={`lines-${category}`} x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="20" stroke="currentColor" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill={`url(#lines-${category})`} className="text-gray-400" />
      </svg>
      <div className={`${config.iconColor} ${config.darkIconColor} opacity-60 group-hover:scale-110 group-hover:opacity-80 transition-all duration-300 relative z-10`}>
        {config.icon}
      </div>
    </div>
  )
}

// ── Main Component ─────────────────────────────────────────

export default function MarketplaceView() {
  const { user, goBack } = useAppStore()
  const [mounted, setMounted] = useState(false)

  // Listings state
  const [listings, setListings] = useState<ListingItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [fetchError, setFetchError] = useState<string | null>(null)

  // Filters
  const [searchQuery, setSearchQuery] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [isSearching, setIsSearching] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [selectedLocation, setSelectedLocation] = useState('all')
  const [selectedCondition, setSelectedCondition] = useState('all')
  const [selectedSort, setSelectedSort] = useState('recent')
  const [showFilters, setShowFilters] = useState(false)

  // Debounce ref
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Selected listing
  const [selectedListing, setSelectedListing] = useState<ListingItem | null>(null)

  // Create listing
  const [showCreateForm, setShowCreateForm] = useState(false)

  // Favorites
  const [favorites, setFavorites] = useState<Set<string>>(new Set())

  useEffect(() => {
    queueMicrotask(() => setMounted(true))
  }, [])

  useEffect(() => {
    fetchListings()
  }, [])

  // Debounced search effect
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }
    if (searchInput === searchQuery) {
      setIsSearching(false)
      return
    }
    if (searchInput.trim() === '') {
      setSearchQuery('')
      setIsSearching(false)
      return
    }
    setIsSearching(true)
    debounceRef.current = setTimeout(() => {
      setSearchQuery(searchInput)
      setIsSearching(false)
    }, 300)
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
    }
  }, [searchInput])

  async function fetchListings() {
    setIsLoading(true)
    setFetchError(null)
    try {
      const params = new URLSearchParams()
      if (selectedCategory !== 'all') params.set('category', selectedCategory)
      if (selectedLocation !== 'all') params.set('location', selectedLocation)
      if (selectedCondition !== 'all') params.set('condition', selectedCondition)
      if (searchQuery) params.set('search', searchQuery)
      params.set('sort', selectedSort)

      const res = await fetch(`/api/mova/marketplace?${params.toString()}`)
      const json = await res.json()

      if (!res.ok || !json.success) {
        setFetchError(json.error || 'Erreur lors du chargement des annonces')
        setListings(DEMO_LISTINGS)
      } else if (json.data && json.data.length > 0) {
        setListings(json.data)
      } else {
        setListings(DEMO_LISTINGS)
      }
    } catch {
      setFetchError('Impossible de se connecter au serveur. Verifiez votre connexion.')
      setListings(DEMO_LISTINGS)
    } finally {
      setIsLoading(false)
    }
  }

  async function handleRefresh() {
    setIsRefreshing(true)
    await fetchListings()
    setIsRefreshing(false)
    toast.success('Annonces actualisées')
  }

  // Filtered listings (client-side for demo data)
  const filteredListings = useMemo(() => {
    let result = [...listings]

    if (selectedCategory !== 'all') {
      result = result.filter(l => l.category === selectedCategory)
    }
    if (selectedLocation !== 'all') {
      result = result.filter(l => l.location === selectedLocation)
    }
    if (selectedCondition !== 'all') {
      result = result.filter(l => l.condition === selectedCondition)
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      result = result.filter(l =>
        l.title.toLowerCase().includes(q) ||
        (l.description && l.description.toLowerCase().includes(q))
      )
    }

    // Sort
    if (selectedSort === 'price_asc') {
      result.sort((a, b) => a.price - b.price)
    } else if (selectedSort === 'price_desc') {
      result.sort((a, b) => b.price - a.price)
    } else if (selectedSort === 'popular') {
      result.sort((a, b) => b.views - a.views)
    } else {
      result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    }

    return result
  }, [listings, selectedCategory, selectedLocation, selectedCondition, searchQuery, selectedSort])

  // Listing stats
  const newListingsCount = useMemo(() => {
    return listings.filter(l => isListingNew(l.createdAt)).length
  }, [listings])

  function toggleFavorite(id: string) {
    setFavorites(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
        toast.info('Retiré des favoris')
      } else {
        next.add(id)
        toast.success('Ajouté aux favoris')
      }
      return next
    })
  }

  function contactWhatsApp(listing: ListingItem) {
    const phone = listing.sellerPhone.startsWith('+') ? listing.sellerPhone.replace('+', '') : listing.sellerPhone
    const msg = encodeURIComponent(`Bonjour, je suis intéressé(e) par votre annonce "${listing.title}" sur MOVA Marketplace (${formatGNF(listing.price)}). Est-elle toujours disponible ?`)
    window.open(`https://wa.me/${phone}?text=${msg}`, '_blank')
  }

  function contactPhone(listing: ListingItem) {
    const phone = listing.sellerPhone.startsWith('+') ? listing.sellerPhone : `+${listing.sellerPhone}`
    window.open(`tel:${phone}`)
  }

  function shareListing(listing: ListingItem) {
    const text = `${listing.title} - ${formatGNF(listing.price)} sur MOVA Marketplace`
    if (navigator.share) {
      navigator.share({ title: listing.title, text, url: window.location.href })
    } else {
      navigator.clipboard.writeText(`${text}\n${window.location.href}`)
      toast.success('Lien copié dans le presse-papier')
    }
  }

  async function handleCreateListing(data: {
    title: string
    description: string
    price: string
    category: string
    condition: string
    location: string
  }) {
    try {
      const res = await fetch('/api/mova/marketplace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: data.title,
          description: data.description,
          price: Number(data.price),
          category: data.category,
          condition: data.condition,
          location: data.location,
          sellerId: user?.id || 'demo',
          sellerName: user?.name || 'Utilisateur MOVA',
          sellerPhone: user?.phone || '224621000000',
        }),
      })
      const json = await res.json()
      if (json.success && json.data) {
        const saved: ListingItem = {
          id: json.data.id,
          title: json.data.title,
          description: json.data.description,
          price: Number(json.data.price),
          currency: json.data.currency || 'GNF',
          category: json.data.category,
          condition: json.data.condition,
          images: json.data.images,
          location: json.data.location,
          lat: json.data.lat,
          lng: json.data.lng,
          sellerId: json.data.sellerId,
          sellerName: json.data.sellerName,
          sellerPhone: json.data.sellerPhone,
          sellerRating: json.data.sellerRating,
          status: json.data.status,
          views: json.data.views || 0,
          createdAt: json.data.createdAt,
          updatedAt: json.data.updatedAt,
        }
        setListings(prev => [saved, ...prev])
        toast.success('Annonce publiee avec succes')
      } else {
        throw new Error(json.error || 'Erreur lors de la publication')
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erreur lors de la publication'
      toast.error(msg)
      throw err
    }
  }

  function handleDeleteListing(id: string) {
    setListings(prev => prev.filter(l => l.id !== id))
    setSelectedListing(null)
    toast.success('Annonce supprimee avec succes')
  }

  if (!mounted) return null

  return (
    <div className="min-h-screen pb-20 sm:pb-8">
      {/* ── Header ── */}
      <header className="sticky top-0 z-50 mova-glass border-b border-border/50">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="icon" className="rounded-full" onClick={() => goBack()}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-lg font-bold flex items-center gap-2">
              <ShoppingBag className="h-5 w-5 text-emerald-600" />
              Marketplace
            </h1>
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              {!isLoading && (
                <>
                  {filteredListings.length} annonce{filteredListings.length > 1 ? 's' : ''}
                  {newListingsCount > 0 && (
                    <Badge variant="secondary" className="h-4 px-1.5 text-[9px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400 border-0">
                      {newListingsCount} nouvelle{newListingsCount > 1 ? 's' : ''}
                    </Badge>
                  )}
                </>
              )}
              {isLoading && <Skeleton className="h-3 w-24" />}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full"
            onClick={handleRefresh}
            disabled={isRefreshing}
            title="Actualiser les annonces"
          >
            <motion.div
              animate={isRefreshing ? { rotate: 360 } : { rotate: 0 }}
              transition={isRefreshing ? { duration: 1, repeat: Infinity, ease: 'linear' } : { duration: 0 }}
            >
              <RefreshCw className="h-4 w-4" />
            </motion.div>
          </Button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-4 space-y-4">
        {/* ── Search Bar ── */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <div className="relative">
            {isSearching ? (
              <Loader2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-emerald-500 animate-spin" />
            ) : (
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            )}
            <Input
              placeholder="Rechercher une annonce..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className={`pl-9 pr-10 rounded-xl h-11 bg-muted/50 border-border/50 transition-colors ${
                isSearching ? 'border-emerald-300 dark:border-emerald-700' : ''
              }`}
            />
            {searchInput && !isSearching && (
              <button
                onClick={() => { setSearchInput(''); setSearchQuery('') }}
                className="absolute right-3 top-1/2 -translate-y-1/2"
              >
                <X className="h-4 w-4 text-muted-foreground hover:text-foreground" />
              </button>
            )}
            {isSearching && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <span className="text-[10px] text-emerald-500 font-medium">Recherche...</span>
              </div>
            )}
          </div>
        </motion.div>

        {/* ── Category Pills ── */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
          <ScrollArea className="w-full">
            <div className="flex gap-2 pb-2">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.value)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition-all border ${
                    selectedCategory === cat.value
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-500/20'
                      : 'bg-card border-border hover:border-emerald-300 text-foreground'
                  }`}
                >
                  {cat.icon}
                  <span className="hidden sm:inline">{cat.label}</span>
                </button>
              ))}
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        </motion.div>

        {/* ── Filter Bar ── */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className={`rounded-lg text-xs gap-1.5 ${showFilters ? 'border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300' : ''}`}
              onClick={() => setShowFilters(!showFilters)}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              Filtres
              {(selectedLocation !== 'all' || selectedCondition !== 'all' || selectedSort !== 'recent') && (
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              )}
            </Button>
            <Select value={selectedSort} onValueChange={setSelectedSort}>
              <SelectTrigger className="h-8 text-xs rounded-lg w-auto min-w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SORT_OPTIONS.map(opt => (
                  <SelectItem key={opt.value} value={opt.value} className="text-xs">{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex-1" />
            <span className="text-xs text-muted-foreground">
              {filteredListings.length} annonce{filteredListings.length > 1 ? 's' : ''}
            </span>
          </div>
        </motion.div>

        {/* ── Expanded Filters ── */}
        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <Card className="p-4 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium flex items-center gap-1">
                      <MapPin className="h-3 w-3 text-emerald-600" />
                      Localisation
                    </Label>
                    <Select value={selectedLocation} onValueChange={setSelectedLocation}>
                      <SelectTrigger className="h-9 text-xs rounded-lg">
                        <SelectValue placeholder="Toutes les communes" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all" className="text-xs">Toutes les communes</SelectItem>
                        {CONAKRY_COMMUNES.map(c => (
                          <SelectItem key={c} value={c} className="text-xs">{c}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium flex items-center gap-1">
                      <Tag className="h-3 w-3 text-emerald-600" />
                      Condition
                    </Label>
                    <Select value={selectedCondition} onValueChange={setSelectedCondition}>
                      <SelectTrigger className="h-9 text-xs rounded-lg">
                        <SelectValue placeholder="Toutes conditions" />
                      </SelectTrigger>
                      <SelectContent>
                        {CONDITION_OPTIONS.map(opt => (
                          <SelectItem key={opt.value} value={opt.value} className="text-xs">{opt.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs rounded-lg"
                    onClick={() => {
                      setSelectedLocation('all')
                      setSelectedCondition('all')
                      setSelectedSort('recent')
                      toast.success('Filtres réinitialisés')
                    }}
                  >
                    Réinitialiser
                  </Button>
                </div>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Error Banner ── */}
        {fetchError && !isLoading && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-start gap-3 p-4 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800"
          >
            <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-amber-800 dark:text-amber-300">Erreur de chargement</p>
              <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">{fetchError}</p>
              <p className="text-[10px] text-amber-600 dark:text-amber-500 mt-1">Donnees de demonstration affichees</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-2 h-7 text-xs gap-1.5 border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/30"
                onClick={() => fetchListings()}
              >
                <RefreshCw className="h-3 w-3" />
                Reessayer
              </Button>
            </div>
            <button
              onClick={() => setFetchError(null)}
              className="text-amber-500 hover:text-amber-700 dark:hover:text-amber-300 shrink-0"
            >
              <X className="h-4 w-4" />
            </button>
          </motion.div>
        )}

        {/* ── Search Debouncing Skeleton ── */}
        {isSearching && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
          >
            {[0, 1, 2].map(i => (
              <Card key={i} className="overflow-hidden">
                <Skeleton className="h-40 w-full" />
                <div className="p-3 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-5 w-1/2" />
                  <div className="flex justify-between">
                    <Skeleton className="h-3 w-20" />
                    <Skeleton className="h-3 w-12" />
                  </div>
                </div>
              </Card>
            ))}
          </motion.div>
        )}

        {/* ── Listings Grid ── */}
        {!isSearching && (isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[0, 1, 2, 3, 4, 5].map(i => (
              <Card key={i} className="overflow-hidden">
                <Skeleton className="h-40 w-full" />
                <div className="p-4 space-y-3">
                  <Skeleton className="h-5 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                  <div className="flex justify-between">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-4 w-16" />
                  </div>
                </div>
              </Card>
            ))}
          </div>
        ) : !isSearching && filteredListings.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center py-16 text-center"
          >
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <Search className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="font-semibold text-base mb-1">Aucune annonce trouvée</h3>
            <p className="text-sm text-muted-foreground max-w-xs">
              {searchQuery
                ? `Aucun résultat pour "${searchQuery}". Essayez un autre terme de recherche.`
                : 'Aucune annonce ne correspond a vos critères. Modifiez vos filtres.'}
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-4 rounded-xl"
              onClick={() => {
                setSearchInput('')
                setSearchQuery('')
                setSelectedCategory('all')
                setSelectedLocation('all')
                setSelectedCondition('all')
              }}
            >
              Effacer les filtres
            </Button>
          </motion.div>
        ) : !isSearching && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredListings.map((listing, i) => (
              <motion.div
                key={listing.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 + i * 0.03 }}
              >
                <Card
                  className="mova-card-hover overflow-hidden cursor-pointer group"
                  onClick={() => setSelectedListing(listing)}
                >
                  {/* Image Placeholder */}
                  <div className="relative h-44">
                    <CategoryImagePlaceholder
                      category={listing.category}
                      className="absolute inset-0 h-full w-full"
                    />

                    {/* NEW badge */}
                    {isListingNew(listing.createdAt) && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: 'spring', stiffness: 400, damping: 15 }}
                        className="absolute top-2 left-2 z-10"
                      >
                        <Badge className="text-[9px] px-1.5 py-0 border-0 bg-emerald-500 text-white font-bold shadow-sm">
                          NOUVEAU
                        </Badge>
                      </motion.div>
                    )}

                    {/* Condition badge */}
                    {listing.condition && (
                      <Badge className={`absolute ${isListingNew(listing.createdAt) ? 'top-9' : 'top-2'} left-2 text-[10px] px-1.5 py-0 border-0 z-10 ${
                        listing.condition === 'neuf'
                          ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
                          : listing.condition === 'occasion'
                            ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                            : 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300'
                      }`}>
                        {listing.condition}
                      </Badge>
                    )}

                    {/* Favorite */}
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleFavorite(listing.id) }}
                      className="absolute top-2 right-2 w-7 h-7 rounded-full bg-white/80 dark:bg-black/40 backdrop-blur flex items-center justify-center hover:bg-white dark:hover:bg-black/60 transition-colors z-10"
                    >
                      <Heart className={`h-3.5 w-3.5 ${favorites.has(listing.id) ? 'fill-red-500 text-red-500' : 'text-gray-500'}`} />
                    </button>

                    {/* Price badge overlay in bottom-right */}
                    <div className="absolute bottom-2 right-2 z-10">
                      <Badge className="text-[10px] font-bold px-2 py-1 border-0 bg-white/90 dark:bg-black/70 backdrop-blur text-emerald-700 dark:text-emerald-400 shadow-sm">
                        {formatGNF(listing.price)}
                      </Badge>
                    </div>

                    {/* Seller avatar on image */}
                    <div className="absolute bottom-2 left-2 z-10">
                      <div className="w-6 h-6 rounded-full bg-white/90 dark:bg-black/70 backdrop-blur flex items-center justify-center shadow-sm border border-white/50">
                        <span className="text-[8px] font-bold text-emerald-700 dark:text-emerald-400">
                          {getSellerInitials(listing.sellerName)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Content */}
                  <CardContent className="p-3 space-y-1.5">
                    <h3 className="text-sm font-semibold line-clamp-2 leading-tight">{listing.title}</h3>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="flex items-center gap-0.5">
                        <MapPin className="h-3 w-3 text-emerald-500" />
                        {listing.location}
                      </span>
                      <span className="flex items-center gap-0.5">
                        <Eye className="h-3 w-3" />
                        {listing.views}
                      </span>
                      <span className="flex items-center gap-0.5 ml-auto">
                        <Clock className="h-3 w-3" />
                        {formatRelativeTime(listing.createdAt)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between pt-1 border-t border-border/50">
                      <div className="flex items-center gap-1.5">
                        <div className="w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center">
                          <span className="text-[9px] font-bold text-emerald-700 dark:text-emerald-400">
                            {getSellerInitials(listing.sellerName)}
                          </span>
                        </div>
                        <span className="text-[10px] text-muted-foreground truncate max-w-[80px]">
                          {listing.sellerName.split(' ')[0]}
                        </span>
                        {listing.sellerRating && (
                          <span className="flex items-center gap-0.5 text-[10px] text-amber-500">
                            <Star className="h-2.5 w-2.5 fill-amber-500" />
                            {listing.sellerRating}
                          </span>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        ))}
      </main>

      {/* ── FAB: Create Listing ── */}
      <motion.button
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 20, delay: 0.3 }}
        onClick={() => setShowCreateForm(true)}
        className="fixed bottom-20 right-4 sm:bottom-6 sm:right-6 z-50 size-14 rounded-full mova-gradient text-white shadow-lg shadow-emerald-500/30 hover:shadow-xl hover:shadow-emerald-500/40 hover:scale-105 active:scale-95 transition-all flex items-center justify-center"
      >
        <Plus className="size-6" />
      </motion.button>

      {/* ── Listing Detail Dialog ── */}
      {selectedListing && (
        <ListingDetailDialog
          listing={selectedListing}
          isFavorite={favorites.has(selectedListing.id)}
          onToggleFavorite={() => toggleFavorite(selectedListing.id)}
          onClose={() => setSelectedListing(null)}
          currentUserId={user?.id}
          onDelete={() => handleDeleteListing(selectedListing.id)}
        />
      )}

      {/* ── Create Listing Dialog ── */}
      <CreateListingDialog
        open={showCreateForm}
        onClose={() => setShowCreateForm(false)}
        onSubmit={handleCreateListing}
      />
    </div>
  )
}

// ── Listing Detail Dialog ──────────────────────────────────

function ListingDetailDialog({
  listing,
  isFavorite,
  onToggleFavorite,
  onClose,
  currentUserId,
  onDelete,
}: {
  listing: ListingItem
  isFavorite: boolean
  onToggleFavorite: () => void
  onClose: () => void
  currentUserId?: string
  onDelete: () => void
}) {
  const catInfo = getCategoryInfo(listing.category)
  const [isDeleting, setIsDeleting] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const isOwner = listing.sellerId === currentUserId

  async function handleDelete() {
    setIsDeleting(true)
    try {
      const res = await fetch('/api/mova/marketplace', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: listing.id }),
      })
      const json = await res.json()
      if (json.success) {
        onDelete()
      } else {
        toast.error(json.error || 'Erreur lors de la suppression')
      }
    } catch {
      toast.error('Erreur de connexion. Veuillez reessayer.')
    } finally {
      setIsDeleting(false)
      setShowDeleteConfirm(false)
    }
  }

  return (
    <Dialog open={!!listing} onOpenChange={() => onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto mova-scrollbar p-0">
        {/* Image Area */}
        <div className="relative h-56 sm:h-64">
          <CategoryImagePlaceholder
            category={listing.category}
            className="absolute inset-0 h-full w-full"
          />
          {/* NEW badge */}
          {isListingNew(listing.createdAt) && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 400, damping: 15 }}
              className="absolute top-3 left-3 z-10"
            >
              <Badge className="text-[10px] px-2 py-0.5 border-0 bg-emerald-500 text-white font-bold shadow-sm">
                NOUVEAU
              </Badge>
            </motion.div>
          )}
          {listing.condition && (
            <Badge className={`absolute ${isListingNew(listing.createdAt) ? 'top-12' : 'top-3'} left-3 text-xs px-2 py-0.5 border-0 z-10 ${
              listing.condition === 'neuf'
                ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
                : listing.condition === 'occasion'
                  ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                  : 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300'
            }`}>
              {listing.condition}
            </Badge>
          )}
          <button
            onClick={onToggleFavorite}
            className="absolute top-3 right-3 w-9 h-9 rounded-full bg-white/80 dark:bg-black/40 backdrop-blur flex items-center justify-center hover:bg-white dark:hover:bg-black/60 transition-colors z-10"
          >
            <Heart className={`h-5 w-5 ${isFavorite ? 'fill-red-500 text-red-500' : 'text-gray-500'}`} />
          </button>
          {/* Price badge */}
          <div className="absolute bottom-3 right-3 z-10">
            <Badge className="text-xs font-bold px-3 py-1.5 border-0 bg-white/90 dark:bg-black/70 backdrop-blur text-emerald-700 dark:text-emerald-400 shadow-md">
              {formatGNF(listing.price)}
            </Badge>
          </div>
        </div>

        <div className="p-4 space-y-4">
          {/* Title & Price */}
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Badge variant="outline" className="text-[10px] gap-1">
                {catInfo.icon}
                {catInfo.label}
              </Badge>
              <span className="flex items-center gap-0.5 text-xs text-muted-foreground">
                <Eye className="h-3 w-3" /> {listing.views} vues
              </span>
            </div>
            <h2 className="text-lg font-bold">{listing.title}</h2>
            <p className="text-xl font-bold text-emerald-700 dark:text-emerald-400 mt-1">
              {formatGNF(listing.price)}
            </p>
          </div>

          {/* Location & Time */}
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <MapPin className="h-4 w-4 text-emerald-500" />
              {listing.location}, Conakry
            </span>
            <span className="flex items-center gap-1">
              <Clock className="h-4 w-4" />
              {formatRelativeTime(listing.createdAt)}
            </span>
          </div>

          <Separator />

          {/* Description */}
          {listing.description && (
            <div>
              <h3 className="text-sm font-semibold mb-2">Description</h3>
              <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
                {listing.description}
              </p>
            </div>
          )}

          <Separator />

          {/* Seller Info */}
          <div>
            <h3 className="text-sm font-semibold mb-2">Vendeur</h3>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center">
                <span className="text-sm font-bold text-emerald-700 dark:text-emerald-400">
                  {getSellerInitials(listing.sellerName)}
                </span>
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold">{listing.sellerName}</p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  {listing.sellerRating && (
                    <span className="flex items-center gap-0.5">
                      <Star className="h-3 w-3 text-amber-500 fill-amber-500" />
                      {listing.sellerRating}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          <Separator />

          {/* Actions */}
          <div className="space-y-2">
            <Button
              className="w-full mova-gradient text-white hover:opacity-90 rounded-xl font-semibold"
              onClick={() => {
                const phone = listing.sellerPhone.startsWith('+') ? listing.sellerPhone.replace('+', '') : listing.sellerPhone
                const msg = encodeURIComponent(`Bonjour, je suis intéressé(e) par votre annonce "${listing.title}" sur MOVA Marketplace (${formatGNF(listing.price)}). Est-elle toujours disponible ?`)
                window.open(`https://wa.me/${phone}?text=${msg}`, '_blank')
              }}
            >
              <MessageCircle className="h-4 w-4 mr-2" />
              Contacter par WhatsApp
            </Button>
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                className="rounded-xl text-sm"
                onClick={() => {
                  const phone = listing.sellerPhone.startsWith('+') ? listing.sellerPhone : `+${listing.sellerPhone}`
                  window.open(`tel:${phone}`)
                }}
              >
                <Phone className="h-4 w-4 mr-1.5" />
                Appeler
              </Button>
              <Button
                variant="outline"
                className="rounded-xl text-sm"
                onClick={() => {
                  const text = `${listing.title} - ${formatGNF(listing.price)} sur MOVA Marketplace`
                  if (navigator.share) {
                    navigator.share({ title: listing.title, text, url: window.location.href })
                  } else {
                    navigator.clipboard.writeText(`${text}\n${window.location.href}`)
                    toast.success('Lien copie dans le presse-papier')
                  }
                }}
              >
                <Share2 className="h-4 w-4 mr-1.5" />
                Partager
              </Button>
            </div>
            {/* Delete Listing (owner only) */}
            {isOwner && (
              showDeleteConfirm ? (
                <div className="flex gap-2 pt-1">
                  <Button
                    variant="destructive"
                    size="sm"
                    className="flex-1 rounded-xl text-xs"
                    onClick={handleDelete}
                    disabled={isDeleting}
                  >
                    {isDeleting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3 mr-1" />}
                    Oui, supprimer
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-xl text-xs"
                    onClick={() => setShowDeleteConfirm(false)}
                  >
                    Annuler
                  </Button>
                </div>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full rounded-xl text-xs text-red-600 border-red-200 hover:bg-red-50 dark:text-red-400 dark:border-red-800 dark:hover:bg-red-900/20"
                  onClick={() => setShowDeleteConfirm(true)}
                >
                  <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                  Supprimer l'annonce
                </Button>
              )
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ── Create Listing Dialog ──────────────────────────────────

function CreateListingDialog({
  open,
  onClose,
  onSubmit,
}: {
  open: boolean
  onClose: () => void
  onSubmit: (data: {
    title: string
    description: string
    price: string
    category: string
    condition: string
    location: string
  }) => Promise<void>
}) {
  const [step, setStep] = useState(0)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [price, setPrice] = useState('')
  const [category, setCategory] = useState('')
  const [condition, setCondition] = useState('occasion')
  const [location, setLocation] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [uploadedPhotos, setUploadedPhotos] = useState<string[]>([])
  const [showPhotoUpload, setShowPhotoUpload] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)

  const STEPS = [
    { label: 'Catégorie', icon: <Package className="h-4 w-4" /> },
    { label: 'Détails', icon: <Tag className="h-4 w-4" /> },
    { label: 'Localisation', icon: <MapPin className="h-4 w-4" /> },
    { label: 'Prix', icon: <Star className="h-4 w-4" /> },
  ]

  function resetForm() {
    setStep(0)
    setTitle('')
    setDescription('')
    setPrice('')
    setCategory('')
    setCondition('occasion')
    setLocation('')
    setUploadedPhotos([])
  }

  function handleNext() {
    if (step === 0 && !category) {
      toast.error('Veuillez sélectionner une catégorie')
      return
    }
    if (step === 1 && !title) {
      toast.error('Veuillez entrer un titre')
      return
    }
    setStep(Math.min(step + 1, STEPS.length - 1))
  }

  function handlePrev() {
    setStep(Math.max(step - 1, 0))
  }

  async function handlePublish() {
    if (!price || Number(price) <= 0) {
      toast.error('Veuillez entrer un prix valide')
      return
    }
    if (!location) {
      toast.error('Veuillez selectionner une commune')
      return
    }

    setIsSubmitting(true)
    try {
      await onSubmit({ title, description, price, category, condition, location })
      setShowSuccess(true)
    } catch {
      // Error already handled by parent
    } finally {
      setIsSubmitting(false)
    }
  }

  // Auto-close success after 2.5s
  useEffect(() => {
    if (showSuccess) {
      const timer = setTimeout(() => {
        setShowSuccess(false)
        resetForm()
        onClose()
      }, 2500)
      return () => clearTimeout(timer)
    }
  }, [showSuccess])

  // Reset form when dialog closes
  useEffect(() => {
    if (!open) {
      resetForm()
      setShowSuccess(false)
    }
  }, [open])

  return (
    <Dialog open={open} onOpenChange={() => { onClose(); setStep(0) }}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto mova-scrollbar">
        <AnimatePresence mode="wait">
          {showSuccess ? (
            /* ── Success Animation ── */
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="flex flex-col items-center justify-center py-12 text-center"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 300, damping: 20, delay: 0.1 }}
                className="w-20 h-20 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center mb-6"
              >
                <motion.div
                  initial={{ scale: 0, rotate: -180 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 15, delay: 0.3 }}
                >
                  <Check className="h-10 w-10 text-emerald-600 dark:text-emerald-400" />
                </motion.div>
              </motion.div>

              <motion.h2
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="text-xl font-bold text-emerald-700 dark:text-emerald-400 mb-2"
              >
                Annonce publiee !
              </motion.h2>

              <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="text-sm text-muted-foreground max-w-[240px]"
              >
                Votre annonce est maintenant visible par les acheteurs de Conakry.
              </motion.p>

              {/* Sparkle animations */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: [0, 1, 0] }}
                transition={{ duration: 2, delay: 0.3, repeat: 2 }}
                className="absolute top-8 left-12"
              >
                <Sparkles className="h-5 w-5 text-emerald-400" />
              </motion.div>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: [0, 1, 0] }}
                transition={{ duration: 2, delay: 0.6, repeat: 2 }}
                className="absolute top-12 right-16"
              >
                <Sparkles className="h-4 w-4 text-amber-400" />
              </motion.div>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: [0, 1, 0] }}
                transition={{ duration: 2, delay: 0.9, repeat: 2 }}
                className="absolute bottom-20 left-20"
              >
                <Sparkles className="h-3 w-3 text-emerald-300" />
              </motion.div>
            </motion.div>
          ) : (
            /* ── Normal Form ── */
            <motion.div key="form" exit={{ opacity: 0, scale: 0.95 }}>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Plus className="h-5 w-5 text-emerald-600" />
                  Publier une annonce
                </DialogTitle>
                <DialogDescription>
                  Vendez vos produits et services a Conakry en quelques étapes.
                </DialogDescription>
              </DialogHeader>

              {/* Step indicator */}
              <div className="flex items-center gap-1 mb-4 mt-4">
                {STEPS.map((s, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                      i === step
                        ? 'bg-emerald-600 text-white shadow-md'
                        : i < step
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400'
                          : 'bg-muted text-muted-foreground'
                    }`}>
                      {i < step ? <Check className="h-4 w-4" /> : <span>{i + 1}</span>}
                    </div>
                    <span className="text-[10px] text-muted-foreground hidden sm:block">{s.label}</span>
                  </div>
                ))}
              </div>

              {/* Step Content */}
              <AnimatePresence mode="wait">
                {step === 0 && (
                  <motion.div key="step-0" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-3">
                    <p className="text-sm font-medium mb-2">Choisissez une catégorie</p>
                    <div className="grid grid-cols-2 gap-2">
                      {CATEGORIES.filter(c => c.value !== 'all').map(cat => (
                        <button
                          key={cat.value}
                          onClick={() => setCategory(cat.value)}
                          className={`flex items-center gap-2 p-3 rounded-xl text-xs font-medium transition-all border ${
                            category === cat.value
                              ? 'border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400 shadow-sm'
                              : 'border-border hover:border-emerald-300 text-foreground bg-card'
                          }`}
                        >
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${cat.color}`}>
                            {cat.icon}
                          </div>
                          {cat.label}
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}

                {step === 1 && (
                  <motion.div key="step-1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium">Titre *</Label>
                      <Input
                        placeholder="Ex: Samsung Galaxy A54"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        className="rounded-lg"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium">Description</Label>
                      <Textarea
                        placeholder="Décrivez votre article en détail..."
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        className="rounded-lg min-h-[100px] mova-scrollbar"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium">Condition</Label>
                      <div className="flex gap-2">
                        {['neuf', 'occasion', 'reconditionné'].map(cond => (
                          <button
                            key={cond}
                            onClick={() => setCondition(cond)}
                            className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all border capitalize ${
                              condition === cond
                                ? 'border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400'
                                : 'border-border hover:border-emerald-300 text-foreground bg-card'
                            }`}
                          >
                            {cond}
                          </button>
                        ))}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowPhotoUpload(true)}
                      className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 border border-dashed border-border hover:border-emerald-400 hover:bg-emerald-50/50 dark:hover:bg-emerald-900/10 transition-colors cursor-pointer"
                    >
                      <Camera className="h-4 w-4 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">
                        {uploadedPhotos.length > 0 ? `${uploadedPhotos.length} photo${uploadedPhotos.length > 1 ? 's' : ''} ajoutee${uploadedPhotos.length > 1 ? 's' : ''}` : 'Ajouter des photos'}
                      </span>
                    </button>
                  </motion.div>
                )}

                {step === 2 && (
                  <motion.div key="step-2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5 text-emerald-600" />
                        Commune *
                      </Label>
                      <Select value={location} onValueChange={setLocation}>
                        <SelectTrigger className="rounded-lg">
                          <SelectValue placeholder="Sélectionnez votre commune" />
                        </SelectTrigger>
                        <SelectContent>
                          {CONAKRY_COMMUNES.map(c => (
                            <SelectItem key={c} value={c}>{c}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800">
                      <div className="flex items-center gap-2 mb-1">
                        <MapPin className="h-4 w-4 text-emerald-600" />
                        <span className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">13 communes de Conakry</span>
                      </div>
                      <p className="text-xs text-emerald-600 dark:text-emerald-400">
                        Sélectionnez la commune ou se trouve votre article pour aider les acheteurs proches a vous trouver.
                      </p>
                    </div>
                  </motion.div>
                )}

                {step === 3 && (
                  <motion.div key="step-3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium">Prix (GNF) *</Label>
                      <Input
                        type="number"
                        placeholder="Ex: 500000"
                        value={price}
                        onChange={(e) => setPrice(e.target.value)}
                        className="rounded-lg text-lg font-bold"
                      />
                      {price && Number(price) > 0 && (
                        <p className="text-sm font-semibold text-emerald-600">{formatGNF(Number(price))}</p>
                      )}
                    </div>

                    <Separator />

                    {/* Summary */}
                    <div className="space-y-2 p-3 rounded-xl bg-muted/50 border">
                      <p className="text-xs font-semibold text-muted-foreground uppercase">Résumé de l'annonce</p>
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Titre</span>
                          <span className="font-medium text-right max-w-[200px] truncate">{title || '-'}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Catégorie</span>
                          <span className="font-medium">{getCategoryInfo(category).label}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Condition</span>
                          <span className="font-medium capitalize">{condition}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Localisation</span>
                          <span className="font-medium">{location || '-'}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Prix</span>
                          <span className="font-bold text-emerald-700 dark:text-emerald-400">
                            {price && Number(price) > 0 ? formatGNF(Number(price)) : '-'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Navigation */}
              <div className="flex gap-2 pt-2">
                {step > 0 && (
                  <Button variant="outline" className="flex-1 rounded-xl" onClick={handlePrev}>
                    Retour
                  </Button>
                )}
                {step < STEPS.length - 1 ? (
                  <Button className="flex-1 mova-gradient text-white hover:opacity-90 rounded-xl" onClick={handleNext}>
                    Suivant
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                ) : (
                  <Button
                    className="flex-1 mova-gradient text-white hover:opacity-90 rounded-xl font-semibold"
                    onClick={handlePublish}
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Publication...
                      </>
                    ) : (
                      <>
                        <Check className="h-4 w-4 mr-2" />
                        Publier l'annonce
                      </>
                    )}
                  </Button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>

      {/* Photo Upload Dialog */}
      <Dialog open={showPhotoUpload} onOpenChange={setShowPhotoUpload}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Camera className="h-5 w-5 text-emerald-600" />
              Ajouter des photos
            </DialogTitle>
            <DialogDescription>Selectionnez des photos pour votre annonce (max 5)</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div
              onClick={() => {
                if (uploadedPhotos.length < 5) {
                  const fakeUrl = `photo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`
                  setUploadedPhotos([...uploadedPhotos, fakeUrl])
                  toast.success('Photo ajoutee avec succes')
                } else {
                  toast.error('Maximum 5 photos autorisees')
                }
              }}
              className="border-2 border-dashed border-emerald-300 dark:border-emerald-700 rounded-xl p-6 flex flex-col items-center gap-2 cursor-pointer hover:bg-emerald-50/50 dark:hover:bg-emerald-900/10 transition-colors"
            >
              <Plus className="h-8 w-8 text-emerald-500" />
              <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">Choisir une photo</p>
              <p className="text-xs text-muted-foreground">{uploadedPhotos.length}/5 photos</p>
            </div>
            {uploadedPhotos.length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                {uploadedPhotos.map((photo, i) => (
                  <div key={photo} className="relative aspect-square bg-muted rounded-lg flex items-center justify-center group">
                    <Package className="h-8 w-8 text-muted-foreground/40" />
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setUploadedPhotos(uploadedPhotos.filter((_, idx) => idx !== i)) }}
                      className="absolute top-1 right-1 h-5 w-5 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="h-3 w-3" />
                    </button>
                    <span className="absolute bottom-1 left-1 text-[9px] text-muted-foreground">Photo {i + 1}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </Dialog>
  )
}
