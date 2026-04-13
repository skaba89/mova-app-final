/**
 * ═══════════════════════════════════════════════════════════════════════════
 * MOVA — Bibliothèque d'intégration Mobile Money
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Supporte Orange Money et MTN Mobile Money (Afrique de l'Ouest - Guinée).
 * Le mode démonstration simule des paiements réussis en mémoire.
 * Les appels API réels sont délégués aux fournisseurs configurés.
 *
 * Fournisseurs :
 * - Orange Money : OTP push, vérification OAuth2
 * - MTN MoMo     : Collection, décaissement, vérification
 *
 * @module mobile-money
 */

// ─── Imports des fournisseurs ─────────────────────────────────────────

import {
  orangeMoneyProvider,
  mtnMoMoProvider,
  isDemoMode as providersDemoMode,
  getProviderStatus as providersGetStatus,
  type ProviderConfigStatus,
} from './providers'

// ─── Types publics ────────────────────────────────────────────────────

export type MobileMoneyProvider = 'orange_money' | 'mtn_momo'
export type PaymentStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled'

export interface MobileMoneyPayment {
  transactionId: string
  provider: MobileMoneyProvider
  phone: string
  amount: number
  currency: string
  status: PaymentStatus
  createdAt: Date
  completedAt?: Date
  errorMessage?: string
  reference?: string
}

export interface InitiatePaymentResult {
  success: boolean
  transactionId: string
  status: PaymentStatus
  message?: string
  error?: string
}

export interface PaymentStatusResult {
  success: boolean
  transactionId: string
  status: PaymentStatus
  amount?: number
  currency?: string
  completedAt?: string
  error?: string
}

// ─── Magasin de transactions (mode démonstration) ─────────────────────

/** Magasin en mémoire des transactions (demo/fallback) */
const transactions = new Map<string, MobileMoneyPayment>()

/** Map pour stocker les identifiants de paiement des fournisseurs externes */
const providerPaymentIds = new Map<string, string>()

// ─── Informations sur les fournisseurs ────────────────────────────────

/** Informations d'affichage des fournisseurs Mobile Money */
export const PROVIDER_INFO: Record<MobileMoneyProvider, { name: string; logo: string; color: string; prefix: string }> = {
  orange_money: {
    name: 'Orange Money',
    logo: '🍊',
    color: '#FF6600',
    prefix: '+224 62',
  },
  mtn_momo: {
    name: 'MTN Mobile Money',
    logo: '📱',
    color: '#FFCC00',
    prefix: '+224 63',
  },
}

// ─── Fonctions utilitaires ────────────────────────────────────────────

/**
 * Génère un identifiant de transaction unique.
 * Format : MOVA-{OM|MM}-{timestamp36}-{random}
 *
 * @param provider - Type de fournisseur Mobile Money
 * @returns Identifiant de transaction unique
 */
export function generateTransactionId(provider: MobileMoneyProvider): string {
  const prefix = provider === 'orange_money' ? 'OM' : 'MM'
  const timestamp = Date.now().toString(36).toUpperCase()
  const random = Math.random().toString(36).substring(2, 6).toUpperCase()
  return `MOVA-${prefix}-${timestamp}-${random}`
}

/**
 * Valide un numéro de téléphone Mobile Money.
 * Vérifie la longueur minimale (8 chiffres) et le format.
 *
 * @param phone - Numéro de téléphone à valider
 * @param provider - Type de fournisseur pour vérification indicative
 * @returns Résultat de validation avec erreur éventuelle
 */
export function validateMobileMoneyPhone(phone: string, provider: MobileMoneyProvider): { valid: boolean; error?: string } {
  const cleaned = phone.replace(/[\s\-()]/g, '')

  if (!cleaned) {
    return { valid: false, error: 'Le numéro de téléphone est requis.' }
  }

  // Vérifier la longueur (minimum 8 chiffres)
  const digits = cleaned.replace(/\D/g, '')
  if (digits.length < 8) {
    return { valid: false, error: 'Le numéro de téléphone est trop court.' }
  }

  // Indication de préfixe (informationnelle, non bloquante)
  void provider
  void PROVIDER_INFO

  return { valid: true }
}

/**
 * Valide le montant d'un paiement.
 * Vérifie le type, le signe et les limites min/max.
 *
 * @param amount - Montant à valider
 * @returns Résultat de validation avec erreur éventuelle
 */
export function validateAmount(amount: number): { valid: boolean; error?: string } {
  if (typeof amount !== 'number' || isNaN(amount)) {
    return { valid: false, error: 'Le montant doit être un nombre.' }
  }

  if (amount <= 0) {
    return { valid: false, error: 'Le montant doit être supérieur à 0.' }
  }

  // Minimum 100 GNF (environ 0,01 USD)
  if (amount < 100) {
    return { valid: false, error: 'Le montant minimum est de 100 GNF.' }
  }

  // Maximum 5 000 000 GNF par transaction
  if (amount > 5_000_000) {
    return { valid: false, error: 'Le montant maximum par transaction est de 5 000 000 GNF.' }
  }

  return { valid: true }
}

