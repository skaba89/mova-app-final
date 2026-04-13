import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify } from 'jose'

// Types d'utilisateurs autorises
export type UserRole = 'admin' | 'chauffeur' | 'client' | 'restaurant' | 'commercant' | 'gestionnaire_flotte' | 'support_agent' | 'operateur_validation' | 'compte_entreprise' | 'coursier'

// Classe d'erreur d'authentification (utilisee par les routes API)
export class AuthError extends Error {
  statusCode: number
  constructor(message: string, statusCode: number = 401) {
    super(message)
    this.name = 'AuthError'
    this.statusCode = statusCode
  }
}

// Structure de l'utilisateur extrait du JWT
export interface AuthUser {
  id: string
  email: string
  role: UserRole
}

// Resultat de la validation de requete
export type ValidationResult =
  | { success: true; user: AuthUser }
  | { success: false; response: NextResponse }

// Secret JWT depuis les variables d'environnement
function getJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET
  if (!secret) {
    throw new Error('JWT_SECRET non defini dans les variables d\'environnement')
  }
  return new TextEncoder().encode(secret)
}

// Extraire le token Bearer de l'en-tete Authorization
function extractBearerToken(request: NextRequest): string | null {
  const authHeader = request.headers.get('authorization')
  if (!authHeader) return null

  const parts = authHeader.split(' ')
  if (parts.length !== 2 || parts[0] !== 'Bearer') return null

  return parts[1]
}

// Valider une requete HTTP : extraire et verifier le JWT
export async function validateRequest(request: NextRequest): Promise<ValidationResult> {
  try {
    const token = extractBearerToken(request)

    if (!token) {
      return {
        success: false,
        response: NextResponse.json(
          { error: 'Token d\'authentification manquant' },
          { status: 401 }
        ),
      }
    }

    const secret = getJwtSecret()
    const { payload } = await jwtVerify(token, secret)

    const user: AuthUser = {
      id: (payload.sub ?? payload.id) as string,
      email: payload.email as string,
      role: payload.role as UserRole,
    }

    if (!user.id || !user.email || !user.role) {
      return {
        success: false,
        response: NextResponse.json(
          { error: 'Payload JWT invalide : champs manquants' },
          { status: 401 }
        ),
      }
    }

    return { success: true, user }
  } catch (error) {
    if (error instanceof Error && error.message.includes('JWT_SECRET')) {
      return {
        success: false,
        response: NextResponse.json(
          { error: 'Erreur de configuration du serveur' },
          { status: 500 }
        ),
      }
    }

    return {
      success: false,
      response: NextResponse.json(
        { error: 'Token invalide ou expire' },
        { status: 401 }
      ),
    }
  }
}

// Verifier que l'utilisateur est authentifie, sinon renvoyer une erreur
export async function requireAuth(request: NextRequest): Promise<AuthUser | NextResponse> {
  const result = await validateRequest(request)

  if (!result.success) {
    return result.response
  }

  return result.user
}

// Verifier que l'utilisateur est administrateur
export async function requireAdmin(request: NextRequest): Promise<AuthUser | NextResponse> {
  const result = await requireAuth(request)

  if (result instanceof NextResponse) {
    return result
  }

  if (result.role !== 'admin') {
    return NextResponse.json(
      { error: 'Acces refuse : privileges administrateur requis' },
      { status: 403 }
    )
  }

  return result
}

// Verifier que l'utilisateur a l'un des roles specifies
export function requireRole(
  roles: UserRole[]
): (request: NextRequest) => Promise<AuthUser | NextResponse> {
  return async (request: NextRequest): Promise<AuthUser | NextResponse> => {
    const result = await requireAuth(request)

    if (result instanceof NextResponse) {
      return result
    }

    if (!roles.includes(result.role)) {
      return NextResponse.json(
        {
          error: 'Acces refuse : role insuffisant',
          requiredRoles: roles,
          currentRole: result.role,
        },
        { status: 403 }
      )
    }

    return result
  }
}
