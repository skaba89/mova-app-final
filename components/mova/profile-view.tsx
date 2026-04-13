'use client'

import { useState } from 'react'
import { useMovaStore } from '@/lib/store'
import {
  ArrowLeft,
  User,
  Mail,
  Phone,
  Star,
  Car,
  MapPin,
  Bell,
  Globe,
  LogOut,
  ChevronRight,
  Shield,
  Clock,
  CreditCard,
  Heart,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

// --- Types ---

interface ProfileSection {
  id: string
  label: string
  icon: LucideIcon
  color: string
  bgColor: string
  value?: string
  action?: () => void
}

interface StatCard {
  label: string
  value: string
  icon: LucideIcon
  color: string
  bgColor: string
}

// --- Constantes ---

const ROLE_LABELS: Record<string, string> = {
  passenger: 'Client',
  driver: 'Chauffeur',
  admin: 'Administrateur',
  restaurant: 'Restaurant',
  commercant: 'Commercant',
}

/**
 * Vue du profil utilisateur - informations, statistiques, parametres, deconnexion.
 */
export function ProfileView() {
  const { user, logout, setCurrentView } = useMovaStore()

  // Parametres locaux
  const [notificationsEnabled, setNotificationsEnabled] = useState(true)
  const [promoEnabled, setPromoEnabled] = useState(true)
  const [language, setLanguage] = useState('fr')

  // Statistiques (donnees fictives en attendant l'API)
  const stats: StatCard[] = [
    { label: 'Courses', value: '0', icon: Car, color: 'text-blue-600', bgColor: 'bg-blue-50' },
    { label: 'Depense totale', value: '0 GNF', icon: CreditCard, color: 'text-green-600', bgColor: 'bg-green-50' },
    { label: 'Note moyenne', value: '--', icon: Star, color: 'text-amber-600', bgColor: 'bg-amber-50' },
    { label: 'Membre depuis', value: user ? new Date().toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' }) : '--', icon: Clock, color: 'text-purple-600', bgColor: 'bg-purple-50' },
  ]

  // Lieux favoris (donnees fictives)
  const favoriteLocations = [
    { id: 'home', name: 'Domicile', address: 'Non defini', icon: '🏠' },
    { id: 'work', name: 'Travail', address: 'Non defini', icon: '💼' },
  ]

  const handleLogout = () => {
    localStorage.removeItem('mova_token')
    localStorage.removeItem('mova_user')
    logout()
    setCurrentView('auth')
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-[#1e40af] text-white px-4 py-4 flex items-center gap-3">
          <button onClick={() => setCurrentView('hub')} className="p-2 -ml-2 rounded-xl">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-bold">Profil</h1>
        </header>
        <div className="flex flex-col items-center justify-center py-20 px-4">
          <User className="w-16 h-16 text-gray-300 mb-4" />
          <p className="text-gray-500">Aucune information de profil disponible</p>
        </div>
      </div>
    )
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
        <h1 className="text-lg font-bold">Profil</h1>
      </header>

      <div className="px-4 py-5 space-y-5 pb-8">
        {/* Carte profil */}
        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
          <div className="flex items-center gap-4">
            {/* Avatar */}
            <div className="w-16 h-16 bg-[#1e40af] rounded-2xl flex items-center justify-center shrink-0">
              <span className="text-2xl font-bold text-white">
                {user.name?.charAt(0)?.toUpperCase() || 'U'}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-bold text-gray-900 truncate">{user.name}</h2>
              <span className="inline-flex items-center gap-1.5 mt-1 px-2.5 py-1 bg-blue-50 rounded-full text-xs font-semibold text-[#1e40af]">
                <Shield className="w-3 h-3" />
                {ROLE_LABELS[user.role] || user.role}
              </span>
            </div>
          </div>

          {/* Informations de contact */}
          <div className="mt-4 space-y-2.5">
            <div className="flex items-center gap-3 text-sm">
              <Mail className="w-4 h-4 text-gray-400 shrink-0" />
              <span className="text-gray-700 truncate">{user.email}</span>
            </div>
            {user.phone && (
              <div className="flex items-center gap-3 text-sm">
                <Phone className="w-4 h-4 text-gray-400 shrink-0" />
                <span className="text-gray-700">{user.phone}</span>
              </div>
            )}
          </div>
        </div>

        {/* Statistiques */}
        <div className="grid grid-cols-2 gap-3">
          {stats.map((stat) => {
            const Icon = stat.icon
            return (
              <div key={stat.label} className="bg-white rounded-xl p-3.5 border border-gray-100 shadow-sm">
                <div className={`w-8 h-8 ${stat.bgColor} rounded-lg flex items-center justify-center mb-2`}>
                  <Icon className={`w-4 h-4 ${stat.color}`} />
                </div>
                <p className="text-xs text-gray-500">{stat.label}</p>
                <p className="text-base font-bold text-gray-800 mt-0.5">{stat.value}</p>
              </div>
            )
          })}
        </div>

        {/* Lieux favoris */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100">
            <h3 className="font-bold text-gray-800">Lieux favoris</h3>
          </div>
          {favoriteLocations.map((loc) => (
            <button
              key={loc.id}
              className="w-full flex items-center gap-3 px-4 py-3 border-b border-gray-50 last:border-b-0 active:bg-gray-50 transition-colors"
            >
              <span className="text-lg">{loc.icon}</span>
              <div className="flex-1 text-left">
                <p className="text-sm font-semibold text-gray-800">{loc.name}</p>
                <p className="text-xs text-gray-500">{loc.address}</p>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-300" />
            </button>
          ))}
        </div>

        {/* Parametres */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100">
            <h3 className="font-bold text-gray-800">Parametres</h3>
          </div>

          {/* Langue */}
          <div className="flex items-center gap-3 px-4 py-3.5 border-b border-gray-50">
            <Globe className="w-5 h-5 text-gray-400 shrink-0" />
            <span className="flex-1 text-sm font-medium text-gray-700">Langue</span>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="text-sm text-gray-500 bg-transparent border-none focus:outline-none cursor-pointer"
            >
              <option value="fr">Francais</option>
              <option value="en">English</option>
              <option value="sus">Soussou</option>
              <option value="pul">Poular</option>
              <option value="ml">Malinke</option>
            </select>
          </div>

          {/* Notifications push */}
          <div className="flex items-center gap-3 px-4 py-3.5 border-b border-gray-50">
            <Bell className="w-5 h-5 text-gray-400 shrink-0" />
            <span className="flex-1 text-sm font-medium text-gray-700">Notifications</span>
            <button
              onClick={() => setNotificationsEnabled(!notificationsEnabled)}
              className={`relative w-11 h-6 rounded-full transition-colors ${
                notificationsEnabled ? 'bg-[#1e40af]' : 'bg-gray-300'
              }`}
            >
              <div
                className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${
                  notificationsEnabled ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Promotions */}
          <div className="flex items-center gap-3 px-4 py-3.5">
            <Heart className="w-5 h-5 text-gray-400 shrink-0" />
            <span className="flex-1 text-sm font-medium text-gray-700">Offres promotionnelles</span>
            <button
              onClick={() => setPromoEnabled(!promoEnabled)}
              className={`relative w-11 h-6 rounded-full transition-colors ${
                promoEnabled ? 'bg-[#1e40af]' : 'bg-gray-300'
              }`}
            >
              <div
                className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${
                  promoEnabled ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>

        {/* Liens rapides */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <button
            onClick={() => setCurrentView('wallet')}
            className="w-full flex items-center gap-3 px-4 py-3.5 border-b border-gray-50 active:bg-gray-50 transition-colors"
          >
            <CreditCard className="w-5 h-5 text-gray-400 shrink-0" />
            <span className="flex-1 text-sm font-medium text-gray-700 text-left">Portefeuille</span>
            <ChevronRight className="w-4 h-4 text-gray-300" />
          </button>
          <button
            onClick={() => setCurrentView('notifications')}
            className="w-full flex items-center gap-3 px-4 py-3.5 border-b border-gray-50 active:bg-gray-50 transition-colors"
          >
            <Bell className="w-5 h-5 text-gray-400 shrink-0" />
            <span className="flex-1 text-sm font-medium text-gray-700 text-left">Notifications</span>
            <ChevronRight className="w-4 h-4 text-gray-300" />
          </button>
          <button
            onClick={() => setCurrentView('loyalty')}
            className="w-full flex items-center gap-3 px-4 py-3.5 active:bg-gray-50 transition-colors"
          >
            <Star className="w-5 h-5 text-gray-400 shrink-0" />
            <span className="flex-1 text-sm font-medium text-gray-700 text-left">Programme de fidelite</span>
            <ChevronRight className="w-4 h-4 text-gray-300" />
          </button>
        </div>

        {/* Bouton de deconnexion */}
        <button
          onClick={handleLogout}
          className="w-full py-3.5 bg-red-50 text-red-700 font-semibold rounded-xl flex items-center justify-center gap-2 active:scale-[0.98] transition-transform border border-red-200"
        >
          <LogOut className="w-5 h-5" />
          Se deconnecter
        </button>

        {/* Version */}
        <p className="text-center text-xs text-gray-400 mt-4">
          MOVA v1.0.0 -- Conakry, Guinee
        </p>
      </div>
    </div>
  )
}
