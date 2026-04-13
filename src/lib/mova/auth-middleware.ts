import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { db } from '@/lib/db';

/**
 * Authentication result from validateRequest
 */
interface AuthResult {
  success: true;
  user: {
    id: string;
    name: string;
    email: string;
    phone: string;
    role: string;
    avatar?: string | null;
    isOnline: boolean;
    rating: number;
    zone?: string | null;
  };
}

interface AuthError {
  success: false;
  response: NextResponse;
}

type AuthValidation = AuthResult | AuthError;

/**
 * Validates an authenticated request by verifying a JWT Bearer token.
 * The token must contain userId, email, and role in its payload.
 *
 * Security improvements (Phase 1):
 * - Only accepts JWT tokens from Authorization header (no query param / body fallback)
 * - Verifies token signature and expiration via jose/jwtVerify
 * - Rejects expired or tampered tokens
 *
 * @param request - The incoming Next.js request
 * @param allowedRoles - Optional array of roles that are allowed (e.g., ['admin', 'driver'])
 * @returns AuthResult if valid, AuthError with a NextResponse to return if invalid
 */
export async function validateRequest(
  request: NextRequest,
  allowedRoles?: string[]
): Promise<AuthValidation> {
  try {
    // Only accept Bearer token from Authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return {
        success: false,
        response: NextResponse.json(
          { success: false, error: 'Authentification requise. Fournissez un token JWT valide.' },
          { status: 401 }
        ),
      };
    }

    const token = authHeader.substring(7).trim();

    // Verify JWT token (checks signature, expiration, and payload)
    const payload = await verifyToken(token);
    if (!payload || !payload.userId || !payload.role) {
      return {
        success: false,
        response: NextResponse.json(
          { success: false, error: 'Token invalide ou expiré.' },
          { status: 401 }
        ),
      };
    }

    const userId = payload.userId;

    // Look up user in database to ensure account still exists and is active
    const user = await db.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        avatar: true,
        isOnline: true,
        rating: true,
        zone: true,
        isActive: true,
      },
    });

    if (!user) {
      return {
        success: false,
        response: NextResponse.json(
          { success: false, error: 'Utilisateur non trouvé.' },
          { status: 401 }
        ),
      };
    }

    // Check if account is active
    if (!user.isActive) {
      return {
        success: false,
        response: NextResponse.json(
          { success: false, error: 'Compte désactivé. Contactez le support.' },
          { status: 403 }
        ),
      };
    }

    // Check role-based access
    if (allowedRoles && allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
      return {
        success: false,
        response: NextResponse.json(
          {
            success: false,
            error: `Accès refusé. Rôle requis: ${allowedRoles.join(', ')}. Votre rôle: ${user.role}`,
          },
          { status: 403 }
        ),
      };
    }

    // Return user without isActive field
    const { isActive: _ia, ...safeUser } = user;
    return { success: true, user: safeUser };
  } catch {
    return {
      success: false,
      response: NextResponse.json(
        { success: false, error: 'Erreur lors de la validation de l\'authentification.' },
        { status: 401 }
      ),
    };
  }
}

/**
 * Helper to require admin role on a route
 */
export async function requireAdmin(request: NextRequest): Promise<AuthValidation> {
  return validateRequest(request, ['admin']);
}

/**
 * Helper to require driver role on a route
 */
export async function requireDriver(request: NextRequest): Promise<AuthValidation> {
  return validateRequest(request, ['driver']);
}

/**
 * Helper to require passenger or driver role on a route
 */
export async function requirePassengerOrDriver(request: NextRequest): Promise<AuthValidation> {
  return validateRequest(request, ['passenger', 'driver']);
}
