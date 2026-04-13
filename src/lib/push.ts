// ═══════════════════════════════════════════════════════════════════════════
// MOVA — Web Push Notification Utility
// Utilitaires pour l'envoi de notifications push via le protocole Web Push
// avec VAPID (Voluntary Application Server Identification)
// ═══════════════════════════════════════════════════════════════════════════

import webpush from 'web-push'
import { db } from '@/lib/db'

// ─── Configuration VAPID ──────────────────────────────────────────────────

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || ''
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || ''
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:contact@mova.gn'

// Configure web-push with VAPID keys
if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)
} else {
  console.warn('[Push] Cles VAPID non configurees. Definissez VAPID_PUBLIC_KEY et VAPID_PRIVATE_KEY dans .env')
}

// ─── TypeScript Interfaces ────────────────────────────────────────────────

/** Payload pour une notification push individuelle */
export interface PushNotificationPayload {
  title: string
  body: string
  icon?: string
  badge?: string
  tag?: string
  data?: Record<string, unknown>
  requireInteraction?: boolean
  url?: string
  actions?: Array<{ action: string; title: string; icon?: string }>
}

/** Resultat d'un envoi a un utilisateur */
export interface PushSendResult {
  sent: number
  failed: number
  errors?: Array<{ endpoint: string; error: string }>
}

/** Abonnement push stocke en base de donnees */
export interface StoredSubscription {
  id: string
  userId: string
  endpoint: string
  p256dhKey: string
  authKey: string
  expirationTime: number | null
  createdAt: Date
}

// ─── Public VAPID Key Helper ──────────────────────────────────────────────

/**
 * Retourne la cle publique VAPID pour l'abonnement cote client.
 * Doit etre appelee depuis une route API pour etre envoyee au frontend.
 */
export function getVapidPublicKey(): string {
  if (!VAPID_PUBLIC_KEY) {
    throw new Error('VAPID_PUBLIC_KEY n\'est pas configure dans les variables d\'environnement')
  }
  return VAPID_PUBLIC_KEY
}

// ─── Core: Send to a single subscription ──────────────────────────────────

/**
 * Envoie une notification push a un seul abonnement.
 * @param subscription - L'abonnement push avec endpoint et cles
 * @param payload - Le contenu de la notification
 * @returns true si l'envoi a reussi, false sinon
 */
export async function sendPushNotification(
  subscription: StoredSubscription,
  payload: PushNotificationPayload
): Promise<boolean> {
  try {
    const webPushSubscription: webpush.PushSubscription = {
      endpoint: subscription.endpoint,
      keys: {
        p256dh: subscription.p256dhKey,
        auth: subscription.authKey,
      },
    }

    const notificationPayload: PushNotificationPayload = {
      title: payload.title,
      body: payload.body,
      icon: payload.icon || '/icons/icon-192x192.png',
      badge: payload.badge || '/icons/icon-192x192.png',
      tag: payload.tag || `mova-${Date.now()}`,
      data: payload.data || {},
      requireInteraction: payload.requireInteraction || false,
      url: payload.url,
      actions: payload.actions,
    }

    await webpush.sendNotification(
      webPushSubscription,
      JSON.stringify(notificationPayload),
      {
        TTL: 300, // 5 minutes
        urgency: 'normal',
      }
    )

    console.log(`[Push] Notification envoyee: "${payload.title}" a ${subscription.endpoint.slice(0, 60)}...`)
    return true
  } catch (error: unknown) {
    const err = error as { statusCode?: number; body?: string; message?: string }

    // If subscription is expired or invalid, clean it up
    if (err.statusCode === 404 || err.statusCode === 410) {
      console.warn(`[Push] Abonnement expire/supprime: ${subscription.endpoint.slice(0, 60)}...`)
      try {
        await db.pushSubscription.deleteMany({
          where: { endpoint: subscription.endpoint },
        })
        console.log(`[Push] Abonnement nettoyé de la base de donnees`)
      } catch (dbError) {
        console.error(`[Push] Erreur lors du nettoyage de l'abonnement:`, dbError)
      }
    } else {
      console.error(`[Push] Erreur d'envoi a ${subscription.endpoint.slice(0, 60)}...:`, err.message || err.body || error)
    }

    return false
  }
}

