import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const runtime = 'nodejs';

type RouteContext = {
  params: Promise<{ id: string }>;
};

// PATCH /api/mova/zones/[id]
export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    const { isActive } = body;

    const existing = await db.zone.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Zone introuvable' },
        { status: 404 }
      );
    }

    const updateData: Record<string, unknown> = {};
    if (isActive !== undefined) updateData.isActive = isActive;

    const zone = await db.zone.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      data: zone,
      message: isActive !== undefined
        ? `Zone ${isActive ? 'activée' : 'désactivée'}`
        : 'Zone mise à jour',
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erreur serveur';
    console.error('Update zone error:', error instanceof Error ? error.message : error);
    return NextResponse.json(
      { success: false, error: `Erreur lors de la mise à jour de la zone: ${message}` },
      { status: 500 }
    );
  }
}
