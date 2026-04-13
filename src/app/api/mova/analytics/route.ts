import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const runtime = 'nodejs';

export async function GET(_request: NextRequest) {
  try {
    // Date range: last 7 days for revenue charts (BUG-009 fix)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    // Run all queries in parallel for performance
    const [
      totalRides,
      activeDrivers,
      totalPassengers,
      totalRevenueResult,
      averageRatingResult,
      recentRides,
      paymentsByDay,
      ridesByStatusData,
      ridesByZoneData,
    ] = await Promise.all([
      // Total rides
      db.ride.count(),

      // Active (online) drivers
      db.user.count({ where: { role: 'driver', isOnline: true } }),

      // Total passengers
      db.user.count({ where: { role: 'passenger' } }),

      // Total revenue from completed payments
      db.payment.aggregate({
        _sum: { amount: true },
        where: { status: 'completed' },
      }),

      // Average driver rating
      db.user.aggregate({
        _avg: { rating: true },
        where: { role: 'driver' },
      }),

      // 10 most recent rides
      db.ride.findMany({
        take: 10,
        include: {
          passenger: { select: { id: true, name: true, avatar: true } },
          driver: { select: { id: true, name: true, avatar: true, rating: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),

      // Revenue per day for last 7 days using groupBy (BUG-009 fix)
      db.payment.groupBy({
        by: ['createdAt'],
        where: { status: 'completed', createdAt: { gte: sevenDaysAgo } },
        _sum: { amount: true },
      }),

      // Rides grouped by status
      db.ride.groupBy({
        by: ['status'],
        _count: { status: true },
      }),

      // Rides by zone using groupBy (PERF fix)
      db.ride.groupBy({
        by: ['pickupZone'],
        _count: { pickupZone: true },
      }),
    ]);

    // Revenue by day - aggregate already filtered at DB level
    const revenueByDayMap = new Map<string, number>();
    paymentsByDay.forEach((item) => {
      const day = item.createdAt.toISOString().split('T')[0];
      const current = revenueByDayMap.get(day) || 0;
      revenueByDayMap.set(day, current + Number(item._sum.amount || 0));
    });

    // Fill in missing days
    const revenueByDay: { day: string; revenue: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const day = date.toISOString().split('T')[0];
      revenueByDay.push({
        day,
        revenue: revenueByDayMap.get(day) || 0,
      });
    }

    // Rides by status
    const ridesByStatus = ridesByStatusData.map((item) => ({
      status: item.status,
      count: item._count.status,
    }));

    // Rides by zone
    const ridesByZone = ridesByZoneData
      .filter((item) => item.pickupZone)
      .map((item) => ({
        zone: item.pickupZone,
        count: item._count.pickupZone,
      }));

    return NextResponse.json({
      success: true,
      data: {
        stats: {
          totalRides,
          activeDrivers,
          totalPassengers,
          totalRevenue: Number(totalRevenueResult._sum.amount || 0),
          averageRating: averageRatingResult._avg.rating
            ? Math.round(Number(averageRatingResult._avg.rating) * 10) / 10
            : 0,
        },
        recentRides,
        revenueByDay,
        ridesByStatus,
        ridesByZone,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erreur serveur';
    console.error('Analytics error:', message);
    return NextResponse.json(
      { success: false, error: 'Erreur lors de la recuperation des statistiques' },
      { status: 500 }
    );
  }
}
