import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/mova/auth-middleware'
import db from '@/lib/db'
import { z } from 'zod/v4'

// Utilitaire de conversion Decimal vers Number
function num(value: unknown): number | null {
  if (value === null || value === undefined) return null
  return Number(value)
}

// GET /api/mova/bookings/[id] - Recuperer une reservation
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(request)
    if (auth instanceof NextResponse) return auth

    const { id } = await params

    const booking = await db.booking.findUnique({
      where: { id },
    })

    if (!booking) {
      return NextResponse.json(
        { success: false, error: 'Reservation introuvable' },
        { status: 404 }
      )
    }

    // Verifier que l'utilisateur est le proprietaire ou un admin
    if (booking.userId !== auth.id && auth.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'Acces refuse' },
        { status: 403 }
      )
    }

    const convertedBooking = {
      ...booking,
      estimatedFare: num(booking.estimatedFare),
      pickupLat: num(booking.pickupLat),
      pickupLng: num(booking.pickupLng),
      dropoffLat: num(booking.dropoffLat),
      dropoffLng: num(booking.dropoffLng),
    }

    return NextResponse.json({
      success: true,
      data: { booking: convertedBooking },
    })
  } catch (error) {
    console.error('[BOOKINGS] Erreur lors de la recuperation:', error)
    return NextResponse.json(
      { success: false, error: 'Erreur interne du serveur' },
      { status: 500 }
    )
  }
}
