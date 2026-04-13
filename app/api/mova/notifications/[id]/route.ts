import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth, AuthError } from '@/lib/mova/auth-middleware';

// PATCH /api/mova/notifications/[id]
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(request);
    const { id } = await params;
    const body = await request.json();

    // Verification que le corps contient isRead: true
    if (body.isRead !== true) {
      return NextResponse.json(
        { success: false, error: 'Seule la marquage comme lu est supporte' },
        { status: 400 }
      );
    }

    // Verification de l'existence de la notification
    const notification = await db.notification.findUnique({
      where: { id },
    });

    if (!notification) {
      return NextResponse.json(
        { success: false, error: 'Notification non trouvee' },
        { status: 404 }
      );
    }

    // Verification de l'appartenance
    if (notification.userId !== auth.user.id && auth.user.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'Acces refuse a cette notification' },
        { status: 403 }
      );
    }

    const updated = await db.notification.update({
      where: { id },
      data: { isRead: true },
    });

    return NextResponse.json({
      success: true,
      data: { notification: updated },
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: error.statusCode }
      );
    }

    console.error('[NOTIFICATION] Erreur interne:', error);
    return NextResponse.json(
      { success: false, error: 'Erreur interne du serveur' },
      { status: 500 }
    );
  }
}
