'use client'

import { useState, useEffect } from 'react'
import { useMovaStore } from '@/lib/store'
import { apiFetch } from '@/lib/api'
import {
  ArrowLeft,
  Users,
  Copy,
  Share2,
  Gift,
  CheckCircle2,
  XCircle,
  Loader2,
  UserPlus,
  Trophy,
  TrendingUp,
} from 'lucide-react'

// --- Types ---

interface ReferralStats {
  total: number
  completed: number
  totalEarnings: number
}

interface ReferredUser {
  id: string
  name: string
  avatar: string | null
  joinedAt: string
}

interface Referral {
  id: string
  code: string
  status: string
  bonusAmount: number
  rewardedAt: string | null
  createdAt: string
  referred: ReferredUser
}

const REFERRAL_BONUS = 5000

// --- Composant principal ---

export function ReferralsView() {
  const { setCurrentView, user } = useMovaStore()

  // Donnees
  const [referralCode, setReferralCode] = useState('')
  const [stats, setStats] = useState<ReferralStats>({ total: 0, completed: 0, totalEarnings: 0 })
  const [referrals, setReferrals] = useState<Referral[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  // Appliquer un code
  const [inputCode, setInputCode] = useState('')
  const [isApplying, setIsApplying] = useState(false)
  const [applyMessage, setApplyMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Copier
  const [copied, setCopied] = useState(false)

  // Charger les donnees
  useEffect(() => {
    async function fetchData() {
      try {
        const res = await apiFetch('/api/mova/referrals')
        if (res.ok) {
          const data = await res.json()

          if (data.success && data.data) {
            setReferralCode(data.data.referralCode || '')
            setStats(data.data.stats || { total: 0, completed: 0, totalEarnings: 0 })
            setReferrals(data.data.referrals || [])
          } else {
            setError(data.error || 'Erreur de chargement')
          }
        }
      } catch {
        setError('Erreur de connexion au serveur')
      } finally {
        setIsLoading(false)
      }
    }
    fetchData()
  }, [])

  // Copier le code
  const handleCopy = () => {
    navigator.clipboard.writeText(referralCode).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // Partager le code
  const handleShare = () => {
    const message = `Utilise mon code de parrainage ${referralCode} sur MOVA pour obtenir 50% de reduction sur ta premiere course !`
    if (navigator.share) {
      navigator.share({ title: 'Code parrainage MOVA', text: message }).catch(() => {})
    } else {
      navigator.clipboard.writeText(message).catch(() => {})
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  // Appliquer un code de parrainage
  const handleApplyCode = async () => {
    if (!inputCode.trim()) return

    setIsApplying(true)
    setApplyMessage(null)

    try {
      const res = await apiFetch('/api/mova/referrals', {
        method: 'POST',
        body: JSON.stringify({ code: inputCode.trim().toUpperCase() }),
      })

      const data = await res.json()

      if (data.success) {
        setApplyMessage({ type: 'success', text: data.data?.message || 'Code applique avec succes !' })
        setInputCode('')
      } else {
        setApplyMessage({ type: 'error', text: data.error || 'Code invalide' })
      }
    } catch {
      setApplyMessage({ type: 'error', text: 'Erreur de connexion' })
    } finally {
      setIsApplying(false)
    }
  }

  // Formater la date
  const formatDate = (iso: string): string => {
    return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
  }

  // Initials
  const getInitials = (name: string): string => {
    return name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
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
        <Users className="w-5 h-5" />
        <h1 className="text-lg font-bold">Parrainage</h1>
      </header>

      <div className="px-4 py-5 space-y-5 pb-8">
        {/* Chargement */}
        {isLoading && (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-[#1e40af]" />
            <span className="ml-2 text-sm text-gray-500">Chargement...</span>
          </div>
        )}

        {/* Erreur */}
        {error && !isLoading && (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-red-600">
            <XCircle className="w-5 h-5" />
            {error}
          </div>
        )}

        {!isLoading && !error && (
          <>
            {/* Code de parrainage */}
            <div className="bg-gradient-to-br from-[#1e40af] to-blue-700 rounded-2xl p-5 text-white text-center shadow-lg">
              <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center mx-auto mb-3">
                <Gift className="w-7 h-7" />
              </div>
              <h2 className="text-base font-bold mb-1">Votre code de parrainage</h2>
              <p className="text-sm text-white/70 mb-4">
                Gagnez {REFERRAL_BONUS.toLocaleString('fr-FR')} GNF par filleul
              </p>

              <div className="flex items-center gap-2 bg-white rounded-xl p-3 mb-4">
                <span className="flex-1 text-2xl font-extrabold tracking-widest text-[#1e40af] font-mono">
                  {referralCode}
                </span>
                <button
                  onClick={handleCopy}
                  className="p-2.5 bg-[#1e40af]/10 rounded-lg hover:bg-[#1e40af]/20 transition-colors"
                >
                  {copied ? (
                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                  ) : (
                    <Copy className="w-5 h-5 text-[#1e40af]" />
                  )}
                </button>
              </div>

              <button
                onClick={handleShare}
                className="w-full py-3 bg-white text-[#1e40af] font-semibold rounded-xl flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
              >
                <Share2 className="w-4 h-4" />
                Partager le code
              </button>
            </div>

            {/* Statistiques */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-white rounded-xl p-3 text-center shadow-sm border border-gray-100">
                <UserPlus className="w-5 h-5 text-[#059669] mx-auto mb-1" />
                <p className="text-xl font-bold text-gray-800">{stats.total}</p>
                <p className="text-[10px] text-gray-500">Filleuls</p>
              </div>
              <div className="bg-white rounded-xl p-3 text-center shadow-sm border border-gray-100">
                <CheckCircle2 className="w-5 h-5 text-[#1e40af] mx-auto mb-1" />
                <p className="text-xl font-bold text-gray-800">{stats.completed}</p>
                <p className="text-[10px] text-gray-500">Completes</p>
              </div>
              <div className="bg-white rounded-xl p-3 text-center shadow-sm border border-gray-100">
                <Trophy className="w-5 h-5 text-amber-500 mx-auto mb-1" />
                <p className="text-xl font-bold text-gray-800">{stats.totalEarnings.toLocaleString('fr-FR')}</p>
                <p className="text-[10px] text-gray-500">GNF gagnes</p>
              </div>
            </div>

            {/* Appliquer un code de parrainage */}
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
              <h2 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-[#059669]" />
                Appliquer un code de parrainage
              </h2>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={inputCode}
                  onChange={(e) => { setInputCode(e.target.value.toUpperCase()); setApplyMessage(null) }}
                  placeholder="Entrer le code"
                  className="flex-1 px-4 py-3 border border-gray-200 rounded-xl text-sm uppercase bg-white focus:outline-none focus:ring-2 focus:ring-[#1e40af]/30 focus:border-[#1e40af] transition-colors"
                  onKeyDown={(e) => e.key === 'Enter' && handleApplyCode()}
                />
                <button
                  onClick={handleApplyCode}
                  disabled={isApplying || !inputCode.trim()}
                  className="px-5 py-3 bg-[#059669] text-white font-semibold rounded-xl active:scale-[0.98] transition-transform disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isApplying ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Appliquer'}
                </button>
              </div>

              {applyMessage && (
                <div className={`flex items-center gap-1.5 mt-2 text-xs ${
                  applyMessage.type === 'success' ? 'text-green-600' : 'text-red-600'
                }`}>
                  {applyMessage.type === 'success' ? (
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  ) : (
                    <XCircle className="w-3.5 h-3.5" />
                  )}
                  {applyMessage.text}
                </div>
              )}
            </div>

            {/* Liste des filleuls */}
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
              <h2 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-[#1e40af]" />
                Mes filleuls ({referrals.length})
              </h2>

              {referrals.length === 0 ? (
                <div className="text-center py-8">
                  <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-3">
                    <Users className="w-6 h-6 text-gray-400" />
                  </div>
                  <p className="text-sm text-gray-500">Aucun filleul pour le moment</p>
                  <p className="text-xs text-gray-400 mt-1">Partagez votre code pour inviter vos proches</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {referrals.map((ref) => {
                    const statusColor = ref.status === 'rewarded' ? 'bg-green-100 text-green-700'
                      : ref.status === 'pending' ? 'bg-yellow-100 text-yellow-700'
                      : 'bg-gray-100 text-gray-700'
                    const statusLabel = ref.status === 'rewarded' ? 'Recompense'
                      : ref.status === 'pending' ? 'En attente'
                      : ref.status
                    return (
                      <div key={ref.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                        <div className="w-9 h-9 rounded-full bg-[#1e40af]/10 flex items-center justify-center text-xs font-bold text-[#1e40af]">
                          {ref.referred ? getInitials(ref.referred.name) : '??'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-800 truncate">
                            {ref.referred?.name || 'Inconnu'}
                          </p>
                          <p className="text-[11px] text-gray-400">
                            {ref.referred?.joinedAt ? formatDate(ref.referred.joinedAt) : ''}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-bold text-[#059669]">{ref.bonusAmount.toLocaleString('fr-FR')} GNF</p>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${statusColor}`}>
                            {statusLabel}
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
