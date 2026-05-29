import { toDateKey } from '@/lib/monthDayCoverage'

export type CoverageMonthTimeReport = {
  id: string
  date: string | Date
  totalHours: number | null
  status: string
  customer: { name: string }
}

export type CoverageMonthAbsence = {
  id: string
  date: string | Date
  type: string
  isFullDay: boolean
  hours: number | null
  status: string
  note?: string | null
}

export function filterCoverageTimeReportsOnDate(
  reports: CoverageMonthTimeReport[],
  isoDate: string
): CoverageMonthTimeReport[] {
  return reports.filter((report) => toDateKey(report.date) === isoDate)
}

export function filterCoverageAbsencesOnDate(
  absences: CoverageMonthAbsence[],
  isoDate: string
): CoverageMonthAbsence[] {
  return absences.filter((absence) => toDateKey(absence.date) === isoDate)
}

export function dayHasCoverageRegistration(day: {
  hasTimeReport?: boolean
  hasAbsence?: boolean
  workHours?: number
  absenceHours?: number
}): boolean {
  return Boolean(
    day.hasTimeReport ||
      day.hasAbsence ||
      (day.workHours ?? 0) > 0 ||
      (day.absenceHours ?? 0) > 0
  )
}

/** Dag utan tid eller frånvaro — vit ruta i kalendern. */
export function dayHasNoRegistration(day: {
  hasTimeReport?: boolean
  hasAbsence?: boolean
  workHours?: number
  absenceHours?: number
}): boolean {
  return !dayHasCoverageRegistration(day)
}
