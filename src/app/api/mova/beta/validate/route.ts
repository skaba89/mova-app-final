export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { errorLogger } from '@/lib/error-logger';

// ─── POST /api/mova/beta/validate — Validate a beta invite code ──────────

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { code } = body;

    if (!code || typeof code !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Code requis' },
        { status: 400 }
      );
    }

    const normalized = code.trim().toUpperCase();

    // Look up the BetaRegistration by inviteCode
    const registration = await db.betaRegistration.findFirst({
      where: { inviteCode: normalized },
    });

    // Not found
    if (!registration) {
      return NextResponse.json(
        { success: false, error: 'Code invalide ou expire' },
        { status: 400 }
      );
    }

    // Already used (invited = true means the code has been activated)
    if (registration.invited) {
      return NextResponse.json(
        { success: false, error: 'Ce code a deja ete utilise' },
        { status: 400 }
      );
    }

    errorLogger.logInfo(`Code beta valide: ${normalized} (${registration.email})`, {
      path: '/api/mova/beta/validate',
      method: 'POST',
    });

    return NextResponse.json({
      success: true,
      data: {
        valid: true,
        email: registration.email,
        position: registration.position,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erreur serveur';
    errorLogger.logError(error, { path: '/api/mova/beta/validate', method: 'POST' });
    return NextResponse.json(
      { success: false, error: `Erreur lors de la validation: ${message}` },
      { status: 500 }
    );
  }
}
