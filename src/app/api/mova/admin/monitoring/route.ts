import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { cache } from '@/lib/cache';
import { rateLimiter } from '@/lib/rate-limit-advanced';
import { jobQueue } from '@/lib/job-queue';
import { errorLogger } from '@/lib/error-logger';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    // ── Admin authorization check ────────────────────────────────
    const userRole = request.headers.get('x-user-role');
    if (userRole !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'Accès refusé. Droits administrateur requis.' },
        { status: 403 }
      );
    }

    const startTime = Date.now();

    // ── 1. System info ────────────────────────────────────────────
    const memUsage = process.memoryUsage();
    const system = {
      uptime: Math.floor(process.uptime()),
      memory: {
        usedMB: Math.round((memUsage.heapUsed / 1024 / 1024) * 100) / 100,
        totalMB: Math.round((memUsage.heapTotal / 1024 / 1024) * 100) / 100,
        rssMB: Math.round((memUsage.rss / 1024 / 1024) * 100) / 100,
      },
      nodeVersion: process.version,
      platform: process.platform,
      pid: process.pid,
    };

    // ── 2. Database stats (parallel queries) ──────────────────────
    let database = {
      status: 'up' as string,
      totalUsers: 0,
      totalRides: 0,
      totalWallets: 0,
      totalTransactions: 0,
      totalDeliveries: 0,
      totalBookings: 0,
      totalIncidents: 0,
    };

    try {
      const [
        userCount,
        rideCount,
        walletCount,
        transactionCount,
        deliveryCount,
        bookingCount,
        incidentCount,
      ] = await Promise.all([
        db.user.count(),
        db.ride.count(),
        db.wallet.count(),
        db.walletTransaction.count(),
        db.delivery.count(),
        db.booking.count(),
        db.incident.count(),
      ]);

      database = {
        status: 'up',
        totalUsers: userCount,
        totalRides: rideCount,
        totalWallets: walletCount,
        totalTransactions: transactionCount,
        totalDeliveries: deliveryCount,
        totalBookings: bookingCount,
        totalIncidents: incidentCount,
      };
    } catch {
      database.status = 'down';
    }

    // ── 3. Cache stats ────────────────────────────────────────────
    let cacheData = {
      keys: 0,
      hits: 0,
      misses: 0,
      hitRate: '0.0%',
      topKeys: [] as string[],
    };

    try {
      const stats = await cache.stats();
      const allKeys = await cache.keys('*');
      cacheData = {
        keys: (stats as any).keys ?? 0,
        hits: (stats as any).hits ?? 0,
        misses: (stats as any).misses ?? 0,
        hitRate: (stats as any).hitRate ?? '0.0%',
        topKeys: (allKeys || []).slice(0, 20),
      };
    } catch {
      // Cache unavailable
    }

    // ── 4. Rate limiter stats ─────────────────────────────────────
    let rateLimitData = {
      totalChecks: 0,
      totalBlocked: 0,
      activeLimits: 0,
      totalBanned: 0,
      topViolators: [] as Array<{ identifier: string; violations: number; banCount: number }>,
    };

    try {
      const stats = rateLimiter.getStats();
      rateLimitData = { ...stats };
    } catch {
      // Rate limiter unavailable
    }

    // ── 5. Job queue stats ────────────────────────────────────────
    let jobQueueData = {
      stats: { pending: 0, processing: 0, completed: 0, failed: 0, total: 0 },
      recentFailed: [] as Array<{ id: string; type: string; error: string | null; createdAt: number }>,
      processing: [] as Array<{ id: string; type: string; attempts: number }>,
    };

    try {
      const stats = jobQueue.getQueueStats();
      const failedJobs = jobQueue.getFailedJobs();
      const processingJobs = jobQueue.getAllJobs({ status: 'processing' });

      jobQueueData = {
        stats,
        recentFailed: failedJobs.slice(0, 10).map((j) => ({
          id: j.id,
          type: j.type,
          error: j.error,
          createdAt: j.createdAt,
        })),
        processing: processingJobs.slice(0, 10).map((j) => ({
          id: j.id,
          type: j.type,
          attempts: j.attempts,
        })),
      };
    } catch {
      // Job queue unavailable
    }

    // ── 6. API error logs ─────────────────────────────────────────
    const recentErrors = errorLogger.getErrors(20);
    const errorLogEntries = recentErrors.map((e) => ({
      id: e.id,
      level: e.level,
      message: e.message,
      path: e.path,
      method: e.method,
      userId: e.userId,
      timestamp: e.timestamp,
      context: e.context,
    }));

    // Slow endpoints — derived from cache keys that store response times
    // We look for keys matching pattern 'resp:*' if they exist
    let slowEndpoints: Array<{ path: string; method: string; avgMs: number; calls: number }> = [];
    try {
      const responseTimeKeys = await cache.keys('resp:*');
      if (responseTimeKeys && responseTimeKeys.length > 0) {
        const entries = await Promise.all(
          responseTimeKeys.map(async (key) => {
            const data = await cache.get<{ path: string; method: string; totalMs: number; calls: number }>(key);
            if (!data || data.calls === 0) return null;
            return {
              path: data.path,
              method: data.method,
              avgMs: Math.round((data.totalMs / data.calls) * 100) / 100,
              calls: data.calls,
            };
          })
        );
        slowEndpoints = entries
          .filter((e): e is NonNullable<typeof e> => e !== null)
          .sort((a, b) => b.avgMs - a.avgMs)
          .slice(0, 10);
      }
    } catch {
      // No response time tracking data
    }

    // ── 7. Notification stats ─────────────────────────────────────
    let notifications = {
      sent: 0,
      failed: 0,
      subscribed: 0,
    };

    try {
      const [totalNotifications, totalUsers] = await Promise.all([
        db.appNotification.count(),
        db.user.count(),
      ]);

      notifications = {
        sent: totalNotifications,
        failed: 0,
        subscribed: totalUsers,
      };
    } catch {
      // Notification stats unavailable
    }

    // ── 8. Error logger stats ─────────────────────────────────────
    const loggerStats = errorLogger.getStats();

    // ── Build response ────────────────────────────────────────────
    const response = {
      success: true,
      data: {
        system,
        database,
        cache: cacheData,
        rateLimit: rateLimitData,
        jobQueue: jobQueueData,
        api: {
          recentErrors: errorLogEntries,
          slowEndpoints,
          loggerStats,
        },
        notifications,
        generatedAt: new Date().toISOString(),
        responseTimeMs: Date.now() - startTime,
      },
    };

    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 'no-store',
        'X-Response-Time': `${Date.now() - startTime}ms`,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: 'Erreur interne du serveur lors de la récupération des données de surveillance.',
      },
      { status: 500 }
    );
  }
}
