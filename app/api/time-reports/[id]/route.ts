import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'
import { employmentHasEnded } from '@/lib/accountStatus'
import { adminEffectiveCompanyId } from '@/lib/apiAdmin'
import { parseDateOnlyLocal } from '@/lib/parseDateOnlyLocal'
import { isBuyerReferenceUnsupported } from '@/lib/prismaCompat'
import { persistReportOvertimeHours } from '@/lib/overtime'
import { cleanClockTime, persistTimeEntryClockTimes } from '@/lib/timeEntryClockTimes'
import { resolveTimeReportSubject } from '@/lib/timeReportSubject'

export const dynamic = 'force-dynamic'

/** Personal får endast redigera/ta bort utkast – inte efter inlämning till admin. */
const EDITABLE_STATUSES = ['DRAFT']

async function getUserId(request: NextRequest): Promise<string | null> {
  const authHeader = request.headers.get('authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null

  const token = authHeader.substring(7)
  const decoded = verifyToken(token)
  return decoded?.userId || null
}

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const userId = await getUserId(request)
    if (!userId) {
      return NextResponse.json({ error: 'Ej auktoriserad' }, { status: 401 })
    }

    if (await employmentHasEnded(userId)) {
      return NextResponse.json(
        { error: 'Ditt arbetskonto är avslutat.', inactive: true },
        { status: 403 }
      )
    }

    const report = await prisma.timeReport.findFirst({
      where: { id: params.id, userId },
      include: {
        customer: { select: { id: true, name: true } },
        project: { select: { id: true, name: true } },
        entries: { orderBy: { createdAt: 'asc' } },
        attachments: { orderBy: { createdAt: 'desc' } },
      },
    })

    if (!report) {
      return NextResponse.json({ error: 'Tidrapport hittades inte' }, { status: 404 })
    }

    return NextResponse.json({
      ...report,
      editable: EDITABLE_STATUSES.includes(report.status),
    })
  } catch (error) {
    console.error('Fel vid hämtning av tidrapport:', error)
    return NextResponse.json({ error: 'Kunde inte hämta tidrapport' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const userId = await getUserId(request)
    if (!userId) {
      return NextResponse.json({ error: 'Ej auktoriserad' }, { status: 401 })
    }

    if (await employmentHasEnded(userId)) {
      return NextResponse.json(
        { error: 'Ditt arbetskonto är avslutat.', inactive: true },
        { status: 403 }
      )
    }

    const existing = await prisma.timeReport.findFirst({
      where: { id: params.id, userId },
      select: { id: true, status: true },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Tidrapport hittades inte' }, { status: 404 })
    }

    if (!EDITABLE_STATUSES.includes(existing.status)) {
      return NextResponse.json(
        { error: 'Inskickade eller godkända tidrapporter kan inte ändras.' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const { customerId, projectId, date, entries, missingHoursReason, buyerReference } = body

    if (!customerId || !date || !Array.isArray(entries) || entries.length === 0) {
      return NextResponse.json(
        { error: 'Kund, datum och minst en aktivitet krävs' },
        { status: 400 }
      )
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { companyId: true, ownedCompany: { select: { id: true } } },
    })
    const effectiveCompanyId = user ? adminEffectiveCompanyId(user) : null
    if (!effectiveCompanyId) {
      return NextResponse.json({ error: 'Användaren tillhör inget företag' }, { status: 400 })
    }

    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      select: { companyId: true },
    })
    if (!customer || customer.companyId !== effectiveCompanyId) {
      return NextResponse.json({ error: 'Kunden tillhör inte ditt företag' }, { status: 400 })
    }

    let validProjectId: string | null = null
    if (projectId && String(projectId).trim()) {
      const project = await prisma.project.findUnique({
        where: { id: String(projectId) },
        select: { id: true, companyId: true },
      })
      if (!project || project.companyId !== effectiveCompanyId) {
        return NextResponse.json({ error: 'Projektet tillhör inte ditt företag' }, { status: 400 })
      }
      validProjectId = project.id
    }

    const cleanedEntries = entries.map((entry: any) => ({
      hours: Number(entry.hours) || 0,
      machineHours: entry.machineHours !== null && entry.machineHours !== undefined ? Number(entry.machineHours) : null,
      description: typeof entry.description === 'string' ? entry.description.trim() : '',
      machineType: typeof entry.machineType === 'string' ? entry.machineType.trim() : '',
      startTime: cleanClockTime(entry.startTime),
      endTime: cleanClockTime(entry.endTime),
      registrationNumber:
        typeof entry.registrationNumber === 'string' ? entry.registrationNumber.trim() : '',
    }))

    if (cleanedEntries.some((entry: any) => entry.hours <= 0 || !entry.description)) {
      return NextResponse.json(
        { error: 'Varje aktivitet måste ha timmar över 0 och en beskrivning' },
        { status: 400 }
      )
    }

    const missingRegForVehicle = cleanedEntries.find((entry: any) => {
      const hasVehicle = !!(entry.machineType && String(entry.machineType).trim())
      const hasReg = !!(entry.registrationNumber && String(entry.registrationNumber).trim())
      return hasVehicle && !hasReg
    })
    if (missingRegForVehicle) {
      return NextResponse.json({ error: 'Reg.nr måste anges om fordon väljs.' }, { status: 400 })
    }
    const orphanRegNumber = cleanedEntries.find((entry: any) => {
      const hasVehicle = !!(entry.machineType && String(entry.machineType).trim())
      const hasReg = !!(entry.registrationNumber && String(entry.registrationNumber).trim())
      return !hasVehicle && hasReg
    })
    if (orphanRegNumber) {
      return NextResponse.json(
        { error: 'Välj ett fordon om du anger reg.nr, eller lämna reg.nr tom.' },
        { status: 400 }
      )
    }

    const totalHours = cleanedEntries.reduce((sum: number, entry: any) => sum + entry.hours, 0)
    const totalMachineHours = cleanedEntries.reduce(
      (sum: number, entry: any) =>
        sum + (entry.machineHours && entry.machineHours > 0 ? entry.machineHours : 0),
      0
    )
    /** Kvar utan fordonstimmar — motiveras med missingHoursReason; påverkar inte hur mycket som faktureras till kund. */
    const remainingHours = totalHours - totalMachineHours

    if (remainingHours > 0 && (!missingHoursReason || !String(missingHoursReason).trim())) {
      return NextResponse.json(
        {
          error: `Du saknar ${remainingHours.toFixed(1)} timmar fordonstid. Förklara vad som gjorts resterande tid.`,
        },
        { status: 400 }
      )
    }

    const reportDate = parseDateOnlyLocal(String(date))
    const month = `${reportDate.getFullYear()}-${String(reportDate.getMonth() + 1).padStart(2, '0')}`

    const buyerRefTrimmed =
      typeof buyerReference === 'string' && buyerReference.trim() ? buyerReference.trim() : null

    const updateReport = async (includeBuyerReference: boolean) => {
      await prisma.$transaction(async (tx) => {
        await tx.timeReportEntry.deleteMany({
          where: { timeReportId: existing.id },
        })

        await tx.timeReport.update({
          where: { id: existing.id },
          data: {
            customerId,
            projectId: validProjectId,
            date: reportDate,
            year: reportDate.getFullYear(),
            month,
            totalHours,
            customerTotalHours: totalHours,
            missingHoursReason: remainingHours > 0 ? String(missingHoursReason).trim() : null,
            ...(includeBuyerReference ? { buyerReference: buyerRefTrimmed } : {}),
            entries: {
              create: cleanedEntries.map((entry: any) => ({
                hours: entry.hours,
                machineHours: entry.machineHours,
                description: entry.description,
                vehicle:
                  entry.machineType && entry.registrationNumber
                    ? `${entry.machineType} (${entry.registrationNumber})`
                    : null,
              })),
            },
          },
        })
      })
    }

    try {
      await updateReport(true)
    } catch (error) {
      if (!isBuyerReferenceUnsupported(error)) {
        throw error
      }
      await updateReport(false)
    }

    await persistReportOvertimeHours(existing.id, totalHours, cleanedEntries)

    let updated = await prisma.timeReport.findUnique({
      where: { id: existing.id },
      include: {
        customer: { select: { id: true, name: true } },
        project: { select: { id: true, name: true } },
        entries: { orderBy: { createdAt: 'asc' } },
        attachments: { orderBy: { createdAt: 'desc' } },
      },
    })

    if (!updated) {
      return NextResponse.json({ error: 'Kunde inte ladda uppdaterad rapport' }, { status: 500 })
    }

    await persistTimeEntryClockTimes(updated.entries, cleanedEntries)

    updated = await prisma.timeReport.findUnique({
      where: { id: existing.id },
      include: {
        customer: { select: { id: true, name: true } },
        project: { select: { id: true, name: true } },
        entries: { orderBy: { createdAt: 'asc' } },
        attachments: { orderBy: { createdAt: 'desc' } },
      },
    })

    if (!updated) {
      return NextResponse.json({ error: 'Kunde inte ladda uppdaterad rapport' }, { status: 500 })
    }

    return NextResponse.json({
      ...updated,
      editable: EDITABLE_STATUSES.includes(updated.status),
    })
  } catch (error) {
    console.error('Fel vid uppdatering av tidrapport:', error)
    return NextResponse.json({ error: 'Kunde inte uppdatera tidrapport' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const userId = await getUserId(request)
    if (!userId) {
      return NextResponse.json({ error: 'Ej auktoriserad' }, { status: 401 })
    }

    if (await employmentHasEnded(userId)) {
      return NextResponse.json(
        { error: 'Ditt arbetskonto är avslutat.', inactive: true },
        { status: 403 }
      )
    }

    const existing = await prisma.timeReport.findFirst({
      where: { id: params.id },
      select: { id: true, status: true, userId: true },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Tidrapport hittades inte' }, { status: 404 })
    }

    const subject = await resolveTimeReportSubject(userId, existing.userId)
    if (!subject.ok) return subject.response

    if (subject.reportUserId !== existing.userId) {
      return NextResponse.json({ error: 'Du har inte behörighet att ta bort denna rapport' }, { status: 403 })
    }

    if (existing.status !== 'DRAFT') {
      return NextResponse.json(
        { error: 'Endast utkast kan tas bort. Inskickade eller godkända rapporter är låsta.' },
        { status: 400 }
      )
    }

    await prisma.timeReport.delete({ where: { id: existing.id } })

    return NextResponse.json({ message: 'Tidrapporten har tagits bort' })
  } catch (error) {
    console.error('Fel vid borttagning av tidrapport:', error)
    return NextResponse.json({ error: 'Kunde inte ta bort tidrapport' }, { status: 500 })
  }
}
