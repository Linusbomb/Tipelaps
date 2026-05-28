'use client'

import { Fragment, useState } from 'react'
import Link from 'next/link'
import type { DayCoverage, MonthCoverageSummary } from '@/lib/monthDayCoverage'
import { countTimeReportWeekdays, formatCoverageDateSv } from '@/lib/monthDayCoverage'
import { formatMonthYearSv } from '@/lib/monthReporting'
import MonthCoverageMiniCalendar from '@/app/components/MonthCoverageMiniCalendar'

type EmployeeCoverage = {
  userId: string
  name: string
  summary: MonthCoverageSummary
  days: DayCoverage[]
  warnings: DayCoverage[]
  hasWarnings: boolean
}

type AdminMonthCoveragePanelProps = {
  month: string
  employees: EmployeeCoverage[]
  companySummary: {
    employeeCount: number
    employeesWithIssues: number
    totalMissingWeekdays: number
    totalPartialWeekdays: number
  }
  loading?: boolean
}

export default function AdminMonthCoveragePanel({
  month,
  employees,
  companySummary,
  loading = false,
}: AdminMonthCoveragePanelProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [onlyWithIssues, setOnlyWithIssues] = useState(false)

  if (loading) {
    return (
      <div className="mb-8 rounded-xl border border-gray-200 bg-white p-6">
        <p className="text-gray-500">Laddar personalöversikt...</p>
      </div>
    )
  }

  const hasCompanyWarnings = companySummary.employeesWithIssues > 0
  const visibleEmployees = onlyWithIssues
    ? employees.filter((e) => e.hasWarnings)
    : employees

  return (
    <div className="mb-8 rounded-xl border-2 border-gray-200 bg-white overflow-hidden shadow-sm">
      <div
        className="px-4 py-4 border-b border-gray-200"
        style={{ background: 'linear-gradient(135deg, #F8FBF5 0%, #EEF6E8 100%)' }}
      >
        <h2 className="text-lg font-bold" style={{ color: '#2D5016' }}>
          Personal — {formatMonthYearSv(month)}
        </h2>
        <p className="text-sm text-gray-600 mt-1">
          Klicka på en person för att se kalender med tidrapporter och saknade dagar.
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 border-b border-gray-100">
        <div className="rounded-lg bg-gray-50 px-3 py-2">
          <p className="text-xs text-gray-600">Personal</p>
          <p className="text-xl font-bold">{companySummary.employeeCount}</p>
        </div>
        <div className="rounded-lg bg-gray-50 px-3 py-2">
          <p className="text-xs text-gray-600">Tidrapporter saknas</p>
          <p className="text-xl font-bold text-red-700">{companySummary.totalMissingWeekdays}</p>
          <p className="text-[10px] text-gray-500">vardagar totalt</p>
        </div>
        <div className="rounded-lg bg-gray-50 px-3 py-2">
          <p className="text-xs text-gray-600">Under 8 h</p>
          <p className="text-xl font-bold text-amber-800">{companySummary.totalPartialWeekdays}</p>
          <p className="text-[10px] text-gray-500">vardagar totalt</p>
        </div>
        <div className="rounded-lg bg-gray-50 px-3 py-2">
          <p className="text-xs text-gray-600">Behöver åtgärd</p>
          <p className="text-xl font-bold">{companySummary.employeesWithIssues}</p>
          <p className="text-[10px] text-gray-500">anställda</p>
        </div>
      </div>

      {hasCompanyWarnings ? (
        <div className="mx-4 mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-950">
          <p className="font-semibold">Varning</p>
          <p className="mt-1">
            {companySummary.employeesWithIssues} anställda har minst en vardag utan full
            rapportering.
          </p>
        </div>
      ) : (
        <div className="mx-4 mt-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-900">
          Alla anställda har komplett rapportering på passerade vardagar.
        </div>
      )}

      <div className="px-4 py-3 flex flex-wrap items-center gap-3 border-b border-gray-100">
        <label className="inline-flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
          <input
            type="checkbox"
            checked={onlyWithIssues}
            onChange={(e) => {
              setOnlyWithIssues(e.target.checked)
              setExpandedId(null)
            }}
            className="h-4 w-4"
          />
          Visa bara med avvikelser
        </label>
        <div className="flex flex-wrap gap-2 text-[10px] text-gray-600 ml-auto">
          <span className="inline-flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded bg-green-100 border border-green-300" /> Tidrapport
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded bg-red-100 border border-red-300" /> Saknas
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded bg-amber-100 border border-amber-300" /> Under 8 h
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded bg-blue-50 border border-blue-200" /> Utkast
          </span>
        </div>
      </div>

      {employees.length === 0 ? (
        <p className="p-6 text-gray-500 text-sm">Inga aktiva anställda i företaget.</p>
      ) : visibleEmployees.length === 0 ? (
        <p className="p-6 text-gray-500 text-sm">Inga anställda med avvikelser denna månad.</p>
      ) : (
        <div className="divide-y divide-gray-100">
          {visibleEmployees.map((employee) => {
            const timeReportDays = countTimeReportWeekdays(employee.days)
            const missingCount = employee.warnings.filter((d) => d.status === 'missing').length
            const partialCount = employee.warnings.filter((d) => d.status === 'partial').length
            const isExpanded = expandedId === employee.userId

            return (
              <Fragment key={employee.userId}>
                <button
                  type="button"
                  onClick={() =>
                    setExpandedId((id) => (id === employee.userId ? null : employee.userId))
                  }
                  className={`w-full text-left px-4 py-3 flex flex-wrap items-center gap-3 hover:bg-gray-50/80 transition-colors ${
                    employee.hasWarnings ? 'bg-amber-50/30' : ''
                  }`}
                >
                  <span
                    className="text-gray-400 text-sm w-5 shrink-0"
                    aria-hidden
                  >
                    {isExpanded ? '▾' : '▸'}
                  </span>
                  <span className="font-medium text-gray-900 min-w-[120px] flex-1">
                    {employee.name}
                  </span>
                  <span className="text-xs sm:text-sm text-gray-600 tabular-nums">
                    <span className="text-green-800 font-medium">{timeReportDays}</span> tidrapporter
                  </span>
                  <span className="text-xs sm:text-sm tabular-nums">
                    <span className={missingCount > 0 ? 'text-red-700 font-semibold' : 'text-gray-500'}>
                      {missingCount}
                    </span>{' '}
                    saknas
                  </span>
                  <span className="text-xs sm:text-sm tabular-nums">
                    <span className={partialCount > 0 ? 'text-amber-800 font-semibold' : 'text-gray-500'}>
                      {partialCount}
                    </span>{' '}
                    under 8 h
                  </span>
                  {employee.hasWarnings ? (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-950">
                      Åtgärd
                    </span>
                  ) : (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-900">
                      OK
                    </span>
                  )}
                </button>

                {isExpanded ? (
                  <div className="px-4 pb-4 pt-0 pl-9 flex flex-col sm:flex-row gap-4 items-start">
                    <MonthCoverageMiniCalendar
                      month={month}
                      days={employee.days}
                      variant="admin"
                      forUserId={employee.userId}
                    />
                    <div className="text-sm flex-1 min-w-0">
                      {employee.warnings.length > 0 ? (
                        <>
                          <p className="font-semibold text-gray-800 mb-2">Saknade / ofullständiga</p>
                          <ul className="space-y-1 max-h-40 overflow-y-auto">
                            {employee.warnings.map((day) => (
                              <li key={day.date} className="text-gray-700">
                                <span className="font-medium">{formatCoverageDateSv(day.date)}</span>
                                {' — '}
                                {day.status === 'missing'
                                  ? 'ingen tid eller frånvaro'
                                  : `${day.totalHours} h, saknas ${day.missingHours} h`}
                              </li>
                            ))}
                          </ul>
                        </>
                      ) : (
                        <p className="text-green-800">Inga avvikelser på passerade vardagar.</p>
                      )}
                      <Link
                        href={`/admin/employee/${employee.userId}/reports`}
                        className="inline-block mt-3 text-sm font-medium text-green-800 underline"
                      >
                        Alla rapporter för {employee.name}
                      </Link>
                    </div>
                  </div>
                ) : null}
              </Fragment>
            )
          })}
        </div>
      )}
    </div>
  )
}
