'use client'

import { useMemo } from 'react'
import type { DayCoverage } from '@/lib/monthDayCoverage'
import {
  STANDARD_WORK_DAY_HOURS,
  buildMonthCalendarWeeks,
  formatCoverageDateSv,
} from '@/lib/monthDayCoverage'
import {
  dayHasCoverageRegistration,
  dayHasNoRegistration,
} from '@/lib/monthCoverageRegistrations'

const WEEKDAY_HEADERS = ['Mån', 'Tis', 'Ons', 'Tor', 'Fre', 'Lör', 'Sön'] as const

export type MiniCalendarVariant = 'employee' | 'admin'

type DayCellAppearance = {
  className: string
}

function dayTitle(day: DayCoverage): string {
  let title = formatCoverageDateSv(day.date)
  if (day.redDayName) title += ` — ${day.redDayName}`
  if (day.hasAbsence) title += ` · Frånvaro ${day.absenceHours} h`
  if (day.hasTimeReport) title += ` · Tid ${day.workHours} h`
  if (dayHasNoRegistration(day)) {
    title += ' · Inget registrerat'
  } else if (!day.hasAbsence && day.totalHours < STANDARD_WORK_DAY_HOURS) {
    title += ` · ${day.totalHours} h (under ${STANDARD_WORK_DAY_HOURS} h)`
  }
  return title
}

function redDayFrame(day: DayCoverage): string {
  return day.isRedDay && day.status !== 'weekend'
    ? 'border-red-400 ring-1 ring-red-300'
    : ''
}

function isUnderEightHoursRegistered(day: DayCoverage): boolean {
  return !day.hasAbsence && day.totalHours > 0 && day.totalHours < STANDARD_WORK_DAY_HOURS
}

function coverageDayAppearance(day: DayCoverage, variant: MiniCalendarVariant): DayCellAppearance {
  const base =
    variant === 'admin'
      ? 'aspect-square flex items-center justify-center rounded-md border text-xs font-medium transition-colors'
      : 'aspect-square flex items-center justify-center rounded-md border text-sm font-medium transition-colors'

  const redFrame = redDayFrame(day)

  if (day.status === 'weekend') {
    return {
      className: `${base} bg-gray-50 text-gray-400 border-gray-200`,
    }
  }

  if (variant === 'admin' && day.status === 'future') {
    return { className: `${base} bg-gray-50/60 text-gray-300 border-gray-100` }
  }

  if (variant === 'admin' && day.hasDraft && dayHasNoRegistration(day)) {
    return { className: `${base} bg-blue-50 text-blue-900 border-blue-200` }
  }

  if (day.isRedDay && dayHasNoRegistration(day)) {
    return {
      className: `${base} bg-red-100 text-red-900 border-red-300 hover:bg-red-200`,
    }
  }

  if (day.hasAbsence) {
    return {
      className: `${base} bg-violet-200 text-violet-950 border-violet-400 hover:bg-violet-300 ${redFrame}`,
    }
  }

  if (day.totalHours >= STANDARD_WORK_DAY_HOURS) {
    return {
      className: `${base} bg-green-300 text-green-950 border-green-500 hover:bg-green-400 ${redFrame}`,
    }
  }

  if (isUnderEightHoursRegistered(day)) {
    return {
      className: `${base} bg-yellow-200 text-yellow-950 border-yellow-500 hover:bg-yellow-300 ${redFrame}`,
    }
  }

  if (day.status === 'future') {
    return { className: `${base} bg-gray-50/80 text-gray-400 border-gray-200` }
  }

  return {
    className: `${base} bg-white text-gray-800 border-gray-200 hover:bg-gray-50 hover:border-gray-400 ${redFrame}`,
  }
}

function dayCanRegister(day: DayCoverage, variant: MiniCalendarVariant): boolean {
  if (day.status === 'weekend' || day.status === 'future') return false
  if (!dayHasNoRegistration(day)) return false
  if (variant === 'admin' && day.hasDraft) return false
  return true
}

type MonthCoverageMiniCalendarProps = {
  month: string
  days: DayCoverage[]
  variant?: MiniCalendarVariant
  forUserId?: string
  className?: string
  onRegisteredDayClick?: (dateKey: string) => void
  onEmptyDayClick?: (dateKey: string) => void
}

export default function MonthCoverageMiniCalendar({
  month,
  days,
  variant = 'employee',
  forUserId,
  className = '',
  onRegisteredDayClick,
  onEmptyDayClick,
}: MonthCoverageMiniCalendarProps) {
  const weekRows = useMemo(() => buildMonthCalendarWeeks(month, days), [month, days])

  const renderDay = (day: DayCoverage) => {
    const { className: cellClassName } = coverageDayAppearance(day, variant)
    const title = dayTitle(day)
    const showDetail = onRegisteredDayClick && dayHasCoverageRegistration(day)
    const showRegister = onEmptyDayClick && dayCanRegister(day, variant)

    if (showDetail) {
      return (
        <button
          type="button"
          className={`${cellClassName} cursor-pointer w-full`}
          title={title}
          onClick={() => onRegisteredDayClick(day.date)}
        >
          {day.dayOfMonth}
        </button>
      )
    }

    if (showRegister) {
      return (
        <button
          type="button"
          className={`${cellClassName} cursor-pointer w-full`}
          title={title}
          onClick={() => onEmptyDayClick(day.date)}
        >
          {day.dayOfMonth}
        </button>
      )
    }

    return (
      <span className={`${cellClassName} w-full`} title={title}>
        {day.dayOfMonth}
      </span>
    )
  }

  return (
    <div className={`max-w-md ${className}`}>
      <div
        className="grid gap-1 mb-1"
        style={{ gridTemplateColumns: '2.75rem repeat(7, minmax(0, 1fr))' }}
      >
        <div className="text-[10px] font-medium text-gray-500 text-center py-0.5">V</div>
        {WEEKDAY_HEADERS.map((label) => (
          <div
            key={label}
            className={`text-center text-[10px] font-medium py-0.5 ${
              label === 'Lör' || label === 'Sön' ? 'text-gray-400' : 'text-gray-500'
            }`}
          >
            {label}
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-1">
        {weekRows.map((row) => (
          <div
            key={`week-${row.isoWeek}-${row.days[0]?.date ?? 'pad'}`}
            className="grid gap-1 items-stretch"
            style={{ gridTemplateColumns: '2.75rem repeat(7, minmax(0, 1fr))' }}
          >
            <div className="flex flex-col items-center justify-center rounded-md border border-gray-200 bg-gray-50 px-0.5 py-1 text-center min-h-[2.25rem]">
              <span className="text-[10px] font-semibold text-gray-700 leading-tight">
                v.{row.isoWeek}
              </span>
              <span className="text-[9px] text-gray-600 tabular-nums leading-tight mt-0.5">
                {row.workHoursInMonth > 0 ? `${row.workHoursInMonth.toFixed(1)} h` : '—'}
              </span>
            </div>
            {row.days.map((day, index) =>
              day ? (
                <div key={day.date} className="min-w-0">
                  {renderDay(day)}
                </div>
              ) : (
                <div key={`empty-${row.isoWeek}-${index}`} className="aspect-square" />
              )
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

/** Liten färgruta i förklaringstexten. */
export function CoverageLegendSwatch({
  className = '',
  colorClass,
}: {
  className?: string
  colorClass: string
}) {
  return (
    <span
      className={`inline-block h-3 w-3 rounded border shrink-0 ${colorClass} ${className}`}
      aria-hidden
    />
  )
}
