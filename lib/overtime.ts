/**
 * Hjälpfunktioner för övertid på en tidrapport.
 *
 * Övertid registreras som intervall HH:mm–HH:mm. Om sluttiden ligger före
 * starttiden tolkas det som att intervallet sträcker sig över midnatt och
 * sluttiden ges +24h.
 */

export type OvertimeInput = {
  startTime: string
  endTime: string
  note?: string | null
}

export type CleanedOvertimeEntry = {
  startTime: string
  endTime: string
  hours: number
  note: string | null
}

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/

function toMinutes(timeStr: string): number {
  const m = TIME_RE.exec(timeStr.trim())
  if (!m) return Number.NaN
  return parseInt(m[1], 10) * 60 + parseInt(m[2], 10)
}

/** Returnerar antal timmar (decimal, max 1 decimal) eller NaN om input är ogiltig. */
export function calculateOvertimeHours(startTime: string, endTime: string): number {
  const start = toMinutes(startTime)
  const end = toMinutes(endTime)
  if (Number.isNaN(start) || Number.isNaN(end)) return Number.NaN
  if (start === end) return Number.NaN
  let diff = end - start
  if (diff < 0) {
    diff += 24 * 60
  }
  if (diff <= 0 || diff >= 24 * 60) return Number.NaN
  return Math.round((diff / 60) * 100) / 100
}

/** Validerar och normaliserar övertidsrader. Kasta TypeError vid ogiltig data. */
export function cleanOvertimeEntries(input: unknown): CleanedOvertimeEntry[] {
  if (input == null) return []
  if (!Array.isArray(input)) {
    throw new TypeError('overtimeEntries måste vara en lista')
  }

  return input.map((raw, index) => {
    if (!raw || typeof raw !== 'object') {
      throw new TypeError(`Övertidsrad ${index + 1}: ogiltig data`)
    }
    const startTime = String((raw as any).startTime ?? '').trim()
    const endTime = String((raw as any).endTime ?? '').trim()
    if (!TIME_RE.test(startTime) || !TIME_RE.test(endTime)) {
      throw new TypeError(`Övertidsrad ${index + 1}: använd formatet HH:mm för start och slut`)
    }
    const hours = calculateOvertimeHours(startTime, endTime)
    if (Number.isNaN(hours) || hours <= 0) {
      throw new TypeError(`Övertidsrad ${index + 1}: ogiltigt tidsintervall`)
    }
    const noteRaw = (raw as any).note
    const note =
      typeof noteRaw === 'string' && noteRaw.trim().length > 0 ? noteRaw.trim() : null
    return { startTime, endTime, hours, note }
  })
}

export function sumOvertimeHours(entries: { hours: number }[] | null | undefined): number {
  if (!entries || entries.length === 0) return 0
  return Math.round(entries.reduce((sum, e) => sum + (e.hours || 0), 0) * 100) / 100
}
