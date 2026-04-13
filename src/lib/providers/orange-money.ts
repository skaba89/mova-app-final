/**
 * ═══════════════════════════════════════════════════════════════════════════
 * MOVA — Intégration Orange Money API (Production)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Fournisseur de paiement Orange Money pour l'Afrique de l'Ouest (Guinée).
 * Supporte l'authentification OAuth2, le paiement push OTP, et la vérification
 * de statut de transaction.
 *
 * Variables d'environnement :
 * - ORANGE_MONEY_API_KEY     : Identifiant client OAuth2
 * - ORANGE_MONEY_SECRET      : Secret client OAuth2
 * - ORANGE_MONEY_BASE_URL    : URL de base de l'API (défaut: sandbox)
 *
 * Modes :
 * - Production : Appels réels à l'API Orange Money
 * - Démonstration : Simulation en mémoire (si les clés API ne sont pas configurées)
 *
 * @example
 * ```ts
 * import { orangeMoneyProvider } from '@/lib/providers/orange-money';
 *
 * // Lancer un paiement
 * const result = await orangeMoneyProvider.initiatePayment({
 *   phoneNumber: '+224620000000',
 *   amount: 5000,
 *   currency: 'GNF',
 *   reference: 'MOVA-OM-ABC123',
 * });
 *
 * // Vérifier le statut
 * const status = await orangeMoneyProvider.checkStatus('pay-123456');
 * ```
 */

// ─── Configuration ────────────────────────────────────────────────────

/** Configuration du fournisseur Orange Money */
export interface OrangeMoneyConfig {
  /** Identifiant client OAuth2 */
  apiKey: string;
  /** Secret client OAuth2 */
  secret: string;
  /** URL de base de l'API Orange Money */
  baseUrl: string;
  /** Délai d'expiration des requêtes en millisecondes (défaut: 30 000) */
  timeout: number;
  /** Nombre maximal de tentatives (défaut: 3) */
  maxRetries: number;
}

/** Valeurs par défaut de la configuration */
const DEFAULT_CONFIG: Omit<OrangeMoneyConfig, 'apiKey' | 'secret'> = {
  baseUrl: 'https://api.orange.com/orange-money-moneytransfer',
  timeout: 30_000,
  maxRetries: 3,
};

// ─── Types de requête / réponse API ────────────────────────────────────

/** Paramètres de demande de paiement push OTP */
export interface OrangeMoneyPaymentRequest {
  /** Numéro de téléphone du client (format international) */
  phoneNumber: string;
  /** Montant du paiement */
  amount: number;
  /** Devise (GNF pour la Guinée) */
  currency: string;
  /** Référence unique de la transaction MOVA */
  reference: string;
}

/** Réponse de demande de paiement */
export interface OrangeMoneyPaymentResponse {
  /** Identifiant de paiement Orange Money */
  paymentId: string;
  /** Statut du paiement */
  status: 'initiated' | 'pending' | 'failed';
  /** Message descriptif */
  message: string;
  /** URL de redirection OTP (si applicable) */
  otpUrl?: string;
  /** Horodatage de la transaction */
  timestamp: string;
}

/** Réponse de statut de transaction */
export interface OrangeMoneyStatusResponse {
  /** Identifiant de paiement Orange Money */
  paymentId: string;
  /** Référence MOVA */
  reference: string;
  /** Statut du paiement */
  status: 'pending' | 'completed' | 'failed' | 'expired';
  /** Montant traité */
  amount: number;
  /** Devise */
  currency: string;
  /** Numéro de téléphone du client */
  phoneNumber: string;
  /** Horodatage de complétion */
  completedAt?: string;
  /** Code d'erreur en cas d'échec */
  errorCode?: string;
  /** Message d'erreur */
  errorMessage?: string;
}

/** Réponse d'authentification OAuth2 */
interface OAuth2TokenResponse {
  /** Jeton d'accès */
  access_token: string;
  /** Type de jeton */
  token_type: string;
  /** Durée de vie en secondes */
  expires_in: number;
}

// ─── Classes d'erreur ──────────────────────────────────────────────────

/** Erreur de base pour le fournisseur Orange Money */
export class OrangeMoneyError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode?: number,
    public readonly details?: Record<string, unknown>
  ) {
    super(message)
    this.name = 'OrangeMoneyError'
  }
}

