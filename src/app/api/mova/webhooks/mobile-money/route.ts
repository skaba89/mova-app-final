/**
 * ═══════════════════════════════════════════════════════════════════════════
 * MOVA — Webhook Mobile Money
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Point de terminaison pour recevoir les notifications asynchrones de statut
 * de paiement depuis Orange Money et MTN MoMo.
 *
 * POST /api/mova/webhooks/mobile-money
 *
 * Sécurité :
 * - Vérification de signature HMAC (X-Orange-Signature / X-Mtn-Signature)
 * - Traitement asynchrone (réponse 200 immédiate)
 * - Journalisation de tous les événements
 *
 * Variables d'environnement :
 * - WEBHOOK_SECRET : Secret pour la vérification HMAC
 */

export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { orangeMoneyProvider } from '@/lib/providers/orange-money'
import { mtnMoMoProvider } from '@/lib/providers/mtn-momo'
import { errorLogger } from '@/lib/error-logger'

// ─── Types de webhook ─────────────────────────────────────────────────

/** Format de webhook Orange Money */
interface OrangeMoneyWebhookPayload {
  /** Identifiant de paiement Orange Money */
  payToken?: string
  /** Identifiant de transaction */
  paymentId?: string
  /** Référence externe MOVA */
  reference?: string
  /** Statut du paiement */
  status?: string
  /** Montant */
  amount?: number
  /** Devise */
  currency?: string
  /** Numéro de téléphone du client */
  payee?: { partyid?: string }
  /** Horodatage */
  timestamp?: string
  /** Code de statut */
  statusCode?: string
  /** Message de statut */
  statusMessage?: string
  /** Type d'événement */
  eventType?: string
  /** Données additionnelles */
  [key: string]: unknown
}

/** Format de webhook MTN MoMo */
interface MTNMoMoWebhookPayload {
  /** Identifiant de référence */
  externalId?: string
  /** Montant */
  amount?: string
  /** Devise */
  currency?: string
  /** Statut du paiement */
  status?: string
  /** Identifiant financier */
  financialTransactionId?: string
  /** Numéro du payeur */
  payer?: { partyId?: string }
  /** Message du payeur */
  payerMessage?: string
  /** Raison de l'échec */
  reason?: string
  /** Type d'événement */
  event?: string
  /** Données additionnelles */
  [key: string]: unknown
}

/** Événement de webhook normalisé */
interface NormalizedWebhookEvent {
  /** Fournisseur d'origine */
  provider: 'orange_money' | 'mtn_momo'
  /** Référence externe */
  reference: string
  /** Identifiant de paiement fournisseur */
  providerPaymentId: string
  /** Statut normalisé */
  status: 'completed' | 'failed' | 'expired'
  /** Montant (optionnel) */
  amount?: number
  /** Devise */
  currency?: string
  /** Numéro de téléphone */
  phoneNumber?: string
  /** Message d'erreur */
  errorMessage?: string
  /** Horodatage */
  timestamp: string
}

// ─── Fonctions utilitaires ────────────────────────────────────────────

/**
 * Identifie le fournisseur du webhook à partir des en-têtes.
 *
 * @param headers - En-têtes de la requête
 * @returns Type de fournisseur ou null si non reconnu
 */
function identifyProvider(headers: Headers): 'orange_money' | 'mtn_momo' | null {
  const orangeSignature = headers.get('x-orange-signature')
  const mtnSignature = headers.get('x-mtn-signature') || headers.get('x-momo-signature')
  const userAgent = headers.get('user-agent') || ''

  if (orangeSignature) return 'orange_money'
  if (mtnSignature) return 'mtn_momo'

  // Détection par User-Agent
  if (userAgent.toLowerCase().includes('orange')) return 'orange_money'
  if (userAgent.toLowerCase().includes('mtn') || userAgent.toLowerCase().includes('momo')) return 'mtn_momo'

  return null
}

