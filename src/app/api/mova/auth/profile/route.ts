import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyToken } from '@/lib/auth'
import { z } from 'zod/v4'

export const runtime = 'nodejs'

const profileSchema = z.object({
  name: z.string().min(1, 'Nom requis'),
  email: z.email('Email invalide'),
  phone: z.string().min(1, 'Telephone requis'),
})

export async function PUT(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { success: false, error: 'Token d\'authentification requis' },
        { status: 401 }
      )
    }

    const token = authHeader.substring(7).trim()
    const payload = await verifyToken(token)

    if (!payload?.userId) {
      return NextResponse.json(
        { success: false, error: 'Token invalide ou expire' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { name, email, phone } = profileSchema.parse(body)

    // Check email uniqueness (exclude current user)
    const existingEmail = await db.user.findFirst({
      where: { email, NOT: { id: payload.userId } },
    })
    if (existingEmail) {
      return NextResponse.json(
        { success: false, error: 'Cet email est deja utilise' },
        { status: 409 }
      )
    }

    // Check phone uniqueness
    const existingPhone = await db.user.findFirst({
      where: { phone, NOT: { id: payload.userId } },
    })
    if (existingPhone) {
      return NextResponse.json(
        { success: false, error: 'Ce numero de telephone est deja utilise' },
        { status: 409 }
      )
    }

    const user = await db.user.update({
      where: { id: payload.userId },
      data: { name, email, phone },
      include: {
        vehicles: true,
        wallet: {
          select: { id: true, balance: true, currency: true, isActive: true },
        },
      },
    })

    const { password: _pw, ...safeUser } = user

    return NextResponse.json({ success: true, data: safeUser })
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: error.issues[0]?.message || 'Donnees invalides' },
        { status: 400 }
      )
    }
    const message = error instanceof Error ? error.message : 'Erreur serveur'
    console.error('Profile update error:', message)
    return NextResponse.json(
      { success: false, error: 'Erreur serveur' },
      { status: 500 }
    )
  }
}
