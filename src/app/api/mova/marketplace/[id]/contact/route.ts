export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// POST /api/mova/marketplace/[id]/contact — Send contact request
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { buyerName, buyerPhone, message } = body;

    const listing = await db.listing.findUnique({
      where: { id },
    });

    if (!listing) {
      return NextResponse.json(
        { success: false, error: 'Annonce introuvable' },
        { status: 404 }
      );
    }

    if (!buyerName || !buyerPhone) {
      return NextResponse.json(
        { success: false, error: 'Nom et téléphone de l\'acheteur sont requis' },
        { status: 400 }
      );
    }

    // In a real app, this would send a notification to the seller
    // For now, we return the seller's contact info
    return NextResponse.json({
      success: true,
      data: {
        sellerName: listing.sellerName,
        sellerPhone: listing.sellerPhone,
        listingTitle: listing.title,
        message: 'Demande de contact envoyée avec succès. Vous pouvez contacter le vendeur directement.',
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erreur serveur';
    return NextResponse.json(
      { success: false, error: `Erreur lors de l'envoi de la demande: ${message}` },
      { status: 500 }
    );
  }
}
