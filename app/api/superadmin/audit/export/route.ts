import { NextRequest, NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireSuperAdmin } from '@/lib/auth'
import { logAudit } from '@/lib/audit'

export const dynamic = 'force-dynamic'

const MAX_ROWS = 50_000

const CSV_HEADERS = [
  'createdAt',
  'action',
  'actorId',
  'actorEmail',
  'actorRole',
  'targetType',
  'targetId',
  'companyId',
  'ipAddress',
  'userAgent',
  'details',
]

function csvEscape(value: unknown): string {
  if (value == null) return ''
  const str = typeof value === 'string' ? value : JSON.stringify(value)
  // Excel-kompatibel: quota om innehåller komma, citat eller radbryt.
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

export async function GET(request: NextRequest) {
  const superAdmin = await requireSuperAdmin(request)
  if (!superAdmin) {
    return NextResponse.json({ error: 'Endast superadmin' }, { status: 403 })
  }

  const url = new URL(request.url)
  const action = url.searchParams.get('action')?.trim() || null
  const actorEmail = url.searchParams.get('actorEmail')?.trim().toLowerCase() || null
  const companyId = url.searchParams.get('companyId')?.trim() || null
  const ipAddress = url.searchParams.get('ipAddress')?.trim() || null
  const sinceParam = url.searchParams.get('since')
  const untilParam = url.searchParams.get('until')

  const where: Prisma.AuditLogWhereInput = {}
  if (action) where.action = action
  if (actorEmail) where.actorEmail = actorEmail
  if (companyId) where.companyId = companyId
  if (ipAddress) where.ipAddress = ipAddress
  if (sinceParam) {
    const d = new Date(sinceParam)
    if (!isNaN(d.getTime())) where.createdAt = { ...(where.createdAt as object), gte: d }
  }
  if (untilParam) {
    const d = new Date(untilParam)
    if (!isNaN(d.getTime())) where.createdAt = { ...(where.createdAt as object), lte: d }
  }

  const rows = await prisma.auditLog.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: MAX_ROWS,
  })

  // BOM så Excel detekterar UTF-8 korrekt med svenska tecken.
  const lines: string[] = []
  lines.push(CSV_HEADERS.join(','))
  for (const r of rows) {
    lines.push(
      [
        r.createdAt.toISOString(),
        r.action,
        r.actorId,
        r.actorEmail,
        r.actorRole,
        r.targetType,
        r.targetId,
        r.companyId,
        r.ipAddress,
        r.userAgent,
        r.details,
      ]
        .map(csvEscape)
        .join(',')
    )
  }
  const body = '\uFEFF' + lines.join('\r\n') + '\r\n'

  await logAudit({
    action: 'DATA_EXPORT_SUPERADMIN',
    actor: { id: superAdmin.id, email: superAdmin.email, role: superAdmin.role },
    targetType: 'AuditLog',
    details: { format: 'csv', rows: rows.length, filtersUsed: Object.keys(where) },
    request,
  })

  const filename = `timelaps-audit-${new Date().toISOString().slice(0, 10)}.csv`
  return new NextResponse(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}
