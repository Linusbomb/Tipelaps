import { NextRequest, NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireSuperAdmin } from '@/lib/auth'

export const dynamic = 'force-dynamic'

const MAX_LIMIT = 200
const DEFAULT_LIMIT = 50

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

  const limitRaw = parseInt(url.searchParams.get('limit') || `${DEFAULT_LIMIT}`, 10)
  const offsetRaw = parseInt(url.searchParams.get('offset') || '0', 10)
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), MAX_LIMIT) : DEFAULT_LIMIT
  const offset = Number.isFinite(offsetRaw) && offsetRaw > 0 ? offsetRaw : 0

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

  const [rows, total, distinctActions] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: offset,
      take: limit,
    }),
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      distinct: ['action'],
      select: { action: true },
      orderBy: { action: 'asc' },
    }),
  ])

  return NextResponse.json({
    rows,
    total,
    limit,
    offset,
    actions: distinctActions.map((r) => r.action),
  })
}
