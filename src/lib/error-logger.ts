/**
 * ═══════════════════════════════════════════════════════════════════════════
 * MOVA — Application Error Logger
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * A structured in-memory error logging utility with FIFO eviction,
 * auto-cleanup of old entries, Sentry integration, and file logging.
 *
 * Features:
 * - logError(error, context?): string (errorId)
 * - logWarning(message, context?): void
 * - logInfo(message, context?): void
 * - getErrors(limit?): ErrorEntry[] (most recent first)
 * - getWarnings(limit?): LogEntry[]
 * - getInfo(limit?): LogEntry[]
 * - getStats(): { errors, warnings, info, lastError }
 * - clear(): void
 *
 * Integrations:
 * - Sentry: automatic error/warning forwarding when @sentry/nextjs is available
 * - File logging: JSON log lines appended to LOG_FILE if configured
 * - Log level filtering: via LOG_LEVEL env var (error < warn < info < debug)
 *
 * Constraints:
 * - Max 1000 entries in memory (FIFO eviction)
 * - Auto-cleanup of entries older than 24h
 * - Sentry SDK is optional (graceful degradation)
 *
 * @example
 * ```ts
 * import { errorLogger } from '@/lib/error-logger';
 *
 * // Log an error (also sent to Sentry if available)
 * const errorId = errorLogger.logError(new Error('Payment failed'), {
 *   path: '/api/mova/wallet/topup',
 *   method: 'POST',
 *   userId: 'user:123',
 * });
 *
 * // Log a warning
 * errorLogger.logWarning('Rate limit approaching for user:456', {
 *   path: '/api/mova/rides',
 *   method: 'GET',
 * });
 *
 * // Log info
 * errorLogger.logInfo('User logged in', { userId: 'user:123' });
 * ```
 */

// ─── Sentry (optionnel) ────────────────────────────────────────────────
// Import dynamique de Sentry — dégradation gracieuse si non installé
let Sentry: any
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  Sentry = require('@sentry/nextjs')
} catch {
  // Sentry non installé — pas de problème
  Sentry = undefined
}

// ─── Niveaux de log ────────────────────────────────────────────────────

/** Niveaux de log avec ordre de priorité (0 = le plus élevé) */
const LOG_LEVEL_PRIORITY: Record<string, number> = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
}

/** Niveau minimum configuré (défaut : 'error' en production, 'debug' en dev) */
const configuredLogLevel = (() => {
  const envLevel = process.env.LOG_LEVEL?.toLowerCase()
  if (envLevel && envLevel in LOG_LEVEL_PRIORITY) return envLevel
  return process.env.NODE_ENV === 'production' ? 'error' : 'debug'
})()

/**
 * Vérifie si un niveau de log donné passe le filtre configuré.
 * error(0) < warn(1) < info(2) < debug(3)
 */
function shouldLog(level: string): boolean {
  const levelPriority = LOG_LEVEL_PRIORITY[level] ?? 0
  const configPriority = LOG_LEVEL_PRIORITY[configuredLogLevel] ?? 0
  return levelPriority <= configPriority
}

// ─── Types ─────────────────────────────────────────────────────────────

export type LogLevel = 'error' | 'warning' | 'info'

/** Interface de base commune à toutes les entrées de log */
interface BaseLogEntry {
  /** Unique identifier */
  id: string
  /** Human-readable message */
  message: string
  /** Additional structured context */
  context?: Record<string, unknown>
  /** ISO timestamp */
  timestamp: string
  /** Request path (if applicable) */
  path?: string
  /** HTTP method (if applicable) */
  method?: string
  /** User identifier (if applicable) */
  userId?: string
}

/** A structured log entry with full context */
export interface LogEntry extends BaseLogEntry {
  /** Log level */
  level: 'warning' | 'info'
}

/** An error log entry with stack trace */
export interface ErrorEntry extends BaseLogEntry {
  /** Log level — toujours 'error' pour les erreurs */
  level: 'error'
  /** Stack trace (if available) */
  stack?: string
}

/** Logger statistics */
export interface ErrorLoggerStats {
  /** Total number of error entries */
  errors: number
  /** Total number of warning entries */
  warnings: number
  /** Total number of info entries */
  info: number
  /** Timestamp of the last error, or null if no errors logged */
  lastError: string | null
}

