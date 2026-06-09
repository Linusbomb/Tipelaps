import { prisma } from '@/lib/prisma'
import { vehicleCombinedString, vehicleTypeLabel } from '@/lib/companyVehicles'

export type RawTimeReportEntryInput = {
  hours?: number | string | null
  machineHours?: number | string | null
  description?: string | null
  machineType?: string | null
  registrationNumber?: string | null
  vehicleId?: string | null
  startTime?: string | null
  endTime?: string | null
}

export type CleanedTimeReportEntry = {
  hours: number
  machineHours: number | null
  description: string
  machineType: string
  registrationNumber: string
  vehicleId: string | null
  vehicle: string | null
  startTime: string | null
  endTime: string | null
}

export async function normalizeTimeReportEntries(
  companyId: string,
  entries: RawTimeReportEntryInput[],
  cleanClockTime: (value: unknown) => string | null
): Promise<{ entries: CleanedTimeReportEntry[]; error?: string }> {
  const cleaned: CleanedTimeReportEntry[] = []

  for (const entry of entries) {
    const vehicleId =
      typeof entry.vehicleId === 'string' && entry.vehicleId.trim()
        ? entry.vehicleId.trim()
        : null

    let machineType =
      typeof entry.machineType === 'string' ? entry.machineType.trim() : ''
    let registrationNumber =
      typeof entry.registrationNumber === 'string' ? entry.registrationNumber.trim() : ''
    let vehicle: string | null = null
    let resolvedVehicleId: string | null = null

    if (vehicleId) {
      const record = await prisma.companyVehicle.findFirst({
        where: {
          id: vehicleId,
          companyId,
          deletedAt: null,
          archivedAt: null,
        },
      })
      if (!record) {
        return { entries: [], error: 'Valt fordon finns inte i registret eller är inaktivt.' }
      }
      machineType = vehicleTypeLabel(record.type)
      registrationNumber = record.registrationNumber.trim()
      vehicle = vehicleCombinedString(record.type, record.registrationNumber)
      resolvedVehicleId = record.id
    } else if (machineType && registrationNumber) {
      vehicle = `${machineType} (${registrationNumber})`
    } else if (machineType && !registrationNumber) {
      return { entries: [], error: 'Reg.nr måste anges om fordon väljs.' }
    } else if (!machineType && registrationNumber) {
      return {
        entries: [],
        error: 'Välj ett fordon från registret eller ange fordonstyp om du fyller i reg.nr.',
      }
    }

    cleaned.push({
      hours: Number(entry.hours) || 0,
      machineHours:
        entry.machineHours !== null && entry.machineHours !== undefined
          ? Number(entry.machineHours)
          : null,
      description: typeof entry.description === 'string' ? entry.description.trim() : '',
      machineType,
      registrationNumber,
      vehicleId: resolvedVehicleId,
      vehicle,
      startTime: cleanClockTime(entry.startTime),
      endTime: cleanClockTime(entry.endTime),
    })
  }

  return { entries: cleaned }
}
