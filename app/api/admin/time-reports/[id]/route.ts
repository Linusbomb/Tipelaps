import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'
import { isBuyerReferenceUnsupported } from '@/lib/prismaCompat'
import { persistReportOvertimeHours } from '@/lib/overtime'
import { cleanClockTime, persistTimeEntryClockTimes } from '@/lib/timeEntryClockTimes'

export const dynamic = 'force-dynamic'

async function getUser(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null
  }

  const token = authHeader.substring(7)
  const decoded = verifyToken(token)
  if (!decoded) return null

  const user = await prisma.user.findUnique({
    where: { id: decoded.userId },
    include: { company: true, ownedCompany: true },
  })

  return user
}

function parseVehicleCombined(vehicle: string | null | undefined): { type: string; reg: string } {
  if (!vehicle || !vehicle.trim()) return { type: '', reg: '' }
  const m = vehicle.trim().match(/^(.+?) \(([^)]+)\)\s*$/)
  if (m) return { type: m[1].trim(), reg: m[2].trim() }
  return { type: vehicle.trim(), reg: '' }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Ej auktoriserad' }, { status: 401 })
    }

    if (user.role !== 'ENTREPRENEUR' && user.role !== 'PAYROLL_COORDINATOR') {
      return NextResponse.json({ error: 'Endast chefer och lönesamordnare har åtkomst' }, { status: 403 })
    }

    const report = await prisma.timeReport.findUnique({
      where: { id: params.id },
      include: {
        user: {
          select: { id: true, name: true, email: true, companyId: true },
        },
        customer: {
          select: { id: true, name: true },
        },
        entries: true,
      },
    })

    if (!report) {
      return NextResponse.json({ error: 'Tidrapport hittades inte' }, { status: 404 })
    }

    const adminCompanyId = user.ownedCompany?.id ?? user.companyId
    if (report.user.companyId !== adminCompanyId) {
      return NextResponse.json({ error: 'Du har inte behörighet att se denna rapport' }, { status: 403 })
    }

    return NextResponse.json(report)
  } catch (error: any) {
    console.error('Fel vid hämtning av tidrapport:', error)
    return NextResponse.json(
      { error: 'Kunde inte hämta tidrapport' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Ej auktoriserad' }, { status: 401 })
    }

    if (user.role !== 'ENTREPRENEUR' && user.role !== 'PAYROLL_COORDINATOR') {
      return NextResponse.json({ error: 'Endast chefer och lönesamordnare kan redigera' }, { status: 403 })
    }

    const { id } = params
    const body = await request.json()
    const {
      date,
      customerId,
      entries,
      missingHoursReason,
      buyerReference,
      payrollTotalHours,
      customerTotalHours,
    } = body

    if (!date) {
      return NextResponse.json({ error: 'Datum krävs' }, { status: 400 })
    }
    if (!customerId || customerId === '' || customerId === 'null' || customerId === 'undefined') {
      return NextResponse.json({ error: 'Kund krävs' }, { status: 400 })
    }

    if (!entries || !Array.isArray(entries) || entries.length === 0) {
      return NextResponse.json({ error: 'Minst en aktivitet krävs' }, { status: 400 })
    }

    const report = await prisma.timeReport.findUnique({
      where: { id },
      include: { user: true },
    })

    if (!report) {
      return NextResponse.json({ error: 'Tidrapport hittades inte' }, { status: 404 })
    }

    const adminCompanyId = user.ownedCompany?.id ?? user.companyId
    if (report.user.companyId !== adminCompanyId) {
      return NextResponse.json({ error: 'Du har inte behörighet att redigera denna rapport' }, { status: 403 })
    }

    const cleanedRows: Array<{
      hours: number
      machineHours: number | null
      description: string
      vehicle: string | null
      startTime: string | null
      endTime: string | null
      location: string | null
      referenceNumber: string | null
    }> = []

    for (let i = 0; i < entries.length; i++) {
      const raw = entries[i]
      const hours = parseFloat(raw.hours)
      const description = typeof raw.description === 'string' ? raw.description.trim() : ''
      if (!hours || hours <= 0) {
        return NextResponse.json({ error: `Rad ${i + 1}: arbetade timmar måste vara större än 0` }, { status: 400 })
      }
      if (!description) {
        return NextResponse.json({ error: `Rad ${i + 1}: beskrivning krävs` }, { status: 400 })
      }

      let machineHours: number | null =
        raw.machineHours !== undefined && raw.machineHours !== null && raw.machineHours !== ''
          ? parseFloat(raw.machineHours)
          : null
      if (machineHours !== null && Number.isNaN(machineHours)) {
        machineHours = null
      }

      let machineType = typeof raw.machineType === 'string' ? raw.machineType.trim() : ''
      let registrationNumber = typeof raw.registrationNumber === 'string' ? raw.registrationNumber.trim() : ''
      const vehicleLegacy = typeof raw.vehicle === 'string' ? raw.vehicle.trim() : ''

      if (!machineType && !registrationNumber && vehicleLegacy) {
        const parsed = parseVehicleCombined(vehicleLegacy)
        machineType = parsed.type
        registrationNumber = parsed.reg || registrationNumber
      }

      const hasVehicleType = !!(machineType && machineType.trim())
      const hasReg = !!(registrationNumber && registrationNumber.trim())
      if (hasVehicleType && !hasReg) {
        return NextResponse.json(
          { error: `Rad ${i + 1}: reg.nr måste anges om fordon väljs` },
          { status: 400 }
        )
      }
      if (!hasVehicleType && hasReg) {
        return NextResponse.json(
          { error: `Rad ${i + 1}: välj fordon eller ta bort reg.nr` },
          { status: 400 }
        )
      }

      const vehicleCombined =
        machineType && registrationNumber ? `${machineType.trim()} (${registrationNumber.trim()})` : null

      cleanedRows.push({
        hours,
        machineHours,
        description,
        vehicle: vehicleCombined,
        startTime: cleanClockTime(raw.startTime),
        endTime: cleanClockTime(raw.endTime),
        location: typeof raw.location === 'string' && raw.location.trim() ? raw.location.trim() : null,
        referenceNumber:
          typeof raw.referenceNumber === 'string' && raw.referenceNumber.trim()
            ? raw.referenceNumber.trim()
            : null,
      })
    }

    const activityTotalHours = cleanedRows.reduce((sum, row) => sum + row.hours, 0)
    const totalHours =
      payrollTotalHours !== undefined && payrollTotalHours !== null && payrollTotalHours !== ''
        ? Number(payrollTotalHours)
        : activityTotalHours
    if (!Number.isFinite(totalHours) || totalHours < 0) {
      return NextResponse.json({ error: 'Lönetid måste vara 0 eller mer' }, { status: 400 })
    }
    const billableHours =
      customerTotalHours !== undefined && customerTotalHours !== null && customerTotalHours !== ''
        ? Number(customerTotalHours)
        : totalHours
    if (!Number.isFinite(billableHours) || billableHours < 0) {
      return NextResponse.json({ error: 'Debiterbar tid måste vara 0 eller mer' }, { status: 400 })
    }
    const totalMachineHours = cleanedRows.reduce(
      (sum, row) => sum + (row.machineHours && row.machineHours > 0 ? row.machineHours : 0),
      0
    )
    /** Tid utöver vad som finns som fordonstimmar — ska förklaras om > 0 (påverkar inte kundtid). */
    const remainingHours = Math.max(0, totalHours - totalMachineHours)
    const reason =
      typeof missingHoursReason === 'string' ? missingHoursReason.trim() : ''

    const buyerRefTrimmed =
      typeof buyerReference === 'string' && buyerReference.trim() ? buyerReference.trim() : null

    if (remainingHours > 0 && !reason) {
      return NextResponse.json(
        { error: `Det saknas ${remainingHours.toFixed(1)} h mot fordonstimmar — motivering krävs (samma som för personal)` },
        { status: 400 }
      )
    }

    const reportDate = new Date(date)
    const reportYear = reportDate.getFullYear()
    const month = `${reportYear}-${String(reportDate.getMonth() + 1).padStart(2, '0')}`

    const updateReport = (includeBuyerReference: boolean) =>
      prisma.timeReport.update({
        where: { id },
        data: {
          date: new Date(date),
          year: reportYear,
          customerId: customerId,
          customerTotalHours: Math.round(billableHours * 100) / 100,
          totalHours,
          missingHoursReason: remainingHours > 0 ? reason : null,
          ...(includeBuyerReference ? { buyerReference: buyerRefTrimmed } : {}),
          month,
          entries: {
            deleteMany: {},
            create: cleanedRows.map((row) => ({
              hours: row.hours,
              machineHours: row.machineHours,
              description: row.description,
              vehicle: row.vehicle,
              location: row.location,
              referenceNumber: row.referenceNumber,
            })),
          },
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          entries: true,
        },
      })

    let updatedReport
    try {
      updatedReport = await updateReport(true)
    } catch (error) {
      if (!isBuyerReferenceUnsupported(error)) {
        throw error
      }
      updatedReport = await updateReport(false)
    }

    await persistReportOvertimeHours(id, totalHours, cleanedRows)
    await persistTimeEntryClockTimes(updatedReport.entries, cleanedRows)

    return NextResponse.json({
      ...updatedReport,
      entries: updatedReport.entries.map((entry, index) => ({
        ...entry,
        startTime: cleanedRows[index]?.startTime ?? null,
        endTime: cleanedRows[index]?.endTime ?? null,
      })),
    })
  } catch (error: any) {
    console.error('Fel vid uppdatering av tidrapport:', error)
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name,
    })
    return NextResponse.json(
      { error: error.message || 'Kunde inte uppdatera tidrapport' },
      { status: 500 }
    )
  }
}
