import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth, AuthError } from '@/lib/mova/auth-middleware';

// GET /api/mova/drivers
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;
    const { searchParams } = new URL(request.url);

    const zone = searchParams.get('zone');
    const vehicleType = searchParams.get('vehicleType');
    const isOnline = searchParams.get('isOnline');
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') ?? '20', 10)));
    const skip = (page - 1) * limit;

    // Construction du filtre sur DriverProfile
    const where: Record<string, unknown> = {
      isActive: true,
    };

    if (zone) {
      where.zone = zone;
    }

    if (vehicleType) {
      where.vehicleType = vehicleType;
    }

    if (isOnline !== null && isOnline !== undefined && isOnline !== '') {
      where.isOnline = isOnline === 'true';
    }

    const [driverProfiles, total] = await Promise.all([
      db.driverProfile.findMany({
        where,
        include: {
          user: {
            select: { id: true, name: true, phone: true, rating: true },
          },
          vehicles: true,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      db.driverProfile.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        drivers: driverProfiles,
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
