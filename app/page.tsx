'use client'

import { useMovaStore } from '@/lib/store'
import { AuthView } from '@/components/mova/auth-view'
import { HubView } from '@/components/mova/hub-view'
import { RidesView } from '@/components/mova/rides-view'
import { WalletView } from '@/components/mova/wallet-view'
import { NotificationsView } from '@/components/mova/notifications-view'
import { ProfileView } from '@/components/mova/profile-view'
import { FoodView } from '@/components/mova/food-view'
import { RestaurantView } from '@/components/mova/restaurant-view'
import { FoodCartView } from '@/components/mova/foodcart-view'
import { FoodTrackingView } from '@/components/mova/foodtracking-view'
import { DeliveriesView } from '@/components/mova/deliveries-view'
import { CarpoolView } from '@/components/mova/carpool-view'
import { BookingsView } from '@/components/mova/bookings-view'
import { LoyaltyView } from '@/components/mova/loyalty-view'
import { PromotionsView } from '@/components/mova/promotions-view'
import { ReferralsView } from '@/components/mova/referrals-view'
import { IncidentsView } from '@/components/mova/incidents-view'
import { AdminMonitoringView } from '@/components/mova/admin-monitoring-view'
import { MotoView } from '@/components/mova/moto-view'
import { BusinessView } from '@/components/mova/business-view'
import { Construction, ArrowLeft } from 'lucide-react'

/**
 * Composant affiche pour les vues pas encore implementees.
 */
function UnavailableView({ view }: { view: string }) {
  const { setCurrentView } = useMovaStore()

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-4 bg-gray-50">
      <Construction className="w-16 h-16 text-gray-300 mb-4" />
      <h2 className="text-xl font-bold text-gray-700 mb-2">Service indisponible</h2>
      <p className="text-gray-500 text-center mb-6">
        Le service <span className="font-semibold text-gray-700">{view}</span> sera bientot disponible.
      </p>
      <button
        onClick={() => setCurrentView('hub')}
        className="flex items-center gap-2 px-6 py-3 bg-[#1e40af] text-white rounded-xl font-medium active:scale-95 transition-transform"
      >
        <ArrowLeft className="w-4 h-4" />
        Retour a l&apos;accueil
      </button>
    </div>
  )
}

/**
 * Composant temporaire pour les vues qui seront construites prochainement.
 * Utilise un rendu conditionnel - pas de chargement dynamique.
 */
function PlaceholderView({ viewName }: { viewName: string }) {
  return <UnavailableView view={viewName} />
}

/**
 * Page principale - unique routeur de l'application MOVA.
 * Utilise le store Zustand pour determiner la vue active.
 */
export default function MovaPage() {
  const { currentView, isAuthenticated } = useMovaStore()

  // Si l'utilisateur n'est pas authentifie, forcer la vue auth
  if (!isAuthenticated && currentView !== 'auth') {
    return <AuthView />
  }

  // Rendu conditionnel en fonction de la vue courante
  switch (currentView) {
    case 'auth':
      return <AuthView />

    case 'hub':
      return <HubView />

    // --- Vues implementees ---
    case 'rides':
      return <RidesView />

    case 'wallet':
      return <WalletView />

    case 'notifications':
      return <NotificationsView />

    case 'profile':
      return <ProfileView />

    // --- Vues Food ---
    case 'food':
      return <FoodView />

    case 'restaurant':
      return <RestaurantView />

    case 'foodcart':
      return <FoodCartView />

    case 'foodtracking':
      return <FoodTrackingView />

    case 'deliveries':
      return <DeliveriesView />

    case 'bookings':
      return <BookingsView />

    case 'carpool':
      return <CarpoolView />

    case 'moto':
      return <MotoView />

    case 'navigation':
      return <PlaceholderView viewName="Navigation" />

    case 'transfer':
      return <PlaceholderView viewName="Transfert" />

    case 'carrental':
      return <PlaceholderView viewName="Location voiture" />

    case 'loyalty':
      return <LoyaltyView />

    case 'promotions':
      return <PromotionsView />

    case 'referrals':
      return <ReferralsView />

    case 'admin-monitoring':
      return <AdminMonitoringView />

    case 'assistant':
      return <PlaceholderView viewName="Assistant" />

    case 'incidents':
      return <IncidentsView />

    case 'business':
      return <BusinessView />

    default:
      return <UnavailableView view={currentView} />
  }
}
