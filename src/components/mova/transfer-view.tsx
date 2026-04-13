'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Send, Phone, User, Clock, ArrowUpRight, ArrowDownLeft, Users, Plus,
  CheckCircle, XCircle, AlertCircle, Shield, ChevronRight, Search, Star,
  ArrowLeft, History, Wallet, TrendingUp, TrendingDown, CheckCircle2,
  Loader2, Repeat, UserPlus, Gift, Heart,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { InputOTP, InputOTPGroup, InputOTPSlot, InputOTPSeparator } from '@/components/ui/input-otp'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { useAppStore } from '@/lib/mova/store'

// ── Types ──────────────────────────────────────────────────

interface WalletData {
  id: string
  balance: number
  currency: string
  isActive: boolean
  recentTransactions: WalletTransaction[]
}

interface WalletTransaction {
  id: string
  walletId: string
  type: string
  amount: number
  balance: number
  method: string | null
  reference: string | null
  description: string
  status: string
  createdAt: string
}

interface TransferResult {
  reference: string
  amount: number
  fee: number
  feeType: string
  totalDebit: number
  reason: string
  currency: string
  sender: { userId: string; name: string | null; newBalance: number }
  recipient: { userId: string; name: string | null; phone: string | null }
  debitTransaction: string
  creditTransaction: string
  completedAt: string
}

interface FrequentContact {
  id: string
  name: string
  phone: string
  initials: string
  color: string
  isFavorite?: boolean
}

// ── Constants ──────────────────────────────────────────────

const REASON_OPTIONS = [
  { value: 'cadeau', label: 'Cadeau' },
  { value: 'remboursement', label: 'Remboursement' },
  { value: 'loyer', label: 'Loyer' },
  { value: 'alimentation', label: 'Alimentation' },
  { value: 'sante', label: 'Santé' },
  { value: 'famille', label: 'Famille' },
  { value: 'autre', label: 'Autre' },
]

const CONTACT_COLORS = [
  'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400',
  'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400',
  'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-400',
  'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-400',
  'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-400',
  'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400',
]

const STORAGE_KEY_CONTACTS = 'mova_transfer_contacts'
const STORAGE_KEY_PIN = 'mova_pin'

// ── Helpers ────────────────────────────────────────────────

function formatGNF(amount: number): string {
  return new Intl.NumberFormat('fr-FR').format(amount) + ' GNF'
}

