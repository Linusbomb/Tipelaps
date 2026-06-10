'use client'

import type { DayCoverage } from '@/lib/monthDayCoverage'
import { summarizeMonthHours } from '@/lib/monthDayCoverage'

const PRIMARY = '#2D5016'

type MonthCoverageHoursSummaryProps = {
  days: DayCoverage[]
  className?: string
}

export default function MonthCoverageHoursSummary({
  days,
  className = '',
}: MonthCoverageHoursSummaryProps) {
  const { expectedHours, registeredHours } = summarizeMonthHours(days)

  return (
    <div className={`grid gap-3 sm:grid-cols-2 ${className}`}>
      <div className="rounded-lg border border-[#2D5016]/15 bg-[#F8FBF5] px-4 py-3">
        <p className="text-sm font-medium text-gray-600">Förväntade timmar denna månad</p>
        <p className="mt-1 text-2xl font-bold tabular-nums" style={{ color: PRIMARY }}>
          {expectedHours} h
        </p>
      </div>
      <div className="rounded-lg border border-gray-200 bg-white px-4 py-3">
        <p className="text-sm font-medium text-gray-600">Registrerade timmar</p>
        <p
          className={`mt-1 text-2xl font-bold tabular-nums ${
            registeredHours >= expectedHours && expectedHours > 0
              ? 'text-green-800'
              : 'text-gray-900'
          }`}
        >
          {registeredHours} h
        </p>
      </div>
    </div>
  )
}
