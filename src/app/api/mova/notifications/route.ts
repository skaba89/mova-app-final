import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod/v4'
import { db } from '@/lib/db'
import { validateRequest } from '@/lib/mova/auth-middleware'

export const runtime = 'nodejs'

// GET /api/mova/notifications?userId=xxx
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const limitParam = searchParams.get('limit')
    const offsetParam = searchParams.get('offset')

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'userId est requis' },
        { status: 400 }
      )
    }

    // Pagination (BUG-010 fix)
    const limit = Math.min(Math.max(Number(limitParam) || 50, 10), 100)
    const offset = Math.max(Number(offsetParam) || 0, 0)

    const [notifications, total, totalUnread] = await Promise.all([
      db.appNotification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      db.appNotification.count({ where: { userId } }),
      db.appNotification.count({ where: { userId, read: false } }),
    ])

    return NextResponse.json({
      success: true,
      data: {
        notifications: notifications.map((n) => ({
          id: n.id,
          userId: n.userId,
          type: n.type as 'ride' | 'delivery' | 'system' | 'promo' | 'safety',
          title: n.title,
          message: n.message,
          read: n.read,
          createdAt: n.createdAt.toISOString(),
        })),
        unreadCount: totalUnread,
        totalCount: total,
        pagination: { limit, offset, hasMore: offset + limit < total },
      },
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erreur serveur'
    console.error('Notifications GET error:', message)
    return NextResponse.json(
      { success: false, error: 'Erreur serveur' },
      { status: 500 }
    )
  }
}

const createNotificationSchema = z.object({
  userId: z.string().min(1, 'userId requis'),
  type: z.enum(['ride', 'delivery', 'system', 'promo', 'safety']),
  title: z.string().min(1, 'Titre requis'),
  message: z.string().min(1, 'Message requis'),
})

// POST /api/mova/notifications
export async function POST(request: NextRequest) {
  try {
    const auth = await validateRequest(request)
    if (!auth.success) return auth.response
    const body = await request.json()
    const { userId, type, title, message } = createNotificationSchema.parse(body)

    const notification = await db.appNotification.create({
      data: {
        userId,
        type,
        title,
        message,
      },
    })

    return NextResponse.json(
      {
        success: true,
        data: {
          id: notification.id,
          userId: notification.userId,
          type: notification.type as 'ride' | 'delivery' | 'system' | 'promo' | 'safety',
          title: notification.title,
          message: notification.message,
          read: notification.read,
          createdAt: notification.createdAt.toISOString(),
        },
      },
      { status: 201 }
    )
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: error.issues[0]?.message || 'Donnees invalides' },
        { status: 400 }
      )
    }
    const message = error instanceof Error ? error.message : 'Erreur serveur'
    console.error('Notifications POST error:', message)
    return NextResponse.json(
      { success: false, error: 'Erreur serveur' },
      { status: 500 }
    )
  }
}