/** Context for log entries */
export interface LogContext {
  /** Additional structured key-value pairs */
  [key: string]: unknown
  /** Request path */
  path?: string
  /** HTTP method */
  method?: string
  /** User identifier */
  userId?: string
}

// ─── Constants ─────────────────────────────────────────────────────────

/** Maximum number of log entries in memory */
const MAX_ENTRIES = 1000

/** Maximum age of log entries in milliseconds (24 hours) */
const MAX_AGE_MS = 24 * 60 * 60 * 1000

/** Auto-cleanup interval in milliseconds (5 minutes) */
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000

// ─── Internal State ────────────────────────────────────────────────────

/** In-memory log storage (all levels) */
const entries: Array<LogEntry | ErrorEntry> = []

/** Counter for generating unique IDs */
let entryCounter = 0

/** Reference to the auto-cleanup interval timer */
let cleanupTimer: ReturnType<typeof setInterval> | null = null

// ─── Helpers ───────────────────────────────────────────────────────────

/**
 * Generate a unique log entry ID.
 * Format: "log-{timestamp}-{counter}"
 */
function generateId(): string {
  entryCounter++
  return `log-${Date.now()}-${entryCounter}`
}

/**
 * Ensure auto-cleanup timer is running.
 * Scans and removes entries older than MAX_AGE_MS.
 */
function ensureCleanup(): void {
  if (cleanupTimer) return

  cleanupTimer = setInterval(() => {
    cleanupOldEntries()
  }, CLEANUP_INTERVAL_MS)

  if (cleanupTimer.unref) {
    cleanupTimer.unref()
  }
}

/**
 * Remove entries older than MAX_AGE_MS.
 */
function cleanupOldEntries(): void {
  const cutoff = Date.now() - MAX_AGE_MS
  while (entries.length > 0 && new Date(entries[0].timestamp).getTime() < cutoff) {
    entries.shift()
  }
}

/**
 * Enforce the maximum entry limit using FIFO eviction.
 * Removes oldest entries first.
 */
function enforceMaxEntries(): void {
  while (entries.length >= MAX_ENTRIES) {
    entries.shift()
  }
}

/**
 * Extract context fields from a LogContext object.
 */
function extractContextFields(ctx?: LogContext): Pick<BaseLogEntry, 'path' | 'method' | 'userId'> {
  if (!ctx) return {}
  const { path, method, userId } = ctx
  return {
    path: typeof path === 'string' ? path : undefined,
    method: typeof method === 'string' ? method : undefined,
    userId: typeof userId === 'string' ? userId : undefined,
  }
}

/**
 * Build the context object (remaining fields after extracting known fields).
 */
function buildContext(ctx?: LogContext): Record<string, unknown> | undefined {
  if (!ctx) return undefined
  const { path: _p, method: _m, userId: _u, ...rest } = ctx
  return Object.keys(rest).length > 0 ? rest : undefined
}

/**
 * Append a JSON log line to a file if LOG_FILE is configured.
 * Écriture synchrone non-bloquante dans la mesure du possible.
 */
function appendToFile(entry: Record<string, unknown>): void {
  const logFile = process.env.LOG_FILE
  if (!logFile) return

  try {
    const line = JSON.stringify(entry) + '\n'
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require('fs')
    fs.appendFileSync(logFile, line, 'utf8')
  } catch {
    // Échec silencieux de l'écriture fichier — ne pas interrompre le flux
    if (process.env.NODE_ENV === 'development') {
      console.warn(`[ErrorLogger] Impossible d'écrire dans le fichier de log: ${process.env.LOG_FILE}`)
    }
  }
}

/**
 * Forward an error to Sentry if available.
 */
function sendToSentryException(error: unknown, context?: Record<string, unknown>): void {
  if (!Sentry) return
  try {
    const sentryContext: Record<string, unknown> = {
      logger: true,
      ...context,
    }
    Sentry.captureException(error, { extra: sentryContext })
  } catch {
    // Échec silencieux de l'envoi Sentry
  }
}

