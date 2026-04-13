export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// PATCH /api/mova/deliveries/[id]
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { status, courierId, deliveryPhoto } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'L\'identifiant de la livraison est requis' },
        { status: 400 }
      );
    }

    if (!status) {
      return NextResponse.json(
        { success: false, error: 'Le statut est requis' },
        { status: 400 }
      );
    }

    const validStatuses = ['pending', 'picked_up', 'in_transit', 'delivered', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        { success: false, error: 'Statut invalide' },
        { status: 400 }
      );
    }

    // Check if delivery exists
    const existing = await db.delivery.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Livraison introuvable' },
        { status: 404 }
      );
    }

    // Don't allow updating completed/cancelled deliveries
    if (existing.status === 'delivered' || existing.status === 'cancelled') {
      return NextResponse.json(
        { success: false, error: 'Impossible de modifier une livraison terminée ou annulée' },
        { status: 400 }
      );
    }

    // Validate status transitions
    const validTransitions: Record<string, string[]> = {
      pending: ['picked_up', 'cancelled'],
      picked_up: ['in_transit', 'cancelled'],
      in_transit: ['delivered'],
    };

    const allowedTransitions = validTransitions[existing.status];
    if (allowedTransitions && !allowedTransitions.includes(status)) {
      return NextResponse.json(
        {
          success: false,
          error: `Transition invalide de '${existing.status}' vers '${status}'`,
        },
        { status: 400 }
      );
    }

    // Build update data
    const updateData: Record<string, unknown> = { status };

    if (courierId && (status === 'picked_up' || status === 'in_transit')) {
      updateData.courierId = courierId;
    }

    if (status === 'in_transit' && !existing.startedAt) {
      updateData.startedAt = new Date();
    }

    if (status === 'delivered') {
      updateData.deliveredAt = new Date();
      if (deliveryPhoto) {
        updateData.deliveryPhoto = deliveryPhoto;
      }
    }

    const delivery = await db.delivery.update({
      where: { id },
      data: updateData,
      include: {
        sender: {
          select: { id: true, name: true, phone: true },
        },
        courier: {
          select: { id: true, name: true, phone: true, avatar: true },
        },
      },
    });

    const statusMessages: Record<string, string> = {
      picked_up: 'Colis récupéré par le livreur',
      in_transit: 'Livraison en cours',
      delivered: 'Livraison effectuée avec succès',
      cancelled: 'Livraison annulée',
    };

    return NextResponse.json({
      success: true,
      data: delivery,
      message: statusMessages[status] || 'Livraison mise à jour',
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erreur serveur';
    return NextResponse.json(
      { success: false, error: `Erreur lors de la mise à jour de la livraison: ${message}` },
      { status: 500 }
    );
  }
}
