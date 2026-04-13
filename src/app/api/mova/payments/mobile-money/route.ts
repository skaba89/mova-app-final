export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// Shared payment status type
type PaymentStatus = {
  status: 'processing' | 'completed' | 'failed';
  userId: string;
  amount: number;
  provider: string;
  phoneNumber: string;
  purpose: string;
  reference: string;
  createdAt: number;
  completedAt?: number;
  walletId?: string;
  newBalance?: number;
};

// Global singleton for cross-module access (status/[transactionId] route)
declare global {
  var __movaPaymentStatuses__: Map<string, PaymentStatus>;
}

// In-memory store for simulated payment statuses (cleared on server restart)
if (!globalThis.__movaPaymentStatuses__) {
  globalThis.__movaPaymentStatuses__ = new Map<string, PaymentStatus>();
}
const paymentStatuses = globalThis.__movaPaymentStatuses__;

// Auto-resolve pending payments after a simulated delay (3-5s)
function schedulePaymentResolution(transactionId: string) {
  const delay = 3000 + Math.random() * 2000; // 3-5 seconds
  setTimeout(() => {
    const payment = paymentStatuses.get(transactionId);
    if (payment && payment.status === 'processing') {
      // 95% success rate simulation
      const success = Math.random() < 0.95;
      payment.status = success ? 'completed' : 'failed';
      payment.completedAt = Date.now();

      if (success) {
        // Update wallet balance in DB
        db.wallet.findUnique({ where: { userId: payment.userId } })
          .then((wallet) => {
            if (wallet && wallet.isActive) {
              const newBalance = Number(wallet.balance) + Number(payment.amount);
              payment.walletId = wallet.id;
              payment.newBalance = newBalance;

              db.$transaction([
                db.walletTransaction.create({
                  data: {
                    walletId: wallet.id,
                    type: 'credit',
                    amount: payment.amount,
                    balance: newBalance,
                    method: 'mobile_money',
                    provider: payment.provider,
                    reference: payment.reference,
                    description: payment.purpose,
                    status: 'completed',
                  },
                }),
                db.wallet.update({
                  where: { id: wallet.id },
                  data: { balance: { increment: payment.amount } },
                }),
              ]).catch(() => {
                // Transaction failed - mark payment as failed
                payment.status = 'failed';
              });
            }
          })
          .catch(() => {
            payment.status = 'failed';
          });
      }
    }
  }, delay);
}

