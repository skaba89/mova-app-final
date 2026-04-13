import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/mova/auth-middleware'
import { getAuditLogs } from '@/lib/mova/audit-logger'

// GET /api/mova/admin/audit-logs - Journaux d'audit pagines (admin)
export async function GET(request: NextRequest) {
  try {
    const admin = await requireAdmin(request)
    if (admin instanceof NextResponse) return admin

    const { searchParams } = new URL(request.url)
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '50', 10)))
    const userId = searchParams.get('userId') ?? undefined
    const action = searchParams.get('action') ?? undefined
    const resource = searchParams.get('resource') ?? undefined
    const severity = searchParams.get('severity') as 'info' | 'warning' | 'critical' | undefined
    const dateFrom = searchParams.get('dateFrom') ? new Date(searchParams.get('dateFrom')!) : undefined
    const dateTo = searchParams.get('dateTo') ? new Date(searchParams.get('dateTo')!) : undefined

    const result = await getAuditLogs({
      page,
      limit,
      userId,
      action,
      resource,
      severity,
      dateFrom,
      dateTo,
    })

    return NextResponse.json({
      success: true,
      data: {
        logs: result.logs,
        pagination: {
          page: result.page,
          totalPages: result.totalPages,
          total: result.total,
          limit,
        },
      },
    })
  } catch (error) {
    console.error('[ADMIN/AUDIT] Erreur lors de la recuperation des journaux:', error)
    return NextResponse.json(
      { success: false, error: 'Erreur interne du serveur' },
      { status: 500 }
    )
  }
}