// ─── Send to all subscriptions of a user ──────────────────────────────────

/**
 * Envoie une notification push a toutes les sessions d'un utilisateur.
 * Un utilisateur peut avoir plusieurs abonnements (mobile, desktop, etc.)
 * @param userId - L'identifiant de l'utilisateur
 * @param payload - Le contenu de la notification
 * @returns Resultat avec le nombre de succes et echecs
 */
export async function sendToUser(
  userId: string,
  payload: PushNotificationPayload
): Promise<PushSendResult> {
  try {
    const subscriptions = await db.pushSubscription.findMany({
      where: { userId },
    })

    if (subscriptions.length === 0) {
      console.log(`[Push] Aucun abonnement trouve pour l'utilisateur ${userId}`)
      return { sent: 0, failed: 0 }
    }

    console.log(`[Push] Envoi a l'utilisateur ${userId}: ${subscriptions.length} abonnement(s)`)

    const results = await Promise.allSettled(
      subscriptions.map((sub) => sendPushNotification(sub, payload))
    )

    const sent = results.filter((r) => r.status === 'fulfilled' && r.value === true).length
    const failed = results.length - sent

    return { sent, failed }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erreur inconnue'
    console.error(`[Push] Erreur sendToUser pour ${userId}:`, message)
    return { sent: 0, failed: 0, errors: [{ endpoint: '', error: message }] }
  }
}

// ─── Send to multiple users ───────────────────────────────────────────────

/**
 * Envoie une notification push a plusieurs utilisateurs.
 * @param userIds - Liste des identifiants utilisateurs
 * @param payload - Le contenu de la notification
 * @returns Resultat agregé avec le nombre total de succes et echecs
 */
export async function sendToMultiple(
  userIds: string[],
  payload: PushNotificationPayload
): Promise<PushSendResult> {
  try {
    if (userIds.length === 0) {
      return { sent: 0, failed: 0 }
    }

    console.log(`[Push] Envoi en masse a ${userIds.length} utilisateur(s): "${payload.title}"`)

    const subscriptions = await db.pushSubscription.findMany({
      where: {
        userId: { in: userIds },
      },
    })

    if (subscriptions.length === 0) {
      console.log(`[Push] Aucun abonnement trouve pour les ${userIds.length} utilisateur(s)`)
      return { sent: 0, failed: 0 }
    }

    // Batch send with concurrency limit of 20
    const BATCH_SIZE = 20
    let sent = 0
    let failed = 0
    const errors: Array<{ endpoint: string; error: string }> = []

    for (let i = 0; i < subscriptions.length; i += BATCH_SIZE) {
      const batch = subscriptions.slice(i, i + BATCH_SIZE)
      const results = await Promise.allSettled(
        batch.map((sub) => sendPushNotification(sub, payload))
      )

      for (let j = 0; j < results.length; j++) {
        const result = results[j]
        if (result.status === 'fulfilled' && result.value === true) {
          sent++
        } else {
          failed++
          errors.push({
            endpoint: batch[j].endpoint.slice(0, 60) + '...',
            error: result.status === 'rejected' ? String(result.reason) : 'Echec inconnu',
          })
        }
      }
    }

    console.log(`[Push] Envoi en masse termine: ${sent} envoyee(s), ${failed} echouee(s)`)

    return { sent, failed, ...(errors.length > 0 && { errors }) }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erreur inconnue'
    console.error(`[Push] Erreur sendToMultiple:`, message)
    return { sent: 0, failed: 0, errors: [{ endpoint: '', error: message }] }
  }
}

// ─── Check if push is configured ──────────────────────────────────────────

/**
 * Verifie si les cles VAPID sont correctement configurees.
 * Utile pour les routes API qui veulent verifier la config avant d'envoyer.
 */
export function isPushConfigured(): boolean {
  return !!(VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY)
}
