export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';

// Shared payment status type (must match the parent route declaration)
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

declare global {
  var __movaPaymentStatuses__: Map<string, PaymentStatus>;
}

// GET /api/mova/payments/mobile-money/status/[transactionId]
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ transactionId: string }> }
) {
  try {
    const { transactionId } = await params;

    if (!transactionId) {
      return NextResponse.json(
        { success: false, error: 'L\'identifiant de transaction est requis' },
        { status: 400 }
      );
    }

    // Access the shared payment statuses from the parent route
    // In a real app, this would be a database lookup
    // For the simulation, we check the global store or return a simulated status
    const payment = globalThis.__movaPaymentStatuses__?.get(transactionId);

    if (!payment) {
      // For the demo, return a mock completed status if transaction looks valid
      if (transactionId.startsWith('txn-')) {
        return NextResponse.json({
          success: true,
          data: {
            transactionId,
            provider: 'orange_money',
            amount: 0,
            currency: 'GNF',
            phoneNumber: '+224 6XX XX XX XX',
            status: 'expired',
            reference: 'N/A',
            purpose: 'N/A',
            newBalance: 0,
            estimatedWaitRemaining: 0,
            message: 'Cette transaction a expire ou n\'existe pas dans cette session',
          },
        });
      }

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
        message:
          payment.status === 'processing'
            ? 'Veuillez confirmer le paiement sur votre telephone'
            : payment.status === 'completed'
              ? 'Paiement effectue avec succes'
              : 'Le paiement a echoue. Veuillez reessayer.',
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
