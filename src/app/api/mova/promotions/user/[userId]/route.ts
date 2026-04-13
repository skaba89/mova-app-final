export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/mova/promotions/user/[userId]
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params;

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'L\'identifiant utilisateur est requis' },
        { status: 400 }
      );
    }

    const redemptions = await db.redemption.findMany({
      where: { userId },
      include: {
        promotion: {
          select: {
            id: true,
            code: true,
            description: true,
            discountType: true,
            discountValue: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const totalSavings = redemptions.reduce((sum, r) => sum + Number(r.savings), 0);

    const formatted = redemptions.map((r) => ({
      id: r.id,
      code: r.code,
      promotion: r.promotion,
      savings: r.savings,
      redeemedAt: r.createdAt,
    }));

    return NextResponse.json({
      success: true,
      data: {
        redemptions: formatted,
        totalRedemptions: formatted.length,
        totalSavings,
        currency: 'GNF',
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erreur serveur';
    return NextResponse.json(
      { success: false, error: `Erreur lors de la récupération de l'historique: ${message}` },
      { status: 500 }
    );
  }
}
