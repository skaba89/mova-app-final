export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/mova/business?businessId=xxx
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const businessId = searchParams.get('businessId');

    if (!businessId) {
      return NextResponse.json(
        { success: false, error: 'L\'identifiant de l\'entreprise est requis' },
        { status: 400 }
      );
    }

    const business = await db.businessAccount.findUnique({
      where: { id: businessId },
      include: {
        employees: {
          include: {
            user: {
              select: { id: true, name: true, email: true, phone: true, avatar: true },
            },
            costCenter: {
              select: { id: true, name: true, budget: true, spent: true },
            },
          },
          where: { isActive: true },
        },
        costCenters: {
          include: {
            _count: {
              select: { employees: true },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!business) {
      return NextResponse.json(
        { success: false, error: 'Entreprise introuvable' },
        { status: 404 }
      );
    }

    const totalBudget = business.costCenters.reduce((sum, cc) => sum + Number(cc.budget), 0);
    const totalSpent = business.costCenters.reduce((sum, cc) => sum + Number(cc.spent), 0);

    return NextResponse.json({
      success: true,
      data: {
        id: business.id,
        name: business.name,
        email: business.email,
        phone: business.phone,
        plan: business.plan,
        isActive: business.isActive,
        createdAt: business.createdAt,
        employees: business.employees.map((e) => ({
          id: e.id,
          department: e.department,
          monthlyBudget: e.monthlyLimit,
          user: e.user,
          costCenter: e.costCenter,
        })),
        employeeCount: business.employees.length,
        costCenters: business.costCenters.map((cc) => ({
          id: cc.id,
          name: cc.name,
          budget: cc.budget,
          spent: cc.spent,
          remaining: Number(cc.budget) - Number(cc.spent),
          employeeCount: cc._count.employees,
        })),
        financialSummary: {
          totalBudget,
          totalSpent,
          totalRemaining: totalBudget - totalSpent,
          utilizationPercent: totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 100) : 0,
          currency: 'GNF',
        },
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erreur serveur';
    return NextResponse.json(
      { success: false, error: `Erreur lors de la récupération de l'entreprise: ${message}` },
      { status: 500 }
    );
  }
}

// POST /api/mova/business
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, email, phone, plan } = body;

    if (!name || !email || !phone) {
      return NextResponse.json(
        { success: false, error: 'Le nom, l\'email et le téléphone sont requis' },
        { status: 400 }
      );
    }

    // Validate plan
    const validPlans = ['starter', 'pro', 'enterprise'];
    const selectedPlan = plan || 'starter';
    if (!validPlans.includes(selectedPlan)) {
      return NextResponse.json(
        { success: false, error: 'Formule invalide. Options: starter, pro, enterprise' },
        { status: 400 }
      );
    }

    // Check if business email already exists
    const existing = await db.businessAccount.findFirst({ where: { email } });
    if (existing) {
      return NextResponse.json(
        { success: false, error: 'Une entreprise avec cet email existe déjà' },
        { status: 409 }
      );
    }

    // Create business account with default cost center
    const business = await db.businessAccount.create({
      data: {
        name,
        email,
        phone,
        plan: selectedPlan,
        costCenters: {
          create: {
            name: 'Général',
            budget: selectedPlan === 'starter' ? 500000 : selectedPlan === 'pro' ? 2000000 : 10000000,
          },
        },
      },
      include: {
        costCenters: true,
      },
    });

    const planLimits: Record<string, { employeeLimit: number; budgetLimit: number }> = {
      starter: { employeeLimit: 10, budgetLimit: 500000 },
      pro: { employeeLimit: 50, budgetLimit: 2000000 },
      enterprise: { employeeLimit: 500, budgetLimit: 10000000 },
    };

    const planDetails = planLimits[selectedPlan];

    return NextResponse.json({
      success: true,
      data: {
        id: business.id,
        name: business.name,
        email: business.email,
        phone: business.phone,
        plan: business.plan,
        costCenters: business.costCenters,
        createdAt: business.createdAt,
      },
      planDetails,
      message: `Compte entreprise créé avec la formule ${selectedPlan}. Un centre de coûts par défaut a été créé.`,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erreur serveur';
    return NextResponse.json(
      { success: false, error: `Erreur lors de la création du compte entreprise: ${message}` },
      { status: 500 }
    );
  }
}
