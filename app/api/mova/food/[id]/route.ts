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
  status: z.enum([
    'confirmed', 'preparing', 'ready',
    'picked_up', 'in_transit',
    'delivered', 'cancelled',
  ]),
  otp: z.string().length(4, "Le code OTP doit contenir 4 chiffres").optional(),
})

// Transitions de statut autorisees
const RESTAURANT_TRANSITIONS: Record<string, string[]> = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['preparing', 'cancelled'],
  preparing: ['ready', 'cancelled'],
  ready: ['picked_up', 'cancelled'],
}

const DRIVER_TRANSITIONS: Record<string, string[]> = {
  ready: ['picked_up'],
  picked_up: ['in_transit'],
  in_transit: ['delivered'],
}

const TERMINAL_STATES = new Set(['delivered', 'cancelled'])

// Generer une reference de paiement unique
function generatePaymentReference(): string {
  return `PAY-FOOD-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`
}

// GET /api/mova/food/[id] - Recuperer une commande alimentaire
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(request)
    if (auth instanceof NextResponse) return auth

    const { id } = await params

    const order = await db.foodOrder.findUnique({
      where: { id },
      include: {
        restaurant: {
          select: {
            id: true,
            name: true,
            address: true,
            logoUrl: true,
            phone: true,
          },
        },
        driverProfile: {
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

    if (!order) {
      return NextResponse.json(
        { success: false, error: 'Commande introuvable' },
        { status: 404 }
      )
    }

    // Verifier que l'utilisateur est le proprietaire, le restaurant, le chauffeur ou un admin
    const isOwner = order.customerId === auth.id
    let isDriverAccess = false
    if (order.driverProfileId) {
      const dp = await db.driverProfile.findUnique({
        where: { id: order.driverProfileId },
        select: { userId: true },
      })
      isDriverAccess = dp?.userId === auth.id
    }
    let isRestaurantAccess = false
    if (auth.role === 'restaurant') {
      const rest = await db.restaurant.findUnique({
        where: { id: order.restaurantId },
        select: { ownerId: true },
      })
      isRestaurantAccess = rest?.ownerId === auth.id
    }
    if (!isOwner && !isDriverAccess && !isRestaurantAccess && auth.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'Acces refuse' },
        { status: 403 }
      )
    }

    // Conversion des champs Decimal
    const convertedOrder = {
      ...order,
      subtotal: num(order.subtotal),
      deliveryFee: num(order.deliveryFee),
      serviceFee: num(order.serviceFee),
      totalAmount: num(order.totalAmount),
      deliveryLat: num(order.deliveryLat),
      deliveryLng: num(order.deliveryLng),
      payments: order.payments.map((p) => ({
        ...p,
        amount: num(p.amount),
      })),
    }

    return NextResponse.json({
      success: true,
      data: { order: convertedOrder },
    })
  } catch (error) {
    console.error('[FOOD] Erreur lors de la recuperation de la commande:', error)
    return NextResponse.json(
      { success: false, error: 'Erreur interne du serveur' },
      { status: 500 }
    )
  }
}

