import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { signToken, comparePassword } from '@/lib/auth'
import { z } from 'zod/v4'

export const runtime = 'nodejs'

const loginSchema = z.object({
  email: z.email('Email invalide'),
  password: z.string().min(1, 'Mot de passe requis'),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, password } = loginSchema.parse(body)

    const user = await db.user.findUnique({
      where: { email },
      include: { vehicles: true },
    })

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Email ou mot de passe incorrect' },
        { status: 401 }
      )
    }

    // Password validation: bcrypt only (SEC-02 fix)
    if (!user.password || !user.password.startsWith('$2')) {
      return NextResponse.json(
        { success: false, error: 'Compte non configure. Reinitialisez votre mot de passe.' },
        { status: 401 }
      )
    }
    const passwordValid = await comparePassword(password, user.password)

    if (!passwordValid) {
      return NextResponse.json(
        { success: false, error: 'Email ou mot de passe incorrect' },
        { status: 401 }
      )
    }

    // Sign JWT
    const token = await signToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    })

    // Return user without password
    const { password: _pw, ...safeUser } = user

    return NextResponse.json({
      success: true,
      data: {
        token,
        user: safeUser,
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
    console.error('Login error:', message)
    return NextResponse.json(
      { success: false, error: 'Erreur de connexion au serveur' },
      { status: 500 }
    )
  }
}
