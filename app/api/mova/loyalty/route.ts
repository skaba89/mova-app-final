import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/mova/auth-middleware'
import db from '@/lib/db'
import { z } from 'zod/v4'
import { LoyaltyTier } from '@prisma/client'

// Schema de validation pour l'acquisition de points
const earnPointsSchema = z.object({
  action: z.enum(['ride_completed', 'food_ordered', 'delivery_completed', 'referral', 'daily_login', 'review']),
  relatedId: z.string().optional(),
})

// Seuils de points par action
const POINTS_PER_ACTION: Record<string, number> = {
  ride_completed: 10,
  food_ordered: 15,
  delivery_completed: 12,
  referral: 50,
  daily_login: 5,
  review: 8,
}

// Seuils de niveaux de fidelite
const TIER_THRESHOLDS = [
  { tier: 'bronze', minPoints: 0 },
  { tier: 'silver', minPoints: 500 },
  { tier: 'gold', minPoints: 2000 },
  { tier: 'platinum', minPoints: 5000 },
  { tier: 'diamond', minPoints: 15000 },
]

// Determiner le niveau de fidelite selon les points
function determineTier(points: number): LoyaltyTier {
  let currentTier: LoyaltyTier = 'bronze'
  for (const { tier, minPoints } of TIER_THRESHOLDS) {
    if (points >= minPoints) {
      currentTier = tier as LoyaltyTier
    }
  }
  return currentTier
}

// Verifier et mettre a jour la serie d'activite (streak)
function calculateStreak(lastActivityDate: Date | null): number {
  if (!lastActivityDate) return 1

  const now = new Date()
  const last = new Date(lastActivityDate)

  // Meme jour
  if (
    now.getFullYear() === last.getFullYear() &&
    now.getMonth() === last.getMonth() &&
    now.getDate() === last.getDate()
  ) {
    return -1 // Pas de changement, meme jour
  }

  // Hier
  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  if (
    yesterday.getFullYear() === last.getFullYear() &&
    yesterday.getMonth() === last.getMonth() &&
    yesterday.getDate() === last.getDate()
  ) {
    return 0 // Incrementer
  }

  // Plus d'un jour, reinitialiser
  return 1
}

// GET /api/mova/loyalty - Obtenir le profil de fidelite et les transactions
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (auth instanceof NextResponse) return auth

    const { searchParams } = new URL(request.url)
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') ?? '20', 10)))
    const skip = (page - 1) * limit

    // Recuperer ou creer le profil de fidelite
    let profile = await db.loyaltyProfile.findUnique({
      where: { userId: auth.id },
    })

    if (!profile) {
      profile = await db.loyaltyProfile.create({
        data: {
          userId: auth.id,
          points: 0,
          tier: 'bronze',
          streakDays: 0,
        },
      })
    }

    // Recuperer les transactions de fidelite
    const [transactions, total] = await Promise.all([
      db.loyaltyTransaction.findMany({
        where: { loyaltyProfileId: profile.id },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      db.loyaltyTransaction.count({
        where: { loyaltyProfileId: profile.id },
      }),
    ])

    // Prochain niveau
    const currentTierIndex = TIER_THRESHOLDS.findIndex((t) => t.tier === profile.tier)
    const nextTier = TIER_THRESHOLDS[currentTierIndex + 1]
    const pointsToNextTier = nextTier ? nextTier.minPoints - profile.points : 0

    return NextResponse.json({
      success: true,
      data: {
        profile: {
          id: profile.id,
          points: profile.points,
          tier: profile.tier,
          streakDays: profile.streakDays,
          totalEarned: profile.totalEarned,
          totalRedeemed: profile.totalRedeemed,
          lastActivityDate: profile.lastActivityDate,
          nextTier: nextTier ? nextTier.tier : null,
          pointsToNextTier: Math.max(0, pointsToNextTier),
        },
        transactions,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    })
  } catch (error) {
    console.error('[LOYALTY] Erreur lors de la recuperation du profil:', error)
    return NextResponse.json(
      { success: false, error: 'Erreur interne du serveur' },
      { status: 500 }
    )
  }
}

// POST /api/mova/loyalty - Acquerir des points de fidelite
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (auth instanceof NextResponse) return auth

    const body = await request.json()
    const parsed = earnPointsSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues[0].message },
        { status: 400 }
      )
    }

    const { action, relatedId } = parsed.data
    const pointsToEarn = POINTS_PER_ACTION[action]

    if (!pointsToEarn) {
      return NextResponse.json(
        { success: false, error: 'Action non reconnue pour l\'acquisition de points' },
        { status: 400 }
      )
    }

    // Utiliser une transaction Prisma pour eviter les courses
    const result = await db.$transaction(async (tx) => {
      // Recuperer ou creer le profil
      let profile = await tx.loyaltyProfile.findUnique({
        where: { userId: auth.id },
      })

      if (!profile) {
        profile = await tx.loyaltyProfile.create({
          data: {
            userId: auth.id,
            points: 0,
            tier: 'bronze',
            streakDays: 0,
          },
        })
      }

      // Verifier le streak et la deduplication
      let newStreakDays = profile.streakDays
      if (action === 'daily_login') {
        const streakResult = calculateStreak(profile.lastActivityDate)
        if (streakResult === -1) {
          // Meme jour : pas de double attribution
          return NextResponse.json(
            { success: false, error: "Bonus de connexion journaliere deja recu aujourd'hui" },
            { status: 400 }
          )
        } else if (streakResult === 0) {
          newStreakDays = profile.streakDays + 1
        } else if (streakResult === 1) {
          newStreakDays = 1
        }
      }

      // Verifier la deduplication pour les actions avec relatedId
      if (relatedId) {
        const existingTx = await tx.loyaltyTransaction.findFirst({
          where: {
            loyaltyProfileId: profile.id,
            type: 'earn',
            description: `Points gagnes : ${action}`,
            relatedId,
          },
        })
        if (existingTx) {
          return NextResponse.json(
            { success: false, error: 'Points deja attribues pour cette action' },
            { status: 400 }
          )
        }
      }

      // Calculer les nouveaux points
      const newPoints = profile.points + pointsToEarn
      const newTier = determineTier(newPoints)

      // Mettre a jour le profil
      const updatedProfile = await tx.loyaltyProfile.update({
        where: { id: profile.id },
        data: {
          points: newPoints,
          tier: newTier,
          streakDays: newStreakDays,
          lastActivityDate: new Date(),
          totalEarned: profile.totalEarned + pointsToEarn,
        },
      })

      // Creer la transaction de fidelite
      const transaction = await tx.loyaltyTransaction.create({
        data: {
          loyaltyProfileId: profile.id,
          type: 'earn',
          points: pointsToEarn,
          description: `Points gagnes : ${action}`,
          relatedId: relatedId ?? null,
        },
      })

      return { updatedProfile, transaction }
    })

    return NextResponse.json({
      success: true,
      data: {
        message: `+${pointsToEarn} points gagnes`,
        points: result.updatedProfile.points,
        tier: result.updatedProfile.tier,
        streakDays: result.updatedProfile.streakDays,
        transaction: {
          id: result.transaction.id,
          type: result.transaction.type,
          points: result.transaction.points,
          createdAt: result.transaction.createdAt,
        },
      },
    })
  } catch (error) {
    console.error('[LOYALTY] Erreur lors de l\'acquisition de points:', error)
    return NextResponse.json(
      { success: false, error: 'Erreur interne du serveur' },
      { status: 500 }
    )
  }
}
