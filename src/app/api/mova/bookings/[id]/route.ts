export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// PATCH /api/mova/bookings/[id]
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { status } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'L\'identifiant de la réservation est requis' },
        { status: 400 }
      );
    }

    if (!status) {
      return NextResponse.json(
        { success: false, error: 'Le statut est requis' },
        { status: 400 }
      );
    }

    const validStatuses = ['scheduled', 'confirmed', 'in_progress', 'completed', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        { success: false, error: 'Statut invalide' },
        { status: 400 }
      );
    }

    // Check if booking exists
    const existing = await db.booking.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Réservation introuvable' },
        { status: 404 }
      );
    }

    // Don't allow updating completed bookings
    if (existing.status === 'completed') {
      return NextResponse.json(
        { success: false, error: 'Impossible de modifier une réservation terminée' },
        { status: 400 }
      );
    }

    // Prevent invalid transitions
    if (existing.status === 'cancelled' && status !== 'cancelled') {
      return NextResponse.json(
        { success: false, error: 'Impossible de réactiver une réservation annulée' },
        { status: 400 }
      );
    }

    const updateData: Record<string, unknown> = { status };

    const booking = await db.booking.update({
      where: { id },
      data: updateData,
      include: {
        passenger: {
          select: { id: true, name: true, phone: true },
        },
      },
    });

    const statusMessages: Record<string, string> = {
      scheduled: 'Réservation planifiée',
      confirmed: 'Réservation confirmée',
      in_progress: 'Course en cours',
      completed: 'Course terminée',
      cancelled: 'Réservation annulée',
    };

    return NextResponse.json({
      success: true,
      data: booking,
      message: statusMessages[status] || 'Réservation mise à jour',
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erreur serveur';
    return NextResponse.json(
      { success: false, error: `Erreur lors de la mise à jour: ${message}` },
      { status: 500 }
    );
  }
}
