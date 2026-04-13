import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth, AuthError } from '@/lib/mova/auth-middleware';
import { z } from 'zod/v4';

const transferSchema = z.object({
  toUserId: z.string().min(1, 'L\'identifiant du destinataire est requis'),
  amount: z.number().positive('Le montant doit etre positif').max(1000000, 'Montant maximum par transfert : 1 000 000 GNF'),
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

// POST /api/mova/wallet/transfer
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;
    const body = await request.json();

    const parsed = transferSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }

    const { toUserId, amount } = parsed.data;
    const fromUserId = auth.id; // Toujours utiliser l'ID de l'utilisateur authentifie

    // Interdiction de se transferer a soi-meme
    if (fromUserId === toUserId) {
      return NextResponse.json(
        { success: false, error: 'Impossible de transferrer a votre propre compte' },
        { status: 400 }
      );
    }

    // Verification de l'existence du portefeuille emetteur
    const fromWallet = await db.wallet.findUnique({
      where: { userId: fromUserId },
    });

    if (!fromWallet) {
      return NextResponse.json(
        { success: false, error: 'Portefeuille source non trouve' },
        { status: 404 }
      );
    }

    // Verifier que le portefeuille n'est pas gele
    if (fromWallet.isFrozen) {
      return NextResponse.json(
        { success: false, error: 'Votre portefeuille est gele. Contactez le support.' },
        { status: 403 }
      );
    }

    // Verification de l'existence du destinataire
    const toUser = await db.user.findUnique({
      where: { id: toUserId },
      select: { id: true, name: true, status: true },
    });

    if (!toUser) {
      return NextResponse.json(
        { success: false, error: 'Destinataire non trouve' },
        { status: 404 }
      );
    }

    if (toUser.status === 'suspended' || toUser.status === 'banned') {
      return NextResponse.json(
        { success: false, error: 'Le destinataire a un compte desactive' },
        { status: 400 }
      );
    }

    // Recuperer ou creer le portefeuille du destinataire
    let toWallet = await db.wallet.findUnique({
      where: { userId: toUserId },
    });

    if (!toWallet) {
      toWallet = await db.wallet.create({
        data: {
          userId: toUserId,
          balance: 0,
          currency: 'GNF',
        },
      });
    }

    // Transaction atomique : verifier solde + debiter + crediter
    const result = await db.$transaction(async (tx) => {
      // Re-verifier le solde a l'interieur de la transaction (evite les race conditions)
      const currentWallet = await tx.wallet.findUnique({
        where: { id: fromWallet.id },
      });
      if (!currentWallet || Number(currentWallet.balance) < amount) {
        throw new Error('Solde insuffisant pour effectuer ce transfert');
      }

      // Debiter l'emetteur
      const debitedWallet = await tx.wallet.update({
        where: { id: fromWallet.id },
        data: { balance: { decrement: amount } },
      });

      // Crediter le destinataire
      const creditedWallet = await tx.wallet.update({
        where: { id: toWallet.id },
        data: { balance: { increment: amount } },
      });

      // Creer la transaction de debit
      const debitTransaction = await tx.walletTransaction.create({
        data: {
          walletId: fromWallet.id,
          type: 'transfer_out',
          amount,
          balanceBefore: fromWallet.balance,
          balanceAfter: Number(fromWallet.balance) - amount,
          reference: `WT-OUT-${Date.now()}`,
          description: `Transfert a ${toUser.name}`,
        },
      });

      // Creer la transaction de credit
      const creditTransaction = await tx.walletTransaction.create({
        data: {
          walletId: toWallet.id,
          type: 'transfer_in',
          amount,
          balanceBefore: toWallet.balance,
          balanceAfter: Number(toWallet.balance) + amount,
          reference: `WT-IN-${Date.now()}`,
          description: `Transfert recu`,
        },
      });

      return { debitedWallet, creditedWallet, debitTransaction, creditTransaction };
    });

    const decimalFields = ['balance', 'amount'];
    const convertedDebited = convertDecimalFields(result.debitedWallet as unknown as Record<string, unknown>, decimalFields);
    const convertedCredited = convertDecimalFields(result.creditedWallet as unknown as Record<string, unknown>, decimalFields);

    return NextResponse.json({
      success: true,
      data: {
        wallet: convertedDebited,
        transfer: {
          toUserId,
          toUserName: toUser.name,
          amount,
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

    console.error('[WALLET_TRANSFER] Erreur interne:', error);
    return NextResponse.json(
      { success: false, error: 'Erreur interne du serveur' },
      { status: 500 }
    );
  }
}
