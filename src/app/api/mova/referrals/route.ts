export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/mova/referrals?userId=xxx
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'L\'identifiant utilisateur est requis' },
        { status: 400 }
      );
    }

    const user = await db.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, createdAt: true },
    });

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Utilisateur introuvable' },
        { status: 404 }
      );
    }

    // Generate referral code from user ID
    const referralCode = `MOVA-${user.id.substring(0, 6).toUpperCase()}`;

    // Get all referrals made by this user
    const referrals = await db.referral.findMany({
      where: { referrerId: userId },
      include: {
        referred: {
          select: { id: true, name: true, phone: true, createdAt: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const totalReferred = referrals.length;
    const earnedTotal = referrals.reduce((sum, r) => sum + Number(r.bonusAmount), 0);
    const paidTotal = referrals.filter((r) => r.isPaid).reduce((sum, r) => sum + Number(r.bonusAmount), 0);
    const pendingTotal = earnedTotal - paidTotal;

    const formattedReferrals = referrals.map((r) => ({
      id: r.id,
      referredUser: {
        id: r.referred.id,
        name: r.referred.name,
        phone: r.referred.phone,
      },
      bonusAmount: r.bonusAmount,
      isPaid: r.isPaid,
      referredAt: r.createdAt,
    }));

    return NextResponse.json({
      success: true,
      data: {
        user: {
          id: user.id,
          name: user.name,
          memberSince: user.createdAt,
        },
        referralCode,
        stats: {
          totalReferred,
          earnedTotal,
          paidTotal,
          pendingTotal,
          currency: 'GNF',
        },
        referrals: formattedReferrals,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erreur serveur';
    return NextResponse.json(
      { success: false, error: `Erreur lors de la récupération du parrainage: ${message}` },
      { status: 500 }
    );
  }
}

// POST /api/mova/referrals
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { referrerId, code } = body;

    if (!referrerId || !code) {
      return NextResponse.json(
        { success: false, error: 'L\'identifiant du parrain et le code de parrainage sont requis' },
        { status: 400 }
      );
    }

    if (referrerId === code) {
      return NextResponse.json(
        { success: false, error: 'Vous ne pouvez pas utiliser votre propre code de parrainage' },
        { status: 400 }
      );
    }

    // Find the referrer from the code
    const expectedPrefix = 'MOVA-';
    const codeUserId = code.startsWith(expectedPrefix) ? code.substring(expectedPrefix.length) : code;

    // Try to find user by matching code to ID prefix
    const referrer = await db.user.findFirst({
      where: {
        id: { startsWith: codeUserId.toLowerCase() },
        role: { in: ['passenger', 'driver'] },
      },
      select: { id: true, name: true },
    });

    if (!referrer) {
      return NextResponse.json(
        { success: false, error: 'Code de parrainage invalide' },
        { status: 404 }
      );
    }

    // Check if already referred by someone
    const existingReferral = await db.referral.findUnique({
      where: { referredId: referrerId },
    });

    if (existingReferral) {
      return NextResponse.json(
        { success: false, error: 'Vous avez déjà été parrainé par quelqu\'un' },
        { status: 400 }
      );
    }

    // Create referral
    const bonusAmount = 5000; // Default referral bonus in GNF
    const referral = await db.referral.create({
      data: {
        referrerId: referrer.id,
        referredId: referrerId,
        code,
        bonusAmount,
      },
      include: {
        referrer: {
          select: { id: true, name: true },
        },
        referred: {
          select: { id: true, name: true },
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        referralId: referral.id,
        code: referral.code,
        referrer: referral.referrer,
        bonusAmount: referral.bonusAmount,
        currency: 'GNF',
        isPaid: referral.isPaid,
        message: `Bienvenue ! Vous avez été parrainé avec succès. Un bonus de ${bonusAmount.toLocaleString('fr-GN')} GNF sera crédité.`,
        createdAt: referral.createdAt,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erreur serveur';
    return NextResponse.json(
      { success: false, error: `Erreur lors du parrainage: ${message}` },
      { status: 500 }
    );
  }
}