/**
 * Formate un montant en GNF avec les paramètres régionaux français.
 *
 * @param amount - Montant à formater
 * @returns Chaîne formatée (ex: "50 000 GNF")
 */
export function formatGNF(amount: number): string {
  return new Intl.NumberFormat('fr-GN').format(amount) + ' GNF'
}

// ─── Fonctions d'état du système ──────────────────────────────────────

/**
 * Vérifie si le mode démonstration est globalement actif.
 * Retourne `true` si AUCUN fournisseur n'a ses clés API configurées.
 *
 * @returns `true` si en mode démonstration
 */
export function isDemoMode(): boolean {
  return providersDemoMode()
}

/**
 * Retourne le statut de configuration de tous les fournisseurs Mobile Money.
 *
 * @returns Tableau des statuts de configuration
 */
export function getProviderStatus(): ProviderConfigStatus[] {
  return providersGetStatus()
}

// ─── Fonctions de paiement ────────────────────────────────────────────

/**
 * Lance un paiement Mobile Money.
 *
 * Si les clés API sont configurées pour le fournisseur demandé, l'appel
 * est délégué à l'API réelle. Sinon, le paiement est simulé en mémoire.
 *
 * @param provider - Type de fournisseur ('orange_money' ou 'mtn_momo')
 * @param phone - Numéro de téléphone associé au compte Mobile Money
 * @param amount - Montant en GNF
 * @param currency - Code devise (défaut : GNF)
 * @param userId - Identifiant utilisateur optionnel pour le suivi
 * @returns Résultat de l'initiation de paiement
 *
 * @example
 * ```ts
 * const result = await initiatePayment('orange_money', '+224620000000', 5000, 'GNF', 'user-123')
 * if (result.success) {
 *   console.log(`Transaction : ${result.transactionId}`)
 *   console.log(`Message : ${result.message}`)
 * }
 * ```
 */
export async function initiatePayment(
  provider: MobileMoneyProvider,
  phone: string,
  amount: number,
  currency: string = 'GNF',
  userId?: string
): Promise<InitiatePaymentResult> {
  // Valider le numéro de téléphone
  const phoneValidation = validateMobileMoneyPhone(phone, provider)
  if (!phoneValidation.valid) {
    return {
      success: false,
      transactionId: '',
      status: 'failed',
      error: phoneValidation.error,
    }
  }

  // Valider le montant
  const amountValidation = validateAmount(amount)
  if (!amountValidation.valid) {
    return {
      success: false,
      transactionId: '',
      status: 'failed',
      error: amountValidation.error,
    }
  }

  // Générer l'identifiant de transaction
  const transactionId = generateTransactionId(provider)
  const reference = `TXN-${Date.now()}`

  // Créer l'entrée de paiement en mémoire
  const payment: MobileMoneyPayment = {
    transactionId,
    provider,
    phone,
    amount,
    currency,
    status: 'pending',
    createdAt: new Date(),
    reference,
  }
  transactions.set(transactionId, payment)

  console.info(`[MobileMoney] ${provider} : Initiation de ${amount} ${currency} vers ${phone} (txn: ${transactionId})`)

  // Tenter l'appel API au fournisseur
  try {
    if (provider === 'orange_money') {
      if (orangeMoneyProvider.isDemoMode()) {
        console.info('[MobileMoney] Orange Money en mode démonstration — simulation en mémoire.')
        scheduleDemoCompletion(transactionId)
      } else {
        const result = await orangeMoneyProvider.initiatePayment({
          phoneNumber: phone,
          amount,
          currency,
          reference,
        })
        // Stocker l'ID du paiement fournisseur pour vérification ultérieure
        providerPaymentIds.set(transactionId, result.paymentId)
        payment.reference = result.paymentId
        console.info(`[MobileMoney] Orange Money : Paiement initié avec l'ID ${result.paymentId}`)
      }
    } else if (provider === 'mtn_momo') {
      if (mtnMoMoProvider.isDemoMode()) {
        console.info('[MobileMoney] MTN MoMo en mode démonstration — simulation en mémoire.')
        scheduleDemoCompletion(transactionId)
      } else {
        const result = await mtnMoMoProvider.requestToPay({
          phoneNumber: phone,
          amount,
          currency,
          reference,
          payerMessage: `Recharge portefeuille MOVA - ${reference}`,
        })
        // Stocker l'ID de référence pour vérification ultérieure
        providerPaymentIds.set(transactionId, result.referenceId)
        payment.reference = result.referenceId
        console.info(`[MobileMoney] MTN MoMo : Paiement initié avec l'ID ${result.referenceId}`)
      }
    }

    return {
      success: true,
      transactionId,
      status: 'pending',
      message: `Paiement ${PROVIDER_INFO[provider].name} initié. Veuillez confirmer sur votre téléphone.`,
    }
  } catch (error) {
    // En cas d'erreur API, basculer en mode démonstration
    const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue du fournisseur.'
    console.error(`[MobileMoney] Erreur API ${provider} : ${errorMessage}. Basculement en mode démonstration.`)

    payment.status = 'failed'
    payment.errorMessage = errorMessage

    return {
      success: false,
      transactionId,
      status: 'failed',
      error: `Échec du paiement : ${errorMessage}. Veuillez réessayer.`,
    }
  }
}

