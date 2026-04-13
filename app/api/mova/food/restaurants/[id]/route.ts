import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db'

// Utilitaire de conversion Decimal vers Number
function num(value: unknown): number | null {
  if (value === null || value === undefined) return null
  return Number(value)
}

// GET /api/mova/food/restaurants/[id] - Detail d'un restaurant avec son menu (public)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const restaurant = await db.restaurant.findUnique({
      where: { id, isActive: true },
      include: {
        menuItems: {
          where: { isAvailable: true },
          orderBy: { category: 'asc' },
        },
      },
    })

    if (!restaurant) {
      return NextResponse.json(
        { success: false, error: 'Restaurant introuvable ou inactive' },
        { status: 404 }
      )
    }

    // Regrouper les articles par categorie
    const menuByCategory: Record<string, typeof restaurant.menuItems> = {}
    for (const item of restaurant.menuItems) {
      const category = item.category ?? 'Autres'
      if (!menuByCategory[category]) {
        menuByCategory[category] = []
      }
      menuByCategory[category].push(item)
    }

    // Conversion des champs Decimal
    const convertedRestaurant = {
      id: restaurant.id,
      name: restaurant.name,
      description: restaurant.description,
      address: restaurant.address,
      lat: num(restaurant.lat),
      lng: num(restaurant.lng),
      zone: restaurant.zone,
      phone: restaurant.phone,
      email: restaurant.email,
      imageUrl: restaurant.imageUrl,
      logoUrl: restaurant.logoUrl,
      isOpen: restaurant.isOpen,
      rating: num(restaurant.rating),
      deliveryFee: num(restaurant.deliveryFee),
      minOrderAmount: num(restaurant.minOrderAmount),
      estimatedDeliveryTime: restaurant.estimatedDeliveryTime,
      operatingHours: restaurant.operatingHours,
      menu: Object.entries(menuByCategory).map(([category, items]) => ({
        category,
        items: items.map((item) => ({
          id: item.id,
          name: item.name,
          description: item.description,
          price: num(item.price),
          imageUrl: item.imageUrl,
          isPopular: item.isPopular,
          preparationTime: item.preparationTime,
          calories: item.calories,
        })),
      })),
    }

    return NextResponse.json({
      success: true,
      data: { restaurant: convertedRestaurant },
    })
  } catch (error) {
    console.error('[FOOD/RESTAURANTS] Erreur lors de la recuperation du detail:', error)
    return NextResponse.json(
      { success: false, error: 'Erreur interne du serveur' },
      { status: 500 }
    )
  }
}
