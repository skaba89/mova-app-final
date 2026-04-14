'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useMovaStore } from '@/lib/store'
import { apiFetch } from '@/lib/api'
import {
  ArrowLeft,
  Send,
  ArrowUpRight,
  ArrowDownLeft,
  RefreshCw,
  Wallet as WalletIcon,
  User,
  Phone,
  Search,
  CheckCircle2,
  XCircle,
  Loader2,
  Clock,
  Gift,
  ChevronRight,
} from 'lucide-react'

// --- Types ---

interface WalletData {
  id: string
  balance: number
  currency: string
}

interface TransferRecipient {
  id: string
  name: string
  phone: string
  avatar: string | null
}

interface RecentTransfer {
  id: string
  toUserId: string
  toUserName: string
  toUserPhone: string
  amount: number
  status: string
  createdAt: string
}

// --- Constantes ---

const QUICK_AMOUNTS = [5000, 10000, 25000, 50000, 100000, 200000]

// --- Helpers ---

function formatAmount(amount: number): string {
  return new Intl.NumberFormat('fr-FR').format(amount)
}

function formatDate(iso: string): string {
  try {
    const diff = Date.now() - new Date(iso).getTime()
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)
    if (hours < 1) return "A l'instant"
    if (hours < 24) return `il y a ${hours}h`
    if (days === 1) return 'Hier'
    if (days < 7) return `il y a ${days}j`
    return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
  } catch {
    return iso
  }
}

// --- Composant principal ---

