'use client'

import type { DayCoverage, MonthCoverageSummary } from '@/lib/monthDayCoverage'
import { formatMonthYearSv } from '@/lib/monthReporting'
import MonthCoverageMiniCalendar from '@/app/components/MonthCoverageMiniCalendar'

type MonthDayCoveragePanelProps = {
  month: string
  days: DayCoverage[]
  summary: MonthCoverageSummary
  warnings: DayCoverage[]
  hasWarnings: boolean
  loading?: boolean
}

export default function MonthDayCoveragePanel({
  month,
  days,
  warnings,
  hasWarnings,
  loading = false,
}: MonthDayCoveragePanelProps) {
  if (loading) {
    return (
      <div className="mb-8 rounded-xl border border-gray-200 bg-white p-6">
        <p className="text-gray-500">Laddar månadsöversikt...</p>
      </div>
    )
  }

  const warningMissing = warnings.filter((d) => d.status === 'missing').length
  const warningPartial = warnings.filter((d) => d.status === 'partial').length

  return (
    <div className="mb-8 rounded-xl border-2 border-gray-200 bg-white overflow-hidden shadow-sm">
      <div
        className="px-4 py-4 border-b border-gray-200"
        style={{ background: 'linear-gradient(135deg, #F8FBF5 0%, #EEF6E8 100%)' }}
      >
        <h2 className="text-lg font-bold" style={{ color: '#2D5016' }}>
          Månadsöversikt — {formatMonthYearSv(month)}
        </h2>
        <p className="text-sm text-gray-600 mt-1">
          Grönt = tidrapport finns. Klicka på en dag för att skapa rapport med datum ifyllt.
        </p>
      </div>

      <div className="p-4">
        <MonthCoverageMiniCalendar month={month} days={days} variant="employee" />
        <p className="mt-3 text-xs text-gray-500">
          Grön = tidrapport · Vit = ingen tidrapport
        </p>
      </div>

      {hasWarnings ? (
        <div className="mx-4 mb-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <p className="font-semibold">Varning — saknad eller ofullständig rapportering</p>
          <p className="mt-1">
            {warningMissing > 0 && (
              <span>
                {warningMissing} vardag{warningMissing === 1 ? '' : 'ar'} utan rapport.{' '}
              </span>
            )}
            {warningPartial > 0 && (
              <span>
                {warningPartial} vardag{warningPartial === 1 ? '' : 'ar'} med under 8 timmar.
              </span>
            )}
          </p>
        </div>
      ) : (
        <div className="mx-4 mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-900">
          Inga vardagar kvar att åtgärda denna månad (utkast räknas inte som saknade).
        </div>
      )}
    </div>
  )
}
