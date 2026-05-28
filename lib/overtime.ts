import { prisma } from '@/lib/prisma'

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
  entries: OvertimeEntryLike[] = []
): Promise<void> {
  const overtimeHours = computeOvertimeHours(totalHours, entries)
  await prisma.$executeRaw`
    UPDATE "TimeReport" SET "overtimeHours" = ${overtimeHours} WHERE "id" = ${reportId}
  `
}

/** Värde från databas om satt, annars räkna om (t.ex. äldre rapporter före backfill). */
export function resolveOvertimeHours(
  stored: number | null | undefined,
  totalHours: number,
  entries: OvertimeEntryLike[] = []
): number {
  const computed = computeOvertimeHours(totalHours, entries)
  if (stored == null || !Number.isFinite(stored)) return computed
  if (stored > 0) return stored
  return computed
}
