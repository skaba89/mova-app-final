'use client'

import { useState, useEffect } from 'react'
import { useMovaStore } from '@/lib/store'
import {
  ArrowLeft,
  Gift,
  Tag,
  Clock,
  CheckCircle2,
  XCircle,
  Copy,
  CalendarDays,
  Users,
  Percent,
  Truck,
  Loader2,
} from 'lucide-react'

// --- Types ---

interface Promotion {
  id: string
  code: string
  title: string
  description: string
  type: string
  discountValue: number
  minAmount: number
  maxDiscount: number
  validFrom: string
  validUntil: string
  status: string
  usageCount: number
  usageLimit: number
}

// --- Composant principal ---

export function PromotionsView() {
  const { setCurrentView } = useMovaStore()

  // Promotions
  const [promotions, setPromotions] = useState<Promotion[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  // Code promo
  const [promoCode, setPromoCode] = useState('')
  const [isApplying, setIsApplying] = useState(false)
  const [appliedCode, setAppliedCode] = useState<string | null>(null)
  const [applyError, setApplyError] = useState('')
  const [applySuccess, setApplySuccess] = useState('')

  // Copier
  const [copiedCode, setCopiedCode] = useState<string | null>(null)

  // Charger les promotions
  useEffect(() => {
    async function fetchPromotions() {
      try {
        const res = await fetch('/api/mova/promotions')
        const data = await res.json()
        if (data.success && data.data?.promotions) {
          setPromotions(data.data.promotions)
        }
      } catch {
        setError('Impossible de charger les promotions')
      } finally {
        setIsLoading(false)
      }
    }
    fetchPromotions()
  }, [])

  // Copier un code
  const handleCopy = (code: string) => {
    navigator.clipboard.writeText(code).catch(() => {})
    setCopiedCode(code)
    setTimeout(() => setCopiedCode(null), 2000)
  }

  // Appliquer un code promo
  const handleApplyCode = async () => {
    if (!promoCode.trim()) {
      setApplyError('Entrez un code promotionnel')
      return
    }

    setIsApplying(true)
    setApplyError('')
    setApplySuccess('')

    try {
      const token = localStorage.getItem('mova_token')
      const res = await fetch('/api/mova/promotions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ code: promoCode.trim().toUpperCase() }),
      })

      const data = await res.json()

      if (data.success) {
        setAppliedCode(promoCode.trim().toUpperCase())
        setApplySuccess(data.data?.message || 'Promotion appliquee avec succes !')
        setPromoCode('')
      } else {
        setApplyError(data.error || 'Code invalide')
      }
    } catch {
      setApplyError('Erreur de connexion au serveur')
    } finally {
      setIsApplying(false)
    }
  }

  // Formater la valeur de remise
  const formatDiscount = (promo: Promotion): string => {
    if (promo.type === 'percentage') return `${promo.discountValue}%`
    if (promo.type === 'fixed') return `${promo.discountValue.toLocaleString()} GNF`
    if (promo.type === 'free_delivery') return 'Livraison gratuite'
    if (promo.type === 'free_ride') return 'Course gratuite'
    return `${promo.discountValue.toLocaleString()} GNF`
  }

  // Formater les dates
  const formatDate = (dateStr: string): string => {
    if (!dateStr) return ''
    return new Date(dateStr).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
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
        <Gift className="w-5 h-5" />
        <h1 className="text-lg font-bold">Promotions</h1>
      </header>

      <div className="px-4 py-5 space-y-5 pb-8">
        {/* Section appliquer un code */}
        <div className="p-4 bg-white border border-amber-200 rounded-2xl shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <Tag className="w-5 h-5 text-amber-600" />
            <span className="text-sm font-semibold text-gray-800">Vous avez un code promo ?</span>
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              value={promoCode}
              onChange={(e) => { setPromoCode(e.target.value.toUpperCase()); setApplyError(''); setApplySuccess('') }}
              placeholder="Entrer le code"
              className="flex-1 px-4 py-3 border border-gray-200 rounded-xl text-sm uppercase bg-white focus:outline-none focus:ring-2 focus:ring-[#1e40af]/30 focus:border-[#1e40af] transition-colors"
              onKeyDown={(e) => e.key === 'Enter' && handleApplyCode()}
            />
            <button
              onClick={handleApplyCode}
              disabled={isApplying || !promoCode.trim()}
              className="px-5 py-3 bg-[#059669] text-white font-semibold rounded-xl active:scale-[0.98] transition-transform disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isApplying ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Appliquer'}
            </button>
          </div>

          {applyError && (
            <div className="flex items-center gap-1.5 mt-2 text-xs text-red-600">
              <XCircle className="w-3.5 h-3.5 shrink-0" />
              {applyError}
            </div>
          )}
          {applySuccess && (
            <div className="flex items-center gap-1.5 mt-2 text-xs text-green-600">
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              {applySuccess}
            </div>
          )}
          {appliedCode && (
            <div className="mt-2 flex items-center justify-between bg-green-50 border border-green-200 rounded-lg px-3 py-2">
              <div className="flex items-center gap-1.5 text-xs text-green-700">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Code &quot;{appliedCode}&quot; actif
              </div>
              <button onClick={() => setAppliedCode(null)} className="text-gray-400 hover:text-gray-600">
                <XCircle className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* Chargement */}
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-[#1e40af]" />
            <span className="ml-2 text-sm text-gray-500">Chargement des promotions...</span>
          </div>
        )}

        {/* Erreur */}
        {error && !isLoading && (
          <div className="flex items-center justify-center gap-2 py-12 text-sm text-red-600">
            <XCircle className="w-5 h-5" />
            {error}
          </div>
        )}

        {/* Liste des promotions */}
        {!isLoading && !error && promotions.length === 0 && (
          <div className="text-center py-12">
            <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
              <Gift className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-base font-semibold text-gray-700 mb-1">Aucune promotion disponible</h3>
            <p className="text-sm text-gray-500">Revenez bientot pour de nouvelles offres.</p>
          </div>
        )}

        {!isLoading && !error && promotions.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-gray-700">
              Offres en cours ({promotions.length})
            </h2>

            {promotions.map((promo) => (
              <div key={promo.id} className="p-4 bg-white border border-gray-100 rounded-2xl shadow-sm space-y-3">
                {/* En-tete de la carte */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-[#1e40af]/10 text-[#1e40af]">
                      {formatDiscount(promo)}
                    </span>
                    {promo.type === 'percentage' && (
                      <Percent className="w-4 h-4 text-[#1e40af]" />
                    )}
                    {promo.type === 'free_delivery' && (
                      <Truck className="w-4 h-4 text-[#059669]" />
                    )}
                  </div>
                  <button
                    onClick={() => handleCopy(promo.code)}
                    className="flex items-center gap-1 px-2.5 py-1.5 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors active:scale-[0.97]"
                  >
                    {copiedCode === promo.code ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
                    ) : (
                      <Copy className="w-3.5 h-3.5 text-gray-500" />
                    )}
                    <span className="text-xs font-medium text-gray-600">
                      {copiedCode === promo.code ? 'Copie' : promo.code}
                    </span>
                  </button>
                </div>

                {/* Titre et description */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-800">{promo.title || promo.code}</h3>
                  {promo.description && (
                    <p className="text-xs text-gray-500 mt-0.5">{promo.description}</p>
                  )}
                </div>

                {/* Dates et utilisation */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs text-gray-400">
                    <CalendarDays className="w-3.5 h-3.5" />
                    <span>{formatDate(promo.validFrom)} - {formatDate(promo.validUntil)}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-gray-400">
                    <Users className="w-3.5 h-3.5" />
                    <span>{promo.usageCount}/{promo.usageLimit}</span>
                  </div>
                </div>

                {/* Barre d'utilisation */}
                <div className="w-full bg-gray-100 rounded-full h-1.5">
                  <div
                    className="h-1.5 rounded-full bg-[#059669] transition-all"
                    style={{ width: `${Math.min((promo.usageCount / promo.usageLimit) * 100, 100)}%` }}
                  />
                </div>

                {/* Bouton utiliser */}
                <button
                  onClick={() => { setPromoCode(promo.code); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
                  className="w-full py-2.5 bg-[#1e40af]/5 text-[#1e40af] font-semibold rounded-xl text-sm hover:bg-[#1e40af]/10 transition-colors active:scale-[0.98]"
                >
                  Utiliser le code
                </button>

                {/* Info montant minimum */}
                {promo.minAmount > 0 && (
                  <p className="text-[10px] text-gray-400 text-center">
                    Minimum : {promo.minAmount.toLocaleString()} GNF
                    {promo.maxDiscount > 0 && ` -- Reduction maximale : ${promo.maxDiscount.toLocaleString()} GNF`}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