// POST /api/mova/payments/mobile-money
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, amount, provider, phoneNumber, purpose } = body;

    // Validate required fields
    if (!userId || !amount || !provider || !phoneNumber || !purpose) {
      return NextResponse.json(
        { success: false, error: 'Tous les champs sont requis (userId, amount, provider, phoneNumber, purpose)' },
        { status: 400 }
      );
    }

    // Validate amount
    if (typeof amount !== 'number' || amount <= 0) {
      return NextResponse.json(
        { success: false, error: 'Le montant doit etre un nombre positif' },
        { status: 400 }
      );
    }

    if (amount < 100) {
      return NextResponse.json(
        { success: false, error: 'Le montant minimum est de 100 GNF' },
        { status: 400 }
      );
    }

    if (amount > 5000000) {
      return NextResponse.json(
        { success: false, error: 'Le montant maximum est de 5 000 000 GNF' },
        { status: 400 }
      );
    }

    // Validate provider
    const validProviders = ['orange_money', 'mtn'];
    if (!validProviders.includes(provider)) {
      return NextResponse.json(
        { success: false, error: 'Operateur invalide. Choisissez orange_money ou mtn' },
        { status: 400 }
      );
    }

    // Validate phone number format: +224 6XX or +224 7XX
    const phoneRegex = /^\+224\s?[67]\d{2}\s?\d{2}\s?\d{2}\s?\d{2}$/;
    if (!phoneRegex.test(phoneNumber)) {
      return NextResponse.json(
        { success: false, error: 'Format de numero invalide. Utilisez +224 6XX XX XX XX ou +224 7XX XX XX XX' },
        { status: 400 }
      );
    }

    // Validate purpose
    const validPurposes = ['Recharge wallet', 'Paiement course', 'Paiement livraison', 'Transfert', 'Autre'];
    if (!validPurposes.includes(purpose)) {
      return NextResponse.json(
        { success: false, error: `Objet de paiement invalide. Choisissez parmi: ${validPurposes.join(', ')}` },
        { status: 400 }
      );
    }

    // Check wallet exists and is active
    let wallet = await db.wallet.findUnique({ where: { userId } });
    if (!wallet) {
      wallet = await db.wallet.create({ data: { userId } });
    }

    if (!wallet.isActive) {
      return NextResponse.json(
        { success: false, error: 'Votre portefeuille est desactive. Contactez le support.' },
        { status: 403 }
      );
    }

    // Generate transaction details
    const timestamp = new Date();
    const dateStr = timestamp.toISOString().slice(0, 10).replace(/-/g, '');
    const randomSuffix = Math.random().toString(36).substring(2, 7).toUpperCase();
    const providerPrefix = provider === 'orange_money' ? 'OM' : 'MTN';
    const reference = `${providerPrefix}-${dateStr}-${randomSuffix}`;
    const transactionId = `txn-${Date.now()}-${randomSuffix.toLowerCase()}`;

    // Store payment status in memory
    paymentStatuses.set(transactionId, {
      status: 'processing',
      userId,
      amount,
      provider,
      phoneNumber,
      purpose,
      reference,
      createdAt: Date.now(),
    });

    // Create a pending WalletTransaction (will be updated on completion)
    await db.walletTransaction.create({
      data: {
        walletId: wallet.id,
        type: 'credit',
        amount,
        balance: wallet.balance, // will be updated on completion
        method: 'mobile_money',
        provider: provider === 'orange_money' ? 'Orange Money' : 'MTN Mobile Money',
        reference,
        description: `${purpose} via Mobile Money (en attente)`,
        status: 'pending',
      },
    });

    // Schedule simulated resolution
    schedulePaymentResolution(transactionId);

    return NextResponse.json({
      success: true,
      data: {
        transactionId,
        provider,
        amount,
        currency: 'GNF',
        phoneNumber,
        status: 'processing',
        message: 'Veuillez confirmer le paiement sur votre telephone',
        reference,
        estimatedWaitSeconds: 30,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erreur serveur';
    return NextResponse.json(
      { success: false, error: `Erreur lors de l'initiation du paiement: ${message}` },
      { status: 500 }
    );
  }
}

// GET /api/mova/payments/mobile-money?transactionId=xxx
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const transactionId = searchParams.get('transactionId');

    if (!transactionId) {
      return NextResponse.json(
        { success: false, error: 'L\'identifiant de transaction est requis' },
        { status: 400 }
      );
    }

    const payment = paymentStatuses.get(transactionId);

    if (!payment) {
      return NextResponse.json(
        { success: false, error: 'Transaction non trouvee' },
        { status: 404 }
      );
    }

    const elapsed = Date.now() - payment.createdAt;
    const estimatedWaitRemaining = Math.max(0, 30 - Math.floor(elapsed / 1000));

    return NextResponse.json({
      success: true,
      data: {
        transactionId,
        provider: payment.provider,
        amount: payment.amount,
        currency: 'GNF',
        phoneNumber: payment.phoneNumber,
        status: payment.status,
        reference: payment.reference,
        purpose: payment.purpose,
        newBalance: payment.newBalance,
        estimatedWaitRemaining: payment.status === 'processing' ? estimatedWaitRemaining : 0,
        createdAt: payment.createdAt,
        completedAt: payment.completedAt,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erreur serveur';
    return NextResponse.json(
      { success: false, error: `Erreur lors de la verification du statut: ${message}` },
      { status: 500 }
    );
  }
}
