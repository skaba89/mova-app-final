import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/mova/auth-middleware'
import db from '@/lib/db'

// Utilitaire de conversion Decimal vers Number
function num(value: unknown): number {
  if (value === null || value === undefined) return 0
  return Number(value)
}

// GET /api/mova/analytics - Statistiques de la plateforme (admin uniquement)
export async function GET(request: NextRequest) {
  try {
    const admin = await requireAdmin(request)
    if (admin instanceof NextResponse) return admin

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // Executer toutes les requetes d'agregation en parallele
    const [
      totalUsers,
      totalDrivers,
      totalRides,
      totalFoodOrders,
      totalDeliveries,
      activeUsersToday,
      ridesToday,
      rideRevenue,
      foodRevenue,
      deliveryRevenue,
      completedRides,
      completedFoodOrders,
      completedDeliveries,
    ] = await Promise.all([
      // Total des utilisateurs
      db.user.count(),

      // Total des chauffeurs
      db.driverProfile.count(),

      // Total des courses
      db.ride.count(),

      // Total des commandes alimentaires
      db.foodOrder.count(),

      // Total des livraisons
      db.delivery.count(),

      // Utilisateurs actifs aujourd'hui
      db.user.count({
        where: {
          lastLogin: { gte: today },
        },
      }),

      // Courses aujourd'hui
      db.ride.count({
        where: {
          createdAt: { gte: today },
        },
      }),

      // Revenus des courses (somme des paiements completes)
      db.payment.aggregate({
        where: {
          status: 'completed',
          rideId: { not: null },
        },
        _sum: { amount: true },
      }),

      // Revenus des commandes alimentaires
      db.payment.aggregate({
        where: {
          status: 'completed',
          foodOrderId: { not: null },
        },
        _sum: { amount: true },
      }),

      // Revenus des livraisons
      db.payment.aggregate({
        where: {
          status: 'completed',
          deliveryId: { not: null },
        },
        _sum: { amount: true },
      }),

      // Courses completees
      db.ride.count({
        where: { status: 'completed' },
      }),

      // Commandes alimentaires livrees
      db.foodOrder.count({
        where: { status: 'delivered' },
      }),

      // Livraisons effectuees
      db.delivery.count({
        where: { status: 'delivered' },
      }),
    ])

    const totalRevenue =
      num(rideRevenue._sum.amount) +
      num(foodRevenue._sum.amount) +
      num(deliveryRevenue._sum.amount)

    return NextResponse.json({
      success: true,
      data: {
        overview: {
          totalUsers,
          totalDrivers,
          totalRides,
          totalFoodOrders,
          totalDeliveries,
        },
        revenue: {
          total: totalRevenue,
          rides: num(rideRevenue._sum.amount),
          food: num(foodRevenue._sum.amount),
          deliveries: num(deliveryRevenue._sum.amount),
        },
        today: {
          activeUsers: activeUsersToday,
          rides: ridesToday,
        },
        completed: {
          rides: completedRides,
          foodOrders: completedFoodOrders,
          deliveries: completedDeliveries,
        },
        generatedAt: new Date().toISOString(),
      },
    })
  } catch (error) {
    console.error('[ANALYTICS] Erreur lors de la recuperation des statistiques:', error)
    return NextResponse.json(
      { success: false, error: 'Erreur interne du serveur' },
      { status: 500 }
    )
  }
}
