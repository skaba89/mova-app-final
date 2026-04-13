'use client'

import { useMovaStore } from '@/lib/store'
import {
  Car,
  Bike,
  Users,
  UtensilsCrossed,
  Package,
  Calendar,
  PlaneTakeoff,
  CarFront,
  Navigation,
  Wallet,
  Bell,
  Star,
  Tag,
  UserPlus,
  User,
  ShieldAlert,
  Home,
  MapPin,
  ClipboardList,
  LogOut,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

interface ServiceCard {
  id: string
  name: string
  description: string
  icon: LucideIcon
  color: string
  bgColor: string
  view: string
}

const SERVICES: ServiceCard[] = [
  {
    id: 'rides',
    name: 'Transport',
    description: 'Voiture avec chauffeur',
    icon: Car,
    color: 'text-blue-700',
    bgColor: 'bg-blue-50',
    view: 'rides',
  },
  {
    id: 'moto',
    name: 'Moto',
    description: 'Moto-taxi rapide',
    icon: Bike,
    color: 'text-orange-700',
    bgColor: 'bg-orange-50',
    view: 'moto',
  },
  {
    id: 'carpool',
    name: 'Covoiturage',
    description: 'Partagez vos trajets',
    icon: Users,
    color: 'text-green-700',
    bgColor: 'bg-green-50',
    view: 'carpool',
  },
  {
    id: 'food',
    name: 'Food',
    description: 'Commandez a manger',
    icon: UtensilsCrossed,
    color: 'text-red-700',
    bgColor: 'bg-red-50',
    view: 'food',
  },
  {
    id: 'deliveries',
    name: 'Livraison',
    description: 'Envoi de colis',
    icon: Package,
    color: 'text-purple-700',
    bgColor: 'bg-purple-50',
    view: 'deliveries',
  },
  {
    id: 'bookings',
    name: 'Reservations',
    description: 'Reservez a l\'avance',
    icon: Calendar,
    color: 'text-indigo-700',
    bgColor: 'bg-indigo-50',
    view: 'bookings',
  },
  {
    id: 'transfer',
    name: 'Transfert',
    description: 'Aeroport et gares',
    icon: PlaneTakeoff,
    color: 'text-cyan-700',
    bgColor: 'bg-cyan-50',
    view: 'transfer',
  },
  {
    id: 'carrental',
    name: 'Location voiture',
    description: 'Louez un vehicule',
    icon: CarFront,
    color: 'text-teal-700',
    bgColor: 'bg-teal-50',
    view: 'carrental',
  },
  {
    id: 'navigation',
    name: 'Navigation',
    description: 'Itineraires en direct',
    icon: Navigation,
    color: 'text-emerald-700',
    bgColor: 'bg-emerald-50',
    view: 'navigation',
  },
  {
    id: 'wallet',
    name: 'Portefeuille',
    description: 'Solde et paiements',
    icon: Wallet,
    color: 'text-amber-700',
    bgColor: 'bg-amber-50',
    view: 'wallet',
  },
  {
    id: 'notifications',
    name: 'Notifications',
    description: 'Vos alertes',
    icon: Bell,
    color: 'text-pink-700',
    bgColor: 'bg-pink-50',
    view: 'notifications',
  },
  {
    id: 'loyalty',
    name: 'Fidelite',
    description: 'Points et recompenses',
    icon: Star,
    color: 'text-yellow-700',
    bgColor: 'bg-yellow-50',
    view: 'loyalty',
  },
  {
    id: 'promotions',
    name: 'Promotions',
    description: 'Offres et bons plans',
    icon: Tag,
    color: 'text-rose-700',
    bgColor: 'bg-rose-50',
    view: 'promotions',
  },
  {
    id: 'referrals',
    name: 'Parrainage',
    description: 'Invitez vos amis',
    icon: UserPlus,
    color: 'text-violet-700',
    bgColor: 'bg-violet-50',
    view: 'referrals',
  },
  {
    id: 'profile',
    name: 'Profil',
    description: 'Votre compte',
    icon: User,
    color: 'text-slate-700',
    bgColor: 'bg-slate-50',
    view: 'profile',
  },
  {
    id: 'incidents',
    name: 'SOS',
    description: 'Urgence et securite',
    icon: ShieldAlert,
    color: 'text-red-600',
    bgColor: 'bg-red-50',
    view: 'incidents',
  },
]

type BottomTab = 'hub' | 'rides' | 'food' | 'profile'

interface BottomNavTab {
  id: BottomTab
  label: string
  icon: LucideIcon
  view: string
}

const BOTTOM_TABS: BottomNavTab[] = [
  { id: 'hub', label: 'Accueil', icon: Home, view: 'hub' },
  { id: 'rides', label: 'Courses', icon: MapPin, view: 'rides' },
  { id: 'food', label: 'Commandes', icon: ClipboardList, view: 'food' },
  { id: 'profile', label: 'Profil', icon: User, view: 'profile' },
]

/**
 * Hub principal - tableau de bord des services MOVA.
 * Affiche la grille de services et la navigation inferieure.
 */
export function HubView() {
  const { user, setCurrentView, logout } = useMovaStore()

  // Obtenir le prenom de l'utilisateur
  const firstName = user?.name?.split(' ')[0] || 'Bienvenue'

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* En-tete */}
      <header className="bg-[#1e40af] text-white px-5 pt-6 pb-8 rounded-b-3xl shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight">MOVA</h1>
            <p className="text-blue-200 text-sm mt-0.5">
              Bonjour, <span className="font-semibold text-white">{firstName}</span>
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* Bouton portefeuille */}
            <button
              onClick={() => setCurrentView('wallet')}
              className="flex items-center gap-1.5 px-3 py-2 bg-white/15 rounded-xl text-sm backdrop-blur-sm active:scale-95 transition-transform"
            >
              <Wallet className="w-4 h-4" />
              <span className="font-semibold">Portefeuille</span>
            </button>
            {/* Bouton deconnexion */}
            <button
              onClick={() => {
                localStorage.removeItem('mova_token')
                localStorage.removeItem('mova_user')
                logout()
                setCurrentView('auth')
              }}
              className="p-2 rounded-xl bg-white/10 active:scale-95 transition-transform"
              aria-label="Se deconnecter"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Barre de recherche (placeholder) */}
        <div className="relative">
          <input
            type="text"
            placeholder="Ou souhaitez-vous aller ?"
            className="w-full pl-4 pr-4 py-3 bg-white/15 backdrop-blur-sm rounded-xl text-sm text-white placeholder-blue-200 focus:outline-none focus:bg-white/20 transition-colors"
            readOnly
            onClick={() => setCurrentView('rides')}
          />
        </div>
      </header>

      {/* Section services */}
      <section className="px-4 mt-6">
        <h2 className="text-base font-bold text-gray-800 mb-3 px-1">Services</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {SERVICES.map((service) => {
            const Icon = service.icon
            return (
              <button
                key={service.id}
                onClick={() => setCurrentView(service.view)}
                className="flex flex-col items-center gap-2 p-4 bg-white rounded-2xl shadow-sm border border-gray-100 active:scale-[0.97] transition-transform text-center"
              >
                <div className={`w-12 h-12 ${service.bgColor} rounded-xl flex items-center justify-center`}>
                  <Icon className={`w-6 h-6 ${service.color}`} />
                </div>
                <span className="text-sm font-semibold text-gray-800">{service.name}</span>
                <span className="text-xs text-gray-500 leading-tight">{service.description}</span>
              </button>
            )
          })}
        </div>
      </section>

      {/* Section promotions rapide */}
      <section className="px-4 mt-6">
        <div className="bg-gradient-to-r from-[#f59e0b] to-[#d97706] rounded-2xl p-4 text-white">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-base">Offre de bienvenue</h3>
              <p className="text-amber-100 text-sm mt-1">
                Votre premiere course a prix reduit
              </p>
            </div>
            <button
              onClick={() => setCurrentView('promotions')}
              className="px-4 py-2 bg-white text-amber-700 font-semibold text-sm rounded-xl active:scale-95 transition-transform"
            >
              Voir
            </button>
          </div>
        </div>
      </section>

      {/* Barre de navigation inferieure */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-2 pb-safe">
        <div className="flex items-center justify-around max-w-lg mx-auto py-2">
          {BOTTOM_TABS.map((tab) => {
            const Icon = tab.icon
            const isActive = tab.view === 'hub' // Le hub est toujours l'onglet actif ici
            return (
              <button
                key={tab.id}
                onClick={() => setCurrentView(tab.view)}
                className={`flex flex-col items-center gap-1 px-4 py-1.5 rounded-xl transition-colors ${
                  isActive ? 'text-[#1e40af]' : 'text-gray-400'
                }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.5px]' : ''}`} />
                <span className={`text-xs ${isActive ? 'font-bold' : 'font-medium'}`}>
                  {tab.label}
                </span>
              </button>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
