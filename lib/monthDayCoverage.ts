import { absenceHoursForPayroll } from '@/lib/absence'
import { parseDateOnlyLocal } from '@/lib/parseDateOnlyLocal'

export const STANDARD_WORK_DAY_HOURS = 8

export type DayCoverageStatus =
  | 'complete'
  | 'partial'
  | 'missing'
  | 'future'
  | 'weekend'

export type DayCoverage = {
  date: string
  dayOfMonth: number
  weekday: number
  weekdayLabel: string
  status: DayCoverageStatus
  workHours: number
  absenceHours: number
  totalHours: number
  missingHours: number
  /** Minst en tidrapport (utkast eller inlämnad) finns för dagen. */
  hasTimeReport: boolean
  /** Utkast (tid eller frånvaro) — dagen visas inte under «Dagar att åtgärda». */
  hasDraft: boolean
}

export type BuildMonthDayCoverageOptions = {
  datesWithTimeReport?: Set<string>
  datesWithDraft?: Set<string>
  referenceDate?: Date
}

export type MonthCoverageSummary = {
  complete: number
  partial: number
  missing: number
  future: number
  weekend: number
}

const WEEKDAY_LABELS = ['Sön', 'Mån', 'Tis', 'Ons', 'Tor', 'Fre', 'Lör'] as const

export function toDateKey(value: Date | string): string {
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
      return trimmed.slice(0, 10)
    }
    return toDateKey(parseDateOnlyLocal(trimmed))
  }
  const y = value.getFullYear()
  const m = String(value.getMonth() + 1).padStart(2, '0')
  const d = String(value.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function isWeekdayDate(date: Date): boolean {
  const day = date.getDay()
  return day >= 1 && day <= 5
}

export function parseMonthKey(monthKey: string): { year: number; monthIndex: number } {
  const [y, m] = monthKey.split('-').map(Number)
  return { year: y, monthIndex: m - 1 }
}

export function buildHoursByDate(
  timeReports: Array<{ date: Date | string; totalHours?: number | null }>,
  absences: Array<{
    date: Date | string
    isFullDay: boolean
    hours?: number | null
  }>
): Map<string, { workHours: number; absenceHours: number }> {
  const map = new Map<string, { workHours: number; absenceHours: number }>()

  const ensure = (key: string) => {
    if (!map.has(key)) map.set(key, { workHours: 0, absenceHours: 0 })
    return map.get(key)!
  }

  for (const report of timeReports) {
    const key = toDateKey(report.date)
    const row = ensure(key)
    row.workHours += Number(report.totalHours) || 0
  }

  for (const absence of absences) {
    const key = toDateKey(absence.date)
    const row = ensure(key)
    row.absenceHours += absenceHoursForPayroll(absence.isFullDay, absence.hours)
  }

  return map
}

export function buildMonthDayCoverage(
  monthKey: string,
  hoursByDate: Map<string, { workHours: number; absenceHours: number }>,
  options: BuildMonthDayCoverageOptions = {}
): { days: DayCoverage[]; summary: MonthCoverageSummary } {
  const referenceDate = options.referenceDate ?? new Date()
  const datesWithTimeReport = options.datesWithTimeReport ?? new Set<string>()
  const datesWithDraft = options.datesWithDraft ?? new Set<string>()
  const { year, monthIndex } = parseMonthKey(monthKey)
  const todayKey = toDateKey(referenceDate)
  const lastDay = new Date(year, monthIndex + 1, 0).getDate()

  const days: DayCoverage[] = []
  const summary: MonthCoverageSummary = {
    complete: 0,
    partial: 0,
    missing: 0,
    future: 0,
    weekend: 0,
  }

  for (let day = 1; day <= lastDay; day += 1) {
    const date = new Date(year, monthIndex, day)
    const dateKey = toDateKey(date)
    const weekday = date.getDay()
    const weekdayLabel = WEEKDAY_LABELS[weekday]
    const hours = hoursByDate.get(dateKey) ?? { workHours: 0, absenceHours: 0 }
    const totalHours = hours.workHours + hours.absenceHours

    let status: DayCoverageStatus
    let missingHours = 0

    if (!isWeekdayDate(date)) {
      status = 'weekend'
      summary.weekend += 1
    } else if (dateKey > todayKey) {
      status = 'future'
      summary.future += 1
    } else if (totalHours <= 0) {
      status = 'missing'
      missingHours = STANDARD_WORK_DAY_HOURS
      summary.missing += 1
    } else if (totalHours < STANDARD_WORK_DAY_HOURS) {
      status = 'partial'
      missingHours = STANDARD_WORK_DAY_HOURS - totalHours
      summary.partial += 1
    } else {
      status = 'complete'
      summary.complete += 1
    }

    days.push({
      date: dateKey,
      dayOfMonth: day,
      weekday,
      weekdayLabel,
      status,
      workHours: Math.round(hours.workHours * 10) / 10,
      absenceHours: Math.round(hours.absenceHours * 10) / 10,
      totalHours: Math.round(totalHours * 10) / 10,
      missingHours: Math.round(missingHours * 10) / 10,
      hasTimeReport: datesWithTimeReport.has(dateKey),
      hasDraft: datesWithDraft.has(dateKey),
    })
  }

  return { days, summary }
}

export function coverageHasWarnings(days: DayCoverage[]): boolean {
  return warningDaysFromCoverage(days).length > 0
}

/** Vardagar som saknar täckning och inte har utkast. */
export function warningDaysFromCoverage(days: DayCoverage[]): DayCoverage[] {
  return days.filter(
    (d) =>
      isWeekdayDate(parseDateOnlyLocal(d.date)) &&
      d.status !== 'future' &&
      !d.hasDraft &&
      (d.status === 'missing' || d.status === 'partial')
  )
}

export function buildCoverageDraftDateSets(
  timeReports: Array<{ date: Date | string; status: string }>,
  absences: Array<{ date: Date | string; status: string }>
): { datesWithTimeReport: Set<string>; datesWithDraft: Set<string> } {
  const datesWithTimeReport = new Set<string>()
  const datesWithDraft = new Set<string>()

  for (const report of timeReports) {
    const key = toDateKey(report.date)
    datesWithTimeReport.add(key)
    if (report.status === 'DRAFT') datesWithDraft.add(key)
  }

  for (const absence of absences) {
    const key = toDateKey(absence.date)
    if (absence.status === 'DRAFT') datesWithDraft.add(key)
  }

  return { datesWithTimeReport, datesWithDraft }
}

export function timeReportCreateHref(dateKey: string, forUserId?: string): string {
  const params = new URLSearchParams({ date: dateKey })
  if (forUserId) params.set('forUserId', forUserId)
  return `/time-report?${params.toString()}`
}

export function countTimeReportWeekdays(days: DayCoverage[]): number {
  return days.filter(
    (d) => d.hasTimeReport && d.weekday >= 1 && d.weekday <= 5 && d.status !== 'future'
  ).length
}

/** t.ex. «1/5 fre» */
export function formatCoverageDateSv(dateKey: string): string {
  const d = parseDateOnlyLocal(dateKey)
  const day = d.getDate()
  const month = d.getMonth() + 1
  const weekday = WEEKDAY_LABELS[d.getDay()].toLowerCase()
  return `${day}/${month} ${weekday}`
}
