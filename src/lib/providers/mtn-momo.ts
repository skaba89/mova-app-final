/**
 * ═══════════════════════════════════════════════════════════════════════════
 * MOVA — Intégration MTN Mobile Money (MoMo) API (Production)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Fournisseur de paiement MTN MoMo pour l'Afrique de l'Ouest (Guinée).
 * Supporte la collecte (paiement client), le décaissement (paiement fournisseur),
 * et la vérification de statut de transaction.
 *
 * Variables d'environnement :
 * - MTN_MOMO_API_KEY          : Clé d'API utilisateur MoMo
 * - MTN_MOMO_SUBSCRIPTION_KEY : Clé d'abonnement au produit
 * - MTN_MOMO_BASE_URL         : URL de base de l'API (défaut: sandbox)
 * - MTN_MOMO_USER_ID          : Identifiant utilisateur (UUID)
 *
 * Modes :
 * - Production : Appels réels à l'API MTN MoMo
 * - Démonstration : Simulation en mémoire (si les clés API ne sont pas configurées)
 *
 * @example
 * ```ts
 * import { mtnMoMoProvider } from '@/lib/providers/mtn-momo';
 *
 * // Demander un paiement (collection)
 * const result = await mtnMoMoProvider.requestToPay({
 *   phoneNumber: '+224630000000',
 *   amount: 5000,
 *   currency: 'GNF',
 *   reference: 'MOVA-MM-ABC123',
 *   payerMessage: 'Recharge portefeuille MOVA',
 * });
 *
 * // Vérifier le statut
 * const status = await mtnMoMoProvider.checkStatus('ref-uuid-123');
 * ```
 */

// ─── Configuration ────────────────────────────────────────────────────

/** Configuration du fournisseur MTN MoMo */
export interface MTNMoMoConfig {
  /** Clé d'API utilisateur MoMo */
  apiKey: string;
  /** Clé d'abonnement au produit */
  subscriptionKey: string;
  /** Identifiant utilisateur MoMo (UUID) */
  userId: string;
  /** URL de base de l'API MTN MoMo */
  baseUrl: string;
  /** Délai d'expiration des requêtes en millisecondes (défaut: 30 000) */
  timeout: number;
  /** Nombre maximal de tentatives (défaut: 3) */
  maxRetries: number;
}

/** Valeurs par défaut de la configuration */
const DEFAULT_CONFIG: Omit<MTNMoMoConfig, 'apiKey' | 'subscriptionKey'> = {
  userId: '',
  baseUrl: 'https://sandbox.momodeveloper.mtn.com/v1_0',
  timeout: 30_000,
  maxRetries: 3,
}

// ─── Types de requête / réponse API ────────────────────────────────────

/** Paramètres de demande de paiement (collection) */
export interface MTNMoMoCollectionRequest {
  /** Numéro de téléphone du payeur (format international) */
  phoneNumber: string;
  /** Montant du paiement */
  amount: number;
  /** Devise (GNF pour la Guinée) */
  currency: string;
  /** Référence unique de la transaction MOVA */
  reference: string;
  /** Message affiché au payeur (max 256 caractères) */
  payerMessage?: string;
  /** Note interne (max 256 caractères) */
  payeeNote?: string;
}

/** Paramètres de décaissement (paiement au client) */
export interface MTNMoMoDisbursementRequest {
  /** Numéro de téléphone du bénéficiaire */
  phoneNumber: string;
  /** Montant du décaissement */
  amount: number;
  /** Devise */
  currency: string;
  /** Référence unique */
  reference: string;
  /** Message affiché au bénéficiaire */
  payeeMessage?: string;
  /** Note interne */
  payerMessage?: string;
}

/** Réponse de demande de paiement */
export interface MTNMoMoPaymentResponse {
  /** Identifiant de référence unique de la transaction */
  referenceId: string;
  /** Statut de la demande */
  status: 'pending' | 'processing' | 'failed';
  /** Message descriptif */
  message: string;
  /** Horodatage */
  timestamp: string;
}

