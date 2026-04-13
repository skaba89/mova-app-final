import { create } from 'zustand'

// Types pour le panier alimentaire
export interface FoodCartItem {
  id: string
  name: string
  price: number
  quantity: number
  image?: string
  restaurantId: string
  restaurantName?: string
  notes?: string
}

// Types pour l'utilisateur courant
export interface MovaUser {
  id: string
  name: string
  email: string
  role: string
  phone?: string
  avatar?: string
}

// Types pour la localisation selectionnee
export interface SelectedLocation {
  lat: number
  lng: number
  address: string
}

// Interface de l'etat du magasin
interface MovaState {
  // Vue courante de l'application
  currentView: string
  setCurrentView: (view: string) => void

  // Utilisateur courant
  user: MovaUser | null
  setUser: (user: MovaUser | null) => void
  logout: () => void
  isAuthenticated: boolean

  // Panier alimentaire
  foodCart: FoodCartItem[]
  addToCart: (item: Omit<FoodCartItem, 'quantity'> & { quantity?: number }) => void
  removeFromCart: (itemId: string) => void
  updateCartQuantity: (itemId: string, quantity: number) => void
  clearCart: () => void
  cartTotal: () => number

  // Localisation selectionnee
  selectedLocation: SelectedLocation | null
  setSelectedLocation: (location: SelectedLocation | null) => void
}

// Magasin d'etat Zustand pour MOVA
export const useMovaStore = create<MovaState>((set, get) => ({
  // --- Vue courante ---
  currentView: 'hub',
  setCurrentView: (view) => set({ currentView: view }),

  // --- Utilisateur ---
  user: null,
  setUser: (user) =>
    set({
      user,
      isAuthenticated: user !== null,
    }),
  logout: () =>
    set({
      user: null,
      isAuthenticated: false,
      foodCart: [],
    }),
  isAuthenticated: false,

  // --- Panier alimentaire ---
  foodCart: [],

  addToCart: (item) => {
    const { foodCart } = get()
    const existingIndex = foodCart.findIndex((cartItem) => cartItem.id === item.id)

    if (existingIndex >= 0) {
      // Mettre a jour la quantite si l'article existe deja
      const updatedCart = [...foodCart]
      updatedCart[existingIndex] = {
        ...updatedCart[existingIndex],
        quantity: updatedCart[existingIndex].quantity + (item.quantity ?? 1),
      }
      set({ foodCart: updatedCart })
    } else {
      // Ajouter un nouvel article
      set({
        foodCart: [
          ...foodCart,
          {
            ...item,
            quantity: item.quantity ?? 1,
          },
        ],
      })
    }
  },

  removeFromCart: (itemId) => {
    set({ foodCart: get().foodCart.filter((item) => item.id !== itemId) })
  },

  updateCartQuantity: (itemId, quantity) => {
    if (quantity <= 0) {
      // Supprimer l'article si la quantite est zero ou negative
      get().removeFromCart(itemId)
      return
    }

    const { foodCart } = get()
    const updatedCart = foodCart.map((item) =>
      item.id === itemId ? { ...item, quantity } : item
    )
    set({ foodCart: updatedCart })
  },

  clearCart: () => set({ foodCart: [] }),

  cartTotal: () => {
    const { foodCart } = get()
    return foodCart.reduce((total, item) => total + item.price * item.quantity, 0)
  },

  // --- Localisation ---
  selectedLocation: null,
  setSelectedLocation: (location) => set({ selectedLocation: location }),
}))
