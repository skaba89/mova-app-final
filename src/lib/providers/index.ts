/**
 * ═══════════════════════════════════════════════════════════════════════════
 * MOVA — Fournisseurs Mobile Money (Index)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Point d'entrée centralisé pour les intégrations Mobile Money.
 * Exporte les fournisseurs Orange Money et MTN MoMo, ainsi que
 * l'interface unifiée pour le routage des paiements.
 *
 * @example
 * ```ts
 * import { getProvider, isDemoMode, orangeMoneyProvider, mtnMoMoProvider } from '@/lib/providers'
 *
 * // Obtenir un fournisseur spécifique
 * const provider = getProvider('orange_money')
 * const result = await provider.initiatePayment({ ... })
 *
 * // Vérifier le mode
 * console.log(isDemoMode()) // true si aucune clé API n'est configurée
 * ```
 */

// ─── Exports des fournisseurs ─────────────────────────────────────────

export { orangeMoneyProvider } from './orange-money'
export { mtnMoMoProvider } from './mtn-momo'

// ─── Ré-export des types ──────────────────────────────────────────────

export type {
  OrangeMoneyConfig,
  OrangeMoneyPaymentRequest,
  OrangeMoneyPaymentResponse,
  OrangeMoneyStatusResponse,
} from './orange-money'

export type {
  MTNMoMoConfig,
  MTNMoMoCollectionRequest,
  MTNMoMoDisbursementRequest,
  MTNMoMoPaymentResponse,
  MTNMoMoStatusResponse,
} from './mtn-momo'

export {
  OrangeMoneyError,
  OrangeMoneyAuthError,
  OrangeMoneyPaymentError,
  OrangeMoneyTimeoutError,
} from './orange-money'

export {
  MTNMoMoError,
  MTNMoMoAuthError,
  MTNMoMoPaymentError,
  MTNMoMoTimeoutError,
} from './mtn-momo'

// ─── Types communs ────────────────────────────────────────────────────

import type { MobileMoneyProvider } from '@/lib/mobile-money'

/** Interface unifiée pour les opérations de paiement */
export interface MobileMoneyProviderInterface {
  /** Nom d'affichage du fournisseur */
  name: string
  /** Type de fournisseur */
  type: MobileMoneyProvider
  /** Vérifie si le mode démonstration est actif */
  isDemoMode(): boolean
  /**
   * Lance un paiement.
   * @param phone - Numéro de téléphone du client
   * @param amount - Montant en unités monétaires
   * @param currency - Code devise (GNF)
   * @param reference - Référence unique MOVA
   * @returns Identifiant de paiement et statut
   */
  initiatePayment(phone: string, amount: number, currency: string, reference: string): Promise<{
    paymentId: string
    status: 'pending' | 'processing' | 'failed'
    message: string
    timestamp: string
  }>
  /**
   * Vérifie le statut d'un paiement.
   * @param paymentId - Identifiant de paiement
   * @returns Statut actuel de la transaction
   */
  checkStatus(paymentId: string): Promise<{
    paymentId: string
    status: 'pending' | 'completed' | 'failed' | 'expired'
    amount: number
    currency: string
    completedAt?: string
    errorMessage?: string
  }>
}

/** Statut de configuration d'un fournisseur */
export interface ProviderConfigStatus {
  /** Nom du fournisseur */
  name: string
  /** Type de fournisseur */
  type: MobileMoneyProvider
  /** `true` si le fournisseur est configuré et prêt pour la production */
  configured: boolean
  /** Mode actif (demo ou production) */
  mode: 'demo' | 'production'
}

// ─── Fonctions utilitaires ────────────────────────────────────────────

import { orangeMoneyProvider } from './orange-money'
import { mtnMoMoProvider } from './mtn-momo'

/**
 * Vérifie si le mode démonstration est globalement actif.
 * Retourne `true` si AUCUN fournisseur n'a ses clés API configurées.
 */
export function isDemoMode(): boolean {
  return orangeMoneyProvider.isDemoMode() && mtnMoMoProvider.isDemoMode()
}

/**
 * Retourne le statut de configuration de tous les fournisseurs.
 *
 * @returns Tableau des statuts de configuration
 *
 * @example
 * ```ts
 * const status = getProviderStatus()
 * // [
 * //   { name: 'Orange Money', type: 'orange_money', configured: true, mode: 'production' },
 * //   { name: 'MTN MoMo', type: 'mtn_momo', configured: false, mode: 'demo' },
 * // ]
 * ```
 */
export function getProviderStatus(): ProviderConfigStatus[] {
  const orangeConfigured = !orangeMoneyProvider.isDemoMode()
  const mtnConfigured = !mtnMoMoProvider.isDemoMode()

  return [
    {
      name: 'Orange Money',
      type: 'orange_money',
      configured: orangeConfigured,
      mode: orangeConfigured ? 'production' : 'demo',
    },
    {
      name: 'MTN MoMo',
      type: 'mtn_momo',
      configured: mtnConfigured,
      mode: mtnConfigured ? 'production' : 'demo',
    },
  ]
}

/**
 * Retourne le fournisseur approprié pour un type de Mobile Money donné.
 * En mode démonstration, le fournisseur correspondant sera utilisé automatiquement.
 *
 * @param provider - Type de fournisseur ('orange_money' ou 'mtn_momo')
 * @returns Instance du fournisseur correspondant
 * @throws {Error} Si le type de fournisseur n'est pas reconnu
 *
 * @example
 * ```ts
 * const provider = getProvider('orange_money')
 * if (provider.isDemoMode()) {
 *   console.log('Paiement simulé')
 * } else {
 *   console.log('Paiement réel')
 * }
 * ```
 */
export function getProvider(provider: MobileMoneyProvider) {
  switch (provider) {
    case 'orange_money':
      return orangeMoneyProvider
    case 'mtn_momo':
      return mtnMoMoProvider
    default:
      throw new Error(`Fournisseur Mobile Money non reconnu : ${provider}`)
  }
}