/** Réponse de statut de transaction */
export interface MTNMoMoStatusResponse {
  /** Identifiant de référence unique */
  referenceId: string;
  /** Référence MOVA */
  reference: string;
  /** Statut du paiement */
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'expired' | 'reversed';
  /** Montant */
  amount: number;
  /** Devise */
  currency: string;
  /** Numéro de téléphone du payeur */
  phoneNumber: string;
  /** Raison du paiement */
  payerMessage?: string;
  /** Horodatage de complétion */
  completedAt?: string;
  /** Motif d'échec */
  reason?: string;
}

/** Réponse de création de clé d'accès API */
interface APIKeyResponse {
  /** Clé d'API générée */
  apiKey: string;
  /** Date d'expiration */
  expiresIn: number;
}

// ─── Classes d'erreur ──────────────────────────────────────────────────

/** Erreur de base pour le fournisseur MTN MoMo */
export class MTNMoMoError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode?: number,
    public readonly details?: Record<string, unknown>
  ) {
    super(message)
    this.name = 'MTNMoMoError'
  }
}

/** Erreur d'authentification */
export class MTNMoMoAuthError extends MTNMoMoError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'AUTH_ERROR', 401, details)
    this.name = 'MTNMoMoAuthError'
  }
}

/** Erreur de paiement */
export class MTNMoMoPaymentError extends MTNMoMoError {
  constructor(message: string, statusCode?: number, details?: Record<string, unknown>) {
    super(message, 'PAYMENT_ERROR', statusCode, details)
    this.name = 'MTNMoMoPaymentError'
  }
}

/** Erreur de délai d'attente */
export class MTNMoMoTimeoutError extends MTNMoMoError {
  constructor(message: string) {
    super(message, 'TIMEOUT_ERROR', undefined, { timeout: true })
    this.name = 'MTNMoMoTimeoutError'
  }
}

// ─── Utilitaires internes ──────────────────────────────────────────────

/**
 * Crée une instance AbortController avec un délai d'expiration.
 * @param timeoutMs - Délai en millisecondes
 */
function createTimeoutController(timeoutMs: number): { controller: AbortController; timeoutId: ReturnType<typeof setTimeout> } {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)
  return { controller, timeoutId }
}

/**
 * Applique un backoff exponentiel entre les tentatives.
 * @param attempt - Numéro de tentative (0-indexed)
 * @param baseDelay - Délai de base en ms (défaut: 1000ms)
 */
function getExponentialBackoff(attempt: number, baseDelay: number = 1000): number {
  return baseDelay * Math.pow(2, attempt) + Math.random() * 500
}

/**
 * Génère un UUID v4 pour les références de transaction MTN.
 */
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

/**
 * Nettoie un numéro de téléphone pour l'API MTN MoMo.
 * Garde uniquement les chiffres et le préfixe +.
 */
function sanitizePhoneNumber(phone: string): string {
  return phone.replace(/[\s\-()]/g, '')
}

// ─── Implémentation du fournisseur ────────────────────────────────────

/**
 * Fournisseur MTN Mobile Money (MoMo).
 *
 * Gère les appels API réels vers MTN MoMo avec authentification Basic + Subscription Key,
 * retry avec backoff exponentiel, et mode démonstration automatique.
 */
