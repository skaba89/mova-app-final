export const runtime = 'nodejs';

import { NextResponse } from 'next/server';

// ─── GET /api/mova/notifications/vapid-key — Return VAPID public key ─────

export async function GET() {
  try {
    const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || process.env.VAPID_PUBLIC_KEY;

    if (!publicKey) {
      return NextResponse.json(
        { success: false, error: 'Push notifications non configurees' },
        { status: 503 }
      );
    }

    return NextResponse.json({
      success: true,
      data: { publicKey },
    });
  } catch {
    return NextResponse.json(
      { success: false, error: 'Erreur lors de la recuperation de la cle VAPID' },
      { status: 500 }
    );
  }
}
