/**
 * @file sms.ts
 * @description Module d'envoi de SMS via différents fournisseurs (AfricasTalking, Twilio, Demo).
 * Fournit une abstraction unifiée pour l'envoi de codes OTP par SMS.
 * Supporte le format téléphonique guinéen (+224).
 *
 * Fournisseurs supportés :
 * - AfricasTalking (par défaut pour l'Afrique de l'Ouest)
 * - Twilio (alternative internationale)
 * - DemoProvider (mode développement, logs console)
 */

import { checkRateLimit, isDemoMode } from './otp'

// ─── Interfaces ────────────────────────────────────────────────────────────────

/** Résultat d'un envoi de SMS */
export interface SmsResult {
  success: boolean
  messageId?: string
  error?: string
}

/** Interface commune à tous les fournisseurs SMS */
export interface SmsProvider {
  /** Envoie un SMS au numéro indiqué */
  send(phone: string, message: string): Promise<SmsResult>
  /** Nom du fournisseur (pour les logs) */
  readonly name: string
}

// ─── Constantes ────────────────────────────────────────────────────────────────

/** Délai d'expiration des requêtes HTTP (10 secondes) */
const SMS_TIMEOUT_MS = 10_000

/** Modèle de message OTP en français */
export const OTP_MESSAGE_TEMPLATE = (code: string): string =>
  `Votre code MOVA est ${code}. Valide 5 min. Ne le partagez pas.`

// ─── AfricasTalking Provider ───────────────────────────────────────────────────

/**
 * Fournisseur SMS via l'API AfricasTalking.
 * Adapté pour l'envoi de SMS en Guinée (+224).
 * Documentation : https://developers.africastalking.com/docs/sms/sending
 */
class AfricasTalkingProvider implements SmsProvider {
  readonly name = 'AfricasTalking'

  private readonly apiKey: string
  private readonly username: string
  private readonly from: string
  private readonly baseUrl = 'https://api.africastalking.com/v1/messaging'

  constructor() {
    this.apiKey = process.env.AFRICASTALKING_API_KEY ?? ''
    this.username = process.env.AFRICASTALKING_USERNAME ?? ''
    this.from = process.env.AFRICASTALKING_FROM ?? 'MOVA'

    if (!this.apiKey || !this.username) {
      throw new Error(
        'AfricasTalking: AFRICASTALKING_API_KEY et AFRICASTALKING_USERNAME sont requis.'
      )
    }
  }

  async send(phone: string, message: string): Promise<SmsResult> {
    try {
      // Encoder les identifiants en Base64 pour l'authentification Basic
      const credentials = Buffer.from(`${this.username}:${this.apiKey}`).toString(
        'base64'
      )

      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), SMS_TIMEOUT_MS)

      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Basic ${credentials}`,
          Accept: 'application/json',
        },
        body: JSON.stringify({
          to: [phone],
          message,
          from: this.from,
        }),
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        const errorBody = await response.text()
        console.error(
          `AfricasTalking erreur HTTP ${response.status}:`,
          errorBody
        )
        return {
          success: false,
          error: `Erreur HTTP ${response.status} depuis AfricasTalking`,
        }
      }

      const data = await response.json()

      // AfricasTalking retourne un tableau SMSMessageData.Recipients
      const recipients = data?.SMSMessageData?.Recipients
      if (recipients && recipients.length > 0) {
        const first = recipients[0]
        const status = first.status as string
        if (status === 'Success' || status === 'Sent') {
          return {
            success: true,
            messageId: first.messageId as string | undefined,
          }
        }
        return {
          success: false,
          error: `AfricasTalking statut: ${status} - ${first.statusCode || ''}`,
        }
      }

      return { success: false, error: 'Réponse inattendue de AfricasTalking' }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        return { success: false, error: 'Délai d\'envoi SMS dépassé (10s)' }
      }
      const message = err instanceof Error ? err.message : 'Erreur inconnue'
      console.error('AfricasTalking erreur:', message)
      return { success: false, error: `AfricasTalking: ${message}` }
    }
  }
}

// ─── Twilio Provider ───────────────────────────────────────────────────────────

/**
 * Fournisseur SMS via l'API Twilio.
 * Alternative internationale pour l'envoi de SMS.
 * Documentation : https://www.twilio.com/docs/sms/api/message-resource
 */
class TwilioProvider implements SmsProvider {
  readonly name = 'Twilio'

  private readonly accountSid: string
  private readonly authToken: string
  private readonly from: string
  private readonly baseUrl: string

  constructor() {
    this.accountSid = process.env.TWILIO_ACCOUNT_SID ?? ''
    this.authToken = process.env.TWILIO_AUTH_TOKEN ?? ''
    this.from = process.env.TWILIO_PHONE_NUMBER ?? ''

    if (!this.accountSid || !this.authToken || !this.from) {
      throw new Error(
        'Twilio: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN et TWILIO_PHONE_NUMBER sont requis.'
      )
    }

    this.baseUrl = `https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}/Messages.json`
  }

  async send(phone: string, message: string): Promise<SmsResult> {
    try {
      const credentials = Buffer.from(
        `${this.accountSid}:${this.authToken}`
      ).toString('base64')

      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), SMS_TIMEOUT_MS)

      // Twilio utilise le format form-encoded
      const params = new URLSearchParams({
        To: phone,
        From: this.from,
        Body: message,
      })

      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Basic ${credentials}`,
        },
        body: params.toString(),
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        const errorBody = await response.text()
        console.error(`Twilio erreur HTTP ${response.status}:`, errorBody)
        return {
          success: false,
          error: `Erreur HTTP ${response.status} depuis Twilio`,
        }
      }

      const data = await response.json()
      return {
        success: true,
        messageId: data.sid as string | undefined,
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        return { success: false, error: 'Délai d\'envoi SMS dépassé (10s)' }
      }
      const message = err instanceof Error ? err.message : 'Erreur inconnue'
      console.error('Twilio erreur:', message)
      return { success: false, error: `Twilio: ${message}` }
    }
  }
}

