export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { validateBody, pushSubscriptionSchema } from '@/lib/validations'
import { db } from '@/lib/db'

// POST /api/mova/notifications/subscribe — Save push notification subscription
export async function POST(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id')

    if (!userId) {
      return NextResponse.json({ success: false, error: 'Non autorisé' }, { status: 401 })
    }

    const body = await request.json()
    const validation = validateBody(pushSubscriptionSchema, body)

    if (!validation.success) {
      return NextResponse.json({ success: false, error: validation.error }, { status: 400 })
    }

    const { endpoint, keys, expirationTime } = validation.data

    // Upsert the subscription for this user+endpoint
    await db.pushSubscription.upsert({
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

    console.log(`[Push] Subscription saved for user ${userId}`)

    return NextResponse.json({
      success: true,
      message: 'Abonnement aux notifications push enregistré',
      data: {
        userId,
        endpoint,
        subscribedAt: new Date().toISOString(),
      },
    })
  } catch (error) {
    console.error('Error saving push subscription:', error)
    return NextResponse.json(
      { success: false, error: "Erreur lors de l'enregistrement de l'abonnement" },
      { status: 500 }
    )
  }
}

// DELETE /api/mova/notifications/subscribe — Remove push subscription
export async function DELETE(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id')

    if (!userId) {
      return NextResponse.json({ success: false, error: 'Non autorisé' }, { status: 401 })
    }

    const result = await db.pushSubscription.deleteMany({ where: { userId } })

    if (result.count === 0) {
      return NextResponse.json(
        { success: false, error: 'Aucun abonnement trouvé pour cet utilisateur' },
        { status: 404 }
      )
    }

    console.log(`[Push] Subscription removed for user ${userId} (${result.count} record(s))`)

    return NextResponse.json({
      success: true,
      message: 'Abonnement aux notifications push supprimé',
    })
  } catch (error) {
    console.error('Error removing push subscription:', error)
    return NextResponse.json(
      { success: false, error: 'Erreur lors de la suppression de l\'abonnement' },
      { status: 500 }
    )
  }
}
