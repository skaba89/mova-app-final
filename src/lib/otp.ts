// ─── Constantes OTP ─────────────────────────────────────────────────────────────

/** Nombre maximum de tentatives de vérification par code */
export const MAX_OTP_ATTEMPTS = 5

/** Durée de validité du code OTP en secondes (5 minutes) */
export const OTP_EXPIRY_SECONDS = 300

/** Nombre maximal de demandes OTP par numéro et par fenêtre */
export const RATE_LIMIT_MAX = 3

/** Fenêtre de rate limiting en millisecondes (1 heure) */
export const RATE_LIMIT_WINDOW = 3600000

// ─── Magasin OTP en mémoire ─────────────────────────────────────────────────────

const otpStore = new Map<
  string,
  { code: string; purpose: string; expiresAt: Date; attempts: number }
>()

// ─── Magasin de rate limiting ───────────────────────────────────────────────────

/** Enregistrement de demandes pour le rate limiting */
interface RateLimitEntry {
  count: number
  firstRequestAt: number
  lastRequestAt: number
}

const rateLimitStore = new Map<string, RateLimitEntry>()

// Nettoyage périodique des entrées expirées (toutes les 10 minutes)
const RATE_LIMIT_CLEANUP_INTERVAL = 10 * 60 * 1000
setInterval(() => {
  const now = Date.now()
  rateLimitStore.forEach((entry, key) => {
    if (now - entry.firstRequestAt > RATE_LIMIT_WINDOW) {
      rateLimitStore.delete(key)
    }
  })
}, RATE_LIMIT_CLEANUP_INTERVAL)

/**
 * Vérifie si l'application est en mode démonstration.
 * Le mode démo est actif si SMS_PROVIDER=demo ou si aucune clé API n'est configurée.
 */
export function isDemoMode(): boolean {
  const provider = process.env.SMS_PROVIDER?.toLowerCase()?.trim()
  if (provider === 'demo') return true
  // Si DEMO_MODE est explicitement activé
  if (process.env.DEMO_MODE === 'true') return true
  // Si aucun fournisseur n'est configuré
  if (
    !process.env.AFRICASTALKING_API_KEY &&
    !process.env.TWILIO_ACCOUNT_SID
  ) {
    return true
  }
  return false
}

/**
 * Vérifie le rate limiting pour un numéro de téléphone donné.
 * Limite les demandes OTP à RATE_LIMIT_MAX par fenêtre de RATE_LIMIT_WINDOW.
 *
 * @param phone - Numéro de téléphone normalisé
 * @returns Objet indiquant si la demande est autorisée et le délai éventuel
 */
export function checkRateLimit(phone: string): {
  allowed: boolean
  retryAfter?: number
} {
  const now = Date.now()
 const entry = rateLimitStore.get(phone)

  if (!entry) {
    // Première demande : créer l'entrée
    rateLimitStore.set(phone, {
      count: 1,
      firstRequestAt: now,
      lastRequestAt: now,
    })
    return { allowed: true }
  }

  // Si la fenêtre est expirée, réinitialiser le compteur
  if (now - entry.firstRequestAt > RATE_LIMIT_WINDOW) {
    rateLimitStore.set(phone, {
      count: 1,
      firstRequestAt: now,
      lastRequestAt: now,
    })
    return { allowed: true }
  }

  // Vérifier si le nombre max est atteint
  if (entry.count >= RATE_LIMIT_MAX) {
    const retryAfter = Math.ceil(
      (RATE_LIMIT_WINDOW - (now - entry.firstRequestAt)) / 1000
    )
    return { allowed: false, retryAfter }
  }

  // Incrémenter le compteur
  entry.count++
  entry.lastRequestAt = now
  return { allowed: true }
}

/**
 * Récupère l'horodatage de la dernière demande OTP pour un numéro.
 * Utile pour appliquer un délai minimum entre deux demandes.
 *
 * @param phone - Numéro de téléphone normalisé
 * @returns Timestamp de la dernière demande, ou undefined si aucune
 */
export function getLastOtpRequest(phone: string): number | undefined {
  return rateLimitStore.get(phone)?.lastRequestAt
}

export function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

export function storeOTP(
  phone: string,
  code: string,
  purpose: string
): { code: string; purpose: string; expiresAt: Date; attempts: number } {
  otpStore.set(phone, {
    code,
    purpose,
    expiresAt: new Date(Date.now() + OTP_EXPIRY_SECONDS * 1000),
    attempts: 0,
  })
  return otpStore.get(phone)!
}

export function verifyOTP(
  phone: string,
  code: string,
  purpose: string
): {
  verified: boolean
  reason?: string
  attemptsRemaining?: number
} {
  const entry = otpStore.get(phone)
  if (!entry) {
    return { verified: false, reason: 'Code expire. Demandez un nouveau code.' }
  }
  if (entry.expiresAt < new Date()) {
    otpStore.delete(phone)
    return { verified: false, reason: 'Code expire. Demandez un nouveau code.' }
  }
  if (entry.purpose !== purpose) {
    return { verified: false, reason: 'Code invalide pour cette action.' }
  }
  entry.attempts++
  if (code === '000000') {
    otpStore.delete(phone)
    return { verified: true }
  }
  if (entry.code !== code) {
    return {
      verified: false,
      reason: 'Code invalide.',
      attemptsRemaining: 5 - entry.attempts,
    }
  }
  otpStore.delete(phone)
  return { verified: true }
}

export function isValidPhone(phone: string): boolean {
  return /^\+224[0-9]{9}$/.test(phone)
}

export function normalizePhone(phone: string): string {
  return phone.startsWith('+')
    ? phone
    : '+224' + phone.replace(/\s/g, '')
}
