import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { validateRequest } from '@/lib/mova/auth-middleware';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const status = searchParams.get('status');
    const zone = searchParams.get('zone');
    const passengerId = searchParams.get('passengerId');
    const driverId = searchParams.get('driverId');
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    const where: Record<string, unknown> = {};

    if (status) {
      where.status = status;
    }
    if (zone) {
      where.OR = [
        { pickupZone: zone },
        { dropoffZone: zone },
      ];
    }
    if (passengerId) {
      where.passengerId = passengerId;
    }
    if (driverId) {
      where.driverId = driverId;
    }

    const [rides, total] = await Promise.all([
      db.ride.findMany({
        where,
        include: {
          passenger: {
            select: { id: true, name: true, phone: true, avatar: true, rating: true },
          },
          driver: {
            select: {
              id: true, name: true, phone: true, avatar: true, rating: true,
              isOnline: true, zone: true,
              vehicles: { where: { isActive: true } },
            },
          },
          vehicle: true,
          payments: true,
        },
        orderBy: { createdAt: 'desc' },
        take: Math.min(limit, 100),
        skip: offset,
      }),
      db.ride.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        rides,
        total,
        pagination: {
          total,
          limit,
          offset,
          hasMore: offset + limit < total,
        },
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erreur serveur';
    console.error('Rides list error:', error instanceof Error ? error.message : error);
    return NextResponse.json(
      { success: false, error: 'Erreur lors de la récupération des courses' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await validateRequest(request);
    if (!auth.success) return auth.response;
    const body = await request.json();
    const {
      passengerId,
      pickupAddress,
      pickupLat,
      pickupLng,
      pickupZone,
      dropoffAddress,
      dropoffLat,
      dropoffLng,
      dropoffZone,
      estimatedFare,
    } = body;

    if (!passengerId || !pickupAddress || !dropoffAddress) {
      return NextResponse.json(
        { success: false, error: 'Champs requis manquants' },
        { status: 400 }
      );
    }

    const ride = await db.ride.create({
      data: {
        passengerId,
        pickupAddress,
        pickupLat: parseFloat(pickupLat) || 0,
        pickupLng: parseFloat(pickupLng) || 0,
        pickupZone: pickupZone || 'Unknown',
        dropoffAddress,
        dropoffLat: parseFloat(dropoffLat) || 0,
        dropoffLng: parseFloat(dropoffLng) || 0,
        dropoffZone: dropoffZone || 'Unknown',
        estimatedFare: parseFloat(estimatedFare) || 0,
      },
      include: {
        passenger: {
          select: { id: true, name: true, phone: true, avatar: true, rating: true },
        },
      },
    });

    return NextResponse.json({ success: true, data: ride }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erreur serveur';
    console.error('Create ride error:', error instanceof Error ? error.message : error);
    return NextResponse.json(
      { success: false, error: 'Erreur lors de la création de la course' },
      { status: 500 }
    );
  }
}
