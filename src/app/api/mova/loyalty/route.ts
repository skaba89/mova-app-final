export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type LoyaltyTier = 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond';

interface TierConfig {
  name: string
  minPoints: number
  maxPoints: number
  cashbackMultiplier: number
  benefits: string[]
}

interface Reward {
  id: string
  name: string
  pointsCost: number
  value: string
  description: string
  available: boolean
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TIERS: Record<LoyaltyTier, TierConfig> = {
  bronze: {
    name: 'Bronze',
    minPoints: 0,
    maxPoints: 999,
    cashbackMultiplier: 1,
    benefits: ['Cashback x1'],
  },
  silver: {
    name: 'Argent',
    minPoints: 1000,
    maxPoints: 4999,
    cashbackMultiplier: 1.5,
    benefits: ['Cashback x1.5', 'Matching prioritaire'],
  },
  gold: {
    name: 'Or',
    minPoints: 5000,
    maxPoints: 14999,
    cashbackMultiplier: 2,
    benefits: ['Cashback x2', 'Annulation gratuite', 'Matching prioritaire'],
  },
  platinum: {
    name: 'Platine',
    minPoints: 15000,
    maxPoints: 49999,
    cashbackMultiplier: 3,
    benefits: ['Cashback x3', 'Annulation gratuite', 'Matching prioritaire', 'Support dedie'],
  },
  diamond: {
    name: 'Diamant',
    minPoints: 50000,
    maxPoints: Infinity,
    cashbackMultiplier: 5,
    benefits: ['Cashback x5', 'Annulation gratuite', 'Matching prioritaire', 'Support dedie', 'Course mensuelle gratuite'],
  },
};

const TIER_ORDER: LoyaltyTier[] = ['bronze', 'silver', 'gold', 'platinum', 'diamond'];

const ACTION_POINTS: Record<string, number> = {
  ride_completed: 10,     // per 1000 GNF
  referral_made: 500,
  review_given: 50,
  streak_bonus: 200,
};

const REWARDS: Reward[] = [
  { id: 'r1', name: 'Reduction 2,500 GNF', pointsCost: 500, value: '2,500 GNF', description: 'Reduction sur votre prochaine course', available: true },
  { id: 'r2', name: 'Reduction 5,000 GNF', pointsCost: 1000, value: '5,000 GNF', description: 'Reduction sur votre prochaine course', available: true },
  { id: 'r3', name: 'Course gratuite (8,000 GNF)', pointsCost: 2000, value: '8,000 GNF', description: 'Course gratuite jusqu\'a 8,000 GNF', available: true },
  { id: 'r4', name: 'Pass Journee 15,000 GNF', pointsCost: 5000, value: '15,000 GNF', description: '3 courses gratuites dans la meme journee', available: true },
  { id: 'r5', name: 'Premium 1 mois', pointsCost: 10000, value: 'Premium', description: 'Statut Gold pendant 30 jours', available: true },
  { id: 'r6', name: 'Course mensuelle gratuite', pointsCost: 8000, value: 'Gratuite', description: '1 course offerte par mois pendant 3 mois', available: false },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getTierForPoints(points: number): LoyaltyTier {
  if (points >= 50000) return 'diamond';
  if (points >= 15000) return 'platinum';
  if (points >= 5000) return 'gold';
  if (points >= 1000) return 'silver';
  return 'bronze';
}

function getNextTier(currentTier: LoyaltyTier): LoyaltyTier | null {
  const idx = TIER_ORDER.indexOf(currentTier);
  return idx < TIER_ORDER.length - 1 ? TIER_ORDER[idx + 1] : null;
}

/** Find or create a loyalty profile for the given user */
async function getOrCreateProfile(userId: string) {
  let profile = await db.loyaltyProfile.findFirst({ where: { userId } });
  if (!profile) {
    profile = await db.loyaltyProfile.create({
      data: {
        userId,
        points: 0,
        tier: 'bronze',
        streak: 0,
        lastRideDate: null,
        totalEarned: 0,
        totalSpent: 0,
      },
    });
  }
  return profile;
}

// ---------------------------------------------------------------------------
// POST — Earn/spend points
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, action, rideAmount } = body as {
      userId?: string
      action?: string
      rideAmount?: number
    };

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'L\'identifiant utilisateur est requis' },
        { status: 400 }
      );
    }

    if (!action || !ACTION_POINTS[action]) {
      return NextResponse.json(
        { success: false, error: `Action invalide. Actions possibles : ${Object.keys(ACTION_POINTS).join(', ')}` },
        { status: 400 }
      );
    }

    const profile = await getOrCreateProfile(userId);
    const currentTier = profile.tier as LoyaltyTier;

    // Calculate points for this action
    let pointsEarned = ACTION_POINTS[action];
    let description = '';
    let streak = profile.streak;
    let lastRideDate = profile.lastRideDate;

    switch (action) {
      case 'ride_completed': {
        if (!rideAmount || rideAmount <= 0) {
          return NextResponse.json(
            { success: false, error: 'Le montant de la course est requis pour l\'action ride_completed' },
            { status: 400 }
          );
        }
        // 10 pts per 1000 GNF spent on ride
        pointsEarned = Math.floor((rideAmount / 1000) * ACTION_POINTS.ride_completed);
        if (pointsEarned <= 0) pointsEarned = 5; // minimum 5 pts
        description = `Course terminee (${(rideAmount / 1000).toFixed(0)}k GNF)`;

        // Update streak
        const today = new Date().toISOString().split('T')[0];
        const lastRide = profile.lastRideDate;
        if (lastRide) {
          const lastDate = new Date(lastRide);
          const todayDate = new Date(today);
          const diffDays = Math.floor((todayDate.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
          if (diffDays === 1) {
            streak += 1;
          } else if (diffDays > 1) {
            streak = 1;
          }
          // diffDays === 0 means same day, keep streak as-is
        } else {
          streak = 1;
        }
        lastRideDate = today;
        break;
      }
      case 'referral_made':
        description = 'Bonus parrainage ami inscrit';
        break;
      case 'review_given':
        description = 'Avis laisse sur une course';
        break;
      default:
        description = `Action: ${action}`;
    }

    // Apply tier cashback multiplier
    const tierConfig = TIERS[currentTier];
    const bonusMultiplier = tierConfig.cashbackMultiplier;
    const bonusPoints = Math.floor(pointsEarned * (bonusMultiplier - 1));
    const totalPoints = pointsEarned + bonusPoints;

    // Create main transaction in database
    const mainTx = await db.loyaltyTransaction.create({
      data: {
        profileId: profile.id,
        type: action === 'ride_completed' ? 'earned' : 'bonus',
        points: totalPoints,
        description,
      },
    });

    // New totals after main transaction
    const newPoints = profile.points + totalPoints;
    const newTotalEarned = profile.totalEarned + totalPoints;

    // Create streak bonus transaction if applicable (every 5 consecutive days)
    let streakBonusPoints = 0;
    let streakTx: { id: string; createdAt: Date; type: string; description: string; points: number; profileId: string } | null = null;
    if (action === 'ride_completed' && streak > 0 && streak % 5 === 0) {
      streakBonusPoints = ACTION_POINTS.streak_bonus;
      streakTx = await db.loyaltyTransaction.create({
        data: {
          profileId: profile.id,
          type: 'bonus',
          points: streakBonusPoints,
          description: `Bonus serie ${streak} courses`,
        },
      });
    }

    const finalPoints = newPoints + streakBonusPoints;
    const finalTotalEarned = newTotalEarned + streakBonusPoints;

    // Check tier upgrade
    const oldTier = currentTier;
    const newTier = getTierForPoints(finalPoints);
    let tierUpgraded = false;
    if (TIER_ORDER.indexOf(newTier) > TIER_ORDER.indexOf(oldTier)) {
      tierUpgraded = true;
    }

    // Update profile with all changes
    await db.loyaltyProfile.update({
      where: { id: profile.id },
      data: {
        points: finalPoints,
        tier: newTier,
        streak,
        lastRideDate,
        totalEarned: finalTotalEarned,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        pointsEarned: totalPoints,
        bonusPoints,
        totalPoints: finalPoints,
        oldTier,
        newTier,
        tierUpgraded,
        tierConfig: TIERS[newTier],
        nextTier: getNextTier(newTier),
        streak,
        transaction: {
          id: mainTx.id,
          type: mainTx.type,
          points: mainTx.points,
          description: mainTx.description,
          timestamp: mainTx.createdAt.toISOString(),
        },
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erreur serveur';
    return NextResponse.json(
      { success: false, error: `Erreur lors du traitement de la fidélité: ${message}` },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// GET — Retrieve loyalty profile
// ---------------------------------------------------------------------------

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

    const profile = await getOrCreateProfile(userId);
    const tierConfig = TIERS[profile.tier as LoyaltyTier];
    const nextTier = getNextTier(profile.tier as LoyaltyTier);
    const nextTierConfig = nextTier ? TIERS[nextTier] : null;

    // Calculate progress to next tier
    let progressPercent = 100;
    let pointsToNext = 0;

    if (nextTierConfig) {
      const rangeStart = tierConfig.minPoints;
      const rangeEnd = nextTierConfig.minPoints;
      const rangeTotal = rangeEnd - rangeStart;
      const currentInRange = profile.points - rangeStart;
      progressPercent = Math.min(Math.round((currentInRange / rangeTotal) * 100), 100);
      pointsToNext = rangeEnd - profile.points;
    }

    // Fetch recent transactions from database
    const recentDbTransactions = await db.loyaltyTransaction.findMany({
      where: { profileId: profile.id },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    const recentTransactions = recentDbTransactions.map((tx) => ({
      id: tx.id,
      type: tx.type,
      points: tx.points,
      description: tx.description,
      timestamp: tx.createdAt.toISOString(),
    }));

    return NextResponse.json({
      success: true,
      data: {
        points: profile.points,
        tier: profile.tier,
        tierName: tierConfig.name,
        cashbackMultiplier: tierConfig.cashbackMultiplier,
        benefits: tierConfig.benefits,
        nextTier: nextTier ? {
          tier: nextTier,
          name: nextTierConfig!.name,
          minPoints: nextTierConfig!.minPoints,
          benefits: nextTierConfig!.benefits,
          pointsToNext,
        } : null,
        progressPercent,
        streak: profile.streak,
        totalEarned: profile.totalEarned,
        totalSpent: profile.totalSpent,
        recentTransactions,
        rewards: REWARDS,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erreur serveur';
    return NextResponse.json(
      { success: false, error: `Erreur lors de la récupération du profil fidélité: ${message}` },
      { status: 500 }
    );
  }
}
