import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/mova/auth-middleware'
import db from '@/lib/db'
import { z } from 'zod/v4'

// Schema de validation pour la creation d'un compte entreprise
const createBusinessSchema = z.object({
  name: z.string().min(2, 'Le nom de l\'entreprise doit contenir au moins 2 caracteres'),
  email: z.string().email('Adresse e-mail invalide'),
  phone: z.string().min(8, 'Le numero de telephone est invalide').optional(),
  address: z.string().min(5, 'L\'adresse doit contenir au moins 5 caracteres').optional(),
  siretNumber: z.string().min(5, 'Le numero SIRET est invalide').optional(),
})

// Utilitaire de conversion Decimal vers Number
function num(value: unknown): number {
  if (value === null || value === undefined) return 0
  return Number(value)
}

// GET /api/mova/business - Lister les comptes entreprise
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (auth instanceof NextResponse) return auth

    const { searchParams } = new URL(request.url)
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') ?? '20', 10)))
    const skip = (page - 1) * limit
    const status = searchParams.get('status')

    // Filtrer par les comptes auxquels l'utilisateur appartient
    const where: Record<string, unknown> = {
      employees: { some: { userId: auth.id } },
    }
    if (status) {
      const statuses = status.split(',').map(s => s.trim()).filter(Boolean)
      if (statuses.length === 1) {
        where.status = statuses[0]
      } else if (statuses.length > 1) {
        where.status = { in: statuses }
      }
    }

    const [accounts, total] = await Promise.all([
      db.businessAccount.findMany({
        where,
        include: {
          employees: {
            select: {
              id: true,
              userId: true,
              role: true,
              isActive: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      db.businessAccount.count({ where }),
    ])

    const convertedAccounts = accounts.map((a) => ({
      ...a,
      monthlyLimit: num(a.monthlyLimit),
      currentSpend: num(a.currentSpend),
    }))

    return NextResponse.json({
      success: true,
      data: {
        accounts: convertedAccounts,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    })
  } catch (error) {
    console.error('[BUSINESS] Erreur lors de la recuperation:', error)
    return NextResponse.json(
      { success: false, error: 'Erreur interne du serveur' },
      { status: 500 }
    )
  }
}

// POST /api/mova/business - Creer un compte entreprise
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (auth instanceof NextResponse) return auth

    const body = await request.json()
    const parsed = createBusinessSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues[0].message },
        { status: 400 }
      )
    }

    const data = parsed.data

    // Verifier que l'e-mail n'est pas deja utilise
    const existing = await db.businessAccount.findUnique({
      where: { email: data.email },
    })

    if (existing) {
      return NextResponse.json(
        { success: false, error: 'Un compte avec cet e-mail existe deja' },
        { status: 409 }
      )
    }

    const account = await db.businessAccount.create({
      data: {
        name: data.name,
        email: data.email,
        phone: data.phone ?? null,
        address: data.address ?? null,
        siretNumber: data.siretNumber ?? null,
        status: 'active',
        subscriptionPlan: 'free',
        monthlyLimit: 0,
        currentSpend: 0,
      },
    })

    // Ajouter l'utilisateur createur comme employe
    await db.businessEmployee.create({
      data: {
        businessAccountId: account.id,
        userId: auth.id,
        role: 'admin',
        monthlyLimit: 0,
        currentSpend: 0,
      },
    })

    const convertedAccount = {
      ...account,
      monthlyLimit: num(account.monthlyLimit),
      currentSpend: num(account.currentSpend),
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          message: 'Compte entreprise cree avec succes',
          account: convertedAccount,
        },
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('[BUSINESS] Erreur lors de la creation:', error)
    return NextResponse.json(
      { success: false, error: 'Erreur interne du serveur' },
      { status: 500 }
    )
  }
}
