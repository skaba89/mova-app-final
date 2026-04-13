import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod/v4'
import { db } from '@/lib/db'

export const runtime = 'nodejs'

const updateNotificationSchema = z.object({
  read: z.boolean().optional(),
})

// DELETE /api/mova/notifications/[id]?userId=xxx
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'userId est requis' },
        { status: 400 }
      )
    }

    const notification = await db.appNotification.findFirst({
      where: { id, userId },
    })

    if (!notification) {
      return NextResponse.json(
        { success: false, error: 'Notification non trouvee' },
        { status: 404 }
      )
    }

    const removed = await db.appNotification.delete({
      where: { id },
    })

    return NextResponse.json({
      success: true,
      data: {
        id: removed.id,
        userId: removed.userId,
        type: removed.type as 'ride' | 'delivery' | 'system' | 'promo' | 'safety',
        title: removed.title,
        message: removed.message,
        read: removed.read,
        createdAt: removed.createdAt.toISOString(),
      },
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erreur serveur'
    console.error('Notification DELETE error:', message)
    return NextResponse.json(
      { success: false, error: 'Erreur serveur' },
      { status: 500 }
    )
  }
}

// PATCH /api/mova/notifications/[id]?userId=xxx
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'userId est requis' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const { read } = updateNotificationSchema.parse(body)

    const notification = await db.appNotification.findFirst({
      where: { id, userId },
    })

    if (!notification) {
      return NextResponse.json(
        { success: false, error: 'Notification non trouvee' },
        { status: 404 }
      )
    }

    const updated = await db.appNotification.update({
      where: { id },
      data: { read },
    })

    return NextResponse.json({
      success: true,
      data: {
        id: updated.id,
        userId: updated.userId,
        type: updated.type as 'ride' | 'delivery' | 'system' | 'promo' | 'safety',
        title: updated.title,
        message: updated.message,
        read: updated.read,
        createdAt: updated.createdAt.toISOString(),
      },
    })
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: error.issues[0]?.message || 'Donnees invalides' },
        { status: 400 }
      )
    }
    const message = error instanceof Error ? error.message : 'Erreur serveur'
    console.error('Notification PATCH error:', message)
    return NextResponse.json(
      { success: false, error: 'Erreur serveur' },
      { status: 500 }
    )
  }
}
