import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'
import { employmentHasEnded } from '@/lib/accountStatus'
import { adminEffectiveCompanyId } from '@/lib/apiAdmin'
import { parseDateOnlyLocal } from '@/lib/parseDateOnlyLocal'
import { isBuyerReferenceUnsupported } from '@/lib/prismaCompat'
import { cleanOvertimeEntries, sumOvertimeHours } from '@/lib/overtime'

export const dynamic = 'force-dynamic'

async function getUserId(request: NextRequest): Promise<string | null> {
  const authHeader = request.headers.get('authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null
  }

  const token = authHeader.substring(7)
  const decoded = verifyToken(token)
  return decoded?.userId || null
}

export async function GET(request: NextRequest) {
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

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const month = searchParams.get('month')

    const reports = await prisma.timeReport.findMany({
      where: {
        userId,
        ...(status && status !== 'ALL' ? { status } : {}),
        ...(month ? { month } : {}),
      },
      include: {
        customer: {
          select: { id: true, name: true },
        },
        entries: {
          orderBy: { createdAt: 'asc' },
        },
        overtimeEntries: {
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: {
        date: 'desc',
      },
    })

    return NextResponse.json(reports)
  } catch (error) {
    console.error('Fel vid hämtning av tidrapporter:', error)
    return NextResponse.json(
      { error: 'Kunde inte hämta tidrapporter' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
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

    const body = await request.json()
    const { customerId, date, entries, missingHoursReason, buyerReference, overtimeEntries } = body

    let cleanedOvertime
    try {
      cleanedOvertime = cleanOvertimeEntries(overtimeEntries)
    } catch (e: any) {
      return NextResponse.json({ error: e.message ?? 'Ogiltig övertid' }, { status: 400 })
    }
    const overtimeTotal = sumOvertimeHours(cleanedOvertime)

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
      return NextResponse.json(
        { error: 'Användaren tillhör inget företag' },
        { status: 400 }
      )
    }

    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      select: { companyId: true },
    })
    if (!customer || customer.companyId !== effectiveCompanyId) {
      return NextResponse.json(
        { error: 'Kunden tillhör inte ditt företag' },
        { status: 400 }
      )
    }

    const cleanedEntries = entries.map((entry: any) => ({
      hours: Number(entry.hours) || 0,
      machineHours: entry.machineHours !== null && entry.machineHours !== undefined ? Number(entry.machineHours) : null,
      description: typeof entry.description === 'string' ? entry.description.trim() : '',
      machineType: typeof entry.machineType === 'string' ? entry.machineType.trim() : '',
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
      (sum: number, entry: any) => sum + (entry.machineHours && entry.machineHours > 0 ? entry.machineHours : 0),
      0
    )
    /** Timmar utan registrerade fordonstimmar — kräver förklaring, men räknas ändå som fakturerbar tid för kunden. */
    const remainingHours = totalHours - totalMachineHours

    if (remainingHours > 0 && (!missingHoursReason || !String(missingHoursReason).trim())) {
      return NextResponse.json(
        { error: `Du saknar ${remainingHours.toFixed(1)} timmar fordonstid. Förklara vad som gjorts resterande tid.` },
        { status: 400 }
      )
    }

    const reportDate = parseDateOnlyLocal(String(date))
    const month = `${reportDate.getFullYear()}-${String(reportDate.getMonth() + 1).padStart(2, '0')}`

    const buyerRefTrimmed =
      typeof buyerReference === 'string' && buyerReference.trim() ? buyerReference.trim() : null

    const createReport = (includeBuyerReference: boolean) =>
      prisma.timeReport.create({
        data: {
          userId,
          customerId,
          date: reportDate,
          year: reportDate.getFullYear(),
          totalHours,
          customerTotalHours: totalHours,
          overtimeHours: overtimeTotal,
          missingHoursReason: remainingHours > 0 ? String(missingHoursReason).trim() : null,
          ...(includeBuyerReference ? { buyerReference: buyerRefTrimmed } : {}),
          month,
          status: 'DRAFT',
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
          overtimeEntries: {
            create: cleanedOvertime.map((row) => ({
              startTime: row.startTime,
              endTime: row.endTime,
              hours: row.hours,
              note: row.note,
            })),
          },
        },
        include: {
          customer: {
            select: { id: true, name: true },
          },
          entries: true,
          overtimeEntries: true,
        },
      })

    let report
    try {
      report = await createReport(true)
    } catch (error) {
      if (!isBuyerReferenceUnsupported(error)) {
        throw error
      }
      report = await createReport(false)
    }

    return NextResponse.json(report, { status: 201 })
  } catch (error) {
    console.error('Fel vid skapande av tidrapport:', error)
    return NextResponse.json(
      { error: 'Kunde inte skapa tidrapport' },
      { status: 500 }
    )
  }
}
