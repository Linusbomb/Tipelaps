import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAdminApiUser, adminEffectiveCompanyId } from '@/lib/apiAdmin'
import {
  absenceReportUnlockUpdate,
  timeReportUnlockUpdate,
  UNLOCKABLE_ABSENCE_STATUSES,
  UNLOCKABLE_TIME_REPORT_STATUSES,
} from '@/lib/timeReportUnlock'

export const dynamic = 'force-dynamic'

/**
 * Återställer inskickade/godkända tidrapporter (och valfritt frånvaro för månad) till utkast
 * så att personal kan komplettera och skicka in igen.
 */
export async function POST(request: NextRequest) {
  try {
    const admin = await getAdminApiUser(request)
    if (!admin) {
      return NextResponse.json({ error: 'Ej auktoriserad' }, { status: 401 })
    }

    if (admin.role !== 'ENTREPRENEUR' && admin.role !== 'PAYROLL_COORDINATOR') {
      return NextResponse.json({ error: 'Endast admin kan låsa upp tidrapporter' }, { status: 403 })
    }

    const companyId = adminEffectiveCompanyId(admin)
    if (!companyId) {
      return NextResponse.json({ error: 'Du måste tillhöra ett företag' }, { status: 400 })
    }

    const body = await request.json().catch(() => ({}))
    const userId = typeof body.userId === 'string' ? body.userId.trim() : ''
    const month = typeof body.month === 'string' ? body.month.trim() : ''
    const reportIds = Array.isArray(body.reportIds)
      ? body.reportIds.filter((id: unknown) => typeof id === 'string' && id.trim()).map((id: string) => id.trim())
      : []
    const unlockAbsence = body.unlockAbsence !== false

    if (!userId) {
      return NextResponse.json({ error: 'Personal (userId) krävs' }, { status: 400 })
    }

    if (!month && reportIds.length === 0) {
      return NextResponse.json(
        { error: 'Ange månad (YYYY-MM) eller minst en rapport-id' },
        { status: 400 }
      )
    }

    const employee = await prisma.user.findFirst({
      where: { id: userId, companyId },
      select: { id: true, name: true },
    })

    if (!employee) {
      return NextResponse.json({ error: 'Personal hittades inte i ditt företag' }, { status: 404 })
    }

    const timeWhere = {
      userId,
      status: { in: [...UNLOCKABLE_TIME_REPORT_STATUSES] },
      ...(reportIds.length > 0 ? { id: { in: reportIds } } : {}),
      ...(month ? { month } : {}),
    }

    const toUnlock = await prisma.timeReport.findMany({
      where: timeWhere,
      select: { id: true },
    })

    if (reportIds.length > 0 && toUnlock.length === 0) {
      return NextResponse.json(
        { error: 'Inga inskickade eller godkända tidrapporter kunde låsas upp (redan utkast eller ogiltiga id)' },
        { status: 400 }
      )
    }

    let timeReportCount = 0
    if (toUnlock.length > 0) {
      const updated = await prisma.timeReport.updateMany({
        where: { id: { in: toUnlock.map((r) => r.id) } },
        data: timeReportUnlockUpdate,
      })
      timeReportCount = updated.count
    }

    let absenceReportCount = 0
    if (unlockAbsence && month) {
      const absenceUpdated = await prisma.absenceReport.updateMany({
        where: {
          userId,
          month,
          status: { in: [...UNLOCKABLE_ABSENCE_STATUSES] },
        },
        data: absenceReportUnlockUpdate,
      })
      absenceReportCount = absenceUpdated.count
    }

    if (timeReportCount === 0 && absenceReportCount === 0) {
      return NextResponse.json(
        { error: 'Inget att låsa upp för valt urval (inga inskickade rapporter)' },
        { status: 400 }
      )
    }

    return NextResponse.json({
      message: `${employee.name} kan nu komplettera och skicka in på nytt.`,
      timeReportCount,
      absenceReportCount,
      employeeName: employee.name,
    })
  } catch (error) {
    console.error('[admin/time-reports/unlock]', error)
    return NextResponse.json({ error: 'Kunde inte låsa upp tidrapporter' }, { status: 500 })
  }
}