// ─── Demo Provider ─────────────────────────────────────────────────────────────

/**
 * Fournisseur de démonstration : affiche le SMS dans la console au lieu de l'envoyer.
 * Utilisé en mode développement quand aucun fournisseur SMS n'est configuré.
 */
class DemoProvider implements SmsProvider {
  readonly name = 'Demo'

  async send(phone: string, message: string): Promise<SmsResult> {
    console.log('═══════════════════════════════════════════════')
    console.log('📱 [DEMO] SMS non envoyé — Mode démonstration')
    console.log(`   Destinataire : ${phone}`)
    console.log(`   Message      : ${message}`)
    console.log('═══════════════════════════════════════════════')
    return { success: true, messageId: `demo-${Date.now()}` }
  }
}

// ─── Instance singleton ────────────────────────────────────────────────────────

let _provider: SmsProvider | null = null

/**
 * Fabrique le fournisseur SMS approprié selon les variables d'environnement.
 *
 * Ordre de priorité :
 * 1. SMS_PROVIDER=africastalking → AfricasTalkingProvider
 * 2. SMS_PROVIDER=twilio → TwilioProvider
 * 3. Si aucune variable SMS_PROVIDER, vérifie les clés API disponibles :
 *    - AFRICASTALKING_API_KEY présent → AfricasTalkingProvider
 *    - TWILIO_ACCOUNT_SID présent → TwilioProvider
 * 4. Sinon → DemoProvider (mode développement)
 */
export function getSmsProvider(): SmsProvider {
  if (_provider) return _provider

  const provider = process.env.SMS_PROVIDER?.toLowerCase()?.trim()

  if (provider === 'demo') {
    _provider = new DemoProvider()
  } else if (
    provider === 'africastalking' ||
    (!provider && process.env.AFRICASTALKING_API_KEY)
  ) {
    try {
      _provider = new AfricasTalkingProvider()
      console.log('[SMS] Fournisseur initialisé : AfricasTalking')
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erreur inconnue'
      console.warn(
        `[SMS] AfricasTalking non disponible (${message}), repli sur DemoProvider`
      )
      _provider = new DemoProvider()
    }
  } else if (
    provider === 'twilio' ||
    (!provider && process.env.TWILIO_ACCOUNT_SID)
  ) {
    try {
      _provider = new TwilioProvider()
      console.log('[SMS] Fournisseur initialisé : Twilio')
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erreur inconnue'
      console.warn(
        `[SMS] Twilio non disponible (${message}), repli sur DemoProvider`
      )
      _provider = new DemoProvider()
    }
  } else {
    _provider = new DemoProvider()
    console.log('[SMS] Aucun fournisseur configuré, utilisation du mode démo')
  }

  return _provider
}

/**
 * Réinitialise le fournisseur singleton (utile pour les tests).
 */
export function resetSmsProvider(): void {
  _provider = null
}

// ─── Fonction principale d'envoi ───────────────────────────────────────────────

/**
 * Envoie un code OTP par SMS au numéro indiqué.
 * Inclut la vérification du rate limiting avant l'envoi.
 *
 * @param phone - Numéro de téléphone au format international (+224...)
 * @param code - Code OTP à 6 chiffres
 * @returns Objet contenant le succès, le messageId, et l'éventuelle erreur
 */
export async function sendSMS(
  phone: string,
  code: string
): Promise<SmsResult & { demo?: boolean }> {
  // Vérifier le rate limiting avant d'envoyer
  const rateCheck = checkRateLimit(phone)
  if (!rateCheck.allowed) {
    return {
      success: false,
      error: `Trop de demandes. Réessayez dans ${rateCheck.retryAfter} secondes.`,
    }
  }

  const provider = getSmsProvider()
  const message = OTP_MESSAGE_TEMPLATE(code)
  const demo = isDemoMode()

  console.log(`[SMS] Envoi OTP au ${phone} via ${provider.name}`)

  const result = await provider.send(phone, message)

  if (result.success) {
    console.log(
      `[SMS] ✓ OTP envoyé avec succès au ${phone}${result.messageId ? ` (ID: ${result.messageId})` : ''}`
    )
  } else {
    console.error(`[SMS] ✗ Échec d'envoi au ${phone}: ${result.error}`)
  }

  return { ...result, demo }
}
