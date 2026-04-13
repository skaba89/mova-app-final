import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/mova/auth-middleware'
import db from '@/lib/db'
import { z } from 'zod/v4'

// Schema de validation pour la creation d'une commande alimentaire
const createFoodOrderSchema = z.object({
  restaurantId: z.string().min(1, "L'identifiant du restaurant est requis"),
  items: z.array(z.object({
    menuItemId: z.string().min(1, "L'identifiant du plat est requis"),
    quantity: z.number().int().min(1, "La quantite doit etre au moins 1"),
  })).min(1, 'Au moins un article est requis'),
  deliveryAddress: z.string().min(1, "L'adresse de livraison est requise"),
  deliveryLat: z.number(),
  deliveryLng: z.number(),
  deliveryZone: z.string().optional(),
  customerNote: z.string().max(500).optional(),
  paymentMethod: z.enum(['cash', 'card', 'wallet', 'orange_money', 'mtn_momo', 'wave']),
})

// Frais de service fixes (en GNF)
const SERVICE_FEE = 500

// Utilitaire de conversion Decimal vers Number
function num(value: unknown): number | null {
  if (value === null || value === undefined) return null
  return Number(value)
}

// Generer un code OTP a 4 chiffres
function generateOTP(): string {
  return Math.floor(1000 + Math.random() * 9000).toString()
}

// Generer une reference de paiement unique
function generatePaymentReference(): string {
  return `PAY-FOOD-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`
}

// GET /api/mova/food - Lister les commandes alimentaires de l'utilisateur
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (auth instanceof NextResponse) return auth

    const { searchParams } = new URL(request.url)
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') ?? '20', 10)))
    const skip = (page - 1) * limit
    const status = searchParams.get('status')

    const where: Record<string, unknown> = { customerId: auth.id }
    if (status) {
      where.status = status
    }

    const [orders, total] = await Promise.all([
      db.foodOrder.findMany({
        where,
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
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      db.foodOrder.count({ where }),
    ])

    // Conversion des champs Decimal
    const convertedOrders = orders.map((order) => ({
      ...order,
      subtotal: num(order.subtotal),
      deliveryFee: num(order.deliveryFee),
      serviceFee: num(order.serviceFee),
      totalAmount: num(order.totalAmount),
      deliveryLat: num(order.deliveryLat),
      deliveryLng: num(order.deliveryLng),
    }))

    return NextResponse.json({
      success: true,
      data: {
        orders: convertedOrders,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    })
  } catch (error) {
    console.error('[FOOD] Erreur lors de la recuperation des commandes:', error)
    return NextResponse.json(
      { success: false, error: 'Erreur interne du serveur' },
      { status: 500 }
    )
  }
}

// POST /api/mova/food - Creer une commande alimentaire
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (auth instanceof NextResponse) return auth

    const body = await request.json()
    const parsed = createFoodOrderSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues[0].message },
        { status: 400 }
      )
    }

    const data = parsed.data

    // Verifier que le restaurant existe et est actif
    const restaurant = await db.restaurant.findUnique({
      where: { id: data.restaurantId },
    })

    if (!restaurant || !restaurant.isActive) {
      return NextResponse.json(
        { success: false, error: 'Restaurant introuvable ou inactive' },
        { status: 404 }
      )
    }

    // Recuperer tous les articles du menu concernes
    const menuItemIds = data.items.map((item) => item.menuItemId)
    const menuItems = await db.menuItem.findMany({
      where: {
        id: { in: menuItemIds },
        restaurantId: data.restaurantId,
        isAvailable: true,
      },
    })

    if (menuItems.length !== menuItemIds.length) {
      return NextResponse.json(
        { success: false, error: 'Un ou plusieurs articles sont indisponibles' },
        { status: 400 }
      )
    }

    // Calculer le sous-total
    const itemsMap = new Map(menuItems.map((item) => [item.id, item]))
    let subtotal = 0
    const orderItems = data.items.map((item) => {
      const menuItem = itemsMap.get(item.menuItemId)
      if (!menuItem) {
        throw new Error(`Article ${item.menuItemId} non trouve`)
      }
      const itemTotal = Number(menuItem.price) * item.quantity
      subtotal += itemTotal
      return {
        menuItemId: item.menuItemId,
        name: menuItem.name,
        price: Number(menuItem.price),
        quantity: item.quantity,
        total: itemTotal,
      }
    })

    const deliveryFee = num(restaurant.deliveryFee) ?? 0
    const serviceFee = SERVICE_FEE
    const totalAmount = subtotal + deliveryFee + serviceFee

    // Generer l'OTP
    const otp = generateOTP()

    // Creer la commande alimentaire et le paiement dans une transaction
    const order = await db.$transaction(async (tx) => {
      const foodOrder = await tx.foodOrder.create({
        data: {
          customerId: auth.id,
          restaurantId: data.restaurantId,
          status: 'pending',
          items: orderItems,
          subtotal,
          deliveryFee,
          serviceFee,
          totalAmount,
          paymentMethod: data.paymentMethod,
          deliveryAddress: data.deliveryAddress,
          deliveryLat: data.deliveryLat,
          deliveryLng: data.deliveryLng,
          deliveryZone: data.deliveryZone ?? null,
          customerNote: data.customerNote ?? null,
          otp,
        },
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
        },
      })

      // Creer l'enregistrement de paiement
      await tx.payment.create({
        data: {
          userId: auth.id,
          foodOrderId: foodOrder.id,
          amount: totalAmount,
          method: data.paymentMethod,
          status: 'pending',
          reference: generatePaymentReference(),
          description: `Commande alimentaire chez ${restaurant.name}`,
        },
      })

      return foodOrder
    })

    return NextResponse.json(
      {
        success: true,
        data: {
          order: {
            ...order,
            subtotal: num(order.subtotal),
            deliveryFee: num(order.deliveryFee),
            serviceFee: num(order.serviceFee),
            totalAmount: num(order.totalAmount),
            deliveryLat: num(order.deliveryLat),
            deliveryLng: num(order.deliveryLng),
          },
        },
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('[FOOD] Erreur lors de la creation de la commande:', error)
    return NextResponse.json(
      { success: false, error: 'Erreur interne du serveur' },
      { status: 500 }
    )
  }
}
