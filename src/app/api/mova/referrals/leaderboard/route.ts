export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/mova/referrals/leaderboard
export async function GET() {
  try {
    // Get all referrers with their referral counts and totals
    const referrers = await db.referral.groupBy({
      by: ['referrerId'],
      _count: {
        id: true,
      },
      _sum: {
        bonusAmount: true,
      },
      orderBy: {
        _count: { id: 'desc' },
      },
      take: 10,
    });

    // Fetch user details for each referrer
    const leaderboard = await Promise.all(
      referrers.map(async (r, index) => {
        const user = await db.user.findUnique({
          where: { id: r.referrerId },
          select: { id: true, name: true, phone: true, avatar: true, createdAt: true },
        });

        const paidTotal = await db.referral.aggregate({
          where: { referrerId: r.referrerId, isPaid: true },
          _sum: { bonusAmount: true },
        });

        return {
          rank: index + 1,
          user: user
            ? {
                id: user.id,
                name: user.name,
                phone: user.phone,
                avatar: user.avatar,
                memberSince: user.createdAt,
              }
            : null,
          totalReferred: r._count.id,
          totalEarned: Number(r._sum.bonusAmount || 0),
          totalPaid: Number(paidTotal._sum.bonusAmount || 0),
          referralCode: user ? `MOVA-${user.id.substring(0, 6).toUpperCase()}` : null,
        };
      })
    );

    return NextResponse.json({
      success: true,
      data: leaderboard,
      count: leaderboard.length,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erreur serveur';
    return NextResponse.json(
      { success: false, error: `Erreur lors de la récupération du classement: ${message}` },
      { status: 500 }
    );
  }
}
