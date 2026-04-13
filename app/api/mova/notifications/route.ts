import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth, AuthError } from '@/lib/mova/auth-middleware';
import { z } from 'zod/v4';

const createNotificationSchema = z.object({
  type: z.enum(['ride_update', 'payment', 'promotion', 'system', 'alert']),
  title: z.string().min(1, 'Le titre est requis').max(200),
  message: z.string().min(1, 'Le message est requis').max(1000),
  data: z.record(z.unknown()).optional(),
  userId: z.string().optional(),
});

// GET /api/mova/notifications
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    const { searchParams } = new URL(request.url);

    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') ?? '20', 10)));
    const skip = (page - 1) * limit;
    const unreadOnly = searchParams.get('unreadOnly') === 'true';

    const where: Record<string, unknown> = {
      userId: auth.id,
    };

    if (unreadOnly) {
      where.isRead = false;
    }

    const [notifications, total] = await Promise.all([
      db.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      db.notification.count({ where }),
    ]);

    // Compter le total des non-lues (toutes les pages)
    const unreadCount = await db.notification.count({
      where: {
        userId: auth.id,
        isRead: false,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        notifications,
        unreadCount,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: error.statusCode }
      );
    }

    console.error('[NOTIFICATIONS] Erreur interne:', error);
    return NextResponse.json(
      { success: false, error: 'Erreur interne du serveur' },
      { status: 500 }
    );
  }
}

// POST /api/mova/notifications
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    const body = await request.json();

    const parsed = createNotificationSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }

    const { type, title, message, data, userId } = parsed.data;

    // L'admin peut envoyer a n'importe quel utilisateur
    // Les utilisateurs normaux ne peuvent envoyer qu'a eux-memes
    const targetUserId = (auth.role === 'admin' && userId)
      ? userId
      : auth.id;

    const notification = await db.notification.create({
      data: {
        userId: targetUserId,
        type,
        title,
        message,
        data: data ? JSON.stringify(data) : null,
      },
    });

    return NextResponse.json(
      { success: true, data: { notification } },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: error.statusCode }
      );
    }

    console.error('[NOTIFICATIONS] Erreur interne:', error);
    return NextResponse.json(
      { success: false, error: 'Erreur interne du serveur' },
      { status: 500 }
    );
  }
}