/**
 * Normalise un webhook Orange Money en événement standard.
 *
 * @param payload - Données brutes du webhook Orange Money
 * @returns Événement normalisé ou null si invalide
 */
function normalizeOrangeMoneyWebhook(payload: OrangeMoneyWebhookPayload): NormalizedWebhookEvent | null {
  const paymentId = payload.payToken || payload.paymentId
  if (!paymentId && !payload.reference) {
    console.warn('[Webhook MM] Webhook Orange Money reçu sans identifiant de paiement.')
    return null
  }

  const statusMap: Record<string, 'completed' | 'failed' | 'expired'> = {
    SUCCESS: 'completed',
    COMPLETED: 'completed',
    SUCCESSFUL: 'completed',
    FAILED: 'failed',
    REJECTED: 'failed',
    EXPIRED: 'expired',
    CANCELLED: 'failed',
  }

  const apiStatus = payload.status?.toUpperCase() || ''
  const normalizedStatus = statusMap[apiStatus]

  if (!normalizedStatus) {
    console.warn(`[Webhook MM] Statut Orange Money non reconnu : ${apiStatus}`)
    return null
  }

  return {
    provider: 'orange_money',
    reference: payload.reference || paymentId || '',
    providerPaymentId: paymentId || '',
    status: normalizedStatus,
    amount: payload.amount ? Number(payload.amount) : undefined,
    currency: payload.currency || 'GNF',
    phoneNumber: payload.payee?.partyid,
    errorMessage: payload.statusMessage || payload.statusCode,
    timestamp: payload.timestamp || new Date().toISOString(),
  }
}

/**
 * Normalise un webhook MTN MoMo en événement standard.
 *
 * @param payload - Données brutes du webhook MTN MoMo
 * @returns Événement normalisé ou null si invalide
 */
function normalizeMTNMoMoWebhook(payload: MTNMoMoWebhookPayload): NormalizedWebhookEvent | null {
  if (!payload.externalId && !payload.financialTransactionId) {
    console.warn('[Webhook MM] Webhook MTN MoMo reçu sans identifiant de paiement.')
    return null
  }

  const statusMap: Record<string, 'completed' | 'failed' | 'expired'> = {
    SUCCESSFUL: 'completed',
    COMPLETED: 'completed',
    FAILED: 'failed',
    EXPIRED: 'expired',
    REVERSED: 'failed',
    REJECTED: 'failed',
    CANCELLED: 'failed',
  }

  const apiStatus = payload.status?.toUpperCase() || ''
  const normalizedStatus = statusMap[apiStatus]

  if (!normalizedStatus) {
    console.warn(`[Webhook MM] Statut MTN MoMo non reconnu : ${apiStatus}`)
    return null
  }

  return {
    provider: 'mtn_momo',
    reference: payload.externalId || payload.financialTransactionId || '',
    providerPaymentId: payload.financialTransactionId || payload.externalId || '',
    status: normalizedStatus,
    amount: payload.amount ? Number(payload.amount) : undefined,
    currency: payload.currency || 'GNF',
    phoneNumber: payload.payer?.partyId,
    errorMessage: payload.reason,
    timestamp: new Date().toISOString(),
  }
}

/**
 * Traite un événement de webhook normalisé de manière asynchrone.
 * Met à jour la transaction dans la base de données et crédite le portefeuille si succès.
 *
 * @param event - Événement de webhook normalisé
 */
