export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { cache } from '@/lib/cache';
import { errorLogger } from '@/lib/error-logger';

// ─── Cache Key & TTL ──────────────────────────────────────────────────

const KPI_CACHE_KEY = 'analytics:kpi:dashboard';
const KPI_CACHE_TTL = 60; // 60 seconds

// ─── GET /api/mova/analytics/kpi — KPI Dashboard (admin-only) ─────────

export async function GET(request: NextRequest) {
  try {
    // Auth check
    const userId = request.headers.get('x-user-id');
    const userRole = request.headers.get('x-user-role');

    if (!userId) {
      return NextResponse.json({ success: false, error: 'Non autorisé' }, { status: 401 });
    }

    if (userRole !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'Accès restreint. Réservé aux administrateurs.' },
        { status: 403 }
      );
    }

    // Try cache first
    const cached = cache.get<Record<string, unknown>>(KPI_CACHE_KEY);
    if (cached) {
      return NextResponse.json({ success: true, data: cached, cached: true });
    }

    // Time boundaries
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(todayStart);
    weekStart.setDate(weekStart.getDate() - 7);

    // ─── Run all Prisma queries in parallel ──────────────────────────
    const [
      totalUsers,
      newUsersToday,
      newUsersWeek,
      totalRides,
      ridesToday,
      ridesWeek,
      revenueAll,
      revenueToday,
      revenueWeek,
      avgFare,
      avgRatingResult,
      onlineDrivers,
      totalDrivers,
      mobileMoneyPayments,
      completedPayments,
      cancelledRides,
      totalRidesForCancelRate,
    ] = await Promise.all([
      // Users
      db.user.count(),
      db.user.count({ where: { createdAt: { gte: todayStart } } }),
      db.user.count({ where: { createdAt: { gte: weekStart } } }),

      // Rides
      db.ride.count(),
      db.ride.count({ where: { createdAt: { gte: todayStart } } }),
      db.ride.count({ where: { createdAt: { gte: weekStart } } }),

      // Revenue
      db.payment.aggregate({ _sum: { amount: true }, where: { status: 'completed' } }),
      db.payment.aggregate({ _sum: { amount: true }, where: { status: 'completed', createdAt: { gte: todayStart } } }),
      db.payment.aggregate({ _sum: { amount: true }, where: { status: 'completed', createdAt: { gte: weekStart } } }),

      // Average fare
      db.ride.aggregate({ _avg: { actualFare: true }, where: { actualFare: { gt: 0 } } }),

      // Average rating (from drivers)
      db.user.aggregate({ _avg: { rating: true }, where: { role: 'driver', rating: { gt: 0 } } }),

      // Adoption metrics
      db.user.count({ where: { role: 'driver', isOnline: true } }),
      db.user.count({ where: { role: 'driver' } }),

      // Mobile money users (users who made at least one mobile_money payment)
      db.user.count({
        where: {
          payments: { some: { method: 'mobile_money', status: 'completed' } },
        },
      }),

      // Completed payments count (as proxy for OTP-verified = users with completed rides)
      db.payment.count({ where: { status: 'completed' } }),

      // Cancelled rides
      db.ride.count({ where: { status: 'cancelled' } }),

      // Total rides for cancellation rate
      db.ride.count(),
    ]);

    // ─── Build response ─────────────────────────────────────────────

    const totalRevenue = Number(revenueAll._sum.amount || 0);
    const todayRevenue = Number(revenueToday._sum.amount || 0);
    const weekRevenue = Number(revenueWeek._sum.amount || 0);
    const averageFare = avgFare._avg.actualFare
      ? Math.round(Number(avgFare._avg.actualFare))
      : 0;
    const averageRating = avgRatingResult._avg.rating
      ? Math.round(Number(avgRatingResult._avg.rating) * 10) / 10
      : 0;

    const cancellationRate = totalRidesForCancelRate > 0
      ? Math.round((cancelledRides / totalRidesForCancelRate) * 1000) / 10
      : 0;

    // PWA estimate: online drivers / total drivers (as proxy for active sessions)
    const pwaInstalled = onlineDrivers;
    const pwaRate = totalDrivers > 0
      ? Math.round((onlineDrivers / totalDrivers) * 100)
      : 0;

    const otpVerifiedUsers = completedPayments;

    // ─── Performance metrics from error logger ──────────────────────
    const errorStats = errorLogger.getStats();
    const recentErrors = errorLogger.getErrors(100);
    const apiErrorRate = recentErrors.length > 0
      ? Math.min(Math.round((errorStats.errors / Math.max(recentErrors.length + errorStats.warnings + errorStats.info, 1)) * 1000) / 10, 100)
      : 0;

    // Average response time: derived from completed ride durations
    const avgDuration = await db.ride.aggregate({
      _avg: { duration: true },
      where: { status: 'completed', duration: { gt: 0 } },
    });
    const averageResponseTime = avgDuration._avg.duration
      ? Math.round(Number(avgDuration._avg.duration) / 60)
      : 0;

    // Average booking time: time between ride creation and start
    const recentAcceptedRides = await db.ride.findMany({
      where: { status: 'completed', startedAt: { not: null as never }, createdAt: { not: null as never } },
      select: { createdAt: true, startedAt: true },
      take: 100,
      orderBy: { createdAt: 'desc' },
    });
    let averageBookingTime = 0;
    if (recentAcceptedRides.length > 0) {
      const totalWaitMs = recentAcceptedRides.reduce((sum, r) => {
        if (r.startedAt && r.createdAt) {
          return sum + (r.startedAt.getTime() - r.createdAt.getTime());
        }
        return sum;
      }, 0);
      averageBookingTime = Math.round(totalWaitMs / recentAcceptedRides.length / 1000);
    }

    // ─── Satisfaction: Rating distribution from rides ───────────────
    const ridesWithRatings = await db.ride.findMany({
      where: {
        passengerRating: { gte: 1 },
      },
      select: { passengerRating: true },
      take: 1000,
    });

    const ratingDistribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    for (const ride of ridesWithRatings) {
      const r = Math.round(ride.passengerRating || 0);
      if (r >= 1 && r <= 5) {
        ratingDistribution[r]++;
      }
    }

    const totalRatings = ridesWithRatings.length;

    // Top categories from ride zones
    const ridesByZone = await db.ride.groupBy({
      by: ['pickupZone'],
      _count: { pickupZone: true },
      orderBy: { _count: { pickupZone: 'desc' } },
      take: 5,
    });

    const topCategories = ridesByZone.map((r) => r.pickupZone).filter(Boolean);

    // ─── Support: Ticket metrics from SupportTicket model ───────────
    const [openTickets, resolvedTodayTickets, ticketsByCategory] = await Promise.all([
      db.supportTicket.count({ where: { status: { in: ['open', 'in_progress'] } } }),
      db.supportTicket.count({ where: { status: 'resolved', updatedAt: { gte: todayStart } } }),
      db.supportTicket.groupBy({
        by: ['category'],
        _count: { category: true },
        orderBy: { _count: { category: 'desc' } },
        take: 5,
      }),
    ]);

    const categoryLabels: Record<string, string> = {
      course: 'Course',
      paiement: 'Paiement',
      livraison: 'Livraison',
      compte: 'Compte',
      technique: 'Technique',
      autre: 'Autre',
    };

    const topIssues = ticketsByCategory.map((item) => ({
      category: categoryLabels[item.category] || item.category,
      count: item._count.category,
    }));

    // Average resolution time estimate based on open tickets
    const avgResolutionTime = openTickets > 5 ? '~4h 30min' : openTickets > 2 ? '~2h 15min' : '< 1h';

    // ─── Recent feedback from Feedback model ───────────────────────
    const recentFeedbackEntries = await db.feedback.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { id: true, name: true } },
      },
    });

    const recentFeedback = recentFeedbackEntries.map((fb) => ({
      id: fb.id,
      rating: fb.rating,
      comment: fb.comment || 'Pas de commentaire',
      date: fb.createdAt.toISOString(),
      userName: fb.user.name,
      type: fb.type,
    }));

    // ─── Assemble final KPI object ──────────────────────────────────

    const kpiData = {
      overview: {
        totalUsers,
        newUsersToday,
        newUsersWeek,
        totalRides,
        ridesToday,
        ridesWeek,
        totalRevenue,
        revenueToday: todayRevenue,
        revenueWeek: weekRevenue,
        averageFare,
        averageRating,
      },
      adoption: {
        pwaInstalled,
        pwaRate,
        mobileMoneyUsers: mobileMoneyPayments,
        otpVerifiedUsers,
      },
      performance: {
        averageBookingTime,
        cancellationRate,
        apiErrorRate,
        averageResponseTime,
      },
      satisfaction: {
        averageRating,
        totalRatings,
        ratingDistribution,
        topCategories,
        recentFeedback,
      },
      support: {
        openTickets,
        resolvedToday: resolvedTodayTickets,
        averageResolutionTime: avgResolutionTime,
        topIssues,
      },
    };

    // Cache result
    cache.set(KPI_CACHE_KEY, kpiData, KPI_CACHE_TTL);

    errorLogger.logInfo('KPI dashboard consulté', {
      path: '/api/mova/analytics/kpi',
      method: 'GET',
      userId,
    });

    return NextResponse.json({ success: true, data: kpiData, cached: false });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erreur serveur';
    errorLogger.logError(error, { path: '/api/mova/analytics/kpi', method: 'GET' });
    return NextResponse.json(
      { success: false, error: `Erreur lors du chargement des KPI: ${message}` },
      { status: 500 }
    );
  }
}
