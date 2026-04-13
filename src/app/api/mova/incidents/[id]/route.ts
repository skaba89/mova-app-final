export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// PATCH /api/mova/incidents/[id]
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { status, resolution } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'L\'identifiant de l\'incident est requis' },
        { status: 400 }
      );
    }

    if (!status) {
      return NextResponse.json(
        { success: false, error: 'Le statut est requis' },
        { status: 400 }
      );
    }

    const validStatuses = ['open', 'investigating', 'resolved', 'closed'];
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        {
          success: false,
          error: `Statut invalide. Options: ${validStatuses.join(', ')}`,
        },
        { status: 400 }
      );
    }

    // Check if incident exists
    const existing = await db.incident.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Incident introuvable' },
        { status: 404 }
      );
    }

    // Don't allow re-opening closed incidents
    if (existing.status === 'closed' && status !== 'closed') {
      return NextResponse.json(
        { success: false, error: 'Impossible de rouvrir un incident fermé' },
        { status: 400 }
      );
    }

    // Validate status transitions
    const validTransitions: Record<string, string[]> = {
      open: ['investigating', 'resolved', 'closed'],
      investigating: ['resolved', 'closed'],
      resolved: ['closed'],
      closed: ['closed'],
    };

    const allowedTransitions = validTransitions[existing.status];
    if (!allowedTransitions.includes(status)) {
      return NextResponse.json(
        {
          success: false,
          error: `Transition invalide de '${existing.status}' vers '${status}'`,
        },
        { status: 400 }
      );
    }

    // If resolving or closing, resolution is required
    if ((status === 'resolved' || status === 'closed') && !resolution && !existing.resolution) {
      return NextResponse.json(
        { success: false, error: 'Une résolution est requise pour clôturer ou résoudre l\'incident' },
        { status: 400 }
      );
    }

    // Build update data
    const updateData: Record<string, unknown> = { status };
    if (resolution) {
      updateData.resolution = resolution;
    }

    const incident = await db.incident.update({
      where: { id },
      data: updateData,
    });

    // Enrich with reporter info
    const reporter = await db.user.findUnique({
      where: { id: incident.reporterId },
      select: { id: true, name: true, phone: true },
    });

    const reported = incident.reportedId
      ? await db.user.findUnique({
          where: { id: incident.reportedId },
          select: { id: true, name: true, phone: true, role: true },
        })
      : null;

    const statusMessages: Record<string, string> = {
      investigating: 'Incident en cours d\'investigation',
      resolved: 'Incident résolu',
      closed: 'Incident clôturé',
    };

    return NextResponse.json({
      success: true,
      data: {
        ...incident,
        reporter,
        reported,
      },
      message: statusMessages[status] || 'Incident mis à jour',
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erreur serveur';
    return NextResponse.json(
      { success: false, error: `Erreur lors de la mise à jour de l'incident: ${message}` },
      { status: 500 }
    );
  }
}
