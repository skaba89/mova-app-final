// Types pour le journal des erreurs
export type LogLevel = 'error' | 'warn' | 'info'

export interface LogEntry {
  id: string
  level: LogLevel
  message: string
  context?: Record<string, unknown>
  timestamp: Date
  stack?: string
}

export interface ErrorStats {
  total: number
  errors: number
  warnings: number
  infos: number
  byHour: Record<string, number>
  recentMessage: string | null
}

// Nombre maximal d'entrees conservees en memoire
const MAX_ENTRIES = 1000

// Generateur d'identifiant simple
let idCounter = 0
function generateId(): string {
  idCounter++
  return `log_${Date.now()}_${idCounter}`
}

// Classe de journalisation des erreurs
class ErrorLogger {
  private entries: LogEntry[] = []
  private counts = { error: 0, warn: 0, info: 0 }

  // Ajouter une entree de journal
  private log(level: LogLevel, message: string, context?: Record<string, unknown>): LogEntry {
    const entry: LogEntry = {
      id: generateId(),
      level,
      message,
      context,
      timestamp: new Date(),
    }

    // Capturer la pile d'appel pour les erreurs
    if (level === 'error' && context?.stack instanceof Error) {
      entry.stack = context.stack.stack
    } else if (level === 'error') {
      try {
        entry.stack = new Error().stack
      } catch {
        // Ignorer si la pile n'est pas disponible
      }
    }

    // Mettre a jour les compteurs
    this.counts[level]++

    // Ajouter au debut (les plus recentes en premier)
    this.entries.unshift(entry)

    // Limiter la taille du journal
    if (this.entries.length > MAX_ENTRIES) {
      this.entries = this.entries.slice(0, MAX_ENTRIES)
    }

    // Afficher dans la console
    const timestamp = entry.timestamp.toISOString()
    const contextStr = context ? ` | ${JSON.stringify(context)}` : ''

    switch (level) {
      case 'error':
        console.error(`[${timestamp}] ERREUR: ${message}${contextStr}`)
        if (entry.stack) console.error(entry.stack)
        break
      case 'warn':
        console.warn(`[${timestamp}] ATTENTION: ${message}${contextStr}`)
        break
      case 'info':
        console.info(`[${timestamp}] INFO: ${message}${contextStr}`)
        break
    }

    return entry
  }

  // Journaliser une erreur
  error(message: string, context?: Record<string, unknown>): LogEntry {
    return this.log('error', message, context)
  }

  // Journaliser un avertissement
  warn(message: string, context?: Record<string, unknown>): LogEntry {
    return this.log('warn', message, context)
  }

  // Journaliser une information
  info(message: string, context?: Record<string, unknown>): LogEntry {
    return this.log('info', message, context)
  }

  // Recuperer les erreurs recentes
  getErrors(limit: number = 50): LogEntry[] {
    return this.entries
      .filter((e) => e.level === 'error')
      .slice(0, limit)
  }

  // Recuperer les statistiques
  getStats(): ErrorStats {
    // Regrouper par heure
    const byHour: Record<string, number> = {}
    const now = new Date()
    for (let i = 0; i < 24; i++) {
      const hourKey = new Date(now.getTime() - i * 3600000).toISOString().slice(0, 13)
      byHour[hourKey] = 0
    }

    for (const entry of this.entries) {
      const hourKey = entry.timestamp.toISOString().slice(0, 13)
      if (hourKey in byHour) {
        byHour[hourKey]++
      }
    }

    return {
      total: this.entries.length,
      errors: this.counts.error,
      warnings: this.counts.warn,
      infos: this.counts.info,
      byHour,
      recentMessage: this.entries[0]?.message ?? null,
    }
  }

  // Vider le journal
  clear(): void {
    this.entries = []
    this.counts = { error: 0, warn: 0, info: 0 }
  }
}

// Instance singleton du journal des erreurs
export const errorLogger = new ErrorLogger()
export default errorLogger
