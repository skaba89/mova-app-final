export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { validateRequest } from '@/lib/mova/auth-middleware';

// GET /api/mova/incidents?status=open&type=accident&limit=20
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const type = searchParams.get('type');
    const severity = searchParams.get('severity');
    const reporterId = searchParams.get('reporterId');
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    const where: Record<string, unknown> = {};

    if (status) where.status = status;
    if (type) where.type = type;
    if (severity) where.severity = severity;
    if (reporterId) where.reporterId = reporterId;

    const [incidents, total] = await Promise.all([
      db.incident.findMany({
        where,
        orderBy: [
          { severity: 'desc' },
          { createdAt: 'desc' },
        ],
        take: limit,
        skip: offset,
      }),
      db.incident.count({ where }),
    ]);

    // Enrich with reporter info
    const enrichedIncidents = await Promise.all(
      incidents.map(async (incident) => {
        const reporter = await db.user.findUnique({
          where: { id: incident.reporterId },
          select: { id: true, name: true, phone: true, avatar: true },
        });

        const reported = incident.reportedId
          ? await db.user.findUnique({
              where: { id: incident.reportedId },
              select: { id: true, name: true, phone: true, role: true },
            })
          : null;

        return {
          ...incident,
          reporter,
          reported,
        };
      })
    );

    return NextResponse.json({
      success: true,
      data: enrichedIncidents,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erreur serveur';
    return NextResponse.json(
      { success: false, error: `Erreur lors de la récupération des incidents: ${message}` },
      { status: 500 }
    );
  }
}

// POST /api/mova/incidents
export async function POST(request: NextRequest) {
  try {
    const auth = await validateRequest(request);
    if (!auth.success) return auth.response;

    const body = await request.json();
    const { reporterId, rideId, deliveryId, reportedId, type, severity, description } = body;

    if (!reporterId || !type || !description) {
      return NextResponse.json(
        { success: false, error: 'L\'identifiant du rapporteur, le type et la description sont requis' },
        { status: 400 }
      );
    }

    // Validate type
    const validTypes = ['accident', 'dispute', 'damage', 'lost_item', 'safety', 'other'];
    if (!validTypes.includes(type)) {
      return NextResponse.json(
        {
          success: false,
          error: `Type invalide. Options: ${validTypes.join(', ')}`,
        },
        { status: 400 }
      );
    }

    // Validate severity
    const validSeverities = ['low', 'medium', 'high', 'critical'];
    const selectedSeverity = severity || 'medium';
    if (!validSeverities.includes(selectedSeverity)) {
      return NextResponse.json(
        {
          success: false,
          error: `Sévérité invalide. Options: ${validSeverities.join(', ')}`,
        },
        { status: 400 }
      );
    }

    // Must have at least one context (ride or delivery)
    if (!rideId && !deliveryId) {
      return NextResponse.json(
        { success: false, error: 'Une course ou une livraison doit être associée à l\'incident' },
        { status: 400 }
      );
    }

    // Validate that referenced ride/delivery exists
    if (rideId) {
      const ride = await db.ride.findUnique({ where: { id: rideId } });
      if (!ride) {
        return NextResponse.json(
          { success: false, error: 'Course introuvable' },
          { status: 404 }
        );
      }
    }

    if (deliveryId) {
      const delivery = await db.delivery.findUnique({ where: { id: deliveryId } });
      if (!delivery) {
        return NextResponse.json(
          { success: false, error: 'Livraison introuvable' },
          { status: 404 }
        );
      }
    }

    // Create incident
    const incident = await db.incident.create({
      data: {
        reporterId,
        rideId: rideId || null,
        deliveryId: deliveryId || null,
        reportedId: reportedId || null,
        type,
        severity: selectedSeverity,
        description,
        status: 'open',
      },
    });

    // Get reporter info
    const reporter = await db.user.findUnique({
      where: { id: reporterId },
      select: { id: true, name: true, phone: true },
    });

    const typeLabels: Record<string, string> = {
      accident: 'Accident',
      dispute: 'Litige',
      damage: 'Dommage',
      lost_item: 'Objet perdu',
      safety: 'Sécurité',
      other: 'Autre',
    };

    return NextResponse.json({
      success: true,
      data: {
        ...incident,
        reporter,
      },
      message: `Signalement créé avec succès. Type: ${typeLabels[type] || type}. Notre équipe va examiner votre réclamation.`,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erreur serveur';
    return NextResponse.json(
      { success: false, error: `Erreur lors de la création du signalement: ${message}` },
      { status: 500 }
    );
  }
}
