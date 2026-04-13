'use client'

import { useState, useMemo, useEffect } from 'react'
import { useTheme } from 'next-themes'
import { motion, AnimatePresence } from 'framer-motion'
import { useAppStore } from '@/lib/mova/store'
import { useDeliveries, useCreateDelivery, useUpdateDelivery } from '@/lib/mova/api-hooks'
import type { DeliveryData, DeliveryStatus as ApiDeliveryStatus } from '@/lib/mova/api-types'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Package, FileText, ShoppingBag, Truck, MapPin, Phone, Clock,
  CheckCircle, AlertCircle, ArrowLeft, Plus, Send, Copy, Home,
  Building, Users, Edit, Trash2, ChevronRight, ChevronLeft, Star,
  Store, UtensilsCrossed, Pill, ShoppingBasket, Croissant, Circle,
  CircleDot, CircleCheck, Wallet, Banknote, Smartphone, Navigation,
  MessageSquare, ShieldAlert, X, Eye, Moon, Sun, Loader2, Inbox
} from 'lucide-react'
import { CONAKRY_LOCATIONS } from '@/lib/mova/regions'

// ── Constants ──────────────────────────────────────────────

const locations = CONAKRY_LOCATIONS

const formatGNF = (amount: number) =>
  new Intl.NumberFormat("fr-GN").format(amount) + " GNF"

const sizeMultiplier: Record<string, number> = {
  petit: 1,
  moyen: 1.5,
  grand: 2,
  extra: 3,
}

const sizeLabels: Record<string, string> = {
  petit: "Petit",
  moyen: "Moyen",
  grand: "Grand",
  extra: "Extra",
}

type DeliveryType = 'colis' | 'documents' | 'marchandises'
type DeliverySize = 'petit' | 'moyen' | 'grand' | 'extra'
type DeliveryStatus = 'pending' | 'picked_up' | 'in_transit' | 'delivered' | 'cancelled'
type PaymentMethod = 'cash' | 'wallet' | 'mobile_money'

interface DeliveryItem {
  id: string
  code: string
  type: DeliveryType
  size: DeliverySize
  status: DeliveryStatus
  pickupAddress: string
  pickupZone: string
  pickupName: string
  pickupPhone: string
  deliveryAddress: string
  deliveryZone: string
  deliveryName: string
  deliveryPhone: string
  instructions: string
  weight: string
  declaredValue: number
  price: number
  paymentMethod: PaymentMethod
  otp: string
  courierName?: string
  courierPhone?: string
  courierRating?: number
  createdAt: string
  deliveredAt?: string
  distance: number
  note?: number
}

// ── Default favorites (empty — populated from localStorage) ──

interface FavoriteLocation {
  id: string; label: string; icon: string; address: string;
  contact: string; phone: string; landmark: string;
}

interface MerchantItem {
  id?: string; name: string; type: string; icon: React.ComponentType<{ className?: string }>;
  description: string; rating: number; orders?: number;
  phone?: string; email?: string; address?: string; status?: string; createdAt?: string;
}

const defaultFavorites: FavoriteLocation[] = []
const defaultMerchants: MerchantItem[] = []

// ── Helpers ────────────────────────────────────────────────

function calculatePrice(distance: number, size: DeliverySize): number {
  const base = 5000
  const kmPrice = distance * 500
  const multiplier = sizeMultiplier[size]
  return Math.round((base + kmPrice) * multiplier)
}

function getStatusBadge(status: DeliveryStatus) {
  const map: Record<DeliveryStatus, { label: string; className: string }> = {
    pending: { label: "En attente", className: "bg-amber-100 text-amber-800 border-amber-200" },
    picked_up: { label: "Ramassé", className: "bg-cyan-100 text-cyan-800 border-cyan-200" },
    in_transit: { label: "En transit", className: "bg-emerald-100 text-emerald-800 border-emerald-200" },
    delivered: { label: "Livré", className: "bg-green-100 text-green-800 border-green-200" },
    cancelled: { label: "Annulé", className: "bg-red-100 text-red-800 border-red-200" },
  }
  return map[status]
}

function getTypeIcon(type: DeliveryType) {
  if (type === 'colis') return Package
  if (type === 'documents') return FileText
  return ShoppingBag
}

function getTypeLabel(type: DeliveryType) {
  if (type === 'colis') return "Colis Express"
  if (type === 'documents') return "Documents"
  return "Marchandises"
}

function getPaymentLabel(method: PaymentMethod) {
  if (method === 'cash') return "Cash"
  if (method === 'wallet') return "Wallet MOVA"
  return "Mobile Money"
}

function getPaymentIcon(method: PaymentMethod) {
  if (method === 'cash') return Banknote
  if (method === 'wallet') return Wallet
  return Smartphone
}

// ── API <-> Local mapping helpers ────────────────────────────

const sizeToApiSize: Record<DeliverySize, string> = {
  petit: 'small',
  moyen: 'medium',
  grand: 'large',
  extra: 'large',
}

const apiSizeToLocal: Record<string, DeliverySize> = {
  small: 'petit',
  medium: 'moyen',
  large: 'grand',
  extra: 'extra',
}

const typeToApiType: Record<DeliveryType, string> = {
  colis: 'standard',
  documents: 'fragile',
  marchandises: 'oversized',
}

const apiTypeToLocal: Record<string, DeliveryType> = {
  standard: 'colis',
  fragile: 'documents',
  oversized: 'marchandises',
}

function mapDeliveryDataToItem(d: DeliveryData): DeliveryItem {
  return {
    id: d.id,
    code: `MOV-DLV-${d.id.slice(0, 8).toUpperCase()}`,
    type: apiTypeToLocal[d.packageType] || 'colis',
    size: apiSizeToLocal[d.packageSize || ''] || 'moyen',
    status: d.status as DeliveryStatus,
    pickupAddress: d.pickupAddress,
    pickupZone: d.pickupZone,
    pickupName: d.pickupName,
    pickupPhone: d.pickupPhone,
    deliveryAddress: d.deliveryAddress,
    deliveryZone: d.deliveryZone,
    deliveryName: d.deliveryName,
    deliveryPhone: d.deliveryPhone,
    instructions: '',
    weight: d.weight ? `${d.weight} kg` : '1-2 kg',
    declaredValue: d.declaredValue || 0,
    price: d.estimatedPrice,
    paymentMethod: (d as unknown as { paymentMethod?: PaymentMethod }).paymentMethod || 'cash',
    otp: d.otp || '',
    courierName: d.courier?.name,
    courierPhone: d.courier?.phone,
    courierRating: d.courier?.rating || undefined,
    createdAt: typeof d.createdAt === 'string' ? d.createdAt : new Date(d.createdAt).toISOString(),
    deliveredAt: d.deliveredAt ? (typeof d.deliveredAt === 'string' ? d.deliveredAt : new Date(d.deliveredAt).toISOString()) : undefined,
    distance: d.pickupLat && d.pickupLng && d.deliveryLat && d.deliveryLng
      ? (() => {
          const R = 6371
          const dLat = (d.deliveryLat - d.pickupLat) * Math.PI / 180
          const dLng = (d.deliveryLng - d.pickupLng) * Math.PI / 180
          const a = Math.sin(dLat / 2) ** 2 + Math.cos(d.pickupLat * Math.PI / 180) * Math.cos(d.deliveryLat * Math.PI / 180) * Math.sin(dLng / 2) ** 2
          return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 10) / 10
        })()
      : 0,
  }
}

// ── Sub-components (outside main to satisfy ESLint) ───────

