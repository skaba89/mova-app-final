import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify } from 'jose'
import { rateLimiter } from '@/lib/rate-limit-advanced'

// ─── JWT Secret ───────────────────────────────────────────────────────────────

function getMiddlewareJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET
  if (!secret || secret.length < 32) {
    // Fail closed: reject all authenticated requests if JWT_SECRET is not set
    throw new Error('JWT_SECRET non defini. Impossible de verifier les tokens.')
  }
  return new TextEncoder().encode(secret)
}

let _jwtSecret: Uint8Array | null = null
function getJWT_SECRET(): Uint8Array {
  if (!_jwtSecret) _jwtSecret = getMiddlewareJwtSecret()
  return _jwtSecret
}

// ─── Limites de debit par type de route ─────────────────────────────────────

const GENERAL_RATE_LIMIT = 100   // requetes par fenetre (general)
const API_RATE_LIMIT = 30        // requetes par fenetre (API)
const AUTH_RATE_LIMIT = 5        // requetes par fenetre (authentification)
const RATE_LIMIT_WINDOW_MS = 60_000 // 1 minute

// ─── Public Routes (no auth required) ────────────────────────────────────────

const PUBLIC_PATHS = [
  'auth/login',
  'auth/register',
  'auth/demo',
  'auth/otp',
  'auth/otp/verify',
  'fare',
  'zones',
  'health',
  'beta',
  'assistant',
  'loyalty',
  'promotions',
  'referrals/leaderboard',
  'notifications/subscribe',
  'notifications/push',
]

