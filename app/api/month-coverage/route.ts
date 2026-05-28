import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'
import {
  STANDARD_WORK_DAY_HOURS,
  buildCoverageDraftDateSets,
  buildHoursByDate,
  buildMonthDayCoverage,
  coverageHasWarnings,
  warningDaysFromCoverage,
} from '@/lib/monthDayCoverage'
import { resolveTimeReportSubject } from '@/lib/timeReportSubject'
import { toMonthKey } from '@/lib/monthReporting'

export const dynamic = 'force-dynamic'

async function getUserId(request: NextRequest): Promise<string | null> {
  const authHeader = request.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) return null
  const decoded = verifyToken(authHeader.substring(7))
  return decoded?.userId || null
}

export async function GET(request: NextRequest) {
  try {
    const userId = await getUserId(request)
    if (!userId) {
      return NextResponse.json({ error: 'Ej auktoriserad' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const month = searchParams.get('month') || toMonthKey(new Date())
    const forUserId = searchParams.get('forUserId')

    const subject = await resolveTimeReportSubject(userId, forUserId ?? userId)
    if (!subject.ok) return subject.response

    const [timeReports, absences] = await Promise.all([
      prisma.timeReport.findMany({
        where: { userId: subject.reportUserId, month },
        select: { date: true, totalHours: true, status: true },
      }),
      prisma.absenceReport.findMany({
        where: { userId: subject.reportUserId, month },
        select: { date: true, isFullDay: true, hours: true, status: true },
      }),
    ])

    const { datesWithTimeReport, datesWithDraft } = buildCoverageDraftDateSets(
      timeReports,
      absences
    )
    const hoursByDate = buildHoursByDate(timeReports, absences)
    const { days, summary } = buildMonthDayCoverage(month, hoursByDate, {
      datesWithTimeReport,
      datesWithDraft,
    })
    const warnings = warningDaysFromCoverage(days)

    return NextResponse.json({
      month,
      standardDayHours: STANDARD_WORK_DAY_HOURS,
      summary,
      days,
      warnings,
      hasWarnings: coverageHasWarnings(days),
    })
  } catch (error) {
    console.error('Fel vid hämtning av månadsöversikt:', error)
    return NextResponse.json({ error: 'Kunde inte hämta månadsöversikt' }, { status: 500 })
  }
}
