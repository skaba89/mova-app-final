import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { Prisma } from '@prisma/client';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const zone = searchParams.get('zone');
    const online = searchParams.get('online');

    const where: Prisma.UserWhereInput = {
      role: 'driver',
    };

    if (zone) {
      where.zone = zone;
    }

    if (online !== null && online !== '') {
      where.isOnline = online === 'true';
    }

    const drivers = await db.user.findMany({
      where,
      include: {
        vehicles: {
          where: { isActive: true },
        },
        _count: {
          select: {
            ridesAsDriver: { where: { status: 'completed' } },
          },
        },
      },
      orderBy: { rating: 'desc' },
    });

    // Use _count instead of loading all ride records (BUG-008 fix)
    const enrichedDrivers = drivers.map((driver) => ({
      ...driver,
      completedRides: driver._count.ridesAsDriver,
    }));

    return NextResponse.json({ success: true, data: enrichedDrivers });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erreur serveur';
    console.error('Drivers list error:', error instanceof Error ? error.message : error);
    return NextResponse.json(
      { success: false, error: 'Erreur lors de la récupération des chauffeurs' },
      { status: 500 }
    );
  }
}
