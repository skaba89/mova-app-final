import { NextRequest, NextResponse } from 'next/server'
import {
  generateOTP,
  storeOTP,
  isValidPhone,
  normalizePhone,
  checkRateLimit,
  isDemoMode,
  getLastOtpRequest,
} from '@/lib/otp'
import { sendSMS } from '@/lib/sms'
import { z } from 'zod/v4'

export const runtime = 'nodejs'

const otpRequestSchema = z.object({
  phone: z.string().min(1, 'Numero de telephone requis'),
  purpose: z.enum(['login', 'register', 'reset', 'verify']).default('login'),
})

/** Délai minimum entre deux demandes OTP (60 secondes) */
const OTP_COOLDOWN_MS = 60_000

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { phone, purpose } = otpRequestSchema.parse(body)

    const normalized = normalizePhone(phone)

    if (!isValidPhone(normalized)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Format de numero invalide. Utilisez le format +224 XXX XXX XXX',
        },
        { status: 400 }
      )
    }

    // ─── Vérification du rate limiting ─────────────────────────────────────
    const rateCheck = checkRateLimit(normalized)
    if (!rateCheck.allowed) {
      console.warn(
        `[OTP] Rate limit atteint pour ${normalized}. retryAfter: ${rateCheck.retryAfter}s`
      )
      return NextResponse.json(
        {
          success: false,
          error: `Trop de demandes. Réessayez dans ${rateCheck.retryAfter} secondes.`,
          retryAfter: rateCheck.retryAfter,
        },
        { status: 429 }
      )
    }

    // ─── Vérification du cooldown ──────────────────────────────────────────
    const lastRequest = getLastOtpRequest(normalized)
    if (lastRequest) {
      const elapsed = Date.now() - lastRequest
      const cooldownRemaining = Math.ceil((OTP_COOLDOWN_MS - elapsed) / 1000)
      if (elapsed < OTP_COOLDOWN_MS) {
        console.warn(
          `[OTP] Cooldown actif pour ${normalized}. Attendez ${cooldownRemaining}s`
        )
        return NextResponse.json(
          {
            success: false,
            error: `Veuillez attendre ${cooldownRemaining} secondes avant de redemander un code.`,
            retryAfter: cooldownRemaining,
          },
          { status: 429 }
        )
      }
    }

    // ─── Génération et stockage du code OTP ───────────────────────────────
    const code = generateOTP()
    const entry = storeOTP(normalized, code, purpose)

    // ─── Envoi du SMS ─────────────────────────────────────────────────────
    const demo = isDemoMode()

    if (!demo) {
      // Mode production : envoyer le SMS réellement
      console.log(`[OTP] Envoi SMS OTP au ${normalized} (mode production)`)
      const smsResult = await sendSMS(normalized, code)

      if (!smsResult.success) {
        console.error(
          `[OTP] Échec d'envoi SMS au ${normalized}: ${smsResult.error}`
        )
        return NextResponse.json(
          {
            success: false,
            error: "Impossible d'envoyer le code par SMS. Veuillez réessayer.",
          },
          { status: 502 }
        )
      }

      console.log(
        `[OTP] SMS envoyé avec succès au ${normalized} (ID: ${smsResult.messageId})`
      )
    } else {
      // Mode démonstration : afficher le code dans les logs
      console.log(`[OTP] Mode démo — code OTP pour ${normalized}: ${code}`)
    }

    // ─── Réponse ──────────────────────────────────────────────────────────
    const responseData: {
      message: string
      code?: string
      expiresIn: number
      demo?: boolean
    } = {
      message: `Code OTP envoye au ${normalized}`,
      expiresIn: 300,
    }

    // Inclure le code uniquement en mode démonstration
    if (demo) {
      responseData.code = entry.code
      responseData.demo = true
    }

    return NextResponse.json({
      success: true,
      data: responseData,
    })
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: error.issues[0]?.message || 'Donnees invalides' },
        { status: 400 }
      )
    }
    const message = error instanceof Error ? error.message : 'Erreur serveur'
    console.error('OTP request error:', message)
    return NextResponse.json(
      { success: false, error: 'Erreur lors de l\'envoi du code OTP' },
      { status: 500 }
    )
  }
}
