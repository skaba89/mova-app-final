import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db'

// Utilitaire de conversion Decimal vers Number
function num(value: unknown): number | null {
  if (value === null || value === undefined) return null
  return Number(value)
}

// GET /api/mova/food/restaurants - Lister les restaurants actifs (public)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') ?? '20', 10)))
    const skip = (page - 1) * limit
    const zone = searchParams.get('zone')
    const search = searchParams.get('search')
    const sort = searchParams.get('sort') ?? 'rating'
    const isOpen = searchParams.get('isOpen')

    // Construire les filtres
    const where: Record<string, unknown> = { isActive: true }

    if (zone) {
      where.zone = zone
    }

    if (search) {
      where.OR = [
        { name: { contains: search } },
        { description: { contains: search } },
      ]
    }

    if (isOpen === 'true') {
      where.isOpen = true
    }

    // Determiner le tri
    let orderBy: Record<string, string> = { rating: 'desc' }
    if (sort === 'name') {
      orderBy = { name: 'asc' }
    } else if (sort === 'newest') {
      orderBy = { createdAt: 'desc' }
    } else if (sort === 'deliveryFee') {
      orderBy = { deliveryFee: 'asc' }
    }

    const [restaurants, total] = await Promise.all([
      db.restaurant.findMany({
        where,
        select: {
          id: true,
          name: true,
          description: true,
          address: true,
          lat: true,
          lng: true,
          zone: true,
          phone: true,
          imageUrl: true,
          logoUrl: true,
          isOpen: true,
          rating: true,
          deliveryFee: true,
          minOrderAmount: true,
          estimatedDeliveryTime: true,
        },
        orderBy,
        skip,
        take: limit,
      }),
      db.restaurant.count({ where }),
    ])

    // Conversion des champs Decimal
    const convertedRestaurants = restaurants.map((r) => ({
      ...r,
      deliveryFee: num(r.deliveryFee),
      minOrderAmount: num(r.minOrderAmount),
      rating: num(r.rating),
      lat: num(r.lat),
      lng: num(r.lng),
    }))

    return NextResponse.json({
      success: true,
      data: {
        restaurants: convertedRestaurants,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    })
  } catch (error) {
    console.error('[FOOD/RESTAURANTS] Erreur lors de la recuperation:', error)
    return NextResponse.json(
      { success: false, error: 'Erreur interne du serveur' },
      { status: 500 }
    )
  }
}