function StepIndicator({ currentStep, totalSteps }: { currentStep: number; totalSteps: number }) {
  const steps = ["Ramassage", "Livraison", "Détails", "Confirmation"]
  return (
    <div className="flex items-center gap-1 mb-6">
      {steps.map((label, i) => {
        const stepNum = i + 1
        const isActive = stepNum <= currentStep
        return (
          <div key={label} className="flex-1 flex flex-col items-center gap-1">
            <div className="flex items-center w-full">
              {i > 0 && (
                <div className={`flex-1 h-0.5 transition-colors duration-300 ${i < currentStep ? 'bg-emerald-500' : 'bg-muted'}`} />
              )}
              <motion.div
                initial={false}
                animate={{ scale: isActive ? 1.1 : 1 }}
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-colors duration-300 ${
                  stepNum < currentStep ? 'bg-emerald-500 text-white' :
                  stepNum === currentStep ? 'bg-emerald-500 text-white ring-4 ring-emerald-500/20' :
                  'bg-muted text-muted-foreground'
                }`}
              >
                {stepNum < currentStep ? <CheckCircle className="w-4 h-4" /> : stepNum}
              </motion.div>
              {i < steps.length - 1 && (
                <div className={`flex-1 h-0.5 transition-colors duration-300 ${stepNum < currentStep ? 'bg-emerald-500' : 'bg-muted'}`} />
              )}
            </div>
            <span className={`text-[10px] sm:text-xs text-center ${isActive ? 'text-emerald-700 font-medium' : 'text-muted-foreground'}`}>
              {label}
            </span>
          </div>
        )
      })}
    </div>
  )
}

function TrackingBar({ status }: { status: DeliveryStatus }) {
  const steps = [
    { key: 'pending', label: 'Commandée' },
    { key: 'picked_up', label: 'Ramassée' },
    { key: 'in_transit', label: 'En transit' },
    { key: 'near', label: 'Presque livrée' },
    { key: 'delivered', label: 'Livrée' },
  ]
  const statusIndex = steps.findIndex(s => s.key === status)
  const currentIndex = status === 'delivered' ? 4 : status === 'in_transit' ? 2 : status === 'picked_up' ? 1 : status === 'cancelled' ? -1 : 0

  return (
    <div className="relative py-4">
      <div className="flex justify-between mb-2">
        {steps.map((step, i) => (
          <div key={step.key} className="flex flex-col items-center flex-1 relative">
            <motion.div
              initial={false}
              animate={{ scale: i <= currentIndex ? 1.15 : 1, backgroundColor: i <= currentIndex ? '#10b981' : '#e5e7eb' }}
              className="w-6 h-6 sm:w-8 sm:h-8 rounded-full flex items-center justify-center z-10"
            >
              {i < currentIndex ? (
                <CheckCircle className="w-3 h-3 sm:w-4 sm:h-4 text-white" />
              ) : i === currentIndex ? (
                <CircleDot className="w-3 h-3 sm:w-4 sm:h-4 text-white" />
              ) : (
                <Circle className="w-3 h-3 sm:w-4 sm:h-4 text-gray-400" />
              )}
            </motion.div>
            <span className={`text-[9px] sm:text-[10px] mt-1 text-center leading-tight ${i <= currentIndex ? 'text-emerald-700 font-medium' : 'text-muted-foreground'}`}>
              {step.label}
            </span>
          </div>
        ))}
      </div>
      <div className="absolute top-[18px] sm:top-[22px] left-[8%] right-[8%] h-0.5 bg-muted -z-0">
        <motion.div
          initial={false}
          animate={{ width: `${(currentIndex / (steps.length - 1)) * 100}%` }}
          className="h-full bg-emerald-500"
          transition={{ duration: 0.5 }}
        />
      </div>
    </div>
  )
}

function RatingStars({ rating, onChange }: { rating: number; onChange?: (r: number) => void }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => onChange?.(star)}
          className={`${onChange ? 'cursor-pointer hover:scale-110' : 'cursor-default'} transition-transform`}
        >
          <Star className={`w-4 h-4 ${star <= rating ? 'fill-amber-400 text-amber-400' : 'text-gray-300'}`} />
        </button>
      ))}
    </div>
  )
}

// ── Main Component ─────────────────────────────────────────

export default function DeliveryView() {
  const { user, setView, goBack } = useAppStore()
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => { queueMicrotask(() => setMounted(true)) }, [])

  // ── API hooks ─────────────────────────────────────────────
  const deliveriesQuery = useDeliveries({ limit: 50 })
  const createDelivery = useCreateDelivery()
  const updateDelivery = useUpdateDelivery()

  // Map API deliveries to local items
  const hasApiData = deliveriesQuery.data && deliveriesQuery.data.data.length > 0
  const deliveries: DeliveryItem[] = useMemo(() => {
    if (hasApiData) {
      return deliveriesQuery.data.data.map(mapDeliveryDataToItem)
    }
    // Return empty while loading or on error
    if (deliveriesQuery.isLoading || deliveriesQuery.isError) {
      return []
    }
    return []
  }, [hasApiData, deliveriesQuery.data, deliveriesQuery.isLoading, deliveriesQuery.isError])

  const isLoadingDeliveries = deliveriesQuery.isLoading && !deliveriesQuery.data

  // State
  const [activeTab, setActiveTab] = useState("new")
  const [trackingId, setTrackingId] = useState<string | null>(null)

  // New delivery form state
  const [selectedType, setSelectedType] = useState<DeliveryType | null>(null)
  const [formStep, setFormStep] = useState(1)
  const [pickup, setPickup] = useState({ location: "", name: "", phone: "", instructions: "" })
  const [delivery, setDelivery] = useState({ location: "", name: "", phone: "", instructions: "" })
  const [details, setDetails] = useState({ size: "moyen" as DeliverySize, weight: "1-2 kg", declaredValue: "" })
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash")

  // Favorites state (persisted to localStorage)
  const [favorites, setFavorites] = useState<FavoriteLocation[]>(() => {
    if (typeof window === 'undefined') return defaultFavorites
    try {
      const stored = localStorage.getItem('mova_delivery_favorites')
      if (stored) {
        const parsed = JSON.parse(stored)
        if (Array.isArray(parsed) && parsed.length > 0) return parsed
      }
    } catch { /* ignore */ }
    return defaultFavorites
  })

  // Persist favorites to localStorage whenever they change
  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      localStorage.setItem('mova_delivery_favorites', JSON.stringify(favorites))
    } catch { /* ignore */ }
  }, [favorites])

  const [showAddFavorite, setShowAddFavorite] = useState(false)
  const [newFavorite, setNewFavorite] = useState({ label: "", address: "", contact: "", phone: "", landmark: "", icon: "home" as "home" | "building" | "users" })
  const [editingFavorite, setEditingFavorite] = useState<FavoriteLocation | null>(null)
  const [editFavoriteData, setEditFavoriteData] = useState<Record<string, string>>({})

  // Merchant pre-registration
  const [showMerchantForm, setShowMerchantForm] = useState(false)
  const [merchantForm, setMerchantForm] = useState({ name: "", type: "", phone: "", email: "", address: "" })

  // Merchants list from localStorage (persisted across sessions)
  const [merchants, setMerchants] = useState<MerchantItem[]>(() => {
    if (typeof window === "undefined") return defaultMerchants
    try {
      const stored = localStorage.getItem("mova_merchants")
      return stored ? JSON.parse(stored) : defaultMerchants
    } catch {
      return defaultMerchants
    }
  })

  // Estimated distance (mock) — returns 5 km fallback for unknown locations
  const isDistanceFallback = useMemo(() => {
    const pLoc = locations.find(l => l.name === pickup.location)
    const dLoc = locations.find(l => l.name === delivery.location)
    return !pLoc || !dLoc
  }, [pickup.location, delivery.location])

  const estimatedDistance = useMemo(() => {
    const pLoc = locations.find(l => l.name === pickup.location)
    const dLoc = locations.find(l => l.name === delivery.location)
    if (!pLoc || !dLoc) return 5
    const R = 6371
    const dLat = (dLoc.lat - pLoc.lat) * Math.PI / 180
    const dLng = (dLoc.lng - pLoc.lng) * Math.PI / 180
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(pLoc.lat * Math.PI / 180) * Math.cos(dLoc.lat * Math.PI / 180) * Math.sin(dLng / 2) ** 2
    return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 10) / 10
  }, [pickup.location, delivery.location])

  const estimatedPrice = useMemo(() => calculatePrice(estimatedDistance, details.size), [estimatedDistance, details.size])

  // Handlers
  const resetForm = () => {
    setSelectedType(null)
    setFormStep(1)
    setPickup({ location: "", name: "", phone: "", instructions: "" })
    setDelivery({ location: "", name: "", phone: "", instructions: "" })
    setDetails({ size: "moyen", weight: "1-2 kg", declaredValue: "" })
    setPaymentMethod("cash")
  }

  const handleConfirmDelivery = () => {
    if (!selectedType || !pickup.location || !delivery.location) return
    if (!delivery.name) {
      toast.error("Le nom du destinataire est requis")
      setFormStep(2)
      return
    }
    if (!pickup.name) {
      toast.error("Le nom de l'expediteur est requis")
      setFormStep(1)
      return
    }
    if (!pickup.phone) {
      toast.error("Le telephone de l'expediteur est requis")
      setFormStep(1)
      return
    }

    const pLoc = locations.find(l => l.name === pickup.location)
    const dLoc = locations.find(l => l.name === delivery.location)

    if (!pLoc || !dLoc) {
      toast.error("Adresse introuvable dans les lieux enregistrés")
      return
    }

    createDelivery.mutate(
      {
        senderId: user?.id || '',
        pickupName: pickup.name || user?.name || 'Expéditeur',
        pickupPhone: pickup.phone || user?.phone || '+224 600 00 00 00',
        pickupAddress: pickup.location,
        pickupLat: pLoc.lat,
        pickupLng: pLoc.lng,
        pickupZone: pLoc.zone,
        deliveryName: delivery.name || 'Destinataire',
        deliveryPhone: delivery.phone || '+224 600 00 00 00',
        deliveryAddress: delivery.location,
        deliveryLat: dLoc.lat,
        deliveryLng: dLoc.lng,
        deliveryZone: dLoc.zone,
        packageType: typeToApiType[selectedType],
        packageSize: sizeToApiSize[details.size],
        weight: parseFloat(details.weight) || undefined,
        declaredValue: Number(details.declaredValue) || undefined,
      },
      {
        onSuccess: (response) => {
          toast.success("Livraison creee !", {
            description: `OTP: ${response.otp} - ${response.estimatedPriceFormatted}`,
          })
          resetForm()
          setActiveTab("my")
        },
        onError: (error: Error) => {
          toast.error("Erreur lors de la creation", {
            description: error.message,
          })
        },
      },
    )
  }

  const handleUpdateDeliveryStatus = (
    deliveryId: string,
    newStatus: ApiDeliveryStatus,
  ) => {
    updateDelivery.mutate(
      { id: deliveryId, data: { status: newStatus } },
      {
        onSuccess: () => {
          toast.success("Statut mis a jour")
        },
        onError: (error: Error) => {
          toast.error("Erreur de mise a jour", {
            description: error.message,
          })
        },
      },
    )
  }

  const handleCopyCode = (code: string) => {
    navigator.clipboard?.writeText(code)
    toast.success("Code copie !", { description: code })
  }

  const handleAddFavorite = () => {
    if (!newFavorite.label || !newFavorite.address) {
      toast.error("Veuillez remplir le label et l'adresse")
      return
    }
    setFavorites(prev => [...prev, { ...newFavorite, id: `fav-${Date.now()}` }])
    setNewFavorite({ label: "", address: "", contact: "", phone: "", landmark: "", icon: "home" })
    setShowAddFavorite(false)
    toast.success("Adresse ajoutee !")
  }

  const handleDeleteFavorite = (id: string) => {
    setFavorites(prev => prev.filter(f => f.id !== id))
    toast.success("Adresse supprimee")
  }

  const handleOpenEditFavorite = (fav: FavoriteLocation) => {
    setEditingFavorite(fav)
    setEditFavoriteData({
      label: fav.label,
      address: fav.address,
      contact: fav.contact,
      phone: fav.phone,
      landmark: fav.landmark,
    })
  }

  const handleSaveEditFavorite = () => {
    if (!editingFavorite) return
    if (!editFavoriteData.label || !editFavoriteData.address) {
      toast.error("Veuillez remplir le label et l'adresse")
      return
    }
    setFavorites(prev => prev.map(f => f.id === editingFavorite.id ? {
      ...f,
      label: editFavoriteData.label,
      address: editFavoriteData.address,
      contact: editFavoriteData.contact || '',
      phone: editFavoriteData.phone || '',
      landmark: editFavoriteData.landmark || '',
    } : f))
    setEditingFavorite(null)
    setEditFavoriteData({})
    toast.success("Adresse mise a jour")
  }

  const handleMerchantSubmit = async () => {
    if (!merchantForm.name || !merchantForm.type) {
      toast.error("Veuillez remplir tous les champs obligatoires")
      return
    }

    // Generate a unique merchant ID
    const merchantId = `MRC-${Date.now().toString(36).toUpperCase()}`
    const newMerchant = {
      id: merchantId,
      name: merchantForm.name,
      type: merchantForm.type,
      phone: merchantForm.phone,
      email: merchantForm.email,
      address: merchantForm.address,
      status: "pending" as const,
      createdAt: new Date().toISOString(),
    }

    // Add to local list and persist
    const updatedMerchants = [...merchants, newMerchant as MerchantItem]
    setMerchants(updatedMerchants)
    try {
      localStorage.setItem("mova_merchants", JSON.stringify(updatedMerchants))
    } catch {
      // localStorage might be full or unavailable
    }

    // Also POST to API if email and phone are provided
    if (merchantForm.email && merchantForm.phone) {
      try {
        const token = localStorage.getItem('mova_token')
        const res = await fetch('/api/mova/business', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            name: merchantForm.name,
            email: merchantForm.email,
            phone: merchantForm.phone,
            plan: 'starter',
          }),
        })
        const data = await res.json()
        if (data.success) {
          toast.success("Pre-inscription envoyee !", {
            description: `ID: ${merchantId} - Compte entreprise cree.`,
            duration: 6000,
          })
        } else {
          toast.warning("Enregistre localement", {
            description: data.error || "Erreur lors de la creation du compte entreprise.",
            duration: 6000,
          })
        }
      } catch {
        toast.success("Pre-inscription enregistree localement", {
          description: `ID: ${merchantId} - Vous serez contacte sous 24h.`,
          duration: 6000,
        })
      }
    } else {
      toast.success("Pre-inscription envoyee !", {
        description: `ID: ${merchantId} - Vous serez contacte sous 24h.`,
        duration: 6000,
      })
    }

    setMerchantForm({ name: "", type: "", phone: "", email: "", address: "" })
    setShowMerchantForm(false)
  }

  // History stats
  const historyStats = useMemo(() => {
    const delivered = deliveries.filter(d => d.status === 'delivered')
    const totalSpent = delivered.reduce((sum, d) => sum + d.price, 0)
    const ratedDeliveries = delivered.filter(d => d.note)
    const avgNote = ratedDeliveries.length ? ratedDeliveries.reduce((sum, d) => sum + (d.note || 0), 0) / ratedDeliveries.length : 0
    return {
      totalDeliveries: delivered.length,
      totalSpent,
      avgNote: avgNote ? avgNote.toFixed(1) : "—",
      onTimeRate: "94%",
    }
  }, [deliveries])

  const filteredDeliveries = useMemo(() => {
    if (!trackingId) return deliveries
    return deliveries.filter(d => d.id === trackingId)
  }, [deliveries, trackingId])

  const filteredByStatus = (status: string) => {
    if (status === 'all') return filteredDeliveries
    return filteredDeliveries.filter(d => d.status === status)
  }

  return (
    <div className="min-h-screen bg-background">
      {/* ── Top Bar ──────────────────────────────────────── */}
      <div className="sticky top-0 z-50 mova-glass border-b">
        <div className="max-w-2xl mx-auto flex items-center justify-between px-4 py-3">
          <Button variant="ghost" size="icon" onClick={() => goBack()} className="shrink-0">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-2">
            <Truck className="w-5 h-5 text-emerald-600" />
            <h1 className="text-lg font-bold mova-gradient-text">MOVA Livraison</h1>
          </div>
          <div className="flex items-center gap-1">
            {mounted && (
              <button
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                className="p-2 rounded-lg hover:bg-accent transition-colors"
                aria-label="Changer de theme"
              >
                {theme === 'dark' ? <Sun className="size-4 text-amber-400" /> : <Moon className="size-4 text-slate-600" />}
              </button>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => { resetForm(); setActiveTab("new") }}
              className="shrink-0"
            >
              <Plus className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </div>

      {/* ── Content ──────────────────────────────────────── */}
      <div className="max-w-2xl mx-auto px-4 pb-24">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full flex mb-4 bg-muted/50 p-1 rounded-xl h-auto">
            {[
              { value: "new", label: "Nouvelle", icon: Plus },
              { value: "my", label: "Mes livraisons", icon: Package },
              { value: "favorites", label: "Adresses", icon: MapPin },
              { value: "merchants", label: "Marchands", icon: Store },
              { value: "history", label: "Historique", icon: Clock },
            ].map(tab => (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                className="flex-1 flex items-center justify-center gap-1 py-2 px-1 rounded-lg data-[state=active]:bg-emerald-500 data-[state=active]:text-white data-[state=active]:shadow-md text-xs sm:text-sm transition-all"
              >
                <tab.icon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                <span className="hidden sm:inline">{tab.label}</span>
              </TabsTrigger>
            ))}
          </TabsList>

          {/* ═══ TAB 1: Nouvelle Livraison ═════════════════ */}
          <TabsContent value="new" className="mt-0">
            <AnimatePresence mode="wait">
              {!selectedType ? (
                <motion.div
                  key="type-select"
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -16 }}
                  className="space-y-4"
                >
                  <div className="text-center mb-2">
                    <h2 className="text-xl font-bold">Quel type de livraison ?</h2>
                    <p className="text-sm text-muted-foreground mt-1">Choisissez le type de colis à envoyer</p>
                  </div>

                  {([
                    { type: 'colis' as DeliveryType, icon: Package, title: "Colis Express", desc: "Ramassage en 15 min", color: "emerald" },
                    { type: 'documents' as DeliveryType, icon: FileText, title: "Documents", desc: "Urgences, documents officiels", color: "amber" },
                    { type: 'marchandises' as DeliveryType, icon: ShoppingBag, title: "Marchandises", desc: "Paquets volumineux", color: "orange" },
                  ] as const).map((item, i) => (
                    <motion.div
                      key={item.type}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.1 }}
                    >
                      <Card
                        className={`mova-card-hover cursor-pointer border-2 hover:border-emerald-400 transition-all ${selectedType === item.type ? 'border-emerald-500 bg-emerald-50' : ''}`}
                        onClick={() => setSelectedType(item.type)}
                      >
                        <CardContent className="flex items-center gap-4 p-4 sm:p-6">
                          <div className={`w-14 h-14 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center shrink-0 ${
                            item.color === 'emerald' ? 'bg-emerald-100' :
                            item.color === 'amber' ? 'bg-amber-100' : 'bg-orange-100'
                          }`}>
                            <item.icon className={`w-7 h-7 sm:w-8 sm:h-8 ${
                              item.color === 'emerald' ? 'text-emerald-600' :
                              item.color === 'amber' ? 'text-amber-600' : 'text-orange-600'
                            }`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-bold text-base sm:text-lg">{item.title}</h3>
                            <p className="text-sm text-muted-foreground">{item.desc}</p>
                          </div>
                          <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0" />
                        </CardContent>
                      </Card>
                    </motion.div>
                  ))}
                </motion.div>
              ) : (
                <motion.div
                  key="form"
                  initial={{ opacity: 0, x: 40 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -40 }}
                  transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                >
                  <div className="flex items-center gap-2 mb-4">
                    <Button variant="ghost" size="icon" onClick={() => { setSelectedType(null); setFormStep(1) }} className="shrink-0">
                      <ArrowLeft className="w-4 h-4" />
                    </Button>
                    <div className="flex items-center gap-2">
                      {(() => { const Ic = getTypeIcon(selectedType); return <Ic className="w-5 h-5 text-emerald-600" /> })()}
                      <span className="font-semibold">{getTypeLabel(selectedType)}</span>
                    </div>
                  </div>

                  <StepIndicator currentStep={formStep} totalSteps={4} />

                  <AnimatePresence mode="wait">
                    {/* ── Step 1: Ramassage ── */}
                    {formStep === 1 && (
                      <motion.div key="step1" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} className="space-y-4">
                        <Card className="mova-card-hover">
                          <CardHeader className="pb-3">
                            <CardTitle className="text-base flex items-center gap-2">
                              <MapPin className="w-4 h-4 text-emerald-600" />
                              Point de ramassage
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            <div className="space-y-2">
                              <Label>Adresse *</Label>
                              <Select value={pickup.location} onValueChange={(v) => setPickup(p => ({ ...p, location: v }))}>
                                <SelectTrigger><SelectValue placeholder="Sélectionner un lieu" /></SelectTrigger>
                                <SelectContent>
                                  {locations.map(loc => (
                                    <SelectItem key={loc.name} value={loc.name}>
                                      <span className="flex items-center gap-2">
                                        <span className="text-xs text-muted-foreground">({loc.zone})</span> {loc.name}
                                      </span>
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <div className="space-y-2">
                                <Label>Nom</Label>
                                <Input placeholder="Votre nom" value={pickup.name} onChange={e => setPickup(p => ({ ...p, name: e.target.value }))} />
                              </div>
                              <div className="space-y-2">
                                <Label>Téléphone</Label>
                                <Input placeholder="+224 6XX XX XX XX" value={pickup.phone} onChange={e => setPickup(p => ({ ...p, phone: e.target.value }))} />
                              </div>
                            </div>
                            <div className="space-y-2">
                              <Label>Instructions (optionnel)</Label>
                              <Textarea placeholder="Ex: 2ème porte à gauche, près du kiosque..." value={pickup.instructions} onChange={e => setPickup(p => ({ ...p, instructions: e.target.value }))} rows={2} />
                            </div>
                          </CardContent>
                        </Card>
                        <Button onClick={() => {
                          if (!pickup.location) {
                            toast.error("Selectionnez une adresse de ramassage")
                            return
                          }
                          setFormStep(2)
                        }} className="w-full mova-gradient text-white hover:opacity-90">
                          Continuer <ChevronRight className="w-4 h-4 ml-1" />
                        </Button>
                      </motion.div>
                    )}

                    {/* ── Step 2: Livraison ── */}
                    {formStep === 2 && (
                      <motion.div key="step2" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} className="space-y-4">
                        <Card className="mova-card-hover">
                          <CardHeader className="pb-3">
                            <CardTitle className="text-base flex items-center gap-2">
                              <Navigation className="w-4 h-4 text-emerald-600" />
                              Point de livraison
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            <div className="space-y-2">
                              <Label>Adresse *</Label>
                              <Select value={delivery.location} onValueChange={(v) => setDelivery(d => ({ ...d, location: v }))}>
                                <SelectTrigger><SelectValue placeholder="Sélectionner un lieu" /></SelectTrigger>
                                <SelectContent>
                                  {locations.map(loc => (
                                    <SelectItem key={loc.name} value={loc.name}>
                                      <span className="flex items-center gap-2">
                                        <span className="text-xs text-muted-foreground">({loc.zone})</span> {loc.name}
                                      </span>
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <div className="space-y-2">
                                <Label>Nom du destinataire *</Label>
                                <Input placeholder="Nom du destinataire" value={delivery.name} onChange={e => setDelivery(d => ({ ...d, name: e.target.value }))} />
                              </div>
                              <div className="space-y-2">
                                <Label>Téléphone *</Label>
                                <Input placeholder="+224 6XX XX XX XX" value={delivery.phone} onChange={e => setDelivery(d => ({ ...d, phone: e.target.value }))} />
                              </div>
                            </div>
                            <div className="space-y-2">
                              <Label>Instructions (optionnel)</Label>
                              <Textarea placeholder="Ex: Livrer au gardien, appeler avant..." value={delivery.instructions} onChange={e => setDelivery(d => ({ ...d, instructions: e.target.value }))} rows={2} />
                            </div>
                          </CardContent>
                        </Card>
                        <div className="flex gap-3">
                          <Button variant="outline" onClick={() => setFormStep(1)} className="flex-1">
                            <ChevronLeft className="w-4 h-4 mr-1" /> Retour
                          </Button>
                          <Button onClick={() => !delivery.location || !delivery.name ? toast.error("Remplissez les champs obligatoires") : setFormStep(3)} className="flex-1 mova-gradient text-white hover:opacity-90">
                            Continuer <ChevronRight className="w-4 h-4 ml-1" />
                          </Button>
                        </div>
                      </motion.div>
                    )}

                    {/* ── Step 3: Détails ── */}
                    {formStep === 3 && (
                      <motion.div key="step3" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} className="space-y-4">
                        <Card className="mova-card-hover">
                          <CardHeader className="pb-3">
                            <CardTitle className="text-base flex items-center gap-2">
                              <Package className="w-4 h-4 text-emerald-600" />
                              Détails du colis
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-5">
                            <div className="space-y-3">
                              <Label className="text-sm font-medium">Taille du colis</Label>
                              <RadioGroup value={details.size} onValueChange={(v) => setDetails(d => ({ ...d, size: v as DeliverySize }))} className="grid grid-cols-2 gap-2">
                                {([
                                  { value: "petit", label: "Petit", desc: "Lettre, petit sac", emoji: "📦" },
                                  { value: "moyen", label: "Moyen", desc: "Sac, carton moyen", emoji: "📋" },
                                  { value: "grand", label: "Grand", desc: "Grand carton", emoji: "🧳" },
                                  { value: "extra", label: "Extra", desc: "Volumineux, lourd", emoji: "🚛" },
                                ] as const).map(opt => (
                                  <Label
                                    key={opt.value}
                                    className={`flex items-start gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${
                                      details.size === opt.value ? 'border-emerald-500 bg-emerald-50' : 'border-border hover:border-emerald-300'
                                    }`}
                                  >
                                    <RadioGroupItem value={opt.value} className="mt-0.5" />
                                    <div>
                                      <span className="text-sm font-medium">{opt.emoji} {opt.label}</span>
                                      <p className="text-xs text-muted-foreground">{opt.desc}</p>
                                    </div>
                                  </Label>
                                ))}
                              </RadioGroup>
                            </div>

                            <div className="space-y-2">
                              <Label>Poids estimé</Label>
                              <Select value={details.weight} onValueChange={(v) => setDetails(d => ({ ...d, weight: v }))}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  {["Moins de 1 kg", "1-2 kg", "2-5 kg", "5-10 kg", "10-20 kg", "20-50 kg", "Plus de 50 kg"].map(w => (
                                    <SelectItem key={w} value={w}>{w}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>

                            <div className="space-y-2">
                              <Label>Valeur déclarée (optionnel)</Label>
                              <div className="relative">
                                <Input
                                  type="number"
                                  placeholder="0"
                                  value={details.declaredValue}
                                  onChange={e => setDetails(d => ({ ...d, declaredValue: e.target.value }))}
                                  className="pr-16"
                                />
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">GNF</span>
                              </div>
                              <p className="text-xs text-muted-foreground">Protection assurance à 2% de la valeur</p>
                            </div>

                            <Card className="bg-emerald-50 border-emerald-200">
                              <CardContent className="p-4 flex items-center justify-between">
                                <span className="text-sm text-emerald-800">Prix estimé</span>
                                <span className="text-lg font-bold text-emerald-700">{formatGNF(estimatedPrice)}</span>
                              </CardContent>
                            </Card>
                          </CardContent>
                        </Card>
                        <div className="flex gap-3">
                          <Button variant="outline" onClick={() => setFormStep(2)} className="flex-1">
                            <ChevronLeft className="w-4 h-4 mr-1" /> Retour
                          </Button>
                          <Button onClick={() => setFormStep(4)} className="flex-1 mova-gradient text-white hover:opacity-90">
                            Continuer <ChevronRight className="w-4 h-4 ml-1" />
                          </Button>
                        </div>
                      </motion.div>
                    )}

                    {/* ── Step 4: Confirmation ── */}
                    {formStep === 4 && (
                      <motion.div key="step4" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} className="space-y-4">
                        <Card>
                          <CardHeader className="pb-3">
                            <CardTitle className="text-base flex items-center gap-2">
                              <CheckCircle className="w-4 h-4 text-emerald-600" />
                              Récapitulatif
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            {/* Route */}
                            <div className="flex items-start gap-3">
                              <div className="flex flex-col items-center gap-1">
                                <div className="w-3 h-3 rounded-full bg-emerald-500" />
                                <div className="w-0.5 h-10 bg-dashed bg-emerald-300 border-l border-dashed border-emerald-400" />
                                <div className="w-3 h-3 rounded-full bg-red-500" />
                              </div>
                              <div className="flex-1 space-y-3">
                                <div>
                                  <p className="text-xs text-muted-foreground">Ramassage</p>
                                  <p className="font-medium">{pickup.location}</p>
                                  <p className="text-xs text-muted-foreground">{pickup.name} — {pickup.phone}</p>
                                </div>
                                <div>
                                  <p className="text-xs text-muted-foreground">Livraison</p>
                                  <p className="font-medium">{delivery.location}</p>
                                  <p className="text-xs text-muted-foreground">{delivery.name} — {delivery.phone}</p>
                                </div>
                              </div>
                            </div>

                            <Separator />

                            {/* Details */}
                            <div className="grid grid-cols-2 gap-3 text-sm">
                              <div>
                                <span className="text-muted-foreground">Type</span>
                                <p className="font-medium flex items-center gap-1">
                                  {(() => { const Ic = getTypeIcon(selectedType!); return <Ic className="w-3.5 h-3.5" /> })()}
                                  {getTypeLabel(selectedType!)}
                                </p>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Taille</span>
                                <p className="font-medium">{sizeLabels[details.size]}</p>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Poids</span>
                                <p className="font-medium">{details.weight}</p>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Distance</span>
                                <p className="font-medium">{estimatedDistance} km{isDistanceFallback ? ' (est.)' : ''}</p>
                                {isDistanceFallback && <p className="text-[10px] text-amber-600">Distance approximative</p>}
                              </div>
                              {details.declaredValue && Number(details.declaredValue) > 0 && (
                                <div className="col-span-2">
                                  <span className="text-muted-foreground">Valeur déclarée</span>
                                  <p className="font-medium">{formatGNF(Number(details.declaredValue))}</p>
                                </div>
                              )}
                            </div>

                            <Separator />

                            {/* Price breakdown */}
                            <div className="space-y-2 text-sm">
                              <div className="flex justify-between"><span className="text-muted-foreground">Tarif de base</span><span>5 000 GNF</span></div>
                              <div className="flex justify-between"><span className="text-muted-foreground">Distance ({estimatedDistance} km × 500)</span><span>{formatGNF(Math.round(estimatedDistance * 500))}</span></div>
                              <div className="flex justify-between"><span className="text-muted-foreground">Multiplicateur taille ({sizeMultiplier[details.size]}x)</span><span>×{sizeMultiplier[details.size]}</span></div>
                              <Separator />
                              <div className="flex justify-between text-base font-bold">
                                <span>Total</span>
                                <span className="text-emerald-600">{formatGNF(estimatedPrice)}</span>
                              </div>
                            </div>

                            <Separator />

                            {/* Payment method */}
                            <div className="space-y-3">
                              <Label className="text-sm font-medium">Mode de paiement</Label>
                              <RadioGroup value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as PaymentMethod)} className="grid grid-cols-3 gap-2">
                                {([
                                  { value: "cash" as const, label: "Cash", icon: Banknote },
                                  { value: "wallet" as const, label: "Wallet", icon: Wallet },
                                  { value: "mobile_money" as const, label: "Mobile Money", icon: Smartphone },
                                ] as const).map(pm => (
                                  <Label
                                    key={pm.value}
                                    className={`flex flex-col items-center gap-2 p-3 rounded-xl border-2 cursor-pointer transition-all text-center ${
                                      paymentMethod === pm.value ? 'border-emerald-500 bg-emerald-50' : 'border-border hover:border-emerald-300'
                                    }`}
                                  >
                                    <RadioGroupItem value={pm.value} className="sr-only" />
                                    <pm.icon className={`w-5 h-5 ${paymentMethod === pm.value ? 'text-emerald-600' : 'text-muted-foreground'}`} />
                                    <span className="text-xs font-medium">{pm.label}</span>
                                  </Label>
                                ))}
                              </RadioGroup>
                            </div>
                          </CardContent>
                        </Card>

                        <div className="flex gap-3">
                          <Button variant="outline" onClick={() => setFormStep(3)} className="flex-1">
                            <ChevronLeft className="w-4 h-4 mr-1" /> Retour
                          </Button>
                          <Button onClick={handleConfirmDelivery} disabled={createDelivery.isPending} className="flex-1 mova-gradient text-white hover:opacity-90">
                            {createDelivery.isPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <CheckCircle className="w-4 h-4 mr-1" />} {createDelivery.isPending ? 'Création...' : 'Confirmer'}
                          </Button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              )}
            </AnimatePresence>
          </TabsContent>

          {/* ═══ TAB 2: Mes Livraisons ═══════════════════════ */}
          <TabsContent value="my" className="mt-0">
            <AnimatePresence mode="wait">
              {trackingId ? (
                <motion.div
                  key="tracking"
                  initial={{ opacity: 0, x: 30 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -30 }}
                  className="space-y-4"
                >
                  {(() => {
                    const d = deliveries.find(del => del.id === trackingId)
                    if (!d) return null
                    return (
                      <>
                        <div className="flex items-center gap-2">
                          <Button variant="ghost" size="sm" onClick={() => setTrackingId(null)}>
                            <ChevronLeft className="w-4 h-4 mr-1" /> Retour
                          </Button>
                        </div>

                        <Card>
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center gap-2">
                                {(() => { const Ic = getTypeIcon(d.type); return <Ic className="w-4 h-4 text-emerald-600" /> })()}
                                <span className="font-semibold text-sm">{getTypeLabel(d.type)}</span>
                              </div>
                              <Badge className={getStatusBadge(d.status).className}>{getStatusBadge(d.status).label}</Badge>
                            </div>

                            <div className="flex items-center gap-1 text-sm mb-1">
                              <Copy className="w-3.5 h-3.5 text-muted-foreground cursor-pointer" onClick={() => handleCopyCode(d.code)} />
                              <span className="font-mono text-xs text-muted-foreground">{d.code}</span>
                            </div>

                            <TrackingBar status={d.status} />

                            {/* Route */}
                            <div className="flex items-start gap-3 mt-4 p-3 bg-muted/50 rounded-xl">
                              <div className="flex flex-col items-center gap-1 mt-1">
                                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                                <div className="w-0.5 h-6 bg-emerald-300 border-l border-dashed border-emerald-400" />
                                <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
                              </div>
                              <div className="flex-1 space-y-3 text-sm">
                                <div>
                                  <p className="font-medium">{d.pickupAddress}</p>
                                  <p className="text-xs text-muted-foreground">{d.pickupZone} • {d.pickupName}</p>
                                </div>
                                <div>
                                  <p className="font-medium">{d.deliveryAddress}</p>
                                  <p className="text-xs text-muted-foreground">{d.deliveryZone} • {d.deliveryName}</p>
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>

                        {/* Courier info */}
                        {d.courierName && (
                          <Card className="mova-card-hover">
                            <CardContent className="p-4">
                              <p className="text-xs font-medium text-muted-foreground mb-3">Votre livreur</p>
                              <div className="flex items-center gap-3">
                                <Avatar className="h-12 w-12 bg-emerald-100">
                                  <AvatarFallback className="bg-emerald-100 text-emerald-700 font-bold">
                                    {d.courierName.split(' ').map(n => n[0]).join('')}
                                  </AvatarFallback>
                                </Avatar>
                                <div className="flex-1">
                                  <p className="font-semibold">{d.courierName}</p>
                                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                    <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                                    <span>{d.courierRating}</span>
                                  </div>
                                </div>
                                <Button variant="outline" size="sm" className="text-emerald-600 border-emerald-200 hover:bg-emerald-50" onClick={() => { if (d.courierPhone) window.open('tel:' + d.courierPhone, '_self') }}>
                                  <Phone className="w-3.5 h-3.5 mr-1" /> Appeler
                                </Button>
                              </div>
                            </CardContent>
                          </Card>
                        )}

                        {/* OTP */}
                        {d.status !== 'delivered' && d.status !== 'cancelled' && (
                          <Card className="bg-amber-50 border-amber-200">
                            <CardContent className="p-4 text-center">
                              <p className="text-xs text-amber-800 mb-2">Code OTP pour le destinataire</p>
                              <div className="flex items-center justify-center gap-3">
                                <span className="text-3xl font-bold font-mono tracking-widest text-amber-900">{d.otp}</span>
                                <Button variant="ghost" size="icon" className="text-amber-600" onClick={() => handleCopyCode(d.otp)}>
                                  <Copy className="w-4 h-4" />
                                </Button>
                              </div>
                              <p className="text-xs text-amber-700 mt-2">Communiquez ce code au destinataire</p>
                            </CardContent>
                          </Card>
                        )}

                        {/* Price */}
                        <Card>
                          <CardContent className="p-4 flex items-center justify-between">
                            <div>
                              <p className="text-xs text-muted-foreground">Montant</p>
                              <p className="text-lg font-bold text-emerald-600">{formatGNF(d.price)}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-xs text-muted-foreground">Paiement</p>
                              <div className="flex items-center gap-1">
                                {(() => { const Ic = getPaymentIcon(d.paymentMethod); return <Ic className="w-3.5 h-3.5" /> })()}
                                <span className="text-sm">{getPaymentLabel(d.paymentMethod)}</span>
                              </div>
                            </div>
                          </CardContent>
                        </Card>

                        {/* Actions */}
                        <div className="grid grid-cols-2 gap-3">
                          <Button variant="outline" className="border-emerald-200 text-emerald-600 hover:bg-emerald-50" onClick={() => toast.success("Message envoyé au livreur")}>
                            <MessageSquare className="w-4 h-4 mr-2" /> Contacter le livreur
                          </Button>
                          <Button variant="outline" className="border-red-200 text-red-600 hover:bg-red-50" onClick={() => toast.success("Signalement envoyé", { description: "Notre équipe va vous contacter sous 30 min." })}>
                            <ShieldAlert className="w-4 h-4 mr-2" /> Signaler un problème
                          </Button>
                        </div>
                      </>
                    )
                  })()}
                </motion.div>
              ) : (
                <motion.div key="list" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <div className="flex items-center gap-2 mb-4">
                    <Package className="w-4 h-4 text-emerald-600" />
                    <h2 className="font-bold text-lg">Mes livraisons</h2>
                    <Badge variant="secondary" className="ml-auto">{isLoadingDeliveries ? '...' : deliveries.length}</Badge>
                  </div>

                  {/* Loading Skeleton */}
                  {isLoadingDeliveries && (
                    <div className="space-y-3 mb-4">
                      {[1, 2, 3].map((i) => (
                        <Card key={i}>
                          <CardContent className="p-4 space-y-3">
                            <div className="flex items-start justify-between">
                              <Skeleton className="h-5 w-32" />
                              <Skeleton className="h-5 w-16" />
                            </div>
                            <Skeleton className="h-4 w-64" />
                            <div className="flex items-center justify-between">
                              <Skeleton className="h-4 w-20" />
                              <Skeleton className="h-3 w-24" />
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}

                  {/* Error Banner */}
                  {deliveriesQuery.isError && !isLoadingDeliveries && (
                    <Card className="border-amber-200 bg-amber-50/50 dark:bg-amber-950/20 mb-4">
                      <CardContent className="p-3 flex items-start gap-2">
                        <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                        <p className="text-sm text-amber-700 dark:text-amber-400">Impossible de charger les livraisons. Veuillez reessayer.</p>
                      </CardContent>
                    </Card>
                  )}

                  {/* Empty State (API returned no data) */}
                  {!isLoadingDeliveries && !deliveriesQuery.isError && deliveries.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                        <Inbox className="w-8 h-8 text-muted-foreground" />
                      </div>
                      <h3 className="font-semibold text-base mb-1">Aucune livraison</h3>
                      <p className="text-sm text-muted-foreground max-w-xs">Vos livraisons apparaitront ici une fois creees.</p>
                    </div>
                  )}

                  <Tabs defaultValue="all" className="w-full mb-4">
                    <TabsList className="w-full flex bg-muted/50 p-1 rounded-lg h-auto">
                      {["all", "pending", "in_transit", "delivered", "cancelled"].map(s => (
                        <TabsTrigger key={s} value={s} className="flex-1 text-xs py-1.5 rounded-md data-[state=active]:bg-emerald-500 data-[state=active]:text-white transition-all">
                          {s === 'all' ? 'Toutes' : s === 'pending' ? 'En attente' : s === 'in_transit' ? 'En cours' : s === 'delivered' ? 'Livrees' : 'Annulees'}
                        </TabsTrigger>
                      ))}
                    </TabsList>

                    {["all", "pending", "in_transit", "delivered", "cancelled"].map(status => (
                      <TabsContent key={status} value={status} className="mt-3">
                        <ScrollArea className="max-h-[60vh] mova-scrollbar">
                          <div className="space-y-3">
                            {filteredByStatus(status).map((d, i) => (
                              <motion.div
                                key={d.id}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: i * 0.05 }}
                              >
                                <Card className="mova-card-hover">
                                  <CardContent className="p-4 space-y-3">
                                    <div className="flex items-start justify-between">
                                      <div className="flex items-center gap-2">
                                        {(() => { const Ic = getTypeIcon(d.type); return <Ic className="w-4 h-4 text-emerald-600" /> })()}
                                        <div>
                                          <p className="text-sm font-semibold">{getTypeLabel(d.type)} <span className="text-muted-foreground font-normal">· {sizeLabels[d.size]}</span></p>
                                          <p className="text-xs font-mono text-muted-foreground">{d.code}</p>
                                        </div>
                                      </div>
                                      <Badge className={getStatusBadge(d.status).className}>{getStatusBadge(d.status).label}</Badge>
                                    </div>

                                    <div className="flex items-start gap-2 text-sm">
                                      <div className="flex flex-col items-center gap-0.5 mt-1">
                                        <div className="w-2 h-2 rounded-full bg-emerald-500" />
                                        <div className="w-0.5 h-4 bg-muted" />
                                        <div className="w-2 h-2 rounded-full bg-red-500" />
                                      </div>
                                      <div className="space-y-1.5">
                                        <p className="text-xs">{d.pickupAddress} <span className="text-muted-foreground">→</span> {d.deliveryAddress}</p>
                                        <p className="text-xs text-muted-foreground">{d.pickupZone} → {d.deliveryZone} · {d.distance} km</p>
                                      </div>
                                    </div>

                                    <div className="flex items-center justify-between">
                                      <span className="text-sm font-bold text-emerald-600">{formatGNF(d.price)}</span>
                                      <div className="flex items-center gap-2">
                                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                                          <Clock className="w-3 h-3" />
                                          {new Date(d.createdAt).toLocaleDateString("fr-FR", { day: 'numeric', month: 'short' })}
                                        </span>
                                        {(d.status === 'pending' || d.status === 'picked_up' || d.status === 'in_transit') && (
                                          <Button size="sm" variant="outline" className="h-7 text-xs text-emerald-600 border-emerald-200" onClick={() => setTrackingId(d.id)}>
                                            <Eye className="w-3 h-3 mr-1" /> Suivre
                                          </Button>
                                        )}
                                      </div>
                                    </div>
                                  </CardContent>
                                </Card>
                              </motion.div>
                            ))}
                            {filteredByStatus(status).length === 0 && (
                              <div className="text-center py-12">
                                <Package className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                                <p className="text-sm text-muted-foreground">Aucune livraison trouvée</p>
                              </div>
                            )}
                          </div>
                        </ScrollArea>
                      </TabsContent>
                    ))}
                  </Tabs>
                </motion.div>
              )}
            </AnimatePresence>
          </TabsContent>

          {/* ═══ TAB 3: Adresses Favorites ═══════════════════ */}
          <TabsContent value="favorites" className="mt-0">
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-bold text-lg">Adresses favorites</h2>
                <Button size="sm" className="mova-gradient text-white hover:opacity-90" onClick={() => setShowAddFavorite(true)}>
                  <Plus className="w-3.5 h-3.5 mr-1" /> Ajouter
                </Button>
              </div>

              <ScrollArea className="max-h-[70vh] mova-scrollbar">
                <div className="space-y-3">
                  {favorites.map((fav, i) => (
                    <motion.div
                      key={fav.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.08 }}
                    >
                      <Card className="mova-card-hover">
                        <CardContent className="p-4">
                          <div className="flex items-start gap-3">
                            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-emerald-100">
                              {fav.icon === 'home' && <Home className="w-5 h-5 text-emerald-600" />}
                              {fav.icon === 'building' && <Building className="w-5 h-5 text-emerald-600" />}
                              {fav.icon === 'users' && <Users className="w-5 h-5 text-emerald-600" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between">
                                <h3 className="font-semibold text-sm">{fav.label}</h3>
                                <div className="flex items-center gap-1">
                                  <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => handleOpenEditFavorite(fav)}>
                                    <Edit className="w-3.5 h-3.5" />
                                  </Button>
                                  <Button variant="ghost" size="icon" className="h-9 w-9 text-red-500 hover:text-red-600" onClick={() => handleDeleteFavorite(fav.id)}>
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </Button>
                                </div>
                              </div>
                              <p className="text-sm text-foreground mt-0.5">{fav.address}</p>
                              <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                                <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {fav.contact}</span>
                                <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> {fav.phone}</span>
                              </div>
                              {fav.landmark && (
                                <div className="mt-2 flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 px-2 py-1 rounded-lg w-fit">
                                  <MapPin className="w-3 h-3" />
                                  <span>{fav.landmark}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  ))}
                </div>
              </ScrollArea>

              {/* Points de repère section */}
              <Card className="bg-amber-50 border-amber-200 mt-4">
                <CardContent className="p-4">
                  <p className="text-sm font-semibold text-amber-800 mb-2 flex items-center gap-2">
                    <MapPin className="w-4 h-4" /> Points de repère courants
                  </p>
                  <div className="space-y-2">
                    {["Près du marché Madina", "Face à la pharmacie Kaloum", "À côté station Total Kipé", "Devant le commissariat Dixinn", "Derrière la grande mosquée de Ratoma"].map((lm, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs text-amber-700">
                        <div className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                        <span>{lm}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Add Favorite Dialog */}
              <Dialog open={showAddFavorite} onOpenChange={setShowAddFavorite}>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      <Plus className="w-5 h-5 text-emerald-600" /> Nouvelle adresse
                    </DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 mt-2">
                    <div className="space-y-2">
                      <Label>Label *</Label>
                      <Select value={newFavorite.icon} onValueChange={(v) => setNewFavorite(f => ({ ...f, icon: v as "home" | "building" | "users" }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="home">🏠 Maison</SelectItem>
                          <SelectItem value="building">🏢 Bureau</SelectItem>
                          <SelectItem value="users">👥 Famille</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Adresse complète *</Label>
                      <Input placeholder="Ex: Quartier Kaloum, près du marché..." value={newFavorite.address} onChange={e => setNewFavorite(f => ({ ...f, address: e.target.value }))} />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label>Contact</Label>
                        <Input placeholder="Nom" value={newFavorite.contact} onChange={e => setNewFavorite(f => ({ ...f, contact: e.target.value }))} />
                      </div>
                      <div className="space-y-2">
                        <Label>Téléphone</Label>
                        <Input placeholder="+224 6XX..." value={newFavorite.phone} onChange={e => setNewFavorite(f => ({ ...f, phone: e.target.value }))} />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Point de repère</Label>
                      <Input placeholder="Ex: Près du marché Madina..." value={newFavorite.landmark} onChange={e => setNewFavorite(f => ({ ...f, landmark: e.target.value }))} />
                    </div>
                    <div className="flex gap-3">
                      <Button variant="outline" className="flex-1" onClick={() => setShowAddFavorite(false)}>Annuler</Button>
                      <Button className="flex-1 mova-gradient text-white hover:opacity-90" onClick={handleAddFavorite}>Ajouter</Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>

              {/* Edit Favorite Dialog */}
              <Dialog open={!!editingFavorite} onOpenChange={(open) => { if (!open) setEditingFavorite(null) }}>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      <Edit className="h-5 w-5 text-emerald-600" />
                      Modifier l&apos;adresse
                    </DialogTitle>
                    <DialogDescription>Modifiez les informations de votre adresse favorite.</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-2">
                    <div className="space-y-2">
                      <Label>Label *</Label>
                      <Input
                        placeholder="Ex: Maison, Bureau..."
                        value={editFavoriteData.label || ''}
                        onChange={(e) => setEditFavoriteData(d => ({ ...d, label: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Adresse *</Label>
                      <Input
                        placeholder="Ex: Almamya, Kaloum"
                        value={editFavoriteData.address || ''}
                        onChange={(e) => setEditFavoriteData(d => ({ ...d, address: e.target.value }))}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label>Contact</Label>
                        <Input
                          placeholder="Nom du contact"
                          value={editFavoriteData.contact || ''}
                          onChange={(e) => setEditFavoriteData(d => ({ ...d, contact: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Telephone</Label>
                        <Input
                          placeholder="+224 6XX XX XX XX"
                          value={editFavoriteData.phone || ''}
                          onChange={(e) => setEditFavoriteData(d => ({ ...d, phone: e.target.value }))}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Point de repere</Label>
                      <Input
                        placeholder="Ex: Pres du marche Madina"
                        value={editFavoriteData.landmark || ''}
                        onChange={(e) => setEditFavoriteData(d => ({ ...d, landmark: e.target.value }))}
                      />
                    </div>
                  </div>
                  <DialogFooter className="gap-2">
                    <Button variant="outline" onClick={() => setEditingFavorite(null)}>Annuler</Button>
                    <Button className="mova-gradient text-white hover:opacity-90" onClick={handleSaveEditFavorite}>Enregistrer</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </motion.div>
          </TabsContent>

          {/* ═══ TAB 4: Marchands ═══════════════════════════ */}
          <TabsContent value="merchants" className="mt-0">
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
              {/* Coming soon banner */}
              <Card className="mova-gradient overflow-hidden relative">
                <CardContent className="p-6 text-center text-white relative z-10">
                  <motion.div
                    animate={{ y: [0, -5, 0] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  >
                    <Store className="w-12 h-12 mx-auto mb-3 text-white/90" />
                  </motion.div>
                  <h2 className="text-xl font-bold mb-1">Marchands MOVA</h2>
                  <p className="text-sm text-white/80">Commandez chez vos commerçants préférés et recevez en moins de 30 minutes</p>
                  <Badge className="mt-3 bg-white/20 text-white border-white/30 hover:bg-white/30">Bientôt disponible</Badge>
                </CardContent>
              </Card>

              {/* Merchant cards */}
              <div className="space-y-3">
                <h3 className="font-semibold text-sm text-muted-foreground">Commerçants prévus</h3>
                {merchants.map((merchant, i) => {
                  const m = merchant as unknown as Record<string, unknown>
                  const MIcon = typeof m.icon === 'function' ? (m.icon as React.ElementType) : Store
                  const mName = String(m.name ?? "")
                  const mDesc = String(m.description ?? m.type ?? "")
                  const mType = String(m.type ?? "")
                  const mRating = m.rating ? Number(m.rating) : 0
                  const mOrders = m.orders ? Number(m.orders) : 0
                  const mStatus = m.status
                  return (
                  <motion.div
                    key={String(m.id ?? mName ?? i)}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.1 }}
                  >
                    <Card className="mova-card-hover opacity-80">
                      <CardContent className="p-4 flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center shrink-0">
                          <MIcon className="w-6 h-6 text-emerald-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-sm">{mName}</h3>
                          <p className="text-xs text-muted-foreground">{mDesc}</p>
                          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                            {mRating > 0 && (
                              <span className="flex items-center gap-0.5"><Star className="w-3 h-3 fill-amber-400 text-amber-400" /> {mRating}</span>
                            )}
                            {mOrders > 0 && (
                              <span className="flex items-center gap-0.5"><ShoppingBag className="w-3 h-3" /> {mOrders} commandes</span>
                            )}
                            {mStatus === "pending" && (
                              <Badge variant="secondary" className="text-[10px] bg-amber-100 text-amber-700">En attente</Badge>
                            )}
                          </div>
                        </div>
                        <Badge variant="secondary" className="text-xs">{mType}</Badge>
                      </CardContent>
                    </Card>
                  </motion.div>
                  )
                })}
              </div>

              {/* Pre-registration form */}
              <Separator />
              <Card className="mova-card-hover">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Store className="w-4 h-4 text-emerald-600" />
                    Vous êtes commerçant ?
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">Inscrivez-vous pour être parmi les premiers sur MOVA Marchands</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>Nom du commerce *</Label>
                      <Input placeholder="Ex: Restaurant Le Djembé" value={merchantForm.name} onChange={e => setMerchantForm(f => ({ ...f, name: e.target.value }))} />
                    </div>
                    <div className="space-y-2">
                      <Label>Type de commerce *</Label>
                      <Select value={merchantForm.type} onValueChange={(v) => setMerchantForm(f => ({ ...f, type: v }))}>
                        <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="restaurant">Restaurant</SelectItem>
                          <SelectItem value="pharmacie">Pharmacie</SelectItem>
                          <SelectItem value="supermarche">Supermarché</SelectItem>
                          <SelectItem value="boulangerie">Boulangerie</SelectItem>
                          <SelectItem value="epicerie">Épicerie</SelectItem>
                          <SelectItem value="autre">Autre</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Téléphone</Label>
                      <Input placeholder="+224 6XX XX XX XX" value={merchantForm.phone} onChange={e => setMerchantForm(f => ({ ...f, phone: e.target.value }))} />
                    </div>
                    <div className="space-y-2">
                      <Label>Email</Label>
                      <Input type="email" placeholder="email@exemple.com" value={merchantForm.email} onChange={e => setMerchantForm(f => ({ ...f, email: e.target.value }))} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Adresse</Label>
                    <Input placeholder="Adresse du commerce" value={merchantForm.address} onChange={e => setMerchantForm(f => ({ ...f, address: e.target.value }))} />
                  </div>
                  <Button className="w-full mova-gradient text-white hover:opacity-90" onClick={handleMerchantSubmit}>
                    <Send className="w-4 h-4 mr-2" /> Envoyer ma pré-inscription
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          </TabsContent>

          {/* ═══ TAB 5: Historique ══════════════════════════ */}
          <TabsContent value="history" className="mt-0">
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
              {/* Stats */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: "Livraisons totales", value: String(historyStats.totalDeliveries), icon: Package, color: "emerald" },
                  { label: "Montant dépensé", value: formatGNF(historyStats.totalSpent), icon: Wallet, color: "amber" },
                  { label: "Note moyenne", value: `${historyStats.avgNote} ★`, icon: Star, color: "amber" },
                  { label: "Ponctualité", value: historyStats.onTimeRate, icon: Clock, color: "emerald" },
                ].map((stat, i) => (
                  <motion.div
                    key={stat.label}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                  >
                    <Card className="mova-card-hover">
                      <CardContent className="p-3 sm:p-4">
                        <stat.icon className={`w-5 h-5 mb-2 ${stat.color === 'emerald' ? 'text-emerald-600' : 'text-amber-600'}`} />
                        <p className="text-xs text-muted-foreground">{stat.label}</p>
                        <p className="font-bold text-sm sm:text-base mt-0.5">{stat.value}</p>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>

              {/* Delivery table */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Clock className="w-4 h-4 text-emerald-600" />
                    Historique complet
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <ScrollArea className="max-h-[50vh] mova-scrollbar">
                    <div className="min-w-[640px]">
                      {/* Table header */}
                      <div className="grid grid-cols-7 gap-2 px-4 py-2 text-xs font-medium text-muted-foreground border-b bg-muted/30">
                        <span>Date</span>
                        <span>Code</span>
                        <span className="col-span-2">Trajet</span>
                        <span>Type</span>
                        <span>Prix</span>
                        <span className="text-center">Statut</span>
                      </div>
                      {/* Rows */}
                      {deliveries.map((d, i) => (
                        <motion.div
                          key={d.id}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: i * 0.03 }}
                          className="grid grid-cols-7 gap-2 px-4 py-3 text-xs border-b last:border-0 hover:bg-muted/20 transition-colors items-center"
                        >
                          <span className="text-muted-foreground">
                            {new Date(d.createdAt).toLocaleDateString("fr-FR", { day: '2-digit', month: 'short' })}
                          </span>
                          <span className="font-mono text-muted-foreground">{d.code.split('-').slice(-1)}</span>
                          <span className="col-span-2 truncate">
                            <span className="text-emerald-600">{d.pickupAddress}</span>
                            <span className="text-muted-foreground"> → </span>
                            <span className="text-red-500">{d.deliveryAddress}</span>
                          </span>
                          <span className="flex items-center gap-1">
                            {(() => { const Ic = getTypeIcon(d.type); return <Ic className="w-3 h-3 text-emerald-600" /> })()}
                            {sizeLabels[d.size][0]}
                          </span>
                          <span className="font-semibold">{formatGNF(d.price)}</span>
                          <span className="text-center">
                            <Badge className={`${getStatusBadge(d.status).className} text-[10px] px-1.5 py-0`}>{getStatusBadge(d.status).label}</Badge>
                          </span>
                        </motion.div>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>

              {/* Monthly chart */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Truck className="w-4 h-4 text-emerald-600" />
                    Dépenses mensuelles
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4">
                  <div className="flex items-end gap-2 h-32">
                    {[
                      { month: "Sep", amount: 45000 },
                      { month: "Oct", amount: 72000 },
                      { month: "Nov", amount: 58000 },
                      { month: "Déc", amount: 95000 },
                      { month: "Jan", amount: historyStats.totalSpent },
                    ].map((m) => {
                      const maxAmount = 120000
                      const height = Math.max(8, (m.amount / maxAmount) * 100)
                      return (
                        <div key={m.month} className="flex-1 flex flex-col items-center gap-1">
                          <span className="text-[10px] text-muted-foreground font-medium">{Math.round(m.amount / 1000)}K</span>
                          <motion.div
                            initial={{ height: 0 }}
                            animate={{ height: `${height}%` }}
                            transition={{ duration: 0.5, delay: 0.2 }}
                            className="w-full rounded-t-lg mova-gradient min-h-[8px]"
                          />
                          <span className="text-[10px] text-muted-foreground">{m.month}</span>
                        </div>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>

              {/* Ratings summary */}
              {deliveries.some(d => d.note) && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Mes évaluations</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {deliveries.filter(d => d.note).map(d => (
                      <div key={d.id} className="flex items-center justify-between py-2 border-b last:border-0">
                        <div>
                          <p className="text-sm font-medium">{d.code}</p>
                          <p className="text-xs text-muted-foreground">{d.pickupAddress} → {d.deliveryAddress}</p>
                        </div>
                        <RatingStars rating={d.note || 0} />
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}
            </motion.div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
