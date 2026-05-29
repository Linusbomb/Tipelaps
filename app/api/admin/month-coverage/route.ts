import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'
import { adminEffectiveCompanyId } from '@/lib/apiAdmin'
import {
  STANDARD_WORK_DAY_HOURS,
  buildCoverageDraftDateSets,
  buildHoursByDate,
  buildMonthDayCoverage,
  coverageHasWarnings,
  monthDateRange,
  warningDaysFromCoverage,
} from '@/lib/monthDayCoverage'
import { getWeekdaySwedishPublicHolidaysInMonth } from '@/lib/swedishPublicHolidays'
import { toMonthKey } from '@/lib/monthReporting'

export const dynamic = 'force-dynamic'

async function getAdminUser(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) return null
  const decoded = verifyToken(authHeader.substring(7))
  if (!decoded?.userId) return null

  return prisma.user.findUnique({
    where: { id: decoded.userId },
    select: {
      id: true,
      role: true,
      companyId: true,
      ownedCompany: { select: { id: true } },
    },
  })
}

export async function GET(request: NextRequest) {
  try {
    const admin = await getAdminUser(request)
    if (!admin) {
      return NextResponse.json({ error: 'Ej auktoriserad' }, { status: 401 })
    }

    if (admin.role !== 'ENTREPRENEUR' && admin.role !== 'PAYROLL_COORDINATOR') {
      return NextResponse.json({ error: 'Ej behörig' }, { status: 403 })
    }

    const companyId = adminEffectiveCompanyId(admin)
    if (!companyId) {
      return NextResponse.json({ error: 'Inget företag kopplat' }, { status: 400 })
    }

    const { searchParams } = new URL(request.url)
    const month = searchParams.get('month') || toMonthKey(new Date())

    const employees = await prisma.user.findMany({
      where: {
        companyId,
        employmentEndedAt: null,
        role: 'EMPLOYEE',
      },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    })

    const employeeIds = employees.map((e) => e.id)
    if (employeeIds.length === 0) {
      return NextResponse.json({
        month,
        standardDayHours: STANDARD_WORK_DAY_HOURS,
        employees: [],
        companySummary: {
          employeeCount: 0,
          employeesWithIssues: 0,
          totalMissingWeekdays: 0,
          totalPartialWeekdays: 0,
          redDayCount: 0,
        },
        redDaysInMonth: getWeekdaySwedishPublicHolidaysInMonth(month),
      })
    }

    const dateRange = monthDateRange(month)

    const [timeReports, absences] = await Promise.all([
      prisma.timeReport.findMany({
        where: {
          userId: { in: employeeIds },
          date: { gte: dateRange.gte, lt: dateRange.lt },
        },
        select: {
          id: true,
          userId: true,
          date: true,
          totalHours: true,
          status: true,
          customer: { select: { name: true } },
        },
        orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
      }),
      prisma.absenceReport.findMany({
        where: {
          userId: { in: employeeIds },
          date: { gte: dateRange.gte, lt: dateRange.lt },
        },
        select: {
          id: true,
          userId: true,
          date: true,
          type: true,
          isFullDay: true,
          hours: true,
          status: true,
          note: true,
        },
        orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
      }),
    ])

    const timeByUser = new Map<string, typeof timeReports>()
    const absenceByUser = new Map<string, typeof absences>()
    for (const id of employeeIds) {
      timeByUser.set(id, [])
      absenceByUser.set(id, [])
    }
    for (const row of timeReports) {
      timeByUser.get(row.userId)?.push(row)
    }
    for (const row of absences) {
      absenceByUser.get(row.userId)?.push(row)
    }

    let employeesWithIssues = 0
    let totalMissingWeekdays = 0
    let totalPartialWeekdays = 0

    const employeeCoverage = employees.map((employee) => {
      const userTime = timeByUser.get(employee.id) ?? []
      const userAbsence = absenceByUser.get(employee.id) ?? []
      const { datesWithTimeReport, datesWithAbsence, datesWithDraft } =
        buildCoverageDraftDateSets(userTime, userAbsence)
      const hoursByDate = buildHoursByDate(userTime, userAbsence)
      const { days, summary } = buildMonthDayCoverage(month, hoursByDate, {
        datesWithTimeReport,
        datesWithAbsence,
        datesWithDraft,
      })
      const warnings = warningDaysFromCoverage(days)
      const hasWarnings = coverageHasWarnings(days)

      if (hasWarnings) employeesWithIssues += 1
      totalMissingWeekdays += warnings.filter((d) => d.status === 'missing').length
      totalPartialWeekdays += warnings.filter((d) => d.status === 'partial').length

      return {
        userId: employee.id,
        name: employee.name,
        summary,
        days,
        warnings,
        hasWarnings,
        timeReports: userTime,
        absences: userAbsence,
      }
    })

    const redDaysInMonth = getWeekdaySwedishPublicHolidaysInMonth(month)

    return NextResponse.json({
      month,
      standardDayHours: STANDARD_WORK_DAY_HOURS,
      redDaysInMonth,
      employees: employeeCoverage,
      companySummary: {
        employeeCount: employees.length,
        employeesWithIssues,
        totalMissingWeekdays,
        totalPartialWeekdays,
        redDayCount: redDaysInMonth.length,
      },
    })
  } catch (error) {
    console.error('Fel vid hämtning av admin månadsöversikt:', error)
    return NextResponse.json({ error: 'Kunde inte hämta månadsöversikt' }, { status: 500 })
  }
}
