import { absenceHoursForPayroll } from '@/lib/absence'
import {
  calendarDateKeyFromParts,
  formatCalendarDateKey,
  parseDateOnlyLocal,
} from '@/lib/parseDateOnlyLocal'
import { getSwedishPublicHoliday, isWeekendDate } from '@/lib/swedishPublicHolidays'

export const STANDARD_WORK_DAY_HOURS = 8

export type DayCoverageStatus =
  | 'complete'
  | 'partial'
  | 'missing'
  | 'future'
  | 'weekend'
  | 'redDay'

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
  /** Frånvaro registrerad (utkast eller inlämnad). */
  hasAbsence: boolean
  /** Utkast (tid eller frånvaro) — dagen visas inte under «Dagar att åtgärda». */
  hasDraft: boolean
  /** Officiell röd dag (helgdag). */
  isRedDay: boolean
  redDayName: string | null
}

export type BuildMonthDayCoverageOptions = {
  datesWithTimeReport?: Set<string>
  datesWithAbsence?: Set<string>
  datesWithDraft?: Set<string>
  referenceDate?: Date
}

export type MonthCoverageSummary = {
  complete: number
  partial: number
  missing: number
  future: number
  weekend: number
  redDay: number
}

const WEEKDAY_LABELS = ['Sön', 'Mån', 'Tis', 'Ons', 'Tor', 'Fre', 'Lör'] as const

export function toDateKey(value: Date | string): string {
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      return trimmed
    }
    const head = /^(\d{4}-\d{2}-\d{2})/.exec(trimmed)
    if (head) {
      const fromIso = new Date(trimmed)
      if (!Number.isNaN(fromIso.getTime())) {
        return formatCalendarDateKey(fromIso)
      }
      return head[1]
    }
    return toDateKey(parseDateOnlyLocal(trimmed))
  }
  return formatCalendarDateKey(value)
}

export function isWeekdayDate(date: Date): boolean {
  return !isWeekendDate(date)
}

/** Vardag som inte är officiell röd dag — kräver normal rapportering. */
export function isRegularWorkday(date: Date | string): boolean {
  const d = typeof date === 'string' ? parseDateOnlyLocal(date) : date
  return isWeekdayDate(d) && !getSwedishPublicHoliday(d)
}

export function parseMonthKey(monthKey: string): { year: number; monthIndex: number } {
  const [y, m] = monthKey.split('-').map(Number)
  return { year: y, monthIndex: m - 1 }
}

