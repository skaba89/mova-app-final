// Fonction API centralisee avec gestion du token et des erreurs 401
// Toutes les vues doivent utiliser cette fonction au lieu de fetch() directement

import { useMovaStore } from './store'

interface ApiFetchOptions extends RequestInit {
  skipAuth?: boolean
}

export async function apiFetch(url: string, options: ApiFetchOptions = {}): Promise<Response> {
  const { skipAuth = false, ...fetchOptions } = options
  const token = typeof window !== 'undefined' ? localStorage.getItem('mova_token') : null

  const headers = new Headers(fetchOptions.headers)

  if (!skipAuth && token) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  if (!headers.has('Content-Type') && !(fetchOptions.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json')
  }

  const response = await fetch(url, {
    ...fetchOptions,
    headers,
  })

  // Gestion automatique des 401 - deconnecter l'utilisateur
  if (response.status === 401 && token) {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('mova_token')
      localStorage.removeItem('mova_user')
      useMovaStore.getState().logout()
      useMovaStore.getState().setCurrentView('auth')
    }
  }

  return response
}
