export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod/v4'
import { db } from '@/lib/db'

// ─── Schemas de validation ─────────────────────────────────────────────────

/** Schema pour la creation/mise a jour d'un abonnement push */
const webpushSubscriptionSchema = z.object({
  endpoint: z.string().min(1, "L'endpoint est requis"),
  keys: z.object({
    p256dh: z.string().min(1, "La cle p256dh est requise"),
    auth: z.string().min(1, "La cle auth est requise"),
  }, { message: "Les cles de l'abonnement sont requises (p256dh, auth)" }),
  expirationTime: z.number().nullable().optional(),
})

/** Schema pour la suppression d'un abonnement push */
const deleteSubscriptionSchema = z.object({
  endpoint: z.string().min(1).optional(),
  subscriptionId: z.string().min(1).optional(),
}).refine(
  (data) => data.endpoint || data.subscriptionId,
  { message: "L'endpoint ou l'ID d'abonnement est requis" }
)

// ═══════════════════════════════════════════════════════════════════════════
// POST /api/mova/notifications/webpush — Save or update a push subscription
// ═══════════════════════════════════════════════════════════════════════════
export async function POST(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id')

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Non autorise. En-tete x-user-id manquant.' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const parsed = webpushSubscriptionSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: parsed.error.issues[0]?.message || 'Donnees invalides',
          details: parsed.error.issues,
        },
        { status: 400 }
      )
    }

    const { endpoint, keys, expirationTime } = parsed.data

    // Upsert the subscription (unique constraint: userId + endpoint)
    const subscription = await db.pushSubscription.upsert({
      where: {
        userId_endpoint: { userId, endpoint },
      },
      create: {
        userId,
        endpoint,
        p256dhKey: keys.p256dh,
        authKey: keys.auth,
        expirationTime: expirationTime ?? null,
      },
      update: {
        p256dhKey: keys.p256dh,
        authKey: keys.auth,
        expirationTime: expirationTime ?? null,
      },
    })

    console.log(`[WebPush] Abonnement enregistre pour l'utilisateur ${userId} (ID: ${subscription.id})`)

    return NextResponse.json({
      success: true,
      message: 'Abonnement aux notifications push enregistre avec succes',
      data: {
        id: subscription.id,
        userId: subscription.userId,
        endpoint: subscription.endpoint,
        createdAt: subscription.createdAt.toISOString(),
      },
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erreur serveur'
    console.error('[WebPush] Erreur POST:', message)
    return NextResponse.json(
      { success: false, error: "Erreur lors de l'enregistrement de l'abonnement push" },
      { status: 500 }
    )
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// DELETE /api/mova/notifications/webpush — Remove a push subscription
// ═══════════════════════════════════════════════════════════════════════════
export async function DELETE(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id')

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Non autorise. En-tete x-user-id manquant.' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const parsed = deleteSubscriptionSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: parsed.error.issues[0]?.message || 'Donnees invalides',
        },
        { status: 400 }
      )
    }

    const { endpoint, subscriptionId } = parsed.data

    // Build the where clause
    const where: Record<string, unknown> = { userId }

    if (endpoint) {
      where.endpoint = endpoint
    } else if (subscriptionId) {
      where.id = subscriptionId
    }

    const result = await db.pushSubscription.deleteMany({ where })

    if (result.count === 0) {
      return NextResponse.json(
        { success: false, error: 'Aucun abonnement trouve pour cet utilisateur' },
        { status: 404 }
      )
    }

    console.log(`[WebPush] Abonnement supprime pour l'utilisateur ${userId} (${result.count} enregistrement(s))`)

    return NextResponse.json({
      success: true,
      message: 'Abonnement aux notifications push supprime avec succes',
      data: { deletedCount: result.count },
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erreur serveur'
    console.error('[WebPush] Erreur DELETE:', message)
    return NextResponse.json(
      { success: false, error: "Erreur lors de la suppression de l'abonnement push" },
      { status: 500 }
    )
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// GET /api/mova/notifications/webpush?userId=xxx — List subscriptions (admin)
// ═══════════════════════════════════════════════════════════════════════════
export async function GET(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id')

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Non autorise' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const targetUserId = searchParams.get('userId')

    if (!targetUserId) {
      return NextResponse.json(
        { success: false, error: 'Le parametre userId est requis' },
        { status: 400 }
      )
    }

    // Note: In production, add admin role check here
    // For now, users can only view their own subscriptions
    const subscriptions = await db.pushSubscription.findMany({
      where: { userId: targetUserId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        endpoint: true,
        expirationTime: true,
        createdAt: true,
      },
    })

    return NextResponse.json({
      success: true,
      data: {
        subscriptions,
        count: subscriptions.length,
      },
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erreur serveur'
    console.error('[WebPush] Erreur GET:', message)
    return NextResponse.json(
      { success: false, error: 'Erreur lors de la recuperation des abonnements' },
      { status: 500 }
    )
  }
}