function isPublicRoute(pathname: string, method?: string): boolean {
  // Extract the path after /api/mova/
  const movaPath = pathname.replace(/^\/api\/mova\//, '')

  // marketplace GET is public (POST/DELETE/PATCH require auth)
  if (movaPath === 'marketplace' || movaPath.startsWith('marketplace?')) {
    return true
  }
  if (movaPath.startsWith('marketplace/') && method === 'GET') {
    return true
  }

  // promotions GET is public (promotions POST is not)
  if (movaPath === 'promotions' || movaPath.startsWith('promotions?')) {
    return true
  }

  // notifications/subscribe and notifications/push are public
  if (movaPath.startsWith('notifications/subscribe') || movaPath.startsWith('notifications/push')) {
    return true
  }

  return PUBLIC_PATHS.some((p) => movaPath === p || movaPath.startsWith(p + '/'))
}

// ─── Admin Routes ─────────────────────────────────────────────────────────────

const ADMIN_PATHS = ['analytics', 'admin', 'incidents']

function isAdminRoute(pathname: string, method: string): boolean {
  const movaPath = pathname.replace(/^\/api\/mova\//, '')
  // incidents POST requires admin
  if (movaPath.startsWith('incidents') && method === 'POST') return true
  return ADMIN_PATHS.some((p) => movaPath === p || movaPath.startsWith(p + '/'))
}

// ─── Middleware ───────────────────────────────────────────────────────────────

export async function middleware(request: NextRequest) {
  const response = NextResponse.next()
  const pathname = request.nextUrl.pathname

  // 1. Limitation de debit (rate limiting) via AdvancedRateLimiter
  //    En cas d'echec du limiteur, on laisse passer la requete (fail-open)
  try {
    let prefix = 'ip:'
    let maxRequests = GENERAL_RATE_LIMIT

    if (pathname.startsWith('/api/mova/auth')) {
      // Authentification : limite stricte pour eviter les attaques brute-force
      prefix = 'login:'
      maxRequests = AUTH_RATE_LIMIT
    } else if (pathname.startsWith('/api/')) {
      prefix = 'api:'
      maxRequests = API_RATE_LIMIT
    }

    const rateLimitResult = rateLimiter.checkRequest(request, prefix, {
      maxRequests,
      windowMs: RATE_LIMIT_WINDOW_MS,
    })

    if (!rateLimitResult.allowed) {
      const retryAfter = Math.ceil(
        (rateLimitResult.resetAt - Date.now()) / 1000
      )
      return new NextResponse('Trop de requetes. Reessayez plus tard.', {
        status: 429,
        headers: { 'Retry-After': String(retryAfter) },
      })
    }
  } catch {
    // En cas d'erreur du limiteur, on continue (fail-open)
    // Le middleware ne doit jamais bloquer le trafic legitimate
  }

  // 2. Security Headers
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('X-XSS-Protection', '1; mode=block')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  response.headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(self)'
  )
  response.headers.set('X-DNS-Prefetch-Control', 'on')

  // HSTS — Force HTTPS in production (1 year, include subdomains)
  if (process.env.NODE_ENV === 'production') {
    response.headers.set(
      'Strict-Transport-Security',
      'max-age=31536000; includeSubDomains; preload'
    )
  }

  // Content-Security-Policy — restrict resource loading
  response.headers.set(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; " +
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
    "font-src 'self' https://fonts.gstatic.com; " +
    "img-src 'self' data: blob: https:; " +
    "connect-src 'self' https: wss:; " +
    "frame-ancestors 'none'; base-uri 'self'; form-action 'self'"
  )

  // 3. CORS for API routes — configurable origins (not wildcard)
  if (pathname.startsWith('/api/')) {
    const allowedOrigins = process.env.ALLOWED_ORIGINS
      ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
      : ['http://localhost:3000'] // development default

    const origin = request.headers.get('origin') || ''
    const matchedOrigin = allowedOrigins.find(allowed =>
      allowed === origin || allowed === '*'
    )

    if (matchedOrigin) {
      response.headers.set('Access-Control-Allow-Origin', matchedOrigin)
    }
    response.headers.set('Vary', 'Origin')
    response.headers.set(
      'Access-Control-Allow-Methods',
      'GET, POST, PUT, PATCH, DELETE, OPTIONS'
    )
    response.headers.set(
      'Access-Control-Allow-Headers',
      'Content-Type, Authorization, X-Request-ID'
    )
    response.headers.set('Access-Control-Max-Age', '86400')

    if (request.method === 'OPTIONS') {
      return new NextResponse(null, { status: 204, headers: response.headers })
    }
  }

  // 4. Cache-Control for static assets
  if (pathname.match(/\.(js|css|png|jpg|jpeg|svg|ico|woff2?)$/)) {
    response.headers.set(
      'Cache-Control',
      'public, max-age=31536000, immutable'
    )
  }

  // 5. Non-API, non-static pages: no-store
  if (
    !pathname.startsWith('/api/') &&
    !pathname.startsWith('/_next/') &&
    !pathname.startsWith('/icons/')
  ) {
    response.headers.set('Cache-Control', 'no-store')
  }

  // 6. JWT Authentication for /api/mova/* routes
  if (pathname.startsWith('/api/mova/')) {
    // Skip auth for public routes
    if (isPublicRoute(pathname, request.method)) {
      return response
    }

    // Verify Bearer token
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { success: false, error: 'Token d\'authentification requis' },
        { status: 401 }
      )
    }

    const token = authHeader.substring(7).trim()
    try {
      const { payload } = await jwtVerify(token, getJWT_SECRET())
      const userId = (payload as Record<string, unknown>).userId as string
      const role = (payload as Record<string, unknown>).role as string

      if (!userId || !role) {
        return NextResponse.json(
          { success: false, error: 'Token invalide' },
          { status: 401 }
        )
      }

      // Check admin routes
      if (isAdminRoute(pathname, request.method) && role !== 'admin') {
        return NextResponse.json(
          {
            success: false,
            error: 'Acces refuse. Droits administrateur requis.',
          },
          { status: 403 }
        )
      }

      // Forward auth info via headers for downstream handlers
      response.headers.set('x-user-id', userId)
      response.headers.set('x-user-role', role)
      response.headers.set('x-user-email', String(payload.email || ''))
    } catch {
      return NextResponse.json(
        { success: false, error: 'Token expire ou invalide' },
        { status: 401 }
      )
    }
  }

  return response
}

export const config = {
  matcher: ['/api/mova/:path*'],
}
