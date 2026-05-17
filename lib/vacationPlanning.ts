/** ISO veckodag: 1 = måndag … 5 = fredag */
export const VACATION_WORK_DAYS = [1, 2, 3, 4, 5] as const

export type VacationWorkDay = (typeof VACATION_WORK_DAYS)[number]

export const VACATION_DAY_LABELS: Record<VacationWorkDay, string> = {
  1: 'Mån',
  2: 'Tis',
  3: 'Ons',
  4: 'Tor',
  5: 'Fre',
}

export type VacationWeekEntry = {
  week: number
  days: VacationWorkDay[]
}

export const FULL_WORK_WEEK_DAYS: VacationWorkDay[] = [...VACATION_WORK_DAYS]

export function parseVacationDaysJson(days: string | null | undefined): VacationWorkDay[] {
  if (!days) return [...FULL_WORK_WEEK_DAYS]
  try {
    const parsed = JSON.parse(days) as unknown
    if (!Array.isArray(parsed)) return [...FULL_WORK_WEEK_DAYS]
    const valid = parsed
      .map((d) => Number(d))
      .filter((d): d is VacationWorkDay =>
        VACATION_WORK_DAYS.includes(d as VacationWorkDay)
      )
    return Array.from(new Set(valid)).sort((a, b) => a - b)
  } catch {
    return [...FULL_WORK_WEEK_DAYS]
  }
}

export function serializeVacationDays(days: VacationWorkDay[]): string {
  return JSON.stringify(
    Array.from(new Set(days))
      .filter((d) => VACATION_WORK_DAYS.includes(d))
      .sort((a, b) => a - b)
  )
}

export function isFullWorkWeek(days: VacationWorkDay[]): boolean {
  return FULL_WORK_WEEK_DAYS.every((d) => days.includes(d))
}

export function hasAnyVacationDay(days: VacationWorkDay[]): boolean {
  return days.length > 0
}

export function getWeekEntry(
  entries: VacationWeekEntry[],
  week: number
): VacationWeekEntry | undefined {
  return entries.find((e) => e.week === week)
}

export function getWeekDays(entries: VacationWeekEntry[], week: number): VacationWorkDay[] {
  return getWeekEntry(entries, week)?.days ?? []
}

export function upsertWeekDays(
  entries: VacationWeekEntry[],
  week: number,
  days: VacationWorkDay[]
): VacationWeekEntry[] {
  const sorted = Array.from(new Set(days))
    .filter((d) => VACATION_WORK_DAYS.includes(d))
    .sort((a, b) => a - b)

  if (sorted.length === 0) {
    return entries.filter((e) => e.week !== week)
  }

  const rest = entries.filter((e) => e.week !== week)
  return [...rest, { week, days: sorted }].sort((a, b) => a.week - b.week)
}

export function setFullWorkWeek(
  entries: VacationWeekEntry[],
  week: number
): VacationWeekEntry[] {
  return upsertWeekDays(entries, week, [...FULL_WORK_WEEK_DAYS])
}

export function toggleVacationDay(
  entries: VacationWeekEntry[],
  week: number,
  day: VacationWorkDay
): VacationWeekEntry[] {
  const current = getWeekDays(entries, week)
  const next = current.includes(day)
    ? current.filter((d) => d !== day)
    : [...current, day]
  return upsertWeekDays(entries, week, next)
}

export function weekButtonTone(days: VacationWorkDay[]): 'none' | 'partial' | 'full' {
  if (days.length === 0) return 'none'
  if (isFullWorkWeek(days)) return 'full'
  return 'partial'
}
