import { prisma } from '@/lib/prisma'
import {
  HOLIDAY_WORK_OVERTIME_LABEL,
  isHolidayOrWeekendWorkDate,
} from '@/lib/swedishPublicHolidays'
export { HOLIDAY_WORK_OVERTIME_LABEL }

type OvertimeEntryLike = {
  hours?: number | null
  startTime?: string | null
  endTime?: string | null
}

/** Normal arbetstid per dag (timmar) – grundregel för övertid. */
export const STANDARD_DAY_HOURS = 8
export const NORMAL_WORK_START = '07:00'
export const NORMAL_WORK_END = '16:00'

const DAY_MINUTES = 24 * 60
const NORMAL_START_MINUTES = 7 * 60
const NORMAL_END_MINUTES = 16 * 60

function parseClockMinutes(value: string | null | undefined): number | null {
  if (!value || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) return null
  const [hours, minutes] = value.split(':').map(Number)
  return hours * 60 + minutes
}

function overlapMinutes(aStart: number, aEnd: number, bStart: number, bEnd: number): number {
  return Math.max(0, Math.min(aEnd, bEnd) - Math.max(aStart, bStart))
}

function outsideNormalWorkHours(startTime: string | null | undefined, endTime: string | null | undefined): number {
  const start = parseClockMinutes(startTime)
  const rawEnd = parseClockMinutes(endTime)
  if (start == null || rawEnd == null) return 0

  const end = rawEnd <= start ? rawEnd + DAY_MINUTES : rawEnd
  const duration = Math.max(0, end - start)
  if (duration <= 0) return 0

  let normalMinutes = 0
  const startDay = Math.floor(start / DAY_MINUTES)
  const endDay = Math.floor((end - 1) / DAY_MINUTES)
  for (let day = startDay; day <= endDay; day += 1) {
    const offset = day * DAY_MINUTES
    normalMinutes += overlapMinutes(
      start,
      end,
      offset + NORMAL_START_MINUTES,
      offset + NORMAL_END_MINUTES
    )
  }

  return Math.round(((duration - normalMinutes) / 60) * 100) / 100
}

export type OvertimeResult = {
  hours: number
  /** Hela dagen räknas som övertid (helg eller röd dag). */
  isHolidayWork: boolean
}

/** Övertid = helg/röd dag (alla timmar) eller vardag över 8 h / utanför 07:00–16:00. */
export function computeOvertime(
  totalHours: number,
  entries: OvertimeEntryLike[] = [],
  reportDate?: Date | string | null
): OvertimeResult {
  if (reportDate != null && isHolidayOrWeekendWorkDate(reportDate)) {
    const hours = Math.round(Math.max(0, totalHours) * 100) / 100
    return { hours, isHolidayWork: true }
  }
  return { hours: computeOvertimeHours(totalHours, entries), isHolidayWork: false }
}

/** Övertid = arbetstid över 8 h och/eller arbetstid utanför 07:00-16:00. */
export function computeOvertimeHours(totalHours: number, entries: OvertimeEntryLike[] = []): number {
  const dailyOvertime =
    Number.isFinite(totalHours) && totalHours > STANDARD_DAY_HOURS
      ? totalHours - STANDARD_DAY_HOURS
      : 0
  const clockOvertime = entries.reduce(
    (sum, entry) => sum + outsideNormalWorkHours(entry.startTime, entry.endTime),
    0
  )
  return Math.round(Math.max(dailyOvertime, clockOvertime) * 100) / 100
}

/** Visning: "2" eller "2,5" (svensk decimal). */
export function formatOvertimeHours(hours: number): string {
  if (!Number.isFinite(hours) || hours <= 0) return '0'
  const rounded = Math.round(hours * 100) / 100
  if (rounded % 1 === 0) return String(rounded)
  return rounded.toFixed(1).replace('.', ',')
}

/** Skriver övertid till DB (fungerar även om Prisma-klienten inte är regenererad än). */
export async function persistReportOvertimeHours(
  reportId: string,
  totalHours: number,
  entries: OvertimeEntryLike[] = [],
  reportDate?: Date | string | null
): Promise<void> {
  const overtimeHours = computeOvertime(totalHours, entries, reportDate).hours
  await prisma.$executeRaw`
    UPDATE "TimeReport" SET "overtimeHours" = ${overtimeHours} WHERE "id" = ${reportId}
  `
}

/** Värde från databas om satt, annars räkna om (t.ex. äldre rapporter före backfill). */
export function resolveOvertimeHours(
  stored: number | null | undefined,
  totalHours: number,
  entries: OvertimeEntryLike[] = [],
  reportDate?: Date | string | null
): number {
  const computed = computeOvertime(totalHours, entries, reportDate).hours
  if (stored == null || !Number.isFinite(stored)) return computed
  if (stored > 0) return stored
  return computed
}

export function isHolidayWorkOvertime(
  totalHours: number,
  entries: OvertimeEntryLike[] = [],
  reportDate?: Date | string | null
): boolean {
  if (reportDate == null) return false
  return computeOvertime(totalHours, entries, reportDate).isHolidayWork
}
