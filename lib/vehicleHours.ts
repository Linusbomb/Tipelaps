import { startOfWeek } from 'date-fns'

export type VehicleHoursPeriod = 'month' | 'week' | 'year'

export function parseVehicleHoursQuery(period: string, value: string) {
  if (period === 'month') {
    if (!/^\d{4}-\d{2}$/.test(value)) return null
    return { period: 'month' as const, month: value }
  }
  if (period === 'year') {
    const year = Number(value)
    if (!Number.isInteger(year) || year < 2000 || year > 2100) return null
    return { period: 'year' as const, year }
  }
  if (period === 'week') {
    const match = value.match(/^(\d{4})-W(\d{1,2})$/)
    if (!match) return null
    const year = Number(match[1])
    const week = Number(match[2])
    if (!Number.isInteger(year) || !Number.isInteger(week) || week < 1 || week > 53) return null
    return { period: 'week' as const, year, week }
  }
  return null
}

/** ISO-vecka: måndag–söndag i UTC för databasfilter. */
export function isoWeekRangeUtc(year: number, week: number) {
  const jan4 = new Date(Date.UTC(year, 0, 4))
  const day = jan4.getUTCDay() || 7
  const mondayWeek1 = new Date(jan4)
  mondayWeek1.setUTCDate(jan4.getUTCDate() - day + 1)
  const start = new Date(mondayWeek1)
  start.setUTCDate(mondayWeek1.getUTCDate() + (week - 1) * 7)
  const end = new Date(start)
  end.setUTCDate(start.getUTCDate() + 6)
  end.setUTCHours(23, 59, 59, 999)
  return { start, end }
}

export function currentIsoWeekKey(date = new Date()) {
  const d = new Date(date)
  d.setHours(12, 0, 0, 0)
  const thursday = new Date(d)
  thursday.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7))
  const year = thursday.getFullYear()
  const firstThursday = new Date(year, 0, 4)
  const week =
    1 +
    Math.round(
      ((thursday.getTime() - firstThursday.getTime()) / 86400000 -
        3 +
        ((firstThursday.getDay() + 6) % 7)) /
        7
    )
  return `${year}-W${String(week).padStart(2, '0')}`
}

export function buildVehiclePeriodOptions() {
  const now = new Date()
  const months: string[] = []
  for (let i = 0; i < 24; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    months.push(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    )
  }
  const years: number[] = []
  for (let y = now.getFullYear(); y >= now.getFullYear() - 5; y--) {
    years.push(y)
  }
  const weeks: string[] = []
  const cursor = startOfWeek(now, { weekStartsOn: 1 })
  for (let i = 0; i < 26; i++) {
    const wk = new Date(cursor)
    wk.setDate(cursor.getDate() - i * 7)
    weeks.push(currentIsoWeekKey(wk))
  }
  return { months, years, weeks: Array.from(new Set(weeks)) }
}
