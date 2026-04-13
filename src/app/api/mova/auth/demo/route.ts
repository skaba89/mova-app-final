import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { signToken, comparePassword } from '@/lib/auth'
import { z } from 'zod/v4'

export const runtime = 'nodejs'

const demoSchema = z.object({
  role: z.enum(['passenger', 'driver', 'admin']).default('passenger'),
})

const DEMO_USERS = {
  passenger: {
    email: 'fatoumata@mova.gn',
    password: 'demo123',
  },
  driver: {
    email: 'mamadou@mova.gn',
    password: 'demo123',
  },
  admin: {
    email: 'admin@mova.gn',
    password: 'admin123',
  },
} as const

export async function POST(request: NextRequest) {
  // DEMO_MODE must be explicitly enabled via environment variable
  if (process.env.DEMO_MODE !== 'true') {
    return NextResponse.json(
      { success: false, error: 'Le mode démo est désactivé.' },
      { status: 403 }
    )
  }

  try {
    const body = await request.json()
    const { role } = demoSchema.parse(body)

    const demoCreds = DEMO_USERS[role]
    if (!demoCreds) {
      return NextResponse.json(
        { success: false, error: 'Role de demo invalide' },
        { status: 400 }
      )
    }

    const user = await db.user.findUnique({
      where: { email: demoCreds.email },
      include: { vehicles: true },
    })

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Utilisateur demo non trouve. Executez le seed.' },
        { status: 404 }
      )
    }

    // Verify demo password properly (no bypass)
    let passwordValid = false
    if (!user.password) {
      // No password set — only allow with a known demo seed password
      passwordValid = false
    } else if (user.password.startsWith('$2')) {
      // bcrypt hash
      passwordValid = await comparePassword(demoCreds.password, user.password)
    } else {
      // Plaintext (legacy seed data) — still match
      passwordValid = demoCreds.password === user.password
    }

    if (!passwordValid) {
      return NextResponse.json(
        { success: false, error: 'Mot de passe demo incorrect. Verifiez le seed.' },
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
      isDemo: true, // Flag for client to know this is a demo session
    })
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: error.issues[0]?.message || 'Donnees invalides' },
        { status: 400 }
      )
    }
    const message = error instanceof Error ? error.message : 'Erreur serveur'
    console.error('Demo login error:', message)
    return NextResponse.json(
      { success: false, error: 'Erreur de connexion demo' },
      { status: 500 }
    )
  }
}
