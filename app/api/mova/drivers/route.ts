import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth, AuthError } from '@/lib/mova/auth-middleware';

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

// GET /api/mova/drivers
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    const { searchParams } = new URL(request.url);

    const zone = searchParams.get('zone');
    const vehicleType = searchParams.get('vehicleType');
    const isOnline = searchParams.get('isOnline');
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') ?? '20', 10)));
    const skip = (page - 1) * limit;

    // Construction du filtre
    const where: Record<string, unknown> = {
      isActive: true,
    };

    if (zone) {
      where.zone = zone;
    }

    if (vehicleType) {
      where.vehicle = {
        vehicleType,
      };
    }

    if (isOnline !== null && isOnline !== undefined && isOnline !== '') {
      where.isOnline = isOnline === 'true';
    }

    const [drivers, total] = await Promise.all([
      db.user.findMany({
        where: {
          role: 'driver',
          ...where,
        },
        include: {
          vehicle: true,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      db.user.count({
        where: {
          role: 'driver',
          ...where,
        },
      }),
    ]);

    const decimalFields = [
      'rating',
      'currentLocationLat',
      'currentLocationLng',
      'balance',
    ];

    const convertedDrivers = drivers.map((driver) => {
      const base = convertDecimalFields(driver as unknown as Record<string, unknown>, decimalFields);
      if (driver.vehicle) {
        (base as Record<string, unknown>).vehicle = convertDecimalFields(
          driver.vehicle as unknown as Record<string, unknown>,
          decimalFields
        );
      }
      return base;
    });

    return NextResponse.json({
      success: true,
      data: {
        drivers: convertedDrivers,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
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

    console.error('[DRIVERS] Erreur interne:', error);
    return NextResponse.json(
      { success: false, error: 'Erreur interne du serveur' },
      { status: 500 }
    );
  }
}
