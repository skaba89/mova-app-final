import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod/v4'
import { db } from '@/lib/db'

export const runtime = 'nodejs'

// GET /api/mova/support/[id]?userId=xxx
export async function GET(
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

    const ticket = await db.supportTicket.findFirst({
      where: { id, userId },
    })

    if (!ticket) {
      return NextResponse.json(
        { success: false, error: 'Ticket non trouve' },
        { status: 404 }
      )
    }

    return NextResponse.json({
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
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erreur serveur'
    console.error('Support GET by id error:', message)
    return NextResponse.json(
      { success: false, error: 'Erreur serveur' },
      { status: 500 }
    )
  }
}

const updateTicketSchema = z.object({
  status: z
    .enum(['open', 'in_progress', 'resolved', 'closed'])
    .optional(),
  priority: z.enum(['low', 'medium', 'high']).optional(),
  response: z.string().optional(),
})

// PATCH /api/mova/support/[id]?userId=xxx
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
    const updates = updateTicketSchema.parse(body)

    const ticket = await db.supportTicket.findFirst({
      where: { id, userId },
    })

    if (!ticket) {
      return NextResponse.json(
        { success: false, error: 'Ticket non trouve' },
        { status: 404 }
      )
    }

    const updated = await db.supportTicket.update({
      where: { id },
      data: {
        ...updates,
        updatedAt: new Date(),
      },
    })

    return NextResponse.json({
      success: true,
      data: {
        id: updated.id,
        userId: updated.userId,
        subject: updated.subject,
        description: updated.description,
        category: updated.category,
        status: updated.status,
        priority: updated.priority,
        createdAt: updated.createdAt.toISOString(),
        updatedAt: updated.updatedAt.toISOString(),
        response: updated.response,
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
    console.error('Support PATCH error:', message)
    return NextResponse.json(
      { success: false, error: 'Erreur serveur' },
      { status: 500 }
    )
  }
}

// DELETE /api/mova/support/[id]?userId=xxx
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

    const ticket = await db.supportTicket.findFirst({
      where: { id, userId },
    })

    if (!ticket) {
      return NextResponse.json(
        { success: false, error: 'Ticket non trouve' },
        { status: 404 }
      )
    }

    const removed = await db.supportTicket.delete({
      where: { id },
    })

    return NextResponse.json({
      success: true,
      data: {
        id: removed.id,
        userId: removed.userId,
        subject: removed.subject,
        description: removed.description,
        category: removed.category,
        status: removed.status,
        priority: removed.priority,
        createdAt: removed.createdAt.toISOString(),
        updatedAt: removed.updatedAt.toISOString(),
        response: removed.response,
      },
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erreur serveur'
    console.error('Support DELETE error:', message)
    return NextResponse.json(
      { success: false, error: 'Erreur serveur' },
      { status: 500 }
    )
  }
}