/** Erreur d'authentification OAuth2 */
export class OrangeMoneyAuthError extends OrangeMoneyError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'AUTH_ERROR', 401, details)
    this.name = 'OrangeMoneyAuthError'
  }
}

/** Erreur de paiement (échec de transaction) */
export class OrangeMoneyPaymentError extends OrangeMoneyError {
  constructor(message: string, statusCode?: number, details?: Record<string, unknown>) {
    super(message, 'PAYMENT_ERROR', statusCode, details)
    this.name = 'OrangeMoneyPaymentError'
  }
}

/** Erreur de délai d'attente */
export class OrangeMoneyTimeoutError extends OrangeMoneyError {
  constructor(message: string) {
    super(message, 'TIMEOUT_ERROR', undefined, { timeout: true })
    this.name = 'OrangeMoneyTimeoutError'
  }
}

// ─── Cache de jeton OAuth2 ────────────────────────────────────────────

interface CachedToken {
  token: string;
  expiresAt: number;
}

let cachedToken: CachedToken | null = null;

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
 * Nettoie un numéro de téléphone pour l'API Orange Money.
 * Supprime les espaces, tirets et parenthèses.
 */
function sanitizePhoneNumber(phone: string): string {
  return phone.replace(/[\s\-()]/g, '')
}

// ─── Implémentation du fournisseur ────────────────────────────────────

/**
 * Fournisseur Orange Money.
 *
 * Gère les appels API réels vers Orange Money avec authentification OAuth2,
 * retry avec backoff exponentiel, et mode démonstration automatique.
 */
