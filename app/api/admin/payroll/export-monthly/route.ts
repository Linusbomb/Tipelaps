import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'
import { absenceHoursForPayroll, absenceTypeLabel } from '@/lib/absence'
import { computeOvertimeHours } from '@/lib/overtime'
import { getPayrollStaffForCompany } from '@/lib/payrollStaff'

export const dynamic = 'force-dynamic'

async function getAdminUser(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null

  const token = authHeader.substring(7)
  const decoded = verifyToken(token)
  if (!decoded) return null

  const user = await prisma.user.findUnique({
    where: { id: decoded.userId },
    include: { company: true, ownedCompany: true },
  })

  if (!user || (user.role !== 'ENTREPRENEUR' && user.role !== 'PAYROLL_COORDINATOR')) {
    return null
  }

  const companyId = user.ownedCompany?.id ?? user.companyId
  if (!companyId) return null

  return { user, companyId }
}

const MONTH_REGEX = /^\d{4}-\d{2}$/

function csvCell(value: string | number): string {
  const s = String(value ?? '')
  if (/[;"'\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

function formatAbsenceParts(parts: Map<string, number>): string {
  const values = Array.from(parts.entries())
    .map(([type, hours]) =>
      hours > 0 ? `${absenceTypeLabel(type)}: ${Math.round(hours * 100) / 100} h` : ''
    )
    .filter(Boolean)
  return values.join(', ')
}

function formatAbsenceDetails(
  details: Array<{ date: Date; type: string; hours: number; note: string | null }>
): string {
  return details
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .map((item) => {
      const date = item.date.toISOString().slice(0, 10)
      const note = item.note ? `, kommentar: ${item.note}` : ''
      return `${date}: ${absenceTypeLabel(item.type)}, ${Math.round(item.hours * 100) / 100} h${note}`
    })
    .join(' | ')
}

function formatOvertimeDetails(
  details: Array<{
    date: Date
    customerName: string
    totalHours: number
    entryHours: number
    description: string
    startTime: string | null
    endTime: string | null
  }>
): string {
  return details
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .map((item) => {
      const date = item.date.toISOString().slice(0, 10)
      const time = item.startTime || item.endTime ? `${item.startTime ?? '?'}-${item.endTime ?? '?'}` : 'klockslag saknas'
      return `${date}: ${item.customerName}, ${time}, rad ${Math.round(item.entryHours * 100) / 100} h, dag totalt ${Math.round(item.totalHours * 100) / 100} h, övertid ${computeOvertimeHours(item.totalHours, [{ startTime: item.startTime, endTime: item.endTime }])} h, ${item.description}`
    })
    .join(' | ')
}

export async function GET(request: NextRequest) {
  try {
    const auth = await getAdminUser(request)
    if (!auth) {
      return NextResponse.json({ error: 'Ej auktoriserad' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const month = searchParams.get('month')
    const mode = searchParams.get('mode') === 'with_pending' ? 'with_pending' : 'payroll'

    if (!month || !MONTH_REGEX.test(month)) {
      return NextResponse.json({ error: 'Ogiltig månad (använd YYYY-MM)' }, { status: 400 })
    }

    const statusFilter =
      mode === 'payroll' ? (['APPROVED'] as const) : (['SUBMITTED', 'APPROVED'] as const)

    const staff = await getPayrollStaffForCompany(auth.companyId)
    const staffIds = staff.map((s) => s.id)

    const reports = await prisma.timeReport.findMany({
      where: {
        month,
        userId: { in: staffIds },
        status: { in: [...statusFilter] },
      },
      select: {
        id: true,
        totalHours: true,
        userId: true,
      },
    })

    const absences =
      staffIds.length > 0
        ? await prisma.$queryRaw<
            Array<{
              userId: string
              date: Date
              type: string
              isFullDay: boolean
              hours: number | null
              note: string | null
            }>
          >`
            SELECT "userId", "date", "type", "isFullDay", "hours", "note"
            FROM "AbsenceReport"
            WHERE "month" = ${month}
              AND "userId" IN (${Prisma.join(staffIds)})
              AND "status" IN (${Prisma.join([...statusFilter])})
          `
        : []

    const overtimeRows =
      staffIds.length > 0
        ? await prisma.$queryRaw<
            Array<{
              userId: string
              reportId: string
              date: Date
              customerName: string
              totalHours: number
              entryHours: number
              description: string
              startTime: string | null
              endTime: string | null
            }>
          >`
            SELECT
              tr."userId",
              tr."id" AS "reportId",
              tr."date",
              c."name" AS "customerName",
              tr."totalHours",
              e."hours" AS "entryHours",
              e."description",
              e."startTime",
              e."endTime"
            FROM "TimeReport" tr
            JOIN "Customer" c ON c."id" = tr."customerId"
            LEFT JOIN "TimeReportEntry" e ON e."timeReportId" = tr."id"
            WHERE tr."month" = ${month}
              AND tr."userId" IN (${Prisma.join(staffIds)})
              AND tr."status" IN (${Prisma.join([...statusFilter])})
            ORDER BY tr."date" ASC, e."createdAt" ASC
          `
        : []

    type RowAgg = {
      name: string
      email: string
      hours: number
      overtime: number
      count: number
      absence: Map<string, number>
      absenceDetails: Array<{ date: Date; type: string; hours: number; note: string | null }>
      overtimeDetails: Array<{
        date: Date
        customerName: string
        totalHours: number
        entryHours: number
        description: string
        startTime: string | null
        endTime: string | null
      }>
    }
    const map = new Map<string, RowAgg>()

    for (const s of staff) {
      map.set(s.id, {
        name: s.name,
        email: s.email,
        hours: 0,
        overtime: 0,
        count: 0,
        absence: new Map(),
        absenceDetails: [],
        overtimeDetails: [],
      })
    }

    const overtimeEntriesByReport = new Map<string, Array<{ startTime: string | null; endTime: string | null }>>()
    for (const row of overtimeRows) {
      const current = overtimeEntriesByReport.get(row.reportId) ?? []
      current.push({ startTime: row.startTime, endTime: row.endTime })
      overtimeEntriesByReport.set(row.reportId, current)
    }

    for (const r of reports) {
      const prev = map.get(r.userId)
      if (!prev) continue
      prev.hours += r.totalHours
      prev.overtime += computeOvertimeHours(r.totalHours, overtimeEntriesByReport.get(r.id) ?? [])
      prev.count += 1
    }

    for (const row of overtimeRows) {
      const prev = map.get(row.userId)
      if (!prev) continue
      if (computeOvertimeHours(row.totalHours, overtimeEntriesByReport.get(row.reportId) ?? []) <= 0) continue
      prev.overtimeDetails.push({
        date: new Date(row.date),
        customerName: row.customerName,
        totalHours: Number(row.totalHours) || 0,
        entryHours: Number(row.entryHours) || 0,
        description: row.description,
        startTime: row.startTime,
        endTime: row.endTime,
      })
    }

    for (const a of absences) {
      const prev = map.get(a.userId)
      if (!prev) continue
      const current = prev.absence.get(a.type) ?? 0
      const absenceHours = absenceHoursForPayroll(a.isFullDay, a.hours)
      prev.absence.set(a.type, current + absenceHours)
      prev.absenceDetails.push({
        date: new Date(a.date),
        type: a.type,
        hours: absenceHours,
        note: a.note,
      })
    }

    const rows = Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, 'sv'))

    const headerHours =
      mode === 'payroll'
        ? 'Arbetstimmar (godkända tidrapporter)'
        : 'Arbetstimmar (inskickade inkl. ej godkända)'

    const headers = [
      'Månad',
      'Namn',
      'E-post',
      headerHours,
      'Övertid (h, över 8 h/dag eller utanför 07-16)',
      'Övertid detaljer',
      'Frånvaro totalt (h)',
      'Frånvaro per typ',
      'Frånvaro detaljer',
      'Antal rapporter',
    ]
    const lines = [
      headers.map((h) => csvCell(h)).join(';'),
      ...rows.map((row) =>
        [
          csvCell(month),
          csvCell(row.name),
          csvCell(row.email),
          csvCell(Math.round(row.hours * 100) / 100),
          csvCell(Math.round(row.overtime * 100) / 100),
          csvCell(formatOvertimeDetails(row.overtimeDetails)),
          csvCell(Math.round(Array.from(row.absence.values()).reduce((sum, h) => sum + h, 0) * 100) / 100),
          csvCell(formatAbsenceParts(row.absence)),
          csvCell(formatAbsenceDetails(row.absenceDetails)),
          csvCell(row.count),
        ].join(';')
      ),
    ]

    const csv = '\ufeff' + lines.join('\n')
    const modeSlug = mode === 'payroll' ? 'godkanda' : 'inskickade'
    const filename = `loneunderlag-${month}-${modeSlug}.csv`

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (error) {
    console.error('Fel vid export lön:', error)
    return NextResponse.json({ error: 'Kunde inte exportera' }, { status: 500 })
  }
}
