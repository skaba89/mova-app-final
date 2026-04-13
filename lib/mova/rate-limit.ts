// Interfaces pour le limiteur de debit
interface RateLimitEntry {
  timestamps: number[]
}

interface BlockEntry {
  blockedUntil: number
  reason?: string
}

interface CheckResult {
  allowed: boolean
  remaining: number
  retryAfterMs: number
}

interface ViolatorEntry {
  identifier: string
  violationCount: number
  lastViolation: number
}

interface RateLimitStats {
  totalChecks: number
  totalBlocked: number
  topViolators: ViolatorEntry[]
}

// Classe de limitation de debit (fenetre glissante)
class RateLimiter {
  private entries = new Map<string, RateLimitEntry>()
  private blocked = new Map<string, BlockEntry>()
  private totalChecks = 0
  private totalBlocked = 0
  private violations = new Map<string, number>()

  // Nettoyer les anciennes entrees (appele periodiquement)
  private cleanup(identifier: string, windowMs: number): void {
    const entry = this.entries.get(identifier)
    if (!entry) return

    const cutoff = Date.now() - windowMs
    entry.timestamps = entry.timestamps.filter((ts) => ts > cutoff)

    // Supprimer l'entree si elle est vide
    if (entry.timestamps.length === 0) {
      this.entries.delete(identifier)
    }
  }

  // Verifier si un identifiant est actuellement bloque
  isBlocked(identifier: string): { blocked: boolean; reason?: string; remainingMs?: number } {
    const blockEntry = this.blocked.get(identifier)
    if (!blockEntry) return { blocked: false }

    if (Date.now() < blockEntry.blockedUntil) {
      return {
        blocked: true,
        reason: blockEntry.reason,
        remainingMs: blockEntry.blockedUntil - Date.now(),
      }
    }

    // Le blocage est expire, le supprimer
    this.blocked.delete(identifier)
    return { blocked: false }
  }

  // Verifier une requete et determiner si elle est autorisee
  checkRequest(identifier: string, maxRequests: number, windowMs: number): CheckResult {
    this.totalChecks++

    // Verifier si l'identifiant est bloque
    const blockStatus = this.isBlocked(identifier)
    if (blockStatus.blocked) {
      this.totalBlocked++
      const remainingMs = blockStatus.remainingMs ?? 0
      return {
        allowed: false,
        remaining: 0,
        retryAfterMs: remainingMs,
      }
    }

    // Nettoyer les anciennes entrees
    this.cleanup(identifier, windowMs)

    const entry = this.entries.get(identifier) || { timestamps: [] }
    const now = Date.now()

    if (entry.timestamps.length >= maxRequests) {
      // Limite atteinte
      this.totalBlocked++
      const oldest = entry.timestamps[0]
      const retryAfterMs = Math.max(0, oldest + windowMs - now)

      // Enregistrer la violation
      const current = this.violations.get(identifier) || 0
      this.violations.set(identifier, current + 1)

      return {
        allowed: false,
        remaining: 0,
        retryAfterMs,
      }
    }

    // Ajouter le timestamp et mettre a jour
    entry.timestamps.push(now)
    this.entries.set(identifier, entry)

    return {
      allowed: true,
      remaining: maxRequests - entry.timestamps.length,
      retryAfterMs: 0,
    }
  }

  // Bloquer manuellement un identifiant
  block(identifier: string, durationMs: number, reason?: string): void {
    this.blocked.set(identifier, {
      blockedUntil: Date.now() + durationMs,
      reason,
    })
  }

  // Debloquer manuellement un identifiant
  unblock(identifier: string): boolean {
    return this.blocked.delete(identifier)
  }

  // Obtenir les statistiques du limiteur
  getStats(): RateLimitStats {
    // Trier les violeurs par nombre de violations
    const violators: ViolatorEntry[] = Array.from(this.violations.entries())
      .map(([id, count]) => ({
        identifier: id,
        violationCount: count,
        lastViolation: Date.now(),
      }))
      .sort((a, b) => b.violationCount - a.violationCount)
      .slice(0, 10)

    return {
      totalChecks: this.totalChecks,
      totalBlocked: this.totalBlocked,
      topViolators: violators,
    }
  }

  // Reinitialiser toutes les donnees
  resetAll(): void {
    this.entries.clear()
    this.blocked.clear()
    this.totalChecks = 0
    this.totalBlocked = 0
    this.violations.clear()
  }
}

// Instance singleton du limiteur de debit
export const rateLimiter = new RateLimiter()
export default rateLimiter
