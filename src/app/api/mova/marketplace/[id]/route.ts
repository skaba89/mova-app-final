export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/mova/marketplace/[id]
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const listing = await db.listing.findUnique({
      where: { id },
    });

    if (!listing) {
      return NextResponse.json(
        { success: false, error: 'Annonce introuvable' },
        { status: 404 }
      );
    }

    // Increment views
    await db.listing.update({
      where: { id },
      data: { views: { increment: 1 } },
    });

    return NextResponse.json({
      success: true,
      data: { ...listing, views: listing.views + 1 },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erreur serveur';
    return NextResponse.json(
      { success: false, error: `Erreur lors de la récupération de l'annonce: ${message}` },
      { status: 500 }
    );
  }
}

// PATCH /api/mova/marketplace/[id]
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const existing = await db.listing.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Annonce introuvable' },
        { status: 404 }
      );
    }

    const updateData: Record<string, unknown> = {};
    const allowedFields = ['title', 'description', 'price', 'category', 'condition', 'images', 'location', 'lat', 'lng', 'status'];

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        if (field === 'images' && typeof body[field] === 'object') {
          updateData[field] = JSON.stringify(body[field]);
        } else if (field === 'price') {
          updateData[field] = Number(body[field]);
        } else if (field === 'lat' || field === 'lng') {
          updateData[field] = body[field] ? Number(body[field]) : null;
        } else {
          updateData[field] = body[field];
        }
      }
    }

    const listing = await db.listing.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      data: listing,
      message: 'Annonce mise à jour avec succès',
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erreur serveur';
    return NextResponse.json(
      { success: false, error: `Erreur lors de la mise à jour: ${message}` },
      { status: 500 }
    );
  }
}

// DELETE /api/mova/marketplace/[id]
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const existing = await db.listing.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Annonce introuvable' },
        { status: 404 }
      );
    }

    await db.listing.delete({ where: { id } });

    return NextResponse.json({
      success: true,
      message: 'Annonce supprimée avec succès',
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erreur serveur';
    return NextResponse.json(
      { success: false, error: `Erreur lors de la suppression: ${message}` },
      { status: 500 }
    );
  }
}
