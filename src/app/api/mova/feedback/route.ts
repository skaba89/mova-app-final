export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { validateBody, feedbackSchema } from '@/lib/validations';
import { errorLogger } from '@/lib/error-logger';
import { cache } from '@/lib/cache';
import { db } from '@/lib/db';

// ─── POST /api/mova/feedback — Submit feedback ──────────────────────────

export async function POST(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id');

    if (!userId) {
      return NextResponse.json({ success: false, error: 'Non autorisé' }, { status: 401 });
    }

    const body = await request.json();

    const validated = validateBody(feedbackSchema, body);
    if (!validated.success) {
      return NextResponse.json({ success: false, error: validated.error }, { status: 400 });
    }

    const { type, targetId, rating, comment, categories } = validated.data;

    const feedback = await db.feedback.create({
      data: {
        userId,
        type,
        targetId,
        rating,
        comment,
        categories: categories ? JSON.stringify(categories) : null,
      },
    });

    // Invalidate cached stats
    cache.del('feedback:stats');

    // Log as info
    errorLogger.logInfo(`Nouveau feedback soumis: ${feedback.id}`, {
      path: '/api/mova/feedback',
      method: 'POST',
      userId,
    });

    return NextResponse.json({
      success: true,
      data: { feedbackId: feedback.id },
      message: 'Merci pour votre retour !',
    }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erreur serveur';
    errorLogger.logError(error, { path: '/api/mova/feedback', method: 'POST' });
    return NextResponse.json(
      { success: false, error: `Erreur lors de la soumission du feedback: ${message}` },
      { status: 500 }
    );
  }
}

// ─── GET /api/mova/feedback?type=ride&targetId=xxx&minRating=3&page=1&limit=20 ──

export async function GET(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id');
    const userRole = request.headers.get('x-user-role');

    if (!userId) {
      return NextResponse.json({ success: false, error: 'Non autorisé' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const targetId = searchParams.get('targetId');
    const minRating = searchParams.get('minRating');
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);

    // Build Prisma where clause
    const where: Record<string, unknown> = {};

    // Non-admin users only see their own feedback
    if (userRole !== 'admin') {
      where.userId = userId;
    }

    // Apply filters
    if (type) {
      where.type = type;
    }
    if (targetId) {
      where.targetId = targetId;
    }
    if (minRating) {
      where.rating = {
        gte: parseInt(minRating, 10),
      };
    }

    // Get total count and average for matching records
    const [entries, aggResult] = await Promise.all([
      db.feedback.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.feedback.aggregate({
        where,
        _count: true,
        _avg: { rating: true },
      }),
    ]);

    const totalEntries = aggResult._count;
    const averageRating = Number(aggResult._avg.rating ?? 0);

    // Map entries to response format (parse categories from JSON string)
    const mappedEntries = entries.map((e) => ({
      id: e.id,
      userId: e.userId,
      type: e.type as 'ride' | 'delivery' | 'general',
      targetId: e.targetId,
      rating: e.rating,
      comment: e.comment,
      categories: e.categories ? JSON.parse(e.categories) : undefined,
      createdAt: e.createdAt.toISOString(),
    }));

    return NextResponse.json({
      success: true,
      data: mappedEntries,
      meta: {
        averageRating: Math.round(averageRating * 10) / 10,
        totalCount: totalEntries,
        page,
        limit,
        totalPages: Math.ceil(totalEntries / limit),
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erreur serveur';
    errorLogger.logError(error, { path: '/api/mova/feedback', method: 'GET' });
    return NextResponse.json(
      { success: false, error: `Erreur lors de la récupération des feedbacks: ${message}` },
      { status: 500 }
    );
  }
}
