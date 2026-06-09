import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'
import { adminEffectiveCompanyId } from '@/lib/apiAdmin'
import { formatVehicleLabel, vehicleTypeLabel } from '@/lib/companyVehicles'
import { isoWeekRangeUtc, parseVehicleHoursQuery } from '@/lib/vehicleHours'

export const dynamic = 'force-dynamic'

async function getUser(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null
  }

  const token = authHeader.substring(7)
  const decoded = verifyToken(token)
  if (!decoded) return null

  return prisma.user.findUnique({
    where: { id: decoded.userId },
    include: { company: true, ownedCompany: true },
  })
}

export async function GET(request: NextRequest) {
  try {
    const user = await getUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Ej auktoriserad' }, { status: 401 })
    }

    if (user.role !== 'ENTREPRENEUR' && user.role !== 'PAYROLL_COORDINATOR') {
      return NextResponse.json({ error: 'Endast administratörer kan se fordonsstatistik' }, { status: 403 })
    }

    const companyId = adminEffectiveCompanyId(user)
    if (!companyId) {
      return NextResponse.json({ error: 'Du måste tillhöra ett företag' }, { status: 400 })
    }

    const { searchParams } = new URL(request.url)
    const period = searchParams.get('period') || 'month'
    const value = searchParams.get('value') || ''
    const parsed = parseVehicleHoursQuery(period, value)
    if (!parsed) {
      return NextResponse.json({ error: 'Ogiltig period eller värde' }, { status: 400 })
    }

    const reportWhere: {
      status: string
      month?: string
      year?: number
      date?: { gte: Date; lte: Date }
      user: { companyId: string }
    } = {
      status: 'APPROVED',
      user: { companyId },
    }

    if (parsed.period === 'month') {
      reportWhere.month = parsed.month
    } else if (parsed.period === 'year') {
      reportWhere.year = parsed.year
    } else {
      const { start, end } = isoWeekRangeUtc(parsed.year, parsed.week)
      reportWhere.date = { gte: start, lte: end }
    }

    const entries = await prisma.timeReportEntry.findMany({
      where: {
        machineHours: { gt: 0 },
        timeReport: reportWhere,
        OR: [{ vehicleId: { not: null } }, { vehicle: { not: null } }],
      },
      select: {
        vehicleId: true,
        vehicle: true,
        machineHours: true,
        vehicleRecord: {
          select: {
            id: true,
            name: true,
            type: true,
            registrationNumber: true,
          },
        },
      },
    })

    const vehicles = await prisma.companyVehicle.findMany({
      where: { companyId, deletedAt: null },
      orderBy: [{ type: 'asc' }, { registrationNumber: 'asc' }],
    })

    type Bucket = {
      vehicleId: string | null
      label: string
      type: string
      registrationNumber: string
      totalHours: number
      entryCount: number
    }

    const byKey = new Map<string, Bucket>()

    for (const vehicle of vehicles) {
      byKey.set(vehicle.id, {
        vehicleId: vehicle.id,
        label: formatVehicleLabel(vehicle),
        type: vehicle.type,
        registrationNumber: vehicle.registrationNumber,
        totalHours: 0,
        entryCount: 0,
      })
    }

    const legacyKey = (vehicle: string) => `legacy:${vehicle}`

    for (const entry of entries) {
      const hours = entry.machineHours ?? 0
      if (hours <= 0) continue

      if (entry.vehicleId && entry.vehicleRecord) {
        const bucket = byKey.get(entry.vehicleId)
        if (bucket) {
          bucket.totalHours += hours
          bucket.entryCount += 1
        } else {
          byKey.set(entry.vehicleId, {
            vehicleId: entry.vehicleId,
            label: formatVehicleLabel(entry.vehicleRecord),
            type: entry.vehicleRecord.type,
            registrationNumber: entry.vehicleRecord.registrationNumber,
            totalHours: hours,
            entryCount: 1,
          })
        }
        continue
      }

      if (entry.vehicle?.trim()) {
        const key = legacyKey(entry.vehicle.trim())
        const existing = byKey.get(key)
        if (existing) {
          existing.totalHours += hours
          existing.entryCount += 1
        } else {
          byKey.set(key, {
            vehicleId: null,
            label: entry.vehicle.trim(),
            type: 'ANNAT',
            registrationNumber: '',
            totalHours: hours,
            entryCount: 1,
          })
        }
      }
    }

    const rows = Array.from(byKey.values())
      .filter((row) => row.totalHours > 0 || row.vehicleId)
      .sort((a, b) => b.totalHours - a.totalHours || a.label.localeCompare(b.label, 'sv'))

    const grandTotal = rows.reduce((sum, row) => sum + row.totalHours, 0)

    return NextResponse.json({
      period: parsed,
      grandTotal,
      rows: rows.map((row) => ({
        ...row,
        typeLabel: vehicleTypeLabel(row.type),
      })),
    })
  } catch (error: unknown) {
    console.error('Fel vid hämtning av fordonsstatistik:', error)
    return NextResponse.json({ error: 'Kunde inte hämta fordonsstatistik' }, { status: 500 })
  }
}
