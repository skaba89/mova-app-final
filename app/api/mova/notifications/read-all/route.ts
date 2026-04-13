import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth, AuthError } from '@/lib/mova/auth-middleware';

// POST /api/mova/notifications/read-all
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request);

    const result = await db.notification.updateMany({
      where: {
        userId: auth.id,
        isRead: false,
      },
      data: {
        isRead: true,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        message: `${result.count} notification(s) marquee(s) comme lue(s)`,
        count: result.count,
      },
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: error.statusCode }
      );
    }

    console.error('[NOTIFICATIONS_READ_ALL] Erreur interne:', error);
    return NextResponse.json(
      { success: false, error: 'Erreur interne du serveur' },
      { status: 500 }
    );
  }
}
