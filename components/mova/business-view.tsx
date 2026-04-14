'use client'

import { useState, useEffect, useCallback } from 'react'
import { useMovaStore } from '@/lib/store'
import { apiFetch } from '@/lib/api'
import {
  ArrowLeft,
  Building2,
  Users,
  Wallet,
  BarChart3,
  FileText,
  ChevronRight,
  Plus,
  Clock,
  Loader2,
  CheckCircle2,
  XCircle,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

// --- Types ---

interface BusinessAccount {
  id: string
  name: string
  email: string
  phone: string | null
  subscriptionPlan: string
  currentSpend: number
  monthlyLimit: number
  status: string
  createdAt: string
}

interface Employee {
  id: string
  name: string
  email: string
  role: string
  currentSpend: number
  monthlyLimit: number
  isActive: boolean
}

// --- Constantes ---

const PLAN_LABELS: Record<string, { label: string; color: string }> = {
  free: { label: 'Gratuit', color: 'bg-gray-100 text-gray-600' },
  basic: { label: 'Basic', color: 'bg-blue-100 text-blue-600' },
  premium: { label: 'Premium', color: 'bg-purple-100 text-purple-600' },
  enterprise: { label: 'Enterprise', color: 'bg-amber-100 text-amber-600' },
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  active: { label: 'Actif', color: 'bg-green-100 text-green-800' },
  inactive: { label: 'Inactif', color: 'bg-gray-100 text-gray-800' },
  suspended: { label: 'Suspendu', color: 'bg-red-100 text-red-800' },
  trial: { label: 'Essai', color: 'bg-blue-100 text-blue-800' },
}

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
  } catch {
    return dateStr
  }
}

/**
 * Vue Espace Professionnel - gestion de compte entreprise,
 * employes, depenses et limites.
 */
