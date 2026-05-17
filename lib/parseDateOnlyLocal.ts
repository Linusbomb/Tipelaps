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
