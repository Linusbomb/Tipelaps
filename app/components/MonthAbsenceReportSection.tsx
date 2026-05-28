'use client'

import {
  isMonthReportDraft,
  monthReportStatusBadgeClass,
  monthReportStatusLabel,
} from '@/app/components/MonthCustomerReportFolders'
import { absenceHoursForPayroll, absenceTypeLabel } from '@/lib/absence'

export type MonthAbsenceRow = {
  id: string
  date: string
  type: string
  isFullDay: boolean
  hours: number | null
  status: string
  note?: string | null
}

type MonthAbsenceReportSectionProps = {
  absences: MonthAbsenceRow[]
  showSubmitHint?: boolean
  /** Visa rubriken «Frånvaro» även när listan är tom. */
  showWhenEmpty?: boolean
  emptyMessage?: string
}

export default function MonthAbsenceReportSection({
  absences,
  showSubmitHint = true,
  showWhenEmpty = false,
  emptyMessage = 'Inga frånvarorapporter.',
}: MonthAbsenceReportSectionProps) {
  if (absences.length === 0 && !showWhenEmpty) return null

  const sorted =
    absences.length === 0
      ? []
      : absences
          .slice()
          .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

  const totalHours = sorted.reduce(
    (sum, row) => sum + absenceHoursForPayroll(row.isFullDay, row.hours),
    0
  )
  const draftCount = sorted.filter((row) => isMonthReportDraft(row.status)).length
  const submittedCount = sorted.length - draftCount
  const allSubmitted = sorted.length > 0 && draftCount === 0

  return (
    <div
      className="rounded-xl border-2 overflow-hidden bg-white shadow-sm mb-6"
      style={{ borderColor: 'rgba(45, 80, 22, 0.22)' }}
    >
      <div
        className="px-4 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
        style={{ background: 'linear-gradient(135deg, #F8FBF5 0%, #EEF6E8 100%)' }}
      >
        <div>
          <h3 className="text-lg font-bold" style={{ color: '#2D5016' }}>
            Frånvaro
          </h3>
          <p className="text-sm text-gray-700 mt-0.5">
            {sorted.length} rapport{sorted.length === 1 ? '' : 'er'} ·{' '}
            {totalHours.toFixed(1)} timmar totalt
            {allSubmitted
              ? ' · Alla inskickade'
              : draftCount > 0 && submittedCount > 0
                ? ` · ${draftCount} utkast · ${submittedCount} inskickade`
                : draftCount > 0
                  ? ` · ${draftCount} utkast`
                  : submittedCount > 0
                    ? ` · ${submittedCount} inskickade`
                    : ''}
          </p>
          {showSubmitHint ? (
            <p className="text-xs text-gray-600 mt-1">
              Följer med vid &quot;Skicka alla utkast&quot;.
            </p>
          ) : null}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                Datum
              </th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                Timmar
              </th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                Status
              </th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                Bilaga
              </th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                Åtgärd
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-sm text-gray-500 text-center">
                  {emptyMessage}
                </td>
              </tr>
            ) : null}
            {sorted.map((absence) => {
              const draft = isMonthReportDraft(absence.status)
              const hours = absenceHoursForPayroll(absence.isFullDay, absence.hours)
              return (
                <tr
                  key={absence.id}
                  className={`hover:bg-gray-50/80 ${!draft ? 'bg-gray-50/40' : ''}`}
                >
                  <td className="px-4 py-2 text-sm">
                    {new Date(absence.date).toLocaleDateString('sv-SE')}
                  </td>
                  <td className="px-4 py-2 text-sm tabular-nums">{hours.toFixed(1)} h</td>
                  <td className="px-4 py-2 text-sm">
                    <span
                      className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${monthReportStatusBadgeClass(absence.status)}`}
                    >
                      {monthReportStatusLabel(absence.status)}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-sm">—</td>
                  <td className="px-4 py-2 text-sm">
                    <span className="font-medium text-green-800">{absenceTypeLabel(absence.type)}</span>
                    {absence.note?.trim() ? (
                      <span className="block text-xs text-gray-600 mt-0.5 truncate max-w-[200px]">
                        {absence.note}
                      </span>
                    ) : null}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
