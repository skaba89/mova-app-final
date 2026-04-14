import { NextRequest, NextResponse } from 'next/server';
import { SignJWT } from 'jose';
import bcrypt from 'bcryptjs';
import { db } from '@/lib/db';
import { validateRequest, AuthError } from '@/lib/mova/auth-middleware';
import { rateLimiter } from '@/lib/mova/rate-limit';
import { logAction, logSecurityEvent } from '@/lib/mova/audit-logger';
import { z } from 'zod/v4';

// JWT_SECRET - obligatoire en production, fallback en dev uniquement
const JWT_SECRET = process.env.JWT_SECRET || (process.env.NODE_ENV === 'production'
  ? (() => { throw new Error('JWT_SECRET obligatoire en production') })()
  : 'mova-dev-secret-key-2024');

const registerSchema = z.object({
  action: z.literal('register'),
  email: z.email('Adresse email invalide'),
  password: z.string().min(6, 'Le mot de passe doit contenir au moins 6 caracteres'),
  name: z.string().min(2, 'Le nom est requis'),
  phone: z.string().optional(),
});

const loginSchema = z.object({
  action: z.literal('login'),
  email: z.email('Adresse email invalide'),
  password: z.string().min(1, 'Le mot de passe est requis'),
});

const meSchema = z.object({
  action: z.literal('me'),
});

const authSchema = z.union([registerSchema, loginSchema, meSchema]);

async function generateToken(user: { id: string; email: string; role: string }): Promise<string> {
  const secret = new TextEncoder().encode(JWT_SECRET);
  return new SignJWT({ id: user.id, email: user.email, role: user.role })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(secret);
}

// POST /api/mova/auth
export async function POST(request: NextRequest) {
  try {
    // Rate limiting: 10 requetes par minute par IP
    const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'unknown';
    const rateCheck = rateLimiter.checkRequest(`auth:${clientIp}`, 10, 60_000);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { success: false, error: 'Trop de tentatives. Reessayez dans quelques instants.', retryAfterMs: rateCheck.retryAfterMs },
        { status: 429 }
      );
    }

    const body = await request.json();
    const parsed = authSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }

    const data = parsed.data;

    // Action: inscription
    if (data.action === 'register') {
      const existingUser = await db.user.findUnique({
        where: { email: data.email },
      });

      if (existingUser) {
        await logSecurityEvent({ action: 'register_duplicate', resource: 'user', resourceId: data.email, details: { ip: clientIp } });
        return NextResponse.json(
          { success: false, error: 'Un compte avec cet email existe deja' },
          { status: 409 }
        );
      }

      const hashedPassword = await bcrypt.hash(data.password, 12);

      const user = await db.user.create({
        data: {
          email: data.email,
          password: hashedPassword,
          name: data.name,
          phone: data.phone ?? null,
          role: 'client',
        },
        select: {
          id: true,
          email: true,
          name: true,
          phone: true,
          role: true,
          status: true,
          createdAt: true,
        },
      });

      const token = await generateToken(user);

      await logAction({ userId: user.id, action: 'register', resource: 'user', resourceId: user.id, details: { email: data.email, ip: clientIp } });

      return NextResponse.json({
        success: true,
        data: { user, token },
      });
    }

    // Action: connexion
    if (data.action === 'login') {
      const user = await db.user.findUnique({
        where: { email: data.email },
        select: {
          id: true,
          email: true,
          name: true,
          phone: true,
          role: true,
          status: true,
          password: true,
          createdAt: true,
        },
      });

      if (!user) {
        await logSecurityEvent({ action: 'login_failed', resource: 'auth', details: { email: data.email, reason: 'user_not_found', ip: clientIp } });
        return NextResponse.json(
          { success: false, error: 'Email ou mot de passe incorrect' },
          { status: 401 }
        );
      }

      if (user.status === 'suspended' || user.status === 'banned') {
        await logSecurityEvent({ action: 'login_blocked', resource: 'auth', resourceId: user.id, details: { email: data.email, status: user.status, ip: clientIp } });
        return NextResponse.json(
          { success: false, error: 'Compte desactive. Contactez le support.' },
          { status: 403 }
        );
      }

      if (!user.password) {
        return NextResponse.json(
          { success: false, error: 'Compte sans mot de passe. Connectez-vous via un autre moyen.' },
          { status: 400 }
        );
      }

      const isValid = await bcrypt.compare(data.password, user.password);
      if (!isValid) {
        await logSecurityEvent({ action: 'login_failed', resource: 'auth', resourceId: user.id, details: { email: data.email, reason: 'wrong_password', ip: clientIp } });
        return NextResponse.json(
          { success: false, error: 'Email ou mot de passe incorrect' },
          { status: 401 }
        );
      }

      const { password: _, ...userWithoutPassword } = user;
      const token = await generateToken(userWithoutPassword);

      await logAction({ userId: user.id, action: 'login', resource: 'auth', resourceId: user.id, details: { email: data.email, ip: clientIp } });

      return NextResponse.json({
        success: true,
        data: { user: userWithoutPassword, token },
      });
    }

    // Action: profil courant
    if (data.action === 'me') {
      const auth = await validateRequest(request);
      if (!auth.success) {
        return auth.response;
      }

      const user = await db.user.findUnique({
        where: { id: auth.user.id },
        select: {
          id: true,
          email: true,
          name: true,
          phone: true,
          role: true,
          status: true,
          createdAt: true,
        },
      });

      if (!user) {
        return NextResponse.json(
          { success: false, error: 'Utilisateur non trouve' },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        data: { user },
      });
    }

    return NextResponse.json(
      { success: false, error: 'Action non reconnue' },
      { status: 400 }
    );
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: error.statusCode }
      );
    }

    console.error('[AUTH] Erreur interne:', error);
    return NextResponse.json(
      { success: false, error: 'Erreur interne du serveur' },
      { status: 500 }
    );
  }
}