export function BusinessView() {
  const { setCurrentView, user } = useMovaStore()

  const [businesses, setBusinesses] = useState<BusinessAccount[]>([])
  const [selectedBusiness, setSelectedBusiness] = useState<BusinessAccount | null>(null)
  const [employees, setEmployees] = useState<Employee[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [showDetail, setShowDetail] = useState(false)

  const fetchBusinesses = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await apiFetch('/api/mova/business')
      if (res.ok) {
        const data = await res.json()
        if (data.success) {
          setBusinesses(data.data?.businesses || [])
        }
      }
    } catch {
      // Silencieux
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchBusinesses()
  }, [fetchBusinesses])

  const fetchEmployees = useCallback(async (businessId: string) => {
    try {
      const res = await apiFetch(`/api/mova/business?businessId=${businessId}`)
      if (res.ok) {
        const data = await res.json()
        if (data.success && data.data?.employees) {
          setEmployees(data.data.employees)
        }
      }
    } catch {
      // Silencieux
    }
  }, [])

  const openBusiness = (business: BusinessAccount) => {
    setSelectedBusiness(business)
    setShowDetail(true)
    fetchEmployees(business.id)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* En-tete */}
      <header className="bg-[#1e40af] text-white px-4 py-4 flex items-center gap-3 sticky top-0 z-10">
        <button
          onClick={() => setShowDetail(false) || setCurrentView('hub')}
          className="p-2 -ml-2 rounded-xl bg-white/10 active:scale-95 transition-transform"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <Building2 className="w-5 h-5" />
        <h1 className="text-lg font-bold">Espace Pro</h1>
      </header>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-[#1e40af] animate-spin" />
        </div>
      ) : showDetail && selectedBusiness ? (
        /* Detail d'un compte */
        <div className="px-4 py-5 space-y-5 pb-8">
          <button onClick={() => setShowDetail(false)} className="text-sm text-[#1e40af] font-medium flex items-center gap-1">
            <ArrowLeft className="w-4 h-4" /> Retour
          </button>

          {/* Carte compte */}
          <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-bold text-gray-900">{selectedBusiness.name}</h2>
              <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${STATUS_LABELS[selectedBusiness.status]?.color || 'bg-gray-100'}`}>
                {STATUS_LABELS[selectedBusiness.status]?.label || selectedBusiness.status}
              </span>
            </div>
            <div className="space-y-2 text-sm">
              <p className="text-gray-600">{selectedBusiness.email}</p>
              {selectedBusiness.phone && <p className="text-gray-500">{selectedBusiness.phone}</p>}
              <p className="text-gray-400 text-xs">Membre depuis {formatDate(selectedBusiness.createdAt)}</p>
            </div>
            <div className="mt-4 flex items-center gap-2">
              <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${PLAN_LABELS[selectedBusiness.subscriptionPlan]?.color || 'bg-gray-100'}`}>
                {PLAN_LABELS[selectedBusiness.subscriptionPlan]?.label || selectedBusiness.subscriptionPlan}
              </span>
            </div>
          </div>

          {/* Stats depenses */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
              <Wallet className="w-5 h-5 text-green-600 mb-2" />
              <p className="text-xs text-gray-500">Depenses du mois</p>
              <p className="text-lg font-bold text-gray-800">{selectedBusiness.currentSpend.toLocaleString()} GNF</p>
            </div>
            <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
              <BarChart3 className="w-5 h-5 text-blue-600 mb-2" />
              <p className="text-xs text-gray-500">Limite mensuelle</p>
              <p className="text-lg font-bold text-gray-800">{selectedBusiness.monthlyLimit.toLocaleString()} GNF</p>
            </div>
          </div>

          {/* Barre de progression */}
          <div className="bg-white rounded-xl p-4 border border-gray-100">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-gray-600">Utilisation budget</span>
              <span className="text-xs font-semibold text-gray-800">
                {selectedBusiness.monthlyLimit > 0 ? Math.round((selectedBusiness.currentSpend / selectedBusiness.monthlyLimit) * 100) : 0}%
              </span>
            </div>
            <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  selectedBusiness.currentSpend / Math.max(1, selectedBusiness.monthlyLimit) > 0.8 ? 'bg-red-500' : 'bg-green-500'
                }`}
                style={{
                  width: `${Math.min(100, (selectedBusiness.currentSpend / Math.max(1, selectedBusiness.monthlyLimit)) * 100)}%`,
                }}
              />
            </div>
          </div>

          {/* Employes */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <Users className="w-4 h-4" />
              Employes ({employees.length})
            </h3>
            {employees.length === 0 ? (
              <div className="text-center py-8 bg-white rounded-xl border border-gray-100">
                <Users className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-500">Aucun employe</p>
              </div>
            ) : (
              <div className="space-y-2">
                {employees.map((emp) => (
                  <div key={emp.id} className="p-3 bg-white rounded-xl border border-gray-100 shadow-sm">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold text-gray-800">{emp.name}</p>
                        <p className="text-xs text-gray-500">{emp.email}</p>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${emp.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                        {emp.role}
                      </span>
                    </div>
                    <div className="mt-2 flex items-center justify-between text-xs text-gray-400">
                      <span>Depense: {emp.currentSpend.toLocaleString()} GNF</span>
                      <span>Limite: {emp.monthlyLimit.toLocaleString()} GNF</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Liste des comptes */
        <div className="px-4 py-5 space-y-5 pb-8">
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
              <XCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}

          {businesses.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
                <Building2 className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-base font-semibold text-gray-700 mb-1">Aucun compte professionnel</h3>
              <p className="text-sm text-gray-500 mb-6">
                Creez un compte entreprise pour gerer les deplacements de vos equipes
              </p>
              <button className="px-6 py-3 bg-[#1e40af] text-white font-semibold rounded-xl flex items-center justify-center gap-2 mx-auto active:scale-[0.98] transition-transform">
                <Plus className="w-4 h-4" />
                Creer un compte
              </button>
            </div>
          ) : (
            <div>
              <h2 className="text-sm font-semibold text-gray-700 mb-3">
                Mes comptes ({businesses.length})
              </h2>
              <div className="space-y-3">
                {businesses.map((biz) => {
                  const plan = PLAN_LABELS[biz.subscriptionPlan]
                  const status = STATUS_LABELS[biz.status]
                  return (
                    <button
                      key={biz.id}
                      onClick={() => openBusiness(biz)}
                      className="w-full p-4 bg-white rounded-xl border border-gray-100 shadow-sm text-left active:scale-[0.99] transition-transform"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-[#1e40af]/10 rounded-xl flex items-center justify-center">
                            <Building2 className="w-5 h-5 text-[#1e40af]" />
                          </div>
                          <div>
                            <p className="text-sm font-bold text-gray-800">{biz.name}</p>
                            <p className="text-xs text-gray-500">{biz.email}</p>
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-gray-300" />
                      </div>
                      <div className="flex items-center gap-2 ml-13">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${plan?.color || 'bg-gray-100'}`}>
                          {plan?.label || biz.subscriptionPlan}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${status?.color || 'bg-gray-100'}`}>
                          {status?.label || biz.status}
                        </span>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Avantages Pro */}
          <div className="bg-gradient-to-br from-[#1e40af] to-[#1e3a8a] rounded-2xl p-4 text-white">
            <h3 className="font-bold text-base mb-2">Avantages Pro</h3>
            <ul className="space-y-2 text-sm text-blue-100">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-300 shrink-0" />
                Gestion des depenses equipes
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-300 shrink-0" />
                Facturation mensuelle unifiee
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-300 shrink-0" />
                Limites de budget par employe
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-300 shrink-0" />
                Rapports de consommation
              </li>
            </ul>
          </div>
        </div>
      )}
    </div>
  )
}
