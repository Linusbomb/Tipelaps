'use client'

import {
  describeDayRegistrations,
  registrationsOnDate,
  type DayAbsence,
  type DayTimeReport,
} from '@/lib/dayRegistrationConflicts'
import { formatCoverageDateSv } from '@/lib/monthDayCoverage'

type DayRegistrationNoticeProps = {
  date: string
  timeReports: DayTimeReport[]
  absences: DayAbsence[]
}

export default function DayRegistrationNotice({
  date,
  timeReports,
  absences,
}: DayRegistrationNoticeProps) {
  const dayReports = registrationsOnDate(timeReports, date)
  const dayAbsences = registrationsOnDate(absences, date)
  const lines = describeDayRegistrations(dayReports, dayAbsences)

  if (lines.length === 0) return null

  return (
    <div
      role="status"
      className="mt-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-950"
    >
      <p className="font-medium">Redan registrerat på {formatCoverageDateSv(date)}</p>
      <ul className="mt-1 list-disc space-y-0.5 pl-5">
        {lines.map((line, index) => (
          <li key={`${index}-${line}`}>{line}</li>
        ))}
      </ul>
    </div>
  )
}
