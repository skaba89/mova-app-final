export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/mova/marketplace?category=&location=&search=&sort=&condition=&minPrice=&maxPrice=
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const location = searchParams.get('location');
    const search = searchParams.get('search');
    const sort = searchParams.get('sort') || 'recent';
    const condition = searchParams.get('condition');
    const minPrice = searchParams.get('minPrice');
    const maxPrice = searchParams.get('maxPrice');
    const status = searchParams.get('status') || 'active';

    const where: Record<string, unknown> = { status };

    if (category && category !== 'all') {
      where.category = category;
    }

    if (location && location !== 'all') {
      where.location = location;
    }

    if (search) {
      where.OR = [
        { title: { contains: search } },
        { description: { contains: search } },
      ];
    }

    if (condition) {
      where.condition = condition;
    }

    if (minPrice) {
      where.price = { ...(where.price as Record<string, unknown> || {}), gte: Number(minPrice) };
    }

    if (maxPrice) {
      where.price = { ...(where.price as Record<string, unknown> || {}), lte: Number(maxPrice) };
    }

    // Build orderBy
    let orderBy: Record<string, string> = { createdAt: 'desc' };
    if (sort === 'price_asc') orderBy = { price: 'asc' };
    else if (sort === 'price_desc') orderBy = { price: 'desc' };
    else if (sort === 'recent') orderBy = { createdAt: 'desc' };
    else if (sort === 'popular') orderBy = { views: 'desc' };

    const listings = await db.listing.findMany({
      where,
      orderBy,
      take: 50,
    });

    return NextResponse.json({
      success: true,
      data: listings,
      count: listings.length,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erreur serveur';
    return NextResponse.json(
      { success: false, error: `Erreur lors de la récupération des annonces: ${message}` },
      { status: 500 }
    );
  }
}

// POST /api/mova/marketplace — Create listing
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      title,
      description,
      price,
      category,
      condition,
      images,
      location,
      lat,
      lng,
      sellerId,
      sellerName,
      sellerPhone,
    } = body;

    if (!title || !price || !category || !location || !sellerId || !sellerName || !sellerPhone) {
      return NextResponse.json(
        { success: false, error: 'Titre, prix, catégorie, localisation et informations vendeur sont requis' },
        { status: 400 }
      );
    }

    const validCategories = ['electronics', 'fashion', 'immobilier', 'services', 'alimentation', 'emplois', 'vehicules', 'maison'];
    if (!validCategories.includes(category)) {
      return NextResponse.json(
        { success: false, error: `Catégorie invalide. Options: ${validCategories.join(', ')}` },
        { status: 400 }
      );
    }

    const validConditions = ['neuf', 'occasion', 'reconditionné'];
    if (condition && !validConditions.includes(condition)) {
      return NextResponse.json(
        { success: false, error: `Condition invalide. Options: ${validConditions.join(', ')}` },
        { status: 400 }
      );
    }

    const listing = await db.listing.create({
      data: {
        title,
        description: description || null,
        price: Number(price),
        currency: 'GNF',
        category,
        condition: condition || 'occasion',
        images: images ? JSON.stringify(images) : null,
        location,
        lat: lat ? Number(lat) : null,
        lng: lng ? Number(lng) : null,
        sellerId,
        sellerName,
        sellerPhone,
        sellerRating: 0,
        status: 'active',
      },
    });

    return NextResponse.json({
      success: true,
      data: listing,
      message: 'Annonce publiée avec succès',
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erreur serveur';
    return NextResponse.json(
      { success: false, error: `Erreur lors de la création de l'annonce: ${message}` },
      { status: 500 }
    );
  }
}

// DELETE /api/mova/marketplace — Delete listing
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Identifiant de l\'annonce requis' },
        { status: 400 }
      );
    }

    const listing = await db.listing.findUnique({
      where: { id },
    });

    if (!listing) {
      return NextResponse.json(
        { success: false, error: 'Annonce introuvable' },
        { status: 404 }
      );
    }

    await db.listing.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: 'Annonce supprimee avec succes',
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erreur serveur';
    return NextResponse.json(
      { success: false, error: `Erreur lors de la suppression: ${message}` },
      { status: 500 }
    );
  }
}
