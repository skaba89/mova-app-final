import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { z } from 'zod/v4'

export const runtime = 'nodejs'

// GET /api/mova/wallet/mobile-money/status?transactionId=xxx&userId=xxx
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const transactionId = searchParams.get('transactionId')
    const userId = searchParams.get('userId')

    if (!transactionId || !userId) {
      return NextResponse.json(
        { success: false, error: 'transactionId et userId sont requis' },
        { status: 400 }
      )
    }

    const wallet = await db.wallet.findUnique({ where: { userId } })
    if (!wallet) {
      return NextResponse.json(
        { success: false, error: 'Portefeuille non trouve' },
        { status: 404 }
      )
    }

    // Find the latest transaction matching reference
    const transaction = await db.walletTransaction.findFirst({
      where: {
        walletId: wallet.id,
        reference: transactionId,
      },
      orderBy: { createdAt: 'desc' },
    })

    if (!transaction) {
      return NextResponse.json(
        { success: false, error: 'Transaction non trouvee' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: {
        transactionId,
        reference: transaction.reference,
        status: transaction.status,
        amount: transaction.amount,
        currency: 'GNF',
        provider: transaction.provider,
        balance: transaction.balance,
        createdAt: transaction.createdAt,
      },
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erreur serveur'
    console.error('MM status error:', message)
    return NextResponse.json(
      { success: false, error: 'Erreur serveur' },
      { status: 500 }
    )
  }
}
