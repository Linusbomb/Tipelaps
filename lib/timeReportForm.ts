import { formatCalendarDateKey } from '@/lib/parseDateOnlyLocal'

export type TimeReportEntryRow = {
  hours: number
  description: string
  machineHours: number | null
  startTime: string
  endTime: string
  machineType: string
  registrationNumber: string
}

export type MyProjectOption = {
  id: string
  name: string
  customerId: string
}

export function mapApiProjectsToOptions(
  projects: Array<{ id: string; name: string; customer?: { id: string } | null; customerId?: string }>
): MyProjectOption[] {
  return projects.map((project) => ({
    id: project.id,
    name: project.name,
    customerId: project.customer?.id || project.customerId || '',
  }))
}

/** Kund kopplad till valt projekt (för autofyll i tidrapport). */
export function customerIdForSelectedProject(
  projects: MyProjectOption[],
  projectId: string
): string | null {
  if (!projectId) return null
  const match = projects.find((project) => project.id === projectId)
  return match?.customerId || null
}

export type ProjectPrefillPayload = {
  customerId?: string
  customerName?: string
  projectId?: string
  projectName?: string
  address?: string
  description?: string
  assignedEquipment?: string
  copiedAt?: string
}

export function parseVehicleFromEntry(
  vehicle: string | null | undefined
): { machineType: string; registrationNumber: string } {
  if (!vehicle || !vehicle.trim()) return { machineType: '', registrationNumber: '' }
  const m = vehicle.trim().match(/^(.+?) \(([^)]+)\)\s*$/)
  if (m) return { machineType: m[1].trim(), registrationNumber: m[2].trim() }
  return { machineType: 'Annat', registrationNumber: vehicle.trim() }
}

export function mapApiEntriesToFormRows(
  apiEntries: Array<{
    hours?: number | null
    description?: string | null
    machineHours?: number | null
    startTime?: string | null
    endTime?: string | null
    vehicle?: string | null
  }>
): TimeReportEntryRow[] {
  if (!apiEntries.length) {
    return [
      {
        hours: 0,
        description: '',
        machineHours: null,
        startTime: '',
        endTime: '',
        machineType: '',
        registrationNumber: '',
      },
    ]
  }

  return apiEntries.map((entry) => {
    const { machineType, registrationNumber } = parseVehicleFromEntry(entry.vehicle)
    return {
      hours: entry.hours ?? 0,
      description: entry.description ?? '',
      machineHours: entry.machineHours ?? null,
      startTime: entry.startTime ?? '',
      endTime: entry.endTime ?? '',
      machineType,
      registrationNumber,
    }
  })
}

export function addDaysToIsoDate(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T12:00:00`)
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

export function normalizeReportDate(date: string | Date): string {
  if (typeof date === 'string') {
    const trimmed = date.trim()
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed
    const parsed = new Date(trimmed)
    if (!Number.isNaN(parsed.getTime())) return formatCalendarDateKey(parsed)
    return trimmed.slice(0, 10)
  }
  return formatCalendarDateKey(date)
}

export function findReportForDate<T extends { date: string | Date; createdAt?: string | Date }>(
  reports: T[],
  isoDate: string
): T | null {
  const matches = reports.filter((report) => normalizeReportDate(report.date) === isoDate)
  if (matches.length === 0) return null
  return [...matches].sort((a, b) => {
    const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0
    const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0
    return bTime - aTime
  })[0]
}

export function buildProjectPrefillDescription(project: {
  name: string
  address?: string | null
  description?: string | null
  assignedEquipment?: string | null
}): string {
  const lines: string[] = [`Projekt: ${project.name}`]
  if (project.address?.trim()) lines.push(`Adress: ${project.address.trim()}`)
  if (project.description?.trim()) lines.push(project.description.trim())
  if (project.assignedEquipment?.trim()) {
    lines.push(`Tilldelat fordon: ${project.assignedEquipment.trim()}`)
  }
  return lines.join('\n')
}

export function extractFormStateFromReport(report: {
  customerId?: string | null
  customer?: { id: string; name?: string } | null
  projectId?: string | null
  project?: { id: string; name?: string } | null
  buyerReference?: string | null
  missingHoursReason?: string | null
  entries?: Array<{
    hours?: number | null
    description?: string | null
    machineHours?: number | null
    startTime?: string | null
    endTime?: string | null
    vehicle?: string | null
  }>
}): {
  customerId: string
  projectId: string
  buyerReference: string
  missingHoursReason: string
  entries: TimeReportEntryRow[]
} {
  return {
    customerId: report.customer?.id || report.customerId || '',
    projectId: report.project?.id || report.projectId || '',
    buyerReference: report.buyerReference?.trim() || '',
    missingHoursReason: report.missingHoursReason?.trim() || '',
    entries: mapApiEntriesToFormRows(report.entries || []),
  }
}
