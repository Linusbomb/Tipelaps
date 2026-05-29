import { absenceScopeLabel, absenceTypeLabel } from '@/lib/absence'
import { formatCoverageDateSv } from '@/lib/monthDayCoverage'
import { normalizeReportDate } from '@/lib/timeReportForm'

export type DayTimeReport = {
  date: string | Date
  status?: string
  totalHours?: number | null
  customer?: { name?: string | null } | null
}

export type DayAbsence = {
  date: string | Date
  status?: string
  type: string
  isFullDay: boolean
  hours?: number | null
}

function reportStatusLabel(status?: string): string {
  if (!status || status === 'DRAFT') return 'utkast'
  if (status === 'SUBMITTED') return 'inskickad'
  if (status === 'APPROVED') return 'godkänd'
  return status.toLowerCase()
}

export function registrationsOnDate<T extends { date: string | Date }>(
  items: T[],
  isoDate: string
): T[] {
  return items.filter((item) => normalizeReportDate(item.date) === isoDate)
}

export function describeDayRegistrations(
  timeReports: DayTimeReport[],
  absences: DayAbsence[]
): string[] {
  const lines: string[] = []

  for (const report of timeReports) {
    const customer = report.customer?.name?.trim()
    const hours =
      report.totalHours != null && !Number.isNaN(Number(report.totalHours))
        ? `${Number(report.totalHours)} h`
        : ''
    const label = customer ? `Tidrapport (${customer})` : 'Tidrapport'
    lines.push([label, hours, `(${reportStatusLabel(report.status)})`].filter(Boolean).join(' – '))
  }

  for (const absence of absences) {
    lines.push(
      `Frånvaro: ${absenceTypeLabel(absence.type)} (${absenceScopeLabel(absence.isFullDay, absence.hours)}) – ${reportStatusLabel(absence.status)}`
    )
  }

  return lines
}

export function buildDayRegistrationConflictMessage(
  isoDate: string,
  timeReports: DayTimeReport[],
  absences: DayAbsence[]
): string | null {
  const dayReports = registrationsOnDate(timeReports, isoDate)
  const dayAbsences = registrationsOnDate(absences, isoDate)
  const descriptions = describeDayRegistrations(dayReports, dayAbsences)
  if (descriptions.length === 0) return null

  const dateLabel = formatCoverageDateSv(isoDate)
  return [
    `Det finns redan registrering på ${dateLabel}:`,
    ...descriptions.map((line) => `• ${line}`),
    '',
    'Vill du lägga till en till registrering ändå?',
  ].join('\n')
}
