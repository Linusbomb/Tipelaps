/** Kalenderdatum för svensk tidrapportering (lagras och visas konsekvent). */
export const APP_CALENDAR_TIMEZONE = 'Europe/Stockholm'

/**
 * Parse YYYY-MM-DD as calendar date in local semantics (avoid UTC midnight
 * shifting the calendar day/month in negative timezones).
 */
export function parseDateOnlyLocal(dateStr: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateStr).trim())
  if (!m) return new Date(dateStr)
  const y = Number(m[1])
  const mo = Number(m[2])
  const d = Number(m[3])
  return new Date(y, mo - 1, d)
}

/** YYYY-MM-DD för ett kalenderdatum (år, månad 0–11, dag). */
export function calendarDateKeyFromParts(year: number, monthIndex: number, day: number): string {
  return `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

/** Tolka YYYY-MM-DD som UTC midnatt — samma kalenderdag i databas oavsett servertid. */
export function parseDateOnlyToStorage(dateStr: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateStr).trim())
  if (!m) {
    const local = parseDateOnlyLocal(dateStr)
    return new Date(Date.UTC(local.getFullYear(), local.getMonth(), local.getDate()))
  }
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])))
}

/** Kalenderdag (YYYY-MM-DD) för ett Date-värde i appens tidszon. */
export function formatCalendarDateKey(value: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: APP_CALENDAR_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(value)
}
