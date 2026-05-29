'use client'

import { useMemo, useState } from 'react'
import type { DayCoverage, MonthCoverageSummary } from '@/lib/monthDayCoverage'
import { formatMonthYearSv } from '@/lib/monthReporting'
import {
  filterCoverageAbsencesOnDate,
  filterCoverageTimeReportsOnDate,
  type CoverageMonthAbsence,
  type CoverageMonthTimeReport,
} from '@/lib/monthCoverageRegistrations'
import CoverageDayDetailModal from '@/app/components/CoverageDayDetailModal'
import CoverageRegisterDayModal from '@/app/components/CoverageRegisterDayModal'
import MonthCoverageMiniCalendar, {
  CoverageLegendSwatch,
} from '@/app/components/MonthCoverageMiniCalendar'

type MonthDayCoveragePanelProps = {
  month: string
  days: DayCoverage[]
  summary: MonthCoverageSummary
  warnings: DayCoverage[]
  hasWarnings: boolean
  timeReports?: CoverageMonthTimeReport[]
  absences?: CoverageMonthAbsence[]
  loading?: boolean
}

export default function MonthDayCoveragePanel({
  month,
  days,
  warnings,
  hasWarnings,
  timeReports = [],
  absences = [],
  loading = false,
}: MonthDayCoveragePanelProps) {
  const [selectedDay, setSelectedDay] = useState<string | null>(null)
  const [registerDay, setRegisterDay] = useState<string | null>(null)

  const selectedDayReports = useMemo(
    () => (selectedDay ? filterCoverageTimeReportsOnDate(timeReports, selectedDay) : []),
    [selectedDay, timeReports]
  )
  const selectedDayAbsences = useMemo(
    () => (selectedDay ? filterCoverageAbsencesOnDate(absences, selectedDay) : []),
    [selectedDay, absences]
  )

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
    <>
      <div className="mb-8 rounded-xl border-2 border-gray-200 bg-white overflow-hidden shadow-sm">
        <div
          className="px-4 py-4 border-b border-gray-200"
          style={{ background: 'linear-gradient(135deg, #F8FBF5 0%, #EEF6E8 100%)' }}
        >
          <h2 className="text-lg font-bold" style={{ color: '#2D5016' }}>
            Månadsöversikt — {formatMonthYearSv(month)}
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            Vit = inget registrerat · Grön = 8 h+ · Gul = registrerat men under 8 h · Lila =
            frånvaro · Röd = röd dag · Grå = helg. Klicka på en dag för att registrera eller se
            detaljer.
          </p>
        </div>

        <div className="p-4">
          <MonthCoverageMiniCalendar
            month={month}
            days={days}
            variant="employee"
            onRegisteredDayClick={setSelectedDay}
            onEmptyDayClick={setRegisterDay}
          />
          <p className="mt-3 text-xs text-gray-500 flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="inline-flex items-center gap-1">
              <CoverageLegendSwatch colorClass="bg-white border-gray-300" />
              Inget
            </span>
            <span className="inline-flex items-center gap-1">
              <CoverageLegendSwatch colorClass="bg-green-300 border-green-500" />
              8 h+
            </span>
            <span className="inline-flex items-center gap-1">
              <CoverageLegendSwatch colorClass="bg-yellow-200 border-yellow-500" />
              Under 8 h
            </span>
            <span className="inline-flex items-center gap-1">
              <CoverageLegendSwatch colorClass="bg-violet-200 border-violet-400" />
              Frånvaro
            </span>
            <span className="inline-flex items-center gap-1">
              <CoverageLegendSwatch colorClass="bg-red-100 border-red-300" />
              Röd dag
            </span>
            <span className="inline-flex items-center gap-1">
              <CoverageLegendSwatch colorClass="bg-gray-50 border-gray-200" />
              Helg
            </span>
            <span className="text-gray-500">v. = veckonr · h = arbetade timmar i månaden</span>
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

      <CoverageDayDetailModal
        open={selectedDay !== null}
        dateKey={selectedDay ?? ''}
        timeReports={selectedDayReports}
        absences={selectedDayAbsences}
        onClose={() => setSelectedDay(null)}
      />

      <CoverageRegisterDayModal
        open={registerDay !== null}
        dateKey={registerDay ?? ''}
        onClose={() => setRegisterDay(null)}
      />
    </>
  )
}