export function TransferView() {
  const { setCurrentView } = useMovaStore()

  // Donnees
  const [wallet, setWallet] = useState<WalletData | null>(null)
  const [recentTransfers, setRecentTransfers] = useState<RecentTransfer[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Formulaire
  const [recipientInput, setRecipientInput] = useState('')
  const [recipient, setRecipient] = useState<TransferRecipient | null>(null)
  const [amount, setAmount] = useState('')
  const [customAmount, setCustomAmount] = useState('')

  // UI
  const [isSearching, setIsSearching] = useState(false)
  const [isTransferring, setIsTransferring] = useState(false)
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [showAmountKeyboard, setShowAmountKeyboard] = useState(false)

  // Debounce pour la recherche
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Charger les donnees
  const fetchData = useCallback(async () => {
    setIsLoading(true)
    try {
      const [walletRes, transfersRes] = await Promise.all([
        apiFetch('/api/mova/wallet'),
        apiFetch('/api/mova/wallet?limit=50'),
      ])

      if (walletRes.ok) {
        const walletData = await walletRes.json()
        if (walletData.success) {
          setWallet(walletData.data?.wallet || null)
        }
      }

      if (transfersRes.ok) {
        const transfersData = await transfersRes.json()
        if (transfersData.success && transfersData.data?.transactions) {
          // Filtrer les transferts uniquement
          const transfers = transfersData.data.transactions.filter(
            (tx: { method: string; type: string }) => tx.method === 'transfer' || tx.type === 'transfer'
          )
          setRecentTransfers(
            transfers.map((tx: { id: string; description: string; amount: number; status: string; createdAt: string }) => ({
              id: tx.id,
              toUserId: '',
              toUserName: tx.description || 'Destinataire',
              toUserPhone: '',
              amount: tx.amount,
              status: tx.status,
              createdAt: tx.createdAt,
            }))
          )
        }
      }
    } catch {
      // Silencieux
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Recherche de destinataire
  useEffect(() => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current)

    if (!recipientInput.trim() || recipientInput.trim().length < 3) {
      setRecipient(null)
      return
    }

    setIsSearching(true)
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const res = await apiFetch(`/api/mova/users/search?q=${encodeURIComponent(recipientInput.trim())}`)
        if (res.ok) {
          const data = await res.json()
          if (data.success && data.data?.users?.length > 0) {
            setRecipient(data.data.users[0])
          } else {
            setRecipient(null)
          }
        }
      } catch {
        setRecipient(null)
      } finally {
        setIsSearching(false)
      }
    }, 600)

    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current)
    }
  }, [recipientInput])

  // Choisir un montant rapide
  const handleQuickAmount = (val: number) => {
    setAmount(String(val))
    setCustomAmount('')
    setShowAmountKeyboard(true)
  }

  // Valider et envoyer le transfert
  const handleTransfer = async () => {
    const transferAmount = customAmount ? parseInt(customAmount, 10) : parseInt(amount, 10)
    if (!recipient) {
      showNotification('error', 'Veuillez selectionner un destinataire.')
      return
    }
    if (!transferAmount || transferAmount <= 0) {
      showNotification('error', 'Entrez un montant valide.')
      return
    }
    if (wallet && transferAmount > wallet.balance) {
      showNotification('error', 'Solde insuffisant pour effectuer ce transfert.')
      return
    }

    setIsTransferring(true)
    try {
      const res = await apiFetch('/api/mova/wallet/transfer', {
        method: 'POST',
        body: JSON.stringify({
          toUserId: recipient.id,
          amount: transferAmount,
        }),
      })
      const data = await res.json()

      if (data.success) {
        showNotification('success', `Transfert de ${formatAmount(transferAmount)} GNF a ${data.data?.transfer?.toUserName || recipient.name} effectue avec succes !`)
        // Reset le formulaire
        setRecipientInput('')
        setRecipient(null)
        setAmount('')
        setCustomAmount('')
        setShowAmountKeyboard(false)
        fetchData()
      } else {
        showNotification('error', data.error || 'Erreur lors du transfert.')
      }
    } catch {
      showNotification('error', 'Erreur de connexion au serveur.')
    } finally {
      setIsTransferring(false)
    }
  }

  // Notification toast
  const showNotification = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message })
    setTimeout(() => setNotification(null), 4000)
  }

  // Re-utiliser un destinataire recent
  const handleRecentRecipient = (transfer: RecentTransfer) => {
    setRecipientInput(transfer.toUserPhone || transfer.toUserName)
    setRecipient({
      id: transfer.toUserId,
      name: transfer.toUserName,
      phone: transfer.toUserPhone,
      avatar: null,
    })
  }

  // Montant affiche
  const displayAmount = customAmount || amount

  return (
    <div className="min-h-screen bg-gray-50">
      {/* En-tete gradient */}
      <header className="bg-gradient-to-br from-violet-600 to-purple-700 text-white px-4 py-4 flex items-center gap-3 sticky top-0 z-10 shadow-lg">
        <button
          onClick={() => setCurrentView('wallet')}
          className="p-2 -ml-2 rounded-xl hover:bg-white/10 active:scale-95 transition-transform"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <Send className="w-5 h-5" />
        <h1 className="text-lg font-bold">Envoyer de l&apos;argent</h1>
      </header>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-violet-600 animate-spin" />
        </div>
      ) : (
        <div className="px-4 py-5 space-y-5 pb-8">
          {/* Solde */}
          <div className="bg-gradient-to-br from-violet-600 to-purple-700 rounded-2xl p-5 text-white shadow-lg">
            <div className="flex items-center gap-2 mb-1">
              <WalletIcon className="w-5 h-5 text-violet-200" />
              <span className="text-sm text-violet-200">Solde disponible</span>
            </div>
            <p className="text-3xl font-extrabold mt-2">
              {formatAmount(wallet?.balance || 0)} <span className="text-lg font-semibold text-violet-200">GNF</span>
            </p>
            {/* Promo */}
            <div className="mt-4 flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-xl px-3 py-2">
              <Gift className="w-4 h-4 text-yellow-300 shrink-0" />
              <span className="text-xs text-violet-100">
                <span className="font-bold text-yellow-300">Promo :</span> Frais : 0 GNF — Transferts gratuits !
              </span>
            </div>
          </div>

          {/* Formulaire de transfert */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-5">
            <h2 className="text-base font-bold text-gray-800">Nouveau transfert</h2>

            {/* Destinataire */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Destinataire</label>
              <div className="relative">
                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400">
                  {isSearching ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Search className="w-4 h-4" />
                  )}
                </div>
                <input
                  type="text"
                  value={recipientInput}
                  onChange={(e) => setRecipientInput(e.target.value)}
                  placeholder="Numero de telephone ou identifiant"
                  className="w-full pl-10 pr-4 py-3.5 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500 placeholder:text-gray-400"
                />
              </div>

              {/* Resultat de la recherche */}
              {recipient && (
                <div className="mt-2 flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-xl animate-in slide-in-from-top-2">
                  <div className="w-10 h-10 bg-violet-100 rounded-full flex items-center justify-center shrink-0">
                    {recipient.avatar ? (
                      <img src={recipient.avatar} alt={recipient.name} className="w-10 h-10 rounded-full object-cover" />
                    ) : (
                      <User className="w-5 h-5 text-violet-600" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800 truncate">{recipient.name}</p>
                    {recipient.phone && (
                      <p className="text-xs text-gray-500 flex items-center gap-1">
                        <Phone className="w-3 h-3" />
                        {recipient.phone}
                      </p>
                    )}
                  </div>
                  <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
                </div>
              )}

              {/* Aucun resultat */}
              {recipientInput.trim().length >= 3 && !recipient && !isSearching && (
                <p className="mt-1.5 text-xs text-gray-400">Aucun utilisateur trouve pour cette recherche.</p>
              )}
            </div>

            {/* Montant */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Montant</label>
              <div className="relative">
                <input
                  type="number"
                  value={customAmount || amount}
                  onChange={(e) => {
                    const val = e.target.value
                    setCustomAmount(val)
                    setAmount('')
                  }}
                  onFocus={() => setShowAmountKeyboard(true)}
                  placeholder="0"
                  className="w-full px-4 py-4 text-2xl font-extrabold text-center border border-gray-200 rounded-xl bg-gray-50 focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500 placeholder:text-gray-300 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-gray-400">
                  GNF
                </span>
              </div>
            </div>

            {/* Montants rapides */}
            {showAmountKeyboard && (
              <div>
                <p className="text-xs text-gray-500 mb-2 font-medium">Montants rapides</p>
                <div className="grid grid-cols-3 gap-2">
                  {QUICK_AMOUNTS.map((val) => (
                    <button
                      key={val}
                      onClick={() => handleQuickAmount(val)}
                      className={`py-2.5 text-xs font-semibold rounded-xl border-2 transition-all active:scale-[0.97] ${
                        displayAmount === String(val)
                          ? 'border-violet-500 bg-violet-50 text-violet-700'
                          : 'border-gray-200 text-gray-600 hover:border-gray-300'
                      }`}
                    >
                      {formatAmount(val)}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Recapitulatif */}
            {recipient && displayAmount && parseInt(displayAmount, 10) > 0 && (
              <div className="bg-violet-50 border border-violet-200 rounded-xl p-4 space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Destinataire</span>
                  <span className="font-semibold text-gray-800">{recipient.name}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Montant</span>
                  <span className="font-bold text-violet-700">{formatAmount(parseInt(displayAmount, 10))} GNF</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Frais</span>
                  <span className="font-bold text-green-600">0 GNF</span>
                </div>
                <div className="border-t border-violet-200 pt-2 mt-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-gray-800">Total</span>
                    <span className="text-base font-extrabold text-violet-700">{formatAmount(parseInt(displayAmount, 10))} GNF</span>
                  </div>
                </div>
              </div>
            )}

            {/* Bouton envoyer */}
            <button
              onClick={handleTransfer}
              disabled={!recipient || !displayAmount || parseInt(displayAmount, 10) <= 0 || isTransferring}
              className="w-full py-3.5 bg-gradient-to-r from-violet-600 to-purple-700 text-white font-bold rounded-xl flex items-center justify-center gap-2.5 active:scale-[0.98] transition-transform disabled:opacity-40 disabled:active:scale-100 shadow-md text-sm"
            >
              {isTransferring ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <Send className="w-5 h-5" />
                  Envoyer {displayAmount ? `${formatAmount(parseInt(displayAmount, 10))} GNF` : 'de l\'argent'}
                </>
              )}
            </button>
          </div>

          {/* Transferts recents */}
          <div>
            <div className="flex items-center justify-between mb-3 px-1">
              <h2 className="text-base font-bold text-gray-800">Transferts recents</h2>
              {recentTransfers.length > 0 && (
                <button
                  onClick={() => setCurrentView('wallet')}
                  className="text-xs text-violet-600 font-semibold flex items-center gap-1 active:scale-95 transition-transform"
                >
                  Tout voir
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {recentTransfers.length === 0 ? (
              <div className="text-center py-10 bg-white rounded-2xl border border-gray-100">
                <ArrowUpRight className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                <p className="text-sm text-gray-500">Aucun transfert recent</p>
                <p className="text-xs text-gray-400 mt-1">Vos transferts apparaitront ici</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {recentTransfers.map((transfer) => (
                  <button
                    key={transfer.id}
                    onClick={() => handleRecentRecipient(transfer)}
                    className="w-full flex items-center gap-3 p-3.5 bg-white rounded-xl border border-gray-100 shadow-sm text-left active:scale-[0.99] transition-transform"
                  >
                    <div className="w-10 h-10 bg-violet-50 rounded-full flex items-center justify-center shrink-0">
                      <ArrowUpRight className="w-5 h-5 text-violet-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800 truncate">{transfer.toUserName}</p>
                      <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                        <Clock className="w-3 h-3" />
                        {formatDate(transfer.createdAt)}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold text-gray-800">
                        -{formatAmount(transfer.amount)} GNF
                      </p>
                      <span className={`text-[10px] font-semibold ${
                        transfer.status === 'completed'
                          ? 'text-green-600'
                          : transfer.status === 'pending'
                            ? 'text-amber-600'
                            : 'text-red-600'
                      }`}>
                        {transfer.status === 'completed' ? 'Envoye' : transfer.status === 'pending' ? 'En attente' : 'Echoue'}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Notification toast */}
      {notification && (
        <div className="fixed bottom-6 left-4 right-4 z-50 max-w-md mx-auto animate-in slide-in-from-bottom-4">
          <div
            className={`flex items-center gap-3 px-4 py-3.5 rounded-2xl shadow-xl border ${
              notification.type === 'success'
                ? 'bg-green-50 border-green-200 text-green-800'
                : 'bg-red-50 border-red-200 text-red-800'
            }`}
          >
            {notification.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
            ) : (
              <XCircle className="w-5 h-5 text-red-500 shrink-0" />
            )}
            <p className="text-sm font-medium flex-1">{notification.message}</p>
            <button
              onClick={() => setNotification(null)}
              className="shrink-0 p-1 rounded-lg hover:bg-black/5 active:scale-90 transition-transform"
            >
              <XCircle className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
