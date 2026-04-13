import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth, AuthError } from '@/lib/mova/auth-middleware';
import { z } from 'zod/v4';

const topUpSchema = z.object({
  action: z.literal('top_up'),
  amount: z.number().positive('Le montant doit etre positif').max(5000000, 'Montant maximum : 5 000 000 GNF'),
  method: z.enum(['orange_money', 'mtn_momo', 'wave', 'card', 'bank_transfer']),
});

/** Convertit les champs Decimal de Prisma en nombre */
function convertDecimalFields(obj: Record<string, unknown>, fields: string[]): Record<string, unknown> {
  const converted = { ...obj };
  for (const field of fields) {
    if (converted[field] !== null && converted[field] !== undefined) {
      (converted as Record<string, unknown>)[field] = Number(converted[field]);
    }
  }
  return converted;
}

// GET /api/mova/wallet
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;
    const { searchParams } = new URL(request.url);

    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') ?? '20', 10)));
    const skip = (page - 1) * limit;

    // Recuperer ou creer le portefeuille
    let wallet = await db.wallet.findUnique({
      where: { userId: auth.id },
    });

    if (!wallet) {
      wallet = await db.wallet.create({
        data: {
          userId: auth.id,
          balance: 0,
          currency: 'GNF',
        },
      });
    }

    // Recuperer les transactions
    const [transactions, total] = await Promise.all([
      db.walletTransaction.findMany({
        where: { walletId: wallet.id },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      db.walletTransaction.count({
        where: { walletId: wallet.id },
      }),
    ]);

    const decimalFields = ['balance', 'amount'];
    const convertedWallet = convertDecimalFields(wallet as unknown as Record<string, unknown>, decimalFields);
    const convertedTransactions = transactions.map((t) =>
      convertDecimalFields(t as unknown as Record<string, unknown>, decimalFields)
    );

    return NextResponse.json({
      success: true,
      data: {
        wallet: convertedWallet,
        transactions: convertedTransactions,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: error.statusCode }
      );
    }

    console.error('[WALLET] Erreur interne:', error);
    return NextResponse.json(
      { success: false, error: 'Erreur interne du serveur' },
      { status: 500 }
    );
  }
}

// POST /api/mova/wallet
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;
    const body = await request.json();

    const parsed = topUpSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }

    const { amount, method } = parsed.data;

    // Recuperer ou creer le portefeuille
    let wallet = await db.wallet.findUnique({
      where: { userId: auth.id },
    });

    if (!wallet) {
      wallet = await db.wallet.create({
        data: {
          userId: auth.id,
          balance: 0,
          currency: 'GNF',
        },
      });
    }

    // Ajout des fonds avec une transaction atomique
    const updatedWallet = await db.$transaction(async (tx) => {
      // Crediter le portefeuille
      const incremented = await tx.wallet.update({
        where: { id: wallet!.id },
        data: { balance: { increment: amount } },
      });

      // Creer la transaction
      await tx.walletTransaction.create({
        data: {
          walletId: wallet!.id,
          type: 'top_up',
          amount,
          balanceBefore: wallet!.balance,
          balanceAfter: Number(wallet!.balance) + amount,
          reference: `WT-TOPUP-${Date.now()}`,
          description: `Rechargement via ${method}`,
        },
      });

      return incremented;
    });

    const decimalFields = ['balance', 'amount'];
    const converted = convertDecimalFields(updatedWallet as unknown as Record<string, unknown>, decimalFields);

    return NextResponse.json({
      success: true,
      data: { wallet: converted },
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: error.statusCode }
      );
    }

    console.error('[WALLET] Erreur interne:', error);
    return NextResponse.json(
      { success: false, error: 'Erreur interne du serveur' },
      { status: 500 }
    );
  }
}