/** Inkluderar hela kalendermånaden (UTC) — matchar hur datum sparas i databasen. */
export function monthDateRange(monthKey: string): { gte: Date; lt: Date } {
  const { year, monthIndex } = parseMonthKey(monthKey)
  return {
    gte: new Date(Date.UTC(year, monthIndex, 1)),
    lt: new Date(Date.UTC(year, monthIndex + 1, 1)),
  }
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
  const datesWithAbsence = options.datesWithAbsence ?? new Set<string>()
  const datesWithDraft = options.datesWithDraft ?? new Set<string>()
  const { year, monthIndex } = parseMonthKey(monthKey)
  const todayKey = formatCalendarDateKey(referenceDate)
  const lastDay = new Date(year, monthIndex + 1, 0).getDate()

  const days: DayCoverage[] = []
  const summary: MonthCoverageSummary = {
    complete: 0,
    partial: 0,
    missing: 0,
    future: 0,
    weekend: 0,
    redDay: 0,
  }

  for (let day = 1; day <= lastDay; day += 1) {
    const date = new Date(year, monthIndex, day)
    const dateKey = calendarDateKeyFromParts(year, monthIndex, day)
    const weekday = date.getDay()
    const weekdayLabel = WEEKDAY_LABELS[weekday]
    const hours = hoursByDate.get(dateKey) ?? { workHours: 0, absenceHours: 0 }
    const totalHours = hours.workHours + hours.absenceHours
    const isWeekend = isWeekendDate(date)
    const holiday = getSwedishPublicHoliday(date)
    const isRedDay = holiday != null && !isWeekend
    const hasAbsence = datesWithAbsence.has(dateKey) || hours.absenceHours > 0

    let status: DayCoverageStatus
    let missingHours = 0

    if (isWeekend) {
      status = 'weekend'
      summary.weekend += 1
    } else if (isRedDay) {
      status = 'redDay'
      summary.redDay += 1
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
      hasTimeReport: datesWithTimeReport.has(dateKey) || hours.workHours > 0,
      hasAbsence,
      hasDraft: datesWithDraft.has(dateKey),
      isRedDay,
      redDayName: holiday?.name ?? null,
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
      isRegularWorkday(d.date) &&
      d.status !== 'future' &&
      !d.hasDraft &&
      (d.status === 'missing' || d.status === 'partial')
  )
}

export function buildCoverageDraftDateSets(
  timeReports: Array<{ date: Date | string; status: string }>,
  absences: Array<{ date: Date | string; status: string }>
): {
  datesWithTimeReport: Set<string>
  datesWithAbsence: Set<string>
  datesWithDraft: Set<string>
} {
  const datesWithTimeReport = new Set<string>()
  const datesWithAbsence = new Set<string>()
  const datesWithDraft = new Set<string>()

  for (const report of timeReports) {
    const key = toDateKey(report.date)
    datesWithTimeReport.add(key)
    if (report.status === 'DRAFT') datesWithDraft.add(key)
  }

  for (const absence of absences) {
    const key = toDateKey(absence.date)
    datesWithAbsence.add(key)
    if (absence.status === 'DRAFT') datesWithDraft.add(key)
  }

  return { datesWithTimeReport, datesWithAbsence, datesWithDraft }
}

export function timeReportCreateHref(dateKey: string, forUserId?: string): string {
  const params = new URLSearchParams({ date: dateKey })
  if (forUserId) params.set('forUserId', forUserId)
  return `/time-report?${params.toString()}`
}

export function absenceCreateHref(dateKey: string, forUserId?: string): string {
  const params = new URLSearchParams({ date: dateKey, absence: '1' })
  if (forUserId) params.set('forUserId', forUserId)
  return `/time-report?${params.toString()}`
}

export function countTimeReportWeekdays(days: DayCoverage[]): number {
  return days.filter(
    (d) => d.hasTimeReport && d.weekday >= 1 && d.weekday <= 5 && d.status !== 'future'
  ).length
}

/** ISO-veckonummer (måndag–söndag) för ett kalenderdatum. */
export function getIsoWeekNumber(dateKey: string): number {
  const d = parseDateOnlyLocal(dateKey)
  const target = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  const dayNr = (target.getUTCDay() + 6) % 7
  target.setUTCDate(target.getUTCDate() - dayNr + 3)
  const firstThursday = target.getTime()
  target.setUTCMonth(0, 1)
  if (target.getUTCDay() !== 4) {
    target.setUTCMonth(0, 1 + ((4 - target.getUTCDay() + 7) % 7))
  }
  return 1 + Math.ceil((firstThursday - target.getTime()) / 604800000)
}

export type MonthCalendarWeekRow = {
  isoWeek: number
  /** Summan arbetade timmar (tidrapport) för dagar i månaden den veckoraden. */
  workHoursInMonth: number
  days: (DayCoverage | null)[]
}

export function buildMonthCalendarWeeks(
  monthKey: string,
  days: DayCoverage[]
): MonthCalendarWeekRow[] {
  const { year, monthIndex } = parseMonthKey(monthKey)
  const firstWeekday = new Date(year, monthIndex, 1).getDay()
  const leadingBlanks = firstWeekday === 0 ? 6 : firstWeekday - 1

  const cells: (DayCoverage | null)[] = [
    ...Array.from({ length: leadingBlanks }, () => null),
    ...days,
  ]
  while (cells.length % 7 !== 0) {
    cells.push(null)
  }

  const rows: MonthCalendarWeekRow[] = []
  for (let i = 0; i < cells.length; i += 7) {
    const weekCells = cells.slice(i, i + 7)
    const monthDaysInRow = weekCells.filter((c): c is DayCoverage => c != null)
    const workHoursInMonth = monthDaysInRow.reduce((sum, d) => sum + d.workHours, 0)
    const isoWeek =
      monthDaysInRow.length > 0
        ? getIsoWeekNumber(monthDaysInRow[0].date)
        : rows.length > 0
          ? rows[rows.length - 1]!.isoWeek
          : getIsoWeekNumber(calendarDateKeyFromParts(year, monthIndex, 1))

    rows.push({ isoWeek, workHoursInMonth, days: weekCells })
  }

  return rows
}

/** t.ex. «1/5 fre» */
export function formatCoverageDateSv(dateKey: string): string {
  const d = parseDateOnlyLocal(dateKey)
  const day = d.getDate()
  const month = d.getMonth() + 1
  const weekday = WEEKDAY_LABELS[d.getDay()].toLowerCase()
  return `${day}/${month} ${weekday}`
}
