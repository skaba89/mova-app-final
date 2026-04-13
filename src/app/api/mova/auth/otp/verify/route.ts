import { NextRequest, NextResponse } from 'next/server'
import {
  verifyOTP,
  normalizePhone,
  isValidPhone,
  MAX_OTP_ATTEMPTS,
} from '@/lib/otp'
import { z } from 'zod/v4'

export const runtime = 'nodejs'

const otpVerifySchema = z.object({
  phone: z.string().min(1, 'Numero de telephone requis'),
  code: z.string().length(6, 'Le code doit contenir 6 chiffres'),
  purpose: z.enum(['login', 'register', 'reset', 'verify']).default('login'),
})

/** Délai anti brute-force après un échec de vérification (500ms) */
const BRUTE_FORCE_DELAY_MS = 500

/**
 * Ajoute un délai artificiel avant de répondre après un échec.
 * Ralentit les attaques par force brute sans impact notable sur l'UX.
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { phone, code, purpose } = otpVerifySchema.parse(body)

    const normalized = normalizePhone(phone)

    if (!isValidPhone(normalized)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Format de numero invalide',
        },
        { status: 400 }
      )
    }

    const result = verifyOTP(normalized, code, purpose)

    if (!result.verified) {
      // ─── Protection anti brute-force ────────────────────────────────────
      // Ajouter un délai avant de répondre en cas d'échec
      const attemptsUsed = MAX_OTP_ATTEMPTS - (result.attemptsRemaining ?? MAX_OTP_ATTEMPTS)

      if (attemptsUsed >= MAX_OTP_ATTEMPTS) {
        // Nombre maximum de tentatives dépassé : bloquer
        console.warn(
          `[OTP VERIFY] Trop de tentatives pour ${normalized}. Blocage après ${MAX_OTP_ATTEMPTS} échecs.`
        )
        return NextResponse.json(
          {
            success: false,
            error: `Trop de tentatives échouées. Le code a été invalidé. Demandez un nouveau code.`,
            attemptsRemaining: 0,
          },
          { status: 403 }
        )
      }

      // Délai progressif : plus on se rapproche du max, plus le délai est long
      const progressiveDelay = BRUTE_FORCE_DELAY_MS * attemptsUsed
      await delay(progressiveDelay)

      console.warn(
        `[OTP VERIFY] Échec pour ${normalized} (tentative ${attemptsUsed}/${MAX_OTP_ATTEMPTS})`
      )

      return NextResponse.json(
        {
          success: false,
          error: result.reason,
          attemptsRemaining: result.attemptsRemaining,
        },
        { status: 400 }
      )
    }

    // ─── Vérification réussie ──────────────────────────────────────────────
    console.log(`[OTP VERIFY] ✓ Vérification réussie pour ${normalized} (purpose: ${purpose})`)

    return NextResponse.json({
      success: true,
      data: {
        message: 'Code verifie avec succes',
        phone: normalized,
      },
    })
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: error.issues[0]?.message || 'Donnees invalides' },
        { status: 400 }
      )
    }
    const message = error instanceof Error ? error.message : 'Erreur serveur'
    console.error('OTP verify error:', message)
    return NextResponse.json(
      { success: false, error: 'Erreur lors de la verification du code' },
      { status: 500 }
    )
  }
}