export const orangeMoneyProvider = {
  /**
   * Vérifie si le mode démonstration est actif.
   * Retourne `true` si les clés API ne sont pas configurées.
   */
  isDemoMode(): boolean {
    return !process.env.ORANGE_MONEY_API_KEY || !process.env.ORANGE_MONEY_SECRET
  },

  /**
   * Retourne la configuration effective du fournisseur.
   */
  getConfig(): OrangeMoneyConfig {
    return {
      apiKey: process.env.ORANGE_MONEY_API_KEY || '',
      secret: process.env.ORANGE_MONEY_SECRET || '',
      baseUrl: process.env.ORANGE_MONEY_BASE_URL || DEFAULT_CONFIG.baseUrl,
      timeout: DEFAULT_CONFIG.timeout,
      maxRetries: DEFAULT_CONFIG.maxRetries,
    }
  },

  // ── Authentification OAuth2 ─────────────────────────────────────────

  /**
   * Obtient un jeton d'accès OAuth2.
   * Utilise le cache si le jeton est encore valide.
   *
   * @returns Jeton d'accès valide
   * @throws {OrangeMoneyAuthError} En cas d'échec d'authentification
   */
  async getAccessToken(): Promise<string> {
    const config = this.getConfig()

    if (this.isDemoMode()) {
      console.warn('[OrangeMoney] Mode démonstration : jeton fictif retourné.')
      return 'demo-access-token'
    }

    // Vérifier le cache
    if (cachedToken && cachedToken.expiresAt > Date.now()) {
      return cachedToken.token
    }

    // Demander un nouveau jeton
    const credentials = Buffer.from(`${config.apiKey}:${config.secret}`).toString('base64')

    const { controller, timeoutId } = createTimeoutController(config.timeout)

    try {
      const response = await fetch(`${config.baseUrl}/token`, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${credentials}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: 'grant_type=client_credentials',
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        const errorBody = await response.text().catch(() => 'Corps de réponse indisponible')
        throw new OrangeMoneyAuthError(
          `Échec de l'authentification Orange Money (HTTP ${response.status})`,
          { httpStatus: response.status, body: errorBody }
        )
      }

      const data = (await response.json()) as OAuth2TokenResponse

      // Mettre en cache le jeton (avec une marge de 60 secondes)
      cachedToken = {
        token: data.access_token,
        expiresAt: Date.now() + (data.expires_in - 60) * 1000,
      }

      console.info('[OrangeMoney] Jeton d\'accès obtenu avec succès.')
      return data.access_token
    } catch (error) {
      clearTimeout(timeoutId)

      if (error instanceof OrangeMoneyAuthError) throw error
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new OrangeMoneyTimeoutError('Délai d\'attente dépassé lors de l\'authentification Orange Money.')
      }
      throw new OrangeMoneyAuthError(
        `Erreur d'authentification : ${error instanceof Error ? error.message : 'Erreur inconnue'}`
      )
    }
  },

  // ── Paiement push OTP ──────────────────────────────────────────────

  /**
   * Lance un paiement push OTP vers le téléphone du client.
   * Le client recevra un SMS avec un code OTP à confirmer.
   *
   * @param params - Paramètres de paiement
   * @returns Réponse de paiement avec identifiant unique
   * @throws {OrangeMoneyPaymentError} En cas d'échec du paiement
   *
   * @example
   * ```ts
   * const result = await orangeMoneyProvider.initiatePayment({
   *   phoneNumber: '+224620000000',
   *   amount: 5000,
   *   currency: 'GNF',
   *   reference: 'MOVA-OM-ABC123',
   * })
   * ```
   */
  async initiatePayment(params: OrangeMoneyPaymentRequest): Promise<OrangeMoneyPaymentResponse> {
    const { phoneNumber, amount, currency, reference } = params

    // Validation des paramètres
    const sanitizedPhone = sanitizePhoneNumber(phoneNumber)
    if (!sanitizedPhone || sanitizedPhone.length < 8) {
      throw new OrangeMoneyPaymentError('Numéro de téléphone invalide.', 400)
    }
    if (typeof amount !== 'number' || amount <= 0) {
      throw new OrangeMoneyPaymentError('Le montant doit être un nombre positif.', 400)
    }
    if (amount < 100) {
      throw new OrangeMoneyPaymentError('Le montant minimum est de 100 GNF.', 400)
    }
    if (amount > 5_000_000) {
      throw new OrangeMoneyPaymentError('Le montant maximum par transaction est de 5 000 000 GNF.', 400)
    }

    // Mode démonstration
    if (this.isDemoMode()) {
      console.info(`[OrangeMoney][DEMO] Paiement initié : ${amount} ${currency} → ${sanitizedPhone} (réf: ${reference})`)
      return {
        paymentId: `demo-om-${Date.now()}`,
        status: 'initiated',
        message: 'Paiement Orange Money initié (mode démonstration). Veuillez confirmer sur votre téléphone.',
        timestamp: new Date().toISOString(),
      }
    }

    // Appel API réel avec retry
    const config = this.getConfig()
    let lastError: Error | null = null

    for (let attempt = 0; attempt < config.maxRetries; attempt++) {
      if (attempt > 0) {
        const delay = getExponentialBackoff(attempt)
        console.warn(`[OrangeMoney] Tentative ${attempt + 1}/${config.maxRetries} après ${delay}ms...`)
        await new Promise((resolve) => setTimeout(resolve, delay))
      }

      try {
        const token = await this.getAccessToken()
        const { controller, timeoutId } = createTimeoutController(config.timeout)

        const response = await fetch(`${config.baseUrl}/pay`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            merchant_key: config.apiKey,
            currency,
            amount,
            payee: {
              partyidtype: 'MSISDN',
              partyid: sanitizedPhone,
            },
            payer: {
              partyidtype: 'MSISDN',
              partyid: sanitizedPhone,
            },
            reference,
            comment: `Paiement MOVA - ${reference}`,
          }),
          signal: controller.signal,
        })

        clearTimeout(timeoutId)

        if (!response.ok) {
          const errorBody = await response.json().catch(() => ({ message: 'Erreur inconnue' }))
          throw new OrangeMoneyPaymentError(
            `Erreur de paiement Orange Money (HTTP ${response.status}) : ${JSON.stringify(errorBody)}`,
            response.status,
            errorBody
          )
        }

        const data = await response.json()

        console.info(`[OrangeMoney] Paiement initié avec succès : ${data.payToken || data.paymentId}`)
        return {
          paymentId: data.payToken || data.paymentId,
          status: 'initiated',
          message: 'Paiement Orange Money initié. Veuillez confirmer le paiement via le code OTP reçu.',
          otpUrl: (data as Record<string, unknown>)['X-Redirect-Url'] as string || data.otpUrl,
          timestamp: new Date().toISOString(),
        }
      } catch (error) {
        lastError = error as Error
        if (error instanceof OrangeMoneyPaymentError) {
          // Ne pas retry sur les erreurs 4xx (sauf 429)
          if (error.statusCode && error.statusCode >= 400 && error.statusCode < 500 && error.statusCode !== 429) {
            throw error
          }
        }
        if (error instanceof OrangeMoneyTimeoutError && attempt === config.maxRetries - 1) {
          throw error
        }
      }
    }

    throw new OrangeMoneyPaymentError(
      `Échec du paiement après ${config.maxRetries} tentatives : ${lastError?.message || 'Erreur inconnue'}`,
      undefined,
      { lastError: lastError?.message }
    )
  },

  // ── Vérification du statut ─────────────────────────────────────────

  /**
   * Vérifie le statut d'un paiement par son identifiant Orange Money.
   *
   * @param paymentId - Identifiant de paiement retourné par initiatePayment
   * @returns Statut actuel de la transaction
   * @throws {OrangeMoneyError} En cas d'erreur de communication
   *
   * @example
   * ```ts
   * const status = await orangeMoneyProvider.checkStatus('pay-123456')
   * if (status.status === 'completed') {
   *   console.log('Paiement confirmé !')
   * }
   * ```
   */
  async checkStatus(paymentId: string): Promise<OrangeMoneyStatusResponse> {
    if (!paymentId) {
      throw new OrangeMoneyError('L\'identifiant de paiement est requis.', 'VALIDATION_ERROR')
    }

    // Mode démonstration
    if (this.isDemoMode()) {
      console.info(`[OrangeMoney][DEMO] Vérification du statut : ${paymentId}`)
      return {
        paymentId,
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
        const token = await this.getAccessToken()
        const { controller, timeoutId } = createTimeoutController(config.timeout)

        const response = await fetch(`${config.baseUrl}/pay/${paymentId}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          signal: controller.signal,
        })

        clearTimeout(timeoutId)

        if (!response.ok) {
          const errorBody = await response.json().catch(() => ({ message: 'Erreur inconnue' }))
          throw new OrangeMoneyError(
            `Erreur de vérification du statut (HTTP ${response.status}) : ${JSON.stringify(errorBody)}`,
            'STATUS_ERROR',
            response.status,
            errorBody
          )
        }

        const data = await response.json()

        return {
          paymentId: data.payToken || data.paymentId || paymentId,
          reference: data.reference || '',
          status: this.mapApiStatus(data.status),
          amount: Number(data.amount) || 0,
          currency: data.currency || 'GNF',
          phoneNumber: data.payee?.partyid || '',
          completedAt: data.completionTime || undefined,
          errorCode: data.statusCode,
          errorMessage: data.statusMessage,
        }
      } catch (error) {
        lastError = error as Error
        if (error instanceof OrangeMoneyError && error.statusCode && error.statusCode >= 400 && error.statusCode < 500 && error.statusCode !== 429) {
          throw error
        }
      }
    }

    throw new OrangeMoneyError(
      `Échec de la vérification après ${config.maxRetries} tentatives : ${lastError?.message || 'Erreur inconnue'}`,
      'STATUS_ERROR'
    )
  },

  // ── Vérification de signature webhook ──────────────────────────────

  /**
   * Vérifie la signature d'un webhook entrant Orange Money.
   *
   * @param payload - Corps brut de la requête webhook
   * @param signature - Valeur de l'en-tête X-Orange-Signature
   * @returns `true` si la signature est valide
   */
  verifyWebhookSignature(payload: string, signature: string): boolean {
    if (!process.env.WEBHOOK_SECRET) {
      console.warn('[OrangeMoney] WEBHOOK_SECRET non configuré. Vérification de signature ignorée.')
      return true
    }

    // Vérification HMAC-SHA256
    import crypto from 'crypto'
    const expectedSignature = crypto
      .createHmac('sha256', process.env.WEBHOOK_SECRET)
      .update(payload)
      .digest('hex')

    // Comparaison sécurisée pour éviter les attaques temporelles
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
   * Convertit le statut de l'API Orange Money en statut MOVA normalisé.
   */
  mapApiStatus(apiStatus: string): OrangeMoneyStatusResponse['status'] {
    const statusMap: Record<string, OrangeMoneyStatusResponse['status']> = {
      'INITIATED': 'pending',
      'PENDING': 'pending',
      'SUCCESS': 'completed',
      'COMPLETED': 'completed',
      'FAILED': 'failed',
      'EXPIRED': 'expired',
      'REJECTED': 'failed',
      'CANCELLED': 'failed',
    }
    return statusMap[apiStatus?.toUpperCase()] || 'pending'
  },
}

export default orangeMoneyProvider
