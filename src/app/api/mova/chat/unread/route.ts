export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// ─── GET /api/mova/chat/unread?userId=xxx — Get unread message counts ─

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'userId est requis' },
        { status: 400 }
      );
    }

    const unreadCounts = await db.chatMessage.groupBy({
      by: ['rideId'],
      where: {
        receiverId: userId,
        read: false,
      },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
    });

    const result = unreadCounts.map((item) => ({
      rideId: item.rideId,
      unreadCount: item._count.id,
    }));

    return NextResponse.json({ success: true, data: result });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erreur serveur';
    return NextResponse.json(
      { success: false, error: `Erreur lors du chargement des messages non lus: ${message}` },
      { status: 500 }
    );
  }
}
