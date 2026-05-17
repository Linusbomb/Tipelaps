import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'
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
        totalHours: true,
        userId: true,
      },
    })

    type RowAgg = { name: string; email: string; hours: number; overtime: number; count: number }
    const map = new Map<string, RowAgg>()

    for (const s of staff) {
      map.set(s.id, { name: s.name, email: s.email, hours: 0, overtime: 0, count: 0 })
    }

    for (const r of reports) {
      const prev = map.get(r.userId)
      if (!prev) continue
      prev.hours += r.totalHours
      prev.overtime += computeOvertimeHours(r.totalHours)
      prev.count += 1
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
      'Övertid (h, över 8 h/dag)',
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
