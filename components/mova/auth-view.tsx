'use client'

import { useState, useEffect } from 'react'
import { useMovaStore, type MovaUser } from '@/lib/store'
import { Eye, EyeOff, Mail, Lock, User, Phone, MapPin, ArrowRight } from 'lucide-react'

type AuthMode = 'login' | 'register'
type UserRole = 'client' | 'chauffeur' | 'restaurant' | 'commercant'

interface AuthFormData {
  name: string
  email: string
  phone: string
  password: string
  confirmPassword: string
  role: UserRole
}

interface AuthFormErrors {
  [key: string]: string
}

const INITIAL_FORM: AuthFormData = {
  name: '',
  email: '',
  phone: '',
  password: '',
  confirmPassword: '',
  role: 'client',
}

/**
 * Vue d'authentification - connexion et inscription.
 * Gere les deux modes via un toggle.
 */
export function AuthView() {
  const { setUser, setCurrentView } = useMovaStore()
  const [mode, setMode] = useState<AuthMode>('login')
  const [form, setForm] = useState<AuthFormData>(INITIAL_FORM)
  const [errors, setErrors] = useState<AuthFormErrors>({})
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [serverError, setServerError] = useState('')

  // Verification du token existant au chargement
  useEffect(() => {
    const token = localStorage.getItem('mova_token')
    const savedUser = localStorage.getItem('mova_user')
    if (token && savedUser) {
      // Valider le token aupres du serveur avant de restaurer la session
      fetch('/api/mova/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: 'me' }),
      })
        .then((res) => {
          if (!res.ok) throw new Error('Token invalide')
          return res.json()
        })
        .then((data) => {
          if (data.success && data.data?.user) {
            setUser({
              id: data.data.user.id,
              name: data.data.user.name,
              email: data.data.user.email,
              role: data.data.user.role,
              phone: data.data.user.phone,
            })
            setCurrentView('hub')
          } else {
            throw new Error('Token invalide')
          }
        })
        .catch(() => {
          localStorage.removeItem('mova_token')
          localStorage.removeItem('mova_user')
        })
    }
  }, [setUser, setCurrentView])

  const updateField = (field: keyof AuthFormData, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }))
    // Effacer l'erreur du champ modifie
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev }
        delete next[field]
        return next
      })
    }
  }

  const validate = (): boolean => {
    const newErrors: AuthFormErrors = {}

    if (mode === 'register') {
      if (!form.name.trim()) newErrors.name = 'Le nom est requis'
      if (form.name.trim().length < 2) newErrors.name = 'Le nom doit contenir au moins 2 caracteres'
    }

    if (!form.email.trim()) {
      newErrors.email = "L'adresse email est requise"
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      newErrors.email = 'Adresse email invalide'
    }

    if (!form.password) {
      newErrors.password = 'Le mot de passe est requis'
    } else if (form.password.length < 6) {
      newErrors.password = 'Le mot de passe doit contenir au moins 6 caracteres'
    }

    if (mode === 'register') {
      if (form.password !== form.confirmPassword) {
        newErrors.confirmPassword = 'Les mots de passe ne correspondent pas'
      }
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setServerError('')

    if (!validate()) return

    setIsLoading(true)

    try {
      const endpoint = '/api/mova/auth'
      const body: Record<string, string> = {
        action: mode,
        email: form.email.trim(),
        password: form.password,
      }

      if (mode === 'register') {
        body.name = form.name.trim()
        if (form.phone.trim()) {
          body.phone = form.phone.trim()
        }
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      const data = await response.json()

      if (!data.success) {
        setServerError(data.error || "Une erreur s'est produite")
        return
      }

      // Stocker le JWT et les infos utilisateur
      const { user, token } = data.data
      localStorage.setItem('mova_token', token)
      localStorage.setItem('mova_user', JSON.stringify(user))

      // Mettre a jour le store Zustand
      setUser({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone,
      })

      setCurrentView('hub')
    } catch {
      setServerError('Erreur de connexion au serveur. Verifiez votre connexion internet.')
    } finally {
      setIsLoading(false)
    }
  }

  const toggleMode = () => {
    setMode((prev) => (prev === 'login' ? 'register' : 'login'))
    setForm(INITIAL_FORM)
    setErrors({})
    setServerError('')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1e40af] to-[#1e3a8a] flex flex-col">
      {/* En-tete */}
      <div className="pt-12 pb-8 px-6 text-center">
        <h1 className="text-4xl font-extrabold text-white tracking-tight">MOVA</h1>
        <p className="text-blue-200 mt-2 text-sm">Mobilite, Livraison, Food -- tout a Conakry</p>
      </div>

      {/* Formulaire */}
      <div className="flex-1 bg-white rounded-t-3xl px-6 pt-8 pb-6">
        {/* Onglets */}
        <div className="flex bg-gray-100 rounded-xl p-1 mb-6">
          <button
            type="button"
            onClick={() => setMode('login')}
            className={`flex-1 py-3 text-sm font-semibold rounded-lg transition-all ${
              mode === 'login'
                ? 'bg-[#1e40af] text-white shadow-sm'
                : 'text-gray-500'
            }`}
          >
            Connexion
          </button>
          <button
            type="button"
            onClick={() => setMode('register')}
            className={`flex-1 py-3 text-sm font-semibold rounded-lg transition-all ${
              mode === 'register'
                ? 'bg-[#1e40af] text-white shadow-sm'
                : 'text-gray-500'
            }`}
          >
            Inscription
          </button>
        </div>

        {/* Erreur serveur */}
        {serverError && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
            {serverError}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Nom (inscription uniquement) */}
          {mode === 'register' && (
            <div>
              <label htmlFor="auth-name" className="block text-sm font-medium text-gray-700 mb-1">
                Nom complet
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  id="auth-name"
                  type="text"
                  value={form.name}
                  onChange={(e) => updateField('name', e.target.value)}
                  placeholder="Votre nom"
                  autoComplete="name"
                  className={`w-full pl-11 pr-4 py-3 border rounded-xl text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#1e40af]/30 focus:border-[#1e40af] transition-colors ${
                    errors.name ? 'border-red-400 bg-red-50' : 'border-gray-200'
                  }`}
                />
              </div>
              {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name}</p>}
            </div>
          )}

          {/* Email */}
          <div>
            <label htmlFor="auth-email" className="block text-sm font-medium text-gray-700 mb-1">
              Adresse email
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                id="auth-email"
                type="email"
                value={form.email}
                onChange={(e) => updateField('email', e.target.value)}
                placeholder="votre@email.com"
                autoComplete="email"
                className={`w-full pl-11 pr-4 py-3 border rounded-xl text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#1e40af]/30 focus:border-[#1e40af] transition-colors ${
                  errors.email ? 'border-red-400 bg-red-50' : 'border-gray-200'
                }`}
              />
            </div>
            {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email}</p>}
          </div>

          {/* Telephone (inscription uniquement) */}
          {mode === 'register' && (
            <div>
              <label htmlFor="auth-phone" className="block text-sm font-medium text-gray-700 mb-1">
                Numero de telephone
              </label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  id="auth-phone"
                  type="tel"
                  value={form.phone}
                  onChange={(e) => updateField('phone', e.target.value)}
                  placeholder="+224 6XX XX XX XX"
                  autoComplete="tel"
                  className="w-full pl-11 pr-4 py-3 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#1e40af]/30 focus:border-[#1e40af] transition-colors"
                />
              </div>
            </div>
          )}

          {/* Mot de passe */}
          <div>
            <label htmlFor="auth-password" className="block text-sm font-medium text-gray-700 mb-1">
              Mot de passe
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                id="auth-password"
                type={showPassword ? 'text' : 'password'}
                value={form.password}
                onChange={(e) => updateField('password', e.target.value)}
                placeholder={mode === 'register' ? 'Minimum 6 caracteres' : 'Votre mot de passe'}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                className={`w-full pl-11 pr-12 py-3 border rounded-xl text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#1e40af]/30 focus:border-[#1e40af] transition-colors ${
                  errors.password ? 'border-red-400 bg-red-50' : 'border-gray-200'
                }`}
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 p-1"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
            {errors.password && <p className="mt-1 text-xs text-red-600">{errors.password}</p>}
          </div>

          {/* Confirmation mot de passe (inscription uniquement) */}
          {mode === 'register' && (
            <div>
              <label htmlFor="auth-confirm" className="block text-sm font-medium text-gray-700 mb-1">
                Confirmer le mot de passe
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  id="auth-confirm"
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={form.confirmPassword}
                  onChange={(e) => updateField('confirmPassword', e.target.value)}
                  placeholder="Repetez le mot de passe"
                  autoComplete="new-password"
                  className={`w-full pl-11 pr-12 py-3 border rounded-xl text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#1e40af]/30 focus:border-[#1e40af] transition-colors ${
                    errors.confirmPassword ? 'border-red-400 bg-red-50' : 'border-gray-200'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((prev) => !prev)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 p-1"
                >
                  {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              {errors.confirmPassword && <p className="mt-1 text-xs text-red-600">{errors.confirmPassword}</p>}
            </div>
          )}

          {/* Selecteur de role (inscription uniquement) */}
          {mode === 'register' && (
            <div>
              <label htmlFor="auth-role" className="block text-sm font-medium text-gray-700 mb-1">
                Vous etes
              </label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <select
                  id="auth-role"
                  value={form.role}
                  onChange={(e) => updateField('role', e.target.value)}
                  className="w-full pl-11 pr-4 py-3 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#1e40af]/30 focus:border-[#1e40af] transition-colors appearance-none"
                >
                  <option value="client">Client</option>
                  <option value="chauffeur">Chauffeur</option>
                  <option value="restaurant">Restaurant</option>
                  <option value="commercant">Commercant</option>
                </select>
              </div>
            </div>
          )}

          {/* Bouton de soumission */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3.5 bg-[#1e40af] text-white font-semibold rounded-xl flex items-center justify-center gap-2 active:scale-[0.98] transition-transform disabled:opacity-60 disabled:cursor-not-allowed shadow-lg shadow-blue-900/20 mt-6"
          >
            {isLoading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                {mode === 'login' ? 'Se connecter' : "S'inscrire"}
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Lien de bascule */}
        <div className="mt-6 text-center text-sm text-gray-500">
          {mode === 'login' ? (
            <>
              Pas encore de compte ?{' '}
              <button
                type="button"
                onClick={toggleMode}
                className="text-[#1e40af] font-semibold"
              >
                Creer un compte
              </button>
            </>
          ) : (
            <>
              Deja inscrit ?{' '}
              <button
                type="button"
                onClick={toggleMode}
                className="text-[#1e40af] font-semibold"
              >
                Se connecter
              </button>
            </>
          )}
        </div>

        {/* Pied de page */}
        <p className="text-center text-xs text-gray-400 mt-8">
          Conakry, Guinee -- MOVA Technologies
        </p>
      </div>
    </div>
  )
}