export const mtnMoMoProvider = {
  /**
   * Vérifie si le mode démonstration est actif.
   * Retourne `true` si les clés API ne sont pas configurées.
   */
  isDemoMode(): boolean {
    return !process.env.MTN_MOMO_API_KEY || !process.env.MTN_MOMO_SUBSCRIPTION_KEY
  },

  /**
   * Retourne la configuration effective du fournisseur.
   */
  getConfig(): MTNMoMoConfig {
    return {
      apiKey: process.env.MTN_MOMO_API_KEY || '',
      subscriptionKey: process.env.MTN_MOMO_SUBSCRIPTION_KEY || '',
      userId: process.env.MTN_MOMO_USER_ID || '',
      baseUrl: process.env.MTN_MOMO_BASE_URL || DEFAULT_CONFIG.baseUrl,
      timeout: DEFAULT_CONFIG.timeout,
      maxRetries: DEFAULT_CONFIG.maxRetries,
    }
  },

  // ── En-têtes d'authentification ────────────────────────────────────

  /**
   * Construit les en-têtes d'authentification pour les requêtes API.
   * Utilise l'authentification Basic avec la clé API et la clé d'abonnement.
   */
  getAuthHeaders(): Record<string, string> {
    const config = this.getConfig()
    return {
      'Authorization': `Basic ${Buffer.from(config.apiKey).toString('base64')}`,
      'Ocp-Apim-Subscription-Key': config.subscriptionKey,
      'X-Target-Environment': process.env.NODE_ENV === 'production' ? 'mtnmomo' : 'sandbox',
      'Content-Type': 'application/json',
    }
  },

  // ── Collection (demande de paiement) ──────────────────────────────

  /**
   * Demande un paiement au client via MTN MoMo (collection).
   * Le client recevra une notification USSD/SMS pour confirmer le paiement.
   *
   * @param params - Paramètres de paiement
   * @returns Réponse avec identifiant de référence unique
   * @throws {MTNMoMoPaymentError} En cas d'échec de la demande
   *
   * @example
   * ```ts
   * const result = await mtnMoMoProvider.requestToPay({
   *   phoneNumber: '+224630000000',
   *   amount: 5000,
   *   currency: 'GNF',
   *   reference: 'MOVA-MM-ABC123',
   *   payerMessage: 'Recharge portefeuille MOVA',
   * })
   * ```
   */
  async requestToPay(params: MTNMoMoCollectionRequest): Promise<MTNMoMoPaymentResponse> {
    const { phoneNumber, amount, currency, reference, payerMessage, payeeNote } = params

    // Validation des paramètres
    const sanitizedPhone = sanitizePhoneNumber(phoneNumber)
    if (!sanitizedPhone || sanitizedPhone.length < 8) {
      throw new MTNMoMoPaymentError('Numéro de téléphone invalide.', 400)
    }
    if (typeof amount !== 'number' || amount <= 0) {
      throw new MTNMoMoPaymentError('Le montant doit être un nombre positif.', 400)
    }
    if (amount < 100) {
      throw new MTNMoMoPaymentError('Le montant minimum est de 100 GNF.', 400)
    }
    if (amount > 5_000_000) {
      throw new MTNMoMoPaymentError('Le montant maximum par transaction est de 5 000 000 GNF.', 400)
    }

    // Mode démonstration
    if (this.isDemoMode()) {
      const referenceId = generateUUID()
      console.info(`[MTNMoMo][DEMO] Demande de paiement : ${amount} ${currency} → ${sanitizedPhone} (réf: ${reference})`)
      return {
        referenceId,
        status: 'pending',
        message: 'Paiement MTN MoMo initié (mode démonstration). Veuillez confirmer sur votre téléphone.',
        timestamp: new Date().toISOString(),
      }
    }

    // Appel API réel avec retry
    const config = this.getConfig()
    const referenceId = generateUUID()
    let lastError: Error | null = null

    for (let attempt = 0; attempt < config.maxRetries; attempt++) {
      if (attempt > 0) {
        const delay = getExponentialBackoff(attempt)
        console.warn(`[MTNMoMo] Tentative ${attempt + 1}/${config.maxRetries} après ${delay}ms...`)
        await new Promise((resolve) => setTimeout(resolve, delay))
      }

      try {
        const { controller, timeoutId } = createTimeoutController(config.timeout)
        const configUrl = config.userId
          ? `${config.baseUrl.replace('/v1_0', '')}/v1_0/${config.userId}`
          : config.baseUrl

        const response = await fetch(`${configUrl}/collections`, {
          method: 'POST',
          headers: {
            ...this.getAuthHeaders(),
            'X-Reference-Id': referenceId,
          },
          body: JSON.stringify({
            amount: String(amount),
            currency,
            externalId: reference,
            payer: {
              partyIdType: 'MSISDN',
              partyId: sanitizedPhone,
            },
            payerMessage: (payerMessage || `Paiement MOVA - ${reference}`).substring(0, 256),
            payeeNote: (payeeNote || 'Recharge portefeuille MOVA').substring(0, 256),
          }),
          signal: controller.signal,
        })

        clearTimeout(timeoutId)

        // MTN MoMo retourne 202 Accepted pour une demande réussie
        if (response.status === 202) {
          console.info(`[MTNMoMo] Demande de paiement acceptée : ${referenceId}`)
          return {
            referenceId,
            status: 'pending',
            message: 'Paiement MTN MoMo initié. Veuillez confirmer via le menu USSD *126#.',
            timestamp: new Date().toISOString(),
          }
        }

        if (response.status === 400) {
          const errorBody = await response.json().catch(() => ({ message: 'Données invalides' }))
          throw new MTNMoMoPaymentError(
            `Données de paiement invalides : ${JSON.stringify(errorBody)}`,
            400,
            errorBody
          )
        }

        if (response.status === 401 || response.status === 403) {
          throw new MTNMoMoAuthError(
            `Authentification MTN MoMo refusée (HTTP ${response.status}). Vérifiez vos clés API.`
          )
        }

        // Autres erreurs - retry possible
        const errorBody = await response.json().catch(() => ({ message: 'Erreur serveur' }))
        lastError = new MTNMoMoPaymentError(
          `Erreur MTN MoMo (HTTP ${response.status}) : ${JSON.stringify(errorBody)}`,
          response.status,
          errorBody
        )
      } catch (error) {
        lastError = error as Error
        if (error instanceof MTNMoMoPaymentError || error instanceof MTNMoMoAuthError) {
          if (error.statusCode && error.statusCode >= 400 && error.statusCode < 500 && error.statusCode !== 429) {
            throw error
          }
        }
        if (error instanceof MTNMoMoTimeoutError && attempt === config.maxRetries - 1) {
          throw error
        }
      }
    }

    throw new MTNMoMoPaymentError(
      `Échec de la demande de paiement après ${config.maxRetries} tentatives : ${lastError?.message || 'Erreur inconnue'}`,
      undefined,
      { lastError: lastError?.message }
    )
  },

  // ── Décaissement (paiement au client) ─────────────────────────────

  /**
   * Effectue un décaissement vers le compte MoMo d'un client.
   * Utilisé pour les remboursements ou les retraits de portefeuille.
   *
   * @param params - Paramètres de décaissement
   * @returns Réponse avec identifiant de référence unique
   * @throws {MTNMoMoPaymentError} En cas d'échec du décaissement
   *
   * @example
   * ```ts
   * const result = await mtnMoMoProvider.disburse({
   *   phoneNumber: '+224630000000',
   *   amount: 5000,
   *   currency: 'GNF',
   *   reference: 'MOVA-MM-WITHDRAW-123',
   *   payeeMessage: 'Retrait portefeuille MOVA',
   * })
   * ```
   */
  async disburse(params: MTNMoMoDisbursementRequest): Promise<MTNMoMoPaymentResponse> {
    const { phoneNumber, amount, currency, reference, payeeMessage, payerMessage } = params

    // Validation des paramètres
    const sanitizedPhone = sanitizePhoneNumber(phoneNumber)
    if (!sanitizedPhone || sanitizedPhone.length < 8) {
      throw new MTNMoMoPaymentError('Numéro de téléphone invalide.', 400)
    }
    if (typeof amount !== 'number' || amount <= 0) {
      throw new MTNMoMoPaymentError('Le montant doit être un nombre positif.', 400)
    }
    if (amount < 100) {
      throw new MTNMoMoPaymentError('Le montant minimum est de 100 GNF.', 400)
    }
    if (amount > 5_000_000) {
      throw new MTNMoMoPaymentError('Le montant maximum par transaction est de 5 000 000 GNF.', 400)
    }

    // Mode démonstration
    if (this.isDemoMode()) {
      const referenceId = generateUUID()
      console.info(`[MTNMoMo][DEMO] Décaissement : ${amount} ${currency} → ${sanitizedPhone} (réf: ${reference})`)
      return {
        referenceId,
        status: 'pending',
        message: 'Décaissement MTN MoMo initié (mode démonstration).',
        timestamp: new Date().toISOString(),
      }
    }

    // Appel API réel avec retry
    const config = this.getConfig()
    const referenceId = generateUUID()
    let lastError: Error | null = null

    for (let attempt = 0; attempt < config.maxRetries; attempt++) {
      if (attempt > 0) {
        const delay = getExponentialBackoff(attempt)
        console.warn(`[MTNMoMo] Décaissement tentative ${attempt + 1}/${config.maxRetries} après ${delay}ms...`)
        await new Promise((resolve) => setTimeout(resolve, delay))
      }

      try {
        const { controller, timeoutId } = createTimeoutController(config.timeout)
        const configUrl = config.userId
          ? `${config.baseUrl.replace('/v1_0', '')}/v1_0/${config.userId}`
          : config.baseUrl

        const response = await fetch(`${configUrl}/disbursements`, {
          method: 'POST',
          headers: {
            ...this.getAuthHeaders(),
            'X-Reference-Id': referenceId,
          },
          body: JSON.stringify({
            amount: String(amount),
            currency,
            externalId: reference,
            payee: {
              partyIdType: 'MSISDN',
              partyId: sanitizedPhone,
            },
            payerMessage: (payerMessage || `MOVA - ${reference}`).substring(0, 256),
            payeeNote: (payeeMessage || 'Retrait portefeuille MOVA').substring(0, 256),
          }),
          signal: controller.signal,
        })

        clearTimeout(timeoutId)

        if (response.status === 202) {
          console.info(`[MTNMoMo] Décaissement accepté : ${referenceId}`)
          return {
            referenceId,
            status: 'pending',
            message: 'Décaissement MTN MoMo initié. Le montant sera crédité sous peu.',
            timestamp: new Date().toISOString(),
          }
        }

        if (response.status === 400) {
          const errorBody = await response.json().catch(() => ({ message: 'Données invalides' }))
          throw new MTNMoMoPaymentError(
            `Données de décaissement invalides : ${JSON.stringify(errorBody)}`,
            400,
            errorBody
          )
        }

        if (response.status === 401 || response.status === 403) {
          throw new MTNMoMoAuthError(
            `Authentification MTN MoMo refusée (HTTP ${response.status}). Vérifiez vos clés API.`
          )
        }

        const errorBody = await response.json().catch(() => ({ message: 'Erreur serveur' }))
        lastError = new MTNMoMoPaymentError(
          `Erreur MTN MoMo (HTTP ${response.status}) : ${JSON.stringify(errorBody)}`,
          response.status,
          errorBody
        )
      } catch (error) {
        lastError = error as Error
        if (error instanceof MTNMoMoPaymentError || error instanceof MTNMoMoAuthError) {
          if (error.statusCode && error.statusCode >= 400 && error.statusCode < 500 && error.statusCode !== 429) {
            throw error
          }
        }
      }
    }

    throw new MTNMoMoPaymentError(
      `Échec du décaissement après ${config.maxRetries} tentatives : ${lastError?.message || 'Erreur inconnue'}`,
      undefined,
      { lastError: lastError?.message }
    )
  },

  // ── Vérification du statut ─────────────────────────────────────────

  /**
   * Vérifie le statut d'une transaction MTN MoMo par son identifiant de référence.
   *
   * @param referenceId - Identifiant de référence retourné par requestToPay ou disburse
   * @param type - Type de transaction ('collection' ou 'disbursement')
   * @returns Statut actuel de la transaction
   * @throws {MTNMoMoError} En cas d'erreur de communication
   *
   * @example
   * ```ts
   * const status = await mtnMoMoProvider.checkStatus('uuid-123-456', 'collection')
   * if (status.status === 'completed') {
   *   console.log('Paiement confirmé !')
   * }
   * ```
   */
  async checkStatus(
    referenceId: string,
    type: 'collection' | 'disbursement' = 'collection'
  ): Promise<MTNMoMoStatusResponse> {
    if (!referenceId) {
      throw new MTNMoMoError('L\'identifiant de référence est requis.', 'VALIDATION_ERROR')
    }

    // Mode démonstration
    if (this.isDemoMode()) {
      console.info(`[MTNMoMo][DEMO] Vérification du statut : ${referenceId}`)
      return {
        referenceId,
        reference: '',
        status: 'completed',
        amount: 0,
        currency: 'GNF',
        phoneNumber: '',
        completedAt: new Date().toISOString(),
      }
    }

    // Appel API réel avec retry
    const config = this.getConfig()
    let lastError: Error | null = null

    for (let attempt = 0; attempt < config.maxRetries; attempt++) {
      if (attempt > 0) {
        const delay = getExponentialBackoff(attempt)
        await new Promise((resolve) => setTimeout(resolve, delay))
      }

      try {
        const { controller, timeoutId } = createTimeoutController(config.timeout)
        const configUrl = config.userId
          ? `${config.baseUrl.replace('/v1_0', '')}/v1_0/${config.userId}`
          : config.baseUrl

        const response = await fetch(`${configUrl}/${type}/${referenceId}`, {
          method: 'GET',
          headers: {
            ...this.getAuthHeaders(),
          },
          signal: controller.signal,
        })

        clearTimeout(timeoutId)

        if (response.status === 404) {
          throw new MTNMoMoError(
            'Transaction non trouvée.',
            'NOT_FOUND',
            404
          )
        }

        if (response.status === 401 || response.status === 403) {
          throw new MTNMoMoAuthError(
            `Authentification MTN MoMo refusée (HTTP ${response.status}).`
          )
        }

        if (!response.ok) {
          const errorBody = await response.json().catch(() => ({ message: 'Erreur serveur' }))
          throw new MTNMoMoError(
            `Erreur de vérification (HTTP ${response.status}) : ${JSON.stringify(errorBody)}`,
            'STATUS_ERROR',
            response.status,
            errorBody
          )
        }

        const data = await response.json()

        return {
          referenceId,
          reference: data.externalId || '',
          status: this.mapApiStatus(data.status),
          amount: Number(data.amount) || 0,
          currency: data.currency || 'GNF',
          phoneNumber: data.payer?.partyId || data.payee?.partyId || '',
          payerMessage: data.payerMessage,
          completedAt: data.financialTransactionId ? new Date().toISOString() : undefined,
          reason: data.reason,
        }
      } catch (error) {
        lastError = error as Error
        if (error instanceof MTNMoMoError && error.statusCode && error.statusCode >= 400 && error.statusCode < 500 && error.statusCode !== 429) {
          throw error
        }
      }
    }

    throw new MTNMoMoError(
      `Échec de la vérification après ${config.maxRetries} tentatives : ${lastError?.message || 'Erreur inconnue'}`,
      'STATUS_ERROR'
    )
  },

  // ── Vérification de signature webhook ──────────────────────────────

  /**
   * Vérifie la signature HMAC d'un webhook entrant MTN MoMo.
   *
   * @param payload - Corps brut de la requête webhook
   * @param signature - Valeur de l'en-tête X-Mtn-Signature ou X-Momo-Signature
   * @returns `true` si la signature est valide
   */
  verifyWebhookSignature(payload: string, signature: string): boolean {
    if (!process.env.WEBHOOK_SECRET) {
      console.warn('[MTNMoMo] WEBHOOK_SECRET non configuré. Vérification de signature ignorée.')
      return true
    }

    import crypto from 'crypto'
    const expectedSignature = crypto
      .createHmac('sha256', process.env.WEBHOOK_SECRET)
      .update(payload)
      .digest('hex')

    try {
      return crypto.timingSafeEqual(
        Buffer.from(signature, 'hex'),
        Buffer.from(expectedSignature, 'hex')
      )
    } catch {
      return false
    }
  },

  // ── Utilitaires internes ───────────────────────────────────────────

  /**
   * Convertit le statut de l'API MTN MoMo en statut MOVA normalisé.
   */
  mapApiStatus(apiStatus: string): MTNMoMoStatusResponse['status'] {
    const statusMap: Record<string, MTNMoMoStatusResponse['status']> = {
      'PENDING': 'pending',
      'INITIATED': 'pending',
      'PROCESSING': 'processing',
      'SUCCESSFUL': 'completed',
      'COMPLETED': 'completed',
      'FAILED': 'failed',
      'EXPIRED': 'expired',
      'REVERSED': 'reversed',
      'REJECTED': 'failed',
      'CANCELLED': 'failed',
    }
    return statusMap[apiStatus?.toUpperCase()] || 'pending'
  },
}

export default mtnMoMoProvider
