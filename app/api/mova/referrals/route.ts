import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/mova/auth-middleware'
import db from '@/lib/db'
import { z } from 'zod/v4'

// Schema de validation pour l'application d'un code de parrainage
const applyReferralSchema = z.object({
  code: z.string().min(1, 'Le code de parrainage est requis'),
})

// Utilitaire de conversion Decimal vers Number
function num(value: unknown): number {
  if (value === null || value === undefined) return 0
  return Number(value)
}

// Bonus de parrainage (en GNF)
const REFERRAL_BONUS = 5000

// GET /api/mova/referrals - Obtenir le code de parrainage et la liste des filleuls
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (auth instanceof NextResponse) return auth

    // Generer un code de parrainage base sur l'ID utilisateur
    const referralCode = `MOVA-${auth.id.substring(0, 8).toUpperCase()}`

    // Recuperer les parrainages effectues par l'utilisateur
    const referrals = await db.referral.findMany({
      where: { referrerId: auth.id },
      include: {
        referred: {
          select: {
            id: true,
            name: true,
            avatar: true,
            createdAt: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    // Statistiques
    const totalReferrals = referrals.length
    const completedReferrals = referrals.filter((r) => r.status === 'completed' || r.status === 'rewarded').length
    const totalEarnings = referrals
      .filter((r) => r.status === 'rewarded')
      .reduce((sum, r) => sum + num(r.bonusAmount), 0)

    return NextResponse.json({
      success: true,
      data: {
        referralCode,
        stats: {
          total: totalReferrals,
          completed: completedReferrals,
          totalEarnings,
        },
        referrals: referrals.map((r) => ({
          id: r.id,
          code: r.code,
          status: r.status,
          bonusAmount: num(r.bonusAmount),
          rewardedAt: r.rewardedAt,
          createdAt: r.createdAt,
          referred: {
            id: r.referred.id,
            name: r.referred.name,
            avatar: r.referred.avatar,
            joinedAt: r.referred.createdAt,
          },
        })),
      },
    })
  } catch (error) {
    console.error('[REFERRALS] Erreur lors de la recuperation:', error)
    return NextResponse.json(
      { success: false, error: 'Erreur interne du serveur' },
      { status: 500 }
    )
  }
}

// POST /api/mova/referrals - Appliquer un code de parrainage
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (auth instanceof NextResponse) return auth

    const body = await request.json()
    const parsed = applyReferralSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues[0].message },
        { status: 400 }
      )
    }

    const { code } = parsed.data
    const normalizedCode = code.trim().toUpperCase()

    // Verifier que l'utilisateur n'a pas deja ete parraine
    const existingReferral = await db.referral.findUnique({
      where: { referredId: auth.id },
    })

    if (existingReferral) {
      return NextResponse.json(
        { success: false, error: 'Vous avez deja utilise un code de parrainage' },
        { status: 400 }
      )
    }

    // Verifier que l'utilisateur ne peut pas se parrainer lui-meme
    const userReferralCode = `MOVA-${auth.id.substring(0, 8).toUpperCase()}`
    if (normalizedCode === userReferralCode) {
      return NextResponse.json(
        { success: false, error: 'Vous ne pouvez pas utiliser votre propre code de parrainage' },
        { status: 400 }
      )
    }

    // Trouver le code de parrainage (recherche exacte)
    const referralRecord = await db.referral.findFirst({
      where: { code: normalizedCode },
    })

    if (!referralRecord) {
      // Essayer de trouver un utilisateur dont le code genere correspond
      // Le code est au format MOVA-XXXXXXXX (8 premiers caracteres de l'ID)
      if (normalizedCode.startsWith('MOVA-')) {
        const potentialIdPart = normalizedCode.substring(5).toLowerCase()
        const potentialReferrer = await db.user.findFirst({
          where: {
            id: { startsWith: potentialIdPart },
          },
        })

        if (potentialReferrer) {
          // Creer le parrainage
          const referral = await db.referral.create({
            data: {
              referrerId: potentialReferrer.id,
              referredId: auth.id,
              code: normalizedCode,
              status: 'pending',
              bonusAmount: REFERRAL_BONUS,
            },
          })

          return NextResponse.json({
            success: true,
            data: {
              message: 'Code de parrainage applique avec succes',
              referral: {
                id: referral.id,
                status: referral.status,
                bonusAmount: num(referral.bonusAmount),
              },
            },
          })
        }
      }

      return NextResponse.json(
        { success: false, error: 'Code de parrainage invalide' },
        { status: 404 }
      )
    }

    // Verifier que le parrain n'est pas l'utilisateur lui-meme
    if (referralRecord.referrerId === auth.id) {
      return NextResponse.json(
        { success: false, error: 'Vous ne pouvez pas utiliser votre propre code de parrainage' },
        { status: 400 }
      )
    }

    // Verifier qu'un autre utilisateur n'a pas deja ete parraine avec ce code
    // (le code peut etre utilise par plusieurs filleuls differents)
    if (referralRecord.referredId !== auth.id) {
      return NextResponse.json(
        { success: false, error: 'Ce code de parrainage a deja ete utilise' },
        { status: 400 }
      )
    }
  } catch (error) {
    console.error('[REFERRALS] Erreur lors de l\'application:', error)
    return NextResponse.json(
      { success: false, error: 'Erreur interne du serveur' },
      { status: 500 }
    )
  }
}
