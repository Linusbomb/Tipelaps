import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'
import { absenceHoursForPayroll, absenceTypeLabel } from '@/lib/absence'
import { computeOvertime, HOLIDAY_WORK_OVERTIME_LABEL } from '@/lib/overtime'
import { getWeekdaySwedishPublicHolidaysInMonth } from '@/lib/swedishPublicHolidays'
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

export async function GET(request: NextRequest) {
  try {
    const auth = await getAdminUser(request)
    if (!auth) {
      return NextResponse.json({ error: 'Ej auktoriserad' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const month = searchParams.get('month')
    if (!month || !MONTH_REGEX.test(month)) {
      return NextResponse.json({ error: 'Ogiltig månad (använd YYYY-MM)' }, { status: 400 })
    }

    const staff = await getPayrollStaffForCompany(auth.companyId)
    const staffIds = staff.map((s) => s.id)

    const reports = await prisma.timeReport.findMany({
      where: {
        month,
        userId: { in: staffIds },
        status: { in: ['SUBMITTED', 'APPROVED'] },
      },
      select: { id: true, userId: true, totalHours: true, status: true, date: true },
    })

    const overtimeRows =
      staffIds.length > 0
        ? await prisma.$queryRaw<
            Array<{
              userId: string
              reportId: string
              date: Date
              customerName: string
              status: string
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
              tr."status",
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
              AND tr."status" IN ('SUBMITTED', 'APPROVED')
            ORDER BY tr."date" ASC, e."createdAt" ASC
          `
        : []

    const absences =
      staffIds.length > 0
        ? await prisma.$queryRaw<
            Array<{
              id: string
              userId: string
              date: Date
              type: string
              isFullDay: boolean
              hours: number | null
              status: string
              note: string | null
            }>
          >`
            SELECT "id", "userId", "date", "type", "isFullDay", "hours", "status", "note"
            FROM "AbsenceReport"
            WHERE "month" = ${month}
              AND "userId" IN (${Prisma.join(staffIds)})
              AND "status" IN ('SUBMITTED', 'APPROVED')
          `
        : []

    const byUser: Record<
      string,
      {
        inskickadeTimmar: number
        godkandaTimmar: number
        overtidInskickad: number
        overtidGodkand: number
        rapportCountInskickad: number
        rapportCountGodkand: number
        absenceByType: Record<string, { label: string; submittedHours: number; approvedHours: number }>
        absenceDetails: Array<{
          id: string
          date: string
          type: string
          label: string
          hours: number
          status: string
          note: string | null
        }>
        overtimeDetails: Array<{
          reportId: string
          date: string
          customerName: string
          totalHours: number
          overtimeHours: number
          isHolidayWork: boolean
          overtimeLabel: string | null
          timeRanges: string[]
        }>
      }
    > = {}

    const ensureUser = (id: string) => {
      if (!byUser[id]) {
        byUser[id] = {
          inskickadeTimmar: 0,
          godkandaTimmar: 0,
          overtidInskickad: 0,
          overtidGodkand: 0,
          rapportCountInskickad: 0,
          rapportCountGodkand: 0,
          absenceByType: {},
          absenceDetails: [],
          overtimeDetails: [],
        }
      }
      return byUser[id]
    }

    const overtimeByReport = new Map<
      string,
      {
        userId: string
        reportId: string
        date: string
        customerName: string
        status: string
        totalHours: number
        overtimeHours: number
        isHolidayWork: boolean
        timeRanges: string[]
      }
    >()

    for (const row of overtimeRows) {
      const existing =
        overtimeByReport.get(row.reportId) ??
        {
          userId: row.userId,
          reportId: row.reportId,
          date: row.date.toISOString().slice(0, 10),
          customerName: row.customerName,
          status: row.status,
          totalHours: Number(row.totalHours) || 0,
          overtimeHours: 0,
          isHolidayWork: false,
          timeRanges: [],
        }
      const range =
        row.startTime || row.endTime
          ? `${row.startTime ?? '?'}-${row.endTime ?? '?'} (${Number(row.entryHours || 0).toFixed(1)} h, ${row.description})`
          : `Klockslag saknas (${Number(row.entryHours || 0).toFixed(1)} h, ${row.description})`
      existing.timeRanges.push(range)
      overtimeByReport.set(row.reportId, existing)
    }

    for (const detail of Array.from(overtimeByReport.values())) {
      const entryLike = detail.timeRanges.map((range) => {
        const match = range.match(/^([0-2]\d:[0-5]\d|\?)-([0-2]\d:[0-5]\d|\?)/)
        return {
          startTime: match?.[1] !== '?' ? match?.[1] : null,
          endTime: match?.[2] !== '?' ? match?.[2] : null,
        }
      })
      const ot = computeOvertime(detail.totalHours, entryLike, detail.date)
      detail.overtimeHours = ot.hours
      detail.isHolidayWork = ot.isHolidayWork
    }

    for (const r of reports) {
      const agg = ensureUser(r.userId)
      const reportDateKey = r.date.toISOString().slice(0, 10)
      const ot =
        overtimeByReport.get(r.id)?.overtimeHours ??
        computeOvertime(r.totalHours, [], reportDateKey).hours
      agg.inskickadeTimmar += r.totalHours
      agg.overtidInskickad += ot
      agg.rapportCountInskickad += 1
      if (r.status === 'APPROVED') {
        agg.godkandaTimmar += r.totalHours
        agg.overtidGodkand += ot
        agg.rapportCountGodkand += 1
      }
    }

    for (const detail of Array.from(overtimeByReport.values())) {
      if (detail.overtimeHours <= 0) continue
      if (detail.status !== 'APPROVED') continue
      ensureUser(detail.userId).overtimeDetails.push({
        reportId: detail.reportId,
        date: detail.date,
        customerName: detail.customerName,
        totalHours: Math.round(detail.totalHours * 100) / 100,
        overtimeHours: Math.round(detail.overtimeHours * 100) / 100,
        isHolidayWork: detail.isHolidayWork,
        overtimeLabel: detail.isHolidayWork ? HOLIDAY_WORK_OVERTIME_LABEL : null,
        timeRanges: detail.timeRanges,
      })
    }

    for (const a of absences) {
      const agg = ensureUser(a.userId)
      const prev =
        agg.absenceByType[a.type] ??
        {
          label: absenceTypeLabel(a.type),
          submittedHours: 0,
          approvedHours: 0,
        }
      const hours = absenceHoursForPayroll(a.isFullDay, a.hours)
      prev.submittedHours += hours
      if (a.status === 'APPROVED') {
        prev.approvedHours += hours
      }
      agg.absenceByType[a.type] = prev
      agg.absenceDetails.push({
        id: a.id,
        date: a.date.toISOString().slice(0, 10),
        type: a.type,
        label: absenceTypeLabel(a.type),
        hours: Math.round(hours * 100) / 100,
        status: a.status,
        note: a.note,
      })
    }

    for (const agg of Object.values(byUser)) {
      agg.absenceDetails.sort((x, y) => x.date.localeCompare(y.date))
    }

    const employees = staff.map((s) => {
      const agg = byUser[s.id] || {
        inskickadeTimmar: 0,
        godkandaTimmar: 0,
        overtidInskickad: 0,
        overtidGodkand: 0,
        rapportCountInskickad: 0,
        rapportCountGodkand: 0,
        absenceByType: {},
        absenceDetails: [],
        overtimeDetails: [],
      }
      const absenceSummary = Object.values(agg.absenceByType).map((item) => ({
        ...item,
        submittedHours: Math.round(item.submittedHours * 100) / 100,
        approvedHours: Math.round(item.approvedHours * 100) / 100,
      }))
      const absenceHoursSubmitted = absenceSummary.reduce((sum, item) => sum + item.submittedHours, 0)
      const absenceHoursApproved = absenceSummary.reduce((sum, item) => sum + item.approvedHours, 0)
      return {
        id: s.id,
        name: s.name,
        email: s.email,
        role: s.role,
        inskickadeTimmar: Math.round(agg.inskickadeTimmar * 100) / 100,
        godkandaTimmar: Math.round(agg.godkandaTimmar * 100) / 100,
        overtidInskickad: Math.round(agg.overtidInskickad * 100) / 100,
        overtidGodkand: Math.round(agg.overtidGodkand * 100) / 100,
        rapportCountInskickad: agg.rapportCountInskickad,
        rapportCountGodkand: agg.rapportCountGodkand,
        overtimeDetails: agg.overtimeDetails,
        absenceHoursSubmitted: Math.round(absenceHoursSubmitted * 100) / 100,
        absenceHoursApproved: Math.round(absenceHoursApproved * 100) / 100,
        absenceSummary,
        absenceDetails: agg.absenceDetails,
      }
    })

    const totalInskickat = employees.reduce((s, e) => s + e.inskickadeTimmar, 0)
    const totalGodkant = employees.reduce((s, e) => s + e.godkandaTimmar, 0)
    const totalOvertidInskickad = employees.reduce((s, e) => s + e.overtidInskickad, 0)
    const totalOvertidGodkand = employees.reduce((s, e) => s + e.overtidGodkand, 0)
    const totalAbsenceSubmitted = employees.reduce((s, e) => s + e.absenceHoursSubmitted, 0)
    const totalAbsenceApproved = employees.reduce((s, e) => s + e.absenceHoursApproved, 0)

    const redDaysInMonth = getWeekdaySwedishPublicHolidaysInMonth(month)

    return NextResponse.json({
      month,
      redDaysInMonth,
      employees,
      totals: {
        inskickadeTimmar: Math.round(totalInskickat * 100) / 100,
        godkandaTimmar: Math.round(totalGodkant * 100) / 100,
        overtidInskickad: Math.round(totalOvertidInskickad * 100) / 100,
        overtidGodkand: Math.round(totalOvertidGodkand * 100) / 100,
        absenceHoursSubmitted: Math.round(totalAbsenceSubmitted * 100) / 100,
        absenceHoursApproved: Math.round(totalAbsenceApproved * 100) / 100,
      },
    })
  } catch (error) {
    console.error('Fel vid månadssummering lön:', error)
    return NextResponse.json({ error: 'Kunde inte hämta data' }, { status: 500 })
  }
}