/**
 * Forward a warning/info message to Sentry if available.
 */
function sendToSentryMessage(message: string, level: 'warning' | 'info', context?: Record<string, unknown>): void {
  if (!Sentry) return
  try {
    const sentryLevel = level === 'warning' ? 'warning' : 'info'
    Sentry.captureMessage(message, {
      level: sentryLevel,
      extra: { logger: true, ...context },
    })
  } catch {
    // Échec silencieux de l'envoi Sentry
  }
}

// ─── Error Logger API ─────────────────────────────────────────────────

/**
 * Structured error logger singleton.
 * Compatible with Sentry interface patterns for future integration.
 */
export const errorLogger = {
  /**
   * Log an error with optional context.
   * Returns a unique error ID for reference.
   * Also sends to Sentry and LOG_FILE if configured.
   *
   * @param error - The error to log (Error instance, string, or unknown)
   * @param context - Optional context with path, method, userId, and extra fields
   * @returns Unique error ID string
   *
   * @example
   * ```ts
   * const id = errorLogger.logError(err, { path: '/api/rides', method: 'POST' });
   * return NextResponse.json({ errorId: id }, { status: 500 });
   * ```
   */
  logError(error: unknown, context?: LogContext): string {
    ensureCleanup()
    enforceMaxEntries()

    // Filtre de niveau
    if (!shouldLog('error')) return generateId()

    const id = generateId()
    const fields = extractContextFields(context)
    const ctx = buildContext(context)

    const message = error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : String(error)

    const stack = error instanceof Error ? error.stack : undefined

    const entry: ErrorEntry = {
      id,
      level: 'error',
      message,
      stack,
      context: ctx,
      timestamp: new Date().toISOString(),
      ...fields,
    }

    entries.push(entry)

    // Journal console en développement
    if (process.env.NODE_ENV === 'development') {
      console.error(`[ErrorLogger] ${entry.id}: ${entry.message}`, {
        path: entry.path,
        method: entry.method,
        userId: entry.userId,
        context: entry.context,
      })
    }

    // Envoi à Sentry (optionnel)
    const sentryContext: Record<string, unknown> = {}
    if (fields.path) sentryContext.path = fields.path
    if (fields.method) sentryContext.method = fields.method
    if (fields.userId) sentryContext.userId = fields.userId
    if (ctx) Object.assign(sentryContext, ctx)
    sendToSentryException(error, sentryContext)

    // Écriture fichier (optionnel)
    appendToFile({
      id: entry.id,
      level: 'error',
      message: entry.message,
      stack: entry.stack,
      timestamp: entry.timestamp,
      ...fields,
      ...(ctx ? { context: ctx } : {}),
    })

    return id
  },

  /**
   * Log a warning message with optional context.
   * Also sends to Sentry and LOG_FILE if configured.
   *
   * @param message - Warning message
   * @param context - Optional context with path, method, userId, and extra fields
   *
   * @example
   * ```ts
   * errorLogger.logWarning('Rate limit approaching', { userId: 'user:123' });
   * ```
   */
  logWarning(message: string, context?: LogContext): void {
    ensureCleanup()
    enforceMaxEntries()

    // Filtre de niveau
    if (!shouldLog('warn')) return

    const id = generateId()
    const fields = extractContextFields(context)
    const ctx = buildContext(context)

    const entry: LogEntry = {
      id,
      level: 'warning',
      message,
      context: ctx,
      timestamp: new Date().toISOString(),
      ...fields,
    }

    entries.push(entry)

    if (process.env.NODE_ENV === 'development') {
      console.warn(`[ErrorLogger] ${entry.id}: ${entry.message}`)
    }

    // Envoi à Sentry (optionnel)
    const sentryContext: Record<string, unknown> = {}
    if (fields.path) sentryContext.path = fields.path
    if (fields.method) sentryContext.method = fields.method
    if (fields.userId) sentryContext.userId = fields.userId
    if (ctx) Object.assign(sentryContext, ctx)
    sendToSentryMessage(message, 'warning', sentryContext)

    // Écriture fichier (optionnel)
    appendToFile({
      id: entry.id,
      level: 'warning',
      message: entry.message,
      timestamp: entry.timestamp,
      ...fields,
      ...(ctx ? { context: ctx } : {}),
    })
  },

  /**
   * Log an informational message with optional context.
   * Also writes to LOG_FILE if configured.
   *
   * @param message - Info message
   * @param context - Optional context with path, method, userId, and extra fields
   *
   * @example
   * ```ts
   * errorLogger.logInfo('User logged in successfully', { userId: 'user:123' });
   * ```
   */
  logInfo(message: string, context?: LogContext): void {
    ensureCleanup()
    enforceMaxEntries()

    // Filtre de niveau
    if (!shouldLog('info')) return

    const id = generateId()
    const fields = extractContextFields(context)
    const ctx = buildContext(context)

    const entry: LogEntry = {
      id,
      level: 'info',
      message,
      context: ctx,
      timestamp: new Date().toISOString(),
      ...fields,
    }

    entries.push(entry)

    if (process.env.NODE_ENV === 'development') {
      console.info(`[ErrorLogger] ${entry.id}: ${entry.message}`)
    }

    // Écriture fichier (optionnel)
    appendToFile({
      id: entry.id,
      level: 'info',
      message: entry.message,
      timestamp: entry.timestamp,
      ...fields,
      ...(ctx ? { context: ctx } : {}),
    })
  },

  /**
   * Get the most recent error entries, sorted newest first.
   *
   * @param limit - Maximum number of entries to return (default: 50)
   * @returns Array of error entries
   *
   * @example
   * ```ts
   * const errors = errorLogger.getErrors(10);
   * for (const e of errors) {
   *   console.log(`${e.id}: ${e.message} at ${e.timestamp}`);
   * }
   * ```
   */
  getErrors(limit: number = 50): ErrorEntry[] {
    cleanupOldEntries()
    return entries
      .filter((e): e is ErrorEntry => e.level === 'error')
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit)
  },

  /**
   * Get the most recent warning entries, sorted newest first.
   *
   * @param limit - Maximum number of entries to return (default: 50)
   * @returns Array of warning entries
   */
  getWarnings(limit: number = 50): LogEntry[] {
    cleanupOldEntries()
    return entries
      .filter((e) => e.level === 'warning')
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit) as LogEntry[]
  },

  /**
   * Get the most recent info entries, sorted newest first.
   *
   * @param limit - Maximum number of entries to return (default: 50)
   * @returns Array of info entries
   */
  getInfo(limit: number = 50): LogEntry[] {
    cleanupOldEntries()
    return entries
      .filter((e) => e.level === 'info')
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit) as LogEntry[]
  },

  /**
   * Get all entries of a specific level, sorted newest first.
   *
   * @param level - Log level to filter by
   * @param limit - Maximum number of entries (default: 50)
   * @returns Array of matching entries
   */
  getByLevel(level: LogLevel, limit: number = 50): Array<LogEntry | ErrorEntry> {
    cleanupOldEntries()
    return entries
      .filter((e) => e.level === level)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit)
  },

  /**
   * Get aggregate statistics about the logger.
   *
   * @returns Stats object with counts and last error timestamp
   *
   * @example
   * ```ts
   * const stats = errorLogger.getStats();
   * console.log(`Errors: ${stats.errors}, Warnings: ${stats.warnings}`);
   * if (stats.lastError) {
   *   console.log(`Last error at: ${stats.lastError}`);
   * }
   * ```
   */
  getStats(): ErrorLoggerStats {
    cleanupOldEntries()

    let errors = 0
    let warnings = 0
    let info = 0
    let lastError: string | null = null

    for (const entry of entries) {
      switch (entry.level) {
        case 'error':
          errors++
          if (!lastError || entry.timestamp > lastError) {
            lastError = entry.timestamp
          }
          break
        case 'warning':
          warnings++
          break
        case 'info':
          info++
          break
      }
    }

    return { errors, warnings, info, lastError }
  },

  /**
   * Clear all log entries from memory.
   * Also resets the entry counter.
   *
   * @example
   * ```ts
   * errorLogger.clear();
   * console.log('All logs cleared');
   * ```
   */
  clear(): void {
    entries.length = 0
    entryCounter = 0
  },
}
