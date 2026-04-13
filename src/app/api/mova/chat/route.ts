export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { validateRequest } from '@/lib/mova/auth-middleware';

// ─── Validation Schema ────────────────────────────────────────────────

const messageTypes = ['text', 'image', 'location', 'system'] as const;

const sendMessageSchema = z.object({
  rideId: z.string().min(1, 'rideId est requis'),
  senderId: z.string().min(1, 'senderId est requis'),
  receiverId: z.string().min(1, 'receiverId est requis'),
  content: z.string().min(1, 'Le contenu du message est requis'),
  type: z.enum(messageTypes).optional().default('text'),
});

// ─── POST /api/mova/chat — Send a message ─────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const auth = await validateRequest(request);
    if (!auth.success) return auth.response;
    const body = await request.json();
    const parsed = sendMessageSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues?.[0]?.message || 'Donnees invalides' },
        { status: 400 }
      );
    }

    const { rideId, senderId, receiverId, content, type } = parsed.data;

    // Create the message
    const message = await db.chatMessage.create({
      data: {
        rideId,
        senderId,
        receiverId,
        content,
        type,
      },
      include: {
        sender: { select: { id: true, name: true, avatar: true } },
        receiver: { select: { id: true, name: true, avatar: true } },
      },
    });

    // Mark unread messages from the receiver as read
    await db.chatMessage.updateMany({
      where: {
        rideId,
        senderId: receiverId,
        receiverId: senderId,
        read: false,
      },
      data: { read: true },
    });

    return NextResponse.json({ success: true, data: message }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erreur serveur';
    return NextResponse.json(
      { success: false, error: `Erreur lors de l'envoi du message: ${message}` },
      { status: 500 }
    );
  }
}

// ─── GET /api/mova/chat?rideId=xxx&userId=xxx — Get messages ──────────

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const rideId = searchParams.get('rideId');
    const userId = searchParams.get('userId');

    if (!rideId || !userId) {
      return NextResponse.json(
        { success: false, error: 'rideId et userId sont requis' },
        { status: 400 }
      );
    }

    const messages = await db.chatMessage.findMany({
      where: {
        rideId,
        OR: [
          { senderId: userId },
          { receiverId: userId },
        ],
      },
      orderBy: { createdAt: 'asc' },
      take: 100,
      include: {
        sender: { select: { id: true, name: true, avatar: true } },
        receiver: { select: { id: true, name: true, avatar: true } },
      },
    });

    return NextResponse.json({ success: true, data: messages });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erreur serveur';
    return NextResponse.json(
      { success: false, error: `Erreur lors du chargement des messages: ${message}` },
      { status: 500 }
    );
  }
}
