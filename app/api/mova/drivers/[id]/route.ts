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

/** Convertit les champs Decimal de Prisma en nombre */
function convertDecimalFields(obj: Record<string, unknown>, fields: string[]): Record<string, unknown> {
  const converted = { ...obj };
  for (const field of fields) {
    if (converted[field] !== null && converted[field] !== undefined) {
      (converted as Record<string, unknown>)[field] = Number(converted[field]);
    }
  }
  return converted;
}

// GET /api/mova/drivers/[id]
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(request);
    const { id } = await params;

    const driver = await db.user.findUnique({
      where: { id, role: 'driver' },
      include: {
        vehicle: true,
      },
    });

    if (!driver) {
      return NextResponse.json(
        { success: false, error: 'Chauffeur non trouve' },
        { status: 404 }
      );
    }

    // Statistiques du chauffeur
    const [completedRides, totalRides, averageRating] = await Promise.all([
      db.ride.count({
        where: {
          driverId: id,
          status: 'completed',
        },
      }),
      db.ride.count({
        where: {
          driverId: id,
        },
      }),
      db.ride.aggregate({
        where: {
          driverId: id,
          status: 'completed',
          driverRating: { not: null },
        },
        _avg: { driverRating: true },
      }),
    ]);

    const decimalFields = [
      'rating',
      'currentLocationLat',
      'currentLocationLng',
      'balance',
    ];

    const converted = convertDecimalFields(driver as unknown as Record<string, unknown>, decimalFields);
    if (driver.vehicle) {
      (converted as Record<string, unknown>).vehicle = convertDecimalFields(
        driver.vehicle as unknown as Record<string, unknown>,
        decimalFields
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        driver: converted,
        stats: {
          totalRides,
          completedRides,
          cancelledRides: totalRides - completedRides,
          averageRating: averageRating._avg.driverRating
            ? Number(averageRating._avg.driverRating)
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
    const driver = await db.user.findUnique({
      where: { id, role: 'driver' },
    });

    if (!driver) {
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

    const updatedDriver = await db.user.update({
      where: { id },
      data: updateData,
      include: {
        vehicle: true,
      },
    });

    const decimalFields = [
      'rating',
      'currentLocationLat',
      'currentLocationLng',
      'balance',
    ];

    const converted = convertDecimalFields(updatedDriver as unknown as Record<string, unknown>, decimalFields);
    if (updatedDriver.vehicle) {
      (converted as Record<string, unknown>).vehicle = convertDecimalFields(
        updatedDriver.vehicle as unknown as Record<string, unknown>,
        decimalFields
      );
    }

    return NextResponse.json({
      success: true,
      data: { driver: converted },
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