// PATCH /api/mova/food/[id] - Mettre a jour le statut d'une commande
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

    // Recuperer la commande existante
    const order = await db.foodOrder.findUnique({
      where: { id },
    })

    if (!order) {
      return NextResponse.json(
        { success: false, error: 'Commande introuvable' },
        { status: 404 }
      )
    }

    // Verification des droits : client, restaurant, chauffeur ou admin
    const isCustomer = order.customerId === auth.id
    const isRestaurantOwner = auth.role === 'restaurant' && order.restaurant
      ? (await db.restaurant.findUnique({
          where: { id: order.restaurantId },
          select: { ownerId: true },
        }))?.ownerId === auth.id
      : false
    let isDriver = false
    if (order.driverProfileId) {
      const driverProfile = await db.driverProfile.findUnique({
        where: { id: order.driverProfileId },
        select: { userId: true },
      })
      isDriver = driverProfile?.userId === auth.id
    }
    // Verifier si l'utilisateur a un profil chauffeur (pour accepter une commande)
    let hasDriverProfile = isDriver
    if (!hasDriverProfile) {
      hasDriverProfile = (await db.driverProfile.findUnique({
        where: { userId: auth.id },
        select: { id: true },
      })) !== null
    }
    const isAdmin = auth.role === 'admin'
    if (!isCustomer && !isRestaurantOwner && !isDriver && !hasDriverProfile && !isAdmin) {
      return NextResponse.json(
        { success: false, error: 'Acces refuse a cette commande' },
        { status: 403 }
      )
    }

    // Verifier que la commande n'est pas dans un etat terminal
    if (TERMINAL_STATES.has(order.status)) {
      return NextResponse.json(
        { success: false, error: 'La commande est deja dans un etat terminal et ne peut plus etre modifiee' },
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
      if (order.otp !== otp) {
        return NextResponse.json(
          { success: false, error: 'Code OTP invalide' },
          { status: 400 }
        )
      }
    }

    // Determiner le type de transition
    const isDriverTransition = ['picked_up', 'in_transit', 'delivered'].includes(status)

    if (isDriverTransition) {
      // Seul un chauffeur (assigne ou avec profil) ou un admin peut effectuer ces transitions
      if (!isDriver && !hasDriverProfile && !isAdmin) {
        return NextResponse.json(
          { success: false, error: 'Seul un chauffeur peut effectuer cette transition' },
          { status: 403 }
        )
      }
      const allowed = DRIVER_TRANSITIONS[order.status] ?? []
      if (!allowed.includes(status)) {
        return NextResponse.json(
          { success: false, error: `Transition invalide : ${order.status} vers ${status}` },
          { status: 400 }
        )
      }
    } else {
      // Seul un restaurant owner ou un admin peut effectuer les transitions restaurant
      if (!isRestaurantOwner && !isAdmin) {
        return NextResponse.json(
          { success: false, error: 'Seul le restaurant peut effectuer cette transition' },
          { status: 403 }
        )
      }
      const allowed = RESTAURANT_TRANSITIONS[order.status] ?? []
      if (!allowed.includes(status)) {
        return NextResponse.json(
          { success: false, error: `Transition invalide : ${order.status} vers ${status}` },
          { status: 400 }
        )
      }
    }

    // Donnees de mise a jour
    const updateData: Record<string, unknown> = {
      status,
      ...(status === 'cancelled' ? { cancelledAt: new Date() } : {}),
    }

    // Assigner le chauffeur si la commande est preparee et prete a etre recuperee
    if (status === 'picked_up' && !order.driverProfileId) {
      const driverProfile = await db.driverProfile.findUnique({
        where: { userId: auth.id },
      })
      if (!driverProfile) {
        return NextResponse.json(
          { success: false, error: 'Profil chauffeur non trouve' },
          { status: 400 }
        )
      }
      updateData.driverProfileId = driverProfile.id
    }

    // Calculer le temps de livraison reel
    if (status === 'delivered') {
      const actualMinutes = order.createdAt
        ? Math.round((Date.now() - order.createdAt.getTime()) / 60000)
        : null
      updateData.actualDeliveryTime = actualMinutes
    }

    // Mettre a jour la commande
    const updatedOrder = await db.foodOrder.update({
      where: { id },
      data: updateData,
      include: {
        restaurant: {
          select: {
            id: true,
            name: true,
            address: true,
            logoUrl: true,
            phone: true,
          },
        },
        driverProfile: {
          select: {
            id: true,
            user: {
              select: {
                id: true,
                name: true,
                phone: true,
              },
            },
          },
        },
      },
    })

    // Creer le paiement a la livraison si le statut est 'delivered'
    if (status === 'delivered' && order.paymentStatus === 'pending') {
      await db.payment.updateMany({
        where: {
          foodOrderId: id,
          status: 'pending',
        },
        data: {
          status: 'completed',
        },
      })

      await db.foodOrder.update({
        where: { id },
        data: { paymentStatus: 'completed' },
      })
    }

    // Annuler les paiements en attente si la commande est annulee
    if (status === 'cancelled' && order.paymentStatus === 'pending') {
      await db.payment.updateMany({
        where: {
          foodOrderId: id,
          status: 'pending',
        },
        data: {
          status: 'cancelled',
        },
      })

      await db.foodOrder.update({
        where: { id },
        data: { paymentStatus: 'cancelled' },
      })
    }

    const convertedOrder = {
      ...updatedOrder,
      subtotal: num(updatedOrder.subtotal),
      deliveryFee: num(updatedOrder.deliveryFee),
      serviceFee: num(updatedOrder.serviceFee),
      totalAmount: num(updatedOrder.totalAmount),
      deliveryLat: num(updatedOrder.deliveryLat),
      deliveryLng: num(updatedOrder.deliveryLng),
    }

    return NextResponse.json({
      success: true,
      data: { order: convertedOrder },
    })
  } catch (error) {
    console.error('[FOOD] Erreur lors de la mise a jour de la commande:', error)
    return NextResponse.json(
      { success: false, error: 'Erreur interne du serveur' },
      { status: 500 }
    )
  }
}
