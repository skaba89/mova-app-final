import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { signToken, hashPassword } from '@/lib/auth'
import { z } from 'zod/v4'

export const runtime = 'nodejs'

const registerSchema = z.object({
  name: z.string().min(2, 'Le nom doit avoir au moins 2 caracteres'),
  email: z.email('Email invalide'),
  phone: z.string().min(10, 'Numero de telephone invalide'),
  password: z.string().min(6, 'Le mot de passe doit avoir au moins 6 caracteres'),
  role: z.enum(['passenger', 'driver']).default('passenger'),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, email, phone, password, role } = registerSchema.parse(body)

    // Check if user already exists
    const existingUser = await db.user.findFirst({
      where: {
        OR: [{ email }, { phone }],
      },
    })

    if (existingUser) {
      return NextResponse.json(
        {
          success: false,
          error: existingUser.email === email
            ? 'Un compte avec cet email existe deja'
            : 'Un compte avec ce numero de telephone existe deja',
        },
        { status: 409 }
      )
    }

    // Hash password
    const hashedPassword = await hashPassword(password)

    // Create user + wallet in transaction
    const user = await db.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          name,
          email,
          phone,
          password: hashedPassword,
          role,
          zone: 'Kaloum',
        },
        include: { vehicles: true },
      })

      // Create wallet for user
      await tx.wallet.create({
        data: {
          userId: newUser.id,
        },
      })

      return newUser
    })

    // Sign JWT
    const token = await signToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    })

    // Return user without password
    const { password: _pw, ...safeUser } = user

    return NextResponse.json(
      {
        success: true,
        data: {
          token,
          user: safeUser,
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
    console.error('Register error:', message)
    return NextResponse.json(
      { success: false, error: 'Erreur lors de la creation du compte' },
      { status: 500 }
    )
  }
}
