export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/mova/business/[businessId]/analytics
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ businessId: string }> }
) {
  try {
    const { businessId } = await params;

    if (!businessId) {
      return NextResponse.json(
        { success: false, error: 'L\'identifiant de l\'entreprise est requis' },
        { status: 400 }
      );
    }

    // Check if business exists
    const business = await db.businessAccount.findUnique({
      where: { id: businessId },
      select: {
        id: true,
        name: true,
        plan: true,
        createdAt: true,
      },
    });

    if (!business) {
      return NextResponse.json(
        { success: false, error: 'Entreprise introuvable' },
        { status: 404 }
      );
    }

    // Fetch all related data in parallel
    const [
      employees,
      costCenters,
      totalRides,
      recentRides,
    ] = await Promise.all([
      // Employees with their departments
      db.businessEmployee.findMany({
        where: { businessId },
        include: {
          user: {
            select: { id: true, name: true },
          },
          costCenter: {
            select: { id: true, name: true },
          },
        },
      }),
      // Cost centers with spending
      db.businessCostCenter.findMany({
        where: { businessId },
        include: {
          _count: { select: { employees: true } },
        },
      }),
      // Total rides by employees (from bookings)
      db.booking.count({
        where: {
          passengerId: {
            in: (await db.businessEmployee.findMany({
              where: { businessId },
              select: { userId: true },
            })).map((e) => e.userId),
          },
          status: { in: ['completed', 'in_progress'] },
        },
      }),
      // Recent bookings
      db.booking.findMany({
        where: {
          passengerId: {
            in: (await db.businessEmployee.findMany({
              where: { businessId },
              select: { userId: true },
            })).map((e) => e.userId),
          },
        },
        include: {
          passenger: {
            select: { id: true, name: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
    ]);

    // Spend by department
    const spendByDepartment: Record<string, number> = {};
    costCenters.forEach((cc) => {
      spendByDepartment[cc.name] = Number(cc.spent);
    });

    // Monthly trend (last 6 months)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const employeeIds = employees.map((e) => e.userId);

    // Fetch bookings for the last 6 months (groupBy on DateTime doesn't work in SQLite)
    const monthlyBookings = await db.booking.findMany({
      where: {
        passengerId: { in: employeeIds },
        createdAt: { gte: sixMonthsAgo },
      },
      select: { createdAt: true, estimatedFare: true },
    });

    // Group by month
    const monthlyTrend: { month: string; rides: number; spend: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const monthDate = new Date();
      monthDate.setMonth(monthDate.getMonth() - i);
      const monthKey = monthDate.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });

      const monthStart = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
      const monthEnd = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0, 23, 59, 59);

      const monthRides = monthlyBookings.filter(
        (b) => b.createdAt >= monthStart && b.createdAt <= monthEnd
      );

      monthlyTrend.push({
        month: monthKey,
        rides: monthRides.length,
        spend: monthRides.reduce(
          (sum, b) => sum + Number(b.estimatedFare || 0),
          0
        ),
      });
    }

    // Top employees by ride count
    const employeeRideCounts = await Promise.all(
      employeeIds.map(async (userId) => {
        const count = await db.booking.count({
          where: { passengerId: userId, status: 'completed' },
        });
        const emp = employees.find((e) => e.userId === userId);
        return {
          userId,
          name: emp?.user.name || 'Inconnu',
          department: emp?.costCenter?.name || 'Non assigné',
          rides: count,
        };
      })
    );

    const topEmployees = employeeRideCounts
      .sort((a, b) => b.rides - a.rides)
      .slice(0, 5);

    const totalSpent = costCenters.reduce((sum, cc) => sum + Number(cc.spent), 0);
    const totalBudget = costCenters.reduce((sum, cc) => sum + Number(cc.budget), 0);

    return NextResponse.json({
      success: true,
      data: {
        business: {
          id: business.id,
          name: business.name,
          plan: business.plan,
          memberSince: business.createdAt,
        },
        overview: {
          totalEmployees: employees.length,
          activeEmployees: employees.filter((e) => e.isActive).length,
          totalRides,
          totalSpent,
          totalBudget,
          budgetUtilization: totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 100) : 0,
          currency: 'GNF',
        },
        spendByDepartment,
        monthlyTrend,
        topEmployees,
        recentRides: recentRides.map((r) => ({
          id: r.id,
          passenger: r.passenger.name,
          pickupZone: r.pickupZone,
          dropoffZone: r.dropoffZone,
          fare: r.estimatedFare,
          status: r.status,
          scheduledFor: r.scheduledFor,
          createdAt: r.createdAt,
        })),
        costCenters: costCenters.map((cc) => ({
          id: cc.id,
          name: cc.name,
          budget: Number(cc.budget),
          spent: Number(cc.spent),
          remaining: Number(cc.budget) - Number(cc.spent),
          employeeCount: cc._count.employees,
        })),
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erreur serveur';
    return NextResponse.json(
      { success: false, error: `Erreur lors de la récupération des analyses: ${message}` },
      { status: 500 }
    );
  }
}