function formatGNFShort(amount: number): string {
  if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(1)}M`
  if (amount >= 1_000) return `${(amount / 1_000).toFixed(0)}k`
  return String(amount)
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return "À l'instant"
  if (diffMins < 60) return `Il y a ${diffMins} min`
  if (diffHours < 24) return `Il y a ${diffHours}h`
  if (diffDays < 7) return `Il y a ${diffDays}j`
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
}

/** Masks middle digits of a phone string: "621 55 00 01" → "621 55 ** 01" */
function formatPhoneDisplay(phone: string): string {
  const digits = phone.replace(/[\s\-\+]/g, '')
  if (digits.length < 9) return phone
  const clean = digits.replace(/^224/, '')
  return `${clean.slice(0, 3)} ${clean.slice(3, 5)} ** ${clean.slice(7)}`
}

function getTransactionStatus(tx: WalletTransaction) {
  if (tx.type === 'transfer_out') {
    return {
      icon: <ArrowUpRight className="h-3 w-3" />,
      label: 'Envoyé',
      className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400',
      amountColor: 'text-red-500',
      sign: '-',
    }
  }
  if (tx.type === 'transfer_in') {
    return {
      icon: <ArrowDownLeft className="h-3 w-3" />,
      label: 'Reçu',
      className: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-400',
      amountColor: 'text-emerald-600',
      sign: '+',
    }
  }
  return {
    icon: <Clock className="h-3 w-3" />,
    label: tx.status === 'completed' ? 'Terminé' : tx.status,
    className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400',
    amountColor: 'text-amber-600',
    sign: '',
  }
}

function loadContacts(): FrequentContact[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CONTACTS)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveContacts(contacts: FrequentContact[]) {
  if (typeof window === 'undefined') return
  localStorage.setItem(STORAGE_KEY_CONTACTS, JSON.stringify(contacts))
}

function getStoredPin(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(STORAGE_KEY_PIN)
}

function saveStoredPin(pin: string) {
  if (typeof window === 'undefined') return
  localStorage.setItem(STORAGE_KEY_PIN, pin)
}

function getAuthToken(): string {
  if (typeof window === 'undefined') return 'demo-token'
  return localStorage.getItem('mova_token') || 'demo-token'
}

// ── Main Component ─────────────────────────────────────────

export default function TransferView() {
  const { user, goBack } = useAppStore()

  // ── Wallet state ──
  const [wallet, setWallet] = useState<WalletData | null>(null)
  const [walletLoading, setWalletLoading] = useState(true)
  const [transactions, setTransactions] = useState<WalletTransaction[]>([])
  const [txLoading, setTxLoading] = useState(true)

  // ── Form state ──
  const [phone, setPhone] = useState('')
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('')
  const [feeType, setFeeType] = useState<'mova' | 'mobile_money'>('mova')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [activeTab, setActiveTab] = useState<'transfer' | 'history'>('transfer')

  // ── PIN Dialog ──
  const [showPinDialog, setShowPinDialog] = useState(false)
  const [pin, setPin] = useState('')
  const [pinError, setPinError] = useState('')
  const [pinVerifying, setPinVerifying] = useState(false)

  // ── Receipt Dialog ──
  const [showReceipt, setShowReceipt] = useState(false)
  const [lastTransfer, setLastTransfer] = useState<TransferResult | null>(null)
  const [transferError, setTransferError] = useState<string | null>(null)

  // ── Add Contact Dialog ──
  const [showAddContact, setShowAddContact] = useState(false)
  const [newContactName, setNewContactName] = useState('')
  const [newContactPhone, setNewContactPhone] = useState('')

  // ── Frequent contacts ──
  const [contacts, setContacts] = useState<FrequentContact[]>([])

  // ── Computed ──
  const phoneValid = /^\d{9}$/.test(phone.replace(/\s/g, ''))
  const numericAmount = Number(amount) || 0
  const amountValid = numericAmount > 0 && numericAmount <= 5000000
  const feeRate = feeType === 'mobile_money' ? 0.02 : 0.01
  const fee = numericAmount > 0 ? Math.ceil(numericAmount * feeRate) : 0
  const totalDebit = numericAmount + fee
  const hasSufficientBalance = wallet ? Number(wallet.balance) >= totalDebit : true
  const formValid = phoneValid && amountValid && hasSufficientBalance

  // ── Transfer history stats ──
  const transferTxs = transactions.filter(
    (tx) => tx.type === 'transfer_out' || tx.type === 'transfer_in'
  )
  const totalSent = transferTxs
    .filter((tx) => tx.type === 'transfer_out')
    .reduce((s, tx) => s + Number(tx.amount), 0)
  const totalReceived = transferTxs
    .filter((tx) => tx.type === 'transfer_in')
    .reduce((s, tx) => s + Number(tx.amount), 0)
  const transferCount = transferTxs.length

  // ── API: fetch wallet balance ──
  const fetchWallet = useCallback(async () => {
    try {
      setWalletLoading(true)
      const userId = user?.id || 'demo'
      const res = await fetch(`/api/mova/wallet?userId=${encodeURIComponent(userId)}`, {
        headers: { Authorization: `Bearer ${getAuthToken()}` },
      })
      if (res.ok) {
        const json = await res.json()
        if (json.success && json.data) {
          setWallet(json.data)
          setTransactions(json.data.recentTransactions || [])
        }
      }
    } catch {
      // Graceful fallback — use 0 balance
      setWallet({ id: 'local', balance: 0, currency: 'GNF', isActive: true, recentTransactions: [] })
    } finally {
      setWalletLoading(false)
    }
  }, [user?.id])

  // ── API: fetch transfer history ──
  const fetchHistory = useCallback(async () => {
    try {
      setTxLoading(true)
      const userId = user?.id || 'demo'
      const res = await fetch(`/api/mova/wallet?userId=${encodeURIComponent(userId)}`, {
        headers: { Authorization: `Bearer ${getAuthToken()}` },
      })
      if (res.ok) {
        const json = await res.json()
        if (json.success && json.data?.recentTransactions) {
          setTransactions(json.data.recentTransactions)
        }
      }
    } catch {
      // silent
    } finally {
      setTxLoading(false)
    }
  }, [user?.id])

  // ── Effects ──
  useEffect(() => {
    setContacts(loadContacts())
  }, [])

  useEffect(() => {
    fetchWallet()
  }, [fetchWallet])

  useEffect(() => {
    if (activeTab === 'history') {
      fetchHistory()
    }
  }, [activeTab, fetchHistory])

  // ── Phone formatting ──
  function handlePhoneChange(value: string) {
    const cleaned = value.replace(/[^\d\s]/g, '')
    const digits = cleaned.replace(/\s/g, '').slice(0, 9)
    if (digits.length <= 3) {
      setPhone(digits)
    } else if (digits.length <= 5) {
      setPhone(digits.slice(0, 3) + ' ' + digits.slice(3))
    } else if (digits.length <= 7) {
      setPhone(digits.slice(0, 3) + ' ' + digits.slice(3, 5) + ' ' + digits.slice(5))
    } else {
      setPhone(digits.slice(0, 3) + ' ' + digits.slice(3, 5) + ' ' + digits.slice(5, 7) + ' ' + digits.slice(7))
    }
  }

  // ── Transfer flow ──
  function handleSubmit() {
    if (!formValid) {
      if (!phoneValid) toast.error('Numéro de téléphone invalide (9 chiffres requis)')
      else if (!amountValid) toast.error('Montant invalide (max 5 000 000 GNF)')
      else if (!hasSufficientBalance) toast.error('Solde insuffisant pour ce transfert')
      return
    }
    setPin('')
    setPinError('')
    setShowPinDialog(true)
  }

  async function confirmTransferWithPin() {
    if (pin.length !== 4) {
      setPinError('Entrez votre code PIN à 4 chiffres')
      return
    }

    const storedPin = getStoredPin()
    // If no PIN is set, accept any 4-digit PIN and save it
    if (storedPin && pin !== storedPin) {
      setPinError('Code PIN incorrect. Réessayez.')
      setPin('')
      return
    }
    if (!storedPin) {
      saveStoredPin(pin)
    }

    setPinVerifying(true)
    setTransferError(null)

    try {
      const formattedPhone = phone.replace(/\s/g, '')
      const selectedReason = reason || 'Transfert d\'argent'
      const res = await fetch('/api/mova/wallet/transfer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getAuthToken()}`,
        },
        body: JSON.stringify({
          fromUserId: user?.id || 'demo',
          toPhone: `+224${formattedPhone}`,
          amount: numericAmount,
          reason: selectedReason,
          feeType,
        }),
      })

      const json = await res.json()

      if (json.success && json.data) {
        setLastTransfer(json.data)
        setShowPinDialog(false)
        setShowReceipt(true)

        // Update local wallet balance
        setWallet((prev) =>
          prev
            ? { ...prev, balance: json.data.sender.newBalance }
            : prev
        )

        // Refresh wallet data
        fetchWallet()

        // Add to contacts if not already present
        const phoneExists = contacts.some(
          (c) => c.phone.replace(/\s/g, '') === formattedPhone
        )
        if (!phoneExists && json.data.recipient?.name) {
          const initials = json.data.recipient.name
            .split(' ')
            .map((n: string) => n[0])
            .join('')
            .toUpperCase()
            .slice(0, 2)
          const newContact: FrequentContact = {
            id: `c-${Date.now()}`,
            name: json.data.recipient.name,
            phone: `+224 ${phone}`,
            initials,
            color: CONTACT_COLORS[contacts.length % CONTACT_COLORS.length],
          }
          const updated = [...contacts, newContact]
          setContacts(updated)
          saveContacts(updated)
        }

        // Reset form
        setPhone('')
        setAmount('')
        setReason('')
        setPin('')

        toast.success('Transfert effectué avec succès !', {
          description: `${formatGNF(numericAmount)} envoyé à ${json.data.recipient?.name || `+224 ${phone}`}`,
          duration: 5000,
        })
      } else {
        const errorMsg = json.error || 'Erreur lors du transfert'
        setTransferError(errorMsg)
        toast.error('Échec du transfert', {
          description: errorMsg,
          duration: 5000,
        })
        setPin('')
      }
    } catch {
      setTransferError('Erreur de connexion. Vérifiez votre réseau et réessayez.')
      toast.error('Erreur de connexion', {
        description: 'Impossible de joindre le serveur',
      })
      setPin('')
    } finally {
      setPinVerifying(false)
    }
  }

  // ── Quick send from contact ──
  function handleQuickSend(contact: FrequentContact) {
    setPhone(contact.phone.replace('+224 ', '').replace(/\s/g, ''))
    setActiveTab('transfer')
    toast.info(`Numéro de ${contact.name} sélectionné`, {
      description: 'Entrez le montant à envoyer',
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // ── Add contact ──
  function handleSaveContact() {
    if (!newContactName.trim()) {
      toast.error('Entrez un nom pour le contact')
      return
    }
    const digits = newContactPhone.replace(/\s/g, '')
    if (digits.length !== 9) {
      toast.error('Numéro invalide (9 chiffres requis)')
      return
    }
    if (contacts.some((c) => c.phone.replace(/[\s\+\-]/g, '') === `224${digits}`)) {
      toast.error('Ce numéro est déjà dans vos contacts')
      return
    }
    const initials = newContactName
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
    const newC: FrequentContact = {
      id: `c-${Date.now()}`,
      name: newContactName.trim(),
      phone: `+224 ${newContactPhone}`,
      initials,
      color: CONTACT_COLORS[contacts.length % CONTACT_COLORS.length],
    }
    const updated = [...contacts, newC]
    setContacts(updated)
    saveContacts(updated)
    setNewContactName('')
    setNewContactPhone('')
    setShowAddContact(false)
    toast.success(`${newC.name} ajouté à vos contacts`)
  }

  // ── Remove contact ──
  function handleRemoveContact(id: string) {
    const updated = contacts.filter((c) => c.id !== id)
    setContacts(updated)
    saveContacts(updated)
    toast.success('Contact supprimé')
  }

  return (
    <div className="min-h-screen bg-background">
      {/* ── Header ── */}
      <header className="sticky top-0 z-50 mova-glass border-b border-border/50">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="icon" className="rounded-full" onClick={goBack}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-emerald-600 flex items-center justify-center">
              <Send className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold">Transfert d&apos;Argent</h1>
              <p className="text-xs text-muted-foreground">Envoyez et recevez facilement</p>
            </div>
          </div>
        </div>
      </header>

      <div className="max-h-[calc(100vh-64px)] overflow-y-auto">
        <div className="max-w-4xl mx-auto px-4 py-4 space-y-5 pb-24">
          {/* ── Wallet Balance Card ── */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Card className="overflow-hidden">
              <div className="bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-500 p-5 text-white">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <Wallet className="h-4 w-4 opacity-90" />
                    <span className="text-sm font-medium opacity-90">Solde disponible</span>
                  </div>
                  <Shield className="h-4 w-4 opacity-70" />
                </div>
                {walletLoading ? (
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-6 w-6 animate-spin" />
                    <span className="text-2xl font-bold">...</span>
                  </div>
                ) : (
                  <p className="text-3xl font-bold tracking-tight">
                    {formatGNF(wallet?.balance || 0)}
                  </p>
                )}
                <p className="text-xs opacity-70 mt-1">Portefeuille MOVA</p>
              </div>
              {numericAmount > 0 && (
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Montant</span>
                    <span className="font-semibold">{formatGNF(numericAmount)}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <span>Frais</span>
                      <Badge variant="secondary" className="text-[9px] px-1.5 py-0">
                        {feeType === 'mobile_money' ? '2%' : '1%'}
                      </Badge>
                    </div>
                    <span className="font-medium text-amber-600">+ {formatGNF(fee)}</span>
                  </div>
                  <div className="border-t pt-2 flex items-center justify-between text-sm">
                    <span className="font-semibold">Total débité</span>
                    <span className={`font-bold text-lg ${hasSufficientBalance ? 'text-foreground' : 'text-red-500'}`}>
                      {formatGNF(totalDebit)}
                    </span>
                  </div>
                  {!hasSufficientBalance && wallet && (
                    <div className="flex items-start gap-1.5 p-2 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/30">
                      <AlertCircle className="h-3.5 w-3.5 text-red-500 mt-0.5 shrink-0" />
                      <p className="text-[11px] text-red-600 dark:text-red-400">
                        Solde insuffisant. Il vous manque {formatGNF(totalDebit - Number(wallet.balance))}.
                      </p>
                    </div>
                  )}
                </CardContent>
              )}
            </Card>
          </motion.div>

          {/* ── Summary Cards (real stats) ── */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="grid grid-cols-3 gap-3"
          >
            <Card className="mova-card-hover">
              <CardContent className="p-3 text-center">
                <TrendingUp className="h-5 w-5 text-red-400 mx-auto mb-1" />
                <p className="text-[10px] text-muted-foreground">Envoyé</p>
                <p className="text-sm font-bold text-red-500">{formatGNFShort(totalSent)}</p>
                <p className="text-[9px] text-muted-foreground">GNF</p>
              </CardContent>
            </Card>
            <Card className="mova-card-hover">
              <CardContent className="p-3 text-center">
                <TrendingDown className="h-5 w-5 text-emerald-500 mx-auto mb-1" />
                <p className="text-[10px] text-muted-foreground">Reçu</p>
                <p className="text-sm font-bold text-emerald-600">{formatGNFShort(totalReceived)}</p>
                <p className="text-[9px] text-muted-foreground">GNF</p>
              </CardContent>
            </Card>
            <Card className="mova-card-hover">
              <CardContent className="p-3 text-center">
                <Repeat className="h-5 w-5 text-amber-500 mx-auto mb-1" />
                <p className="text-[10px] text-muted-foreground">Transferts</p>
                <p className="text-sm font-bold text-amber-600">{transferCount}</p>
                <p className="text-[9px] text-muted-foreground">transactions</p>
              </CardContent>
            </Card>
          </motion.div>

          {/* ── Frequent Contacts ── */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-semibold flex items-center gap-2">
                    <Repeat className="h-4 w-4 text-emerald-600" />
                    Contacts fréquents
                  </h2>
                  <span className="text-xs text-muted-foreground">{contacts.length} contact{contacts.length !== 1 ? 's' : ''}</span>
                </div>
                {contacts.length === 0 ? (
                  <div className="text-center py-6 text-muted-foreground">
                    <Users className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    <p className="text-xs">Aucun contact fréquent</p>
                    <p className="text-[10px] mt-1">Vos contacts apparaîtront ici après un premier transfert</p>
                  </div>
                ) : (
                  <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1">
                    {contacts.map((contact) => (
                      <div key={contact.id} className="flex flex-col items-center gap-1.5 min-w-[72px]">
                        <button
                          onClick={() => handleQuickSend(contact)}
                          className="relative group"
                        >
                          <div className="h-11 w-11 rounded-full flex items-center justify-center border-2 border-transparent group-hover:border-emerald-300 transition-all text-xs font-bold bg-muted">
                            {contact.initials}
                          </div>
                        </button>
                        <div className="text-center max-w-[72px]">
                          <p className="text-[10px] font-medium truncate">{contact.name}</p>
                          <p className="text-[9px] text-muted-foreground">{formatPhoneDisplay(contact.phone)}</p>
                        </div>
                      </div>
                    ))}
                    {/* Add Contact button */}
                    <div className="flex flex-col items-center gap-1.5 min-w-[72px]">
                      <button
                        onClick={() => {
                          setNewContactName('')
                          setNewContactPhone('')
                          setShowAddContact(true)
                        }}
                        className="h-11 w-11 rounded-full border-2 border-dashed border-border hover:border-emerald-300 flex items-center justify-center transition-all"
                      >
                        <Plus className="h-4 w-4 text-muted-foreground" />
                      </button>
                      <p className="text-[10px] text-muted-foreground">Ajouter</p>
                    </div>
                  </div>
                )}
                {contacts.length > 0 && (
                  <button
                    onClick={() => {
                      setNewContactName('')
                      setNewContactPhone('')
                      setShowAddContact(true)
                    }}
                    className="mt-3 w-full py-2 rounded-lg border border-dashed border-border hover:border-emerald-300 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/10 transition-all text-xs text-muted-foreground flex items-center justify-center gap-1"
                  >
                    <UserPlus className="h-3.5 w-3.5" />
                    Ajouter un contact
                  </button>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* ── Tabs: Transfer / History ── */}
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'transfer' | 'history')}>
            <TabsList className="w-full grid grid-cols-2">
              <TabsTrigger value="transfer" className="text-xs gap-1.5">
                <Send className="h-3.5 w-3.5" />
                Nouveau Transfert
              </TabsTrigger>
              <TabsTrigger value="history" className="text-xs gap-1.5">
                <History className="h-3.5 w-3.5" />
                Historique
                {transferTxs.length > 0 && (
                  <Badge variant="secondary" className="text-[9px] px-1.5 py-0 ml-1">
                    {transferTxs.length}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>

            {/* ── Transfer Form ── */}
            <TabsContent value="transfer" className="mt-4 space-y-4">
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Wallet className="h-5 w-5 text-emerald-600" />
                      Envoyer de l&apos;argent
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Fee type selector */}
                    <div className="space-y-2">
                      <Label className="text-xs font-medium flex items-center gap-1">
                        <Phone className="h-3 w-3 text-emerald-600" />
                        Type de transfert
                      </Label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() => setFeeType('mova')}
                          className={`p-3 rounded-xl border-2 text-left transition-all ${
                            feeType === 'mova'
                              ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/20'
                              : 'border-border hover:border-emerald-200'
                          }`}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <Wallet className={`h-4 w-4 ${feeType === 'mova' ? 'text-emerald-600' : 'text-muted-foreground'}`} />
                            <span className="text-xs font-semibold">Portefeuille MOVA</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Badge className="text-[9px] bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400 border-0">
                              1% frais
                            </Badge>
                            <span className="text-[10px] text-muted-foreground">Gratuit → Gratuit</span>
                          </div>
                        </button>
                        <button
                          onClick={() => setFeeType('mobile_money')}
                          className={`p-3 rounded-xl border-2 text-left transition-all ${
                            feeType === 'mobile_money'
                              ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/20'
                              : 'border-border hover:border-amber-200'
                          }`}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <Phone className={`h-4 w-4 ${feeType === 'mobile_money' ? 'text-amber-600' : 'text-muted-foreground'}`} />
                            <span className="text-xs font-semibold">Mobile Money</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Badge className="text-[9px] bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400 border-0">
                              2% frais
                            </Badge>
                            <span className="text-[10px] text-muted-foreground">Orange / MTN</span>
                          </div>
                        </button>
                      </div>
                    </div>

                    {/* Phone number */}
                    <div className="space-y-2">
                      <Label className="text-xs font-medium flex items-center gap-1">
                        <Phone className="h-3 w-3 text-emerald-600" />
                        Numéro du destinataire
                      </Label>
                      <div className="relative">
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center gap-1 pointer-events-none">
                          <span className="text-sm text-muted-foreground font-medium">+224</span>
                        </div>
                        <Input
                          placeholder="6XX XX XX XX"
                          value={phone}
                          onChange={(e) => handlePhoneChange(e.target.value)}
                          className="pl-16 h-11 rounded-xl"
                          maxLength={13}
                          autoComplete="off"
                        />
                      </div>
                      {phone && !phoneValid && (
                        <p className="text-[10px] text-red-500 flex items-center gap-1">
                          <AlertCircle className="h-3 w-3" />
                          9 chiffres requis
                        </p>
                      )}
                    </div>

                    {/* Amount */}
                    <div className="space-y-2">
                      <Label className="text-xs font-medium flex items-center gap-1">
                        <Gift className="h-3 w-3 text-emerald-600" />
                        Montant
                      </Label>
                      <div className="relative">
                        <Input
                          type="number"
                          placeholder="0"
                          value={amount}
                          onChange={(e) => setAmount(e.target.value)}
                          className="h-11 rounded-xl text-lg font-semibold pr-20"
                          min={0}
                          max={5000000}
                        />
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                          <span className="text-sm text-muted-foreground font-medium">GNF</span>
                        </div>
                      </div>
                      {amount && Number(amount) > 5000000 && (
                        <p className="text-[10px] text-red-500 flex items-center gap-1">
                          <AlertCircle className="h-3 w-3" />
                          Montant maximum : 5 000 000 GNF
                        </p>
                      )}
                      {/* Quick amounts */}
                      <div className="flex gap-2 flex-wrap">
                        {[5000, 10000, 25000, 50000, 100000, 250000].map((amt) => (
                          <button
                            key={amt}
                            onClick={() => setAmount(String(amt))}
                            className={`px-2.5 py-1 rounded-lg text-[10px] font-medium border transition-all ${
                              Number(amount) === amt
                                ? 'bg-emerald-100 text-emerald-700 border-emerald-300 dark:bg-emerald-900/30 dark:text-emerald-400'
                                : 'border-border hover:border-emerald-300 text-muted-foreground'
                            }`}
                          >
                            {amt >= 1000 ? `${amt / 1000}k` : amt}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Reason */}
                    <div className="space-y-2">
                      <Label className="text-xs font-medium flex items-center gap-1">
                        <Gift className="h-3 w-3 text-emerald-600" />
                        Motif (optionnel)
                      </Label>
                      <div className="flex gap-2 flex-wrap">
                        {REASON_OPTIONS.map((opt) => (
                          <button
                            key={opt.value}
                            onClick={() => setReason(reason === opt.value ? '' : opt.value)}
                            className={`px-2.5 py-1.5 rounded-lg text-[10px] font-medium border transition-all ${
                              reason === opt.value
                                ? 'bg-emerald-100 text-emerald-700 border-emerald-300 dark:bg-emerald-900/30 dark:text-emerald-400'
                                : 'border-border hover:border-emerald-300 text-muted-foreground'
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Error display */}
                    {transferError && (
                      <div className="flex items-start gap-2 p-3 rounded-xl bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/30">
                        <XCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
                        <div>
                          <p className="text-xs font-semibold text-red-600 dark:text-red-400">Transfert échoué</p>
                          <p className="text-[11px] text-red-500 dark:text-red-400 mt-0.5">{transferError}</p>
                          <button
                            onClick={() => setTransferError(null)}
                            className="text-[10px] text-red-500 hover:underline mt-1"
                          >
                            Fermer
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Submit */}
                    <Button
                      className="w-full bg-emerald-600 hover:bg-emerald-700 h-12 text-base font-semibold mova-gradient"
                      onClick={handleSubmit}
                      disabled={!formValid || isSubmitting}
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                          Envoi en cours...
                        </>
                      ) : (
                        <>
                          <Send className="h-5 w-5 mr-2" />
                          Envoyer {amount ? formatGNF(numericAmount) : ''}
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>
            </TabsContent>

            {/* ── History ── */}
            <TabsContent value="history" className="mt-4 space-y-3">
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-3"
              >
                {txLoading ? (
                  <div className="space-y-3 py-8">
                    {[1, 2, 3].map((i) => (
                      <Card key={i}>
                        <CardContent className="p-4">
                          <div className="flex items-center gap-3 animate-pulse">
                            <div className="h-10 w-10 rounded-full bg-muted" />
                            <div className="flex-1 space-y-2">
                              <div className="h-3 w-32 bg-muted rounded" />
                              <div className="h-2 w-24 bg-muted rounded" />
                            </div>
                            <div className="space-y-1">
                              <div className="h-3 w-20 bg-muted rounded" />
                              <div className="h-2 w-14 bg-muted rounded" />
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : transferTxs.length === 0 ? (
                  <Card>
                    <CardContent className="p-8 text-center text-muted-foreground">
                      <History className="h-10 w-10 mx-auto mb-3 opacity-20" />
                      <p className="text-sm font-medium">Aucun transfert</p>
                      <p className="text-xs mt-1">Vos transferts apparaîtront ici</p>
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-4"
                        onClick={() => setActiveTab('transfer')}
                      >
                        <Send className="h-3.5 w-3.5 mr-1.5" />
                        Faire un transfert
                      </Button>
                    </CardContent>
                  </Card>
                ) : (
                  transferTxs.map((tx, idx) => {
                    const config = getTransactionStatus(tx)
                    const isOut = tx.type === 'transfer_out'
                    return (
                      <motion.div
                        key={tx.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.04 }}
                      >
                        <Card className="mova-card-hover">
                          <CardContent className="p-4">
                            <div className="flex items-center gap-3">
                              <div className={`h-10 w-10 rounded-full flex items-center justify-center border ${
                                isOut
                                  ? 'bg-red-50 border-red-200 dark:bg-red-950/20 dark:border-red-900/30'
                                  : 'bg-emerald-50 border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-900/30'
                              }`}>
                                {isOut ? (
                                  <ArrowUpRight className="h-4 w-4 text-red-500" />
                                ) : (
                                  <ArrowDownLeft className="h-4 w-4 text-emerald-500" />
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <p className="text-sm font-medium truncate">
                                    {isOut ? '→ ' : '← '}
                                    {tx.description.split(' ').slice(0, 4).join(' ')}
                                  </p>
                                  <Badge variant="secondary" className={`text-[9px] font-medium border-0 shrink-0 ${config.className}`}>
                                    <span className="flex items-center gap-0.5">
                                      {config.icon}
                                      {config.label}
                                    </span>
                                  </Badge>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                  {formatDate(tx.createdAt)}
                                  {tx.reference && (
                                    <span className="ml-2 font-mono text-[10px] opacity-60">{tx.reference.slice(0, 16)}</span>
                                  )}
                                </p>
                              </div>
                              <div className="text-right shrink-0">
                                <p className={`text-sm font-bold ${config.amountColor}`}>
                                  {config.sign}{formatGNF(Number(tx.amount))}
                                </p>
                                {isOut && tx.type === 'transfer_out' && (
                                  <p className="text-[9px] text-muted-foreground">
                                    Solde: {formatGNFShort(Number(tx.balance))}
                                  </p>
                                )}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </motion.div>
                    )
                  })
                )}
              </motion.div>
            </TabsContent>
          </Tabs>

          {/* ── Security Info ── */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card className="border-emerald-200 bg-emerald-50/30 dark:bg-emerald-950/10">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600 mt-0.5 shrink-0" />
                  <div className="space-y-1">
                    <p className="text-sm font-semibold">Transfert sécurisé</p>
                    <p className="text-xs text-muted-foreground">
                      Vos transactions sont protégées par un cryptage de bout en bout.
                      MOVA ne conserve aucune donnée bancaire. Disponible 24h/7j.
                      Code PIN requis pour chaque transfert.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>

      {/* ── PIN Confirmation Dialog ── */}
      <Dialog open={showPinDialog} onOpenChange={(open) => { if (!open) { setShowPinDialog(false); setPin(''); setPinError('') } }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader className="text-center">
            <div className="mx-auto mb-3 h-14 w-14 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
              <Shield className="h-7 w-7 text-emerald-600" />
            </div>
            <DialogTitle className="text-lg">Confirmez votre identité</DialogTitle>
            <DialogDescription>
              Entrez votre code PIN pour confirmer le transfert de {formatGNF(numericAmount)}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Transfer summary */}
            <div className="rounded-xl bg-muted/50 p-3 space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Destinataire</span>
                <span className="font-medium">+224 {phone}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Montant</span>
                <span className="font-semibold">{formatGNF(numericAmount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Frais ({feeType === 'mobile_money' ? '2%' : '1%'})</span>
                <span className="font-medium">{formatGNF(fee)}</span>
              </div>
              <div className="border-t pt-1.5 flex justify-between">
                <span className="font-semibold">Total</span>
                <span className="font-bold">{formatGNF(totalDebit)}</span>
              </div>
            </div>

            {/* PIN input */}
            <div className="flex flex-col items-center gap-2">
              <Label className="text-xs text-muted-foreground">Code PIN</Label>
              <InputOTP
                value={pin}
                onChange={(value) => { setPin(value); setPinError('') }}
                maxLength={4}
              >
                <InputOTPGroup>
                  <InputOTPSlot index={0} />
                  <InputOTPSlot index={1} />
                  <InputOTPSeparator />
                  <InputOTPSlot index={2} />
                  <InputOTPSlot index={3} />
                </InputOTPGroup>
              </InputOTP>
              {pinError && (
                <p className="text-[10px] text-red-500 flex items-center gap-1 mt-1">
                  <AlertCircle className="h-3 w-3" />
                  {pinError}
                </p>
              )}
              {!getStoredPin() && (
                <p className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-1">
                  Premier transfert ? Ce code deviendra votre PIN.
                </p>
              )}
            </div>
          </div>
          <DialogFooter className="flex-col gap-2 sm:flex-col">
            <Button
              className="w-full bg-emerald-600 hover:bg-emerald-700"
              onClick={confirmTransferWithPin}
              disabled={pin.length !== 4 || pinVerifying}
            >
              {pinVerifying ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Vérification en cours...
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Confirmer le transfert
                </>
              )}
            </Button>
            <Button
              variant="ghost"
              className="w-full"
              onClick={() => { setShowPinDialog(false); setPin(''); setPinError('') }}
              disabled={pinVerifying}
            >
              Annuler
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Receipt Dialog ── */}
      <Dialog open={showReceipt} onOpenChange={setShowReceipt}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader className="text-center">
            <div className="mx-auto mb-3 h-14 w-14 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
              <CheckCircle className="h-7 w-7 text-emerald-600" />
            </div>
            <DialogTitle className="text-lg">Transfert réussi !</DialogTitle>
            <DialogDescription>
              Votre transfert a été effectué avec succès
            </DialogDescription>
          </DialogHeader>
          {lastTransfer && (
            <div className="space-y-3 py-2">
              <div className="rounded-xl bg-muted/50 p-4 space-y-2.5">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Référence</span>
                  <span className="font-mono font-semibold text-xs">{lastTransfer.reference}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Destinataire</span>
                  <span className="font-medium text-right">
                    {lastTransfer.recipient.name || 'Utilisateur'}
                    {lastTransfer.recipient.phone && (
                      <span className="block text-[10px] text-muted-foreground">
                        {formatPhoneDisplay(lastTransfer.recipient.phone)}
                      </span>
                    )}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Montant envoyé</span>
                  <span className="font-semibold">{formatGNF(lastTransfer.amount)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Frais</span>
                  <span className="font-medium">{formatGNF(lastTransfer.fee)}</span>
                </div>
                <div className="border-t pt-2 flex justify-between text-sm">
                  <span className="text-muted-foreground">Total débité</span>
                  <span className="font-bold text-base">{formatGNF(lastTransfer.totalDebit)}</span>
                </div>
                {lastTransfer.reason && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Motif</span>
                    <span className="text-xs">{lastTransfer.reason}</span>
                  </div>
                )}
                <div className="border-t pt-2 flex justify-between text-sm">
                  <span className="text-muted-foreground">Nouveau solde</span>
                  <span className="font-bold text-emerald-600">{formatGNF(lastTransfer.sender.newBalance)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Date</span>
                  <span className="text-xs">{formatDate(lastTransfer.completedAt)}</span>
                </div>
              </div>
              {/* Transaction ID */}
              <div className="flex items-center gap-2 p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/20">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                <p className="text-[10px] text-emerald-600 dark:text-emerald-400">
                  ID transaction: {lastTransfer.debitTransaction.slice(0, 20)}...
                </p>
              </div>
            </div>
          )}
          <DialogFooter className="flex-col gap-2 sm:flex-col">
            <Button
              className="w-full bg-emerald-600 hover:bg-emerald-700"
              onClick={() => { setShowReceipt(false); setLastTransfer(null); setActiveTab('history') }}
            >
              Voir l&apos;historique
            </Button>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => { setShowReceipt(false); setLastTransfer(null) }}
            >
              Nouveau transfert
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Add Contact Dialog ── */}
      <Dialog open={showAddContact} onOpenChange={setShowAddContact}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <div className="mx-auto mb-3 h-12 w-12 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
              <UserPlus className="h-6 w-6 text-emerald-600" />
            </div>
            <DialogTitle className="text-center">Ajouter un contact</DialogTitle>
            <DialogDescription className="text-center">
              Ajoutez un contact fréquent pour transférer plus rapidement
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-2">
              <Label className="text-xs font-medium">Nom complet</Label>
              <Input
                placeholder="Ex: Fatoumata Diallo"
                value={newContactName}
                onChange={(e) => setNewContactName(e.target.value)}
                className="h-10 rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-medium">Numéro de téléphone</Label>
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
                  <span className="text-sm text-muted-foreground font-medium">+224</span>
                </div>
                <Input
                  placeholder="6XX XX XX XX"
                  value={newContactPhone}
                  onChange={(e) => {
                    const val = e.target.value
                    const cleaned = val.replace(/[^\d\s]/g, '')
                    const digits = cleaned.replace(/\s/g, '').slice(0, 9)
                    let formatted = ''
                    if (digits.length <= 3) formatted = digits
                    else if (digits.length <= 5) formatted = digits.slice(0, 3) + ' ' + digits.slice(3)
                    else if (digits.length <= 7) formatted = digits.slice(0, 3) + ' ' + digits.slice(3, 5) + ' ' + digits.slice(5)
                    else formatted = digits.slice(0, 3) + ' ' + digits.slice(3, 5) + ' ' + digits.slice(5, 7) + ' ' + digits.slice(7)
                    setNewContactPhone(formatted)
                  }}
                  className="pl-16 h-10 rounded-xl"
                  maxLength={13}
                />
              </div>
            </div>
          </div>
          <DialogFooter className="flex-col gap-2 sm:flex-col">
            <Button
              className="w-full bg-emerald-600 hover:bg-emerald-700"
              onClick={handleSaveContact}
              disabled={!newContactName.trim() || newContactPhone.replace(/\s/g, '').length !== 9}
            >
              <Plus className="h-4 w-4 mr-2" />
              Ajouter
            </Button>
            <Button
              variant="ghost"
              className="w-full"
              onClick={() => setShowAddContact(false)}
            >
              Annuler
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
