import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const runtime = 'nodejs';

/**
 * @deprecated Use POST /api/mova/auth/login instead (proper JWT auth)
 * This legacy demo endpoint is kept for backward compatibility but requires DEMO_MODE=true.
 */
export async function POST(request: NextRequest) {
  // Block unless DEMO_MODE is explicitly enabled
  if (process.env.DEMO_MODE !== 'true') {
    return NextResponse.json(
      { success: false, error: 'Cet endpoint est désactivé en production. Utilisez /api/mova/auth/login.' },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const { email } = body;

    if (!email) {
      return NextResponse.json(
        { success: false, error: 'Email est requis' },
        { status: 400 }
      );
    }

    const user = await db.user.findUnique({
      where: { email },
      include: {
        vehicles: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Utilisateur non trouvé' },
        { status: 404 }
      );
    }

    // Strip password from response
    const { password: _password, ...safeUser } = user;

    return NextResponse.json({
      success: true,
      data: safeUser,
      _deprecated: true,
      _note: 'Utilisez POST /api/mova/auth/login pour une authentification sécurisée avec JWT.',
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erreur serveur';
    console.error('Legacy auth error:', error instanceof Error ? error.message : error);
    return NextResponse.json(
      { success: false, error: 'Erreur de connexion au serveur' },
      { status: 500 }
    );
  }
}
