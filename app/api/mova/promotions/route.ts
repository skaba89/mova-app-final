import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/mova/auth-middleware'
import db from '@/lib/db'
import { z } from 'zod/v4'

// Schema de validation pour l'echange d'un code promotionnel
const redeemPromoSchema = z.object({
  code: z.string().min(1, 'Le code promotionnel est requis'),
})

// Utilitaire de conversion Decimal vers Number
function num(value: unknown): number {
  if (value === null || value === undefined) return 0
  return Number(value)
}

// GET /api/mova/promotions - Lister les promotions actives (public)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') ?? '20', 10)))
    const skip = (page - 1) * limit

    const now = new Date()

    const [promotions, total] = await Promise.all([
      db.promotion.findMany({
        where: {
          status: 'active',
          validFrom: { lte: now },
          validUntil: { gte: now },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      db.promotion.count({
        where: {
          status: 'active',
          validFrom: { lte: now },
          validUntil: { gte: now },
        },
      }),
    ])

    const convertedPromotions = promotions.map((p) => ({
      ...p,
      discountValue: num(p.discountValue),
      minAmount: num(p.minAmount),
      maxDiscount: num(p.maxDiscount),
    }))

    return NextResponse.json({
      success: true,
      data: {
        promotions: convertedPromotions,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    })
  } catch (error) {
    console.error('[PROMOTIONS] Erreur lors de la recuperation:', error)
    return NextResponse.json(
      { success: false, error: 'Erreur interne du serveur' },
      { status: 500 }
    )
  }
}

// POST /api/mova/promotions - Echanger un code promotionnel
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (auth instanceof NextResponse) return auth

    const body = await request.json()
    const parsed = redeemPromoSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues[0].message },
        { status: 400 }
      )
    }

    const { code } = parsed.data
    const normalizedCode = code.trim().toUpperCase()

    // Verifier que la promotion existe et est active
    const promotion = await db.promotion.findUnique({
      where: { code: normalizedCode },
    })

    if (!promotion) {
      return NextResponse.json(
        { success: false, error: 'Code promotionnel invalide' },
        { status: 404 }
      )
    }

    const now = new Date()

    if (promotion.status !== 'active') {
      return NextResponse.json(
        { success: false, error: 'Cette promotion est inactive' },
        { status: 400 }
      )
    }

    if (promotion.validFrom > now || promotion.validUntil < now) {
      return NextResponse.json(
        { success: false, error: 'Cette promotion est expiree ou pas encore valide' },
        { status: 400 }
      )
    }

    if (promotion.usageCount >= promotion.usageLimit) {
      return NextResponse.json(
        { success: false, error: 'Cette promotion a atteint sa limite d\'utilisation' },
        { status: 400 }
      )
    }

    // Verifier que l'utilisateur n'a pas deja utilise cette promotion
    const existingUsage = await db.userPromotion.findUnique({
      where: {
        userId_promotionId: {
          userId: auth.id,
          promotionId: promotion.id,
        },
      },
    })

    if (existingUsage) {
      return NextResponse.json(
        { success: false, error: 'Vous avez deja utilise cette promotion' },
        { status: 400 }
      )
    }

    // Creer l'utilisation de la promotion et incrementer le compteur
    const result = await db.$transaction(async (tx) => {
      // Verifier a nouveau la limite (eviter les courses)
      const freshPromo = await tx.promotion.findUnique({
        where: { id: promotion.id },
      })

      if (!freshPromo || freshPromo.usageCount >= freshPromo.usageLimit) {
        throw new Error('Limite d\'utilisation atteinte')
      }

      // Creer l'enregistrement utilisateur-promotion
      const userPromotion = await tx.userPromotion.create({
        data: {
          userId: auth.id,
          promotionId: promotion.id,
        },
      })

      // Incrementer le compteur d'utilisation
      await tx.promotion.update({
        where: { id: promotion.id },
        data: { usageCount: { increment: 1 } },
      })

      return { userPromotion }
    })

    // Calculer les economies selon le type
    let savings = 0
    const discountValue = num(promotion.discountValue)

    if (promotion.type === 'percentage') {
      // Pourcentage applique sur le montant reel (pas sur minAmount)
      // Le montant reel sera determine lors du paiement
      savings = discountValue // Pourcentage
    } else if (promotion.type === 'fixed') {
      savings = discountValue
    } else if (promotion.type === 'free_delivery') {
      savings = 0 // Livraison gratuite, pas d'economie directe
    } else if (promotion.type === 'free_ride') {
      savings = 0 // Course gratuite
    }

    return NextResponse.json({
      success: true,
      data: {
        message: 'Promotion appliquee avec succes',
        promotion: {
          id: promotion.id,
          code: promotion.code,
          title: promotion.title,
          type: promotion.type,
          discountValue,
          minAmount: num(promotion.minAmount),
          maxDiscount: num(promotion.maxDiscount),
          savings,
        },
      },
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Limite')) {
      return NextResponse.json(
        { success: false, error: 'Cette promotion a atteint sa limite d\'utilisation' },
        { status: 400 }
      )
    }
    console.error('[PROMOTIONS] Erreur lors de l\'echange:', error)
    return NextResponse.json(
      { success: false, error: 'Erreur interne du serveur' },
      { status: 500 }
    )
  }
}
