import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/mova/zones
// Endpoint public - pas d'authentification requise
export async function GET() {
  try {
    const zones = await db.zone.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json({
      success: true,
      data: { zones },
    });
  } catch (error) {
    console.error('[ZONES] Erreur interne:', error);
    return NextResponse.json(
      { success: false, error: 'Erreur interne du serveur' },
      { status: 500 }
    );
  }
}
