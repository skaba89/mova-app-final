import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod/v4'
import { db } from '@/lib/db'
import { validateRequest } from '@/lib/mova/auth-middleware'

export const runtime = 'nodejs'

const createTicketSchema = z.object({
  userId: z.string().min(1, 'userId requis'),
  subject: z.string().min(3, 'Le sujet doit avoir au moins 3 caracteres'),
  description: z.string().min(10, 'La description doit avoir au moins 10 caracteres'),
  category: z
    .enum(['course', 'paiement', 'livraison', 'compte', 'technique', 'autre'])
    .default('autre'),
  priority: z.enum(['low', 'medium', 'high']).default('medium'),
})

// POST /api/mova/support
export async function POST(request: NextRequest) {
  try {
    const auth = await validateRequest(request)
    if (!auth.success) return auth.response
    const body = await request.json()
    const { userId, subject, description, category, priority } =
      createTicketSchema.parse(body)

    const ticket = await db.supportTicket.create({
      data: {
        userId,
        subject,
        description,
        category,
        status: 'open',
        priority,
      },
    })

    return NextResponse.json(
      {
        success: true,
        data: {
          id: ticket.id,
          userId: ticket.userId,
          subject: ticket.subject,
          description: ticket.description,
          category: ticket.category,
          status: ticket.status,
          priority: ticket.priority,
          createdAt: ticket.createdAt.toISOString(),
          updatedAt: ticket.updatedAt.toISOString(),
          response: ticket.response,
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
    console.error('Support POST error:', message)
    return NextResponse.json(
      { success: false, error: 'Erreur serveur' },
      { status: 500 }
    )
  }
}

// GET /api/mova/support?userId=xxx
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'userId est requis' },
        { status: 400 }
      )
    }

    const tickets = await db.supportTicket.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({
      success: true,
      data: {
        tickets: tickets.map((t) => ({
          id: t.id,
          userId: t.userId,
          subject: t.subject,
          description: t.description,
          category: t.category,
          status: t.status,
          priority: t.priority,
          createdAt: t.createdAt.toISOString(),
          updatedAt: t.updatedAt.toISOString(),
          response: t.response,
        })),
        totalCount: tickets.length,
        openCount: tickets.filter((t) => t.status === 'open').length,
      },
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erreur serveur'
    console.error('Support GET error:', message)
    return NextResponse.json(
      { success: false, error: 'Erreur serveur' },
      { status: 500 }
    )
  }
}
