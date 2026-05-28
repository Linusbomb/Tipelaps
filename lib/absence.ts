export const ABSENCE_TYPES = [
  { value: 'WORK_TIME_REDUCTION', label: 'Arbetstidsförkortning' },
  { value: 'PARENTAL_LEAVE', label: 'Föräldraledig' },
  { value: 'PUBLIC_HOLIDAY_COMPENSATION', label: 'Helgdagsersättning' },
  { value: 'COMP_TIME', label: 'Kompledig' },
  { value: 'VACATION', label: 'Semester' },
  { value: 'SICK', label: 'Sjuk' },
  { value: 'UNPAID_LEAVE', label: 'Tjänstledig' },
  { value: 'VAB', label: 'VAB' },
] as const

export type AbsenceType = (typeof ABSENCE_TYPES)[number]['value']

export const FULL_DAY_ABSENCE_HOURS = 8

const TYPE_LABELS = new Map<string, string>(ABSENCE_TYPES.map((type) => [type.value, type.label]))

export function isAbsenceType(value: unknown): value is AbsenceType {
  return typeof value === 'string' && TYPE_LABELS.has(value)
}

export function absenceTypeLabel(value: string): string {
  return TYPE_LABELS.get(value) ?? value
}

export function absenceScopeLabel(isFullDay: boolean, hours: number | null | undefined): string {
  if (isFullDay) return 'Hel dag'
  return `Del av dag${hours && hours > 0 ? ` (${hours} h)` : ''}`
}

export function absenceHoursForPayroll(isFullDay: boolean, hours: number | null | undefined): number {
  if (isFullDay) return FULL_DAY_ABSENCE_HOURS
  return Number(hours) || 0
}
