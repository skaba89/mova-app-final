import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth, AuthError } from '@/lib/mova/auth-middleware';
import { rateLimiter } from '@/lib/mova/rate-limit';
import { logAction } from '@/lib/mova/audit-logger';
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

    // Rate limiting: 5 rechargements par minute
    const rateCheck = rateLimiter.checkRequest(`wallet_topup:${auth.id}`, 5, 60_000);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { success: false, error: 'Trop de tentatives de rechargement. Reessayez plus tard.' },
        { status: 429 }
      );
    }

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

    // Verifier que le portefeuille n'est pas gele
    if (wallet.isFrozen) {
      return NextResponse.json(
        { success: false, error: 'Votre portefeuille est gele. Contactez le support.' },
        { status: 403 }
      );
    }

    // Mode sandbox: simuler la verification paiement (production: integration Orange Money, MTN MoMo, Wave)
    const isSandbox = process.env.NODE_ENV !== 'production';
    const paymentRef = `PAY-${method.toUpperCase()}-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    const paymentVerified = isSandbox; // En production, verifier via l'API du fournisseur

    if (!paymentVerified) {
      return NextResponse.json(
        { success: false, error: 'Verification de paiement echouee. Veuillez reessayer.' },
        { status: 402 }
      );
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
          description: `Rechargement via ${method}${isSandbox ? ' (sandbox)' : ''}`,
        },
      });

      return incremented;
    });

    await logAction({ userId: auth.id, action: 'wallet_topup', resource: 'wallet', resourceId: wallet.id, details: { amount, method, sandbox: isSandbox } });

    const decimalFields = ['balance', 'amount'];
    const converted = convertDecimalFields(updatedWallet as unknown as Record<string, unknown>, decimalFields);

    return NextResponse.json({
      success: true,
      data: { wallet: converted, sandbox: isSandbox },
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