async function processWebhookEvent(event: NormalizedWebhookEvent): Promise<void> {
  const { provider, reference, providerPaymentId, status, amount, currency, errorMessage } = event

  console.info(`[Webhook MM] Traitement : ${provider} | réf: ${reference} | statut: ${status} | ID: ${providerPaymentId}`)

  try {
    // Rechercher la transaction en attente par référence
    const pendingTransactions = await db.walletTransaction.findMany({
      where: {
        reference: {
          in: [reference, providerPaymentId, `TXN-${reference}`],
        },
        status: 'pending',
      },
      include: {
        wallet: true,
      },
    })

    if (pendingTransactions.length === 0) {
      console.warn(`[Webhook MM] Aucune transaction en attente trouvée pour la référence : ${reference}`)
      return
    }

    // Traiter chaque transaction correspondante
    for (const transaction of pendingTransactions) {
      const wallet = transaction.wallet
      if (!wallet || !wallet.isActive) {
        console.warn(`[Webhook MM] Portefeuille introuvable ou inactif : ${transaction.walletId}`)
        continue
      }

      if (status === 'completed') {
        // Créditer le portefeuille
        const creditAmount = amount || Number(transaction.amount)
        const newBalance = Number(wallet.balance) + creditAmount

        await db.$transaction([
          db.walletTransaction.update({
            where: { id: transaction.id },
            data: {
              status: 'completed',
              balance: newBalance,
              description: transaction.description.replace('(en attente)', '').replace('(pending)', '').trim(),
            },
          }),
          db.wallet.update({
            where: { id: wallet.id },
            data: { balance: newBalance },
          }),
        ])

        console.info(`[Webhook MM] Portefeuille crédité : ${creditAmount} ${currency || 'GNF'} → wallet ${wallet.id} (nouveau solde: ${newBalance})`)
      } else {
        // Marquer la transaction comme échouée
        await db.walletTransaction.update({
          where: { id: transaction.id },
          data: {
            status: 'failed',
            description: `Échec : ${errorMessage || 'Paiement non confirmé'}`,
          },
        })

        console.info(`[Webhook MM] Transaction marquée comme échouée : ${transaction.id} (${errorMessage || 'Raison inconnue'})`)
      }
    }

    // Journaliser l'événement webhook
    errorLogger.logInfo(`Webhook Mobile Money traité : ${provider} | ${reference} | ${status}`, {
      path: '/api/mova/webhooks/mobile-money',
      method: 'POST',
      provider,
      reference,
      status,
      amount,
    })
  } catch (error) {
    const errorId = errorLogger.logError(error, {
      path: '/api/mova/webhooks/mobile-money',
      method: 'POST',
      provider,
      reference,
      status,
    })

    console.error(`[Webhook MM] Erreur lors du traitement (${errorId}) :`, error)
  }
}

// ─── Route POST ───────────────────────────────────────────────────────

/**
 * POST /api/mova/webhooks/mobile-money
 *
 * Reçoit les notifications asynchrones de statut de paiement depuis
 * Orange Money et MTN MoMo.
 *
 * Processus :
 * 1. Identification du fournisseur via les en-têtes
 * 2. Vérification de la signature HMAC
 * 3. Normalisation du payload
 * 4. Réponse 200 immédiate
 * 5. Traitement asynchrone de l'événement
 */
