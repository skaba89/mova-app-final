import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth, requireRole, AuthError } from '@/lib/mova/auth-middleware';
import { z } from 'zod/v4';

const updateDriverSchema = z.object({
  isOnline: z.boolean().optional(),
  isActive: z.boolean().optional(),
  zone: z.string().optional(),
  currentLocationLat: z.number().optional(),
  currentLocationLng: z.number().optional(),
});

// GET /api/mova/drivers/[id]
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;
    const { id } = await params;

    const driverProfile = await db.driverProfile.findUnique({
      where: { id },
      include: {
        user: {
          select: { id: true, name: true, phone: true, rating: true },
        },
        vehicles: true,
      },
    });

    if (!driverProfile) {
      return NextResponse.json(
        { success: false, error: 'Chauffeur non trouve' },
        { status: 404 }
      );
    }

    // Statistiques du chauffeur
    const [completedRides, totalRides, averageRating] = await Promise.all([
      db.ride.count({
        where: {
          driverProfileId: id,
          status: 'completed',
        },
      }),
      db.ride.count({
        where: {
          driverProfileId: id,
        },
      }),
      db.rating.aggregate({
        where: {
          toUserId: driverProfile.userId,
        },
        _avg: { score: true },
      }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        driver: driverProfile,
        stats: {
          totalRides,
          completedRides,
          cancelledRides: totalRides - completedRides,
          averageRating: averageRating._avg.score
            ? Number(averageRating._avg.score)
            : null,
        },
      },
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: error.statusCode }
      );
    }

    console.error('[DRIVER] Erreur interne:', error);
    return NextResponse.json(
      { success: false, error: 'Erreur interne du serveur' },
      { status: 500 }
    );
  }
}

// PATCH /api/mova/drivers/[id]
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Seuls admin et gestionnaire_flotte peuvent modifier un chauffeur
    const roleChecker = requireRole(['admin', 'gestionnaire_flotte']);
    const auth = await roleChecker(request);
    if (auth instanceof NextResponse) return auth;
    const { id } = await params;
    const body = await request.json();

    const parsed = updateDriverSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }

    const data = parsed.data;

    // Verification de l'existence du chauffeur
    const driverProfile = await db.driverProfile.findUnique({
      where: { id },
    });

    if (!driverProfile) {
      return NextResponse.json(
        { success: false, error: 'Chauffeur non trouve' },
        { status: 404 }
      );
    }

    // Mise a jour
    const updateData: Record<string, unknown> = {};
    if (data.isOnline !== undefined) updateData.isOnline = data.isOnline;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;
    if (data.zone !== undefined) updateData.zone = data.zone;
    if (data.currentLocationLat !== undefined) updateData.currentLocationLat = data.currentLocationLat;
    if (data.currentLocationLng !== undefined) updateData.currentLocationLng = data.currentLocationLng;

    const updatedDriver = await db.driverProfile.update({
      where: { id },
      data: updateData,
      include: {
        user: {
          select: { id: true, name: true, phone: true, rating: true },
        },
        vehicles: true,
      },
    });

    return NextResponse.json({
      success: true,
      data: { driver: updatedDriver },
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: error.statusCode }
      );
    }

    console.error('[DRIVER] Erreur interne:', error);
    return NextResponse.json(
      { success: false, error: 'Erreur interne du serveur' },
      { status: 500 }
    );
  }
}
