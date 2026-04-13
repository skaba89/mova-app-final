export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { validateRequest } from '@/lib/mova/auth-middleware';

// GET /api/mova/wallet?userId=xxx
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'L\'identifiant utilisateur est requis' },
        { status: 400 }
      );
    }

    let wallet = await db.wallet.findUnique({
      where: { userId },
      include: {
        user: {
          select: { id: true, name: true, email: true, phone: true },
        },
      },
    });

    // Auto-create wallet if not found
    if (!wallet) {
      wallet = await db.wallet.create({
        data: { userId },
        include: {
          user: {
            select: { id: true, name: true, email: true, phone: true },
          },
        },
      });
    }

    const transactions = await db.walletTransaction.findMany({
      where: { walletId: wallet.id },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    return NextResponse.json({
      success: true,
      data: {
        id: wallet.id,
        balance: wallet.balance,
        currency: wallet.currency,
        isActive: wallet.isActive,
        user: wallet.user,
        recentTransactions: transactions,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erreur serveur';
    return NextResponse.json(
      { success: false, error: `Erreur lors de la récupération du portefeuille: ${message}` },
      { status: 500 }
    );
  }
}

// POST /api/mova/wallet/topup
export async function POST(request: NextRequest) {
  try {
    const auth = await validateRequest(request);
    if (!auth.success) return auth.response;
    const body = await request.json();
    const { userId, amount, method, provider } = body;

    if (!userId || !amount || !method) {
      return NextResponse.json(
        { success: false, error: 'L\'utilisateur, le montant et la méthode de paiement sont requis' },
        { status: 400 }
      );
    }

    if (amount <= 0) {
      return NextResponse.json(
        { success: false, error: 'Le montant doit être supérieur à zéro' },
        { status: 400 }
      );
    }

    const validMethods = ['mobile_money', 'card', 'transfer'];
    if (!validMethods.includes(method)) {
      return NextResponse.json(
        { success: false, error: 'Méthode de paiement invalide' },
        { status: 400 }
      );
    }

    // Find or create wallet
    let wallet = await db.wallet.findUnique({ where: { userId } });
    if (!wallet) {
      wallet = await db.wallet.create({ data: { userId } });
    }

    if (!wallet.isActive) {
      return NextResponse.json(
        { success: false, error: 'Ce portefeuille est désactivé' },
        { status: 400 }
      );
    }

    // Generate reference
    const reference = `TOPUP-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    // Create transaction and update balance in a transaction
    const newBalance = Number(wallet.balance) + amount;
    const [transaction] = await db.$transaction([
      db.walletTransaction.create({
        data: {
          walletId: wallet.id,
          type: 'credit',
          amount,
          balance: newBalance,
          description: `Recharge via ${provider || method}`,
          method,
          provider: provider || null,
          reference,
          status: 'completed',
        },
      }),
      db.wallet.update({
        where: { id: wallet.id },
        data: { balance: { increment: amount } },
      }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        transactionId: transaction.id,
        type: transaction.type,
        amount: transaction.amount,
        reference: transaction.reference,
        status: transaction.status,
        newBalance: Number(wallet.balance) + amount,
        currency: wallet.currency,
        createdAt: transaction.createdAt,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erreur serveur';
    return NextResponse.json(
      { success: false, error: `Erreur lors de la recharge: ${message}` },
      { status: 500 }
    );
  }
}
