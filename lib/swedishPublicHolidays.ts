import { parseDateOnlyLocal } from '@/lib/parseDateOnlyLocal'

function toDateKeyLocal(value: Date): string {
  const y = value.getFullYear()
  const m = String(value.getMonth() + 1).padStart(2, '0')
  const d = String(value.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export type SwedishPublicHoliday = {
  date: string
  name: string
}

/** Påskdagen (västerländsk algoritm, Gergorian). */
function easterSunday(year: number): Date {
  const a = year % 19
  const b = Math.floor(year / 100)
  const c = year % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31) - 1
  const day = ((h + l - 7 * m + 114) % 31) + 1
  return new Date(year, month, day)
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  d.setDate(d.getDate() + days)
  return d
}

function fixedHoliday(year: number, monthIndex: number, day: number, name: string): SwedishPublicHoliday {
  return { date: toDateKeyLocal(new Date(year, monthIndex, day)), name }
}

/** Officiella röda dagar i Sverige för ett år. */
export function getSwedishPublicHolidays(year: number): SwedishPublicHoliday[] {
  const easter = easterSunday(year)
  const list: SwedishPublicHoliday[] = [
    fixedHoliday(year, 0, 1, 'Nyårsdagen'),
    fixedHoliday(year, 0, 6, 'Trettondedag jul'),
    { date: toDateKeyLocal(addDays(easter, -2)), name: 'Långfredagen' },
    { date: toDateKeyLocal(easter), name: 'Påskdagen' },
    { date: toDateKeyLocal(addDays(easter, 1)), name: 'Annandag påsk' },
    fixedHoliday(year, 4, 1, 'Första maj'),
    { date: toDateKeyLocal(addDays(easter, 39)), name: 'Kristi himmelsfärds dag' },
    fixedHoliday(year, 5, 6, 'Sveriges nationaldag'),
    { date: toDateKeyLocal(addDays(easter, 49)), name: 'Pingstdagen' },
    fixedHoliday(year, 11, 25, 'Juldagen'),
    fixedHoliday(year, 11, 26, 'Annandag jul'),
  ]

  const byDate = new Map<string, SwedishPublicHoliday>()
  for (const h of list) {
    byDate.set(h.date, h)
  }
  return Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date))
}

const holidayCache = new Map<number, Map<string, SwedishPublicHoliday>>()

function holidayMapForYear(year: number): Map<string, SwedishPublicHoliday> {
  let map = holidayCache.get(year)
  if (!map) {
    map = new Map(getSwedishPublicHolidays(year).map((h) => [h.date, h]))
    holidayCache.set(year, map)
  }
  return map
}

export function getSwedishPublicHoliday(date: Date | string): SwedishPublicHoliday | null {
  const d = typeof date === 'string' ? parseDateOnlyLocal(date) : date
  return holidayMapForYear(d.getFullYear()).get(toDateKeyLocal(d)) ?? null
}

export function isSwedishPublicHoliday(date: Date | string): boolean {
  return getSwedishPublicHoliday(date) != null
}

export function getSwedishPublicHolidaysInMonth(monthKey: string): SwedishPublicHoliday[] {
  const year = Number(monthKey.slice(0, 4))
  const month = Number(monthKey.slice(5, 7))
  return getSwedishPublicHolidays(year).filter((h) => {
    const m = Number(h.date.slice(5, 7))
    return m === month
  })
}

/** Röda dagar som infaller på vardag (helger räknas inte som röda i översikten). */
export function getWeekdaySwedishPublicHolidaysInMonth(monthKey: string): SwedishPublicHoliday[] {
  return getSwedishPublicHolidaysInMonth(monthKey).filter((h) => {
    const d = parseDateOnlyLocal(h.date)
    return !isWeekendDate(d)
  })
}

/** Röd dag i kalendern = officiell helgdag på vardag, inte lördag/söndag. */
export function isWeekdayPublicHoliday(date: Date | string): boolean {
  const d = typeof date === 'string' ? parseDateOnlyLocal(date) : date
  return !isWeekendDate(d) && getSwedishPublicHoliday(d) != null
}

export function isWeekendDate(date: Date | string): boolean {
  const d = typeof date === 'string' ? parseDateOnlyLocal(date) : date
  const day = d.getDay()
  return day === 0 || day === 6
}

/** Lördag, söndag eller officiell röd dag — hel arbetsdag räknas som övertid (arbete på helgdag). */
export function isHolidayOrWeekendWorkDate(date: Date | string): boolean {
  return isWeekendDate(date) || isSwedishPublicHoliday(date)
}

export const HOLIDAY_WORK_OVERTIME_LABEL = 'Arbete på helgdag'
