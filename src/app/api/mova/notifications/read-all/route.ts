import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod/v4'
import { db } from '@/lib/db'

export const runtime = 'nodejs'

const readAllSchema = z.object({
  userId: z.string().min(1, 'userId requis'),
})

// POST /api/mova/notifications/read-all
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId } = readAllSchema.parse(body)

    const result = await db.appNotification.updateMany({
      where: { userId, read: false },
      data: { read: true },
    })

    return NextResponse.json({
      success: true,
      data: {
        message: `${result.count} notification(s) marquee(s) comme lue(s)`,
        markedCount: result.count,
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
    console.error('Read-all notifications error:', message)
    return NextResponse.json(
      { success: false, error: 'Erreur serveur' },
      { status: 500 }
    )
  }
}
