import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

export const runtime = 'nodejs';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SettingsPayload {
  baseFareStandard?: number;
  baseFarePremium?: number;
  baseFareVan?: number;
  perKmRateStandard?: number;
  perKmRatePremium?: number;
  perKmRateVan?: number;
  surgeMultiplierMax?: number;
  commissionRate?: number;
  platformName?: string;
  contactEmail?: string;
  supportPhone?: string;
  notifyPush?: boolean;
  notifySMS?: boolean;
  notifyEmail?: boolean;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SETTINGS_FILE = path.join(process.cwd(), '.data', 'settings.json');

async function ensureDataDir() {
  const dir = path.dirname(SETTINGS_FILE);
  try {
    await fs.access(dir);
  } catch {
    await fs.mkdir(dir, { recursive: true });
  }
}

// ---------------------------------------------------------------------------
// GET Handler — return current settings
// ---------------------------------------------------------------------------

export async function GET() {
  try {
    await ensureDataDir();
    let settings: Record<string, unknown> = {};
    try {
      const raw = await fs.readFile(SETTINGS_FILE, 'utf-8');
      settings = JSON.parse(raw);
    } catch {
      // No file yet — return defaults
      settings = {
        baseFareStandard: 5000,
        baseFarePremium: 10000,
        baseFareVan: 8000,
        perKmRateStandard: 1200,
        perKmRatePremium: 1800,
        perKmRateVan: 1000,
        surgeMultiplierMax: 3.0,
        commissionRate: 15,
        platformName: "MOVA",
        contactEmail: "contact@mova.gn",
        supportPhone: "+224 622 00 00 00",
        notifyPush: true,
        notifySMS: true,
        notifyEmail: true,
      };
    }

    return NextResponse.json({ success: true, data: settings });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erreur serveur';
    console.error('[SETTINGS] GET error:', message);
    return NextResponse.json(
      { success: false, error: 'Erreur lors de la lecture des parametres' },
      { status: 500 },
    );
  }
}

// ---------------------------------------------------------------------------
// PUT Handler — save settings
// ---------------------------------------------------------------------------

export async function PUT(request: NextRequest) {
  try {
    const body: SettingsPayload = await request.json();

    if (!body || typeof body !== 'object') {
      return NextResponse.json(
        { success: false, error: 'Payload invalide' },
        { status: 400 },
      );
    }

    await ensureDataDir();
    const payload = {
      ...body,
      updatedAt: new Date().toISOString(),
    };
    await fs.writeFile(SETTINGS_FILE, JSON.stringify(payload, null, 2), 'utf-8');

    return NextResponse.json({
      success: true,
      message: 'Paramètres sauvegardés avec succès',
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erreur serveur';
    console.error('[SETTINGS] PUT error:', message);
    return NextResponse.json(
      { success: false, error: 'Erreur lors de la sauvegarde des parametres' },
      { status: 500 },
    );
  }
}
