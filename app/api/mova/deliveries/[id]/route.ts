import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/mova/auth-middleware'
import db from '@/lib/db'
import { z } from 'zod/v4'

// Utilitaire de conversion Decimal vers Number
function num(value: unknown): number | null {
  if (value === null || value === undefined) return null
  return Number(value)
}

// Schema de validation pour la mise a jour du statut
const updateStatusSchema = z.object({
  status: z.enum(['accepted', 'picked_up', 'in_transit', 'delivered', 'cancelled', 'failed']),
  otp: z.string().length(4, "Le code OTP doit contenir 4 chiffres").optional(),
})

// Transitions de statut autorisees
const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  pending: ['accepted', 'cancelled'],
  accepted: ['picked_up', 'cancelled'],
  picked_up: ['in_transit', 'cancelled', 'failed'],
  in_transit: ['delivered', 'failed'],
}

const TERMINAL_STATES = new Set(['delivered', 'cancelled', 'failed'])

// GET /api/mova/deliveries/[id] - Recuperer une livraison
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(request)
    if (auth instanceof NextResponse) return auth

    const { id } = await params

    const delivery = await db.delivery.findUnique({
      where: { id },
      include: {
        courier: {
          select: {
            id: true,
            user: {
              select: {
                id: true,
                name: true,
                phone: true,
                avatar: true,
              },
            },
            vehicleType: true,
            currentLocationLat: true,
            currentLocationLng: true,
          },
        },
        payments: {
          select: {
            id: true,
            amount: true,
            method: true,
            status: true,
            reference: true,
            createdAt: true,
          },
        },
      },
    })

    if (!delivery) {
      return NextResponse.json(
        { success: false, error: 'Livraison introuvable' },
        { status: 404 }
      )
    }

    // Verifier que l'utilisateur est le proprietaire, le coursier assigne ou un admin
    const isOwner = delivery.customerId === auth.id
    let isCourier = false
    if (delivery.courierId) {
      const courierProfile = await db.driverProfile.findUnique({
        where: { id: delivery.courierId },
        select: { userId: true },
      })
      isCourier = courierProfile?.userId === auth.id
    }
    if (!isOwner && !isCourier && auth.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'Acces refuse' },
        { status: 403 }
      )
    }

    const convertedDelivery = {
      ...delivery,
      estimatedPrice: num(delivery.estimatedPrice),
      actualPrice: num(delivery.actualPrice),
      declaredValue: num(delivery.declaredValue),
      pickupLat: num(delivery.pickupLat),
      pickupLng: num(delivery.pickupLng),
      dropoffLat: num(delivery.dropoffLat),
      dropoffLng: num(delivery.dropoffLng),
      packageWeight: num(delivery.packageWeight),
      payments: delivery.payments.map((p) => ({
        ...p,
        amount: num(p.amount),
      })),
    }

    return NextResponse.json({
      success: true,
      data: { delivery: convertedDelivery },
    })
  } catch (error) {
    console.error('[DELIVERIES] Erreur lors de la recuperation:', error)
    return NextResponse.json(
      { success: false, error: 'Erreur interne du serveur' },
      { status: 500 }
    )
  }
}

