export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { validateBody, sendPushSchema } from '@/lib/validations'

// POST /api/mova/notifications/push — Send a push notification (demo mode)
// In production, this would use the web-push library to send real push notifications
// via FCM (Firebase Cloud Messaging) or Web Push API.
export async function POST(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id')

    if (!userId) {
      return NextResponse.json({ success: false, error: 'Non autorisé' }, { status: 401 })
    }

    const body = await request.json()
    const validation = validateBody(sendPushSchema, body)

    if (!validation.success) {
      return NextResponse.json({ success: false, error: validation.error }, { status: 400 })
    }

    const { userId: targetUserId, title, body: messageBody, data, type } = validation.data

    // ─── Demo mode: just log and return success ──────────────────────────
    // In production, we would:
    // 1. Look up the user's push subscription from the database
    // 2. Use web-push library to send the notification:
    //    webpush.sendNotification(subscription, JSON.stringify({ title, body, data, type }))
    // 3. Handle expired subscriptions and clean up
    console.log(`[Push] Notification sent (demo) to user ${targetUserId}`)
    console.log(`[Push]   Title: ${title}`)
    console.log(`[Push]   Body: ${messageBody}`)
    console.log(`[Push]   Type: ${type}`)
    if (data) console.log(`[Push]   Data:`, JSON.stringify(data))

    return NextResponse.json({
      success: true,
      message: 'Notification push envoyée (mode démo)',
      data: {
        userId: targetUserId,
        title,
        type,
        sentAt: new Date().toISOString(),
        mode: 'demo',
      },
    })
  } catch (error) {
    console.error('Error sending push notification:', error)
    return NextResponse.json(
      { success: false, error: "Erreur lors de l'envoi de la notification push" },
      { status: 500 }
    )
  }
}