/**
 * Vérifie le statut d'un paiement Mobile Money.
 *
 * Si le paiement a été initié via un fournisseur réel, interroge l'API
 * du fournisseur. Sinon, retourne le statut de la simulation en mémoire.
 *
 * @param transactionId - Identifiant de transaction retourné par initiatePayment
 * @returns Statut actuel de la transaction
 */
export async function checkPaymentStatus(transactionId: string): Promise<PaymentStatusResult> {
  const payment = transactions.get(transactionId)

  if (!payment) {
    return {
      success: false,
      transactionId,
      status: 'failed',
      error: 'Transaction introuvable.',
    }
  }

  // Si un ID de paiement fournisseur existe, vérifier via l'API
  const providerPayId = providerPaymentIds.get(transactionId)
  if (providerPayId) {
    try {
      if (payment.provider === 'orange_money' && !orangeMoneyProvider.isDemoMode()) {
        const result = await orangeMoneyProvider.checkStatus(providerPayId)
        // Mettre à jour le statut local
        const statusMap: Record<string, PaymentStatus> = {
          pending: 'pending',
          completed: 'completed',
          failed: 'failed',
          expired: 'failed',
        }
        payment.status = statusMap[result.status] || 'pending'
        if (result.completedAt) {
          payment.completedAt = new Date(result.completedAt)
        }
        if (result.errorMessage) {
          payment.errorMessage = result.errorMessage
        }
        return {
          success: true,
          transactionId: payment.transactionId,
          status: payment.status,
          amount: result.amount || payment.amount,
          currency: result.currency || payment.currency,
          completedAt: payment.completedAt?.toISOString(),
        }
      } else if (payment.provider === 'mtn_momo' && !mtnMoMoProvider.isDemoMode()) {
        const result = await mtnMoMoProvider.checkStatus(providerPayId, 'collection')
        const statusMap: Record<string, PaymentStatus> = {
          pending: 'pending',
          processing: 'processing',
          completed: 'completed',
          failed: 'failed',
          expired: 'failed',
          reversed: 'failed',
        }
        payment.status = statusMap[result.status] || 'pending'
        if (result.completedAt) {
          payment.completedAt = new Date(result.completedAt)
        }
        if (result.reason) {
          payment.errorMessage = result.reason
        }
        return {
          success: true,
          transactionId: payment.transactionId,
          status: payment.status,
          amount: result.amount || payment.amount,
          currency: result.currency || payment.currency,
          completedAt: payment.completedAt?.toISOString(),
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue.'
      console.warn(`[MobileMoney] Erreur de vérification du statut via l'API : ${errorMessage}`)
      // Continuer avec le statut en mémoire
    }
  }

  // Retourner le statut en mémoire
  return {
    success: true,
    transactionId: payment.transactionId,
    status: payment.status,
    amount: payment.amount,
    currency: payment.currency,
    completedAt: payment.completedAt?.toISOString(),
  }
}

/**
 * Récupère toutes les transactions pour un utilisateur (demo/admin).
 *
 * @param userId - Identifiant utilisateur optionnel (non utilisé en demo)
 * @returns Liste des transactions triées par date décroissante
 */
export function getUserTransactions(userId?: string): MobileMoneyPayment[] {
  // En mode demo, retourner toutes les transactions
  // En production, filtrer par userId depuis la base de données
  void userId
  return Array.from(transactions.values()).sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
  )
}

// ─── Simulation de démonstration ──────────────────────────────────────

/**
 * Planifie la complétion simulée d'un paiement en mode démonstration.
 * Simule un délai de traitement de 2 secondes puis une complétion (95% de succès).
 *
 * @param transactionId - Identifiant de transaction à compléter
 */
function scheduleDemoCompletion(transactionId: string): void {
  setTimeout(() => {
    const storedPayment = transactions.get(transactionId)
    if (storedPayment && storedPayment.status === 'pending') {
      storedPayment.status = 'processing'
      console.info(`[MobileMoney][DEMO] ${transactionId} : Traitement en cours...`)

      // Simuler la complétion après 1,5 seconde supplémentaire
      setTimeout(() => {
        const p = transactions.get(transactionId)
        if (p && p.status === 'processing') {
          // Taux de réussite de 95% en demo
          const success = Math.random() < 0.95
          p.status = success ? 'completed' : 'failed'
          p.completedAt = new Date()
          if (!success) {
            p.errorMessage = 'Solde insuffisant. Veuillez vérifier votre compte Mobile Money.'
          }
          console.info(`[MobileMoney][DEMO] ${transactionId} : ${p.status}`)
        }
      }, 1500)
    }
  }, 2000)
}
