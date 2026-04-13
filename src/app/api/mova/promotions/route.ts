export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/mova/promotions?active=true
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const activeOnly = searchParams.get('active');

    const where: Record<string, unknown> = {};

    if (activeOnly === 'true') {
      where.isActive = true;
    }

    const promotions = await db.promotion.findMany({
      where,
      include: {
        _count: {
          select: { redemptions: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const formatted = promotions.map((p) => ({
      id: p.id,
      code: p.code,
      description: p.description,
      discountType: p.discountType,
      discountValue: p.discountValue,
      minAmount: p.minAmount,
      maxDiscount: p.maxDiscount,
      usageLimit: p.usageLimit,
      usageCount: p.usageCount,
      remainingUses: p.usageLimit ? p.usageLimit - p.usageCount : null,
      startDate: p.startDate,
      endDate: p.endDate,
      isActive: p.isActive,
      totalRedemptions: p._count.redemptions,
      createdAt: p.createdAt,
    }));

    return NextResponse.json({
      success: true,
      data: formatted,
      count: formatted.length,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erreur serveur';
    return NextResponse.json(
      { success: false, error: `Erreur lors de la récupération des promotions: ${message}` },
      { status: 500 }
    );
  }
}

// POST /api/mova/promotions/redeem
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { code, userId, amount } = body;

    if (!code || !userId) {
      return NextResponse.json(
        { success: false, error: 'Le code promo et l\'identifiant utilisateur sont requis' },
        { status: 400 }
      );
    }

    // Find promotion by code
    const promotion = await db.promotion.findUnique({
      where: { code: code.toUpperCase() },
    });

    if (!promotion) {
      return NextResponse.json(
        { success: false, error: 'Code promotionnel invalide' },
        { status: 404 }
      );
    }

    if (!promotion.isActive) {
      return NextResponse.json(
        { success: false, error: 'Cette promotion n\'est plus active' },
        { status: 400 }
      );
    }

    const now = new Date();
    if (!promotion.startDate || !promotion.endDate || now < promotion.startDate || now > promotion.endDate) {
      return NextResponse.json(
        { success: false, error: 'Cette promotion a expiré ou n\'est pas encore commencée' },
        { status: 400 }
      );
    }

    if (promotion.usageLimit && promotion.usageCount >= promotion.usageLimit) {
      return NextResponse.json(
        { success: false, error: 'Cette promotion a atteint sa limite d\'utilisation' },
        { status: 400 }
      );
    }

    // Check if user already redeemed this promotion
    const existingRedemption = await db.redemption.findFirst({
      where: { promotionId: promotion.id, userId },
    });

    if (existingRedemption) {
      return NextResponse.json(
        { success: false, error: 'Vous avez déjà utilisé ce code promotionnel' },
        { status: 400 }
      );
    }

    // Calculate savings based on discount type
    const rideAmount = amount ? Number(amount) : Number(promotion.minAmount || 0);
    let savings: number = promotion.discountType === 'percentage'
      ? (Number(promotion.discountValue) / 100) * rideAmount
      : Number(promotion.discountValue);

    if (promotion.maxDiscount && savings > Number(promotion.maxDiscount)) {
      savings = Number(promotion.maxDiscount);
    }

    // Create redemption and increment usage
    const result = await db.$transaction([
      db.redemption.create({
        data: {
          promotionId: promotion.id,
          userId,
          code: promotion.code,
          savings,
        },
      }),
      db.promotion.update({
        where: { id: promotion.id },
        data: { usageCount: { increment: 1 } },
      }),
    ]);

    const [redemption] = result;

    return NextResponse.json({
      success: true,
      data: {
        redemptionId: redemption.id,
        code: redemption.code,
        discountType: promotion.discountType,
        discountValue: promotion.discountValue,
        savings,
        currency: 'GNF',
        message: promotion.discountType === 'percentage'
          ? `Vous avez économisé ${promotion.discountValue}% sur votre course`
          : `Vous avez économisé ${savings.toLocaleString('fr-GN')} GNF sur votre course`,
        redeemedAt: redemption.createdAt,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erreur serveur';
    return NextResponse.json(
      { success: false, error: `Erreur lors de l'échange du code: ${message}` },
      { status: 500 }
    );
  }
}
