export const runtime = 'nodejs';

import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { validateRequest } from '@/lib/mova/auth-middleware';

// POST /api/mova/wallet/transfer
// Supports both toUserId (legacy) and toPhone (new) for recipient resolution.
// Fee calculation: MOVA wallet = 1%, mobile money = 2%. Fee is deducted from amount.
export async function POST(request: NextRequest) {
  try {
    const auth = await validateRequest(request);
    if (!auth.success) return auth.response;

    // C4 fix: always use authenticated user ID, never trust body.fromUserId
    const authenticatedUserId = auth.user.id;

    const body = await request.json();
    const { toUserId, toPhone, amount, reason, feeType } = body;

    if ((!toUserId && !toPhone) || !amount) {
      return NextResponse.json(
        { success: false, error: 'Le destinataire et le montant sont requis' },
        { status: 400 }
      );
    }

    if (amount <= 0) {
      return NextResponse.json(
        { success: false, error: 'Le montant doit être supérieur à zéro' },
        { status: 400 }
      );
    }

    // Resolve recipient: either by userId directly or by phone lookup
    let resolvedToUserId = toUserId;
    let recipientUser = null;

    if (toPhone && !toUserId) {
      // Normalize phone: strip spaces, dashes, and leading +224 or 224
      const normalizedPhone = toPhone.replace(/[\s\-]/g, '').replace(/^(\+?224)/, '');
      const phonePatterns = [
        normalizedPhone,                          // 6XXXXXXXX
        `+224${normalizedPhone}`,                  // +2246XXXXXXXX
        `224${normalizedPhone}`,                   // 2246XXXXXXXX
      ];

      recipientUser = await db.user.findFirst({
        where: { phone: { in: phonePatterns } },
        select: { id: true, name: true, phone: true },
      });

      if (!recipientUser) {
        return NextResponse.json(
          { success: false, error: 'Destinataire introuvable. Vérifiez le numéro de téléphone.' },
          { status: 404 }
        );
      }

      resolvedToUserId = recipientUser.id;
    }

    if (!resolvedToUserId) {
      return NextResponse.json(
        { success: false, error: 'Le destinataire est requis' },
        { status: 400 }
      );
    }

    if (authenticatedUserId === resolvedToUserId) {
      return NextResponse.json(
        { success: false, error: 'Vous ne pouvez pas effectuer un transfert vers votre propre portefeuille' },
        { status: 400 }
      );
    }

    // Calculate fee
    const resolvedFeeType = feeType || 'mova'; // 'mova' = 1%, 'mobile_money' = 2%
    const feeRate = resolvedFeeType === 'mobile_money' ? 0.02 : 0.01;
    const fee = Math.ceil(amount * feeRate);
    const totalDebit = amount + fee;

    // Find or create both wallets
    const [senderWallet, recipientWallet] = await Promise.all([
      db.wallet.findUnique({ where: { userId: authenticatedUserId } }),
      db.wallet.findUnique({ where: { userId: resolvedToUserId } }),
    ]);

    if (!senderWallet) {
      return NextResponse.json(
        { success: false, error: 'Portefeuille de l\'expéditeur introuvable' },
        { status: 404 }
      );
    }

    if (!recipientWallet) {
      // Auto-create recipient wallet
      await db.wallet.create({ data: { userId: resolvedToUserId } });
    }

    if (!senderWallet.isActive) {
      return NextResponse.json(
        { success: false, error: 'Votre portefeuille est désactivé' },
        { status: 400 }
      );
    }

    // Check sufficient balance (amount + fee)
    if (Number(senderWallet.balance) < totalDebit) {
      return NextResponse.json(
        {
          success: false,
          error: `Solde insuffisant. Solde actuel: ${Number(senderWallet.balance).toLocaleString('fr-FR')} GNF. Montant total (frais inclus): ${totalDebit.toLocaleString('fr-FR')} GNF`,
          code: 'INSUFFICIENT_BALANCE',
        },
        { status: 400 }
      );
    }

    const reference = `TRF-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    const reasonText = reason || 'Transfert d\'argent';

    // Perform transfer in a transaction with atomic balance check (BUG-011 fix)
    const result = await db.$transaction(async (tx) => {
      // Re-read sender wallet inside transaction to prevent race condition
      const freshSender = await tx.wallet.findUnique({ where: { id: senderWallet.id } });
      if (!freshSender || !freshSender.isActive) {
        throw new Error('Portefeuille de l\'expediteur introuvable ou desactive');
      }
      if (Number(freshSender.balance) < totalDebit) {
        throw new Error('Solde insuffisant pour effectuer ce transfert');
      }

      // Debit sender (amount + fee)
      const senderNewBalance = Number(freshSender.balance) - totalDebit;
      const debitTx = await tx.walletTransaction.create({
        data: {
          walletId: senderWallet.id,
          type: 'transfer_out',
          amount,
          balance: senderNewBalance,
          description: `${reasonText} vers ${recipientUser?.name || resolvedToUserId.substring(0, 8)} (${feeType === 'mobile_money' ? 'Mobile Money' : 'Portefeuille MOVA'})`,
          method: feeType === 'mobile_money' ? 'mobile_money' : 'transfer',
          reference: `${reference}-OUT`,
          status: 'completed',
        },
      });

      // Create fee transaction
      if (fee > 0) {
        await tx.walletTransaction.create({
          data: {
            walletId: senderWallet.id,
            type: 'debit',
            amount: fee,
            balance: senderNewBalance,
            description: `Frais de transfert (${feeType === 'mobile_money' ? '2%' : '1%'})`,
            method: 'system',
            reference: `${reference}-FEE`,
            status: 'completed',
          },
        });
      }

      await tx.wallet.update({
        where: { id: freshSender.id },
        data: { balance: { decrement: totalDebit } },
      });

      // Get recipient wallet (may have been created)
      const recipient = await tx.wallet.findUnique({ where: { userId: resolvedToUserId } });
      if (!recipient) throw new Error('Portefeuille du destinataire introuvable');

      // Credit recipient (receives full amount, fee is on sender)
      const recipientNewBalance = Number(recipient.balance) + amount;
      const creditTx = await tx.walletTransaction.create({
        data: {
          walletId: recipient.id,
          type: 'transfer_in',
          amount,
          balance: recipientNewBalance,
          description: `${reasonText} de ${auth.user.name}`,
          method: feeType === 'mobile_money' ? 'mobile_money' : 'transfer',
          reference: `${reference}-IN`,
          status: 'completed',
        },
      });
      await tx.wallet.update({
        where: { id: recipient.id },
        data: { balance: { increment: amount } },
      });

      return { debitTx, creditTx };
    });

    // Fetch sender user name for description
    const senderUser = await db.user.findUnique({
      where: { id: authenticatedUserId },
      select: { name: true },
    });

    if (!recipientUser) {
      recipientUser = await db.user.findUnique({
        where: { id: resolvedToUserId },
        select: { id: true, name: true, phone: true },
      });
    }

    // M2 fix: fetch fresh wallet balances after transaction instead of using pre-transaction snapshot
    const [freshSenderWallet] = await Promise.all([
      db.wallet.findUnique({ where: { userId: authenticatedUserId } }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        reference,
        amount,
        fee,
        feeType,
        totalDebit,
        reason: reasonText,
        currency: freshSenderWallet?.currency ?? senderWallet.currency,
        sender: {
          userId: authenticatedUserId,
          name: senderUser?.name,
          newBalance: freshSenderWallet ? Number(freshSenderWallet.balance) : 0,
        },
        recipient: {
          userId: resolvedToUserId,
          name: recipientUser?.name,
          phone: recipientUser?.phone,
        },
        debitTransaction: result.debitTx.id,
        creditTransaction: result.creditTx.id,
        completedAt: new Date().toISOString(),
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erreur serveur';
    return NextResponse.json(
      { success: false, error: `Erreur lors du transfert: ${message}` },
      { status: 500 }
    );
  }
}
