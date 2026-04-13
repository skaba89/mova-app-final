'use client'

import { useState, useEffect, useCallback } from 'react'
import { useMovaStore } from '@/lib/store'
import {
  ArrowLeft,
  Plus,
  ArrowUpRight,
  ArrowDownLeft,
  RefreshCw,
  Send,
  Wallet as WalletIcon,
  CreditCard,
  Banknote,
  Zap,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  XCircle,
  Loader2,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

// --- Types ---

interface WalletData {
  id: string
  balance: number
  currency: string
}

interface Transaction {
  id: string
  type: string
  amount: number
  method: string
  description: string
  status: string
  createdAt: string
}

type TopUpMethod = 'mobile_money' | 'bank_transfer' | 'card'

// --- Constantes ---

const TOPUP_AMOUNTS = [5000, 10000, 25000, 50000, 100000, 200000]

const TOPUP_METHODS: { id: TopUpMethod; label: string; icon: LucideIcon; description: string }[] = [
  { id: 'mobile_money', label: 'Mobile Money', icon: Zap, description: 'Orange Money / MTN MoMo' },
  { id: 'bank_transfer', label: 'Virement bancaire', icon: CreditCard, description: 'Transfert depuis votre banque' },
  { id: 'card', label: 'Carte bancaire', icon: Banknote, description: 'Visa, Mastercard' },
]

const METHOD_LABELS: Record<string, string> = {
  mobile_money: 'Mobile Money',
  bank_transfer: 'Virement',
  card: 'Carte',
  cash: 'Especes',
  wallet: 'Portefeuille',
  transfer: 'Transfert',
  ride_payment: 'Course',
  food_payment: 'Food',
}

const TYPE_CONFIG: Record<string, { icon: LucideIcon; color: string; bgColor: string; label: string }> = {
  credit: { icon: ArrowDownLeft, color: 'text-green-600', bgColor: 'bg-green-50', label: 'Credit' },
  debit: { icon: ArrowUpRight, color: 'text-red-600', bgColor: 'bg-red-50', label: 'Debit' },
}

function formatDate(dateStr: string): string {
  try {
    const date = new Date(dateStr)
    return date.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return dateStr
  }
}

/**
 * Vue du portefeuille - solde, transactions, rechargement et transfert.
 */
export function WalletView() {
  const { setCurrentView } = useMovaStore()

  // Donnees
  const [wallet, setWallet] = useState<WalletData | null>(null)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // UI : rechargement
  const [showTopUp, setShowTopUp] = useState(false)
  const [topUpAmount, setTopUpAmount] = useState(10000)
  const [topUpCustomAmount, setTopUpCustomAmount] = useState('')
  const [topUpMethod, setTopUpMethod] = useState<TopUpMethod>('mobile_money')
  const [isToppingUp, setIsToppingUp] = useState(false)
  const [topUpError, setTopUpError] = useState('')
  const [topUpSuccess, setTopUpSuccess] = useState('')

  // UI : transfert
  const [showTransfer, setShowTransfer] = useState(false)
  const [transferTo, setTransferTo] = useState('')
  const [transferAmount, setTransferAmount] = useState('')
  const [isTransferring, setIsTransferring] = useState(false)
  const [transferError, setTransferError] = useState('')
  const [transferSuccess, setTransferSuccess] = useState('')

  // Transactions : afficher plus
  const [showAllTransactions, setShowAllTransactions] = useState(false)

  const getToken = () => localStorage.getItem('mova_token')

  // Charger les donnees du portefeuille
  const fetchWallet = useCallback(async () => {
    setIsLoading(true)
    try {
      const token = getToken()
      const res = await fetch('/api/mova/wallet?limit=50', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      const data = await res.json()
      if (data.success) {
        setWallet(data.data.wallet)
        setTransactions(data.data.transactions || [])
      }
    } catch {
      // Silencieux
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchWallet()
  }, [fetchWallet])

  // Recharger le portefeuille
  const handleTopUp = async () => {
    const amount = topUpCustomAmount ? parseInt(topUpCustomAmount, 10) : topUpAmount
    if (!amount || amount <= 0) {
      setTopUpError('Entrez un montant valide')
      return
    }

    setIsToppingUp(true)
    setTopUpError('')
    setTopUpSuccess('')

    try {
      const token = getToken()
      const res = await fetch('/api/mova/wallet', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          action: 'top_up',
          amount,
          method: topUpMethod,
        }),
      })
      const data = await res.json()

      if (data.success) {
        setTopUpSuccess(`Rechargement de ${amount.toLocaleString()} GNF effectue avec succes !`)
        setShowTopUp(false)
        setTopUpCustomAmount('')
        fetchWallet()
      } else {
        setTopUpError(data.error || 'Erreur lors du rechargement')
      }
    } catch {
      setTopUpError('Erreur de connexion au serveur')
    } finally {
      setIsToppingUp(false)
    }
  }

  // Transferrer
  const handleTransfer = async () => {
    const amount = parseInt(transferAmount, 10)
    if (!transferTo.trim()) {
      setTransferError('Entrez l\'identifiant du destinataire')
      return
    }
    if (!amount || amount <= 0) {
      setTransferError('Entrez un montant valide')
      return
    }

    setIsTransferring(true)
    setTransferError('')
    setTransferSuccess('')

    try {
      const token = getToken()
      const res = await fetch('/api/mova/wallet/transfer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          toUserId: transferTo.trim(),
          amount,
        }),
      })
      const data = await res.json()

      if (data.success) {
        setTransferSuccess(`Transfert de ${amount.toLocaleString()} GNF a ${data.data.transfer.toUserName} effectue !`)
        setShowTransfer(false)
        setTransferTo('')
        setTransferAmount('')
        fetchWallet()
      } else {
        setTransferError(data.error || 'Erreur lors du transfert')
      }
    } catch {
      setTransferError('Erreur de connexion au serveur')
    } finally {
      setIsTransferring(false)
    }
  }

  const displayedTransactions = showAllTransactions
    ? transactions
    : transactions.slice(0, 10)

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
        <h1 className="text-lg font-bold">Portefeuille</h1>
        <button
          onClick={fetchWallet}
          className="ml-auto p-2 rounded-xl hover:bg-white/10 active:scale-95 transition-transform"
        >
          <RefreshCw className="w-5 h-5" />
        </button>
      </header>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-[#1e40af] animate-spin" />
        </div>
      ) : (
        <div className="px-4 py-5 space-y-5 pb-8">
          {/* Carte solde */}
          <div className="bg-gradient-to-br from-[#1e40af] to-[#1e3a8a] rounded-2xl p-5 text-white shadow-lg">
            <div className="flex items-center gap-2 mb-1">
              <WalletIcon className="w-5 h-5 text-blue-200" />
              <span className="text-sm text-blue-200">Solde disponible</span>
            </div>
            <div className="text-3xl font-extrabold mt-2">
              {(wallet?.balance || 0).toLocaleString()} <span className="text-lg font-semibold text-blue-200">GNF</span>
            </div>
            <div className="flex gap-2 mt-5">
              <button
                onClick={() => { setShowTopUp(!showTopUp); setShowTransfer(false); }}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-white/15 backdrop-blur-sm rounded-xl text-sm font-semibold active:scale-[0.97] transition-transform"
              >
                <Plus className="w-4 h-4" />
                Recharger
              </button>
              <button
                onClick={() => { setShowTransfer(!showTransfer); setShowTopUp(false); }}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-white/15 backdrop-blur-sm rounded-xl text-sm font-semibold active:scale-[0.97] transition-transform"
              >
                <Send className="w-4 h-4" />
                Transferrer
              </button>
            </div>
          </div>

          {/* Formulaire de rechargement */}
          {showTopUp && (
            <div className="p-4 bg-white rounded-2xl border border-gray-100 shadow-sm space-y-4">
              <h3 className="font-bold text-gray-800">Recharger le portefeuille</h3>

              {/* Montants predefinis */}
              <div className="grid grid-cols-3 gap-2">
                {TOPUP_AMOUNTS.map((amount) => (
                  <button
                    key={amount}
                    onClick={() => {
                      setTopUpAmount(amount)
                      setTopUpCustomAmount('')
                    }}
                    className={`py-2.5 text-sm font-semibold rounded-xl border-2 transition-all active:scale-[0.97] ${
                      !topUpCustomAmount && topUpAmount === amount
                        ? 'border-[#1e40af] bg-blue-50 text-[#1e40af]'
                        : 'border-gray-200 text-gray-600'
                    }`}
                  >
                    {amount.toLocaleString()}
                  </button>
                ))}
              </div>

              {/* Montant personnalise */}
              <input
                type="number"
                value={topUpCustomAmount}
                onChange={(e) => setTopUpCustomAmount(e.target.value)}
                placeholder="Autre montant (GNF)"
                className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#1e40af]/30 focus:border-[#1e40af]"
              />

              {/* Methode */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Methode de paiement</label>
                <div className="space-y-2">
                  {TOPUP_METHODS.map((m) => {
                    const Icon = m.icon
                    const isSelected = topUpMethod === m.id
                    return (
                      <button
                        key={m.id}
                        onClick={() => setTopUpMethod(m.id)}
                        className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left active:scale-[0.99] ${
                          isSelected ? 'border-[#1e40af] bg-blue-50' : 'border-gray-200'
                        }`}
                      >
                        <Icon className={`w-5 h-5 ${isSelected ? 'text-[#1e40af]' : 'text-gray-400'}`} />
                        <div>
                          <span className={`text-sm font-semibold block ${isSelected ? 'text-[#1e40af]' : 'text-gray-700'}`}>
                            {m.label}
                          </span>
                          <span className="text-xs text-gray-500">{m.description}</span>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>

              {topUpError && (
                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
                  <XCircle className="w-4 h-4 shrink-0" />
                  {topUpError}
                </div>
              )}
              {topUpSuccess && (
                <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-xl text-green-700 text-sm">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  {topUpSuccess}
                </div>
              )}

              <button
                onClick={handleTopUp}
                disabled={isToppingUp}
                className="w-full py-3 bg-[#1e40af] text-white font-semibold rounded-xl flex items-center justify-center gap-2 active:scale-[0.98] transition-transform disabled:opacity-60"
              >
                {isToppingUp ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    Recharger
                  </>
                )}
              </button>
            </div>
          )}

          {/* Formulaire de transfert */}
          {showTransfer && (
            <div className="p-4 bg-white rounded-2xl border border-gray-100 shadow-sm space-y-4">
              <h3 className="font-bold text-gray-800">Transferrer des fonds</h3>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">ID du destinataire</label>
                <input
                  type="text"
                  value={transferTo}
                  onChange={(e) => setTransferTo(e.target.value)}
                  placeholder="Identifiant utilisateur"
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#1e40af]/30 focus:border-[#1e40af]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Montant (GNF)</label>
                <input
                  type="number"
                  value={transferAmount}
                  onChange={(e) => setTransferAmount(e.target.value)}
                  placeholder="Ex : 10000"
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#1e40af]/30 focus:border-[#1e40af]"
                />
              </div>

              {transferError && (
                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
                  <XCircle className="w-4 h-4 shrink-0" />
                  {transferError}
                </div>
              )}
              {transferSuccess && (
                <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-xl text-green-700 text-sm">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  {transferSuccess}
                </div>
              )}

              <button
                onClick={handleTransfer}
                disabled={isTransferring}
                className="w-full py-3 bg-[#1e40af] text-white font-semibold rounded-xl flex items-center justify-center gap-2 active:scale-[0.98] transition-transform disabled:opacity-60"
              >
                {isTransferring ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Transferrer
                  </>
                )}
              </button>
            </div>
          )}

          {/* Transactions */}
          <div>
            <div className="flex items-center justify-between mb-3 px-1">
              <h2 className="text-base font-bold text-gray-800">Transactions recentes</h2>
              <span className="text-xs text-gray-400">{transactions.length} transaction(s)</span>
            </div>

            {transactions.length === 0 ? (
              <div className="text-center py-12">
                <WalletIcon className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 text-sm">Aucune transaction pour le moment</p>
              </div>
            ) : (
              <div className="space-y-2">
                {displayedTransactions.map((tx) => {
                  const config = TYPE_CONFIG[tx.type] || TYPE_CONFIG.debit
                  const Icon = config.icon
                  const isCredit = tx.type === 'credit'
                  return (
                    <div key={tx.id} className="flex items-center gap-3 p-3 bg-white rounded-xl border border-gray-100 shadow-sm">
                      <div className={`w-10 h-10 ${config.bgColor} rounded-xl flex items-center justify-center shrink-0`}>
                        <Icon className={`w-5 h-5 ${config.color}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-800 truncate">
                          {tx.description || (isCredit ? 'Credit' : 'Debit')}
                        </p>
                        <p className="text-xs text-gray-500">
                          {formatDate(tx.createdAt)}
                          {tx.method ? ` -- ${METHOD_LABELS[tx.method] || tx.method}` : ''}
                        </p>
                      </div>
                      <span className={`text-sm font-bold shrink-0 ${isCredit ? 'text-green-600' : 'text-red-600'}`}>
                        {isCredit ? '+' : '-'}{tx.amount.toLocaleString()}
                      </span>
                    </div>
                  )
                })}
                {transactions.length > 10 && (
                  <button
                    onClick={() => setShowAllTransactions(!showAllTransactions)}
                    className="w-full py-2.5 text-center text-sm text-[#1e40af] font-semibold flex items-center justify-center gap-1"
                  >
                    {showAllTransactions ? (
                      <>
                        <ChevronUp className="w-4 h-4" />
                        Voir moins
                      </>
                    ) : (
                      <>
                        <ChevronDown className="w-4 h-4" />
                        Voir tout ({transactions.length})
                      </>
                    )}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