export async function POST(request: NextRequest) {
  // Lire le corps brut pour la vérification de signature
  const rawBody = await request.text()

  try {
    const payload = JSON.parse(rawBody) as Record<string, unknown>
    const headers = request.headers

    // Journaliser la réception du webhook
    console.info('[Webhook MM] Webhook reçu', {
      provider: identifyProvider(headers),
      contentType: headers.get('content-type'),
      payloadKeys: Object.keys(payload),
    })

    // Identifier le fournisseur
    const provider = identifyProvider(headers)
    if (!provider) {
      console.warn('[Webhook MM] Fournisseur non reconnu. En-têtes :', {
        orangeSig: !!headers.get('x-orange-signature'),
        mtnSig: !!headers.get('x-mtn-signature'),
        userAgent: headers.get('user-agent'),
      })
      return NextResponse.json(
        { success: false, error: 'Fournisseur non reconnu.' },
        { status: 400 }
      )
    }

    // Vérifier la signature si le secret est configuré
    if (process.env.WEBHOOK_SECRET) {
      const signature = headers.get('x-orange-signature')
        || headers.get('x-mtn-signature')
        || headers.get('x-momo-signature')
        || ''

      if (!signature) {
        console.warn('[Webhook MM] Signature absente mais WEBHOOK_SECRET est configuré.')
        return NextResponse.json(
          { success: false, error: 'Signature manquante.' },
          { status: 401 }
        )
      }

      let signatureValid = false
      if (provider === 'orange_money') {
        signatureValid = orangeMoneyProvider.verifyWebhookSignature(rawBody, signature)
      } else {
        signatureValid = mtnMoMoProvider.verifyWebhookSignature(rawBody, signature)
      }

      if (!signatureValid) {
        console.error('[Webhook MM] Signature invalide ! Requête rejetée.')
        errorLogger.logWarning('Webhook Mobile Money : signature invalide', {
          path: '/api/mova/webhooks/mobile-money',
          method: 'POST',
          provider,
        })
        return NextResponse.json(
          { success: false, error: 'Signature invalide.' },
          { status: 401 }
        )
      }
    }

    // Normaliser l'événement
    let normalizedEvent: NormalizedWebhookEvent | null = null
    if (provider === 'orange_money') {
      normalizedEvent = normalizeOrangeMoneyWebhook(payload as unknown as OrangeMoneyWebhookPayload)
    } else {
      normalizedEvent = normalizeMTNMoMoWebhook(payload as unknown as MTNMoMoWebhookPayload)
    }

    if (!normalizedEvent) {
      console.warn('[Webhook MM] Impossible de normaliser le webhook. Payload brut :', rawBody.substring(0, 200))
      return NextResponse.json(
        { success: false, error: 'Format de webhook non valide.' },
        { status: 400 }
      )
    }

    // Répondre immédiatement (200 OK) et traiter de manière asynchrone
    // C'est essentiel pour que le fournisseur ne considère pas le webhook comme échoué
    processWebhookEvent(normalizedEvent).catch((err) => {
      console.error('[Webhook MM] Erreur non interceptée dans le traitement asynchrone :', err)
    })

    return NextResponse.json({
      success: true,
      message: 'Webhook reçu et en cours de traitement.',
      event: {
        provider: normalizedEvent.provider,
        reference: normalizedEvent.reference,
        status: normalizedEvent.status,
      },
    })
  } catch (error) {
    console.error('[Webhook MM] Erreur de traitement du webhook :', error)

    // Même en cas d'erreur de parsing, retourner 200 pour éviter les retries
    // mais journaliser l'erreur
    errorLogger.logError(error, {
      path: '/api/mova/webhooks/mobile-money',
      method: 'POST',
    })

    return NextResponse.json(
      {
        success: false,
        error: 'Erreur de traitement du webhook.',
        // Ne pas exposer les détails en production
        ...(process.env.NODE_ENV === 'development' && {
          details: error instanceof Error ? error.message : String(error),
        }),
      },
      { status: 200 } // 200 pour éviter les retries du fournisseur
    )
  }
}

// ─── Route GET (diagnostic) ──────────────────────────────────────────

/**
 * GET /api/mova/webhooks/mobile-money
 *
 * Point de terminaison de diagnostic pour vérifier que le webhook est actif
 * et que les fournisseurs sont configurés.
 */
export async function GET() {
  return NextResponse.json({
    status: 'active',
    endpoint: '/api/mova/webhooks/mobile-money',
    providers: {
      orange_money: {
        active: !orangeMoneyProvider.isDemoMode(),
        webhookSecret: !!process.env.WEBHOOK_SECRET,
      },
      mtn_momo: {
        active: !mtnMoMoProvider.isDemoMode(),
        webhookSecret: !!process.env.WEBHOOK_SECRET,
      },
    },
    webhookSecretConfigured: !!process.env.WEBHOOK_SECRET,
    supportedHeaders: [
      'X-Orange-Signature (Orange Money)',
      'X-Mtn-Signature / X-Momo-Signature (MTN MoMo)',
    ],
    note: 'Envoyez des requêtes POST pour recevoir les notifications de paiement.',
  })
}
