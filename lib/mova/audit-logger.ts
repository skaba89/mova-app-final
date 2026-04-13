import db from '@/lib/db'

// Types pour le journal d'audit
export type AuditSeverity = 'info' | 'warning' | 'critical'

export interface LogActionParams {
  userId?: string
  action: string
  resource: string
  resourceId?: string
  severity?: AuditSeverity
  details?: Record<string, unknown>
}

export interface GetAuditLogsParams {
  limit?: number
  page?: number
  userId?: string
  action?: string
  resource?: string
  severity?: AuditSeverity
  dateFrom?: Date
  dateTo?: Date
}

export interface PaginatedAuditLogs {
  logs: AuditLogEntry[]
  total: number
  page: number
  totalPages: number
}

export interface AuditLogEntry {
  id: string
  userId: string | null
  action: string
  resource: string
  resourceId: string | null
  severity: AuditSeverity
  details: unknown
  ipAddress: string | null
  userAgent: string | null
  createdAt: Date
}

// Journaliser une action dans la table d'audit
export async function logAction(params: LogActionParams): Promise<void> {
  try {
    await db.auditLog.create({
      data: {
        userId: params.userId ?? null,
        action: params.action,
        resource: params.resource,
        resourceId: params.resourceId ?? null,
        severity: params.severity ?? 'info',
        details: params.details ? JSON.stringify(params.details) : null,
      },
    })
  } catch (error) {
    console.error('[Audit] Erreur lors de l\'enregistrement de l\'action:', error)
    // Ne pas propager l'erreur pour ne pas bloquer le flux principal
  }
}

// Journaliser un evenement de securite (severite: warning par defaut)
export async function logSecurityEvent(params: Omit<LogActionParams, 'severity'>): Promise<void> {
  await logAction({
    ...params,
    severity: 'warning',
  })
}

// Recuperer les journaux d'audit avec pagination et filtres
export async function getAuditLogs(
  params: GetAuditLogsParams = {}
): Promise<PaginatedAuditLogs> {
  const {
    limit = 50,
    page = 1,
    userId,
    action,
    resource,
    severity,
    dateFrom,
    dateTo,
  } = params

  // Construire les filtres de requete
  const where: Record<string, unknown> = {}

  if (userId) where.userId = userId
  if (action) where.action = { contains: action, mode: 'insensitive' }
  if (resource) where.resource = { contains: resource, mode: 'insensitive' }
  if (severity) where.severity = severity

  if (dateFrom || dateTo) {
    const dateFilter: Record<string, Date> = {}
    if (dateFrom) dateFilter.gte = dateFrom
    if (dateTo) dateFilter.lte = dateTo
    where.createdAt = dateFilter
  }

  try {
    const [logs, total] = await Promise.all([
      db.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.auditLog.count({ where }),
    ])

    const totalPages = Math.ceil(total / limit)

    // Parser les details JSON pour chaque entree
    const parsedLogs: AuditLogEntry[] = logs.map((log) => ({
      id: log.id,
      userId: log.userId,
      action: log.action,
      resource: log.resource,
      resourceId: log.resourceId,
      severity: log.severity as AuditSeverity,
      details: log.details ? JSON.parse(log.details as string) : null,
      ipAddress: log.ipAddress ?? null,
      userAgent: log.userAgent ?? null,
      createdAt: log.createdAt,
    }))

    return {
      logs: parsedLogs,
      total,
      page,
      totalPages,
    }
  } catch (error) {
    console.error('[Audit] Erreur lors de la recuperation des journaux:', error)
    return {
      logs: [],
      total: 0,
      page,
      totalPages: 0,
    }
  }
}
