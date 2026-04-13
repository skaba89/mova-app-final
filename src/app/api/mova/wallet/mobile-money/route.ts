import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { z } from 'zod/v4'

export const runtime = 'nodejs'

const mobileMoneySchema = z.object({
  userId: z.string().min(1, 'userId requis'),
  amount: z.number().positive('Le montant doit etre positif').min(100, 'Montant minimum: 100 GNF').max(5000000, 'Montant maximum: 5 000 000 GNF'),
  provider: z.enum(['orange_money', 'mtn'], 'Operateur invalide'),
  phoneNumber: z.string().regex(/^\+224[67]\d{8}$/, 'Format de numero invalide (+224 XXX XXX XXX)'),
  purpose: z.string().min(1, 'Objet du paiement requis').max(100),
})

// POST /api/mova/wallet/mobile-money — initiate mobile money topup
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, amount, provider, phoneNumber, purpose } =
      mobileMoneySchema.parse(body)

    // Check wallet exists and is active
    let wallet = await db.wallet.findUnique({ where: { userId } })
    if (!wallet) {
      wallet = await db.wallet.create({ data: { userId } })
    }

    if (!wallet.isActive) {
      return NextResponse.json(
        {
          success: false,
          error: 'Votre portefeuille est desactive. Contactez le support.',
        },
        { status: 403 }
      )
    }

    // Generate transaction details
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '')
    const randomSuffix = Math.random().toString(36).substring(2, 7).toUpperCase()
    const providerPrefix = provider === 'orange_money' ? 'OM' : 'MTN'
    const reference = `${providerPrefix}-${dateStr}-${randomSuffix}`
    const transactionId = `txn-${Date.now()}-${randomSuffix.toLowerCase()}`

    // Create pending transaction in DB
    await db.walletTransaction.create({
      data: {
        walletId: wallet.id,
        type: 'credit',
        amount,
        balance: wallet.balance,
        method: 'mobile_money',
        provider: provider === 'orange_money' ? 'Orange Money' : 'MTN Mobile Money',
        reference,
        description: `${purpose} (en attente)`,
        status: 'pending',
      },
    })

    // Simulate auto-completion after 3-5 seconds
    setTimeout(async () => {
      try {
        const success = Math.random() < 0.95
        if (success) {
          const newBalance = Number(wallet.balance) + amount
          await db.$transaction([
            db.walletTransaction.updateMany({
              where: { walletId: wallet.id, reference, status: 'pending' },
              data: { status: 'completed', balance: newBalance },
            }),
            db.wallet.update({
              where: { id: wallet.id },
              data: { balance: newBalance },
            }),
          ])
        } else {
          await db.walletTransaction.updateMany({
            where: { walletId: wallet.id, reference, status: 'pending' },
            data: { status: 'failed' },
          })
        }
      } catch {
        // Transaction resolution failed silently
      }
    }, 3000 + Math.random() * 2000)

    return NextResponse.json(
      {
        success: true,
        data: {
          transactionId,
          reference,
          provider,
          amount,
          currency: 'GNF',
          phoneNumber,
          status: 'processing',
          message: 'Veuillez confirmer le paiement sur votre telephone',
        },
      },
      { status: 201 }
    )
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: error.issues[0]?.message || 'Donnees invalides' },
        { status: 400 }
      )
    }
    const message = error instanceof Error ? error.message : 'Erreur serveur'
    console.error('Mobile money error:', message)
    return NextResponse.json(
      { success: false, error: 'Erreur lors de l\'initiation du paiement' },
      { status: 500 }
    )
  }
}