// PATCH /api/mova/deliveries/[id] - Mettre a jour le statut d'une livraison
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(request)
    if (auth instanceof NextResponse) return auth

    const { id } = await params
    const body = await request.json()
    const parsed = updateStatusSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues[0].message },
        { status: 400 }
      )
    }

    const { status, otp } = parsed.data

    // Recuperer la livraison existante
    const delivery = await db.delivery.findUnique({
      where: { id },
    })

    if (!delivery) {
      return NextResponse.json(
        { success: false, error: 'Livraison introuvable' },
        { status: 404 }
      )
    }

    // Verification des droits : client, coursier ou admin
    const isCustomer = delivery.customerId === auth.id
    let isCourier = false
    if (delivery.courierId) {
      const courierProfile = await db.driverProfile.findUnique({
        where: { id: delivery.courierId },
        select: { userId: true },
      })
      isCourier = courierProfile?.userId === auth.id
    }
    // Pour les livraisons non assignees, verifier si l'utilisateur a un profil coursier
    const hasCourierProfile = !isCourier ? (await db.driverProfile.findUnique({
      where: { userId: auth.id },
      select: { id: true },
    })) !== null : true
    const isAdmin = auth.role === 'admin'
    if (!isCustomer && !isCourier && !isAdmin) {
      // Autoriser les coursiers non assignes a accepter de nouvelles livraisons
      if (!hasCourierProfile) {
        return NextResponse.json(
          { success: false, error: 'Acces refuse a cette livraison' },
          { status: 403 }
        )
      }
    }

    // Verifier que la livraison n'est pas dans un etat terminal
    if (TERMINAL_STATES.has(delivery.status)) {
      return NextResponse.json(
        { success: false, error: 'La livraison est deja dans un etat terminal' },
        { status: 400 }
      )
    }

    // Verification du OTP pour la livraison
    if (status === 'delivered') {
      if (!otp) {
        return NextResponse.json(
          { success: false, error: 'Le code OTP est requis pour confirmer la livraison' },
          { status: 400 }
        )
      }
      if (delivery.otp !== otp) {
        return NextResponse.json(
          { success: false, error: 'Code OTP invalide' },
          { status: 400 }
        )
      }
    }

    // Verifier la transition de statut
    const allowed = ALLOWED_TRANSITIONS[delivery.status] ?? []
    if (!allowed.includes(status)) {
      return NextResponse.json(
        { success: false, error: `Transition invalide : ${delivery.status} vers ${status}` },
        { status: 400 }
      )
    }

    // Donnees de mise a jour
    const updateData: Record<string, unknown> = { status }

    // Assigner le coursier si la livraison est acceptee
    if (status === 'accepted' && !delivery.courierId) {
      const courierProfile = await db.driverProfile.findUnique({
        where: { userId: auth.id },
      })
      if (!courierProfile) {
        return NextResponse.json(
          { success: false, error: 'Profil coursier non trouve' },
          { status: 400 }
        )
      }
      if (!hasCourierProfile && !isAdmin) {
        return NextResponse.json(
          { success: false, error: 'Seul un coursier peut accepter une livraison' },
          { status: 403 }
        )
      }
      updateData.courierId = courierProfile.id
    }

    // Mettre a jour la livraison
    const updatedDelivery = await db.delivery.update({
      where: { id },
      data: updateData,
      include: {
        courier: {
          select: {
            id: true,
            user: {
              select: {
                id: true,
                name: true,
                phone: true,
              },
            },
            vehicleType: true,
          },
        },
      },
    })

    // Mettre a jour le paiement si la livraison est terminee
    if (status === 'delivered' && delivery.paymentStatus === 'pending') {
      await db.payment.updateMany({
        where: {
          deliveryId: id,
          status: 'pending',
        },
        data: { status: 'completed' },
      })
      await db.delivery.update({
        where: { id },
        data: {
          paymentStatus: 'completed',
          actualPrice: delivery.estimatedPrice,
        },
      })
    }

    if (status === 'cancelled' && delivery.paymentStatus === 'pending') {
      await db.payment.updateMany({
        where: {
          deliveryId: id,
          status: 'pending',
        },
        data: { status: 'cancelled' },
      })
      await db.delivery.update({
        where: { id },
        data: { paymentStatus: 'cancelled' },
      })
    }

    const convertedDelivery = {
      ...updatedDelivery,
      estimatedPrice: num(updatedDelivery.estimatedPrice),
      actualPrice: num(updatedDelivery.actualPrice),
      declaredValue: num(updatedDelivery.declaredValue),
      pickupLat: num(updatedDelivery.pickupLat),
      pickupLng: num(updatedDelivery.pickupLng),
      dropoffLat: num(updatedDelivery.dropoffLat),
      dropoffLng: num(updatedDelivery.dropoffLng),
      packageWeight: num(updatedDelivery.packageWeight),
    }

    return NextResponse.json({
      success: true,
      data: { delivery: convertedDelivery },
    })
  } catch (error) {
    console.error('[DELIVERIES] Erreur lors de la mise a jour:', error)
    return NextResponse.json(
      { success: false, error: 'Erreur interne du serveur' },
      { status: 500 }
    )
  }
}
