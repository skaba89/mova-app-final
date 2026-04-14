import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, AuthError } from '@/lib/mova/auth-middleware'
import db from '@/lib/db'
import { logAction } from '@/lib/mova/audit-logger'
import { z } from 'zod/v4'

// Schema de validation pour soumettre une note
const createRatingSchema = z.object({
  targetUserId: z.string().min(1, 'L\'utilisateur cible est requis'),
  rideId: z.string().optional(),
  deliveryId: z.string().optional(),
  score: z.number().int().min(1, 'La note minimum est 1').max(5, 'La note maximum est 5'),
  comment: z.string().max(1000, 'Le commentaire ne doit pas depasser 1000 caracteres').optional(),
})

// GET /api/mova/ratings?targetUserId=xxx - Obtenir les notes d'un utilisateur
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (auth instanceof NextResponse) return auth

    const { searchParams } = new URL(request.url)
    const targetUserId = searchParams.get('targetUserId')

    if (!targetUserId) {
      return NextResponse.json(
        { success: false, error: 'Le parametre targetUserId est requis' },
        { status: 400 }
      )
    }

    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') ?? '20', 10)))
    const skip = (page - 1) * limit

    // Recuperer les notes recues par l'utilisateur cible
    const [ratings, total] = await Promise.all([
      db.rating.findMany({
        where: { toUserId: targetUserId },
        include: {
          fromUser: {
            select: {
              id: true,
              name: true,
              avatar: true,
            },
          },
          ride: {
            select: {
              id: true,
              pickupZone: true,
              dropoffZone: true,
              completedAt: true,
            },
          },
          delivery: {
            select: {
              id: true,
              pickupZone: true,
              dropoffZone: true,
              deliveredAt: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      db.rating.count({
        where: { toUserId: targetUserId },
      }),
    ])

    // Calculer les statistiques globales de l'utilisateur cible
    const allRatings = await db.rating.findMany({
      where: { toUserId: targetUserId },
      select: { score: true },
    })

    const averageScore =
      allRatings.length > 0
        ? Number(
            (
              allRatings.reduce((sum, r) => sum + r.score, 0) / allRatings.length
            ).toFixed(2)
          )
        : 0

    const scoreDistribution = [1, 2, 3, 4, 5].map((score) => ({
      score,
      count: allRatings.filter((r) => r.score === score).length,
    }))

    return NextResponse.json({
      success: true,
      data: {
        targetUserId,
        stats: {
          totalRatings: allRatings.length,
          averageScore,
          scoreDistribution,
        },
        ratings,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: error.statusCode }
      )
    }

    console.error('[RATINGS] Erreur lors de la recuperation:', error)
    return NextResponse.json(
      { success: false, error: 'Erreur interne du serveur' },
      { status: 500 }
    )
  }
}

// POST /api/mova/ratings - Soumettre une note apres une course ou livraison
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (auth instanceof NextResponse) return auth

    const body = await request.json()
    const parsed = createRatingSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues[0].message },
        { status: 400 }
      )
    }

    const { targetUserId, rideId, deliveryId, score, comment } = parsed.data

    if (!rideId && !deliveryId) {
      return NextResponse.json(
        { success: false, error: 'Vous devez fournir un rideId ou un deliveryId' },
        { status: 400 }
      )
    }

    // Verifier que l'utilisateur ne se note pas lui-meme
    if (targetUserId === auth.id) {
      return NextResponse.json(
        { success: false, error: 'Vous ne pouvez pas vous noter vous-meme' },
        { status: 400 }
      )
    }

    // Verifier que l'utilisateur cible existe
    const targetUser = await db.user.findUnique({
      where: { id: targetUserId },
      select: { id: true, name: true },
    })

    if (!targetUser) {
      return NextResponse.json(
        { success: false, error: 'Utilisateur cible non trouve' },
        { status: 404 }
      )
    }

    // Verifier la course ou la livraison et l'appartenance
    if (rideId) {
      const ride = await db.ride.findUnique({
        where: { id: rideId },
        select: {
          id: true,
          passengerId: true,
          driverProfileId: true,
          status: true,
          completedAt: true,
        },
      })

      if (!ride) {
        return NextResponse.json(
          { success: false, error: 'Course non trouvee' },
          { status: 404 }
        )
      }

      if (ride.status !== 'completed') {
        return NextResponse.json(
          { success: false, error: 'La course doit etre terminee pour pouvoir la noter' },
          { status: 400 }
        )
      }

      // Verifier que l'utilisateur est le passager ou le chauffeur
      const isPassenger = ride.passengerId === auth.id
      const isDriver = ride.driverProfileId !== null

      if (!isPassenger && !isDriver) {
        return NextResponse.json(
          { success: false, error: 'Vous n\'etes pas implique dans cette course' },
          { status: 403 }
        )
      }

      // Verifier qu'une note n'existe pas deja
      const existingRating = await db.rating.findFirst({
        where: {
          rideId,
          fromUserId: auth.id,
          toUserId: targetUserId,
        },
      })

      if (existingRating) {
        return NextResponse.json(
          { success: false, error: 'Vous avez deja note cet utilisateur pour cette course' },
          { status: 400 }
        )
      }
    } else if (deliveryId) {
      const delivery = await db.delivery.findUnique({
        where: { id: deliveryId },
        select: {
          id: true,
          customerId: true,
          courierId: true,
          status: true,
          deliveredAt: true,
        },
      })

      if (!delivery) {
        return NextResponse.json(
          { success: false, error: 'Livraison non trouvee' },
          { status: 404 }
        )
      }

      if (delivery.status !== 'delivered') {
        return NextResponse.json(
          { success: false, error: 'La livraison doit etre terminee pour pouvoir la noter' },
          { status: 400 }
        )
      }

      // Verifier que l'utilisateur est l'expediteur ou le coursier
      const isCustomer = delivery.customerId === auth.id
      const isCourier = delivery.courierId !== null

      if (!isCustomer && !isCourier) {
        return NextResponse.json(
          { success: false, error: 'Vous n\'etes pas implique dans cette livraison' },
          { status: 403 }
        )
      }

      // Verifier qu'une note n'existe pas deja
      const existingRating = await db.rating.findFirst({
        where: {
          deliveryId,
          fromUserId: auth.id,
          toUserId: targetUserId,
        },
      })

      if (existingRating) {
        return NextResponse.json(
          { success: false, error: 'Vous avez deja note cet utilisateur pour cette livraison' },
          { status: 400 }
        )
      }
    }

    // Creer la note
    const rating = await db.rating.create({
      data: {
        rideId: rideId ?? null,
        deliveryId: deliveryId ?? null,
        fromUserId: auth.id,
        toUserId: targetUserId,
        score,
        comment: comment ?? null,
      },
      include: {
        fromUser: {
          select: {
            id: true,
            name: true,
            avatar: true,
          },
        },
        toUser: {
          select: {
            id: true,
            name: true,
            avatar: true,
          },
        },
      },
    })

    // Mettre a jour la note moyenne de l'utilisateur cible
    const updatedRatings = await db.rating.findMany({
      where: { toUserId: targetUserId },
      select: { score: true },
    })

    const newAverageScore =
      updatedRatings.length > 0
        ? Number(
            (
              updatedRatings.reduce((sum, r) => sum + r.score, 0) /
              updatedRatings.length
            ).toFixed(2)
          )
        : 0

    await db.user.update({
      where: { id: targetUserId },
      data: { rating: newAverageScore },
    })

    // Journaliser la note
    await logAction({
      userId: auth.id,
      action: 'rating_submitted',
      resource: 'rating',
      resourceId: rating.id,
      details: {
        targetUserId,
        score,
        rideId: rideId ?? null,
        deliveryId: deliveryId ?? null,
        newAverageScore,
        totalRatings: updatedRatings.length,
      },
    })

    return NextResponse.json(
      {
        success: true,
        data: {
          message: 'Note soumise avec succes',
          rating,
        },
      },
      { status: 201 }
    )
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: error.statusCode }
      )
    }

    console.error('[RATINGS] Erreur lors de la soumission:', error)
    return NextResponse.json(
      { success: false, error: 'Erreur interne du serveur' },
      { status: 500 }
    )
  }
}
