export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { validateBody, betaRegisterSchema } from '@/lib/validations';
import { errorLogger } from '@/lib/error-logger';
import { cache } from '@/lib/cache';
import { db } from '@/lib/db';

// ─── Beta Program Config ───────────────────────────────────────────────

const BETA_CONFIG = {
  launchDate: '2025-09-01T00:00:00.000Z',
  isOpen: true,
  maxInvitesPerBatch: 100,
};

// ─── Helpers ───────────────────────────────────────────────────────────

/** Generate a random alphanumeric string of given length */
function generateRandomCode(length: number): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/** Generate a unique invite code (checks DB for uniqueness) */
async function generateInviteCode(): Promise<string> {
  let code: string;
  let exists: boolean;
  do {
    code = `MOVA-BETA-${generateRandomCode(6)}`;
    exists = (await db.betaRegistration.count({ where: { inviteCode: code } })) > 0;
  } while (exists);
  return code;
}

// ─── POST /api/mova/beta — Register for beta ───────────────────────────

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const validated = validateBody(betaRegisterSchema, body);
    if (!validated.success) {
      return NextResponse.json({ success: false, error: validated.error }, { status: 400 });
    }

    const { email, name, phone, referralCode } = validated.data;

    // Check if email already registered
    const existing = await db.betaRegistration.findFirst({
      where: { email: email.toLowerCase().trim() },
    });

    if (existing) {
      return NextResponse.json({
        success: true,
        data: {
          inviteCode: existing.inviteCode,
          position: existing.position,
          alreadyRegistered: true,
        },
        message: 'Cet email est déjà inscrit au programme bêta.',
      });
    }

    // Check if beta is open
    if (!BETA_CONFIG.isOpen) {
      return NextResponse.json(
        { success: false, error: 'Le programme bêta est actuellement fermé' },
        { status: 403 }
      );
    }

    // Validate referral code if provided
    let referredById: string | undefined;
    if (referralCode) {
      const referrer = await db.betaRegistration.findFirst({
        where: { inviteCode: referralCode },
      });
      if (!referrer) {
        return NextResponse.json(
          { success: false, error: 'Code de parrainage invalide' },
          { status: 400 }
        );
      }
      referredById = referrer.id;
    }

    // Generate unique invite code
    const inviteCode = await generateInviteCode();

    // Calculate position (queue position = total registrations + 1)
    const position = (await db.betaRegistration.count()) + 1;

    // Create registration in database
    await db.betaRegistration.create({
      data: {
        email: email.toLowerCase().trim(),
        name,
        phone,
        inviteCode,
        referralCode: referralCode || null,
        referredById,
        invited: false,
        position,
      },
    });

    // Invalidate cached stats
    cache.del('beta:status');

    errorLogger.logInfo(`Nouvelle inscription bêta: ${email} (${inviteCode})`, {
      path: '/api/mova/beta',
      method: 'POST',
    });

    return NextResponse.json({
      success: true,
      data: {
        inviteCode,
        position,
        invited: false,
      },
      message: `Bienvenue dans le programme bêta ! Votre code d'invitation: ${inviteCode}`,
    }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erreur serveur';
    errorLogger.logError(error, { path: '/api/mova/beta', method: 'POST' });
    return NextResponse.json(
      { success: false, error: `Erreur lors de l'inscription bêta: ${message}` },
      { status: 500 }
    );
  }
}

// ─── GET /api/mova/beta — Get beta program status ──────────────────────

export async function GET() {
  try {
    // Try cache first
    const cached = cache.get<{
      totalRegistered: number;
      totalInvited: number;
      launchDate: string;
      isOpen: boolean;
    }>('beta:status');

    if (cached) {
      return NextResponse.json({ success: true, data: cached });
    }

    // Calculate stats from database
    const totalRegistered = await db.betaRegistration.count();
    const totalInvited = await db.betaRegistration.count({ where: { invited: true } });

    const data = {
      totalRegistered,
      totalInvited,
      launchDate: BETA_CONFIG.launchDate,
      isOpen: BETA_CONFIG.isOpen,
    };

    // Cache for 60 seconds
    cache.set('beta:status', data, 60);

    return NextResponse.json({ success: true, data });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erreur serveur';
    errorLogger.logError(error, { path: '/api/mova/beta', method: 'GET' });
    return NextResponse.json(
      { success: false, error: `Erreur lors de la récupération du statut bêta: ${message}` },
      { status: 500 }
    );
  }
}
