import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyToken, comparePassword, hashPassword } from '@/lib/auth'
import { z } from 'zod/v4'

export const runtime = 'nodejs'

const passwordSchema = z.object({
  oldPassword: z.string().min(1, 'Ancien mot de passe requis'),
  newPassword: z.string().min(6, 'Le mot de passe doit contenir au moins 6 caracteres'),
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
    const { oldPassword, newPassword } = passwordSchema.parse(body)

    const user = await db.user.findUnique({
      where: { id: payload.userId },
    })

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Utilisateur non trouve' },
        { status: 404 }
      )
    }

    // Validate old password
    let passwordValid = false
    if (!user.password) {
      passwordValid = oldPassword === 'mova2024'
    } else if (user.password.startsWith('$2')) {
      passwordValid = await comparePassword(oldPassword, user.password)
    } else {
      passwordValid = oldPassword === user.password
    }

    if (!passwordValid) {
      return NextResponse.json(
        { success: false, error: 'Ancien mot de passe incorrect' },
        { status: 401 }
      )
    }

    // Hash and save new password
    const hashedPassword = await hashPassword(newPassword)
    await db.user.update({
      where: { id: payload.userId },
      data: { password: hashedPassword },
    })

    return NextResponse.json({ success: true, message: 'Mot de passe modifie avec succes' })
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: error.issues[0]?.message || 'Donnees invalides' },
        { status: 400 }
      )
    }
    const message = error instanceof Error ? error.message : 'Erreur serveur'
    console.error('Password change error:', message)
    return NextResponse.json(
      { success: false, error: 'Erreur serveur' },
      { status: 500 }
    )
  }
}
